'use strict';

/**
 * marketSimulator: the SOLE authority for simulated prices.
 *
 *   price(symbol, scenario, tick) = f(seed, instrument, scenario, tick)
 *
 * - Pure and deterministic: the same (company, scenario, tick) always gives the
 *   same price, across requests, screens and server restarts. There is no
 *   Math.random() and no state that depends on request order.
 * - O(1) per price: nothing is compounded from tick 0. The log-price is a sum of
 *   a bounded drift term, smooth seeded cycles, hash-based lattice noise at hour
 *   and day scale, and a small bounded per-tick noise term.
 * - Time-driven: tickIndex = floor((now - epoch) * speed / tickDuration). The
 *   clock is injectable, so tests can freeze and advance time.
 * - Per-tick moves stay under ~30 bps (market-config pricing_contract), except
 *   for the optional scenario shock, which is ramped in over one simulated day.
 *
 * All prices are INTEGER CENTS, clamped to price_floor_cents.
 */
const { hash01 } = require('../utils/hash');
const { badRequest } = require('../utils/errors');

const DAY_MS = 86_400_000;
const TWO_PI = Math.PI * 2;
const RANGE_DAYS = { '1D': 1, '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365 };

function smoothstep(x) {
    const c = x <= 0 ? 0 : (x >= 1 ? 1 : x);
    return c * c * (3 - 2 * c);
}

/** Smoothly interpolated value noise in [-1, 1], continuous in x. */
function latticeNoise(seed, key, scale, x) {
    const i = Math.floor(x);
    const f = x - i;
    const a = hash01(seed, key, scale, i) * 2 - 1;
    const b = hash01(seed, key, scale, i + 1) * 2 - 1;
    return a + (b - a) * smoothstep(f);
}

function createMarketSimulator({ marketConfig, scenarios, benchmarks, clock, scenarioId }) {
    const sim = marketConfig.simulation;
    const epochMs = Date.parse(sim.epoch_utc);
    const tickMs = sim.tick_duration_ms;
    const speed = sim.simulation_speed;
    const seed = sim.seed;
    const floorCents = sim.price_floor_cents;
    const ticksPerDay = DAY_MS / tickMs;

    const scenarioById = new Map(scenarios.map((s) => [s.id, s]));
    const activeScenarioId = scenarioId || sim.default_scenario_id;
    if (!scenarioById.has(activeScenarioId)) {
        throw new Error(`Unknown simulation scenario "${activeScenarioId}"`);
    }

    const companyModels = new Map(marketConfig.instruments.map((i) => [i.company_id, {
        key: i.company_id,
        base: i.base_price_cents,
        driftBps: i.drift_per_sim_day_bps,
        vol: i.volatility_multiplier,
        phase: i.phase
    }]));
    const benchmarkModels = new Map(benchmarks.map((b, index) => [b.id, {
        key: 1000 + index,
        base: b.base_value,
        driftBps: b.drift_per_sim_day_bps,
        vol: b.volatility_multiplier,
        phase: hash01(seed, 9000, b.seed) * TWO_PI
    }]));

    /** ln(price / base) for one model at one tick under one scenario. */
    function logFactor(model, tick, sc) {
        const days = tick / ticksPerDay;
        const volK = model.vol * sc.volatility_multiplier;
        // A negative scenario drift multiplier means "downward for everyone";
        // it must not turn a falling stock into a rising one.
        const effectiveDriftBps = sc.drift_multiplier >= 0
            ? model.driftBps * sc.drift_multiplier
            : -Math.abs(model.driftBps) * Math.abs(sc.drift_multiplier);
        // tanh keeps the long-run drift bounded for very long simulations.
        const trend = Math.tanh((effectiveDriftBps / 10000) * days);
        const cycles =
            0.050 * volK * Math.sin(TWO_PI * (days / 97) + model.phase) +
            0.022 * volK * Math.sin(TWO_PI * (days / 23) + model.phase * 1.7 + 0.9) +
            0.006 * volK * Math.sin(TWO_PI * days + model.phase * 2.3);
        const hourly = latticeNoise(seed, model.key, 1, tick / 720) * 0.004 * volK;
        const daily = latticeNoise(seed, model.key, 2, tick / ticksPerDay) * 0.012 * volK;
        // Bounded per-tick noise: consecutive ticks differ by at most 2 * amplitude (<= 24 bps).
        const tickAmp = Math.min(0.0005 * volK, 0.0012);
        const tickNoise = (hash01(seed, model.key, 0, tick) * 2 - 1) * tickAmp;
        let shock = 0;
        if (sc.shock_tick_index !== null && sc.shock_tick_index !== undefined && sc.shock_bps) {
            shock = Math.log(1 + sc.shock_bps / 10000) * smoothstep((tick - sc.shock_tick_index) / ticksPerDay);
        }
        return trend + cycles + hourly + daily + tickNoise + shock;
    }

    function scenario(id) {
        const sc = scenarioById.get(id || activeScenarioId);
        if (!sc) {
            throw new Error(`Unknown simulation scenario "${id}"`);
        }
        return sc;
    }

    function assertTick(tick) {
        if (!Number.isInteger(tick) || tick < 0) {
            throw new RangeError(`Invalid tick index: ${tick}`);
        }
    }

    const api = {
        epochMs,
        tickDurationMs: tickMs,
        simulationSpeed: speed,
        ticksPerDay,
        scenarioId: activeScenarioId,

        getScenario(id) {
            return scenario(id);
        },

        /** Current tick from the (injectable) server clock. */
        currentTick() {
            const elapsed = clock.nowMs() - epochMs;
            return Math.max(0, Math.floor((elapsed * speed) / tickMs));
        },

        /** Simulated timestamp (epoch ms) at which a tick starts. */
        tickTimestampMs(tick) {
            assertTick(tick);
            return epochMs + tick * tickMs;
        },

        /** Latest tick starting at or before a simulated timestamp. */
        tickAtOrBefore(ms) {
            return Math.floor((ms - epochMs) / tickMs);
        },

        /** First tick starting at or after a simulated timestamp (min 0). */
        tickAtOrAfter(ms) {
            return Math.max(0, Math.ceil((ms - epochMs) / tickMs));
        },

        /** One coherent market snapshot. Every price in a response derives from it. */
        snapshot(tick) {
            const current = api.currentTick();
            const tickIndex = tick === undefined ? current : tick;
            assertTick(tickIndex);
            const asOfMs = api.tickTimestampMs(tickIndex);
            return {
                tickIndex,
                asOfMs,
                asOf: new Date(asOfMs).toISOString(),
                isCurrent: tickIndex === current,
                // Real wall-clock time at which the next tick begins.
                nextTickAt: new Date(epochMs + ((tickIndex + 1) * tickMs) / speed).toISOString(),
                simulationMode: 'DEMO',
                scenarioId: activeScenarioId
            };
        },

        /** Simulated price in integer cents. */
        priceCents(companyId, tick, scenarioIdOverride) {
            assertTick(tick);
            const model = companyModels.get(companyId);
            if (!model) {
                throw new RangeError(`Unknown company ${companyId}`);
            }
            const value = Math.round(model.base * Math.exp(logFactor(model, tick, scenario(scenarioIdOverride))));
            return Math.max(floorCents, value);
        },

        /** Benchmark index level (2 decimals) at a tick. */
        benchmarkLevel(benchmarkId, tick, scenarioIdOverride) {
            assertTick(tick);
            const model = benchmarkModels.get(benchmarkId);
            if (!model) {
                throw new RangeError(`Unknown benchmark ${benchmarkId}`);
            }
            return Math.round(model.base * Math.exp(logFactor(model, tick, scenario(scenarioIdOverride))) * 100) / 100;
        },

        /**
         * Reference tick for "daily" change: the start of the current UTC day
         * (the first tick at or after 00:00 UTC). On the first tick of a day the
         * previous UTC day's start is used so the change is never trivially zero.
         */
        previousCloseTick(tick) {
            const ms = api.tickTimestampMs(tick);
            const dayStart = Math.floor(ms / DAY_MS) * DAY_MS;
            let ref = api.tickAtOrAfter(dayStart);
            if (ref >= tick) {
                ref = api.tickAtOrAfter(dayStart - DAY_MS);
            }
            return Math.min(ref, tick);
        },

        /** Simulated length of a chart range in days (null for ALL). */
        rangeDays(range) {
            if (range === 'ALL') {
                return null;
            }
            const days = RANGE_DAYS[range];
            if (!days) {
                throw badRequest('INVALID_RANGE', `Unsupported range "${range}".`);
            }
            return days;
        },

        /**
         * Evenly spaced ticks ending EXACTLY at endTick (so the last chart point
         * equals the current value) and never before startTick.
         */
        sampleTicks(startTick, endTick, maxPoints) {
            if (endTick <= startTick) {
                return [endTick];
            }
            const span = endTick - startTick;
            if (span + 1 <= maxPoints) {
                return Array.from({ length: span + 1 }, (_, i) => startTick + i);
            }
            const step = Math.ceil(span / (maxPoints - 1));
            const ticks = [];
            for (let t = endTick; t >= startTick; t -= step) {
                ticks.push(t);
            }
            return ticks.reverse();
        },

        benchmarkIds() {
            return Array.from(benchmarkModels.keys());
        }
    };
    return api;
}

module.exports = { createMarketSimulator, RANGE_DAYS };

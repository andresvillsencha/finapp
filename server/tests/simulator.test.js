'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFixtures } = require('../src/repositories/fixtureRepository');
const { createMarketSimulator } = require('../src/services/marketSimulator');
const { fixedClock } = require('../src/utils/clock');
const { DEFAULT_FIXTURES_DIR } = require('../src/config');
const { FROZEN_NOW } = require('./helpers');

const fx = loadFixtures(DEFAULT_FIXTURES_DIR);
const makeSim = (clock = fixedClock(FROZEN_NOW), scenarioId) => createMarketSimulator({
    marketConfig: fx.marketConfig, scenarios: fx.scenarios, benchmarks: fx.benchmarks, clock, scenarioId
});
const IDS = fx.companies.map((c) => c.id);

test('same company and tick give the same price across calls and fresh instances (restart)', () => {
    const a = makeSim();
    const b = makeSim();
    for (const id of IDS) {
        for (const tick of [0, 1, 17280, 2617920, 11776320]) {
            const p = a.priceCents(id, tick);
            assert.equal(a.priceCents(id, tick), p);
            assert.equal(b.priceCents(id, tick), p);
        }
    }
});

test('price does not depend on the clock or on call order', () => {
    const early = makeSim(fixedClock(FROZEN_NOW));
    const late = makeSim(fixedClock(FROZEN_NOW + 86_400_000 * 400));
    const forward = IDS.map((id) => early.priceCents(id, 5_000_000));
    const backward = IDS.slice().reverse().map((id) => late.priceCents(id, 5_000_000)).reverse();
    assert.deepEqual(forward, backward);
});

test('prices change as ticks advance', () => {
    const sim = makeSim();
    const changed = IDS.filter((id) => sim.priceCents(id, 1_000_000) !== sim.priceCents(id, 1_000_001));
    assert.ok(changed.length > IDS.length / 2, 'most instruments move from one tick to the next');
});

test('frozen clock: tick index follows the injected clock', () => {
    const clock = fixedClock(FROZEN_NOW);
    const sim = makeSim(clock);
    const tick = sim.currentTick();
    assert.equal(tick, Math.floor((FROZEN_NOW - sim.epochMs) / 5000));
    clock.advance(4_000);
    assert.equal(sim.currentTick(), tick, 'less than one tick duration later: same tick');
    clock.advance(1_000);
    assert.equal(sim.currentTick(), tick + 1, 'one tick duration later: next tick');
    clock.advance(10_000);
    assert.equal(sim.currentTick(), tick + 3, 'two more ticks');
    const snap = sim.snapshot();
    assert.equal(snap.tickIndex, tick + 3);
    assert.equal(snap.simulationMode, 'DEMO');
    assert.equal(snap.asOf, new Date(sim.tickTimestampMs(tick + 3)).toISOString());
    assert.equal(Date.parse(snap.nextTickAt) - snap.asOfMs, 5000);
});

test('prices are finite, positive and respect the floor, even far in the future', () => {
    const sim = makeSim();
    const floor = fx.marketConfig.simulation.price_floor_cents;
    for (const scenario of fx.scenarios) {
        for (const id of IDS) {
            for (const tick of [0, 12345, 1_000_000, 11_776_320, 60_000_000, 500_000_000]) {
                const p = sim.priceCents(id, tick, scenario.id);
                assert.ok(Number.isInteger(p) && p >= floor, `${id} ${scenario.id} ${tick} -> ${p}`);
            }
        }
    }
});

test('per-tick moves stay within the 30 bps contract for every scenario', () => {
    const sim = makeSim();
    for (const scenario of fx.scenarios) {
        for (const id of IDS.filter((_, i) => i % 7 === 0)) {
            let prev = sim.priceCents(id, 49_000, scenario.id);
            for (let t = 49_001; t < 51_500; t += 1) { // spans the correction/recovery shock tick (50000)
                const p = sim.priceCents(id, t, scenario.id);
                const move = Math.abs(p - prev) / prev;
                assert.ok(move <= 0.0031 + 0.01 / prev, `${id} ${scenario.id} tick ${t}: ${(move * 10000).toFixed(1)} bps`);
                prev = p;
            }
        }
    }
});

test('instruments and sectors have distinct volatility', () => {
    const sim = makeSim();
    const bySector = new Map();
    for (const i of fx.marketConfig.instruments) {
        const sector = fx.companiesById.get(i.company_id).sector;
        const list = bySector.get(sector) || [];
        list.push(i.volatility_multiplier);
        bySector.set(sector, list);
    }
    const sectorMeans = [...bySector.values()].map((v) => v.reduce((a, b) => a + b, 0) / v.length);
    assert.ok(new Set(sectorMeans).size >= 5, 'sector mean volatility multipliers are distinct');

    // Realized hourly volatility over 120 simulated days is higher for the high-vol instrument.
    const hi = fx.marketConfig.instruments.reduce((a, b) => (b.volatility_multiplier > a.volatility_multiplier ? b : a));
    const lo = fx.marketConfig.instruments.reduce((a, b) => (b.volatility_multiplier < a.volatility_multiplier ? b : a));
    const sd = (id) => {
        const returns = [];
        let prev = sim.priceCents(id, 1_000_000);
        for (let t = 1_000_720; t < 1_000_000 + 17_280 * 120; t += 720) {
            const p = sim.priceCents(id, t);
            returns.push(Math.log(p / prev));
            prev = p;
        }
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        return Math.sqrt(returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length);
    };
    assert.ok(sd(hi.company_id) > sd(lo.company_id), `${hi.symbol} should be more volatile than ${lo.symbol}`);
});

test('some tickers trend up while others trend down', () => {
    const sim = makeSim();
    const tick = 8_000_000;
    const ratios = fx.marketConfig.instruments.map((i) => sim.priceCents(i.company_id, tick) / i.base_price_cents);
    assert.ok(ratios.some((r) => r > 1.05), 'some prices are well above base');
    assert.ok(ratios.some((r) => r < 0.95), 'some prices are well below base');
});

test('scenarios change prices deterministically (bull vs bear)', () => {
    const sim = makeSim();
    const tick = 6_000_000;
    const meanLog = (scenario) => IDS.reduce((s, id) => s + Math.log(sim.priceCents(id, tick, scenario) / fx.marketConfig.instruments.find((i) => i.company_id === id).base_price_cents), 0) / IDS.length;
    assert.ok(meanLog('bull') > meanLog('normal'));
    assert.ok(meanLog('bear') < meanLog('normal'));
    assert.equal(sim.priceCents(1, tick, 'bull'), sim.priceCents(1, tick, 'bull'));
});

test('the active scenario comes from configuration and can be overridden', () => {
    assert.equal(makeSim().scenarioId, fx.marketConfig.simulation.default_scenario_id);
    assert.equal(makeSim(undefined, 'bear').scenarioId, 'bear');
    assert.throws(() => makeSim(undefined, 'nope'), /Unknown simulation scenario/);
});

test('benchmark series are deterministic and positive', () => {
    const a = makeSim();
    const b = makeSim();
    for (const id of a.benchmarkIds()) {
        for (const tick of [0, 100, 5_000_000, 11_776_320]) {
            const level = a.benchmarkLevel(id, tick);
            assert.equal(level, b.benchmarkLevel(id, tick));
            assert.ok(level > 0);
        }
    }
});

test('daily reference tick is the start of the current UTC day', () => {
    const sim = makeSim();
    const tickAt = (iso) => sim.tickAtOrBefore(Date.parse(iso));
    const noon = tickAt('2026-11-13T12:00:00Z');
    assert.equal(sim.previousCloseTick(noon), tickAt('2026-11-13T00:00:00Z'));
    const midnight = tickAt('2026-11-13T00:00:00Z');
    assert.equal(sim.previousCloseTick(midnight), tickAt('2026-11-12T00:00:00Z'), 'first tick of a day uses the previous day start');
    assert.equal(sim.previousCloseTick(0), 0);
});

test('sampleTicks ends exactly at the end tick and stays within range', () => {
    const sim = makeSim();
    const ticks = sim.sampleTicks(1_000, 1_000_000, 120);
    assert.equal(ticks[ticks.length - 1], 1_000_000);
    assert.ok(ticks.length <= 120);
    assert.ok(ticks[0] >= 1_000);
    for (let i = 1; i < ticks.length; i += 1) {
        assert.ok(ticks[i] > ticks[i - 1]);
    }
    assert.deepEqual(sim.sampleTicks(5, 5, 120), [5]);
    assert.deepEqual(sim.sampleTicks(5, 8, 120), [5, 6, 7, 8]);
});

test('invalid ticks and unknown companies are rejected', () => {
    const sim = makeSim();
    assert.throws(() => sim.priceCents(1, -1), RangeError);
    assert.throws(() => sim.priceCents(1, 1.5), RangeError);
    assert.throws(() => sim.priceCents(99999, 1), RangeError);
});

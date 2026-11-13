'use strict';

/**
 * Snapshot resolution and simulation status. Every read endpoint resolves ONE
 * snapshot per request; an optional ?tick= or ?asOf= lets several requests of
 * one screen refresh reuse the same tick so their numbers reconcile.
 */
const { badRequest } = require('../utils/errors');

/** Resolve the request's market snapshot (latest tick unless tick/asOf given). */
function resolveSnapshot(ctx, query = {}) {
    const { simulator } = ctx;
    const hasTick = query.tick !== undefined && query.tick !== '';
    const hasAsOf = query.asOf !== undefined && query.asOf !== '';
    if (hasTick && hasAsOf) {
        throw badRequest('INVALID_SNAPSHOT', 'Use either "tick" or "asOf", not both.');
    }
    const current = simulator.currentTick();
    if (hasTick) {
        if (typeof query.tick !== 'string' || !/^\d+$/.test(query.tick)) {
            throw badRequest('INVALID_TICK', 'Parameter "tick" must be a non-negative integer.');
        }
        const tick = Number(query.tick);
        if (!Number.isSafeInteger(tick) || tick > current) {
            throw badRequest('TICK_OUT_OF_RANGE', `Parameter "tick" must be between 0 and the current tick (${current}).`);
        }
        return simulator.snapshot(tick);
    }
    if (hasAsOf) {
        const ms = typeof query.asOf === 'string' ? Date.parse(query.asOf) : NaN;
        if (!Number.isFinite(ms)) {
            throw badRequest('INVALID_AS_OF', 'Parameter "asOf" must be an ISO-8601 timestamp.');
        }
        const tick = simulator.tickAtOrBefore(ms);
        if (tick < 0 || tick > current) {
            throw badRequest('AS_OF_OUT_OF_RANGE', 'Parameter "asOf" must not precede the simulation epoch or be in the future.');
        }
        return simulator.snapshot(tick);
    }
    return simulator.snapshot();
}

/** The meta block returned with every simulated-financial response. */
function snapshotMeta(snapshot, extra = {}) {
    const meta = {
        asOf: snapshot.asOf,
        tickIndex: snapshot.tickIndex,
        simulationMode: snapshot.simulationMode,
        scenarioId: snapshot.scenarioId
    };
    if (snapshot.isCurrent) {
        meta.nextTickAt = snapshot.nextTickAt;
    }
    return { ...meta, ...extra };
}

function simulationStatus(ctx) {
    const { simulator, settings, clock } = ctx;
    const snapshot = simulator.snapshot();
    const scenario = simulator.getScenario();
    return {
        snapshot,
        data: {
            simulation_mode: 'DEMO',
            clock: 'SERVER_UTC',
            scenario_id: scenario.id,
            scenario_name: scenario.name,
            tick_index: snapshot.tickIndex,
            as_of: snapshot.asOf,
            next_tick_at: snapshot.nextTickAt,
            tick_duration_ms: simulator.tickDurationMs,
            simulation_speed: simulator.simulationSpeed,
            epoch_utc: new Date(simulator.epochMs).toISOString(),
            refresh_interval_ms: settings.refresh_interval_ms,
            server_time: new Date(clock.nowMs()).toISOString(),
            disclaimer: settings.disclaimer
        }
    };
}

module.exports = { resolveSnapshot, snapshotMeta, simulationStatus };

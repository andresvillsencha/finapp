'use strict';

const { sendCollection, sendRecord } = require('../utils/apiResponse');
const { resolveSnapshot, snapshotMeta, simulationStatus } = require('../services/simulationService');
const companies = require('../services/companyService');

module.exports = (ctx) => ({
    /** Reports JSON fixture and simulator readiness only. */
    health(req, res) {
        const snapshot = ctx.simulator.snapshot();
        const { fixtures } = ctx;
        return sendRecord(res, {
            status: 'ok',
            ready: true,
            service: 'portfolioiq-api',
            storage: 'JSON files (fixtures + runtime journal)',
            uptime_seconds: Math.round(process.uptime()),
            fixtures: {
                companies: fixtures.companies.length,
                portfolios: fixtures.portfolios.length,
                baseline_transactions: fixtures.transactions.length,
                scenarios: fixtures.scenarios.length,
                benchmarks: fixtures.benchmarks.length
            },
            runtime: { transactions: ctx.journal.transactions.length },
            simulator: { ready: true, tick_index: snapshot.tickIndex, scenario_id: snapshot.scenarioId },
            warnings: ctx.warnings
        }, snapshotMeta(snapshot));
    },

    simulationStatus(req, res) {
        const { snapshot, data } = simulationStatus(ctx);
        return sendRecord(res, data, snapshotMeta(snapshot));
    },

    listCompanies(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const { data, total, paging } = companies.listCompanies(ctx, snapshot, req.query);
        return sendCollection(res, data, total, snapshotMeta(snapshot, { start: paging.offset, limit: paging.limit }));
    },

    companyPrices(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const { rows, meta } = companies.companyPrices(ctx, snapshot, req.params.id, req.query);
        return sendCollection(res, rows, rows.length, snapshotMeta(snapshot, meta));
    }
});

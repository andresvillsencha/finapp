'use strict';

const { sendCollection, sendRecord } = require('../utils/apiResponse');
const { resolveSnapshot, snapshotMeta } = require('../services/simulationService');
const portfolios = require('../services/portfolioService');

module.exports = (ctx) => ({
    list(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const rows = portfolios.listPortfolios(ctx, snapshot);
        return sendCollection(res, rows, rows.length, snapshotMeta(snapshot));
    },

    get(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        return sendRecord(res, portfolios.getPortfolio(ctx, snapshot, req.params.id), snapshotMeta(snapshot));
    },

    dashboard(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const { data, range } = portfolios.getDashboard(ctx, snapshot, req.query);
        return sendRecord(res, data, snapshotMeta(snapshot, { range }));
    },

    history(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const { rows, meta } = portfolios.getHistory(ctx, snapshot, req.query);
        return sendCollection(res, rows, rows.length, snapshotMeta(snapshot, meta));
    },

    sectorAllocation(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const { rows, meta } = portfolios.getSectorAllocation(ctx, snapshot, req.query);
        return sendCollection(res, rows, rows.length, snapshotMeta(snapshot, meta));
    }
});

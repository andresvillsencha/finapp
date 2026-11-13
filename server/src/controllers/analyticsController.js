'use strict';

const { sendCollection } = require('../utils/apiResponse');
const { resolveSnapshot, snapshotMeta } = require('../services/simulationService');
const analytics = require('../services/analyticsService');

module.exports = (ctx) => ({
    pivot(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const { rows, scope } = analytics.pivotRows(ctx, snapshot, req.query);
        return sendCollection(res, rows, rows.length, snapshotMeta(snapshot, { portfolioId: scope.id }));
    },

    comparison(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const { rows, meta } = analytics.comparison(ctx, snapshot, req.query);
        return sendCollection(res, rows, rows.length, snapshotMeta(snapshot, meta));
    },

    sectorComparison(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const { rows, meta } = analytics.sectorComparison(ctx, snapshot);
        return sendCollection(res, rows, rows.length, snapshotMeta(snapshot, meta));
    }
});

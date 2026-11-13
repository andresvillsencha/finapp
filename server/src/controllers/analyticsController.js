'use strict';

const { sendCollection } = require('../utils/apiResponse');
const { resolveSnapshot, snapshotMeta } = require('../services/simulationService');
const analytics = require('../services/analyticsService');

module.exports = (ctx) => ({
    pivot(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        if (analytics.resolveLayout(req.query.layout) === 'wide') {
            const wide = analytics.pivotWide(ctx, snapshot, req.query);
            return sendCollection(res, wide.rows, wide.rows.length, snapshotMeta(snapshot, wide.meta));
        }
        const { rows, scope } = analytics.pivotRows(ctx, snapshot, req.query);
        return sendCollection(res, rows, rows.length, snapshotMeta(snapshot, { portfolioId: scope.id }));
    },

    /** CSV fallback for the pivot (the Exporter package is not installed). */
    exportPivotCsv(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const csv = analytics.pivotCsv(ctx, snapshot, req.query);
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="pivot.csv"',
            'X-Simulation-As-Of': snapshot.asOf,
            'X-Simulation-Tick-Index': String(snapshot.tickIndex)
        });
        return res.status(200).send(csv);
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

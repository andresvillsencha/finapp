'use strict';

const { sendCollection } = require('../utils/apiResponse');
const { resolveSnapshot, snapshotMeta } = require('../services/simulationService');
const holdings = require('../services/holdingsService');

module.exports = (ctx) => ({
    list(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const { data, total, paging, scope, summary } = holdings.queryHoldings(ctx, snapshot, req.query);
        return sendCollection(res, data, total, snapshotMeta(snapshot, {
            portfolioId: scope.id,
            start: paging.offset,
            limit: paging.limit,
            allocationBasis: 'EQUITY_MARKET_VALUE_EXCLUDING_CASH',
            // Totals over every row matching the filters (not only this page), so the
            // browser never has to add up values itself.
            totals: summary.totals,
            groups: summary.groups
        }));
    },

    /** CSV fallback export; honors the same portfolio / filter / sort parameters. */
    exportCsv(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const csv = holdings.exportHoldingsCsv(ctx, snapshot, req.query);
        res.set({
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="holdings.csv"',
            'X-Simulation-As-Of': snapshot.asOf,
            'X-Simulation-Tick-Index': String(snapshot.tickIndex)
        });
        return res.status(200).send(csv);
    }
});

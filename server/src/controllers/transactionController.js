'use strict';

const { sendCollection, sendRecord } = require('../utils/apiResponse');
const { resolveSnapshot, snapshotMeta } = require('../services/simulationService');
const transactions = require('../services/transactionService');

module.exports = (ctx) => ({
    list(req, res) {
        const snapshot = resolveSnapshot(ctx, req.query);
        const { data, total, paging, scope } = transactions.listTransactions(ctx, req.query);
        return sendCollection(res, data, total, snapshotMeta(snapshot, {
            portfolioId: scope.id,
            start: paging.offset,
            limit: paging.limit
        }));
    },

    async create(req, res) {
        const { snapshot, data } = await transactions.executeTrade(ctx, req.body);
        return sendRecord(res, data, snapshotMeta(snapshot), { status: 201, message: 'Simulated trade executed' });
    }
});

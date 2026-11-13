/**
 * Transaction history (GET /api/transactions) with remote paging, sorting and filtering.
 * The newest execution comes first. The view sets portfolioId, tick and `filter` (JSON)
 * as extra params.
 */
Ext.define('FinApp.store.Transactions', {
    extend: 'Ext.data.Store',
    alias: 'store.transactions',

    requires: [
        'FinApp.model.Transaction',
        'FinApp.proxy.Api'
    ],

    model: 'FinApp.model.Transaction',

    pageSize: 15,
    remoteSort: true,
    remoteFilter: true,

    sorters: [{
        property: 'executed_at',
        direction: 'DESC'
    }],

    proxy: {
        type: 'piq',
        endpoint: '/transactions'
    }
});

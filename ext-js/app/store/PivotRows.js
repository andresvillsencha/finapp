/**
 * Source rows of the pivot grid: one row per position (company held by a portfolio), from
 * GET /api/analytics/pivot (flat layout). Unpaged: the pivot's local matrix groups, sums and
 * sorts them. The Analytics screen sets portfolioId and tick as extra params.
 */
Ext.define('FinApp.store.PivotRows', {
    extend: 'Ext.data.Store',
    alias: 'store.pivot-rows',

    requires: [
        'FinApp.model.PivotRow',
        'FinApp.proxy.Api'
    ],

    model: 'FinApp.model.PivotRow',
    pageSize: 0,

    proxy: {
        type: 'piq',
        endpoint: '/analytics/pivot'
    }
});

/**
 * Wide pivot rows (Sector -> Company, one column per portfolio and measure). The server
 * returns every row (no paging) already ordered by sector and company, together with the
 * sector subtotals and the grand total in `meta`. The grid groups by sector locally. The
 * Analytics screen sets portfolioId, layout and tick as extra params.
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

    // Server order is kept inside each group; only the grouping is applied locally.
    grouper: {
        property: 'sector'
    },

    proxy: {
        type: 'piq',
        endpoint: '/analytics/pivot',
        extraParams: {
            layout: 'wide'
        }
    }
});

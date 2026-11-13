/**
 * The demo portfolios (GET /api/portfolios). Small and unpaged: the API returns
 * every portfolio, so no remote sorting, filtering or paging is configured.
 */
Ext.define('FinApp.store.Portfolios', {
    extend: 'Ext.data.Store',
    alias: 'store.portfolios',

    requires: [
        'FinApp.model.Portfolio',
        'FinApp.proxy.Api'
    ],

    model: 'FinApp.model.Portfolio',
    pageSize: 0,

    proxy: {
        type: 'piq',
        endpoint: '/portfolios'
    }
});

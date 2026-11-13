/**
 * Portfolio value time series for the Dashboard chart. The API returns the whole
 * series (sampled from the same deterministic price function as spot prices), so
 * paging is off. The Dashboard sets portfolioId / range / tick as extra params.
 */
Ext.define('FinApp.store.PortfolioHistory', {
    extend: 'Ext.data.Store',
    alias: 'store.portfolio-history',

    requires: [
        'FinApp.model.HistoryPoint',
        'FinApp.proxy.Api'
    ],

    model: 'FinApp.model.HistoryPoint',
    pageSize: 0,

    proxy: {
        type: 'piq',
        endpoint: '/portfolio-history'
    }
});

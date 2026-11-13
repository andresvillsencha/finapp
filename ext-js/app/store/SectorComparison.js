/**
 * Equity exposure by sector for every portfolio (GET /api/analytics/sector-comparison).
 * One record per sector; unpaged.
 */
Ext.define('FinApp.store.SectorComparison', {
    extend: 'Ext.data.Store',
    alias: 'store.sector-comparison',

    requires: [
        'FinApp.model.SectorExposure',
        'FinApp.proxy.Api'
    ],

    model: 'FinApp.model.SectorExposure',
    pageSize: 0,

    proxy: {
        type: 'piq',
        endpoint: '/analytics/sector-comparison'
    }
});

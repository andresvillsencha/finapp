/**
 * Sector allocation for the Dashboard donut chart (unpaged). The Dashboard sets
 * portfolioId / tick as extra params.
 */
Ext.define('FinApp.store.SectorAllocation', {
    extend: 'Ext.data.Store',
    alias: 'store.sector-allocation',

    requires: [
        'FinApp.model.SectorAllocation',
        'FinApp.proxy.Api'
    ],

    model: 'FinApp.model.SectorAllocation',
    pageSize: 0,

    proxy: {
        type: 'piq',
        endpoint: '/sector-allocation'
    }
});

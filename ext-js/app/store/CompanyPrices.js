/**
 * Simulated price series of one company. The series is sampled from the same
 * deterministic price function as spot prices and trades. The detail panel points the
 * proxy at /companies/:id/prices before each load, so it is unpaged.
 */
Ext.define('FinApp.store.CompanyPrices', {
    extend: 'Ext.data.Store',
    alias: 'store.company-prices',

    requires: [
        'FinApp.model.PricePoint',
        'FinApp.proxy.Api'
    ],

    model: 'FinApp.model.PricePoint',
    pageSize: 0,

    proxy: {
        type: 'piq',
        endpoint: '/companies'
    }
});

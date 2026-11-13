/**
 * Normalized performance comparison: every portfolio and the simulated benchmarks, start of
 * the range = 100. The API returns the whole series (sampled from the same deterministic
 * price function as everything else), so paging is off. The Analytics screen sets range and
 * tick as extra params.
 */
Ext.define('FinApp.store.Comparison', {
    extend: 'Ext.data.Store',
    alias: 'store.comparison',

    requires: [
        'FinApp.model.ComparisonPoint',
        'FinApp.proxy.Api'
    ],

    model: 'FinApp.model.ComparisonPoint',
    pageSize: 0,

    proxy: {
        type: 'piq',
        endpoint: '/analytics/comparison'
    }
});

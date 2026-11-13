/**
 * One sector of the portfolio comparison (GET /api/analytics/sector-comparison). Besides
 * `sector` and `total` the server sends `portfolio_<id>` (equity market value) and
 * `portfolio_<id>_pct` (share of that portfolio's equity, cash excluded); `meta.portfolios`
 * lists the portfolios, so those fields are read by name.
 */
Ext.define('FinApp.model.SectorExposure', {
    extend: 'FinApp.model.Base',

    fields: [
        { name: 'sector', type: 'string' },
        { name: 'total', type: 'number' }
    ]
});

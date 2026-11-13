/**
 * One row of the wide pivot (GET /api/analytics/pivot?layout=wide): a company within a
 * sector. Besides the fields below, the server sends one value per portfolio and measure
 * (`portfolio_<id>_market_value`, `..._cost_basis`, `..._unrealized_pl`, `null` when that
 * portfolio does not hold the company) and `total_<measure>`. Those columns depend on the
 * selected portfolios, so they are not declared: the grid reads them by name from the record.
 */
Ext.define('FinApp.model.PivotRow', {
    extend: 'FinApp.model.Base',

    fields: [
        { name: 'id', type: 'string' },
        { name: 'sector', type: 'string' },
        { name: 'company_id', type: 'int' },
        { name: 'symbol', type: 'string' },
        { name: 'company', type: 'string' }
    ]
});

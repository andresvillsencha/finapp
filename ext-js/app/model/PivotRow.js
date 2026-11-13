/**
 * One position as a pivot source row (GET /api/analytics/pivot, flat layout): a company held
 * by a portfolio. The pivot grid groups and sums these rows in the browser (Sector → Company
 * by Portfolio); the money values are the server's, in dollars.
 */
Ext.define('FinApp.model.PivotRow', {
    extend: 'FinApp.model.Base',

    fields: [
        { name: 'id', type: 'string' },
        { name: 'sector', type: 'string' },
        { name: 'company_id', type: 'int' },
        { name: 'symbol', type: 'string' },
        { name: 'company', type: 'string' },
        { name: 'portfolio_id', type: 'int' },
        { name: 'portfolio_name', type: 'string' },
        { name: 'quantity', type: 'int' },
        { name: 'market_value', type: 'number' },
        { name: 'cost_basis', type: 'number' },
        { name: 'unrealized_pl', type: 'number' }
    ]
});

/**
 * An open position (GET /api/holdings). Every derived value (market value, P/L,
 * allocation, day change) is calculated by the server; the UI only formats them.
 * `id` is "<portfolio_id>:<company_id>".
 */
Ext.define('FinApp.model.Holding', {
    extend: 'FinApp.model.Base',

    fields: [
        { name: 'id', type: 'string' },
        { name: 'portfolio_id', type: 'int' },
        { name: 'portfolio_name', type: 'string' },
        { name: 'company_id', type: 'int' },
        { name: 'symbol', type: 'string' },
        { name: 'company', type: 'string' },
        { name: 'sector', type: 'string' },
        { name: 'industry', type: 'string' },
        { name: 'quantity', type: 'int' },
        { name: 'average_cost', type: 'number' },
        { name: 'current_price', type: 'number' },
        { name: 'previous_price', type: 'number' },
        { name: 'day_change', type: 'number' },
        { name: 'day_change_pct', type: 'number', allowNull: true },
        { name: 'market_value', type: 'number' },
        { name: 'cost_basis', type: 'number' },
        { name: 'unrealized_pl', type: 'number' },
        { name: 'unrealized_pl_pct', type: 'number', allowNull: true },
        { name: 'daily_pl', type: 'number' },
        { name: 'allocation_pct', type: 'number', allowNull: true }
    ]
});

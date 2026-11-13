/**
 * A demo portfolio with headline totals, as returned by GET /api/portfolios.
 * All numbers are calculated by the server; the UI only displays them.
 */
Ext.define('FinApp.model.Portfolio', {
    extend: 'FinApp.model.Base',

    fields: [
        { name: 'id', type: 'int' },
        { name: 'name', type: 'string' },
        { name: 'strategy', type: 'string' },
        { name: 'risk_profile', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'currency', type: 'string' },
        { name: 'created_at', type: 'string' },
        { name: 'portfolio_value', type: 'number' },
        { name: 'cash_balance', type: 'number' },
        { name: 'market_value', type: 'number' },
        { name: 'total_gain_loss', type: 'number' },
        { name: 'total_gain_loss_pct', type: 'number', allowNull: true },
        { name: 'daily_change', type: 'number' },
        { name: 'daily_change_pct', type: 'number', allowNull: true }
    ]
});

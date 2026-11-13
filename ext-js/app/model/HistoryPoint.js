/**
 * One sampled point of the portfolio value history (GET /api/portfolio-history).
 * `ts` is the sample's simulated time in epoch milliseconds (UTC), used by the
 * chart's time axis. All money values are numbers calculated by the server.
 */
Ext.define('FinApp.model.HistoryPoint', {
    extend: 'FinApp.model.Base',

    fields: [
        {
            name: 'ts',
            type: 'number',
            mapping: 'timestamp',
            convert: function (value) {
                return Date.parse(value);
            }
        },
        { name: 'timestamp', type: 'string' },
        { name: 'tick_index', type: 'int' },
        { name: 'portfolio_value', type: 'number' },
        { name: 'cash_balance', type: 'number' },
        { name: 'market_value', type: 'number' },
        { name: 'investment_pl', type: 'number' },
        { name: 'investment_pl_pct', type: 'number', allowNull: true }
    ]
});

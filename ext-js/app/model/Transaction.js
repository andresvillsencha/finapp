/**
 * An immutable executed trade (GET /api/transactions). The execution price and time
 * are always those chosen by the server.
 */
Ext.define('FinApp.model.Transaction', {
    extend: 'FinApp.model.Base',

    fields: [
        { name: 'id', type: 'string' },
        { name: 'seq', type: 'int' },
        { name: 'portfolio_id', type: 'int' },
        { name: 'portfolio_name', type: 'string' },
        { name: 'company_id', type: 'int' },
        { name: 'symbol', type: 'string' },
        { name: 'company', type: 'string' },
        { name: 'trade_type', type: 'string' },
        { name: 'quantity', type: 'int' },
        { name: 'execution_price', type: 'number' },
        { name: 'amount', type: 'number' },
        { name: 'fee', type: 'number' },
        { name: 'realized_pl', type: 'number', allowNull: true },
        { name: 'executed_at', type: 'string' },
        { name: 'tick_index', type: 'int', allowNull: true },
        { name: 'source', type: 'string' },
        { name: 'notes', type: 'string', allowNull: true }
    ]
});

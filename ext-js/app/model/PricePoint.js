/**
 * One sampled point of a company's simulated price series
 * (GET /api/companies/:id/prices). `ts` is the simulated time in epoch milliseconds (UTC).
 */
Ext.define('FinApp.model.PricePoint', {
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
        { name: 'price', type: 'number' }
    ]
});

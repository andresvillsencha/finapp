/**
 * One sampled tick of the normalized comparison (GET /api/analytics/comparison). `ts` is the
 * simulated time in epoch milliseconds (UTC). The series values (`portfolio_<id>` and
 * `benchmark_<id>`, start of the range = 100) are not declared: which series exist is
 * described by `meta.series`, so the chart reads them by name from the record.
 */
Ext.define('FinApp.model.ComparisonPoint', {
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
        { name: 'tick_index', type: 'int' }
    ]
});

/**
 * FinApp.util.PivotAggregators
 *
 * Adds one aggregate function to the Ext JS pivot grid (Ext.pivot.Aggregators):
 *
 *   piqSum  sum of a money field in exact integer cents.
 *
 * The pivot grid adds the server's money values up in the browser (that is what a pivot
 * does). Adding dollar floats directly can drift by a fraction of a cent; summing whole
 * cents and dividing once keeps every cell, subtotal and grand total cent-exact, the same
 * policy the backend uses. `piqSumText` is the label the pivot configurator shows.
 *
 * ES5 on purpose (production compressor).
 */
Ext.define('FinApp.util.PivotAggregators', {
    singleton: true,

    requires: [
        'Ext.pivot.Aggregators'
    ],

    constructor: function () {
        var aggregators = Ext.pivot.Aggregators;

        aggregators.piqSumText = 'Sum';
        aggregators.piqSum = function (records, measure) {
            var cents = 0,
                found = false,
                i, value;

            for (i = 0; i < records.length; i++) {
                value = records[i].get(measure);

                if (Ext.isNumber(value)) {
                    cents += Math.round(value * 100);
                    found = true;
                }
            }

            // No values at all: null, so the cell is shown as empty.
            return found ? cents / 100 : null;
        };

        this.callParent(arguments);
    }
});

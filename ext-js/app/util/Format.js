/**
 * FinApp.util.Format
 *
 * Display formatting only. The UI never calculates financial values; it formats
 * the numbers supplied by the API. Positive/negative values are always signalled
 * by a sign and an arrow as well as colour, so colour is never the only cue.
 *
 * ES5 on purpose (production compressor).
 */
Ext.define('FinApp.util.Format', {
    singleton: true,

    requires: [
        'Ext.util.Format'
    ],

    EMPTY: '—',

    /** 1234.5 -> "$1,234.50", -3 -> "-$3.00" */
    usd: function (value) {
        return Ext.isNumber(value) ? Ext.util.Format.currency(value, '$', 2) : this.EMPTY;
    },

    /** 1234.5 -> "+$1,234.50", -3 -> "-$3.00" */
    signedUsd: function (value) {
        if (!Ext.isNumber(value)) {
            return this.EMPTY;
        }

        return (value > 0 ? '+' : '') + this.usd(value);
    },

    /** 12.3456 -> "12.35%" */
    pct: function (value) {
        return Ext.isNumber(value) ? Ext.util.Format.number(value, '0,000.00') + '%' : this.EMPTY;
    },

    /** 1.5 -> "+1.50%", -0.2 -> "-0.20%" */
    signedPct: function (value) {
        if (!Ext.isNumber(value)) {
            return this.EMPTY;
        }

        return (value > 0 ? '+' : '') + this.pct(value);
    },

    /** Whole numbers with thousands separators: 1234567 -> "1,234,567" */
    integer: function (value) {
        return Ext.isNumber(value) ? Ext.util.Format.number(value, '0,000') : this.EMPTY;
    },

    /** Arrow that accompanies a signed value (never colour alone). */
    arrow: function (value) {
        if (!Ext.isNumber(value) || value === 0) {
            return '';
        }

        return value > 0 ? '▲' : '▼';
    },

    /** CSS class for a gain/loss value: piq-pos, piq-neg or piq-flat. */
    pnlCls: function (value) {
        if (!Ext.isNumber(value) || value === 0) {
            return 'piq-flat';
        }

        return value > 0 ? 'piq-pos' : 'piq-neg';
    },

    /**
     * "2026-11-13T12:00:00.000Z" -> "2026-11-13 12:00:00 UTC". Server timestamps are
     * UTC; this avoids silently shifting them into the browser's local time zone.
     */
    utcDateTime: function (iso) {
        if (!Ext.isString(iso) || !iso) {
            return this.EMPTY;
        }

        return iso.replace('T', ' ').replace(/(\.\d+)?Z$/, ' UTC');
    }
});

/**
 * View model of the Trade Simulator dialog.
 *
 * The dialog never calculates a price, a total or a fee: it shows the indicative quote
 * the server reported for the latest tick, and the server decides the execution price
 * and time when the order is submitted.
 */
Ext.define('FinApp.view.holdings.TradeModel', {
    extend: 'Ext.app.ViewModel',

    alias: 'viewmodel.trade',

    requires: [
        'FinApp.util.Format'
    ],

    data: {
        side: 'BUY',
        portfolioId: null,
        companyId: null,
        quantity: null,

        // Server-reported values for the selected company and portfolio (display only).
        quote: null,
        cash: null,

        loadingCompanies: true,
        submitting: false,
        errorMessage: ''
    },

    formulas: {
        isBuy: function (get) {
            return get('side') === 'BUY';
        },

        /** Whole number of shares, at least 1 (the server re-validates everything). */
        validQuantity: function (get) {
            var q = get('quantity');

            return Ext.isNumber(q) && q >= 1 && Math.floor(q) === q;
        },

        canSubmit: function (get) {
            return !!get('portfolioId') && !!get('companyId') && get('validQuantity') && !get('submitting');
        },

        companyPlaceholder: function (get) {
            return get('loadingCompanies') ? 'Loading companies…' : 'Choose a company';
        },

        executeText: function (get) {
            return get('submitting') ? 'Executing…' : 'Execute simulated ' + get('side');
        },

        executeUi: function (get) {
            return get('side') === 'BUY' ? 'confirm' : 'decline';
        },

        quoteHtml: function (get) {
            var q = get('quote'),
                F = FinApp.util.Format;

            if (!q) {
                return '<span class="piq-muted">Select a company to see the latest simulated price.</span>';
            }

            return 'Indicative price: <b>' + Ext.String.htmlEncode(F.usd(q.current_price)) + '</b> ' +
                '<span class="' + F.pnlCls(q.day_change) + '">' +
                Ext.String.htmlEncode(F.arrow(q.day_change) + ' ' + F.signedPct(q.day_change_pct)) + '</span>';
        },

        cashHtml: function (get) {
            var cash = get('cash');

            return cash === null ?
                '' :
                'Simulated cash available: <b>' + Ext.String.htmlEncode(FinApp.util.Format.usd(cash)) + '</b>';
        },

        errorHtml: function (get) {
            return '<span class="x-fa fa-circle-exclamation"></span> ' + Ext.String.htmlEncode(get('errorMessage'));
        },

        hasError: function (get) {
            return !!get('errorMessage');
        }
    }
});

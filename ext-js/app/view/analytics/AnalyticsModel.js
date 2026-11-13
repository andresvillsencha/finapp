/**
 * View model of Portfolio Analytics.
 *
 * Inherits portfolioId, tickIndex, asOf and activeScreen from the shell. Everything shown
 * comes from the API; the formulas only FORMAT server values.
 *
 *  - state:         'loading' (mask), 'ready', 'error' (banner with Retry, last data stays)
 *  - range:         range of the normalized performance chart
 *  - sectorMode:    'pct' (share of each portfolio's equity) | 'value' (market value)
 *  - benchmarks:    'on' | 'off' (simulated benchmark lines in the performance chart)
 */
Ext.define('FinApp.view.analytics.AnalyticsModel', {
    extend: 'Ext.app.ViewModel',

    alias: 'viewmodel.analytics',

    requires: [
        'FinApp.store.Comparison',
        'FinApp.store.SectorComparison'
    ],

    data: {
        state: 'loading',
        errorMessage: '',

        range: '1Y',
        sectorMode: 'pct',
        benchmarks: 'on',

        rangeNote: '',
        comparisonNote: '',
        pivotCount: 0,

        // Pre-formatted rows for the HTML legends.
        comparisonLegend: [],
        sectorLegend: []
    },

    stores: {
        comparison: {
            type: 'comparison'
        },
        sectors: {
            type: 'sector-comparison'
        }
    },

    formulas: {
        loadMask: function (get) {
            return get('state') === 'loading' ? {
                xtype: 'loadmask',
                message: 'Loading analytics…'
            } : false;
        },

        hasError: function (get) {
            return get('state') === 'error';
        },

        errorHtml: function (get) {
            return '<span class="x-fa fa-triangle-exclamation"></span> Could not refresh the analytics: ' +
                Ext.String.htmlEncode(get('errorMessage'));
        },

        hasPivotRows: function (get) {
            return get('pivotCount') > 0;
        },

        comparisonSubHtml: function (get) {
            return '<div class="piq-card-title">Portfolio Performance Comparison</div>' +
                '<div class="piq-card-sub">Normalized index, start of range = 100 • ' +
                Ext.String.htmlEncode(get('rangeNote')) + '</div>';
        },

        sectorSubHtml: function (get) {
            return '<div class="piq-card-title">Sector Exposure by Portfolio</div>' +
                '<div class="piq-card-sub">' + (get('sectorMode') === 'pct' ?
                    'Share of each portfolio\'s equity (cash excluded)' :
                    'Equity market value (cash excluded)') + '</div>';
        },

        comparisonLegendCard: function (get) {
            return { rows: get('comparisonLegend') };
        },

        sectorLegendCard: function (get) {
            return { rows: get('sectorLegend') };
        }
    }
});

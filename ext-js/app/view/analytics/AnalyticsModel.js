/**
 * View model of Portfolio Analytics.
 *
 * Inherits portfolioId, tickIndex, asOf and activeScreen from the shell. Everything shown
 * comes from the API; the formulas only FORMAT server values.
 *
 *  - state:         'loading' (mask), 'ready', 'error' (banner with Retry, last data stays)
 *  - range:         range of the normalized performance chart
 *  - measure:       market_value | cost_basis | unrealized_pl (shown in the pivot columns)
 *  - sectorMode:    'pct' (share of each portfolio's equity) | 'value' (market value)
 *  - benchmarks:    'on' | 'off' (simulated benchmark lines in the performance chart)
 */
Ext.define('FinApp.view.analytics.AnalyticsModel', {
    extend: 'Ext.app.ViewModel',

    alias: 'viewmodel.analytics',

    requires: [
        'FinApp.store.PivotRows',
        'FinApp.store.Comparison',
        'FinApp.store.SectorComparison'
    ],

    data: {
        state: 'loading',
        errorMessage: '',

        range: '1Y',
        measure: 'market_value',
        sectorMode: 'pct',
        benchmarks: 'on',

        rangeNote: '',
        comparisonNote: '',
        pivotCount: 0,

        // Pre-formatted rows for the HTML legends and the grand total strip.
        comparisonLegend: [],
        sectorLegend: [],
        grandRows: []
    },

    stores: {
        pivot: {
            type: 'pivot-rows'
        },
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

        measureLabel: function (get) {
            var labels = {
                market_value: 'Market Value',
                cost_basis: 'Cost Basis',
                unrealized_pl: 'Unrealized P/L'
            };

            return labels[get('measure')] || '';
        },

        pivotTitleHtml: function (get) {
            return '<div class="piq-card-title">Exposure by Sector → Company</div>' +
                '<div class="piq-card-sub">Columns by portfolio • measure: ' +
                Ext.String.htmlEncode(get('measureLabel')) + '</div>';
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
        },

        grandCard: function (get) {
            return { rows: get('grandRows') };
        }
    }
});

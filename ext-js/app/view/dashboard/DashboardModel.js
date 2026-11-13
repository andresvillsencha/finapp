/**
 * View model of the Portfolio Dashboard.
 *
 * It inherits portfolioId, tickIndex, asOf and activeScreen from the shell's view
 * model. Everything shown comes from the API and is only FORMATTED here; no
 * financial value is calculated in the browser.
 *
 *  - state: 'loading' (first load / portfolio or range change, shows a mask),
 *           'ready', or 'error' (banner with Retry; last data stays visible)
 */
Ext.define('FinApp.view.dashboard.DashboardModel', {
    extend: 'Ext.app.ViewModel',

    alias: 'viewmodel.dashboard',

    requires: [
        'FinApp.store.PortfolioHistory',
        'FinApp.store.SectorAllocation',
        'FinApp.util.Format'
    ],

    data: {
        range: '6M',
        state: 'loading',
        errorMessage: '',

        scopeName: 'All Portfolios',
        dataAsOf: '',
        rangeNote: '',
        kpis: null,
        definitions: null,

        topRows: [],
        bottomRows: [],
        summaryRows: [],
        sectorLegend: []
    },

    stores: {
        history: {
            type: 'portfolio-history'
        },
        sectors: {
            type: 'sector-allocation'
        }
    },

    formulas: {
        isLoading: function (get) {
            return get('state') === 'loading';
        },

        /** Mask shown over the screen while the first data for a scope loads. */
        loadMask: function (get) {
            return get('state') === 'loading' ? {
                xtype: 'loadmask',
                message: 'Loading dashboard…'
            } : false;
        },

        hasError: function (get) {
            return get('state') === 'error';
        },

        errorHtml: function (get) {
            return '<span class="x-fa fa-triangle-exclamation"></span> Could not refresh the dashboard: ' +
                Ext.String.htmlEncode(get('errorMessage'));
        },

        /** False only when a loaded portfolio has no open positions (empty state). */
        hasHoldings: function (get) {
            var kpis = get('kpis');

            return !kpis || kpis.position_count > 0;
        },

        subtitleHtml: function (get) {
            var F = FinApp.util.Format,
                asOf = get('dataAsOf');

            return Ext.String.htmlEncode(get('scopeName')) + ' • Simulated data' +
                (asOf ? ' • As of ' + Ext.String.htmlEncode(F.utcDateTime(asOf)) : '');
        },

        /** The five KPI cards (pre-formatted strings from server values). */
        kpiCards: function (get) {
            var k = get('kpis'),
                F = FinApp.util.Format,
                gainArrow,
                dailyArrow;

            if (!k) {
                return { cards: [] };
            }

            gainArrow = F.arrow(k.total_gain_loss);
            dailyArrow = F.arrow(k.daily_change);

            return {
                cards: [{
                    icon: 'fa-layer-group',
                    label: 'Portfolio Value',
                    value: F.usd(k.portfolio_value),
                    valueCls: '',
                    sub: k.position_count + ' open positions • cash + equity',
                    subCls: 'piq-flat'
                }, {
                    icon: 'fa-chart-line',
                    label: 'Total Gain/Loss',
                    value: F.signedUsd(k.total_gain_loss),
                    valueCls: F.pnlCls(k.total_gain_loss),
                    sub: (gainArrow ? gainArrow + ' ' : '') + F.signedPct(k.total_gain_loss_pct) + ' of initial funding',
                    subCls: F.pnlCls(k.total_gain_loss)
                }, {
                    icon: 'fa-gauge',
                    label: 'Daily Change (indicative)',
                    value: F.signedUsd(k.daily_change),
                    valueCls: F.pnlCls(k.daily_change),
                    sub: (dailyArrow ? dailyArrow + ' ' : '') + F.signedPct(k.daily_change_pct) + ' since UTC day start',
                    subCls: F.pnlCls(k.daily_change)
                }, {
                    icon: 'fa-briefcase',
                    label: 'Invested Cost Basis',
                    value: F.usd(k.cost_basis),
                    valueCls: '',
                    sub: 'Market value ' + F.usd(k.market_value),
                    subCls: 'piq-flat'
                }, {
                    icon: 'fa-wallet',
                    label: 'Cash Balance',
                    value: F.usd(k.cash_balance),
                    valueCls: '',
                    sub: 'Available simulated cash',
                    subCls: 'piq-flat'
                }]
            };
        },

        topCard: function (get) {
            return { rows: get('topRows') };
        },

        bottomCard: function (get) {
            return { rows: get('bottomRows') };
        },

        summaryCard: function (get) {
            return { rows: get('summaryRows') };
        },

        legendCard: function (get) {
            return { rows: get('sectorLegend') };
        },

        /** Definitions supplied by the API, shown so the numbers are never ambiguous. */
        footnote: function (get) {
            var defs = get('definitions');

            if (!defs) {
                return '';
            }

            return Ext.String.htmlEncode(defs.total_gain_loss_pct || defs.total_gain_loss) + ' ' +
                Ext.String.htmlEncode(defs.daily_change) + ' Illustrative simulated figures.';
        }
    }
});

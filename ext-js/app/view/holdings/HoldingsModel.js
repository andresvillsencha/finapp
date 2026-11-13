/**
 * View model of the Holdings Explorer.
 *
 * Inherits portfolioId, tickIndex, asOf and activeScreen from the shell. Everything shown
 * comes from the API; the formulas only FORMAT server values (no financial value is
 * calculated in the browser).
 *
 *  - state: 'loading' | 'ready' | 'error' (banner with Retry; last data stays visible)
 *  - group: 'none' | 'sector' | 'portfolio_name'  (the store grouper)
 *  - tab:   'holdings' | 'transactions'
 */
Ext.define('FinApp.view.holdings.HoldingsModel', {
    extend: 'Ext.app.ViewModel',

    alias: 'viewmodel.holdings',

    requires: [
        'FinApp.store.Holdings',
        'FinApp.store.Transactions',
        'FinApp.store.CompanyPrices',
        'FinApp.util.Format'
    ],

    data: {
        state: 'loading',
        errorMessage: '',

        group: 'none',
        tab: 'holdings',
        priceRange: '3M',

        // Server totals over every row matching the filters (meta.totals of /holdings).
        totals: null,

        // The selected position (a Holding record) and the company's server-side metadata.
        selection: null,
        company: null,
        priceNote: '',

        // Latest trades of the selected position, pre-formatted by the controller.
        recentRows: []
    },

    stores: {
        holdings: {
            type: 'holdings'
        },
        transactions: {
            type: 'transactions'
        },
        // The five latest trades of the selected position (detail panel).
        recent: {
            type: 'transactions',
            pageSize: 5
        },
        prices: {
            type: 'company-prices'
        }
    },

    formulas: {
        hasError: function (get) {
            return get('state') === 'error';
        },

        errorHtml: function (get) {
            return '<span class="x-fa fa-triangle-exclamation"></span> Could not load the holdings: ' +
                Ext.String.htmlEncode(get('errorMessage'));
        },

        hasSelection: function (get) {
            return !!get('selection');
        },

        noSelection: function (get) {
            return !get('selection');
        },

        showHoldings: function (get) {
            return get('tab') === 'holdings';
        },

        showTransactions: function (get) {
            return get('tab') === 'transactions';
        },

        /** Four summary cards from the server totals of the current filter. */
        summaryCards: function (get) {
            var t = get('totals'),
                F = FinApp.util.Format;

            if (!t) {
                return { cards: [] };
            }

            return {
                cards: [{
                    icon: 'fa-layer-group',
                    label: 'Positions',
                    value: F.integer(t.count),
                    valueCls: '',
                    sub: 'Matching the filters',
                    subCls: ''
                }, {
                    icon: 'fa-chart-line',
                    label: 'Market Value',
                    value: F.usd(t.market_value),
                    valueCls: '',
                    sub: 'Cost basis ' + F.usd(t.cost_basis),
                    subCls: ''
                }, {
                    icon: 'fa-scale-balanced',
                    label: 'Unrealized P/L',
                    value: F.signedUsd(t.unrealized_pl),
                    valueCls: F.pnlCls(t.unrealized_pl),
                    sub: (F.arrow(t.unrealized_pl) + ' ' + F.signedPct(t.unrealized_pl_pct)).replace(/^\s+/, ''),
                    subCls: F.pnlCls(t.unrealized_pl)
                }, {
                    icon: 'fa-bolt',
                    label: 'Daily Change',
                    value: F.signedUsd(t.daily_pl),
                    valueCls: F.pnlCls(t.daily_pl),
                    sub: 'Indicative price change since UTC day start',
                    subCls: ''
                }]
            };
        },

        /** Everything the detail panel shows about the selected position, pre-formatted. */
        detail: function (get) {
            var r = get('selection'),
                c = get('company'),
                F = FinApp.util.Format;

            if (!r) {
                return {};
            }

            return {
                symbol: r.get('symbol'),
                company: r.get('company'),
                sector: r.get('sector'),
                industry: r.get('industry'),
                portfolio: r.get('portfolio_name'),
                price: F.usd(r.get('current_price')),
                dayChange: F.arrow(r.get('day_change')) + ' ' + F.signedUsd(r.get('day_change')) +
                    ' (' + F.signedPct(r.get('day_change_pct')) + ')',
                dayCls: F.pnlCls(r.get('day_change')),
                marketValue: F.usd(r.get('market_value')),
                quantity: F.integer(r.get('quantity')),
                averageCost: F.usd(r.get('average_cost')),
                costBasis: F.usd(r.get('cost_basis')),
                unrealized: F.signedUsd(r.get('unrealized_pl')),
                unrealizedPct: F.signedPct(r.get('unrealized_pl_pct')),
                plCls: F.pnlCls(r.get('unrealized_pl')),
                allocation: F.pct(r.get('allocation_pct')),
                description: c ? c.description : '',
                exchange: c ? c.exchange : '',
                country: c ? c.country : ''
            };
        },

        priceTitle: function (get) {
            return 'Simulated price • ' + get('priceRange');
        },

        recentCard: function (get) {
            return {
                rows: get('recentRows')
            };
        },

        aboutTitle: function (get) {
            var r = get('selection');

            return r ? 'About ' + Ext.String.htmlEncode(r.get('company')) : '';
        },

        /** Company description and facts from GET /api/companies (server fixture text). */
        aboutHtml: function (get) {
            var c = get('company');

            if (!c) {
                return '<span class="piq-muted">Loading company details…</span>';
            }

            return '<p>' + Ext.String.htmlEncode(c.description) + '</p>' +
                '<p class="piq-muted">' + Ext.String.htmlEncode(c.industry) + ' • ' +
                Ext.String.htmlEncode(c.exchange) + ' • ' + Ext.String.htmlEncode(c.country) + '</p>';
        }
    }
});

/**
 * Controller of the Trade Simulator dialog.
 *
 * Flow: load the company list (GET /api/companies, with a simulated quote), let the user
 * choose portfolio, company, side and quantity, then POST /api/transactions with ONLY
 * { portfolio_id, company_id, trade_type, quantity }. The server captures the latest tick
 * and returns the authoritative execution price and time. On success the app-wide
 * `piqtrade` event is fired so every screen reloads its data.
 *
 * Server rejections (insufficient cash or shares, invalid input) are shown in the dialog.
 */
Ext.define('FinApp.view.holdings.TradeController', {
    extend: 'Ext.app.ViewController',

    alias: 'controller.trade',

    requires: [
        'FinApp.util.Api',
        'FinApp.util.Format'
    ],

    init: function () {
        var me = this,
            view = me.getView(),
            vm = me.getViewModel();

        me.companies = {};
        me.portfolios = {};

        vm.set('side', view.getTradeType());

        vm.bind('{companyId}', me.onCompanyChange, me);
        vm.bind('{portfolioId}', me.onPortfolioChange, me);
        // Any edit clears an earlier server error message.
        vm.bind('{side}', me.clearError, me);
        vm.bind('{quantity}', me.clearError, me);

        // The fields exist once the dialog is painted; options must be set BEFORE values.
        view.on('painted', me.onPainted, me, { single: true });
    },

    onPainted: function () {
        var me = this,
            view = me.getView();

        if (me.destroyed) {
            return;
        }

        // Portfolio options come from the shell's portfolios (already loaded by the API).
        me.setPortfolioOptions(view.getPortfolioOptions());
        me.getViewModel().set('portfolioId', view.getInitialPortfolioId());
        me.loadCompanies();
    },

    // ---- options ---------------------------------------------------------------

    setPortfolioOptions: function (list) {
        var me = this,
            options = [];

        Ext.Array.each(list || [], function (p) {
            me.portfolios[p.id] = p;
            options.push({ text: p.name, value: p.id });
        });

        me.lookup('portfolioField').setOptions(options);
    },

    loadCompanies: function () {
        var me = this;

        FinApp.util.Api.request({
            path: '/companies',
            params: {
                limit: 100,
                sort: Ext.encode([{ property: 'symbol', direction: 'ASC' }])
            },
            scope: me,
            success: me.onCompaniesLoaded,
            failure: function (error) {
                if (!me.destroyed) {
                    me.getViewModel().set('errorMessage', error.message);
                }
            },
            callback: function () {
                if (!me.destroyed) {
                    me.getViewModel().set('loadingCompanies', false);
                }
            }
        });
    },

    onCompaniesLoaded: function (list) {
        var me = this,
            vm = me.getViewModel(),
            view = me.getView(),
            options = [],
            companyId = view.getInitialCompanyId();

        if (me.destroyed) {
            return;
        }

        Ext.Array.each(list, function (c) {
            me.companies[c.id] = c;
            options.push({ text: c.symbol + ' — ' + c.company, value: c.id });
        });

        me.lookup('companyField').setOptions(options);

        if (companyId && me.companies[companyId]) {
            vm.set('companyId', companyId);
        }
    },

    // ---- reactions ------------------------------------------------------------

    onCompanyChange: function (companyId) {
        this.getViewModel().set('quote', this.companies[companyId] || null);
        this.clearError();
    },

    onPortfolioChange: function (portfolioId) {
        var p = this.portfolios[portfolioId];

        this.getViewModel().set('cash', p ? p.cash_balance : null);
        this.clearError();
    },

    clearError: function () {
        var vm = this.getViewModel();

        if (vm.get('errorMessage')) {
            vm.set('errorMessage', '');
        }
    },

    // ---- actions --------------------------------------------------------------

    onCancel: function () {
        this.getView().close();
    },

    onExecute: function () {
        var me = this,
            vm = me.getViewModel();

        if (!vm.get('canSubmit')) {
            return;
        }

        vm.set({
            submitting: true,
            errorMessage: ''
        });

        // Never send a price or time: the server uses its own latest simulated tick.
        FinApp.util.Api.request({
            path: '/transactions',
            method: 'POST',
            jsonData: {
                portfolio_id: vm.get('portfolioId'),
                company_id: vm.get('companyId'),
                trade_type: vm.get('side'),
                quantity: vm.get('quantity')
            },
            scope: me,
            success: me.onTradeExecuted,
            failure: me.onTradeFailed,
            callback: function () {
                if (!me.destroyed) {
                    vm.set('submitting', false);
                }
            }
        });
    },

    onTradeExecuted: function (trade) {
        var F = FinApp.util.Format,
            view = this.getView();

        // Tell every screen (and the shell) to reload; they re-read the server state.
        Ext.fireEvent('piqtrade', trade);

        Ext.toast(Ext.String.htmlEncode(
            'Simulated ' + trade.trade_type + ' executed: ' + F.integer(trade.quantity) + ' ' + trade.symbol +
            ' at ' + F.usd(trade.execution_price) + ' (server price)'
        ), 5000);

        view.close();
    },

    onTradeFailed: function (error) {
        if (!this.destroyed) {
            this.getViewModel().set('errorMessage', error.message);
        }
    }
});

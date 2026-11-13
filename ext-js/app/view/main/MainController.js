/**
 * Controller of the application shell.
 *
 *  - Routing: #dashboard, #holdings and #analytics select the screen (the
 *    Application's defaultToken opens #dashboard). Navigation buttons only change
 *    the hash, so browser back/forward and deep links work.
 *  - Refresh: polls GET /api/simulation/status with an Ext.util.TaskRunner task
 *    (default every 5 seconds, then the cadence the server reports). Requests never
 *    pile up, failures are shown and retried, and the task is stopped when the
 *    view is destroyed.
 *  - Portfolio selector: filled from GET /api/portfolios.
 *
 * The browser never invents or calculates market data.
 */
Ext.define('FinApp.view.main.MainController', {
    extend: 'Ext.app.ViewController',

    alias: 'controller.main',

    requires: [
        'FinApp.util.Api',
        'Ext.util.TaskRunner',
        'Ext.Toast'
    ],

    routes: {
        dashboard: 'onRouteDashboard',
        holdings: 'onRouteHoldings',
        analytics: 'onRouteAnalytics'
    },

    /** Screen order must match the items of the 'screens' card container. */
    screenKeys: ['dashboard', 'holdings', 'analytics'],

    /** Labels of the navigation buttons; at narrow widths only the icon is shown (text becomes a tooltip). */
    navTexts: {
        dashboard: 'Dashboard',
        holdings: 'Holdings Explorer',
        analytics: 'Portfolio Analytics'
    },

    /** Window width (px) at or below which the sidebar collapses to icons (matches Main.scss). */
    collapseWidth: 1000,

    navReferences: {
        dashboard: 'navDashboard',
        holdings: 'navHoldings',
        analytics: 'navAnalytics'
    },

    init: function () {
        var me = this,
            vm = me.getViewModel();

        vm.set('apiBase', FinApp.util.Api.getBaseUrl());
        vm.set('refreshMs', FinApp.util.Api.defaultRefreshMs);

        Ext.on('piqapierror', me.onApiError, me);
        Ext.Viewport.on('resize', me.syncNav, me, { buffer: 150 });
        me.getView().on('painted', me.syncNav, me, { single: true });
        // A simulated trade changes cash and positions: reload the portfolio totals.
        Ext.on('piqtrade', me.loadPortfolios, me);

        // The task fires immediately, then every `interval` ms.
        me.runner = new Ext.util.TaskRunner();
        me.pollTask = me.runner.newTask({
            run: me.pollStatus,
            scope: me,
            interval: FinApp.util.Api.defaultRefreshMs
        });
        me.pollTask.start();
    },

    destroy: function () {
        var me = this;

        Ext.un('piqapierror', me.onApiError, me);
        Ext.un('piqtrade', me.loadPortfolios, me);
        Ext.Viewport.un('resize', me.syncNav, me);

        if (me.runner) {
            me.runner.destroy();
            me.runner = me.pollTask = null;
        }

        me.callParent();
    },

    // ---- navigation / routes -------------------------------------------------

    /**
     * Narrow windows: the sidebar shows icons only. The button text is cleared (an icon-only
     * button is laid out and centred by the theme) and kept as tooltip and aria label.
     */
    syncNav: function () {
        var me = this,
            collapsed = Ext.Viewport.getWidth() <= me.collapseWidth;

        if (me.destroyed || collapsed === me.navCollapsed) {
            return;
        }

        me.navCollapsed = collapsed;

        Ext.Object.each(me.navReferences, function (key, ref) {
            var button = me.lookup(ref);

            if (button) {
                button.setText(collapsed ? '' : me.navTexts[key]);
                button.setTooltip(collapsed ? me.navTexts[key] : null);
            }
        });
    },

    onNavTap: function (button) {
        this.redirectTo(button.getItemId());
    },

    onRouteDashboard: function () {
        this.showScreen('dashboard');
    },

    onRouteHoldings: function () {
        this.showScreen('holdings');
    },

    onRouteAnalytics: function () {
        this.showScreen('analytics');
    },

    showScreen: function (key) {
        var me = this,
            screens = me.lookup('screens');

        screens.setActiveItem(Ext.Array.indexOf(me.screenKeys, key));
        me.getViewModel().set('activeScreen', key);

        Ext.Array.each(me.screenKeys, function (name) {
            var button = me.lookup(me.navReferences[name]);

            if (button) {
                if (name === key) {
                    button.addCls('piq-nav-active');
                } else {
                    button.removeCls('piq-nav-active');
                }
            }
        });
    },

    // ---- simulation status polling -------------------------------------------

    pollStatus: function () {
        var me = this;

        // Never let requests pile up when the server is slow or unreachable.
        if (me.polling || me.destroyed) {
            return;
        }

        me.polling = true;

        FinApp.util.Api.request({
            path: '/simulation/status',
            scope: me,
            success: me.onStatusSuccess,
            failure: me.onStatusFailure,
            callback: function () {
                me.polling = false;
            }
        });
    },

    onStatusSuccess: function (status) {
        var me = this,
            vm = me.getViewModel(),
            wasOnline = vm.get('apiStatus') === 'online',
            refreshMs = status.refresh_interval_ms;

        if (me.destroyed) {
            return;
        }

        vm.set({
            apiStatus: 'online',
            apiMessage: '',
            tickIndex: status.tick_index,
            asOf: status.as_of,
            scenarioName: status.scenario_name
        });

        // Follow the cadence the server asks for.
        if (Ext.isNumber(refreshMs) && refreshMs >= 1000 && refreshMs !== vm.get('refreshMs')) {
            vm.set('refreshMs', refreshMs);
            me.pollTask.restart(refreshMs);
        }

        // Screens listen for a new simulated tick with Ext.on('piqsnapshot', ...).
        Ext.fireEvent('piqsnapshot', {
            tickIndex: status.tick_index,
            asOf: status.as_of,
            portfolioId: vm.get('portfolioId')
        });

        if (!wasOnline) {
            me.loadPortfolios();
        }
    },

    onStatusFailure: function (error) {
        var vm = this.getViewModel();

        if (this.destroyed) {
            return;
        }

        vm.set({
            apiStatus: 'offline',
            apiMessage: error.message
        });
    },

    onRetry: function () {
        var vm = this.getViewModel();

        vm.set('apiStatus', 'connecting');
        this.pollStatus();
    },

    // ---- portfolios -------------------------------------------------------------

    loadPortfolios: function () {
        var me = this,
            store = me.getViewModel().getStore('portfolios');

        store.load({
            callback: function (records, operation, success) {
                if (success && !me.destroyed) {
                    me.syncPortfolioOptions(store);
                }
            }
        });
    },

    /** "All Portfolios" plus one option per portfolio returned by the API. */
    syncPortfolioOptions: function (store) {
        var me = this,
            vm = me.getViewModel(),
            select = me.lookup('portfolioSelect'),
            current = vm.get('portfolioId'),
            options = [{ text: 'All Portfolios', value: 'all' }];

        Ext.Array.each(store.getRange(), function (record) {
            options.push({ text: record.get('name'), value: record.get('id') });
        });

        select.setOptions(options);
        select.setValue(store.getById(current) ? current : 'all');
        vm.set('portfolioCount', store.getCount());
    },

    // ---- errors ---------------------------------------------------------------

    /** Non-fatal API errors raised by stores: tell the user, keep the app running. */
    onApiError: function (error) {
        if (!error.offline) {
            Ext.toast(Ext.String.htmlEncode(error.message), 5000);
        }
    }
});

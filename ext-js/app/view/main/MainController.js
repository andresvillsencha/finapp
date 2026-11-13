/**
 * Controller of the application shell.
 *
 *  - Routing: #dashboard, #holdings and #analytics select the screen (the
 *    Application's defaultToken opens #dashboard). Navigation buttons only change
 *    the hash, so browser back/forward and deep links work.
 *  - Refresh: polls GET /api/simulation/status with an Ext.util.TaskRunner task. The user
 *    picks the rate in the header (5, 10, 15, 30 or 60 seconds) or pauses auto-refresh; the
 *    choice is remembered in the browser. "Refresh now" polls once, also while paused. Requests
 *    never pile up, failures are shown, and the task is stopped when the view is destroyed.
 *    Screens reload when a poll reports a new tick (piqsnapshot), so the choice sets how often
 *    every screen updates; trades always refresh the screens immediately.
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

    /** Auto-refresh rates the user can choose, in milliseconds; 0 (in the view model) means paused. */
    refreshRates: [5000, 10000, 15000, 30000, 60000],

    /** Browser storage key of the remembered choice (a per-viewer convenience only). */
    refreshStorageKey: 'piq.refreshMs',

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

        Ext.on('piqapierror', me.onApiError, me);
        Ext.Viewport.on('resize', me.syncNav, me, { buffer: 150 });
        me.getView().on('painted', me.syncNav, me, { single: true });
        // A simulated trade changes cash and positions: reload the portfolio totals.
        Ext.on('piqtrade', me.loadPortfolios, me);

        // Remembered choice (5-60 s, or 0 = paused); otherwise the default rate.
        me.storedChoice = me.readRefreshChoice();
        me.refreshChoice = me.storedChoice === null ? FinApp.util.Api.defaultRefreshMs : me.storedChoice;
        vm.set('refreshChoice', me.refreshChoice);

        me.runner = new Ext.util.TaskRunner();
        me.pollTask = me.runner.newTask({
            run: me.pollStatus,
            scope: me,
            interval: me.refreshChoice || FinApp.util.Api.defaultRefreshMs
        });

        // The first status is always fetched at once (also when paused, so there is data to show).
        me.pollStatus();
        if (me.refreshChoice > 0) {
            me.pollTask.start();
        }

        vm.bind('{refreshChoice}', me.onRefreshChoice, me);
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

    /** The remembered auto-refresh choice, or null when none (or an invalid one) is stored. */
    readRefreshChoice: function () {
        var me = this,
            value = null;

        try {
            value = window.localStorage.getItem(me.refreshStorageKey);
        } catch (e) {
            return null;    // storage blocked: the default applies
        }

        value = value === null ? null : parseInt(value, 10);

        return (value === 0 || Ext.Array.contains(me.refreshRates, value)) ? value : null;
    },

    saveRefreshChoice: function (value) {
        try {
            window.localStorage.setItem(this.refreshStorageKey, String(value));
        } catch (e) {
            // storage blocked: the choice simply is not remembered
        }
    },

    /**
     * The header selector changed: 0 pauses the polling, any other value polls at that rate
     * (and polls once right away, so a faster rate or a resume shows fresh data immediately).
     */
    onRefreshChoice: function (value) {
        var me = this;

        if (me.destroyed || !Ext.isNumber(value) || value === me.refreshChoice ||
            (value !== 0 && !Ext.Array.contains(me.refreshRates, value))) {
            return;
        }

        me.refreshChoice = value;
        me.storedChoice = value;
        me.saveRefreshChoice(value);

        if (value === 0) {
            me.pollTask.stop();
        } else {
            me.pollTask.restart(value);
            me.pollStatus();
        }
    },

    /** "Refresh now": one poll, also while auto-refresh is paused. */
    onRefreshNow: function () {
        this.pollStatus();
    },

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
            serverMs = status.refresh_interval_ms;

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

        // Until the user chooses a rate, follow the server's suggested cadence when it is one of
        // the offered rates. A chosen rate (or pause) always wins.
        if (me.storedChoice === null && Ext.Array.contains(me.refreshRates, serverMs) &&
            serverMs !== me.refreshChoice) {
            me.refreshChoice = serverMs;
            vm.set('refreshChoice', serverMs);
            me.pollTask.restart(serverMs);
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

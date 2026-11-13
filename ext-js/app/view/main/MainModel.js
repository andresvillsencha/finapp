/**
 * View model of the application shell. It owns the state every screen shares:
 *
 *  - portfolioId   the selected portfolio ('all' or a portfolio id). Screens bind
 *                  to it through ViewModel inheritance and re-request their data.
 *  - apiStatus     'connecting' | 'online' | 'offline'
 *  - tickIndex / asOf   the latest simulated market snapshot reported by
 *                  GET /api/simulation/status
 *
 * Nothing here is calculated from prices: the server is the only authority for
 * simulated values and time.
 */
Ext.define('FinApp.view.main.MainModel', {
    extend: 'Ext.app.ViewModel',

    alias: 'viewmodel.main',

    requires: [
        'FinApp.store.Portfolios',
        'FinApp.util.Format'
    ],

    data: {
        portfolioId: 'all',
        activeScreen: 'dashboard',

        apiBase: '',
        apiStatus: 'connecting',
        apiMessage: '',

        tickIndex: null,
        asOf: '',
        scenarioName: '',
        refreshMs: 5000,
        portfolioCount: 0
    },

    stores: {
        portfolios: {
            type: 'portfolios'
        }
    },

    formulas: {
        apiOffline: function (get) {
            return get('apiStatus') === 'offline';
        },

        /** "Last simulated update: 2026-11-13 12:00:00 UTC" (header). */
        lastUpdateHtml: function (get) {
            var asOf = get('asOf');

            return 'Last simulated update: <b>' +
                Ext.String.htmlEncode(asOf ? FinApp.util.Format.utcDateTime(asOf) : FinApp.util.Format.EMPTY) +
                '</b>';
        },

        offlineHtml: function (get) {
            return '<span class="x-fa fa-triangle-exclamation"></span> ' +
                Ext.String.htmlEncode(get('apiMessage'));
        },

        /** Data for the simulation status card at the bottom of the sidebar. */
        simulationStatus: function (get) {
            var status = get('apiStatus'),
                asOf = get('asOf');

            return {
                stateText: status === 'online' ? 'Connected' :
                    (status === 'offline' ? 'API unreachable' : 'Connecting…'),
                stateCls: status === 'online' ? 'piq-ok' : (status === 'offline' ? 'piq-err' : 'piq-warn'),
                refresh: 'Refresh every ' + Math.round(get('refreshMs') / 1000) + 's',
                lastUpdate: asOf ? FinApp.util.Format.utcDateTime(asOf) : FinApp.util.Format.EMPTY
            };
        },

        /** Data for the API connectivity check card shown on each placeholder screen. */
        connectivity: function (get) {
            var status = get('apiStatus'),
                F = FinApp.util.Format;

            return {
                statusText: status === 'online' ? 'Connected' :
                    (status === 'offline' ? 'Unreachable' : 'Connecting…'),
                statusCls: status === 'online' ? 'piq-ok' : (status === 'offline' ? 'piq-err' : 'piq-warn'),
                apiBase: get('apiBase'),
                asOf: get('asOf') ? F.utcDateTime(get('asOf')) : F.EMPTY,
                tickIndex: get('tickIndex') === null ? F.EMPTY : F.integer(get('tickIndex')),
                scenarioName: get('scenarioName') || F.EMPTY,
                portfolioCount: get('portfolioCount'),
                portfolioId: String(get('portfolioId')),
                message: get('apiMessage')
            };
        }
    }
});

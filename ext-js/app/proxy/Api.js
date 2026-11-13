/**
 * FinApp.proxy.Api  (alias: proxy.piq)
 *
 * The one Ajax proxy every FinApp store uses to read the PortfolioIQ REST API.
 *
 *   proxy: { type: 'piq', endpoint: '/holdings' }
 *
 * - Reader matches the API envelope exactly: `data` array, top-level `total`
 *   (the filtered count BEFORE paging), `success`, `message`.
 * - Remote operations use Ext JS defaults, which the server parses and
 *   whitelists: `page` / `start` / `limit`, and JSON-encoded `sort` / `filter`.
 * - Failures (HTTP errors, unreachable server, `success: false`) are normalized
 *   and announced via FinApp.util.Api#notifyError, so the shell can show them.
 */
Ext.define('FinApp.proxy.Api', {
    extend: 'Ext.data.proxy.Ajax',
    alias: 'proxy.piq',

    requires: [
        'FinApp.util.Api'
    ],

    config: {
        /** API path such as '/portfolios'; resolved against the API base URL. */
        endpoint: null
    },

    /** Keep URLs clean; the server already sends Cache-Control: no-store. */
    noCache: false,
    timeout: 15000,
    withCredentials: false,
    useDefaultXhrHeader: false,

    pageParam: 'page',
    startParam: 'start',
    limitParam: 'limit',
    sortParam: 'sort',
    filterParam: 'filter',

    reader: {
        type: 'json',
        rootProperty: 'data',
        totalProperty: 'total',
        successProperty: 'success',
        messageProperty: 'message',

        // Keep the last response (reader.rawData) so screens can read the server's `meta`
        // block (totals, group sums, series descriptions). It is off by default in Ext JS.
        keepRawData: true
    },

    constructor: function () {
        var me = this,
            endpoint;

        me.callParent(arguments);

        // Resolve the path against the (environment aware) API base URL once all
        // configs are initialized.
        endpoint = me.getEndpoint();
        if (endpoint) {
            me.setUrl(FinApp.util.Api.url(endpoint));
        }

        me.on('exception', me.onApiException, me);
    },

    onApiException: function (proxy, response) {
        FinApp.util.Api.notifyError(FinApp.util.Api.toError(response));
    }
});

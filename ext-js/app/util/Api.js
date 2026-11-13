/**
 * FinApp.util.Api
 *
 * Single place that knows where the PortfolioIQ Node.js API lives and how to
 * talk to it. The Ext JS app obtains ALL financial data through this REST API
 * (never from the JSON fixtures) and never calculates or invents prices.
 *
 * Base URL resolution (environment aware):
 *  1. `?apiBase=http://127.0.0.1:4000/api` in the page URL, but ONLY for local
 *     development hosts (localhost, 127.0.0.1, [::1]); anything else is ignored.
 *  2. Otherwise `defaultBaseUrl` (http://127.0.0.1:3000/api, the server default).
 *
 * The API allows the Sencha Cmd dev origin (http://localhost:1841) via CORS, see
 * server/.env.example (CORS_ORIGINS).
 *
 * Error contract (server): non-2xx status plus
 *   { success: false, message, code, error: { code, message } }
 * Normalized client error object:
 *   { status, code, message, offline, timedOut }
 *
 * NOTE: written in ES5 on purpose so the production (YUI) compressor can build it.
 */
Ext.define('FinApp.util.Api', {
    singleton: true,

    requires: [
        'Ext.Ajax',
        'Ext.Object',
        'Ext.String'
    ],

    /** Where `npm start` in server/ listens by default. */
    defaultBaseUrl: 'http://127.0.0.1:3000/api',

    /** Fallback refresh cadence; the server reports its own in /simulation/status. */
    defaultRefreshMs: 5000,

    /** Request timeout in milliseconds. */
    timeout: 15000,

    /** Hosts a `?apiBase=` override may point at (local development only). */
    localBaseRegex: /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?(\/[A-Za-z0-9._~\-]+)*\/?$/,

    constructor: function () {
        this.callParent(arguments);
        // Plain cross-origin GETs then need no CORS preflight for a custom header.
        Ext.Ajax.setUseDefaultXhrHeader(false);
    },

    /** @return {String} The API base URL without a trailing slash. */
    getBaseUrl: function () {
        var me = this,
            override;

        if (!me.baseUrl) {
            override = Ext.Object.fromQueryString(window.location.search).apiBase;

            if (Ext.isString(override) && me.localBaseRegex.test(override)) {
                me.baseUrl = override.replace(/\/+$/, '');
            } else {
                me.baseUrl = me.defaultBaseUrl;
            }
        }

        return me.baseUrl;
    },

    /** @return {String} Absolute URL for an API path such as '/holdings'. */
    url: function (path) {
        return this.getBaseUrl() + path;
    },

    /** @return {Object/null} Decoded JSON body, or null when it is not JSON. */
    decode: function (response) {
        var text = response && response.responseText;

        return text ? Ext.decode(text, true) : null;
    },

    /**
     * Turn a failed response into a normalized error object. A status of 0 means
     * the server could not be reached (not running, blocked, or timed out).
     * @param {Object} response An Ext Ajax / proxy response (may be null)
     * @return {Object} { status, code, message, offline, timedOut }
     */
    toError: function (response) {
        var me = this,
            status = response && response.status ? response.status : 0,
            timedOut = !!(response && response.timedout),
            body = response ? me.decode(response) : null,
            offline = !status,
            message = null,
            code = null;

        if (Ext.isObject(body) && body.success === false) {
            message = body.message;
            code = body.code;
        }

        if (!message) {
            if (timedOut) {
                message = 'The request to the PortfolioIQ API timed out.';
            } else if (offline) {
                message = 'The PortfolioIQ API is not reachable at ' + me.getBaseUrl() +
                    '. Start the backend (npm start in the server folder).';
            } else {
                message = 'The API request failed (HTTP ' + status + ').';
            }
        }

        return {
            status: status,
            code: code || (offline ? 'API_UNREACHABLE' : 'HTTP_' + status),
            message: message,
            offline: offline,
            timedOut: timedOut
        };
    },

    /**
     * Request a single record or an action result.
     *
     * @param {Object} options
     * @param {String} options.path API path, e.g. '/simulation/status'
     * @param {String} [options.method='GET']
     * @param {Object} [options.params] Query parameters
     * @param {Object} [options.jsonData] JSON request body
     * @param {Function} [options.success] Called with (data, envelope, response)
     * @param {Function} [options.failure] Called with (error, response)
     * @param {Function} [options.callback] Always called last
     * @param {Object} [options.scope]
     * @return {Object} The Ext request
     */
    request: function (options) {
        var me = this;

        return Ext.Ajax.request({
            url: me.url(options.path),
            method: options.method || 'GET',
            params: options.params,
            jsonData: options.jsonData,
            timeout: options.timeout || me.timeout,
            disableCaching: false,
            success: function (response) {
                var body = me.decode(response);

                if (Ext.isObject(body) && body.success === true) {
                    Ext.callback(options.success, options.scope, [body.data, body, response]);
                } else {
                    Ext.callback(options.failure, options.scope, [
                        {
                            status: response.status,
                            code: 'INVALID_RESPONSE',
                            message: 'The API returned an unexpected response.',
                            offline: false,
                            timedOut: false
                        },
                        response
                    ]);
                }
            },
            failure: function (response) {
                Ext.callback(options.failure, options.scope, [me.toError(response), response]);
            },
            callback: function () {
                Ext.callback(options.callback, options.scope);
            }
        });
    },

    /**
     * Tell the rest of the app about an API error (the shell shows a toast).
     * Listen with Ext.on('piqapierror', fn, scope).
     */
    notifyError: function (error) {
        Ext.fireEvent('piqapierror', error);
    }
});

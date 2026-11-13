/**
 * Open positions with REMOTE paging, sorting, filtering and grouping.
 *
 * - Sorting: Ext sends `sort` as a JSON array (the server whitelists the fields).
 * - Grouping: the grouper is sent with `simpleGroupMode` as `group` / `groupDir`; the
 *   server returns the rows ordered by the group so groups are contiguous.
 * - Filtering: the view sets `filter` (JSON) and `query` (search) as extra params, so the
 *   same parameters feed the CSV export.
 * - `total` is the filtered count before paging; `meta.totals` / `meta.groups` carry
 *   server-calculated sums over ALL matching rows (the browser never adds money up).
 */
Ext.define('FinApp.store.Holdings', {
    extend: 'Ext.data.Store',
    alias: 'store.holdings',

    requires: [
        'FinApp.model.Holding',
        'FinApp.proxy.Api'
    ],

    model: 'FinApp.model.Holding',

    pageSize: 25,
    remoteSort: true,
    remoteFilter: true,

    sorters: [{
        property: 'market_value',
        direction: 'DESC'
    }],

    proxy: {
        type: 'piq',
        endpoint: '/holdings',
        simpleGroupMode: true
    }
});

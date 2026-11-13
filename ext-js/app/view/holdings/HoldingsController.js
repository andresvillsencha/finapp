/**
 * Controller of the Holdings Explorer.
 *
 * Data (all from the REST API, nothing calculated here):
 *   GET /api/holdings              remote sort / filter / paging / grouping, meta.totals / meta.groups
 *   GET /api/transactions          history with portfolio, ticker, side and date filters
 *   GET /api/sector-allocation     fills the sector filter with the sectors of the scope
 *   GET /api/companies             metadata of the selected company (description)
 *   GET /api/companies/:id/prices  simulated price series for the detail chart
 *   GET /api/exports/holdings.csv  CSV export of the filtered holdings
 *
 * Coherence: every request of one refresh carries the same `tick`, so the grid, the
 * totals and the detail panel show the same simulated snapshot.
 *
 * Refresh: reloads on a new tick (piqsnapshot), when the shared portfolio changes, after
 * a trade (piqtrade) and when the screen is shown. A tick refresh keeps the current page,
 * sort, filters, grouping, selection and scroll position: it only reloads the holdings
 * (and the selected company's chart). Requests are coalesced; listeners are removed on
 * destroy.
 */
Ext.define('FinApp.view.holdings.HoldingsController', {
    extend: 'Ext.app.ViewController',

    alias: 'controller.holdings',

    requires: [
        'FinApp.util.Api',
        'FinApp.util.Format',
        'FinApp.view.holdings.TradeDialog'
    ],

    // Filter state (the grid filters themselves are sent as request parameters).
    sector: 'all',
    gain: 'all',
    search: '',
    tx: null,

    init: function () {
        var me = this,
            vm = me.getViewModel(),
            holdings = vm.getStore('holdings'),
            transactions = vm.getStore('transactions'),
            portfolios = me.portfoliosStore();

        me.tx = { ticker: '', side: 'all', from: null, to: null };
        me.appliedGroup = 'none';
        me.companyCache = {};

        Ext.on('piqsnapshot', me.onSnapshot, me);
        Ext.on('piqtrade', me.onTrade, me);

        // beforeload / load bracket every load (also those started by sorting, paging or
        // the pager): selection changes caused by the reload itself are ignored.
        holdings.on({
            beforeload: me.onHoldingsBeforeLoad,
            load: me.onHoldingsLoad,
            scope: me
        });
        transactions.on('load', me.onTransactionsLoad, me);

        // Portfolio filter options come from the shell's portfolios store. The view's
        // fields exist once it is painted; later loads (after a trade) re-sync them.
        if (portfolios) {
            portfolios.on('load', me.syncPortfolioOptions, me);
        }
        me.getView().on('painted', me.syncPortfolioOptions, me, { single: true });

        vm.bind('{portfolioId}', me.refresh, me);
        vm.bind('{activeScreen}', me.refresh, me);
        vm.bind('{group}', me.onGroupChange, me);
        vm.bind('{priceRange}', me.loadPrices, me);
    },

    destroy: function () {
        var me = this,
            portfolios = me.portfoliosStore();

        if (portfolios) {
            portfolios.un('load', me.syncPortfolioOptions, me);
        }

        Ext.un('piqsnapshot', me.onSnapshot, me);
        Ext.un('piqtrade', me.onTrade, me);

        me.callParent();
    },

    /**
     * The portfolios store belongs to the shell's view model; ViewModel#getStore only
     * looks at its own stores, so walk up the view model hierarchy.
     */
    portfoliosStore: function () {
        var vm = this.getViewModel(),
            store = null;

        while (vm && !store) {
            store = vm.getStore('portfolios');
            vm = vm.getParent();
        }

        return store;
    },

    // ---- triggers -----------------------------------------------------------

    onSnapshot: function (snapshot) {
        // Ticks only move forward (a slow status response must not move us back).
        if (snapshot && Ext.isNumber(snapshot.tickIndex) &&
            (!Ext.isNumber(this.latestTick) || snapshot.tickIndex > this.latestTick)) {
            this.latestTick = snapshot.tickIndex;
        }

        this.refresh();
    },

    /** A trade was executed (anywhere): reload the server state next time we can. */
    onTrade: function (trade) {
        // The trade executed at the server's latest tick: never show an older snapshot
        // (it would not include the trade yet).
        if (trade && Ext.isNumber(trade.tick_index) &&
            (!Ext.isNumber(this.latestTick) || trade.tick_index > this.latestTick)) {
            this.latestTick = trade.tick_index;
        }

        this.dirty = true;
        this.refresh();
    },

    onRetry: function () {
        this.loadedScope = null;
        this.refresh();
    },

    onRefreshTap: function () {
        this.dirty = true;
        this.refresh();
    },

    // ---- loading -----------------------------------------------------------------

    currentTick: function () {
        var me = this;

        return Ext.isNumber(me.latestTick) ? me.latestTick : me.getViewModel().get('tickIndex');
    },

    refresh: function () {
        var me = this,
            vm = me.getViewModel(),
            tick = me.currentTick(),
            scope = String(vm.get('portfolioId')),
            holdings = vm.getStore('holdings');

        // Nothing to do before the first snapshot or while another screen is shown.
        if (me.destroyed || tick === null || tick === undefined || vm.get('activeScreen') !== 'holdings') {
            return;
        }

        if (me.loadingHoldings) {
            me.pending = true;
            return;
        }

        if (scope !== me.loadedScope) {
            // New scope: start over (page 1, no selection, sectors of the new scope).
            me.loadedScope = scope;
            me.loadedTick = tick;
            me.dirty = false;
            me.sector = 'all';
            me.clearSelection();
            me.applyParams(tick);
            me.loadSectors(tick);
            holdings.loadPage(1);
            vm.getStore('transactions').loadPage(1);
        } else if (me.dirty) {
            // After a trade or a manual refresh: same page, fresh server state.
            me.dirty = false;
            me.loadedTick = tick;
            me.applyParams(tick);
            me.loadSectors(tick);
            holdings.load();
            vm.getStore('transactions').loadPage(1);
            me.loadRecent();
            me.loadPrices();
        } else if (tick !== me.loadedTick) {
            // New simulated tick: only prices changed; keep page, sort, filters and selection.
            me.loadedTick = tick;
            me.applyParams(tick);
            holdings.load();
            me.loadPrices();
        }
    },

    /** Request parameters of the holdings store (also used by the CSV export). */
    holdingsParams: function (tick) {
        var me = this,
            vm = me.getViewModel(),
            filters = [],
            params = {
                portfolioId: String(vm.get('portfolioId')),
                tick: tick
            };

        if (me.sector !== 'all') {
            filters.push({ property: 'sector', operator: '=', value: me.sector });
        }
        if (me.gain === 'gain') {
            filters.push({ property: 'unrealized_pl', operator: '>', value: 0 });
        } else if (me.gain === 'loss') {
            filters.push({ property: 'unrealized_pl', operator: '<', value: 0 });
        }
        if (filters.length) {
            params.filter = Ext.encode(filters);
        }
        if (me.search) {
            params.query = me.search;
        }

        return params;
    },

    transactionsParams: function (tick) {
        var me = this,
            tx = me.tx,
            filters = [],
            params = {
                portfolioId: String(me.getViewModel().get('portfolioId')),
                tick: tick
            };

        if (tx.ticker) {
            filters.push({ property: 'symbol', operator: 'like', value: tx.ticker });
        }
        if (tx.side !== 'all') {
            filters.push({ property: 'trade_type', operator: '=', value: tx.side });
        }
        // The date pickers give calendar dates; the API compares UTC instants.
        if (tx.from) {
            filters.push({ property: 'executed_at', operator: '>=', value: Ext.Date.format(tx.from, 'Y-m-d') + 'T00:00:00.000Z' });
        }
        if (tx.to) {
            filters.push({ property: 'executed_at', operator: '<=', value: Ext.Date.format(tx.to, 'Y-m-d') + 'T23:59:59.999Z' });
        }
        if (filters.length) {
            params.filter = Ext.encode(filters);
        }

        return params;
    },

    applyParams: function (tick) {
        var vm = this.getViewModel();

        vm.getStore('holdings').getProxy().setExtraParams(this.holdingsParams(tick));
        vm.getStore('transactions').getProxy().setExtraParams(this.transactionsParams(tick));
    },

    /** A filter changed: back to page 1 with the new parameters. */
    reloadHoldings: function () {
        var me = this,
            tick = me.currentTick();

        if (tick === null || tick === undefined) {
            return;
        }

        me.applyParams(tick);
        me.getViewModel().getStore('holdings').loadPage(1);
    },

    reloadTransactions: function () {
        var me = this,
            tick = me.currentTick();

        if (tick === null || tick === undefined) {
            return;
        }

        me.applyParams(tick);
        me.getViewModel().getStore('transactions').loadPage(1);
    },

    onHoldingsBeforeLoad: function () {
        this.loadingHoldings = true;
        // The reload may drop and re-add the selected row: do not treat that as a deselect.
        this.suspendSelection = true;
    },

    onHoldingsLoad: function (store, records, successful, operation) {
        var me = this,
            vm = me.getViewModel(),
            reader = store.getProxy().getReader(),
            meta = reader.rawData && reader.rawData.meta,
            error;

        if (me.destroyed) {
            return;
        }

        if (successful) {
            vm.set({
                state: 'ready',
                errorMessage: '',
                totals: meta ? meta.totals : null
            });
            me.restoreSelection();
        } else {
            error = FinApp.util.Api.toError(operation && operation.getError() && operation.getError().response);
            vm.set({
                state: 'error',
                errorMessage: error.message
            });
        }

        me.suspendSelection = false;
        me.loadingHoldings = false;

        // A change arrived while loading: run once more with the newest state.
        if (me.pending) {
            me.pending = false;
            me.refresh();
        }
    },

    onTransactionsLoad: function (store, records, successful, operation) {
        if (!successful && !this.destroyed) {
            this.getViewModel().set({
                state: 'error',
                errorMessage: FinApp.util.Api.toError(
                    operation && operation.getError() && operation.getError().response).message
            });
        }
    },

    // ---- filter controls --------------------------------------------------------

    /** Options of the portfolio filter (shared selection, same as the header selector). */
    syncPortfolioOptions: function () {
        var me = this,
            vm = me.getViewModel(),
            store = me.portfoliosStore(),
            field = me.lookup('portfolioFilter'),
            options = [{ text: 'All Portfolios', value: 'all' }];

        if (!store || !field) {
            return;
        }

        Ext.Array.each(store.getRange(), function (record) {
            options.push({ text: record.get('name'), value: record.get('id') });
        });

        field.setOptions(options);
        field.setValue(vm.get('portfolioId'));
    },

    /** Sectors that exist in the current scope (server data), for the sector filter. */
    loadSectors: function (tick) {
        var me = this,
            vm = me.getViewModel(),
            scope = String(vm.get('portfolioId'));

        FinApp.util.Api.request({
            path: '/sector-allocation',
            params: {
                portfolioId: scope,
                tick: tick
            },
            scope: me,
            success: function (rows) {
                var field = me.lookup('sectorFilter'),
                    options = [{ text: 'All sectors', value: 'all' }],
                    keep = false;

                if (me.destroyed || scope !== String(vm.get('portfolioId'))) {
                    return;
                }

                Ext.Array.each(rows, function (row) {
                    options.push({ text: row.sector, value: row.sector });
                    keep = keep || row.sector === me.sector;
                });

                me.syncing = true;
                field.setOptions(options);
                field.setValue(keep ? me.sector : 'all');
                me.syncing = false;
                me.sector = keep ? me.sector : 'all';
            }
        });
    },

    onSectorChange: function (field, value) {
        if (this.syncing || !value || value === this.sector) {
            return;
        }

        this.sector = value;
        this.reloadHoldings();
    },

    onGainChange: function (field, value) {
        if (!value || value === this.gain) {
            return;
        }

        this.gain = value;
        this.reloadHoldings();
    },

    onSearch: function (field) {
        var value = Ext.String.trim(field.getValue() || '');

        if (value === this.search) {
            return;
        }

        this.search = value;
        this.reloadHoldings();
    },

    /** Group by sector or portfolio (the server orders the rows by the group). */
    onGroupChange: function (group) {
        var me = this,
            store = me.getViewModel().getStore('holdings');

        if (!group || group === me.appliedGroup) {
            return;
        }

        me.appliedGroup = group;

        if (group === 'none') {
            store.clearGrouping();
        } else {
            store.group(group, 'ASC');
        }

        // The grouper is a request parameter: reload from the first page.
        if (me.loadedScope !== undefined && !store.isLoading()) {
            store.loadPage(1);
        }
    },

    // ---- transactions filters ------------------------------------------------------

    onTxTicker: function (field) {
        var value = Ext.String.trim(field.getValue() || '');

        if (value !== this.tx.ticker) {
            this.tx.ticker = value;
            this.reloadTransactions();
        }
    },

    onTxSide: function (field, value) {
        if (value && value !== this.tx.side) {
            this.tx.side = value;
            this.reloadTransactions();
        }
    },

    onTxFrom: function (field, value) {
        this.tx.from = value || null;
        this.reloadTransactions();
    },

    onTxTo: function (field, value) {
        this.tx.to = value || null;
        this.reloadTransactions();
    },

    onTabChange: function (tabs, item) {
        this.getViewModel().set('tab', item.initialConfig.title === 'Transactions' ? 'transactions' : 'holdings');
    },

    // ---- selection and detail panel --------------------------------------------------

    onSelectionChange: function (grid, records) {
        var me = this,
            record = records && records.length ? records[0] : null;

        if (me.suspendSelection) {
            return;
        }

        if (!record) {
            me.clearSelection();
            return;
        }

        me.selectedId = record.getId();
        me.showDetail(record);
    },

    clearSelection: function () {
        var me = this,
            vm = me.getViewModel();

        me.selectedId = null;
        vm.set({
            selection: null,
            company: null,
            recentRows: [],
            priceNote: ''
        });
        vm.getStore('prices').removeAll();
    },

    /** Show a position in the detail panel and load its company data, chart and trades. */
    showDetail: function (record) {
        var me = this,
            vm = me.getViewModel(),
            changed = !vm.get('selection') || vm.get('selection').get('company_id') !== record.get('company_id');

        vm.set('selection', record);

        if (changed) {
            vm.set('company', me.companyCache[record.get('company_id')] || null);
            me.loadCompany(record.get('company_id'));
            me.loadPrices();
        }

        me.loadRecent();
    },

    /** After a reload keep the same position selected, with its fresh server values. */
    restoreSelection: function () {
        var me = this,
            vm = me.getViewModel(),
            grid = me.lookup('holdingsGrid'),
            record = me.selectedId ? vm.getStore('holdings').getById(me.selectedId) : null;

        if (record) {
            grid.select(record, false, true);
            vm.set('selection', record);
        }
    },

    loadCompany: function (companyId) {
        var me = this,
            vm = me.getViewModel();

        if (me.companyCache[companyId]) {
            return;
        }

        FinApp.util.Api.request({
            path: '/companies',
            params: {
                limit: 1,
                tick: me.currentTick(),
                filter: Ext.encode([{ property: 'id', operator: '=', value: companyId }])
            },
            scope: me,
            success: function (rows) {
                var selection = vm.get('selection');

                if (me.destroyed || !rows.length) {
                    return;
                }

                me.companyCache[companyId] = rows[0];

                if (selection && selection.get('company_id') === companyId) {
                    vm.set('company', rows[0]);
                }
            },
            failure: function (error) {
                FinApp.util.Api.notifyError(error);
            }
        });
    },

    /** Price series of the selected company, pinned to the current tick. */
    loadPrices: function () {
        var me = this,
            vm = me.getViewModel(),
            selection = vm.get('selection'),
            tick = me.currentTick(),
            store = vm.getStore('prices'),
            proxy;

        if (me.destroyed || !selection || tick === null || tick === undefined) {
            return;
        }

        proxy = store.getProxy();
        proxy.setUrl(FinApp.util.Api.url('/companies/' + selection.get('company_id') + '/prices'));
        proxy.setExtraParams({
            range: vm.get('priceRange'),
            tick: tick
        });

        store.load({
            callback: function (records, operation, success) {
                if (success && !me.destroyed) {
                    me.applyPrices();
                }
            }
        });
    },

    /** Fit the price axis to the data so changes are visible, and note the time scale. */
    applyPrices: function () {
        var me = this,
            vm = me.getViewModel(),
            store = vm.getStore('prices'),
            chart = me.lookup('priceChart'),
            axes = chart ? chart.getAxes() : [],
            raw = store.getProxy().getReader().rawData,
            min = Infinity,
            max = -Infinity,
            pad,
            days;

        store.each(function (record) {
            var value = record.get('price');

            min = Math.min(min, value);
            max = Math.max(max, value);
        });

        if (store.getCount() > 0 && axes.length > 0) {
            pad = (max - min) * 0.12 || max * 0.02 || 1;
            axes[0].setMinimum(Math.max(0, min - pad));
            axes[0].setMaximum(max + pad);
        }

        days = raw && raw.meta ? raw.meta.simulatedSpanDays : null;
        vm.set('priceNote', Ext.isNumber(days) ?
            'Simulated time (UTC) • ' + Math.round(days) + ' simulated days' :
            'Simulated time (UTC)');
    },

    /** The five latest trades of the selected position (same portfolio and company). */
    loadRecent: function () {
        var me = this,
            vm = me.getViewModel(),
            selection = vm.get('selection'),
            store = vm.getStore('recent');

        if (me.destroyed || !selection) {
            return;
        }

        store.getProxy().setExtraParams({
            portfolioId: String(selection.get('portfolio_id')),
            filter: Ext.encode([{ property: 'company_id', operator: '=', value: selection.get('company_id') }])
        });

        store.loadPage(1, {
            callback: function (records, operation, success) {
                var F = FinApp.util.Format;

                if (!success || me.destroyed) {
                    return;
                }

                vm.set('recentRows', Ext.Array.map(records, function (r) {
                    return {
                        side: r.get('trade_type'),
                        sideKey: r.get('trade_type') === 'BUY' ? 'buy' : 'sell',
                        quantity: F.integer(r.get('quantity')),
                        price: F.usd(r.get('execution_price')),
                        date: F.utcDateTime(r.get('executed_at')).replace(' UTC', '')
                    };
                }));
            }
        });
    },

    // ---- trading --------------------------------------------------------------------

    onBuy: function () {
        this.openTrade('BUY');
    },

    onSell: function () {
        this.openTrade('SELL');
    },

    onRowDoubleTap: function (grid, location) {
        // Double tap is a convenience; the Buy / Sell buttons are the accessible path.
        if (location && location.record) {
            this.openTrade('BUY', location.record);
        }
    },

    openTrade: function (type, record) {
        var vm = this.getViewModel(),
            portfolios = this.portfoliosStore(),
            position = record || vm.get('selection'),
            scope = vm.get('portfolioId'),
            options = [],
            portfolioId = null;

        if (!portfolios || portfolios.getCount() === 0) {
            Ext.toast('The portfolios are not loaded yet. Try again in a moment.', 3000);
            return;
        }

        Ext.Array.each(portfolios.getRange(), function (p) {
            options.push({
                id: p.get('id'),
                name: p.get('name'),
                cash_balance: p.get('cash_balance')
            });
        });

        if (position) {
            portfolioId = position.get('portfolio_id');
        } else if (scope !== 'all') {
            portfolioId = scope;
        } else {
            portfolioId = options[0].id;
        }

        Ext.create('FinApp.view.holdings.TradeDialog', {
            tradeType: type,
            initialPortfolioId: portfolioId,
            initialCompanyId: position ? position.get('company_id') : null,
            portfolioOptions: options
        }).show();
    },

    // ---- export ------------------------------------------------------------------------

    /**
     * CSV fallback (the Exporter package is not installed). The server builds the file
     * from the SAME portfolio, filter, search, sort and group as the grid, for all
     * matching rows. A plain navigation downloads it (the response is an attachment).
     */
    onExport: function () {
        var me = this,
            store = me.getViewModel().getStore('holdings'),
            tick = me.currentTick(),
            params = me.holdingsParams(tick),
            sorters = Ext.Array.map(store.getSorters().getRange(), function (s) {
                return { property: s.getProperty(), direction: s.getDirection() };
            }),
            grouper = store.getGrouper();

        if (sorters.length) {
            params.sort = Ext.encode(sorters);
        }
        if (grouper) {
            params.group = grouper.getProperty();
            params.groupDir = grouper.getDirection();
        }

        window.location.assign(FinApp.util.Api.url('/exports/holdings.csv') + '?' + Ext.Object.toQueryString(params));
    }
});

/**
 * Controller of the Portfolio Dashboard.
 *
 * Data flow (all values come from the API, nothing is calculated here):
 *   GET /api/dashboard           KPIs, top/bottom five, portfolio summary (record)
 *   GET /api/portfolio-history   value series for the chart (store)
 *   GET /api/sector-allocation   donut chart (store)
 *
 * Coherence: the three requests are pinned to ONE simulated snapshot with the same
 * `tick` parameter (the latest tick reported by /api/simulation/status), so the
 * KPIs, the chart's last point and the allocation always reconcile.
 *
 * Refresh: reloads when the shell announces a new tick (piqsnapshot), when the
 * selected portfolio or the range changes, and when the screen is shown again.
 * Requests are coalesced (never overlap); a refresh of the same scope is silent
 * (no mask) so the screen does not flicker every 5 seconds.
 */
Ext.define('FinApp.view.dashboard.DashboardController', {
    extend: 'Ext.app.ViewController',

    alias: 'controller.dashboard',

    requires: [
        'FinApp.util.Api',
        'FinApp.util.Format',
        'FinApp.util.Palette'
    ],

    init: function () {
        var me = this,
            vm = me.getViewModel();

        Ext.on('piqsnapshot', me.onSnapshot, me);
        Ext.on('piqtrade', me.onTrade, me);

        // Fire whenever the shared portfolio selection, the range or the visible
        // screen changes (and once at start).
        vm.bind('{portfolioId}', me.refresh, me);
        vm.bind('{range}', me.refresh, me);
        vm.bind('{activeScreen}', me.refresh, me);
    },

    destroy: function () {
        Ext.un('piqsnapshot', this.onSnapshot, this);
        Ext.un('piqtrade', this.onTrade, this);
        this.callParent();
    },

    /**
     * A simulated trade was executed: the KPIs, chart and allocation of the SAME tick
     * changed, so forget what is shown and reload (now, or when the screen is next shown).
     */
    onTrade: function (trade) {
        // The trade executed at the server's latest tick: never show an older snapshot
        // (it would not include the trade yet).
        if (trade && Ext.isNumber(trade.tick_index) &&
            (!Ext.isNumber(this.latestTick) || trade.tick_index > this.latestTick)) {
            this.latestTick = trade.tick_index;
        }

        this.loadedTick = null;
        this.loadedKey = null;
        this.refresh();
    },

    // ---- triggers -----------------------------------------------------------

    onSnapshot: function (snapshot) {
        // The event carries the newest tick; use it directly instead of waiting for
        // the shared view model value to propagate into this view model.
        // Ticks only move forward (a slow status response must not move us back).
        if (snapshot && Ext.isNumber(snapshot.tickIndex) &&
            (!Ext.isNumber(this.latestTick) || snapshot.tickIndex > this.latestTick)) {
            this.latestTick = snapshot.tickIndex;
        }

        this.refresh();
    },

    onRetry: function () {
        this.refresh();
    },

    // ---- loading -----------------------------------------------------------------

    refresh: function () {
        var me = this,
            vm = me.getViewModel(),
            tick = Ext.isNumber(me.latestTick) ? me.latestTick : vm.get('tickIndex'),
            scope = String(vm.get('portfolioId')),
            range = vm.get('range'),
            key = scope + '|' + range,
            params;

        // Nothing to do before the first snapshot, or while another screen is shown.
        if (me.destroyed || tick === null || tick === undefined || vm.get('activeScreen') !== 'dashboard') {
            return;
        }

        if (me.loading) {
            me.pending = true;
            return;
        }

        // Same snapshot and scope already shown: nothing new to fetch.
        if (tick === me.loadedTick && key === me.loadedKey && vm.get('state') === 'ready') {
            return;
        }

        me.loading = true;
        me.failures = [];
        me.remaining = 3;
        me.requestedTick = tick;
        me.requestedKey = key;
        me.dashboard = null;

        // Mask only when the scope changed (or on the very first load).
        if (key !== me.loadedKey) {
            vm.set('state', 'loading');
        }

        params = {
            portfolioId: scope,
            range: range,
            tick: tick
        };

        FinApp.util.Api.request({
            path: '/dashboard',
            params: params,
            scope: me,
            success: me.onDashboardLoaded,
            failure: me.onRequestFailed,
            callback: me.onRequestDone
        });

        me.loadStore(vm.getStore('history'), params);
        me.loadStore(vm.getStore('sectors'), params);
    },

    loadStore: function (store, params) {
        var me = this;

        store.getProxy().setExtraParams(params);
        store.load({
            callback: function (records, operation, success) {
                if (!success) {
                    me.onRequestFailed(FinApp.util.Api.toError(operation.getError() && operation.getError().response));
                }
                me.onRequestDone();
            }
        });
    },

    onDashboardLoaded: function (data, envelope) {
        this.dashboard = {
            data: data,
            asOf: envelope.meta.asOf
        };
    },

    onRequestFailed: function (error) {
        this.failures.push(error.message);
    },

    onRequestDone: function () {
        var me = this;

        if (me.destroyed) {
            return;
        }

        me.remaining -= 1;
        if (me.remaining === 0) {
            me.finishLoad();
        }
    },

    /** All three requests answered: apply them together so the screen is coherent. */
    finishLoad: function () {
        var me = this,
            vm = me.getViewModel();

        me.loading = false;

        if (me.failures.length || !me.dashboard) {
            vm.set({
                state: 'error',
                errorMessage: me.failures[0] || 'The API returned an unexpected response.'
            });
        } else {
            me.applyDashboard(me.dashboard.data, me.dashboard.asOf);
            me.applyHistory();
            me.applySectors();
            me.loadedTick = me.requestedTick;
            me.loadedKey = me.requestedKey;
            vm.set({
                state: 'ready',
                errorMessage: ''
            });
        }

        // A change arrived while loading: run once more with the newest state.
        if (me.pending) {
            me.pending = false;
            me.refresh();
        }
    },

    // ---- applying data -------------------------------------------------------

    applyDashboard: function (data, asOf) {
        var me = this;

        me.getViewModel().set({
            scopeName: data.scope.name,
            dataAsOf: asOf,
            kpis: data.kpis,
            definitions: data.definitions,
            topRows: me.performerRows(data.top_performers),
            bottomRows: me.performerRows(data.bottom_performers),
            summaryRows: me.summaryRows(data.portfolio_summary)
        });
    },

    performerRows: function (list) {
        var F = FinApp.util.Format;

        return Ext.Array.map(list || [], function (r) {
            return {
                symbol: r.symbol,
                company: r.company,
                ret: F.signedPct(r.unrealized_pl_pct),
                arrow: F.arrow(r.unrealized_pl_pct),
                cls: F.pnlCls(r.unrealized_pl_pct),
                price: F.usd(r.current_price),
                pl: F.signedUsd(r.unrealized_pl)
            };
        });
    },

    summaryRows: function (list) {
        var F = FinApp.util.Format;

        return Ext.Array.map(list || [], function (r) {
            return {
                name: r.name,
                value: F.usd(r.portfolio_value),
                pl: F.signedUsd(r.total_gain_loss),
                plCls: F.pnlCls(r.total_gain_loss),
                plArrow: F.arrow(r.total_gain_loss),
                ret: F.signedPct(r.total_gain_loss_pct),
                daily: F.signedUsd(r.daily_change),
                dailyCls: F.pnlCls(r.daily_change),
                dailyArrow: F.arrow(r.daily_change),
                allocation: F.pct(r.allocation_pct),
                cash: F.usd(r.cash_balance)
            };
        });
    },

    /** Fit the value axis to the data so changes are visible, and note the time scale. */
    applyHistory: function () {
        var me = this,
            vm = me.getViewModel(),
            store = vm.getStore('history'),
            axes = me.lookup('perfChart').getAxes(),
            raw = store.getProxy().getReader().rawData,
            min = Infinity,
            max = -Infinity,
            pad,
            days;

        store.each(function (record) {
            var value = record.get('portfolio_value');

            min = Math.min(min, value);
            max = Math.max(max, value);
        });

        if (store.getCount() > 0 && axes.length > 0) {
            pad = (max - min) * 0.12 || max * 0.02 || 1;
            axes[0].setMinimum(Math.max(0, min - pad));
            axes[0].setMaximum(max + pad);
        }

        days = raw && raw.meta ? raw.meta.simulatedSpanDays : null;
        vm.set('rangeNote', Ext.isNumber(days) ?
            'Simulated time (UTC) • ' + Math.round(days) + ' simulated days' :
            'Simulated time (UTC)');
    },

    /** Legend rows (colour, sector, percentage) that match the donut slices. */
    applySectors: function () {
        var me = this,
            F = FinApp.util.Format,
            store = me.getViewModel().getStore('sectors'),
            chart = me.lookup('sectorChart'),
            rows = [];

        chart.setColors(FinApp.util.Palette.sectors);

        store.each(function (record, index) {
            rows.push({
                sector: record.get('sector'),
                pct: F.pct(record.get('allocation_pct')),
                value: F.usd(record.get('market_value')),
                color: FinApp.util.Palette.sector(index)
            });
        });

        me.getViewModel().set('sectorLegend', rows);
    }
});

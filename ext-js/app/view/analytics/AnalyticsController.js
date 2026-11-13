/**
 * Controller of Portfolio Analytics.
 *
 * Data (all from the REST API, nothing calculated here):
 *   GET /api/analytics/pivot               one row per position: the source of the pivot grid,
 *                                          whose local matrix groups (Sector -> Company by
 *                                          Portfolio) and sums them in whole cents
 *   GET /api/analytics/comparison          normalized series (start of range = 100) for every
 *                                          portfolio and the simulated benchmarks
 *   GET /api/analytics/sector-comparison   equity by sector for every portfolio
 *
 * Coherence: the three requests of one refresh carry the same `tick`. The series of both
 * charts and the pivot columns are built from the server's meta (which portfolios and
 * benchmarks exist), never hard-coded.
 *
 * Refresh: on a new tick (piqsnapshot), when the portfolio selection or the range changes,
 * after a trade (piqtrade) and when the screen is shown. Switching the sector mode or the
 * benchmarks only re-renders what is already loaded. Requests are coalesced; a
 * refresh of the same scope is silent (no mask).
 */
Ext.define('FinApp.view.analytics.AnalyticsController', {
    extend: 'Ext.app.ViewController',

    alias: 'controller.analytics',

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

        vm.bind('{portfolioId}', me.refresh, me);
        vm.bind('{range}', me.refresh, me);
        vm.bind('{activeScreen}', me.refresh, me);

        // Client-side re-renders of data that is already loaded.
        vm.bind('{sectorMode}', me.onSectorModeChange, me);
        vm.bind('{benchmarks}', me.onBenchmarksChange, me);
    },

    destroy: function () {
        var me = this;

        Ext.un('piqsnapshot', me.onSnapshot, me);
        Ext.un('piqtrade', me.onTrade, me);
        me.callParent();
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

    /** A trade changed positions and cash: never show an older snapshot than the trade's tick. */
    onTrade: function (trade) {
        if (trade && Ext.isNumber(trade.tick_index) &&
            (!Ext.isNumber(this.latestTick) || trade.tick_index > this.latestTick)) {
            this.latestTick = trade.tick_index;
        }

        this.loadedTick = null;
        this.loadedKey = null;
        this.refresh();
    },

    onRetry: function () {
        this.loadedKey = null;
        this.refresh();
    },

    // ---- loading -------------------------------------------------------------------

    refresh: function () {
        var me = this,
            vm = me.getViewModel(),
            tick = Ext.isNumber(me.latestTick) ? me.latestTick : vm.get('tickIndex'),
            scope = String(vm.get('portfolioId')),
            range = vm.get('range'),
            key = scope + '|' + range;

        // Nothing to do before the first snapshot, or while another screen is shown.
        if (me.destroyed || tick === null || tick === undefined || vm.get('activeScreen') !== 'analytics') {
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

        // Mask only when the scope changed (or on the very first load).
        if (key !== me.loadedKey) {
            vm.set('state', 'loading');
        }

        me.loadStore(me.pivotStore(), {
            portfolioId: scope,
            tick: tick
        });
        me.loadStore(vm.getStore('comparison'), {
            range: range,
            tick: tick
        });
        me.loadStore(vm.getStore('sectors'), {
            tick: tick
        });
    },

    loadStore: function (store, params) {
        var me = this;

        store.getProxy().setExtraParams(params);
        store.load({
            callback: function (records, operation, success) {
                if (!success) {
                    me.failures.push(FinApp.util.Api.toError(
                        operation.getError() && operation.getError().response).message);
                }
                me.onRequestDone();
            }
        });
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

        if (me.failures.length) {
            vm.set({
                state: 'error',
                errorMessage: me.failures[0]
            });
        } else {
            me.applyPivot();
            me.applyComparison();
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

    // ---- pivot grid --------------------------------------------------------------------

    /**
     * The store behind the pivot grid: its local matrix owns it. Loading it (with the portfolio
     * and tick as parameters) makes the matrix group and sum the rows again.
     */
    pivotStore: function () {
        var matrix = this.lookup('pivotGrid').getMatrix();

        return matrix ? matrix.store : null;
    },

    /**
     * Collapsed row groups survive the refresh: every reload makes the pivot rebuild its axes
     * (all groups expanded), so the collapsed groups are remembered by name path and collapsed
     * again when the matrix has finished.
     */
    initPivot: function () {
        var me = this,
            grid = me.lookup('pivotGrid');

        if (me.collapsedRows) {
            return;
        }

        me.collapsedRows = {};

        if (grid) {
            grid.on({
                pivotgroupexpand: me.onPivotGroupToggle,
                pivotgroupcollapse: me.onPivotGroupToggle,
                pivotdone: me.onPivotDone,
                scope: me
            });
        }
    },

    /** Visit every row group (an item with children) of the left axis with its name path. */
    eachRowGroup: function (fn) {
        var grid = this.lookup('pivotGrid'),
            matrix = grid ? grid.getMatrix() : null,
            visit;

        if (!matrix || !matrix.leftAxis) {
            return;
        }

        visit = function (items, prefix) {
            Ext.Array.each(items || [], function (item) {
                var path = prefix + '/' + item.name;

                if (item.children && item.children.length) {
                    fn(item, path);
                    visit(item.children, path);
                }
            });
        };

        visit(matrix.leftAxis.getTree(), '');
    },

    onPivotGroupToggle: function (matrix, type, group) {
        var me = this;

        if (me.restoringPivot || type !== 'row' || !group) {
            return;
        }

        me.eachRowGroup(function (item, path) {
            if (item === group) {
                if (group.expanded) {
                    delete me.collapsedRows[path];
                } else {
                    me.collapsedRows[path] = true;
                }
            }
        });
    },

    onPivotDone: function () {
        var me = this;

        if (me.restoringPivot || me.destroyed) {
            return;
        }

        me.restoringPivot = true;

        me.eachRowGroup(function (item, path) {
            if (me.collapsedRows[path] && item.expanded) {
                item.collapse();
            }
        });

        me.restoringPivot = false;
    },

    applyPivot: function () {
        var me = this,
            store = me.pivotStore();

        // The grid exists now: start remembering collapsed groups.
        me.initPivot();

        me.getViewModel().set('pivotCount', store ? store.getCount() : 0);
    },

    /** Rearrange rows, columns and measures (the Configurator plugin's panel). */
    onConfigure: function () {
        var grid = this.lookup('pivotGrid');

        if (grid && Ext.isFunction(grid.showConfigurator)) {
            grid.showConfigurator();
        }
    },

    onExportXlsx: function () {
        this.exportPivot('xlsx', 'xlsx');
    },

    onExportCsv: function () {
        this.exportPivot('csv', 'csv');
    },

    /**
     * Export the pivot as it is shown, with the Exporter package (Excel or CSV). The file is
     * built in the browser from the current layout (including the configurator's changes).
     */
    exportPivot: function (type, extension) {
        var me = this,
            grid = me.lookup('pivotGrid'),
            promise;

        if (!grid || !Ext.isFunction(grid.saveDocumentAs)) {
            return;
        }

        promise = grid.saveDocumentAs({
            type: type,
            title: 'PortfolioIQ pivot (simulated data)',
            fileName: 'portfolioiq-pivot.' + extension
        });

        if (promise && Ext.isFunction(promise.then)) {
            promise.then(null, function () {
                if (!me.destroyed) {
                    Ext.toast('The pivot could not be exported.', 4000);
                }
            });
        }
    },

    // ---- normalized performance comparison ---------------------------------------------

    applyComparison: function () {
        var me = this,
            vm = me.getViewModel(),
            raw = vm.getStore('comparison').getProxy().getReader().rawData,
            meta = raw && raw.meta ? raw.meta : null,
            days = meta ? meta.simulatedSpanDays : null;

        me.comparisonSeries = meta && meta.series ? meta.series : [];

        vm.set({
            rangeNote: Ext.isNumber(days) ?
                'Simulated time (UTC) • ' + Math.round(days) + ' simulated days' :
                'Simulated time (UTC)',
            comparisonNote: meta && meta.note ? Ext.String.htmlEncode(meta.note) : ''
        });

        me.buildComparison();
    },

    onBenchmarksChange: function () {
        if (this.comparisonSeries && !this.destroyed) {
            this.buildComparison();
        }
    },

    /** One line per portfolio (solid) and per benchmark (dashed), colours matching the legend. */
    buildComparison: function () {
        var me = this,
            vm = me.getViewModel(),
            F = FinApp.util.Format,
            P = FinApp.util.Palette,
            store = vm.getStore('comparison'),
            chart = me.lookup('comparisonChart'),
            showBenchmarks = vm.get('benchmarks') === 'on',
            portfolioIndex = 0,
            benchmarkIndex = 0,
            configs = [],
            legend = [],
            last = store.getCount() > 0 ? store.getAt(store.getCount() - 1) : null,
            axes = chart.getAxes(),
            min = Infinity,
            max = -Infinity,
            pad;

        Ext.Array.each(me.comparisonSeries, function (s) {
            var isBenchmark = s.type === 'BENCHMARK',
                color = isBenchmark ? P.benchmark(benchmarkIndex++) : P.sector(portfolioIndex++);

            if (isBenchmark && !showBenchmarks) {
                return;
            }

            configs.push(me.lineConfig(s, color, isBenchmark));
            legend.push({
                name: s.name,
                color: color,
                last: last ? F.index(last.get(s.key)) : F.EMPTY
            });

            store.each(function (record) {
                var value = record.get(s.key);

                if (Ext.isNumber(value)) {
                    min = Math.min(min, value);
                    max = Math.max(max, value);
                }
            });
        });

        chart.setSeries(configs);

        // Fit the axis to the visible lines so differences are readable (the base is 100).
        if (axes.length > 0 && min <= max) {
            pad = (max - min) * 0.1 || 2;
            axes[0].setMinimum(min - pad);
            axes[0].setMaximum(max + pad);
        }

        vm.set('comparisonLegend', legend);
    },

    lineConfig: function (series, color, isBenchmark) {
        var key = series.key,
            name = series.name;

        return {
            type: 'line',
            xField: 'ts',
            yField: key,
            title: name,
            style: {
                stroke: color,
                lineWidth: isBenchmark ? 1.5 : 2,
                lineDash: isBenchmark ? [6, 4] : []
            },
            marker: {
                type: 'circle',
                radius: 4,
                lineWidth: 2,
                fill: '#ffffff',
                stroke: color,
                opacity: 0,
                scaling: 0.01
            },
            highlight: {
                opacity: 1,
                scaling: 1.4
            },
            tooltip: {
                trackMouse: true,
                renderer: function (tooltip, record) {
                    var F = FinApp.util.Format;

                    tooltip.setHtml(
                        Ext.String.htmlEncode(F.utcFormat(record.get('ts'), 'Y-m-d H:i')) + ' UTC<br><b>' +
                        Ext.String.htmlEncode(name) + '</b><br>Index ' +
                        Ext.String.htmlEncode(F.index(record.get(key))) + ' (start = 100)'
                    );
                }
            }
        };
    },

    // ---- sector exposure ------------------------------------------------------------------

    applySectors: function () {
        this.buildSectorChart();
    },

    onSectorModeChange: function () {
        var me = this;

        if (!me.destroyed && me.getViewModel().getStore('sectors').getCount() > 0) {
            me.buildSectorChart();
        }
    },

    /** A grouped column per portfolio and sector: % of the portfolio's equity, or market value. */
    buildSectorChart: function () {
        var me = this,
            vm = me.getViewModel(),
            F = FinApp.util.Format,
            P = FinApp.util.Palette,
            store = vm.getStore('sectors'),
            chart = me.lookup('sectorChart'),
            raw = store.getProxy().getReader().rawData,
            portfolios = raw && raw.meta && raw.meta.portfolios ? raw.meta.portfolios : [],
            mode = vm.get('sectorMode'),
            axes = chart.getAxes(),
            fields = [],
            titles = [],
            legend = [],
            colors = [],
            nameByField = {};

        Ext.Array.each(portfolios, function (p, index) {
            var field = mode === 'pct' ? p.pct_key : p.key;

            fields.push(field);
            titles.push(p.name);
            nameByField[field] = p.name;
            legend.push({ name: p.name, color: P.sector(index) });
            colors.push(P.sector(index));
        });

        chart.setSeries(fields.length === 0 ? [] : [{
            type: 'bar',
            xField: 'sector',
            yField: fields,
            title: titles,
            stacked: false,
            highlight: true,
            // One colour per yField, the same as the legend (the theme palette would differ).
            subStyle: {
                fill: colors,
                stroke: colors
            },
            tooltip: {
                trackMouse: true,
                renderer: function (tooltip, record, item) {
                    var field = item && item.field,
                        value = record.get(field);

                    tooltip.setHtml(
                        '<b>' + Ext.String.htmlEncode(record.get('sector')) + '</b><br>' +
                        Ext.String.htmlEncode(nameByField[field] || '') + ': ' +
                        Ext.String.htmlEncode(mode === 'pct' ? F.pct(value) : F.usd(value))
                    );
                }
            }
        }]);

        if (axes.length > 0) {
            axes[0].setRenderer(function (axis, label) {
                return mode === 'pct' ? label + '%' : F.compactUsd(label);
            });
        }

        vm.set('sectorLegend', legend);
    }
});

/**
 * Controller of Portfolio Analytics.
 *
 * Data (all from the REST API, nothing calculated here):
 *   GET /api/analytics/pivot?layout=wide   rows Sector -> Company, a column per portfolio and
 *                                          measure; meta.groups (sector subtotals) and
 *                                          meta.grand (grand total) are summed by the server
 *   GET /api/analytics/comparison          normalized series (start of range = 100) for every
 *                                          portfolio and the simulated benchmarks
 *   GET /api/analytics/sector-comparison   equity by sector for every portfolio
 *   GET /api/exports/pivot.csv             CSV fallback (the Exporter package is not installed)
 *
 * Coherence: the three requests of one refresh carry the same `tick`. The series of both
 * charts and the pivot columns are built from the server's meta (which portfolios and
 * benchmarks exist), never hard-coded.
 *
 * Refresh: on a new tick (piqsnapshot), when the portfolio selection or the range changes,
 * after a trade (piqtrade) and when the screen is shown. Switching the measure, the sector
 * mode or the benchmarks only re-renders what is already loaded. Requests are coalesced; a
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
        vm.bind('{measure}', me.onMeasureChange, me);
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

        me.loadStore(vm.getStore('pivot'), {
            portfolioId: scope,
            layout: 'wide',
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

    // ---- pivot (grouped aggregation fallback) -----------------------------------------

    applyPivot: function () {
        var me = this,
            vm = me.getViewModel(),
            store = vm.getStore('pivot'),
            raw = store.getProxy().getReader().rawData;

        me.pivotMeta = raw && raw.meta ? raw.meta : null;
        vm.set('pivotCount', store.getCount());
        store.piqMeasure = vm.get('measure');
        me.buildPivotColumns();
        me.buildGrandRows();
    },

    /** The columns depend on the portfolios in the data and on the selected measure. */
    buildPivotColumns: function () {
        var me = this,
            meta = me.pivotMeta,
            measure = me.getViewModel().get('measure'),
            columns;

        if (!meta) {
            return;
        }

        columns = [{
            text: 'Company',
            dataIndex: 'company',
            flex: 2,
            minWidth: 220
        }, {
            text: 'Ticker',
            dataIndex: 'symbol',
            width: 90,
            cell: {
                userCls: 'piq-ticker'
            }
        }];

        Ext.Array.each(meta.portfolios, function (p) {
            columns.push(me.measureColumn(p.name, p.key + '_' + measure, measure, false));
        });
        columns.push(me.measureColumn('Total', 'total_' + measure, measure, true));

        me.lookup('pivotGrid').setColumns(columns);
    },

    measureColumn: function (text, dataIndex, measure, isTotal) {
        return {
            text: text,
            dataIndex: dataIndex,
            width: 150,
            align: 'right',
            cell: {
                encodeHtml: false,
                userCls: isTotal ? 'piq-total-cell' : ''
            },
            renderer: function (value) {
                var F = FinApp.util.Format;

                return '<span class="' + F.measureCls(measure, value) + '">' +
                    Ext.String.htmlEncode(F.measure(measure, value)) + '</span>';
            }
        };
    },

    /** Grand total strip below the grid (server-calculated). */
    buildGrandRows: function () {
        var me = this,
            F = FinApp.util.Format,
            meta = me.pivotMeta,
            measure = me.getViewModel().get('measure'),
            rows = [],
            v;

        if (meta && meta.grand) {
            Ext.Array.each(meta.portfolios, function (p) {
                v = meta.grand[p.key + '_' + measure];
                rows.push({ label: p.name, value: F.measure(measure, v), cls: F.measureCls(measure, v) });
            });
            v = meta.grand['total_' + measure];
            rows.push({ label: 'Total', value: F.measure(measure, v), cls: F.measureCls(measure, v) });
        }

        me.getViewModel().set('grandRows', rows);
    },

    onMeasureChange: function (measure) {
        var me = this,
            grid = me.lookup('pivotGrid'),
            store = me.getViewModel().getStore('pivot');

        if (!me.pivotMeta || me.destroyed) {
            return;
        }

        store.piqMeasure = measure;
        me.buildPivotColumns();
        me.buildGrandRows();

        // Group headers read the measure when they are rendered.
        if (grid && Ext.isFunction(grid.refresh)) {
            grid.refresh();
        }
    },

    /** CSV fallback: the server builds the file for the same portfolio and tick. */
    onExport: function () {
        var me = this,
            vm = me.getViewModel(),
            tick = Ext.isNumber(me.latestTick) ? me.latestTick : vm.get('tickIndex'),
            params = { portfolioId: String(vm.get('portfolioId')) };

        if (tick !== null && tick !== undefined) {
            params.tick = tick;
        }

        // A plain navigation downloads the file (the response is an attachment).
        window.location.assign(FinApp.util.Api.url('/exports/pivot.csv') + '?' + Ext.Object.toQueryString(params));
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
            id: 'cmp-' + key,
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
            id: 'sector-' + mode,
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

/**
 * Portfolio Analytics (CLAUDE.md section 3.3).
 *
 *   header
 *   [error banner with Retry]
 *   Portfolio performance comparison (normalized, start = 100)  |  Sector exposure by portfolio
 *   Pivot (fallback): Sector -> Company, columns by Portfolio, measure switch, CSV export
 *
 * The Pivot Grid and Exporter packages are NOT installed in this SDK, so the pivot is a
 * functional grouped aggregation grid (Ext.grid.Grid grouped by sector) with the visible
 * notice required by the specification. Subtotals and totals are calculated by the server
 * in exact cents; the browser only formats them. The charts are Ext.chart cartesian charts
 * whose series are built from the server's meta (which portfolios and benchmarks exist).
 */
Ext.define('FinApp.view.analytics.AnalyticsView', {
    extend: 'Ext.Container',
    xtype: 'analytics-view',

    requires: [
        'Ext.grid.Grid',
        'Ext.grid.RowHeader',
        'Ext.SegmentedButton',
        'Ext.LoadMask',
        'Ext.chart.CartesianChart',
        'Ext.chart.axis.Numeric',
        'Ext.chart.axis.Time',
        'Ext.chart.axis.Category',
        'Ext.chart.series.Line',
        'Ext.chart.series.Bar',
        'Ext.chart.interactions.ItemHighlight',
        'FinApp.util.Format',
        'FinApp.view.analytics.AnalyticsController',
        'FinApp.view.analytics.AnalyticsModel'
    ],

    controller: 'analytics',
    viewModel: {
        type: 'analytics'
    },

    cls: 'piq-view piq-analytics',
    scrollable: 'y',

    bind: {
        masked: '{loadMask}'
    },

    items: [{
        // ---- header --------------------------------------------------------
        xtype: 'component',
        html: '<div class="piq-view-title">Portfolio Analytics</div>' +
            '<div class="piq-view-sub">Compare portfolios, sector exposure and positions • ' +
            'Simulated data • The pivot follows the selected portfolio; the charts compare all portfolios</div>'
    }, {
        // ---- error banner (last data stays visible) -----------------------
        xtype: 'container',
        cls: 'piq-banner-error piq-dash-banner',
        hidden: true,
        bind: {
            hidden: '{!hasError}'
        },
        layout: {
            type: 'hbox',
            align: 'center'
        },
        items: [{
            xtype: 'component',
            flex: 1,
            bind: {
                html: '{errorHtml}'
            }
        }, {
            xtype: 'button',
            text: 'Retry',
            iconCls: 'x-fa fa-arrows-rotate',
            userCls: 'piq-retry',
            listeners: {
                tap: 'onRetry'
            }
        }]
    }, {
        // ---- row: performance comparison + sector exposure ----------------
        xtype: 'container',
        cls: 'piq-dash-row',
        layout: {
            type: 'hbox',
            align: 'stretch',
            wrap: true
        },
        items: [{
            xtype: 'container',
            cls: 'piq-card piq-dash-card',
            flex: 3,
            minWidth: 480,
            layout: {
                type: 'vbox',
                align: 'stretch'
            },
            items: [{
                xtype: 'container',
                layout: {
                    type: 'hbox',
                    align: 'center',
                    wrap: true
                },
                items: [{
                    xtype: 'component',
                    flex: 1,
                    minWidth: 220,
                    bind: {
                        html: '{comparisonSubHtml}'
                    }
                }, {
                    xtype: 'segmentedbutton',
                    cls: 'piq-range',
                    bind: '{benchmarks}',
                    items: [
                        { text: 'With benchmarks', value: 'on' },
                        { text: 'Portfolios only', value: 'off' }
                    ]
                }, {
                    xtype: 'segmentedbutton',
                    cls: 'piq-range',
                    bind: '{range}',
                    items: [
                        { text: '1M', value: '1M' },
                        { text: '3M', value: '3M' },
                        { text: '6M', value: '6M' },
                        { text: '1Y', value: '1Y' },
                        { text: 'All', value: 'ALL' }
                    ]
                }]
            }, {
                xtype: 'cartesian',
                reference: 'comparisonChart',
                flex: 1,
                minHeight: 320,
                insetPadding: {
                    top: 16,
                    right: 16,
                    bottom: 8,
                    left: 8
                },
                animation: false,
                interactions: ['itemhighlight'],
                bind: {
                    store: '{comparison}'
                },
                axes: [{
                    type: 'numeric',
                    position: 'left',
                    grid: true,
                    renderer: function (axis, label) {
                        return FinApp.util.Format.index(label);
                    }
                }, {
                    type: 'time',
                    position: 'bottom',
                    fields: ['ts'],
                    renderer: function (axis, label) {
                        var vm = axis.getChart().lookupViewModel(),
                            range = vm ? vm.get('range') : '1Y',
                            format = (range === '1M' || range === '3M') ? 'M j' : 'M Y';

                        return FinApp.util.Format.utcFormat(label, format);
                    }
                }]
                // series are created by the controller from the server's meta.series
            }, {
                xtype: 'component',
                cls: 'piq-legend piq-legend-inline',
                bind: {
                    data: '{comparisonLegendCard}'
                },
                tpl: [
                    '<tpl for="rows">',
                    '<span class="piq-legend-item">',
                    '<span class="piq-dot" style="background:{color}"></span>{name:htmlEncode}',
                    ' <b>{last:htmlEncode}</b>',
                    '</span>',
                    '</tpl>'
                ]
            }, {
                xtype: 'component',
                cls: 'piq-footnote',
                bind: {
                    html: '{comparisonNote}'
                }
            }]
        }, {
            xtype: 'container',
            cls: 'piq-card piq-dash-card',
            flex: 2,
            minWidth: 380,
            layout: {
                type: 'vbox',
                align: 'stretch'
            },
            items: [{
                xtype: 'container',
                layout: {
                    type: 'hbox',
                    align: 'center',
                    wrap: true
                },
                items: [{
                    xtype: 'component',
                    flex: 1,
                    minWidth: 200,
                    bind: {
                        html: '{sectorSubHtml}'
                    }
                }, {
                    xtype: 'segmentedbutton',
                    cls: 'piq-range',
                    bind: '{sectorMode}',
                    items: [
                        { text: '% of portfolio', value: 'pct' },
                        { text: 'Market value', value: 'value' }
                    ]
                }]
            }, {
                xtype: 'cartesian',
                reference: 'sectorChart',
                flex: 1,
                minHeight: 320,
                insetPadding: {
                    top: 16,
                    right: 12,
                    bottom: 8,
                    left: 8
                },
                animation: false,
                interactions: ['itemhighlight'],
                bind: {
                    store: '{sectors}'
                },
                axes: [{
                    type: 'numeric',
                    position: 'left',
                    grid: true,
                    minimum: 0
                }, {
                    type: 'category',
                    position: 'bottom',
                    fields: ['sector'],
                    label: {
                        rotate: {
                            degrees: -45
                        }
                    }
                }]
                // the bar series is created by the controller from the server's meta.portfolios
            }, {
                xtype: 'component',
                cls: 'piq-legend piq-legend-inline',
                bind: {
                    data: '{sectorLegendCard}'
                },
                tpl: [
                    '<tpl for="rows">',
                    '<span class="piq-legend-item">',
                    '<span class="piq-dot" style="background:{color}"></span>{name:htmlEncode}',
                    '</span>',
                    '</tpl>'
                ]
            }]
        }]
    }, {
        // ---- pivot (labelled fallback) ---------------------------------------
        xtype: 'container',
        cls: 'piq-card piq-pivot-card',
        layout: {
            type: 'vbox',
            align: 'stretch'
        },
        items: [{
            xtype: 'container',
            layout: {
                type: 'hbox',
                align: 'center',
                wrap: true
            },
            items: [{
                xtype: 'component',
                flex: 1,
                minWidth: 240,
                bind: {
                    html: '{pivotTitleHtml}'
                }
            }, {
                xtype: 'segmentedbutton',
                cls: 'piq-range',
                bind: '{measure}',
                items: [
                    { text: 'Market Value', value: 'market_value' },
                    { text: 'Cost Basis', value: 'cost_basis' },
                    { text: 'Unrealized P/L', value: 'unrealized_pl' }
                ]
            }, {
                xtype: 'button',
                text: 'Export CSV',
                iconCls: 'x-fa fa-file-arrow-down',
                margin: '0 0 0 12',
                tooltip: 'Download the pivot (all measures, subtotals and grand total) as CSV; the Exporter package is not installed',
                handler: 'onExport'
            }]
        }, {
            xtype: 'component',
            cls: 'piq-notice',
            html: '<span class="x-fa fa-circle-info"></span> ' +
                '<b>Pivot Grid requires the applicable Sencha package/license.</b> ' +
                'This is a functional grouped aggregation grid instead: rows by Sector → Company, ' +
                'columns by Portfolio. Subtotals and totals are calculated by the server.'
        }, {
            xtype: 'grid',
            reference: 'pivotGrid',
            cls: 'piq-grid',
            height: 520,
            bind: {
                store: '{pivot}'
            },
            columnLines: false,
            loadingText: 'Loading the pivot…',
            emptyText: '<div class="piq-empty">No open positions in the selected portfolio.</div>',
            selectable: false,

            // Group header = the sector with its server-calculated subtotal per portfolio.
            groupHeader: {
                xtype: 'rowheader',
                tpl: [
                    '<div class="piq-grp">',
                    '<span class="piq-grp-name">{html} <i>{[this.count(values)]}</i></span>',
                    '<span class="piq-grp-sum">{[this.subtotals(values)]}</span>',
                    '</div>',
                    {
                        meta: function (values) {
                            var first = values.children && values.children[0],
                                store = first && first.store,
                                reader = store && store.getProxy().getReader();

                            return {
                                data: reader && reader.rawData && reader.rawData.meta,
                                measure: (store && store.piqMeasure) || 'market_value'
                            };
                        },
                        count: function (values) {
                            var m = this.meta(values),
                                bucket = m.data && m.data.groups ? m.data.groups[values.name] : null,
                                n = bucket ? bucket.count : values.count;

                            return Ext.String.htmlEncode(n + (n === 1 ? ' company' : ' companies'));
                        },
                        subtotals: function (values) {
                            var m = this.meta(values),
                                F = FinApp.util.Format,
                                bucket = m.data && m.data.groups ? m.data.groups[values.name] : null,
                                html = '',
                                v;

                            if (!bucket) {
                                return '';
                            }

                            Ext.Array.each(m.data.portfolios, function (p) {
                                var v = bucket[p.key + '_' + m.measure];

                                html += Ext.String.htmlEncode(p.name) + ' <b class="' + F.measureCls(m.measure, v) + '">' +
                                    Ext.String.htmlEncode(F.measure(m.measure, v)) + '</b> &nbsp;•&nbsp; ';
                            });

                            v = bucket['total_' + m.measure];

                            return html + 'Total <b class="' + F.measureCls(m.measure, v) + '">' +
                                Ext.String.htmlEncode(F.measure(m.measure, v)) + '</b>';
                        }
                    }
                ]
            },

            // The portfolio and total columns depend on the data; the controller adds them.
            columns: [{
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
            }]
        }, {
            xtype: 'component',
            cls: 'piq-grand',
            bind: {
                data: '{grandCard}'
            },
            tpl: [
                '<span class="piq-grand-title">Grand total</span>',
                '<tpl for="rows">',
                '<span class="piq-grand-cell"><i>{label:htmlEncode}</i><b class="{cls}">{value:htmlEncode}</b></span>',
                '</tpl>'
            ]
        }]
    }, {
        xtype: 'component',
        cls: 'piq-footnote',
        html: 'All prices, positions and results are simulated. Portfolio series include cash; ' +
            'benchmarks are synthetic indices, not real ones.'
    }]
});

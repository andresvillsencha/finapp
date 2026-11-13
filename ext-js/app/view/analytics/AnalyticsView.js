/**
 * Portfolio Analytics (CLAUDE.md section 3.3).
 *
 *   header
 *   [error banner with Retry]
 *   Portfolio performance comparison (normalized, start = 100)  |  Sector exposure by portfolio
 *   Pivot grid: Sector -> Company, columns by Portfolio, three measures, Configure, Export
 *
 * The pivot is an Ext.pivot.Grid with a local matrix over the position rows of
 * GET /api/analytics/pivot: subtotals and grand totals are calculated by the pivot (sums in
 * whole cents, see FinApp.util.PivotAggregators), the Configurator plugin rearranges rows,
 * columns and measures, DrillDown shows the positions behind a value, and the Exporter
 * plugin exports Excel or CSV. The charts are Ext.chart cartesian charts whose series are
 * built from the server's meta (which portfolios and benchmarks exist).
 */
Ext.define('FinApp.view.analytics.AnalyticsView', {
    extend: 'Ext.Container',
    xtype: 'analytics-view',

    requires: [
        'Ext.pivot.Grid',
        'Ext.pivot.plugin.Configurator',
        'Ext.pivot.plugin.DrillDown',
        'Ext.pivot.plugin.Exporter',
        'Ext.menu.Menu',
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
        'FinApp.util.PivotAggregators',
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
        // ---- pivot grid ----------------------------------------------------------
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
                minWidth: 260,
                html: '<div class="piq-card-title">Exposure by Sector → Company</div>' +
                    '<div class="piq-card-sub">Columns by portfolio • Market Value, Cost Basis and ' +
                    'Unrealized P/L • double-tap a value to see the positions behind it</div>'
            }, {
                xtype: 'button',
                text: 'Configure',
                iconCls: 'x-fa fa-sliders',
                margin: '0 0 0 12',
                tooltip: 'Choose the rows, columns and measures of the pivot',
                handler: 'onConfigure'
            }, {
                xtype: 'button',
                text: 'Export',
                iconCls: 'x-fa fa-file-arrow-down',
                margin: '0 0 0 8',
                tooltip: 'Export the pivot as it is shown (simulated data)',
                menu: {
                    items: [{
                        text: 'Excel (.xlsx)',
                        iconCls: 'x-fa fa-file-excel',
                        handler: 'onExportXlsx'
                    }, {
                        text: 'CSV',
                        iconCls: 'x-fa fa-file-csv',
                        handler: 'onExportCsv'
                    }]
                }
            }]
        }, {
            xtype: 'component',
            cls: 'piq-empty',
            hidden: true,
            bind: {
                hidden: '{hasPivotRows}'
            },
            html: 'No open positions in the selected portfolio.'
        }, {
            xtype: 'pivotgrid',
            reference: 'pivotGrid',
            cls: 'piq-grid piq-pivot',
            height: 560,
            columnLines: false,
            startRowGroupsCollapsed: false,

            // The screen shows its own mask on first loads; refreshes every tick stay silent.
            enableLoadMask: false,

            plugins: {
                // rearrange rows, columns and measures (also: long-press a column header)
                pivotconfigurator: {
                    fields: [
                        { dataIndex: 'sector', header: 'Sector', settings: { allowed: ['leftAxis', 'topAxis'] } },
                        { dataIndex: 'company', header: 'Company', settings: { allowed: ['leftAxis', 'topAxis'] } },
                        { dataIndex: 'symbol', header: 'Ticker', settings: { allowed: ['leftAxis', 'topAxis'] } },
                        { dataIndex: 'portfolio_name', header: 'Portfolio', sortIndex: 'portfolio_id', settings: { allowed: ['leftAxis', 'topAxis'] } },
                        {
                            dataIndex: 'market_value',
                            header: 'Market Value',
                            aggregator: 'piqSum',
                            settings: { allowed: ['aggregate'], aggregators: ['piqSum', 'avg', 'min', 'max'] }
                        },
                        {
                            dataIndex: 'cost_basis',
                            header: 'Cost Basis',
                            aggregator: 'piqSum',
                            settings: { allowed: ['aggregate'], aggregators: ['piqSum', 'avg', 'min', 'max'] }
                        },
                        {
                            dataIndex: 'unrealized_pl',
                            header: 'Unrealized P/L',
                            aggregator: 'piqSum',
                            settings: { allowed: ['aggregate'], aggregators: ['piqSum', 'avg', 'min', 'max'] }
                        },
                        {
                            dataIndex: 'quantity',
                            header: 'Shares',
                            aggregator: 'sum',
                            settings: { allowed: ['aggregate'], aggregators: ['sum', 'avg', 'min', 'max'] }
                        }
                    ]
                },
                // double-tap a value: the positions that were aggregated into it
                pivotdrilldown: {
                    width: 760,
                    columns: [{
                        text: 'Ticker',
                        dataIndex: 'symbol',
                        width: 90
                    }, {
                        text: 'Company',
                        dataIndex: 'company',
                        flex: 1,
                        minWidth: 170
                    }, {
                        text: 'Portfolio',
                        dataIndex: 'portfolio_name',
                        width: 170
                    }, {
                        text: 'Shares',
                        dataIndex: 'quantity',
                        width: 90,
                        align: 'right',
                        renderer: function (value) {
                            return FinApp.util.Format.integer(value);
                        }
                    }, {
                        text: 'Market Value',
                        dataIndex: 'market_value',
                        width: 130,
                        align: 'right',
                        renderer: function (value) {
                            return FinApp.util.Format.usd(value);
                        }
                    }, {
                        text: 'Cost Basis',
                        dataIndex: 'cost_basis',
                        width: 130,
                        align: 'right',
                        renderer: function (value) {
                            return FinApp.util.Format.usd(value);
                        }
                    }, {
                        text: 'Unrealized P/L',
                        dataIndex: 'unrealized_pl',
                        width: 140,
                        align: 'right',
                        cell: {
                            encodeHtml: false
                        },
                        renderer: function (value) {
                            var F = FinApp.util.Format;

                            return '<span class="' + F.pnlCls(value) + '">' +
                                Ext.String.htmlEncode(F.signedUsd(value)) + '</span>';
                        }
                    }]
                },
                pivotexporter: true
            },

            matrix: {
                type: 'local',
                store: {
                    type: 'pivot-rows'
                },
                viewLayoutType: 'outline',
                rowSubTotalsPosition: 'first',
                rowGrandTotalsPosition: 'last',
                colSubTotalsPosition: 'none',
                colGrandTotalsPosition: 'last',
                textGrandTotalTpl: 'Grand total',

                leftAxis: [{
                    dataIndex: 'sector',
                    header: 'Sector',
                    width: 210
                }, {
                    dataIndex: 'company',
                    header: 'Company',
                    width: 230
                }],

                topAxis: [{
                    dataIndex: 'portfolio_name',
                    sortIndex: 'portfolio_id',
                    header: 'Portfolio'
                }],

                // Sums are done in whole cents (FinApp.util.PivotAggregators), like the backend.
                aggregate: [{
                    dataIndex: 'market_value',
                    header: 'Market Value',
                    aggregator: 'piqSum',
                    align: 'right',
                    width: 140,
                    renderer: function (value) {
                        return FinApp.util.Format.usd(value);
                    },
                    exportStyle: {
                        format: 'Currency',
                        alignment: {
                            horizontal: 'Right'
                        }
                    }
                }, {
                    dataIndex: 'cost_basis',
                    header: 'Cost Basis',
                    aggregator: 'piqSum',
                    align: 'right',
                    width: 140,
                    renderer: function (value) {
                        return FinApp.util.Format.usd(value);
                    },
                    exportStyle: {
                        format: 'Currency',
                        alignment: {
                            horizontal: 'Right'
                        }
                    }
                }, {
                    dataIndex: 'unrealized_pl',
                    header: 'Unrealized P/L',
                    aggregator: 'piqSum',
                    align: 'right',
                    width: 140,
                    // sign and colour (the pivot cell does not encode HTML; only formatted numbers go in)
                    renderer: function (value) {
                        var F = FinApp.util.Format;

                        return '<span class="' + F.pnlCls(value) + '">' +
                            Ext.String.htmlEncode(F.signedUsd(value)) + '</span>';
                    },
                    exportStyle: {
                        format: 'Currency',
                        alignment: {
                            horizontal: 'Right'
                        }
                    }
                }]
            }
        }]
    }, {
        xtype: 'component',
        cls: 'piq-footnote',
        html: 'All prices, positions and results are simulated. Portfolio series include cash; ' +
            'benchmarks are synthetic indices, not real ones.'
    }]
});

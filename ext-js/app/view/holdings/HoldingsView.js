/**
 * Holdings Explorer (CLAUDE.md section 3.2).
 *
 *   header
 *   [error banner with Retry]
 *   summary cards (server totals of the current filter)
 *   filter bar: portfolio | sector | gain/loss | search | group by | Refresh | Export CSV | Buy | Sell
 *   [ tabs: Holdings grid | Transactions grid ]      [ company detail panel ]
 *
 * The Holdings grid is an Ext.grid.Grid (Modern) with REMOTE sort, filter, paging and
 * grouping: the server returns one page plus the filtered `total` and server-calculated
 * totals. Group headers show the server's per-group sums. Every value shown is formatted
 * from server data; nothing financial is calculated in the browser.
 *
 * The trade dialog (FinApp.view.holdings.TradeDialog) is opened from the Buy / Sell
 * buttons (accessible) or by double tapping a row.
 */
Ext.define('FinApp.view.holdings.HoldingsView', {
    extend: 'Ext.Container',
    xtype: 'holdings-view',

    requires: [
        'Ext.grid.Grid',
        'Ext.grid.RowHeader',
        'Ext.grid.plugin.RowExpander',
        'Ext.tab.Panel',
        'Ext.SegmentedButton',
        'Ext.field.Select',
        'Ext.field.Text',
        'Ext.field.Date',
        'Ext.chart.CartesianChart',
        'Ext.chart.axis.Numeric',
        'Ext.chart.axis.Time',
        'Ext.chart.series.Line',
        'Ext.chart.interactions.ItemHighlight',
        'FinApp.util.Format',
        'FinApp.view.shared.Pager',
        'FinApp.view.holdings.HoldingsController',
        'FinApp.view.holdings.HoldingsModel'
    ],

    controller: 'holdings',
    viewModel: {
        type: 'holdings'
    },

    cls: 'piq-view piq-holdings',
    scrollable: 'y',

    items: [{
        // ---- header --------------------------------------------------------
        xtype: 'component',
        html: '<div class="piq-view-title">Holdings Explorer</div>' +
            '<div class="piq-view-sub">Browse positions, companies and recent simulated trades • ' +
            'Simulated data</div>'
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
        // ---- summary cards (server totals) --------------------------------
        xtype: 'component',
        cls: 'piq-kpi-row',
        bind: {
            data: '{summaryCards}'
        },
        tpl: [
            '<div class="piq-kpi-grid">',
            '<tpl for="cards">',
            '<div class="piq-kpi">',
            '<div class="piq-kpi-icon x-fa {icon}"></div>',
            '<div class="piq-kpi-body">',
            '<div class="piq-kpi-label">{label:htmlEncode}</div>',
            '<div class="piq-kpi-value {valueCls}">{value:htmlEncode}</div>',
            '<div class="piq-kpi-sub {subCls}">{sub:htmlEncode}</div>',
            '</div>',
            '</div>',
            '</tpl>',
            '</div>'
        ]
    }, {
        // ---- filter bar ----------------------------------------------------
        xtype: 'container',
        cls: 'piq-filterbar',
        layout: {
            type: 'hbox',
            align: 'end',
            wrap: true
        },
        defaults: {
            margin: '0 8 8 0'
        },
        items: [{
            xtype: 'selectfield',
            reference: 'portfolioFilter',
            label: 'Portfolio',
            labelAlign: 'top',
            width: 200,
            bind: '{portfolioId}'
        }, {
            xtype: 'selectfield',
            reference: 'sectorFilter',
            label: 'Sector',
            labelAlign: 'top',
            width: 190,
            options: [{ text: 'All sectors', value: 'all' }],
            value: 'all',
            listeners: {
                change: 'onSectorChange'
            }
        }, {
            xtype: 'selectfield',
            reference: 'gainFilter',
            label: 'Gain / loss',
            labelAlign: 'top',
            width: 150,
            options: [
                { text: 'All', value: 'all' },
                { text: 'Gainers', value: 'gain' },
                { text: 'Losers', value: 'loss' }
            ],
            value: 'all',
            listeners: {
                change: 'onGainChange'
            }
        }, {
            xtype: 'textfield',
            reference: 'searchField',
            label: 'Search',
            labelAlign: 'top',
            width: 230,
            clearable: true,
            placeholder: 'Ticker or company…',
            listeners: {
                keyup: {
                    fn: 'onSearch',
                    buffer: 350
                },
                change: {
                    fn: 'onSearch',
                    buffer: 350
                }
            }
        }, {
            xtype: 'segmentedbutton',
            cls: 'piq-group-by',
            bind: '{group}',
            items: [
                { text: 'No grouping', value: 'none' },
                { text: 'By sector', value: 'sector' },
                { text: 'By portfolio', value: 'portfolio_name' }
            ]
        }, {
            xtype: 'component',
            flex: 1
        }, {
            xtype: 'button',
            text: 'Refresh',
            iconCls: 'x-fa fa-arrows-rotate',
            handler: 'onRefreshTap'
        }, {
            xtype: 'button',
            text: 'Export CSV',
            iconCls: 'x-fa fa-file-arrow-down',
            tooltip: 'Download the filtered holdings as CSV (the Exporter package is not installed)',
            handler: 'onExport'
        }, {
            xtype: 'button',
            text: 'Buy',
            iconCls: 'x-fa fa-arrow-trend-up',
            ui: 'confirm',
            handler: 'onBuy'
        }, {
            xtype: 'button',
            text: 'Sell',
            iconCls: 'x-fa fa-arrow-trend-down',
            ui: 'decline',
            bind: {
                disabled: '{noSelection}'
            },
            handler: 'onSell'
        }]
    }, {
        // ---- main row: tabs + detail panel ---------------------------------
        xtype: 'container',
        cls: 'piq-dash-row',
        layout: {
            type: 'hbox',
            align: 'stretch',
            wrap: true
        },
        items: [{
            xtype: 'tabpanel',
            reference: 'tabs',
            cls: 'piq-card piq-dash-card piq-holdings-tabs',
            flex: 3,
            minWidth: 520,
            height: 640,
            tabBar: {
                cls: 'piq-tabbar'
            },
            listeners: {
                activeitemchange: 'onTabChange'
            },
            items: [{
                // ---- Holdings grid ----------------------------------------------
                xtype: 'container',
                title: 'Holdings',
                layout: 'fit',
                items: [{
                    xtype: 'grid',
                    reference: 'holdingsGrid',
                    cls: 'piq-grid',
                    bind: {
                        store: '{holdings}'
                    },
                    columnLines: false,
                    loadingText: 'Loading holdings…',
                    emptyText: '<div class="piq-empty">No holdings match the current filters.</div>',
                    selectable: {
                        mode: 'single'
                    },
                    listeners: {
                        selectionchange: 'onSelectionChange',
                        childdoubletap: 'onRowDoubleTap'
                    },

                    // Group header: name, server-supplied count and sums for the group.
                    groupHeader: {
                        xtype: 'rowheader',
                        tpl: [
                            '<div class="piq-grp">',
                            '<span class="piq-grp-name">{html} <i>{[this.count(values)]}</i></span>',
                            '<span class="piq-grp-sum">{[this.sums(values)]}</span>',
                            '</div>',
                            {
                                bucket: function (values) {
                                    var first = values.children && values.children[0],
                                        store = first && first.store,
                                        reader = store && store.getProxy().getReader(),
                                        meta = reader && reader.rawData && reader.rawData.meta,
                                        groups = meta && meta.groups && meta.groups[values.groupField];

                                    return groups ? groups[values.name] : null;
                                },
                                count: function (values) {
                                    var b = this.bucket(values),
                                        n = b ? b.count : values.count;

                                    return Ext.String.htmlEncode(n + (n === 1 ? ' position' : ' positions'));
                                },
                                sums: function (values) {
                                    var b = this.bucket(values),
                                        F = FinApp.util.Format;

                                    if (!b) {
                                        return '';
                                    }

                                    return 'Market value <b>' + Ext.String.htmlEncode(F.usd(b.market_value)) + '</b> &nbsp;•&nbsp; ' +
                                        'Unrealized P/L <b class="' + F.pnlCls(b.unrealized_pl) + '">' +
                                        Ext.String.htmlEncode(F.signedUsd(b.unrealized_pl) + ' (' +
                                            F.signedPct(b.unrealized_pl_pct) + ')') + '</b>';
                                }
                            }
                        ]
                    },

                    columns: [{
                        text: 'Ticker',
                        dataIndex: 'symbol',
                        width: 92,
                        cell: {
                            userCls: 'piq-ticker'
                        }
                    }, {
                        text: 'Company',
                        dataIndex: 'company',
                        flex: 2,
                        minWidth: 170
                    }, {
                        text: 'Sector',
                        dataIndex: 'sector',
                        width: 150
                    }, {
                        text: 'Portfolio',
                        dataIndex: 'portfolio_name',
                        width: 160
                    }, {
                        text: 'Quantity',
                        dataIndex: 'quantity',
                        width: 100,
                        align: 'right',
                        renderer: function (value) {
                            return FinApp.util.Format.integer(value);
                        }
                    }, {
                        text: 'Average Cost',
                        dataIndex: 'average_cost',
                        width: 120,
                        align: 'right',
                        renderer: function (value) {
                            return FinApp.util.Format.usd(value);
                        }
                    }, {
                        text: 'Current Price',
                        dataIndex: 'current_price',
                        width: 120,
                        align: 'right',
                        renderer: function (value) {
                            return FinApp.util.Format.usd(value);
                        }
                    }, {
                        text: 'Day Change',
                        dataIndex: 'day_change',
                        width: 150,
                        align: 'right',
                        cell: {
                            encodeHtml: false
                        },
                        renderer: function (value, record) {
                            var F = FinApp.util.Format;

                            return '<span class="' + F.pnlCls(value) + '">' +
                                Ext.String.htmlEncode(F.arrow(value) + ' ' + F.signedUsd(value) +
                                    ' (' + F.signedPct(record.get('day_change_pct')) + ')') + '</span>';
                        }
                    }, {
                        text: 'Market Value',
                        dataIndex: 'market_value',
                        width: 140,
                        align: 'right',
                        renderer: function (value) {
                            return FinApp.util.Format.usd(value);
                        }
                    }, {
                        text: 'Cost Basis',
                        dataIndex: 'cost_basis',
                        width: 140,
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
                    }, {
                        text: 'Unrealized P/L %',
                        dataIndex: 'unrealized_pl_pct',
                        width: 140,
                        align: 'right',
                        cell: {
                            encodeHtml: false
                        },
                        renderer: function (value) {
                            var F = FinApp.util.Format;

                            return '<span class="' + F.pnlCls(value) + '">' +
                                Ext.String.htmlEncode(F.signedPct(value)) + '</span>';
                        }
                    }, {
                        text: 'Allocation %',
                        dataIndex: 'allocation_pct',
                        width: 120,
                        align: 'right',
                        renderer: function (value) {
                            return FinApp.util.Format.pct(value);
                        }
                    }],

                    items: [{
                        xtype: 'piqpager',
                        docked: 'bottom',
                        noun: 'positions',
                        bind: {
                            store: '{holdings}'
                        }
                    }]
                }]
            }, {
                // ---- Transactions -------------------------------------------------
                xtype: 'container',
                title: 'Transactions',
                layout: {
                    type: 'vbox',
                    align: 'stretch'
                },
                items: [{
                    xtype: 'container',
                    cls: 'piq-filterbar piq-txfilters',
                    layout: {
                        type: 'hbox',
                        align: 'end',
                        wrap: true
                    },
                    defaults: {
                        margin: '0 8 8 0'
                    },
                    items: [{
                        xtype: 'textfield',
                        label: 'Ticker',
                        labelAlign: 'top',
                        width: 130,
                        clearable: true,
                        placeholder: 'e.g. AAPL',
                        listeners: {
                            keyup: {
                                fn: 'onTxTicker',
                                buffer: 350
                            },
                            change: {
                                fn: 'onTxTicker',
                                buffer: 350
                            }
                        }
                    }, {
                        xtype: 'selectfield',
                        label: 'Side',
                        labelAlign: 'top',
                        width: 130,
                        options: [
                            { text: 'All', value: 'all' },
                            { text: 'Buy', value: 'BUY' },
                            { text: 'Sell', value: 'SELL' }
                        ],
                        value: 'all',
                        listeners: {
                            change: 'onTxSide'
                        }
                    }, {
                        xtype: 'datefield',
                        label: 'From (UTC date)',
                        labelAlign: 'top',
                        width: 170,
                        clearable: true,
                        dateFormat: 'Y-m-d',
                        listeners: {
                            change: 'onTxFrom'
                        }
                    }, {
                        xtype: 'datefield',
                        label: 'To (UTC date)',
                        labelAlign: 'top',
                        width: 170,
                        clearable: true,
                        dateFormat: 'Y-m-d',
                        listeners: {
                            change: 'onTxTo'
                        }
                    }]
                }, {
                    xtype: 'grid',
                    reference: 'transactionsGrid',
                    cls: 'piq-grid',
                    flex: 1,
                    bind: {
                        store: '{transactions}'
                    },
                    columnLines: false,
                    loadingText: 'Loading transactions…',
                    emptyText: '<div class="piq-empty">No transactions match the current filters.</div>',
                    plugins: {
                        rowexpander: true
                    },
                    itemConfig: {
                        body: {
                            tpl: [
                                '<div class="piq-txdetail">',
                                '<span>Transaction <b>{id:htmlEncode}</b></span>',
                                '<span>Executed <b>{executed_at:htmlEncode}</b></span>',
                                '<span>Simulated tick <b>{tick_index}</b></span>',
                                '<span>Fee <b>{fee:currency}</b></span>',
                                '<span>Source <b>{source:htmlEncode}</b></span>',
                                '</div>'
                            ]
                        }
                    },
                    columns: [{
                        text: 'Executed (UTC)',
                        dataIndex: 'executed_at',
                        width: 170,
                        renderer: function (value) {
                            return FinApp.util.Format.utcDateTime(value).replace(' UTC', '');
                        }
                    }, {
                        text: 'Side',
                        dataIndex: 'trade_type',
                        width: 80,
                        cell: {
                            encodeHtml: false
                        },
                        renderer: function (value) {
                            return '<span class="piq-side-tag piq-side-' + (value === 'BUY' ? 'buy' : 'sell') + '">' +
                                Ext.String.htmlEncode(value) + '</span>';
                        }
                    }, {
                        text: 'Ticker',
                        dataIndex: 'symbol',
                        width: 90,
                        cell: {
                            userCls: 'piq-ticker'
                        }
                    }, {
                        text: 'Company',
                        dataIndex: 'company',
                        flex: 2,
                        minWidth: 160
                    }, {
                        text: 'Portfolio',
                        dataIndex: 'portfolio_name',
                        width: 160
                    }, {
                        text: 'Quantity',
                        dataIndex: 'quantity',
                        width: 100,
                        align: 'right',
                        renderer: function (value) {
                            return FinApp.util.Format.integer(value);
                        }
                    }, {
                        text: 'Price',
                        dataIndex: 'execution_price',
                        width: 110,
                        align: 'right',
                        renderer: function (value) {
                            return FinApp.util.Format.usd(value);
                        }
                    }, {
                        text: 'Amount',
                        dataIndex: 'amount',
                        width: 130,
                        align: 'right',
                        renderer: function (value) {
                            return FinApp.util.Format.usd(value);
                        }
                    }, {
                        text: 'Realized P/L',
                        dataIndex: 'realized_pl',
                        width: 130,
                        align: 'right',
                        cell: {
                            encodeHtml: false
                        },
                        renderer: function (value) {
                            var F = FinApp.util.Format;

                            return '<span class="' + F.pnlCls(value) + '">' +
                                Ext.String.htmlEncode(F.signedUsd(value)) + '</span>';
                        }
                    }],
                    items: [{
                        xtype: 'piqpager',
                        docked: 'bottom',
                        noun: 'transactions',
                        bind: {
                            store: '{transactions}'
                        }
                    }]
                }]
            }]
        }, {
            // ---- company detail panel -----------------------------------------
            xtype: 'container',
            cls: 'piq-card piq-dash-card piq-detail',
            flex: 1,
            minWidth: 340,
            layout: {
                type: 'vbox',
                align: 'stretch'
            },
            scrollable: 'y',
            items: [{
                xtype: 'component',
                cls: 'piq-empty piq-detail-empty',
                html: '<span class="x-fa fa-hand-pointer"></span><br>Select a position to see the company, ' +
                    'its simulated price chart and recent trades.',
                bind: {
                    hidden: '{hasSelection}'
                }
            }, {
                xtype: 'component',
                hidden: true,
                bind: {
                    hidden: '{noSelection}',
                    data: '{detail}'
                },
                tpl: [
                    '<div class="piq-detail-head">',
                    '<div>',
                    '<div class="piq-detail-name">{company:htmlEncode}</div>',
                    '<div class="piq-detail-sub">{symbol:htmlEncode} • {portfolio:htmlEncode}</div>',
                    '</div>',
                    '<span class="piq-chip">{sector:htmlEncode}</span>',
                    '</div>',
                    '<div class="piq-detail-price">',
                    '<div class="piq-kpi-label">Current price (simulated)</div>',
                    '<div class="piq-detail-big">{price:htmlEncode}</div>',
                    '<div class="{dayCls}">{dayChange:htmlEncode}</div>',
                    '</div>',
                    '<table class="piq-kvtable">',
                    '<tr><td>Market value</td><td>{marketValue:htmlEncode}</td></tr>',
                    '<tr><td>Shares held</td><td>{quantity:htmlEncode}</td></tr>',
                    '<tr><td>Average cost</td><td>{averageCost:htmlEncode}</td></tr>',
                    '<tr><td>Cost basis</td><td>{costBasis:htmlEncode}</td></tr>',
                    '<tr><td>Unrealized P/L</td><td class="{plCls}">{unrealized:htmlEncode}</td></tr>',
                    '<tr><td>Return</td><td class="{plCls}">{unrealizedPct:htmlEncode}</td></tr>',
                    '<tr><td>Allocation</td><td>{allocation:htmlEncode}</td></tr>',
                    '</table>'
                ]
            }, {
                xtype: 'container',
                hidden: true,
                bind: {
                    hidden: '{noSelection}'
                },
                layout: {
                    type: 'vbox',
                    align: 'stretch'
                },
                items: [{
                    xtype: 'container',
                    layout: {
                        type: 'hbox',
                        align: 'center'
                    },
                    items: [{
                        xtype: 'component',
                        flex: 1,
                        cls: 'piq-card-title piq-small-title',
                        bind: {
                            html: '{priceTitle}'
                        }
                    }, {
                        xtype: 'segmentedbutton',
                        cls: 'piq-range',
                        bind: '{priceRange}',
                        items: [
                            { text: '1M', value: '1M' },
                            { text: '3M', value: '3M' },
                            { text: '6M', value: '6M' },
                            { text: '1Y', value: '1Y' }
                        ]
                    }]
                }, {
                    xtype: 'cartesian',
                    reference: 'priceChart',
                    height: 200,
                    insetPadding: {
                        top: 10,
                        right: 12,
                        bottom: 6,
                        left: 6
                    },
                    animation: false,
                    interactions: ['itemhighlight'],
                    bind: {
                        store: '{prices}'
                    },
                    axes: [{
                        type: 'numeric',
                        position: 'left',
                        fields: ['price'],
                        grid: true,
                        renderer: function (axis, label) {
                            return FinApp.util.Format.compactUsd(label);
                        }
                    }, {
                        type: 'time',
                        position: 'bottom',
                        fields: ['ts'],
                        renderer: function (axis, label) {
                            var vm = axis.getChart().lookupViewModel(),
                                range = vm ? vm.get('priceRange') : '3M',
                                format = (range === '1M' || range === '3M') ? 'M j' : 'M Y';

                            return FinApp.util.Format.utcFormat(label, format);
                        }
                    }],
                    series: [{
                        type: 'line',
                        fill: true,
                        xField: 'ts',
                        yField: 'price',
                        style: {
                            stroke: '#1d5fd1',
                            lineWidth: 2,
                            fill: '#1d5fd1',
                            fillOpacity: 0.12
                        },
                        marker: {
                            type: 'circle',
                            radius: 4,
                            lineWidth: 2,
                            fill: '#ffffff',
                            stroke: '#1d5fd1',
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
                                    Ext.String.htmlEncode(F.usd(record.get('price'))) + '</b>'
                                );
                            }
                        }
                    }]
                }, {
                    xtype: 'component',
                    cls: 'piq-card-sub',
                    bind: {
                        html: '{priceNote}'
                    }
                }, {
                    xtype: 'container',
                    layout: {
                        type: 'hbox',
                        align: 'center'
                    },
                    defaults: {
                        flex: 1,
                        margin: '4 4 8 0'
                    },
                    items: [{
                        xtype: 'button',
                        text: 'Buy More',
                        iconCls: 'x-fa fa-arrow-trend-up',
                        ui: 'confirm',
                        handler: 'onBuy'
                    }, {
                        xtype: 'button',
                        text: 'Sell Position',
                        iconCls: 'x-fa fa-arrow-trend-down',
                        ui: 'decline',
                        handler: 'onSell'
                    }]
                }, {
                    xtype: 'component',
                    cls: 'piq-card-title piq-small-title',
                    html: 'Recent transactions'
                }, {
                    xtype: 'component',
                    cls: 'piq-recent',
                    bind: {
                        data: '{recentCard}'
                    },
                    tpl: [
                        '<tpl if="rows.length === 0"><div class="piq-empty">No trades for this position yet.</div></tpl>',
                        '<tpl for="rows">',
                        '<div class="piq-recent-row">',
                        '<span class="piq-side-tag piq-side-{sideKey}">{side:htmlEncode}</span>',
                        '<span class="piq-recent-main">{quantity:htmlEncode} @ {price:htmlEncode}</span>',
                        '<span class="piq-recent-date">{date:htmlEncode}</span>',
                        '</div>',
                        '</tpl>'
                    ]
                }, {
                    xtype: 'component',
                    cls: 'piq-card-title piq-small-title',
                    bind: {
                        html: '{aboutTitle}'
                    }
                }, {
                    xtype: 'component',
                    cls: 'piq-about',
                    bind: {
                        html: '{aboutHtml}'
                    }
                }]
            }]
        }]
    }, {
        xtype: 'component',
        cls: 'piq-footnote',
        html: 'All prices, positions and results are simulated. Group totals and the cards above are ' +
            'calculated by the server over every position matching the filters, not only the visible page.'
    }]
});

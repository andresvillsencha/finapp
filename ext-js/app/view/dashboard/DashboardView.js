/**
 * Portfolio Dashboard (CLAUDE.md section 3.1).
 *
 *   header (title, scope, as-of)
 *   [error banner with Retry]
 *   KPI cards: Portfolio Value | Total Gain/Loss | Daily Change | Cost Basis | Cash
 *   Portfolio Performance (line/area chart + 1M 3M 6M 1Y All)  |  Sector allocation donut + legend
 *   Top five holdings  |  Bottom five holdings
 *   Portfolio summary table
 *
 * Layout rows wrap on narrow widths (flex wrap). Loading shows a mask, errors show a
 * banner (last data stays visible), and a portfolio without positions shows empty
 * states. All figures are simulated and come from the REST API.
 */
Ext.define('FinApp.view.dashboard.DashboardView', {
    extend: 'Ext.Container',
    xtype: 'dashboard-view',

    requires: [
        'Ext.chart.CartesianChart',
        'Ext.chart.PolarChart',
        'Ext.chart.axis.Numeric',
        'Ext.chart.axis.Time',
        'Ext.chart.series.Line',
        'Ext.chart.series.Pie',
        'Ext.chart.interactions.ItemHighlight',
        'Ext.SegmentedButton',
        'Ext.LoadMask',
        'FinApp.util.Format',
        'FinApp.view.dashboard.DashboardController',
        'FinApp.view.dashboard.DashboardModel'
    ],

    controller: 'dashboard',
    viewModel: {
        type: 'dashboard'
    },

    cls: 'piq-view piq-dashboard',
    scrollable: 'y',

    bind: {
        masked: '{loadMask}'
    },

    items: [{
        // ---- header --------------------------------------------------------
        xtype: 'component',
        bind: {
            html: '<div class="piq-view-title">Portfolio Dashboard</div>' +
                '<div class="piq-view-sub">{subtitleHtml}</div>'
        }
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
        // ---- KPI cards -----------------------------------------------------
        xtype: 'component',
        cls: 'piq-kpi-row',
        bind: {
            data: '{kpiCards}'
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
        xtype: 'component',
        cls: 'piq-footnote',
        bind: {
            html: '{footnote}'
        }
    }, {
        // ---- row: performance chart + sector allocation -------------------
        xtype: 'container',
        cls: 'piq-dash-row',
        layout: {
            type: 'hbox',
            align: 'stretch',   // both cards take the height of the taller one
            wrap: true
        },
        items: [{
            xtype: 'container',
            cls: 'piq-card piq-dash-card',
            flex: 2,
            minWidth: 460,
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
                    bind: {
                        html: '<div class="piq-card-title">Portfolio Performance</div>' +
                            '<div class="piq-card-sub">Total portfolio value • {rangeNote}</div>'
                    }
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
                reference: 'perfChart',
                flex: 1,            // fill whatever height the card gets
                minHeight: 300,
                insetPadding: {
                    top: 16,
                    right: 16,
                    bottom: 8,
                    left: 8
                },
                animation: false,
                interactions: ['itemhighlight'],
                bind: {
                    store: '{history}'
                },
                axes: [{
                    type: 'numeric',
                    position: 'left',
                    fields: ['portfolio_value'],
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
                            range = vm ? vm.get('range') : '6M',
                            format = (range === '1M' || range === '3M') ? 'M j' : 'M Y';

                        return FinApp.util.Format.utcFormat(label, format);
                    }
                }],
                series: [{
                    type: 'line',
                    fill: true,
                    xField: 'ts',
                    yField: 'portfolio_value',
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
                            var F = FinApp.util.Format,
                                pl = record.get('investment_pl'),
                                pct = record.get('investment_pl_pct');

                            tooltip.setHtml(
                                Ext.String.htmlEncode(F.utcFormat(record.get('ts'), 'Y-m-d H:i')) + ' UTC<br>' +
                                '<b>' + Ext.String.htmlEncode(F.usd(record.get('portfolio_value'))) + '</b><br>' +
                                Ext.String.htmlEncode(F.arrow(pl) + ' ' + F.signedUsd(pl) + ' (' + F.signedPct(pct) + ')')
                            );
                        }
                    }
                }]
            }]
        }, {
            xtype: 'container',
            cls: 'piq-card piq-dash-card',
            flex: 1,
            minWidth: 320,
            layout: {
                type: 'vbox',
                align: 'stretch'
            },
            items: [{
                xtype: 'component',
                html: '<div class="piq-card-title">Asset Allocation by Sector</div>' +
                    '<div class="piq-card-sub">Share of equity market value (cash excluded)</div>'
            }, {
                xtype: 'polar',
                reference: 'sectorChart',
                height: 220,
                insetPadding: 8,
                interactions: ['itemhighlight'],
                bind: {
                    store: '{sectors}',
                    hidden: '{!hasHoldings}'
                },
                series: [{
                    type: 'pie',
                    xField: 'market_value',
                    donut: 58,
                    highlight: true,
                    tooltip: {
                        trackMouse: true,
                        renderer: function (tooltip, record) {
                            var F = FinApp.util.Format;

                            tooltip.setHtml(
                                '<b>' + Ext.String.htmlEncode(record.get('sector')) + '</b><br>' +
                                Ext.String.htmlEncode(F.usd(record.get('market_value')) + ' (' +
                                    F.pct(record.get('allocation_pct')) + ')')
                            );
                        }
                    }
                }]
            }, {
                xtype: 'component',
                cls: 'piq-legend',
                bind: {
                    data: '{legendCard}',
                    hidden: '{!hasHoldings}'
                },
                tpl: [
                    '<tpl for="rows">',
                    '<div class="piq-legend-row">',
                    '<span class="piq-legend-name"><span class="piq-dot" style="background:{color}"></span>{sector:htmlEncode}</span>',
                    '<b>{pct:htmlEncode}</b>',
                    '</div>',
                    '</tpl>'
                ]
            }, {
                xtype: 'component',
                cls: 'piq-empty',
                hidden: true,
                bind: {
                    hidden: '{hasHoldings}'
                },
                html: 'No open positions, so there is nothing to allocate.'
            }]
        }]
    }, {
        // ---- row: top five + bottom five ---------------------------------------
        xtype: 'container',
        cls: 'piq-dash-row',
        layout: {
            type: 'hbox',
            wrap: true
        },
        items: [{
            xtype: 'component',
            cls: 'piq-card piq-dash-card',
            flex: 1,
            minWidth: 360,
            bind: {
                data: '{topCard}'
            },
            tpl: [
                '<div class="piq-card-title">Top Five Holdings</div>',
                '<div class="piq-card-sub">Best unrealized return on cost</div>',
                '<table class="piq-table">',
                '<caption class="piq-sr">Top five holdings by unrealized return</caption>',
                '<thead><tr><th scope="col">Ticker</th><th scope="col">Company</th>',
                '<th scope="col" class="piq-num">Return</th><th scope="col" class="piq-num">Price</th></tr></thead>',
                '<tbody>',
                '<tpl for="rows">',
                '<tr><td class="piq-ticker">{symbol:htmlEncode}</td><td>{company:htmlEncode}</td>',
                '<td class="piq-num {cls}">{arrow} {ret:htmlEncode}</td><td class="piq-num">{price:htmlEncode}</td></tr>',
                '</tpl>',
                '<tpl if="!rows.length"><tr><td colspan="4" class="piq-empty">No open positions.</td></tr></tpl>',
                '</tbody></table>'
            ]
        }, {
            xtype: 'component',
            cls: 'piq-card piq-dash-card',
            flex: 1,
            minWidth: 360,
            bind: {
                data: '{bottomCard}'
            },
            tpl: [
                '<div class="piq-card-title">Bottom Five Holdings</div>',
                '<div class="piq-card-sub">Weakest unrealized return on cost</div>',
                '<table class="piq-table">',
                '<caption class="piq-sr">Bottom five holdings by unrealized return</caption>',
                '<thead><tr><th scope="col">Ticker</th><th scope="col">Company</th>',
                '<th scope="col" class="piq-num">Return</th><th scope="col" class="piq-num">Price</th></tr></thead>',
                '<tbody>',
                '<tpl for="rows">',
                '<tr><td class="piq-ticker">{symbol:htmlEncode}</td><td>{company:htmlEncode}</td>',
                '<td class="piq-num {cls}">{arrow} {ret:htmlEncode}</td><td class="piq-num">{price:htmlEncode}</td></tr>',
                '</tpl>',
                '<tpl if="!rows.length"><tr><td colspan="4" class="piq-empty">No open positions.</td></tr></tpl>',
                '</tbody></table>'
            ]
        }]
    }, {
        // ---- portfolio summary -----------------------------------------------------
        xtype: 'component',
        cls: 'piq-card piq-dash-card piq-summary',
        bind: {
            data: '{summaryCard}'
        },
        tpl: [
            '<div class="piq-card-title">Portfolio Summary</div>',
            '<div class="piq-card-sub">Value, gain/loss, allocation and cash • allocation is each portfolio’s share of total value</div>',
            '<div class="piq-table-wrap">',
            '<table class="piq-table">',
            '<caption class="piq-sr">Portfolio summary</caption>',
            '<thead><tr><th scope="col">Portfolio</th><th scope="col" class="piq-num">Value</th>',
            '<th scope="col" class="piq-num">Gain/Loss</th><th scope="col" class="piq-num">Return</th>',
            '<th scope="col" class="piq-num">Daily (indicative)</th><th scope="col" class="piq-num">Allocation</th>',
            '<th scope="col" class="piq-num">Cash</th></tr></thead>',
            '<tbody>',
            '<tpl for="rows">',
            '<tr><td class="piq-ticker">{name:htmlEncode}</td><td class="piq-num">{value:htmlEncode}</td>',
            '<td class="piq-num {plCls}">{plArrow} {pl:htmlEncode}</td><td class="piq-num {plCls}">{ret:htmlEncode}</td>',
            '<td class="piq-num {dailyCls}">{dailyArrow} {daily:htmlEncode}</td>',
            '<td class="piq-num">{allocation:htmlEncode}</td><td class="piq-num">{cash:htmlEncode}</td></tr>',
            '</tpl>',
            '<tpl if="!rows.length"><tr><td colspan="7" class="piq-empty">No portfolios.</td></tr></tpl>',
            '</tbody></table>',
            '</div>'
        ]
    }]
});

/**
 * The PortfolioIQ application shell. It is specified in app.js as the "mainView".
 *
 *   +-----------+--------------------------------------------------+
 *   | sidebar   | header: portfolio selector | SIMULATED badge      |
 *   |  brand    |--------------------------------------------------|
 *   |  nav      | disclosure bar / API error banner                 |
 *   |           |--------------------------------------------------|
 *   |  sim      | screens (card layout): dashboard, holdings,       |
 *   |  status   |          analytics                                |
 *   +-----------+--------------------------------------------------+
 *
 * Layout and look are driven by the shared `.piq-*` classes (Application.scss and
 * Main.scss); the sidebar collapses to icons on narrow (tablet) widths.
 */
Ext.define('FinApp.view.main.Main', {
    extend: 'Ext.Container',
    xtype: 'app-main',

    requires: [
        'Ext.layout.HBox',
        'Ext.layout.VBox',
        'Ext.layout.Card',
        'Ext.Button',
        'Ext.field.Select',
        'FinApp.view.main.MainController',
        'FinApp.view.main.MainModel',
        'FinApp.view.dashboard.DashboardView',
        'FinApp.view.holdings.HoldingsView',
        'FinApp.view.analytics.AnalyticsView'
    ],

    controller: 'main',
    viewModel: 'main',

    cls: 'piq-shell',
    layout: {
        type: 'hbox',
        align: 'stretch'
    },

    items: [{
        // ---- sidebar -------------------------------------------------------
        xtype: 'container',
        cls: 'piq-sidebar',
        layout: {
            type: 'vbox',
            align: 'stretch'
        },
        items: [{
            xtype: 'component',
            cls: 'piq-brand',
            html: '<span class="piq-brand-mark x-fa fa-chart-simple"></span>' +
                '<span class="piq-brand-text">PortfolioIQ</span>'
        }, {
            xtype: 'component',
            cls: 'piq-tagline',
            html: 'Investment Portfolio Intelligence<br>Demo Edition'
        }, {
            xtype: 'container',
            cls: 'piq-nav',
            layout: {
                type: 'vbox',
                align: 'stretch'
            },
            defaults: {
                xtype: 'button',
                userCls: 'piq-nav-item',
                listeners: {
                    tap: 'onNavTap'
                }
            },
            items: [{
                itemId: 'dashboard',
                reference: 'navDashboard',
                text: 'Dashboard',
                ariaLabel: 'Dashboard',
                iconCls: 'x-fa fa-house'
            }, {
                itemId: 'holdings',
                reference: 'navHoldings',
                text: 'Holdings Explorer',
                ariaLabel: 'Holdings Explorer',
                iconCls: 'x-fa fa-layer-group'
            }, {
                itemId: 'analytics',
                reference: 'navAnalytics',
                text: 'Portfolio Analytics',
                ariaLabel: 'Portfolio Analytics',
                iconCls: 'x-fa fa-chart-column'
            }]
        }, {
            // pushes the status card to the bottom of the sidebar
            xtype: 'component',
            flex: 1
        }, {
            xtype: 'component',
            cls: 'piq-sim-status',
            bind: {
                data: '{simulationStatus}'
            },
            tpl: [
                '<div class="piq-sim-title"><span class="piq-sim-dot {stateCls}"></span><span class="piq-sim-label">SIMULATED MARKET</span></div>',
                '<div class="piq-sim-detail {stateCls}">{stateText:htmlEncode}</div>',
                '<div class="piq-sim-detail">{refresh:htmlEncode}</div>',
                '<div class="piq-sim-detail">Last update<br>{lastUpdate:htmlEncode}</div>'
            ]
        }]
    }, {
        // ---- body ----------------------------------------------------------
        xtype: 'container',
        flex: 1,
        cls: 'piq-body',
        layout: {
            type: 'vbox',
            align: 'stretch'
        },
        items: [{
            // header: portfolio selector + simulated-data notice
            xtype: 'container',
            cls: 'piq-header',
            layout: {
                type: 'hbox',
                align: 'center'
            },
            items: [{
                xtype: 'selectfield',
                reference: 'portfolioSelect',
                cls: 'piq-portfolio-select',
                label: 'Portfolio',
                labelAlign: 'top',
                width: 280,
                editable: false,
                forceSelection: true,
                options: [{
                    text: 'All Portfolios',
                    value: 'all'
                }],
                bind: '{portfolioId}'
            }, {
                xtype: 'component',
                flex: 1
            }, {
                xtype: 'component',
                cls: 'piq-demo-badge',
                html: 'SIMULATED DATA / DEMO'
            }, {
                xtype: 'component',
                cls: 'piq-last-update',
                bind: {
                    html: '{lastUpdateHtml}'
                }
            }]
        }, {
            // the required disclosure, always visible
            xtype: 'component',
            cls: 'piq-disclosure',
            html: 'PortfolioIQ is a demonstration application. All stock prices, transactions, portfolio ' +
                'values, and performance results are simulated and do not represent real market conditions ' +
                'or investment advice. Real company names and ticker symbols are used for illustrative ' +
                'identification only.'
        }, {
            // shown while the API cannot be reached
            xtype: 'container',
            cls: 'piq-banner-error',
            hidden: true,
            bind: {
                hidden: '{!apiOffline}'
            },
            layout: {
                type: 'hbox',
                align: 'center'
            },
            items: [{
                xtype: 'component',
                flex: 1,
                bind: {
                    html: '{offlineHtml}'
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
            xtype: 'container',
            reference: 'screens',
            flex: 1,
            cls: 'piq-screens',
            layout: 'card',
            items: [{
                xtype: 'dashboard-view'
            }, {
                xtype: 'holdings-view'
            }, {
                xtype: 'analytics-view'
            }]
        }]
    }]
});

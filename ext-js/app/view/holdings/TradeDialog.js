/**
 * Trade Simulator (CLAUDE.md section 3.2): a modal Ext.Dialog to place a simulated BUY
 * or SELL. The execution price and time are ALWAYS set by the server.
 *
 *   Ext.create('FinApp.view.holdings.TradeDialog', {
 *       tradeType: 'BUY',
 *       initialPortfolioId: 1,
 *       initialCompanyId: 2,
 *       portfolioOptions: [ { id: 1, name: '...', cash_balance: 1234.5 } ]
 *   }).show();
 *
 * The dialog destroys itself when it closes.
 */
Ext.define('FinApp.view.holdings.TradeDialog', {
    extend: 'Ext.Dialog',
    xtype: 'trade-dialog',

    requires: [
        'Ext.Toast',
        'Ext.SegmentedButton',
        'Ext.field.Select',
        'Ext.field.Number',
        'FinApp.view.holdings.TradeController',
        'FinApp.view.holdings.TradeModel'
    ],

    controller: 'trade',
    viewModel: {
        type: 'trade'
    },

    config: {
        /** 'BUY' or 'SELL' (the initial side). */
        tradeType: 'BUY',

        /** Portfolio and company to preselect (e.g. from the selected position). */
        initialPortfolioId: null,
        initialCompanyId: null,

        /** [{ id, name, cash_balance }] supplied by the shell's portfolios store. */
        portfolioOptions: null
    },

    cls: 'piq-trade',
    title: 'Trade Simulator',
    closable: true,
    closeAction: 'destroy',

    // close() (X tool, Escape, the Cancel handler, a successful trade) just destroys the
    // dialog. Without this, Ext.Dialog#close "taps" the Cancel button, whose handler calls
    // close() again: endless recursion and a dialog stuck on "Executing…".
    dismissHandler: true,

    modal: true,
    width: 440,
    maxWidth: '95%',
    bodyPadding: 16,

    layout: {
        type: 'vbox',
        align: 'stretch'
    },

    items: [{
        xtype: 'component',
        cls: 'piq-trade-note',
        html: 'Simulated order. No real money is involved. The server sets the execution ' +
            'price and time from its latest simulated tick.'
    }, {
        xtype: 'segmentedbutton',
        reference: 'sideButton',
        cls: 'piq-side',
        bind: '{side}',
        items: [
            { text: 'Buy', value: 'BUY', iconCls: 'x-fa fa-arrow-trend-up' },
            { text: 'Sell', value: 'SELL', iconCls: 'x-fa fa-arrow-trend-down' }
        ]
    }, {
        xtype: 'selectfield',
        reference: 'portfolioField',
        label: 'Portfolio',
        required: true,
        bind: '{portfolioId}'
    }, {
        xtype: 'selectfield',
        reference: 'companyField',
        label: 'Company',
        required: true,
        placeholder: 'Choose a company',
        bind: {
            value: '{companyId}',
            placeholder: '{companyPlaceholder}'
        }
    }, {
        xtype: 'numberfield',
        reference: 'quantityField',
        label: 'Quantity (whole shares)',
        required: true,
        minValue: 1,
        decimals: 0,
        placeholder: 'e.g. 10',
        bind: '{quantity}'
    }, {
        xtype: 'component',
        cls: 'piq-trade-info',
        bind: {
            html: '{quoteHtml}'
        }
    }, {
        xtype: 'component',
        cls: 'piq-trade-info',
        bind: {
            html: '{cashHtml}'
        }
    }, {
        xtype: 'component',
        cls: 'piq-banner-error piq-trade-error',
        hidden: true,
        bind: {
            hidden: '{!hasError}',
            html: '{errorHtml}'
        }
    }],

    buttons: {
        cancel: {
            text: 'Cancel',
            handler: 'onCancel'
        },
        execute: {
            text: 'Execute simulated BUY',
            handler: 'onExecute',
            bind: {
                text: '{executeText}',
                ui: '{executeUi}',
                disabled: '{!canSubmit}'
            }
        }
    }
});

/**
 * Base for the Phase 2 placeholder screens. A placeholder is NOT a mock-up: it
 * states what the real screen will contain and shows a live API connectivity
 * check (bound to the shell's view model), proving the shell, routing, shared
 * state and API connection work. Each screen class replaces this base in the
 * phase that builds it.
 */
Ext.define('FinApp.view.shared.PlaceholderView', {
    extend: 'Ext.Container',
    xtype: 'piq-placeholder',

    cls: 'piq-view',
    scrollable: 'y',

    config: {
        heading: '',
        subheading: '',
        phaseText: '',
        planned: null
    },

    initialize: function () {
        var me = this;

        me.callParent();

        me.add([{
            xtype: 'component',
            html: '<div class="piq-view-title">' + Ext.String.htmlEncode(me.getHeading()) + '</div>' +
                '<div class="piq-view-sub">' + Ext.String.htmlEncode(me.getSubheading()) + '</div>'
        }, {
            xtype: 'component',
            cls: 'piq-card',
            data: {
                phaseText: me.getPhaseText(),
                planned: me.getPlanned() || []
            },
            tpl: [
                '<div class="piq-card-title">{phaseText:htmlEncode}</div>',
                '<ul class="piq-list">',
                '<tpl for="planned"><li>{.:htmlEncode}</li></tpl>',
                '</ul>'
            ]
        }, {
            xtype: 'component',
            cls: 'piq-card',
            bind: {
                data: '{connectivity}'
            },
            tpl: [
                '<div class="piq-card-title">API connectivity check</div>',
                '<div class="piq-kv"><span>Status</span><b class="{statusCls}">{statusText:htmlEncode}</b></div>',
                '<tpl if="message"><div class="piq-kv"><span>Message</span><b class="piq-err">{message:htmlEncode}</b></div></tpl>',
                '<div class="piq-kv"><span>API base URL</span><b>{apiBase:htmlEncode}</b></div>',
                '<div class="piq-kv"><span>Simulated snapshot (as of)</span><b>{asOf:htmlEncode}</b></div>',
                '<div class="piq-kv"><span>Tick index</span><b>{tickIndex:htmlEncode}</b></div>',
                '<div class="piq-kv"><span>Scenario</span><b>{scenarioName:htmlEncode}</b></div>',
                '<div class="piq-kv"><span>Portfolios loaded</span><b>{portfolioCount}</b></div>',
                '<div class="piq-kv"><span>Selected portfolio</span><b>{portfolioId:htmlEncode}</b></div>'
            ]
        }]);
    }
});

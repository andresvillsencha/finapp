/**
 * FinApp.view.shared.Pager (xtype: piqpager)
 *
 * Compact paging bar for a remotely paged store: previous / next buttons and a
 * "Page 2 of 4 • 87 positions" summary. It only drives the store's own paging
 * (previousPage / nextPage); the server returns the page and the filtered `total`.
 *
 *   { xtype: 'piqpager', store: '{holdings}', noun: 'positions' }
 *
 * Pages are numbered from 1 (Ext convention). Controls are disabled while loading.
 */
Ext.define('FinApp.view.shared.Pager', {
    extend: 'Ext.Toolbar',
    xtype: 'piqpager',

    requires: [
        'Ext.data.StoreManager',
        'FinApp.util.Format'
    ],

    cls: 'piq-pager',
    defaultListenerScope: true,
    referenceHolder: true,

    config: {
        /** The paged store to control. */
        store: null,

        /** Plural noun used in the summary ("positions", "transactions"). */
        noun: 'rows'
    },

    items: [{
        xtype: 'button',
        reference: 'prevButton',
        iconCls: 'x-fa fa-chevron-left',
        ariaLabel: 'Previous page',
        tooltip: 'Previous page',
        disabled: true,
        listeners: {
            tap: 'onPrev'
        }
    }, {
        xtype: 'component',
        reference: 'summary',
        cls: 'piq-pager-text',
        html: ''
    }, {
        xtype: 'button',
        reference: 'nextButton',
        iconCls: 'x-fa fa-chevron-right',
        ariaLabel: 'Next page',
        tooltip: 'Next page',
        disabled: true,
        listeners: {
            tap: 'onNext'
        }
    }],

    applyStore: function (store) {
        return store ? Ext.data.StoreManager.lookup(store) : null;
    },

    updateStore: function (store, oldStore) {
        var me = this;

        if (oldStore) {
            oldStore.un({
                load: me.sync,
                beforeload: me.sync,
                scope: me
            });
        }

        if (store) {
            store.on({
                load: me.sync,
                beforeload: me.sync,
                scope: me
            });
            me.sync();
        }
    },

    updateNoun: function () {
        this.sync();
    },

    onPrev: function () {
        this.getStore().previousPage();
    },

    onNext: function () {
        this.getStore().nextPage();
    },

    /** Refresh the summary text and the enabled state of the buttons. */
    sync: function () {
        var me = this,
            store = me.getStore(),
            summary = me.lookup('summary'),
            prev = me.lookup('prevButton'),
            next = me.lookup('nextButton'),
            total, pageSize, pages, page, loading;

        if (!store || !summary || me.destroyed) {
            return;
        }

        total = store.getTotalCount() || 0;
        pageSize = store.getPageSize() || 1;
        pages = Math.max(1, Math.ceil(total / pageSize));
        page = Math.min(store.currentPage || 1, pages);
        loading = store.isLoading();

        summary.setHtml(total === 0 ?
            'No ' + Ext.String.htmlEncode(me.getNoun()) :
            'Page ' + page + ' of ' + pages + ' • ' +
                FinApp.util.Format.integer(total) + ' ' + Ext.String.htmlEncode(me.getNoun()));

        prev.setDisabled(loading || page <= 1);
        next.setDisabled(loading || page >= pages);
    }
});

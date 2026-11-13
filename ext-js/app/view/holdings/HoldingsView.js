/**
 * Holdings Explorer (CLAUDE.md section 3.2). Placeholder until Phase 4.
 */
Ext.define('FinApp.view.holdings.HoldingsView', {
    extend: 'FinApp.view.shared.PlaceholderView',
    xtype: 'holdings-view',

    requires: [
        'FinApp.view.shared.PlaceholderView'
    ],

    heading: 'Holdings Explorer',
    subheading: 'Browse positions, companies and recent simulated trades • Simulated data',
    phaseText: 'Placeholder: the Holdings Explorer is built in Phase 4. It will contain:',
    planned: [
        'Modern grid with remote sort, filter and paging; group by sector or portfolio',
        'Company detail panel with simulated price chart, position summary and recent transactions',
        'Trade Simulator dialog (simulated Buy / Sell, server-side price)',
        'Transactions view with portfolio, ticker, side and date filters',
        'Export of the filtered grid (CSV; the Exporter package is not installed in this SDK)'
    ]
});

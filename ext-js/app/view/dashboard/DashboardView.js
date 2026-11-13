/**
 * Portfolio Dashboard (CLAUDE.md section 3.1). Placeholder until Phase 3.
 */
Ext.define('FinApp.view.dashboard.DashboardView', {
    extend: 'FinApp.view.shared.PlaceholderView',
    xtype: 'dashboard-view',

    requires: [
        'FinApp.view.shared.PlaceholderView'
    ],

    heading: 'Portfolio Dashboard',
    subheading: 'Investment portfolio overview and performance • Simulated data',
    phaseText: 'Placeholder: the Dashboard is built in Phase 3. It will contain:',
    planned: [
        'KPI cards: Portfolio Value, Total Gain/Loss, Daily Change, Invested Cost Basis, Cash Balance',
        'Portfolio value chart with 1M / 3M / 6M / 1Y / All ranges',
        'Sector allocation donut chart with legend (cash excluded)',
        'Top five and bottom five performing holdings',
        'Portfolio summary table with value, gain/loss, allocation and cash',
        'Loading, empty and error states'
    ]
});

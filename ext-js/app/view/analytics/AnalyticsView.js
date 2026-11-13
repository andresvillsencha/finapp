/**
 * Portfolio Analytics (CLAUDE.md section 3.3). Placeholder until Phase 5.
 */
Ext.define('FinApp.view.analytics.AnalyticsView', {
    extend: 'FinApp.view.shared.PlaceholderView',
    xtype: 'analytics-view',

    requires: [
        'FinApp.view.shared.PlaceholderView'
    ],

    heading: 'Portfolio Analytics',
    subheading: 'Comparisons and exposure analysis • Simulated data',
    phaseText: 'Placeholder: Portfolio Analytics is built in Phase 5. It will contain:',
    planned: [
        'Grouped aggregation grid: Sector → Company by Portfolio (Pivot Grid is not installed in this SDK, so the labelled fallback is used)',
        'Sector exposure comparison chart across portfolios',
        'Normalized performance comparison (start = 100) with simulated benchmarks',
        'CSV export of the analysis results'
    ]
});

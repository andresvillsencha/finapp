/**
 * FinApp.util.Palette
 *
 * Chart colours shared by charts and their HTML legends so both always match.
 * The first colour is the accent blue used across the application.
 */
Ext.define('FinApp.util.Palette', {
    singleton: true,

    primary: '#1d5fd1',

    /** One colour per sector slice (up to 10 sectors in the demo data). */
    sectors: [
        '#1d5fd1', '#38bdf8', '#22c55e', '#8b5cf6', '#c4b5fd',
        '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#64748b'
    ],

    /** Neutral, dashed-line colours for the simulated benchmarks. */
    benchmarks: ['#475569', '#94a3b8'],

    benchmark: function (index) {
        return this.benchmarks[index % this.benchmarks.length];
    },

    /** Colour for the n-th slice (wraps around if there are more slices). */
    sector: function (index) {
        return this.sectors[index % this.sectors.length];
    }
});

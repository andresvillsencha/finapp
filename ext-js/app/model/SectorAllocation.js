/**
 * Equity market value by sector (GET /api/sector-allocation). Cash is excluded;
 * allocation_pct is the sector's share of equity market value.
 */
Ext.define('FinApp.model.SectorAllocation', {
    extend: 'FinApp.model.Base',

    fields: [
        { name: 'sector', type: 'string' },
        { name: 'market_value', type: 'number' },
        { name: 'allocation_pct', type: 'number', allowNull: true },
        { name: 'position_count', type: 'int' }
    ]
});

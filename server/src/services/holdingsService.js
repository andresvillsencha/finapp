'use strict';

/**
 * Holdings read model: one row per (portfolio, company) open position, with
 * server-calculated derived values. Remote filter / sort / paging follow the
 * Ext JS conventions in utils/query.js. Allocation % is computed against the
 * whole selected portfolio scope BEFORE any filtering or paging.
 */
const { usd, pct } = require('../utils/money');
const { buildView } = require('./valuation');
const { resolveScope } = require('./portfolioService');
const { runCollectionQuery } = require('../utils/query');
const { toCsv } = require('../utils/csv');

const NUMBER = { type: 'number' };
const TEXT = { type: 'string' };

const HOLDINGS_SCHEMA = {
    symbol: TEXT, company: TEXT, sector: TEXT, industry: TEXT, portfolio_name: TEXT,
    portfolio_id: NUMBER, company_id: NUMBER, quantity: NUMBER, average_cost: NUMBER,
    current_price: NUMBER, day_change: NUMBER, day_change_pct: NUMBER, market_value: NUMBER,
    cost_basis: NUMBER, unrealized_pl: NUMBER, unrealized_pl_pct: NUMBER, allocation_pct: NUMBER
};
const HOLDINGS_SORTABLE = new Set([...Object.keys(HOLDINGS_SCHEMA), 'id']);

/** Position DTOs (dollars) for every portfolio in the scope. */
function holdingRows(ctx, view, scope) {
    let equityCents = 0;
    for (const portfolio of scope.portfolios) {
        for (const r of view.byPortfolio.get(portfolio.id).rows) {
            equityCents += r.market_value_cents;
        }
    }
    const out = [];
    for (const portfolio of scope.portfolios) {
        for (const r of view.byPortfolio.get(portfolio.id).rows) {
            const company = ctx.fixtures.companiesById.get(r.company_id);
            out.push({
                id: `${portfolio.id}:${company.id}`,
                portfolio_id: portfolio.id,
                portfolio_name: portfolio.name,
                company_id: company.id,
                symbol: company.symbol,
                company: company.name,
                sector: company.sector,
                industry: company.industry,
                quantity: r.quantity,
                average_cost: Math.round((r.cost_cents / r.quantity) * 100) / 10000,
                current_price: usd(r.price_cents),
                previous_price: usd(r.prev_price_cents),
                day_change: usd(r.price_cents - r.prev_price_cents),
                day_change_pct: pct(r.price_cents - r.prev_price_cents, r.prev_price_cents),
                market_value: usd(r.market_value_cents),
                cost_basis: usd(r.cost_cents),
                unrealized_pl: usd(r.unrealized_pl_cents),
                unrealized_pl_pct: pct(r.unrealized_pl_cents, r.cost_cents),
                daily_pl: usd(r.daily_pl_cents),
                allocation_pct: pct(r.market_value_cents, equityCents)
            });
        }
    }
    return out;
}

function queryHoldings(ctx, snapshot, query, { paged = true } = {}) {
    const scope = resolveScope(ctx, query.portfolioId);
    const view = buildView(ctx, snapshot);
    const rows = holdingRows(ctx, view, scope);
    const result = runCollectionQuery(rows, query, {
        schema: HOLDINGS_SCHEMA,
        sortable: HOLDINGS_SORTABLE,
        settings: ctx.settings,
        defaultSort: [{ property: 'market_value', direction: 'DESC' }],
        tieBreak: 'id',
        paged
    });
    return { ...result, scope };
}

const CSV_COLUMNS = [
    { header: 'Company', key: 'company' },
    { header: 'Ticker', key: 'symbol' },
    { header: 'Sector', key: 'sector' },
    { header: 'Portfolio', key: 'portfolio_name' },
    { header: 'Quantity', key: 'quantity' },
    { header: 'Average Cost', key: 'average_cost' },
    { header: 'Current Price', key: 'current_price' },
    { header: 'Market Value', key: 'market_value' },
    { header: 'Cost Basis', key: 'cost_basis' },
    { header: 'Unrealized P/L', key: 'unrealized_pl' },
    { header: 'Unrealized P/L %', key: 'unrealized_pl_pct' },
    { header: 'Allocation %', key: 'allocation_pct' }
];

/** CSV of the filtered/sorted holdings (all matching rows, no paging). */
function exportHoldingsCsv(ctx, snapshot, query) {
    const { data } = queryHoldings(ctx, snapshot, query, { paged: false });
    return toCsv(CSV_COLUMNS, data);
}

module.exports = { holdingRows, queryHoldings, exportHoldingsCsv, HOLDINGS_SCHEMA };

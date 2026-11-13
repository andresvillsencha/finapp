'use strict';

/**
 * Portfolio-level read models: portfolio list/detail, dashboard KPIs, value
 * history and sector allocation. All numbers come from valuation.js (one
 * snapshot tick per request) and are converted from cents at the DTO boundary.
 */
const { badRequest, notFound } = require('../utils/errors');
const { usd, pct } = require('../utils/money');
const { buildView, combineSummaries, sampleHistory } = require('./valuation');

const HISTORY_POINTS = 120;

/** 'all' (default) or a portfolio id -> { id, name, portfolios[] }. */
function resolveScope(ctx, raw) {
    const { portfolios, portfoliosById } = ctx.fixtures;
    if (raw === undefined || raw === '' || String(raw).toLowerCase() === 'all') {
        return { id: 'all', name: 'All Portfolios', portfolios: [...portfolios] };
    }
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
        throw badRequest('INVALID_PORTFOLIO_ID', 'Parameter "portfolioId" must be "all" or a portfolio id.');
    }
    const portfolio = portfoliosById.get(Number(raw));
    if (!portfolio) {
        throw notFound('PORTFOLIO_NOT_FOUND', `Portfolio ${raw} does not exist.`);
    }
    return { id: portfolio.id, name: portfolio.name, portfolios: [portfolio] };
}

function resolveRange(ctx, raw) {
    const range = raw === undefined || raw === '' ? ctx.settings.default_chart_range : String(raw).toUpperCase();
    if (!ctx.settings.chart_ranges.includes(range)) {
        throw badRequest('INVALID_RANGE', `Parameter "range" must be one of ${ctx.settings.chart_ranges.join(', ')}.`);
    }
    return range;
}

function scopeSummary(view, scope) {
    return combineSummaries(scope.portfolios.map((p) => view.byPortfolio.get(p.id).summary));
}

/**
 * KPI block. Definitions (CLAUDE.md section 4):
 *  - total_gain_loss      = investment P/L = realized + unrealized
 *  - total_gain_loss_pct  = investment P/L / initial funding (return on initial funding)
 *  - daily_change(_pct)   = indicative price change since the start of the UTC day
 */
function kpiDto(S) {
    return {
        portfolio_value: usd(S.portfolio_value_cents),
        total_gain_loss: usd(S.investment_pl_cents),
        total_gain_loss_pct: pct(S.investment_pl_cents, S.initial_cash_cents),
        daily_change: usd(S.daily_pl_cents),
        daily_change_pct: pct(S.daily_pl_cents, S.portfolio_value_cents - S.daily_pl_cents),
        cost_basis: usd(S.cost_basis_cents),
        cash_balance: usd(S.cash_cents),
        market_value: usd(S.market_value_cents),
        unrealized_pl: usd(S.unrealized_pl_cents),
        unrealized_pl_pct: pct(S.unrealized_pl_cents, S.cost_basis_cents),
        realized_pl: usd(S.realized_pl_cents),
        initial_funding: usd(S.initial_cash_cents),
        position_count: S.position_count
    };
}

function portfolioDto(portfolio, S) {
    return {
        id: portfolio.id,
        name: portfolio.name,
        strategy: portfolio.strategy,
        risk_profile: portfolio.risk_profile,
        description: portfolio.description,
        currency: portfolio.currency,
        status: portfolio.status,
        created_at: portfolio.created_at,
        ...kpiDto(S)
    };
}

function listPortfolios(ctx, snapshot) {
    const view = buildView(ctx, snapshot);
    return ctx.fixtures.portfolios.map((p) => portfolioDto(p, view.byPortfolio.get(p.id).summary));
}

function getPortfolio(ctx, snapshot, rawId) {
    if (typeof rawId !== 'string' || !/^\d+$/.test(rawId)) {
        throw badRequest('INVALID_PORTFOLIO_ID', 'Portfolio id must be an integer.');
    }
    const portfolio = ctx.fixtures.portfoliosById.get(Number(rawId));
    if (!portfolio) {
        throw notFound('PORTFOLIO_NOT_FOUND', `Portfolio ${rawId} does not exist.`);
    }
    const view = buildView(ctx, snapshot);
    return portfolioDto(portfolio, view.byPortfolio.get(portfolio.id).summary);
}

/** Aggregate open positions by company across the scope and rank by return %. */
function performers(ctx, view, scope) {
    const byCompany = new Map();
    for (const portfolio of scope.portfolios) {
        for (const r of view.byPortfolio.get(portfolio.id).rows) {
            const a = byCompany.get(r.company_id) || {
                company_id: r.company_id, quantity: 0, cost: 0, mv: 0, daily: 0, price: r.price_cents, prev: r.prev_price_cents
            };
            a.quantity += r.quantity;
            a.cost += r.cost_cents;
            a.mv += r.market_value_cents;
            a.daily += r.daily_pl_cents;
            byCompany.set(r.company_id, a);
        }
    }
    const list = [...byCompany.values()].filter((a) => a.cost > 0).map((a) => {
        const company = ctx.fixtures.companiesById.get(a.company_id);
        const upl = a.mv - a.cost;
        return {
            company_id: a.company_id,
            symbol: company.symbol,
            company: company.name,
            sector: company.sector,
            quantity: a.quantity,
            average_cost: Math.round((a.cost / a.quantity) * 100) / 10000,
            current_price: usd(a.price),
            market_value: usd(a.mv),
            cost_basis: usd(a.cost),
            unrealized_pl: usd(upl),
            unrealized_pl_pct: pct(upl, a.cost),
            day_change: usd(a.price - a.prev),
            day_change_pct: pct(a.price - a.prev, a.prev),
            daily_pl: usd(a.daily)
        };
    });
    list.sort((x, y) => (y.unrealized_pl_pct - x.unrealized_pl_pct) || (x.company_id - y.company_id));
    const top = list.slice(0, 5);
    const topIds = new Set(top.map((t) => t.company_id));
    // Worst first; a holding never appears in both lists when there are fewer than 10.
    const bottom = list.filter((x) => !topIds.has(x.company_id)).reverse().slice(0, 5);
    return { top, bottom };
}

function getDashboard(ctx, snapshot, query) {
    const scope = resolveScope(ctx, query.portfolioId);
    const range = resolveRange(ctx, query.range);
    const view = buildView(ctx, snapshot);
    const summary = scopeSummary(view, scope);
    const totalValue = summary.portfolio_value_cents;
    const { top, bottom } = performers(ctx, view, scope);
    return {
        data: {
            scope: { portfolio_id: scope.id, name: scope.name },
            kpis: kpiDto(summary),
            top_performers: top,
            bottom_performers: bottom,
            portfolio_summary: scope.portfolios.map((p) => {
                const S = view.byPortfolio.get(p.id).summary;
                return { ...portfolioDto(p, S), allocation_pct: pct(S.portfolio_value_cents, totalValue) };
            }),
            definitions: {
                total_gain_loss: 'Investment P/L = realized trading P/L + unrealized trading P/L.',
                total_gain_loss_pct: 'Investment P/L divided by initial funding (return on initial funding).',
                daily_change: 'Indicative price change since the start of the current UTC day; not a time-weighted return.',
                allocation: 'Portfolio allocation is the portfolio share of total value; sector allocation excludes cash.'
            }
        },
        range
    };
}

/** Value history sampled from the same price function as spot values. */
function getHistory(ctx, snapshot, query) {
    const scope = resolveScope(ctx, query.portfolioId);
    const range = resolveRange(ctx, query.range);
    const { simulator } = ctx;
    const endTick = snapshot.tickIndex;
    const earliest = Math.min(...scope.portfolios.map((p) => simulator.tickAtOrAfter(Date.parse(p.created_at))));
    const days = simulator.rangeDays(range);
    let startTick = days === null ? earliest : Math.max(earliest, endTick - Math.round(days * simulator.ticksPerDay));
    startTick = Math.min(startTick, endTick);

    const ticks = simulator.sampleTicks(startTick, endTick, HISTORY_POINTS);
    const ids = scope.portfolios.map((p) => p.id);
    const initial = scope.portfolios.reduce((sum, p) => sum + p.initial_cash_cents, 0);
    const rows = sampleHistory(ctx, ids, ticks).map((sample) => {
        let cash = 0;
        let marketValue = 0;
        for (const id of ids) {
            const s = sample.byPortfolio.get(id);
            cash += s.cash_cents;
            marketValue += s.market_value_cents;
        }
        const value = cash + marketValue;
        return {
            timestamp: new Date(sample.ms).toISOString(),
            tick_index: sample.tick,
            portfolio_value: usd(value),
            cash_balance: usd(cash),
            market_value: usd(marketValue),
            investment_pl: usd(value - initial),
            investment_pl_pct: pct(value - initial, initial)
        };
    });
    return {
        rows,
        meta: {
            portfolioId: scope.id,
            range,
            timeScale: 'SIMULATED_TIME',
            points: rows.length,
            rangeStart: rows[0].timestamp,
            simulatedSpanDays: Math.round(((endTick - startTick) / simulator.ticksPerDay) * 100) / 100
        }
    };
}

/** Sector allocation of EQUITY market value (cash is excluded). */
function getSectorAllocation(ctx, snapshot, query) {
    const scope = resolveScope(ctx, query.portfolioId);
    const view = buildView(ctx, snapshot);
    const bySector = new Map();
    let total = 0;
    for (const portfolio of scope.portfolios) {
        for (const r of view.byPortfolio.get(portfolio.id).rows) {
            const sector = ctx.fixtures.companiesById.get(r.company_id).sector;
            const entry = bySector.get(sector) || { sector, mv: 0, positions: new Set() };
            entry.mv += r.market_value_cents;
            entry.positions.add(r.company_id);
            bySector.set(sector, entry);
            total += r.market_value_cents;
        }
    }
    const rows = [...bySector.values()]
        .sort((a, b) => (b.mv - a.mv) || a.sector.localeCompare(b.sector))
        .map((e) => ({
            sector: e.sector,
            market_value: usd(e.mv),
            allocation_pct: pct(e.mv, total),
            position_count: e.positions.size
        }));
    return { rows, meta: { portfolioId: scope.id, basis: 'EQUITY_MARKET_VALUE_EXCLUDING_CASH' } };
}

module.exports = {
    resolveScope,
    resolveRange,
    scopeSummary,
    kpiDto,
    listPortfolios,
    getPortfolio,
    getDashboard,
    getHistory,
    getSectorAllocation,
    HISTORY_POINTS
};

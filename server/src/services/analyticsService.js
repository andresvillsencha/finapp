'use strict';

/**
 * Analytics read models: pivot/grouping source rows, normalized portfolio
 * performance comparison (start = 100) with simulated benchmarks, and the
 * portfolio-by-sector exposure comparison.
 */
const { usd, pct, round } = require('../utils/money');
const { badRequest } = require('../utils/errors');
const { toCsv } = require('../utils/csv');
const { buildView, sampleHistory } = require('./valuation');
const { resolveScope, resolveRange, HISTORY_POINTS } = require('./portfolioService');

/**
 * Flat position rows used as the source for a Pivot Grid or the grouped
 * aggregation fallback: Sector -> Company, columns by Portfolio, measures
 * Market Value / Cost Basis / Unrealized P/L.
 */
function pivotRows(ctx, snapshot, query) {
    const scope = resolveScope(ctx, query.portfolioId);
    const view = buildView(ctx, snapshot);
    const rows = [];
    for (const portfolio of scope.portfolios) {
        for (const r of view.byPortfolio.get(portfolio.id).rows) {
            const company = ctx.fixtures.companiesById.get(r.company_id);
            rows.push({
                id: `${portfolio.id}:${company.id}`,
                sector: company.sector,
                company_id: company.id,
                symbol: company.symbol,
                company: company.name,
                portfolio_id: portfolio.id,
                portfolio_name: portfolio.name,
                quantity: r.quantity,
                market_value: usd(r.market_value_cents),
                cost_basis: usd(r.cost_cents),
                unrealized_pl: usd(r.unrealized_pl_cents)
            });
        }
    }
    rows.sort((a, b) => a.sector.localeCompare(b.sector) || a.company.localeCompare(b.company) || (a.portfolio_id - b.portfolio_id));
    return { rows, scope };
}

const PIVOT_MEASURES = [
    { key: 'market_value', label: 'Market Value', cents: 'market_value_cents' },
    { key: 'cost_basis', label: 'Cost Basis', cents: 'cost_cents' },
    { key: 'unrealized_pl', label: 'Unrealized P/L', cents: 'unrealized_pl_cents' }
];
const PIVOT_LAYOUTS = ['flat', 'wide'];

/** Cents accumulator keyed by portfolio id and measure (exact integer arithmetic). */
function newBucket() {
    return { count: 0, cents: new Map(), total: new Map() };
}

function addToBucket(bucket, portfolioId, r) {
    for (const m of PIVOT_MEASURES) {
        const key = `${portfolioId}:${m.key}`;
        bucket.cents.set(key, (bucket.cents.get(key) || 0) + r[m.cents]);
        bucket.total.set(m.key, (bucket.total.get(m.key) || 0) + r[m.cents]);
    }
}

/** Bucket to API fields: portfolio_<id>_<measure> (null when the portfolio holds none) and total_<measure>. */
function bucketFields(bucket, portfolios, zeroFill = false) {
    const out = {};
    for (const p of portfolios) {
        for (const m of PIVOT_MEASURES) {
            const key = `${p.id}:${m.key}`;
            // null = "this portfolio holds none here"; the grand total of a portfolio is 0 instead.
            out[`portfolio_${p.id}_${m.key}`] = bucket.cents.has(key) ? usd(bucket.cents.get(key)) : (zeroFill ? 0 : null);
        }
    }
    for (const m of PIVOT_MEASURES) {
        out[`total_${m.key}`] = usd(bucket.total.get(m.key) || 0);
    }
    return out;
}

/**
 * Pivot in its WIDE layout: one row per company (Sector -> Company), one column per
 * portfolio and measure, plus a total column. Subtotals per sector (meta.groups) and the
 * grand total (meta.grand) are summed here in exact cents, so a client never has to add
 * money up. A company that a portfolio does not hold is null in that portfolio's columns.
 */
function pivotWide(ctx, snapshot, query) {
    const scope = resolveScope(ctx, query.portfolioId);
    const view = buildView(ctx, snapshot);
    const portfolios = scope.portfolios;
    const byCompany = new Map();
    const bySector = new Map();
    const grand = newBucket();
    for (const portfolio of portfolios) {
        for (const r of view.byPortfolio.get(portfolio.id).rows) {
            const company = ctx.fixtures.companiesById.get(r.company_id);
            if (!byCompany.has(company.id)) {
                byCompany.set(company.id, { company, bucket: newBucket() });
            }
            if (!bySector.has(company.sector)) {
                bySector.set(company.sector, newBucket());
            }
            addToBucket(byCompany.get(company.id).bucket, portfolio.id, r);
            addToBucket(bySector.get(company.sector), portfolio.id, r);
            addToBucket(grand, portfolio.id, r);
        }
    }
    const rows = [...byCompany.values()]
        .sort((a, b) => a.company.sector.localeCompare(b.company.sector) || a.company.name.localeCompare(b.company.name))
        .map(({ company, bucket }) => {
            bySector.get(company.sector).count += 1;
            return {
                id: `company:${company.id}`,
                sector: company.sector,
                company_id: company.id,
                symbol: company.symbol,
                company: company.name,
                ...bucketFields(bucket, portfolios)
            };
        });
    const groups = {};
    for (const [sector, bucket] of bySector) {
        groups[sector] = { count: bucket.count, ...bucketFields(bucket, portfolios) };
    }
    grand.count = rows.length;
    return {
        rows,
        scope,
        meta: {
            layout: 'wide',
            portfolioId: scope.id,
            portfolios: portfolios.map((p) => ({ id: p.id, name: p.name, key: `portfolio_${p.id}` })),
            measures: PIVOT_MEASURES.map((m) => ({ key: m.key, label: m.label })),
            groups,
            grand: { count: grand.count, ...bucketFields(grand, portfolios, true) },
            note: 'Subtotals and totals are calculated by the server in exact cents.'
        }
    };
}

/** CSV of the wide pivot: company rows, a subtotal row per sector and a grand total row. */
function pivotCsv(ctx, snapshot, query) {
    const { rows, meta } = pivotWide(ctx, snapshot, query);
    const columns = [
        { header: 'Sector', key: 'sector' },
        { header: 'Company', key: 'company' },
        { header: 'Ticker', key: 'symbol' }
    ];
    for (const p of meta.portfolios) {
        for (const m of meta.measures) {
            columns.push({ header: `${p.name} - ${m.label}`, key: `${p.key}_${m.key}` });
        }
    }
    for (const m of meta.measures) {
        columns.push({ header: `Total - ${m.label}`, key: `total_${m.key}` });
    }
    const out = [];
    let current = null;
    const flush = () => {
        if (current !== null) {
            out.push({ sector: current, company: `Subtotal - ${current}`, symbol: '', ...meta.groups[current] });
        }
    };
    for (const row of rows) {
        if (row.sector !== current) {
            flush();
            current = row.sector;
        }
        out.push(row);
    }
    flush();
    out.push({ sector: 'Total', company: 'Grand total', symbol: '', ...meta.grand });
    return toCsv(columns, out);
}

/**
 * Normalized performance (start of range = 100) for every portfolio plus the
 * simulated benchmarks, in a flat shape that Ext JS charts can bind to:
 * one record per sampled tick with one numeric field per series.
 * meta.series describes the fields.
 */
function comparison(ctx, snapshot, query) {
    const range = resolveRange(ctx, query.range);
    const { simulator } = ctx;
    const portfolios = ctx.fixtures.portfolios;
    const endTick = snapshot.tickIndex;
    const earliest = Math.min(...portfolios.map((p) => simulator.tickAtOrAfter(Date.parse(p.created_at))));
    const days = simulator.rangeDays(range);
    let startTick = days === null ? earliest : Math.max(earliest, endTick - Math.round(days * simulator.ticksPerDay));
    startTick = Math.min(startTick, endTick);

    const ticks = simulator.sampleTicks(startTick, endTick, HISTORY_POINTS);
    const ids = portfolios.map((p) => p.id);
    const samples = sampleHistory(ctx, ids, ticks);
    const benchmarks = ctx.fixtures.benchmarks;

    const series = [
        ...portfolios.map((p) => ({ key: `portfolio_${p.id}`, id: p.id, name: p.name, type: 'PORTFOLIO' })),
        ...benchmarks.map((b) => ({ key: `benchmark_${b.id}`, id: b.id, name: b.name, type: 'BENCHMARK' }))
    ];
    const value = (sample, portfolioId) => {
        const s = sample.byPortfolio.get(portfolioId);
        return s.cash_cents + s.market_value_cents;
    };
    const baseValues = new Map(portfolios.map((p) => [p.id, value(samples[0], p.id)]));
    const baseLevels = new Map(benchmarks.map((b) => [b.id, simulator.benchmarkLevel(b.id, ticks[0])]));

    const rows = samples.map((sample) => {
        const row = { timestamp: new Date(sample.ms).toISOString(), tick_index: sample.tick };
        for (const p of portfolios) {
            const base = baseValues.get(p.id);
            row[`portfolio_${p.id}`] = base > 0 ? round((value(sample, p.id) / base) * 100, 4) : null;
        }
        for (const b of benchmarks) {
            const base = baseLevels.get(b.id);
            row[`benchmark_${b.id}`] = round((simulator.benchmarkLevel(b.id, sample.tick) / base) * 100, 4);
        }
        return row;
    });
    return {
        rows,
        meta: {
            range,
            base: 100,
            timeScale: 'SIMULATED_TIME',
            points: rows.length,
            rangeStart: rows[0].timestamp,
            simulatedSpanDays: round((endTick - startTick) / simulator.ticksPerDay, 2),
            series,
            note: 'Portfolio series include cash; contributions and withdrawals are not modeled. Benchmarks are simulated, not real indices.'
        }
    };
}

/**
 * Exposure by sector for each portfolio (equity market value, cash excluded).
 * One record per sector with market-value and percent-of-portfolio fields per
 * portfolio.
 */
function sectorComparison(ctx, snapshot) {
    const portfolios = ctx.fixtures.portfolios;
    const view = buildView(ctx, snapshot);
    const sectors = new Map();
    const equity = new Map(portfolios.map((p) => [p.id, 0]));
    for (const p of portfolios) {
        for (const r of view.byPortfolio.get(p.id).rows) {
            const sector = ctx.fixtures.companiesById.get(r.company_id).sector;
            const entry = sectors.get(sector) || new Map();
            entry.set(p.id, (entry.get(p.id) || 0) + r.market_value_cents);
            sectors.set(sector, entry);
            equity.set(p.id, equity.get(p.id) + r.market_value_cents);
        }
    }
    const rows = [...sectors.entries()]
        .map(([sector, byPortfolio]) => {
            const row = { sector };
            let total = 0;
            for (const p of portfolios) {
                const mv = byPortfolio.get(p.id) || 0;
                total += mv;
                row[`portfolio_${p.id}`] = usd(mv);
                row[`portfolio_${p.id}_pct`] = pct(mv, equity.get(p.id)) || 0;
            }
            row.total = usd(total);
            return row;
        })
        .sort((a, b) => (b.total - a.total) || a.sector.localeCompare(b.sector));
    return {
        rows,
        meta: {
            basis: 'EQUITY_MARKET_VALUE_EXCLUDING_CASH',
            portfolios: portfolios.map((p) => ({
                key: `portfolio_${p.id}`,
                pct_key: `portfolio_${p.id}_pct`,
                id: p.id,
                name: p.name
            }))
        }
    };
}

/** Throws 400 INVALID_LAYOUT unless the pivot layout is flat (default) or wide. */
function resolveLayout(raw) {
    const layout = raw === undefined || raw === '' ? 'flat' : raw;
    if (!PIVOT_LAYOUTS.includes(layout)) {
        throw badRequest('INVALID_LAYOUT', 'Parameter "layout" must be flat or wide.');
    }
    return layout;
}

module.exports = { pivotRows, pivotWide, pivotCsv, resolveLayout, comparison, sectorComparison };

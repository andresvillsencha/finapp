'use strict';

/**
 * npm run demo:verify
 *
 * Consistency checker (read-only). Verifies fixture references, funding and
 * trade history, portfolio arithmetic, and reproducible spot/history pricing at
 * fixed timestamps. Exits with code 1 if any check fails.
 */
const { getConfig } = require('../src/config');
const { createContext } = require('../src/context');
const { createMarketSimulator } = require('../src/services/marketSimulator');
const { fixedClock } = require('../src/utils/clock');
const { StartupError } = require('../src/utils/errors');
const { buildView, combineSummaries } = require('../src/services/valuation');
const portfolios = require('../src/services/portfolioService');
const holdings = require('../src/services/holdingsService');

const FIXED_NOW = Date.parse('2026-11-13T12:00:00Z'); // fixed "current" time for the checks
const FIXED_PRICE_TIME = Date.parse('2025-06-01T12:00:00Z');

const results = [];
function check(name, ok, detail = '') {
    results.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`);
}

function main() {
    console.log('PortfolioIQ demo:verify (SIMULATED DATA)');
    const config = getConfig();
    const silent = { log() {}, error() {} };
    let ctx;
    try {
        ctx = createContext({
            fixturesDir: config.fixturesDir,
            runtimeDir: config.runtimeDir,
            clock: fixedClock(FIXED_NOW),
            scenarioId: config.scenarioId,
            logger: silent
        });
        check('Fixtures load and validate (references, IDs, types)', true,
            `${ctx.fixtures.companies.length} companies, ${ctx.fixtures.portfolios.length} portfolios, ${ctx.fixtures.transactions.length} baseline trades`);
    } catch (err) {
        if (err instanceof StartupError) {
            check('Fixtures and journal load and validate', false, err.message);
            err.issues.slice(0, 20).forEach((issue) => console.log(`        - ${issue}`));
            process.exit(1);
        }
        throw err;
    }

    const { simulator, ledger, fixtures } = ctx;
    check('Journal replays with no negative cash, no oversells, no trade before funding', ledger.validate().length === 0,
        `${ledger.all.length} transactions (${ctx.journal.transactions.length} runtime)`);

    // --- price reproducibility ---
    const fresh = createMarketSimulator({
        marketConfig: fixtures.marketConfig, scenarios: fixtures.scenarios, benchmarks: fixtures.benchmarks,
        clock: fixedClock(FIXED_NOW), scenarioId: config.scenarioId
    });
    const tick = simulator.tickAtOrBefore(FIXED_PRICE_TIME);
    const ids = fixtures.companies.map((c) => c.id);
    const spot = (sim, t) => ids.map((id) => sim.priceCents(id, t));
    const a = spot(simulator, tick);
    const b = spot(fresh, tick);
    check('Same company + tick gives identical prices (two independent simulator instances)',
        a.every((p, i) => p === b[i]), `tick ${tick} (${new Date(FIXED_PRICE_TIME).toISOString()})`);
    const c = spot(simulator, tick + 1);
    check('Prices change as ticks advance', a.some((p, i) => p !== c[i]));

    // --- price sanity over a window ---
    let minPrice = Infinity;
    let maxMove = 0;
    for (const id of ids) {
        let previous = simulator.priceCents(id, tick);
        for (let t = tick + 1; t <= tick + 1500; t += 1) {
            const p = simulator.priceCents(id, t);
            minPrice = Math.min(minPrice, p);
            maxMove = Math.max(maxMove, Math.abs(p - previous) / previous);
            previous = p;
        }
    }
    const floor = fixtures.marketConfig.simulation.price_floor_cents;
    check('All sampled prices are finite and at or above the price floor', minPrice >= floor, `min ${minPrice / 100}`);
    check('Per-tick moves stay within the configured bound (30 bps + cent rounding)', maxMove <= 0.0031 + 1 / (floor * 4),
        `max ${(maxMove * 10000).toFixed(1)} bps`);

    // --- accounting identities at the fixed current tick ---
    const snapshot = simulator.snapshot();
    const view = buildView(ctx, snapshot);
    let identityOk = true;
    for (const p of fixtures.portfolios) {
        const S = view.byPortfolio.get(p.id).summary;
        if (S.portfolio_value_cents - S.initial_cash_cents !== S.realized_pl_cents + S.unrealized_pl_cents) {
            identityOk = false;
        }
    }
    check('Per portfolio: value - initial funding = realized P/L + unrealized P/L', identityOk);

    const all = portfolios.resolveScope(ctx, 'all');
    const allSummary = combineSummaries(all.portfolios.map((p) => view.byPortfolio.get(p.id).summary));
    const sumOfParts = fixtures.portfolios.reduce((sum, p) => sum + view.byPortfolio.get(p.id).summary.portfolio_value_cents, 0);
    check('All Portfolios value equals the sum of the individual portfolios', allSummary.portfolio_value_cents === sumOfParts);

    const dash = portfolios.getDashboard(ctx, snapshot, { portfolioId: 'all', range: '1Y' }).data;
    const hist = portfolios.getHistory(ctx, snapshot, { portfolioId: 'all', range: '1Y' }).rows;
    check('History at the current tick matches current portfolio value',
        hist[hist.length - 1].portfolio_value === dash.kpis.portfolio_value,
        `${hist[hist.length - 1].portfolio_value}`);

    const hv = holdings.queryHoldings(ctx, snapshot, { portfolioId: 'all' }, { paged: false }).data
        .reduce((sum, r) => sum + Math.round(r.market_value * 100), 0);
    check('Holdings market value subtotal matches the dashboard market value', hv === Math.round(dash.kpis.market_value * 100));

    // --- information only: baseline fill prices vs the price function ---
    const deviations = fixtures.transactions.map((t) => {
        const p = simulator.priceCents(t.company_id, simulator.tickAtOrBefore(Date.parse(t.executed_at)));
        return Math.abs(t.execution_price_cents - p) / p;
    });
    const mean = deviations.reduce((s, d) => s + d, 0) / deviations.length;
    const max = Math.max(...deviations);
    console.log(`INFO  Baseline fills vs simulator price at the trade time: mean ${(mean * 100).toFixed(1)}%, max ${(max * 100).toFixed(1)}% `
        + '(fixtures are never regenerated; history marks positions to the simulator price)');

    const failed = results.filter((r) => !r.ok).length;
    console.log(failed === 0 ? `\nAll ${results.length} checks passed.` : `\n${failed} of ${results.length} checks FAILED.`);
    process.exit(failed === 0 ? 0 : 1);
}

main();

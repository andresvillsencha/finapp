'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { startServer, fixtureHashes, q, tempRuntimeDir } = require('./helpers');
const { writeJsonAtomic } = require('../src/utils/atomicWrite');

const cents = (x) => Math.round(x * 100);

/** Start a server and register cleanup with the test. */
async function server(t, options) {
    const s = await startServer(options);
    t.after(() => s.close());
    return s;
}

function assertCollection(res, label) {
    assert.equal(res.status, 200, `${label}: status`);
    assert.equal(res.json.success, true, `${label}: success`);
    assert.ok(Array.isArray(res.json.data), `${label}: data is an array`);
    assert.equal(typeof res.json.total, 'number', `${label}: total is a number`);
    assert.ok(res.json.meta && typeof res.json.meta.asOf === 'string', `${label}: meta.asOf`);
    assert.equal(typeof res.json.meta.tickIndex, 'number', `${label}: meta.tickIndex`);
    assert.equal(res.json.meta.simulationMode, 'DEMO');
}

function assertRecord(res, label) {
    assert.equal(res.status, 200, `${label}: status`);
    assert.equal(res.json.success, true);
    assert.ok(res.json.data && typeof res.json.data === 'object' && !Array.isArray(res.json.data), `${label}: data is an object`);
    assert.ok(res.json.meta && typeof res.json.meta.asOf === 'string');
}

function assertError(res, status, code) {
    assert.equal(res.status, status);
    assert.equal(res.json.success, false);
    assert.equal(res.json.code, code);
    assert.equal(res.json.error.code, code);
    assert.equal(typeof res.json.message, 'string');
    assert.equal(res.json.error.message, res.json.message);
}

test('health reports fixture and simulator readiness (no database)', async (t) => {
    const s = await server(t);
    const res = await s.get('/health');
    assertRecord(res, 'health');
    assert.equal(res.json.data.status, 'ok');
    assert.equal(res.json.data.fixtures.companies, 80);
    assert.equal(res.json.data.fixtures.portfolios, 5);
    assert.equal(res.json.data.simulator.ready, true);
    assert.doesNotMatch(JSON.stringify(res.json), /mysql|sqlite|postgres|mongo|database/i);
});

test('every read route returns a valid Ext JS envelope', async (t) => {
    const s = await server(t);
    const collections = [
        '/portfolios', '/portfolio-history?portfolioId=all&range=1Y', '/sector-allocation?portfolioId=all',
        '/companies', '/companies/1/prices?range=6M', '/holdings?portfolioId=all', '/transactions?portfolioId=all',
        '/analytics/pivot?portfolioId=all', '/analytics/comparison?range=1Y', '/analytics/sector-comparison'
    ];
    for (const url of collections) {
        const res = await s.get(url);
        assertCollection(res, url);
        assert.ok(res.json.total >= res.json.data.length, `${url}: total >= page size`);
    }
    for (const url of ['/health', '/simulation/status', '/portfolios/1', '/dashboard?portfolioId=all&range=1Y']) {
        assertRecord(await s.get(url), url);
    }
    // A valid empty collection is 200 with data: [] and total: 0.
    const empty = await s.get(`/holdings?filter=${q([{ property: 'symbol', value: 'zzzz' }])}`);
    assertCollection(empty, 'empty');
    assert.deepEqual([empty.json.data, empty.json.total], [[], 0]);
});

test('all screens agree on one snapshot (meta.asOf / meta.tickIndex)', async (t) => {
    const s = await server(t);
    const status = await s.get('/simulation/status');
    const tick = status.json.data.tick_index;
    for (const url of ['/dashboard', '/portfolio-history', '/sector-allocation', '/holdings', '/transactions',
        '/analytics/pivot', '/analytics/comparison', '/analytics/sector-comparison', '/portfolios', '/companies']) {
        const res = await s.get(url);
        assert.equal(res.json.meta.tickIndex, tick, url);
        assert.equal(res.json.meta.asOf, status.json.data.as_of, url);
    }
});

test('?tick= pins a snapshot while the clock advances; prices change on the next tick', async (t) => {
    const s = await server(t);
    const tick = (await s.get('/simulation/status')).json.data.tick_index;
    const before = await s.get(`/holdings?portfolioId=1&limit=100&tick=${tick}`);
    s.clock.advance(20_000); // four ticks later
    const pinned = await s.get(`/holdings?portfolioId=1&limit=100&tick=${tick}`);
    assert.deepEqual(pinned.json.data, before.json.data, 'same tick gives identical results');
    const latest = await s.get('/holdings?portfolioId=1&limit=100');
    assert.equal(latest.json.meta.tickIndex, tick + 4);
    assert.ok(latest.json.data.some((row, i) => row.current_price !== before.json.data.find((b) => b.id === row.id).current_price),
        'prices move as simulated time advances');
    const byAsOf = await s.get(`/holdings?portfolioId=1&limit=100&asOf=${encodeURIComponent(before.json.meta.asOf)}`);
    assert.deepEqual(byAsOf.json.data, before.json.data);
    assertError(await s.get('/holdings?tick=-1'), 400, 'INVALID_TICK');
    assertError(await s.get('/holdings?tick=99999999999'), 400, 'TICK_OUT_OF_RANGE');
    assertError(await s.get(`/holdings?tick=1&asOf=${encodeURIComponent('2025-02-01T00:00:00Z')}`), 400, 'INVALID_SNAPSHOT');
    assertError(await s.get('/holdings?asOf=garbage'), 400, 'INVALID_AS_OF');
    assertError(await s.get(`/holdings?asOf=${encodeURIComponent('2030-01-01T00:00:00Z')}`), 400, 'AS_OF_OUT_OF_RANGE');
});

test('dashboard KPIs, history, holdings and sector allocation reconcile', async (t) => {
    const s = await server(t);
    const dash = (await s.get('/dashboard?portfolioId=all&range=1Y')).json.data;
    const hist = (await s.get('/portfolio-history?portfolioId=all&range=1Y')).json.data;
    assert.equal(hist[hist.length - 1].portfolio_value, dash.kpis.portfolio_value, 'history at the current tick equals the KPI');
    const holdings = (await s.get('/holdings?portfolioId=all&limit=100')).json;
    const all = [];
    for (let start = 0; start < holdings.total; start += 100) {
        all.push(...(await s.get(`/holdings?portfolioId=all&limit=100&start=${start}`)).json.data);
    }
    assert.equal(all.length, holdings.total);
    assert.equal(all.reduce((sum, r) => sum + cents(r.market_value), 0), cents(dash.kpis.market_value));
    assert.equal(all.reduce((sum, r) => sum + cents(r.cost_basis), 0), cents(dash.kpis.cost_basis));
    assert.equal(cents(dash.kpis.portfolio_value), cents(dash.kpis.cash_balance) + cents(dash.kpis.market_value));
    assert.equal(cents(dash.kpis.total_gain_loss), cents(dash.kpis.realized_pl) + cents(dash.kpis.unrealized_pl));

    const sectors = (await s.get('/sector-allocation?portfolioId=all')).json;
    assert.equal(sectors.data.reduce((sum, r) => sum + cents(r.market_value), 0), cents(dash.kpis.market_value), 'cash is excluded from sector allocation');
    assert.ok(Math.abs(sectors.data.reduce((sum, r) => sum + r.allocation_pct, 0) - 100) < 0.01);
    // Allocation % of every holding is relative to the selected scope's equity.
    assert.ok(Math.abs(all.reduce((sum, r) => sum + r.allocation_pct, 0) - 100) < 0.05);
});

test('All Portfolios equals the sum of the individual portfolios', async (t) => {
    const s = await server(t);
    const list = (await s.get('/portfolios')).json.data;
    assert.equal(list.length, 5);
    const dash = (await s.get('/dashboard?portfolioId=all')).json.data.kpis;
    for (const field of ['portfolio_value', 'cash_balance', 'market_value', 'cost_basis', 'unrealized_pl', 'realized_pl', 'total_gain_loss']) {
        assert.equal(list.reduce((sum, p) => sum + cents(p[field]), 0), cents(dash[field]), field);
    }
    for (const p of list) {
        const one = (await s.get(`/dashboard?portfolioId=${p.id}`)).json.data;
        assert.equal(one.kpis.portfolio_value, p.portfolio_value);
        assert.equal(one.scope.portfolio_id, p.id);
    }
});

test('dashboard top/bottom lists and portfolio summary', async (t) => {
    const s = await server(t);
    const dash = (await s.get('/dashboard?portfolioId=all')).json.data;
    assert.equal(dash.top_performers.length, 5);
    assert.equal(dash.bottom_performers.length, 5);
    const topPct = dash.top_performers.map((r) => r.unrealized_pl_pct);
    assert.deepEqual(topPct, topPct.slice().sort((a, b) => b - a));
    const bottomPct = dash.bottom_performers.map((r) => r.unrealized_pl_pct);
    assert.deepEqual(bottomPct, bottomPct.slice().sort((a, b) => a - b));
    assert.ok(Math.min(...topPct) >= Math.max(...bottomPct));
    assert.equal(dash.portfolio_summary.length, 5);
    assert.ok(Math.abs(dash.portfolio_summary.reduce((sum, r) => sum + r.allocation_pct, 0) - 100) < 0.01);
    for (const key of ['portfolio_value', 'total_gain_loss', 'total_gain_loss_pct', 'daily_change', 'daily_change_pct', 'cost_basis', 'cash_balance']) {
        assert.equal(typeof dash.kpis[key], 'number', key);
    }
});

test('holdings expose the specified fields with numeric JSON values', async (t) => {
    const s = await server(t);
    const row = (await s.get('/holdings?portfolioId=1&limit=1')).json.data[0];
    for (const key of ['company', 'symbol', 'sector', 'portfolio_name', 'quantity', 'average_cost', 'current_price',
        'market_value', 'cost_basis', 'unrealized_pl', 'unrealized_pl_pct', 'allocation_pct', 'day_change']) {
        assert.ok(key in row, `missing ${key}`);
    }
    for (const key of ['quantity', 'average_cost', 'current_price', 'market_value', 'cost_basis', 'unrealized_pl', 'allocation_pct']) {
        assert.equal(typeof row[key], 'number', key);
    }
    assert.equal(cents(row.market_value), Math.round(row.quantity * row.current_price * 100));
    assert.equal(cents(row.unrealized_pl), cents(row.market_value) - cents(row.cost_basis));
    assert.equal(cents(row.day_change), cents(row.current_price) - cents(row.previous_price));
});

test('holdings: sorting, filtering, pagination with correct totals; invalid input is 400', async (t) => {
    const s = await server(t);
    const page1 = await s.get('/holdings?portfolioId=all&limit=10&start=0&page=1');
    const page2 = await s.get('/holdings?portfolioId=all&limit=10&start=10&page=2');
    assert.equal(page1.json.data.length, 10);
    assert.equal(page2.json.data.length, 10);
    assert.equal(page1.json.total, page2.json.total);
    assert.equal(page1.json.total, 75);
    assert.notDeepEqual(page1.json.data.map((r) => r.id), page2.json.data.map((r) => r.id));

    const sorted = await s.get(`/holdings?portfolioId=all&limit=100&sort=${q([{ property: 'symbol', direction: 'ASC' }])}`);
    const symbols = sorted.json.data.map((r) => r.symbol.toLowerCase());
    assert.deepEqual(symbols, symbols.slice().sort());

    const tech = await s.get(`/holdings?portfolioId=1&limit=100&filter=${q([{ property: 'sector', value: 'technology', operator: 'like' }])}`);
    assert.ok(tech.json.total > 0 && tech.json.data.every((r) => r.sector === 'Technology'));
    assert.equal(tech.json.total, tech.json.data.length);

    const losers = await s.get(`/holdings?portfolioId=all&limit=100&filter=${q([{ property: 'unrealized_pl', operator: '<', value: 0 }])}`);
    assert.ok(losers.json.total > 0 && losers.json.data.every((r) => r.unrealized_pl < 0));
    const winners = await s.get(`/holdings?portfolioId=all&limit=100&filter=${q([{ property: 'unrealized_pl', operator: '>', value: 0 }])}`);
    assert.equal(winners.json.total + losers.json.total + (await s.get(`/holdings?portfolioId=all&limit=100&filter=${q([{ property: 'unrealized_pl', operator: '==', value: 0 }])}`)).json.total, 75);

    assertError(await s.get('/holdings?sort=[{"property":"nope"}]'), 400, 'INVALID_SORTER');
    assertError(await s.get('/holdings?filter=[{"property":"nope","value":1}]'), 400, 'INVALID_FILTER');
    assertError(await s.get('/holdings?filter=not-json'), 400, 'INVALID_FILTER');
    assertError(await s.get('/holdings?limit=0'), 400, 'INVALID_PAGING');
    assertError(await s.get('/holdings?portfolioId=abc'), 400, 'INVALID_PORTFOLIO_ID');
    assertError(await s.get('/holdings?portfolioId=99'), 404, 'PORTFOLIO_NOT_FOUND');
    assert.equal((await s.get('/holdings?limit=100000')).json.meta.limit, 100, 'limit is capped');
});

test('companies, price series and daily change are deterministic', async (t) => {
    const s = await server(t);
    const tick = (await s.get('/simulation/status')).json.data.tick_index;
    const a = await s.get(`/companies/2/prices?range=6M&tick=${tick}`);
    const b = await s.get(`/companies/2/prices?range=6M&tick=${tick}`);
    assert.deepEqual(a.json.data, b.json.data);
    const company = (await s.get(`/companies?query=msft&tick=${tick}`)).json.data[0];
    assert.equal(company.symbol, 'MSFT');
    assert.equal(a.json.data[a.json.data.length - 1].price, company.current_price, 'chart end = spot price');
    assert.equal(a.json.data[a.json.data.length - 1].tick_index, tick);
    assert.equal(a.json.meta.timeScale, 'SIMULATED_TIME');
    assert.equal(cents(company.day_change), cents(company.current_price) - cents(company.previous_price));
    const search = await s.get('/companies?query=bank&limit=5');
    assert.ok(search.json.total >= 1 && search.json.data.length <= 5);
    assertError(await s.get('/companies/99999/prices'), 404, 'COMPANY_NOT_FOUND');
    assertError(await s.get('/companies/abc/prices'), 400, 'INVALID_COMPANY_ID');
    assertError(await s.get('/companies/1/prices?range=5Y'), 400, 'INVALID_RANGE');
});

test('portfolio comparison starts at 100 for every series (portfolios and simulated benchmarks)', async (t) => {
    const s = await server(t);
    for (const range of ['1M', '6M', '1Y', 'ALL']) {
        const res = await s.get(`/analytics/comparison?range=${range}`);
        assertCollection(res, range);
        const first = res.json.data[0];
        for (const series of res.json.meta.series) {
            assert.equal(first[series.key], 100, `${range} ${series.key}`);
        }
        const keys = res.json.meta.series.map((x) => x.type);
        assert.equal(keys.filter((k) => k === 'PORTFOLIO').length, 5);
        assert.equal(keys.filter((k) => k === 'BENCHMARK').length, 2);
    }
});

test('pivot source rows and sector comparison are consistent with holdings', async (t) => {
    const s = await server(t);
    const pivot = await s.get('/analytics/pivot?portfolioId=all');
    assert.equal(pivot.json.total, 75);
    const mv = pivot.json.data.reduce((sum, r) => sum + cents(r.market_value), 0);
    assert.equal(mv, cents((await s.get('/dashboard?portfolioId=all')).json.data.kpis.market_value));
    const cmp = await s.get('/analytics/sector-comparison');
    assert.equal(cmp.json.data.reduce((sum, r) => sum + cents(r.total), 0), mv);
    for (const p of cmp.json.meta.portfolios) {
        const share = cmp.json.data.reduce((sum, r) => sum + r[p.pct_key], 0);
        assert.ok(Math.abs(share - 100) < 0.05, `${p.name} exposure sums to 100%`);
    }
});

test('simulation status exposes the clock, tick and next tick', async (t) => {
    const s = await server(t);
    const res = await s.get('/simulation/status');
    assertRecord(res, 'status');
    const d = res.json.data;
    assert.equal(d.simulation_mode, 'DEMO');
    assert.equal(d.tick_duration_ms, 5000);
    assert.equal(Date.parse(d.next_tick_at) - Date.parse(d.as_of), 5000);
    assert.equal(d.tick_index, res.json.meta.tickIndex);
});

test('BUY updates cash and holdings, uses the SERVER price, and persists atomically', async (t) => {
    const hashesBefore = fixtureHashes();
    const s = await server(t);
    const cashBefore = (await s.get('/portfolios/5')).json.data;
    const status = (await s.get('/simulation/status')).json.data;
    const msft = (await s.get(`/companies?query=msft&tick=${status.tick_index}`)).json.data[0];
    const holdingBefore = (await s.get('/holdings?portfolioId=5&limit=100')).json.data.find((r) => r.symbol === 'MSFT');

    const res = await s.post('/transactions', {
        portfolio_id: 5, company_id: 2, trade_type: 'buy', quantity: 10,
        execution_price: 0.01, executed_at: '2020-01-01T00:00:00Z' // forged values must be ignored
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.success, true);
    assert.equal(res.json.message, 'Simulated trade executed');
    const tx = res.json.data;
    assert.equal(tx.execution_price, msft.current_price, 'server price, not the forged one');
    assert.equal(tx.executed_at, status.as_of, 'server execution timestamp');
    assert.equal(tx.trade_type, 'BUY');
    assert.equal(tx.id, 'R-000001');
    assert.equal(res.json.meta.tickIndex, status.tick_index);

    const cashAfter = (await s.get('/portfolios/5')).json.data;
    assert.equal(cents(cashAfter.cash_balance), cents(cashBefore.cash_balance) - 10 * cents(msft.current_price));
    assert.equal(cents(cashAfter.portfolio_value), cents(cashBefore.portfolio_value), 'buying at the marked price leaves value unchanged');
    const holdingAfter = (await s.get('/holdings?portfolioId=5&limit=100')).json.data.find((r) => r.symbol === 'MSFT');
    assert.equal(holdingAfter.quantity, (holdingBefore ? holdingBefore.quantity : 0) + 10);
    assert.equal(cents(tx.portfolio_cash_after), cents(cashAfter.cash_balance));

    const history = (await s.get('/transactions?portfolioId=5&limit=5')).json;
    assert.equal(history.data[0].id, 'R-000001');
    assert.equal((await s.get('/transactions')).json.total, 91);

    const journal = JSON.parse(fs.readFileSync(path.join(s.runtimeDir, 'transactions.json'), 'utf8'));
    assert.equal(journal.length, 1);
    assert.equal(journal[0].execution_price_cents, cents(msft.current_price));
    assert.deepEqual(fs.readdirSync(s.runtimeDir), ['transactions.json'], 'no temporary files are left behind');
    assert.deepEqual(fixtureHashes(), hashesBefore, 'baseline fixtures are never modified');
});

test('SELL realizes P/L at average cost and reduces the position', async (t) => {
    const s = await server(t);
    const pos = (await s.get('/holdings?portfolioId=1&limit=100')).json.data.find((r) => r.symbol === 'AAPL');
    const cashBefore = cents((await s.get('/portfolios/1')).json.data.cash_balance);
    const res = await s.post('/transactions', { portfolio_id: 1, company_id: 1, trade_type: 'SELL', quantity: 10 });
    assert.equal(res.status, 201);
    const tx = res.json.data;
    const proceeds = 10 * cents(tx.execution_price);
    assert.equal(cents(tx.amount), proceeds);
    assert.equal(cents(tx.realized_pl), proceeds - Math.round(pos.average_cost * 10 * 100), 'realized = proceeds - average cost of the shares sold');
    const after = (await s.get('/holdings?portfolioId=1&limit=100')).json.data.find((r) => r.symbol === 'AAPL');
    assert.equal(after.quantity, pos.quantity - 10);
    assert.equal(after.average_cost, pos.average_cost, 'average cost is unchanged by a sell');
    assert.equal(cents((await s.get('/portfolios/1')).json.data.cash_balance), cashBefore + proceeds);

    // Selling everything removes the position; history remains.
    const all = await s.post('/transactions', { portfolio_id: 1, company_id: 1, trade_type: 'SELL', quantity: after.quantity });
    assert.equal(all.status, 201);
    assert.equal(all.json.data.position_quantity_after, 0);
    assert.ok(!(await s.get('/holdings?portfolioId=1&limit=100')).json.data.some((r) => r.symbol === 'AAPL'));
    assert.ok((await s.get(`/transactions?portfolioId=1&filter=${q([{ property: 'symbol', value: 'AAPL', operator: '==' }])}`)).json.total >= 3);
});

test('invalid trades are rejected with the right status and change nothing', async (t) => {
    const s = await server(t);
    const before = (await s.get('/portfolios')).json.data;
    const good = { portfolio_id: 1, company_id: 2, trade_type: 'BUY', quantity: 1 };
    assertError(await s.post('/transactions', { ...good, quantity: 0 }), 400, 'INVALID_QUANTITY');
    assertError(await s.post('/transactions', { ...good, quantity: -5 }), 400, 'INVALID_QUANTITY');
    assertError(await s.post('/transactions', { ...good, quantity: 2.5 }), 400, 'INVALID_QUANTITY');
    assertError(await s.post('/transactions', { ...good, quantity: '5' }), 400, 'INVALID_QUANTITY');
    assertError(await s.post('/transactions', { ...good, trade_type: 'SHORT' }), 400, 'INVALID_TRADE_TYPE');
    assertError(await s.post('/transactions', { ...good, portfolio_id: 'x' }), 400, 'INVALID_PORTFOLIO_ID');
    assertError(await s.post('/transactions', { ...good, company_id: null }), 400, 'INVALID_COMPANY_ID');
    assertError(await s.post('/transactions', { ...good, portfolio_id: 99 }), 404, 'PORTFOLIO_NOT_FOUND');
    assertError(await s.post('/transactions', { ...good, company_id: 99999 }), 404, 'COMPANY_NOT_FOUND');
    assertError(await s.post('/transactions', { ...good, quantity: 1_000_000 }), 409, 'INSUFFICIENT_CASH');
    assertError(await s.post('/transactions', { ...good, trade_type: 'SELL', company_id: 80, quantity: 1 }), 409, 'INSUFFICIENT_SHARES');
    assertError(await s.post('/transactions', '{bad json'), 400, 'INVALID_JSON');
    assertError(await s.post('/transactions', [1, 2]), 400, 'INVALID_TRADE');
    assert.deepEqual((await s.get('/portfolios')).json.data, before);
    assert.equal((await s.get('/transactions')).json.total, 90);
    assert.equal(fs.existsSync(path.join(s.runtimeDir, 'transactions.json')), false, 'nothing was written');
});

test('simultaneous trades are serialized: cash can never be overspent', async (t) => {
    const s = await server(t);
    const cash = (await s.get('/portfolios/5')).json.data.cash_balance;
    const price = (await s.get('/companies?query=msft')).json.data[0].current_price;
    const quantity = Math.floor((cash / price) * 0.6); // one purchase fits, two cannot
    const results = await Promise.all(Array.from({ length: 6 }, () =>
        s.post('/transactions', { portfolio_id: 5, company_id: 2, trade_type: 'BUY', quantity })));
    const ok = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 409);
    assert.equal(ok.length, 1, 'exactly one purchase succeeds');
    assert.equal(rejected.length, 5);
    assert.ok(rejected.every((r) => r.json.code === 'INSUFFICIENT_CASH'));
    const after = (await s.get('/portfolios/5')).json.data;
    assert.ok(after.cash_balance >= 0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(s.runtimeDir, 'transactions.json'), 'utf8')).length, 1);

    // Simultaneous valid trades all apply, with unique sequential ids.
    const many = await Promise.all(Array.from({ length: 5 }, () =>
        s.post('/transactions', { portfolio_id: 1, company_id: 3, trade_type: 'BUY', quantity: 1 })));
    assert.ok(many.every((r) => r.status === 201));
    assert.equal(new Set(many.map((r) => r.json.data.id)).size, 5);
});

test('a journal write failure returns 500, records nothing, and does not corrupt state', async (t) => {
    let failWrites = true;
    const s = await server(t, {
        writer: async (file, data) => {
            if (failWrites) {
                throw new Error('disk full');
            }
            return writeJsonAtomic(file, data);
        }
    });
    const before = (await s.get('/portfolios/1')).json.data;
    const res = await s.post('/transactions', { portfolio_id: 1, company_id: 2, trade_type: 'BUY', quantity: 5 });
    assertError(res, 500, 'PERSISTENCE_FAILED');
    assert.doesNotMatch(JSON.stringify(res.json), /disk full|stack/i, 'internal details are not exposed');
    assert.deepEqual((await s.get('/portfolios/1')).json.data, before);
    assert.equal((await s.get('/transactions')).json.total, 90);
    assert.equal(fs.existsSync(path.join(s.runtimeDir, 'transactions.json')), false);

    failWrites = false;
    const retry = await s.post('/transactions', { portfolio_id: 1, company_id: 2, trade_type: 'BUY', quantity: 5 });
    assert.equal(retry.status, 201);
    assert.equal(retry.json.data.id, 'R-000001', 'the failed attempt did not consume an id');
});

test('runtime trades survive a server restart and re-derive the same state', async (t) => {
    const runtimeDir = tempRuntimeDir();
    const first = await startServer({ runtimeDir });
    await first.post('/transactions', { portfolio_id: 2, company_id: 5, trade_type: 'BUY', quantity: 7 });
    await first.post('/transactions', { portfolio_id: 2, company_id: 5, trade_type: 'SELL', quantity: 3 });
    const portfolio = (await first.get('/portfolios/2')).json.data;
    const holdings = (await first.get('/holdings?portfolioId=2&limit=100')).json.data;
    const tick = first.ctx.simulator.currentTick();
    await first.close();

    const second = await server(t, { runtimeDir });
    assert.equal(second.ctx.simulator.currentTick(), tick, 'same simulated time');
    assert.deepEqual((await second.get('/portfolios/2')).json.data, portfolio);
    assert.deepEqual((await second.get('/holdings?portfolioId=2&limit=100')).json.data, holdings);
    assert.equal((await second.get('/transactions')).json.total, 92);
    const next = await second.post('/transactions', { portfolio_id: 2, company_id: 5, trade_type: 'BUY', quantity: 1 });
    assert.equal(next.json.data.id, 'R-000003');
});

test('transaction history: filters (portfolio, ticker, side, date range), paging and details', async (t) => {
    const s = await server(t);
    const all = await s.get('/transactions?limit=100');
    assert.equal(all.json.total, 90);
    const dates = all.json.data.map((r) => r.executed_at);
    assert.deepEqual(dates, dates.slice().sort().reverse(), 'newest first by default');

    const p1 = await s.get('/transactions?portfolioId=1&limit=100');
    assert.ok(p1.json.total > 0 && p1.json.data.every((r) => r.portfolio_id === 1));
    const sells = await s.get(`/transactions?limit=100&filter=${q([{ property: 'trade_type', value: 'sell' }])}`);
    assert.ok(sells.json.total > 0 && sells.json.data.every((r) => r.trade_type === 'SELL' && typeof r.realized_pl === 'number'));
    const range = await s.get(`/transactions?limit=100&filter=${q([
        { property: 'executed_at', operator: '>=', value: '2025-03-01' },
        { property: 'executed_at', operator: '<', value: '2025-06-01' }])}`);
    assert.ok(range.json.total > 0 && range.json.data.every((r) => r.executed_at >= '2025-03-01' && r.executed_at < '2025-06-01'));
    const paged = await s.get('/transactions?limit=10&start=20');
    assert.equal(paged.json.data.length, 10);
    assert.equal(paged.json.total, 90);
    const buy = all.json.data.find((r) => r.trade_type === 'BUY');
    for (const key of ['id', 'symbol', 'company', 'quantity', 'execution_price', 'amount', 'executed_at', 'portfolio_name']) {
        assert.ok(key in buy, key);
    }
    assert.equal(cents(buy.amount), buy.quantity * cents(buy.execution_price));
});

test('CSV export honors filters and sorting, and neutralizes formula injection', async (t) => {
    const s = await server(t);
    const res = await s.get(`/exports/holdings.csv?portfolioId=1&filter=${q([{ property: 'sector', value: 'Technology', operator: 'like' }])}`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^text\/csv/);
    assert.match(res.headers.get('content-disposition'), /attachment/);
    const lines = res.text.trim().split('\r\n');
    const filtered = (await s.get(`/holdings?portfolioId=1&limit=100&filter=${q([{ property: 'sector', value: 'Technology', operator: 'like' }])}`)).json;
    assert.equal(lines.length - 1, filtered.total, 'CSV has every filtered row, not just one page');
    assert.match(lines[0], /^Company,Ticker,Sector,Portfolio,Quantity/);
    assert.ok(lines.slice(1).every((l) => l.includes(',Technology,')));
    for (const line of lines) {
        assert.doesNotMatch(line.split(',')[0], /^[=+\-@]/);
    }
});

test('unknown routes and server faults return JSON errors; CORS is restricted', async (t) => {
    const s = await server(t);
    assertError(await s.get('/does-not-exist'), 404, 'ROUTE_NOT_FOUND');
    assertError(await s.get('/portfolios/99'), 404, 'PORTFOLIO_NOT_FOUND');
    assertError(await s.get('/portfolios/abc'), 400, 'INVALID_PORTFOLIO_ID');
    assertError(await s.get('/dashboard?range=2Y'), 400, 'INVALID_RANGE');
    const cache = await s.get('/health');
    assert.equal(cache.headers.get('cache-control'), 'no-store');

    const originHeader = (origin) => new Promise((resolve, reject) => {
        const req = http.request(`${s.base}/health`, { headers: { Origin: origin } }, (res) => {
            res.resume();
            res.on('end', () => resolve(res.headers['access-control-allow-origin']));
        });
        req.on('error', reject);
        req.end();
    });
    assert.equal(await originHeader('http://localhost:1841'), 'http://localhost:1841');
    assert.equal(await originHeader('http://evil.example'), undefined);
});

test('startup refuses a corrupt journal instead of overwriting it', async () => {
    const runtimeDir = tempRuntimeDir();
    fs.writeFileSync(path.join(runtimeDir, 'transactions.json'), '{ not json');
    await assert.rejects(() => startServer({ runtimeDir }), /unreadable/);
    assert.equal(fs.readFileSync(path.join(runtimeDir, 'transactions.json'), 'utf8'), '{ not json', 'the file was left untouched');

    const bad = tempRuntimeDir();
    fs.writeFileSync(path.join(bad, 'transactions.json'), JSON.stringify([{
        id: 'R-000001', portfolio_id: 5, company_id: 2, trade_type: 'BUY', quantity: 100_000_000,
        execution_price_cents: 10_000, fee_cents: 0, executed_at: '2026-01-01T00:00:00Z', source: 'RUNTIME'
    }]));
    await assert.rejects(() => startServer({ runtimeDir: bad }), /inconsistent/);
});

test('holdings: group parameter orders rows by group; totals and group summaries cover all filtered rows', async (t) => {
    const s = await server(t);
    const tick = (await s.get('/simulation/status')).json.data.tick_index;
    const base = `/holdings?portfolioId=all&tick=${tick}`;

    // Grouped + paged: contiguous groups, page 1 and page 2 continue the same ordering.
    const p1 = await s.get(`${base}&limit=20&start=0&group=sector&groupDir=ASC`);
    const p2 = await s.get(`${base}&limit=20&start=20&group=sector&groupDir=ASC`);
    const sectors = [...p1.json.data, ...p2.json.data].map((r) => r.sector);
    assert.deepEqual(sectors, sectors.slice().sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
        'rows are ordered by sector across pages');

    // The JSON-encoded sorter form that Ext JS sends by default is accepted too.
    const encoded = await s.get(`${base}&limit=5&group=${q({ property: 'portfolio_name', direction: 'DESC' })}`);
    const names = encoded.json.data.map((r) => r.portfolio_name);
    assert.deepEqual(names, names.slice().sort().reverse());

    // The user's sort applies inside each group.
    const inner = await s.get(`${base}&limit=100&group=sector&sort=${q([{ property: 'market_value', direction: 'DESC' }])}`);
    for (let i = 1; i < inner.json.data.length; i++) {
        const a = inner.json.data[i - 1];
        const b = inner.json.data[i];
        if (a.sector === b.sector) {
            assert.ok(a.market_value >= b.market_value, 'descending market value within a sector');
        }
    }

    // Totals cover ALL rows matching the filters, not just the requested page, and are cent-exact.
    const all = (await s.get(`${base}&limit=100`)).json.data;
    const sum = (rows, key) => rows.reduce((acc, r) => acc + cents(r[key]), 0);
    const meta = p1.json.meta;
    assert.equal(meta.totals.count, all.length);
    assert.equal(cents(meta.totals.market_value), sum(all, 'market_value'));
    assert.equal(cents(meta.totals.cost_basis), sum(all, 'cost_basis'));
    assert.equal(cents(meta.totals.unrealized_pl), sum(all, 'unrealized_pl'));
    assert.equal(cents(meta.totals.unrealized_pl), cents(meta.totals.market_value) - cents(meta.totals.cost_basis));
    for (const sector of new Set(all.map((r) => r.sector))) {
        const rows = all.filter((r) => r.sector === sector);
        assert.equal(meta.groups.sector[sector].count, rows.length);
        assert.equal(cents(meta.groups.sector[sector].market_value), sum(rows, 'market_value'));
    }
    assert.deepEqual(Object.keys(meta.groups.portfolio_name).sort(),
        [...new Set(all.map((r) => r.portfolio_name))].sort());

    // Totals follow the filters.
    const tech = await s.get(`${base}&limit=5&filter=${q([{ property: 'sector', value: 'Technology', operator: '=' }])}`);
    assert.equal(tech.json.meta.totals.count, tech.json.total);
    assert.equal(cents(tech.json.meta.totals.market_value), sum(all.filter((r) => r.sector === 'Technology'), 'market_value'));

    // An empty result has zero totals and a null percentage.
    const none = await s.get(`${base}&filter=${q([{ property: 'symbol', value: 'zzzz' }])}`);
    assert.equal(none.json.meta.totals.count, 0);
    assert.equal(none.json.meta.totals.market_value, 0);
    assert.equal(none.json.meta.totals.unrealized_pl_pct, null);

    assertError(await s.get('/holdings?group=symbol'), 400, 'INVALID_GROUP');
    assertError(await s.get('/holdings?group=sector&groupDir=sideways'), 400, 'INVALID_GROUP');
    assertError(await s.get('/holdings?group=%7Bbad'), 400, 'INVALID_GROUP');
});

test('holdings: free-text query matches ticker or company; totals and CSV follow it', async (t) => {
    const s = await server(t);
    const tick = (await s.get('/simulation/status')).json.data.tick_index;
    const all = (await s.get(`/holdings?portfolioId=all&limit=100&tick=${tick}`)).json.data;
    const byTicker = await s.get(`/holdings?portfolioId=all&limit=100&tick=${tick}&query=msft`);
    assert.ok(byTicker.json.total > 0);
    assert.ok(byTicker.json.data.every((r) => r.symbol === 'MSFT'));
    const byName = await s.get(`/holdings?portfolioId=all&limit=100&tick=${tick}&query=${encodeURIComponent('Microsoft')}`);
    assert.equal(byName.json.total, byTicker.json.total);
    assert.equal(byTicker.json.meta.totals.count, byTicker.json.total);
    // Allocation % keeps the whole scope as its denominator.
    const full = all.find((r) => r.id === byTicker.json.data[0].id);
    assert.equal(byTicker.json.data[0].allocation_pct, full.allocation_pct);
    const csv = await s.get(`/exports/holdings.csv?portfolioId=all&tick=${tick}&query=msft`);
    const lines = csv.text.trim().split('\r\n');
    assert.equal(lines.length - 1, byTicker.json.total, 'CSV rows = matching holdings');
    assert.equal((await s.get(`/holdings?query=zzzzzz`)).json.total, 0);
});

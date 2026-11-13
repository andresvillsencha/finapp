'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createPortfolioState, applyTransaction, cloneState, prepareTransactions, Replayer } = require('../src/services/ledger');
const { mulDivRound } = require('../src/utils/money');
const { AppError } = require('../src/utils/errors');
const { makeContext, FROZEN_NOW } = require('./helpers');

const PORTFOLIO = { id: 1, initial_cash_cents: 10_000_000, created_at: '2025-01-01T00:00:00Z' }; // $100,000.00
const day = (n) => Date.parse('2025-01-01T00:00:00Z') + n * 86_400_000;
let seq = 0;
const trade = (type, qty, cents, extra = {}) => ({
    id: `X-${(seq += 1)}`, portfolio_id: 1, company_id: 1, trade_type: type, quantity: qty,
    execution_price_cents: cents, fee_cents: 0, ...extra
});

function expectError(fn, status, code) {
    assert.throws(fn, (err) => err instanceof AppError && err.status === status && err.code === code, `expected ${status} ${code}`);
}

test('weighted-average cost on repeated buys', () => {
    const state = createPortfolioState(PORTFOLIO);
    applyTransaction(state, trade('BUY', 10, 10_000), day(1)); // 10 @ $100
    applyTransaction(state, trade('BUY', 30, 12_000), day(2)); // 30 @ $120
    const pos = state.positions.get(1);
    assert.equal(pos.quantity, 40);
    assert.equal(pos.cost_cents, 460_000); // $4,600 -> average $115.00
    assert.equal(pos.cost_cents / pos.quantity, 11_500);
    assert.equal(state.cash_cents, 10_000_000 - 460_000);
});

test('partial sell realizes P/L at average cost and keeps the average unchanged', () => {
    const state = createPortfolioState(PORTFOLIO);
    applyTransaction(state, trade('BUY', 10, 10_000), day(1));
    applyTransaction(state, trade('BUY', 30, 12_000), day(2));
    const detail = applyTransaction(state, trade('SELL', 10, 13_000), day(3)); // sell 10 @ $130
    assert.equal(detail.cost_removed_cents, 115_000);
    assert.equal(detail.realized_pl_cents, 130_000 - 115_000);
    const pos = state.positions.get(1);
    assert.equal(pos.quantity, 30);
    assert.equal(pos.cost_cents, 345_000);
    assert.equal(pos.cost_cents / pos.quantity, 11_500, 'average cost unchanged by a sell');
    assert.equal(state.realized_pl_cents, 15_000);
});

test('selling the whole position removes it but keeps realized P/L', () => {
    const state = createPortfolioState(PORTFOLIO);
    applyTransaction(state, trade('BUY', 10, 10_000), day(1));
    const detail = applyTransaction(state, trade('SELL', 10, 9_000), day(2));
    assert.equal(detail.realized_pl_cents, -10_000);
    assert.equal(state.positions.size, 0);
    assert.equal(state.realized_pl_cents, -10_000);
    assert.equal(state.cash_cents, 10_000_000 - 10_000);
});

test('fees raise a buy cost basis and reduce sale proceeds', () => {
    const state = createPortfolioState(PORTFOLIO);
    applyTransaction(state, trade('BUY', 10, 10_000, { fee_cents: 500 }), day(1));
    assert.equal(state.positions.get(1).cost_cents, 100_500);
    const detail = applyTransaction(state, trade('SELL', 10, 10_000, { fee_cents: 500 }), day(2));
    assert.equal(detail.realized_pl_cents, 100_000 - 500 - 100_500);
    assert.equal(state.fees_cents, 1_000);
});

test('proportional cost removal rounds half-up to the cent', () => {
    assert.equal(mulDivRound(10_001, 1, 3), 3_334); // 3333.67
    assert.equal(mulDivRound(10_000, 1, 3), 3_333); // 3333.33
    assert.equal(mulDivRound(5, 1, 2), 3); // 2.5 rounds up
    const state = createPortfolioState(PORTFOLIO);
    applyTransaction(state, trade('BUY', 3, 3_333, { fee_cents: 2 }), day(1)); // cost 10_001
    const detail = applyTransaction(state, trade('SELL', 1, 4_000), day(2));
    assert.equal(detail.cost_removed_cents, 3_334);
    assert.equal(state.positions.get(1).cost_cents, 10_001 - 3_334);
});

test('insufficient cash is rejected (409) and leaves state unchanged', () => {
    const state = createPortfolioState(PORTFOLIO);
    const before = cloneState(state);
    expectError(() => applyTransaction(state, trade('BUY', 1_000, 10_001), day(1)), 409, 'INSUFFICIENT_CASH');
    assert.equal(state.cash_cents, before.cash_cents);
    assert.equal(state.positions.size, 0);
});

test('insufficient shares and short selling are rejected (409)', () => {
    const state = createPortfolioState(PORTFOLIO);
    expectError(() => applyTransaction(state, trade('SELL', 1, 10_000), day(1)), 409, 'INSUFFICIENT_SHARES');
    applyTransaction(state, trade('BUY', 5, 10_000), day(1));
    expectError(() => applyTransaction(state, trade('SELL', 6, 10_000), day(2)), 409, 'INSUFFICIENT_SHARES');
    assert.equal(state.positions.get(1).quantity, 5);
});

test('invalid quantities, prices, sides and fees are rejected (400)', () => {
    const state = createPortfolioState(PORTFOLIO);
    for (const quantity of [0, -3, 1.5, NaN, Infinity, 99_999_999_999]) {
        expectError(() => applyTransaction(state, trade('BUY', quantity, 10_000), day(1)), 400, 'INVALID_QUANTITY');
    }
    for (const price of [0, -5, 10.5, NaN]) {
        expectError(() => applyTransaction(state, trade('BUY', 1, price), day(1)), 400, 'INVALID_PRICE');
    }
    expectError(() => applyTransaction(state, trade('HOLD', 1, 100), day(1)), 400, 'INVALID_TRADE_TYPE');
    expectError(() => applyTransaction(state, trade('BUY', 1, 100, { fee_cents: -1 }), day(1)), 400, 'INVALID_FEE');
    assert.equal(state.tx_count, 0);
});

test('a trade cannot be dated before funding or before the latest journal entry', () => {
    const state = createPortfolioState(PORTFOLIO);
    expectError(() => applyTransaction(state, trade('BUY', 1, 100), day(-1)), 409, 'OUT_OF_ORDER_TRANSACTION');
    applyTransaction(state, trade('BUY', 1, 100), day(5));
    expectError(() => applyTransaction(state, trade('BUY', 1, 100), day(4)), 409, 'OUT_OF_ORDER_TRANSACTION');
});

test('journal order: equal timestamps keep journal order; incremental replay matches full replay', () => {
    const txs = [
        trade('BUY', 10, 10_000, { executed_at: new Date(day(2)).toISOString() }),
        trade('BUY', 10, 11_000, { executed_at: new Date(day(1)).toISOString() }),
        trade('SELL', 5, 12_000, { executed_at: new Date(day(2)).toISOString() })
    ];
    const prepared = prepareTransactions(txs);
    assert.deepEqual(prepared.map((e) => e.tx.id), [txs[1].id, txs[0].id, txs[2].id]);
    const incremental = new Replayer([PORTFOLIO], prepared);
    incremental.advanceTo(day(1)).advanceTo(day(3));
    const full = new Replayer([PORTFOLIO], prepared).advanceTo(Infinity);
    assert.deepEqual([...incremental.states.get(1).positions], [...full.states.get(1).positions]);
    assert.equal(incremental.states.get(1).cash_cents, full.states.get(1).cash_cents);
});

test('baseline fixtures replay cleanly: no negative cash or holdings, identities hold', () => {
    const { ctx } = makeContext();
    assert.deepEqual(ctx.ledger.validate(), []);
    const snapshot = ctx.simulator.snapshot();
    const states = ctx.ledger.stateAt(snapshot.asOfMs);
    for (const [id, state] of states) {
        assert.ok(state.cash_cents >= 0, `portfolio ${id} cash`);
        let marketValue = 0;
        let cost = 0;
        for (const [companyId, pos] of state.positions) {
            assert.ok(pos.quantity > 0 && pos.cost_cents > 0);
            marketValue += pos.quantity * ctx.simulator.priceCents(companyId, snapshot.tickIndex);
            cost += pos.cost_cents;
        }
        // value - initial funding = realized + unrealized (fees are inside cost / proceeds)
        assert.equal(state.cash_cents + marketValue - state.initial_cash_cents, state.realized_pl_cents + (marketValue - cost), `portfolio ${id}`);
    }
});

test('replay at an earlier time excludes later trades', () => {
    const { ctx } = makeContext();
    const before = ctx.ledger.stateAt(Date.parse('2025-01-02T00:00:00Z'));
    for (const state of before.values()) {
        assert.equal(state.tx_count, 0);
        assert.equal(state.cash_cents, state.initial_cash_cents);
    }
    assert.ok(FROZEN_NOW > 0);
});

'use strict';

/**
 * The accounting engine. Holdings, cash and realized P/L are NEVER stored: they
 * are replayed from each portfolio's initial funding plus the complete ordered
 * transaction journal (baseline fixture + runtime trades).
 *
 * Rules (CLAUDE.md section 3.2 / 4):
 *  - BUY needs enough cash (no margin); SELL needs enough shares (no shorting).
 *  - Weighted-average cost: a position keeps its TOTAL cost in cents; the average
 *    cost is derived (cost / quantity). A SELL removes cost proportionally
 *    (half-up to the cent; the full cost when the position is closed) and
 *    realizes proceeds - cost removed. Average cost is unchanged by a SELL.
 *  - Fees are added to a BUY's cost basis and deducted from a SELL's proceeds.
 *  - A position that reaches zero shares is removed; history is retained.
 *
 * Identity (checked by tests): portfolio value - initial funding
 *                              = realized P/L + unrealized P/L.
 */
const { AppError, badRequest, conflict } = require('../utils/errors');
const { mulDivRound } = require('../utils/money');

const MAX_QUANTITY = 10_000_000;

function createPortfolioState(portfolio) {
    return {
        portfolio_id: portfolio.id,
        initial_cash_cents: portfolio.initial_cash_cents,
        cash_cents: portfolio.initial_cash_cents,
        realized_pl_cents: 0,
        fees_cents: 0,
        positions: new Map(), // company_id -> { quantity, cost_cents }
        tx_count: 0,
        last_executed_ms: Date.parse(portfolio.created_at)
    };
}

function cloneState(state) {
    const copy = { ...state, positions: new Map() };
    for (const [id, pos] of state.positions) {
        copy.positions.set(id, { ...pos });
    }
    return copy;
}

function assertSafe(value, what) {
    if (!Number.isSafeInteger(value)) {
        throw badRequest('AMOUNT_OUT_OF_RANGE', `${what} is out of the supported range.`);
    }
}

/**
 * Apply one transaction to a portfolio state (mutates it). Throws AppError on
 * any rule violation. Returns the per-transaction accounting detail.
 */
function applyTransaction(state, tx, executedMs) {
    if (!Number.isInteger(tx.quantity) || tx.quantity <= 0 || tx.quantity > MAX_QUANTITY) {
        throw badRequest('INVALID_QUANTITY', `Quantity must be a whole number between 1 and ${MAX_QUANTITY}.`);
    }
    if (!Number.isInteger(tx.execution_price_cents) || tx.execution_price_cents <= 0) {
        throw badRequest('INVALID_PRICE', 'Execution price must be a positive number of cents.');
    }
    const fee = tx.fee_cents || 0;
    if (!Number.isInteger(fee) || fee < 0) {
        throw badRequest('INVALID_FEE', 'Fee must be a non-negative number of cents.');
    }
    if (executedMs < state.last_executed_ms) {
        throw conflict('OUT_OF_ORDER_TRANSACTION', 'Transaction is dated before the latest journal entry for this portfolio.');
    }

    const gross = tx.quantity * tx.execution_price_cents;
    assertSafe(gross, 'Trade amount');
    const position = state.positions.get(tx.company_id);
    let detail;

    if (tx.trade_type === 'BUY') {
        const total = gross + fee;
        if (total > state.cash_cents) {
            throw conflict('INSUFFICIENT_CASH', 'Insufficient simulated cash balance', {
                portfolio_id: state.portfolio_id,
                required: total / 100,
                available: state.cash_cents / 100
            });
        }
        state.cash_cents -= total;
        const next = position || { quantity: 0, cost_cents: 0 };
        next.quantity += tx.quantity;
        next.cost_cents += total;
        assertSafe(next.cost_cents, 'Position cost');
        state.positions.set(tx.company_id, next);
        detail = { amount_cents: gross, fee_cents: fee, realized_pl_cents: null, cost_removed_cents: 0 };
    } else if (tx.trade_type === 'SELL') {
        if (!position || tx.quantity > position.quantity) {
            throw conflict('INSUFFICIENT_SHARES', 'Insufficient shares to sell', {
                portfolio_id: state.portfolio_id,
                requested: tx.quantity,
                available: position ? position.quantity : 0
            });
        }
        const proceeds = gross - fee;
        if (proceeds < 0) {
            throw badRequest('INVALID_FEE', 'Fee exceeds the sale proceeds.');
        }
        const costRemoved = tx.quantity === position.quantity
            ? position.cost_cents
            : mulDivRound(position.cost_cents, tx.quantity, position.quantity);
        const realized = proceeds - costRemoved;
        state.cash_cents += proceeds;
        state.realized_pl_cents += realized;
        position.quantity -= tx.quantity;
        position.cost_cents -= costRemoved;
        if (position.quantity === 0) {
            state.positions.delete(tx.company_id);
        }
        detail = { amount_cents: gross, fee_cents: fee, realized_pl_cents: realized, cost_removed_cents: costRemoved };
    } else {
        throw badRequest('INVALID_TRADE_TYPE', 'trade_type must be BUY or SELL.');
    }

    state.fees_cents += fee;
    state.tx_count += 1;
    state.last_executed_ms = executedMs;
    return detail;
}

/** Order the journal by timestamp, keeping journal order for equal timestamps. */
function prepareTransactions(transactions) {
    const prepared = transactions.map((tx, order) => {
        const ms = Date.parse(tx.executed_at);
        if (!Number.isFinite(ms)) {
            throw badRequest('INVALID_TIMESTAMP', `Transaction ${tx.id} has an invalid executed_at.`);
        }
        return { tx, ms, order };
    });
    prepared.sort((a, b) => (a.ms - b.ms) || (a.order - b.order));
    return prepared;
}

/**
 * Incremental journal replay. advanceTo(ms) applies every transaction executed
 * at or before ms; it can be called repeatedly with increasing times, which is
 * how portfolio history is sampled efficiently.
 */
class Replayer {
    constructor(portfolios, prepared, { collectErrors = false } = {}) {
        this.states = new Map(portfolios.map((p) => [p.id, createPortfolioState(p)]));
        this.prepared = prepared;
        this.index = 0;
        this.details = new Map(); // transaction id -> accounting detail
        this.errors = [];
        this.collectErrors = collectErrors;
    }

    advanceTo(ms) {
        while (this.index < this.prepared.length && this.prepared[this.index].ms <= ms) {
            const entry = this.prepared[this.index];
            this.index += 1;
            this.apply(entry);
        }
        return this;
    }

    apply({ tx, ms }) {
        try {
            const state = this.states.get(tx.portfolio_id);
            if (!state) {
                throw new AppError(404, 'PORTFOLIO_NOT_FOUND', `Transaction ${tx.id} references unknown portfolio ${tx.portfolio_id}.`);
            }
            this.details.set(tx.id, applyTransaction(state, tx, ms));
        } catch (err) {
            if (this.collectErrors && err instanceof AppError) {
                this.errors.push({ transaction_id: tx.id, code: err.code, message: err.message });
            } else if (err instanceof AppError) {
                err.details = { ...(err.details || {}), transaction_id: tx.id };
                throw err;
            } else {
                throw err;
            }
        }
    }
}

/** Journal = baseline fixture transactions + runtime transactions. */
class LedgerService {
    constructor({ fixtures, journal }) {
        this.fixtures = fixtures;
        this.journal = journal;
        this.refresh();
    }

    /** Rebuild derived data after the runtime journal changed. */
    refresh() {
        this.all = [...this.fixtures.transactions, ...this.journal.transactions];
        this.prepared = prepareTransactions(this.all);
        this.fullReplay = null;
    }

    replayer(options) {
        return new Replayer(this.fixtures.portfolios, this.prepared, options);
    }

    /** Portfolio states as of a simulated time. */
    stateAt(ms) {
        return this.replayer().advanceTo(ms).states;
    }

    /** Replay of the complete journal (cached until the next trade). */
    full() {
        if (!this.fullReplay) {
            this.fullReplay = this.replayer().advanceTo(Infinity);
        }
        return this.fullReplay;
    }

    /** All accounting violations in the journal (empty when consistent). */
    validate() {
        return this.replayer({ collectErrors: true }).advanceTo(Infinity).errors;
    }
}

module.exports = {
    MAX_QUANTITY,
    createPortfolioState,
    cloneState,
    applyTransaction,
    prepareTransactions,
    Replayer,
    LedgerService
};

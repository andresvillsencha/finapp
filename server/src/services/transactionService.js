'use strict';

/**
 * Transaction history and the simulated Buy/Sell Trade Simulator.
 *
 * The execution price and timestamp are ALWAYS determined by the server from
 * its authoritative latest tick; any price/time sent by a client is ignored.
 */
const { AppError, badRequest, notFound, conflict } = require('../utils/errors');
const { usd } = require('../utils/money');
const { runCollectionQuery } = require('../utils/query');
const { applyTransaction, cloneState, MAX_QUANTITY } = require('./ledger');
const { resolveScope } = require('./portfolioService');

const NUMBER = { type: 'number' };
const TEXT = { type: 'string' };
const TX_SCHEMA = {
    portfolio_name: TEXT, symbol: TEXT, company: TEXT, source: TEXT,
    portfolio_id: NUMBER, company_id: NUMBER, seq: NUMBER, quantity: NUMBER,
    execution_price: NUMBER, amount: NUMBER, realized_pl: NUMBER,
    trade_type: { type: 'enum', values: ['BUY', 'SELL'] },
    executed_at: { type: 'date' }
};
const TX_SORTABLE = new Set([...Object.keys(TX_SCHEMA), 'id']);

function transactionDto(ctx, tx, seq, detail) {
    const company = ctx.fixtures.companiesById.get(tx.company_id);
    const portfolio = ctx.fixtures.portfoliosById.get(tx.portfolio_id);
    return {
        id: tx.id,
        seq,
        portfolio_id: tx.portfolio_id,
        portfolio_name: portfolio.name,
        company_id: tx.company_id,
        symbol: company.symbol,
        company: company.name,
        trade_type: tx.trade_type,
        quantity: tx.quantity,
        execution_price: usd(tx.execution_price_cents),
        amount: usd(detail.amount_cents),
        fee: usd(detail.fee_cents),
        realized_pl: detail.realized_pl_cents === null ? null : usd(detail.realized_pl_cents),
        executed_at: tx.executed_at,
        tick_index: tx.tick_index === undefined ? null : tx.tick_index,
        source: tx.source,
        notes: tx.notes === undefined ? null : tx.notes
    };
}

/** Transaction history (immutable executions) with filters, sorting and paging. */
function listTransactions(ctx, query) {
    const scope = resolveScope(ctx, query.portfolioId);
    const inScope = new Set(scope.portfolios.map((p) => p.id));
    const replay = ctx.ledger.full();
    const rows = [];
    ctx.ledger.prepared.forEach((entry, index) => {
        if (!inScope.has(entry.tx.portfolio_id)) {
            return;
        }
        const detail = replay.details.get(entry.tx.id);
        if (detail) {
            rows.push(transactionDto(ctx, entry.tx, index + 1, detail));
        }
    });
    const result = runCollectionQuery(rows, query, {
        schema: TX_SCHEMA,
        sortable: TX_SORTABLE,
        settings: ctx.settings,
        defaultSort: [{ property: 'executed_at', direction: 'DESC' }, { property: 'seq', direction: 'DESC' }],
        tieBreak: 'id'
    });
    return { ...result, scope };
}

function validateTradeInput(ctx, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw badRequest('INVALID_TRADE', 'A JSON object body is required.');
    }
    const { portfolio_id: portfolioId, company_id: companyId, quantity } = body;
    if (!Number.isInteger(portfolioId) || portfolioId <= 0) {
        throw badRequest('INVALID_PORTFOLIO_ID', '"portfolio_id" must be a positive integer.');
    }
    if (!Number.isInteger(companyId) || companyId <= 0) {
        throw badRequest('INVALID_COMPANY_ID', '"company_id" must be a positive integer.');
    }
    const tradeType = typeof body.trade_type === 'string' ? body.trade_type.toUpperCase() : null;
    if (tradeType !== 'BUY' && tradeType !== 'SELL') {
        throw badRequest('INVALID_TRADE_TYPE', '"trade_type" must be BUY or SELL.');
    }
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
        throw badRequest('INVALID_QUANTITY', `"quantity" must be a whole number between 1 and ${MAX_QUANTITY}.`);
    }
    const portfolio = ctx.fixtures.portfoliosById.get(portfolioId);
    if (!portfolio) {
        throw notFound('PORTFOLIO_NOT_FOUND', `Portfolio ${portfolioId} does not exist.`);
    }
    const company = ctx.fixtures.companiesById.get(companyId);
    if (!company) {
        throw notFound('COMPANY_NOT_FOUND', `Company ${companyId} does not exist.`);
    }
    return { portfolio, company, tradeType, quantity };
}

function nextRuntimeId(ctx) {
    let max = 0;
    for (const tx of ctx.journal.transactions) {
        const n = Number(String(tx.id).replace(/^R-/, ''));
        if (Number.isInteger(n) && n > max) {
            max = n;
        }
    }
    return `R-${String(max + 1).padStart(6, '0')}`;
}

/**
 * Execute a simulated trade. Runs inside the serial mutation queue so that two
 * simultaneous requests can never overspend cash or shares: validate against
 * the current ledger, write the complete new journal atomically, and only then
 * commit it to memory. A failed write leaves no trace.
 */
function executeTrade(ctx, body) {
    return ctx.queue.run(async () => {
        const { portfolio, company, tradeType, quantity } = validateTradeInput(ctx, body);
        if (!ctx.settings.trading_enabled) {
            throw conflict('TRADING_DISABLED', 'Simulated trading is disabled.');
        }
        if (portfolio.status !== 'ACTIVE') {
            throw conflict('PORTFOLIO_NOT_ACTIVE', `Portfolio ${portfolio.id} is not active.`);
        }

        // Authoritative latest tick; the client never supplies price or time.
        const snapshot = ctx.simulator.snapshot();
        const price = ctx.simulator.priceCents(company.id, snapshot.tickIndex);
        const tx = {
            id: nextRuntimeId(ctx),
            portfolio_id: portfolio.id,
            company_id: company.id,
            trade_type: tradeType,
            quantity,
            execution_price_cents: price,
            fee_cents: ctx.settings.transaction_fee_cents,
            executed_at: snapshot.asOf,
            source: 'RUNTIME',
            tick_index: snapshot.tickIndex,
            scenario_id: snapshot.scenarioId
        };

        // Dry-run on a copy of the portfolio's latest state; throws 409 on a violation.
        const state = cloneState(ctx.ledger.full().states.get(portfolio.id));
        const detail = applyTransaction(state, tx, snapshot.asOfMs);

        try {
            await ctx.journal.persist([...ctx.journal.transactions, tx]);
        } catch (err) {
            ctx.logger.error(`Runtime journal write failed: ${err.message}`);
            throw new AppError(500, 'PERSISTENCE_FAILED', 'The trade was not recorded because the runtime journal could not be written.');
        }
        ctx.ledger.refresh();

        const seq = ctx.ledger.prepared.findIndex((e) => e.tx.id === tx.id) + 1;
        const position = state.positions.get(company.id);
        return {
            snapshot,
            data: {
                ...transactionDto(ctx, tx, seq, detail),
                portfolio_cash_after: usd(state.cash_cents),
                position_quantity_after: position ? position.quantity : 0
            }
        };
    });
}

module.exports = { listTransactions, executeTrade, transactionDto };

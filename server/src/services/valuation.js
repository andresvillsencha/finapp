'use strict';

/**
 * Valuation: marks ledger positions to the simulator's prices at ONE snapshot
 * tick. Everything here works in integer cents; conversion to dollars happens in
 * the DTO builders. This is the single place where market value, unrealized P/L,
 * daily P/L and portfolio value are calculated, so no screen can disagree.
 */

/**
 * Build the per-portfolio view at a snapshot:
 *   { snapshot, tick, prevTick, byPortfolio: Map(id -> { portfolio, state, rows, summary }) }
 * Position row: quantity, cost, price, previous price, market value, unrealized
 * and daily P/L (all cents).
 */
function buildView(ctx, snapshot) {
    const { simulator, ledger, fixtures } = ctx;
    const tick = snapshot.tickIndex;
    const prevTick = simulator.previousCloseTick(tick);
    const states = ledger.stateAt(snapshot.asOfMs);

    const prices = new Map();
    const priceAt = (companyId, t) => {
        const key = `${companyId}:${t}`;
        if (!prices.has(key)) {
            prices.set(key, simulator.priceCents(companyId, t));
        }
        return prices.get(key);
    };

    const byPortfolio = new Map();
    for (const portfolio of fixtures.portfolios) {
        const state = states.get(portfolio.id);
        const rows = [];
        for (const [companyId, position] of state.positions) {
            const price = priceAt(companyId, tick);
            const prev = priceAt(companyId, prevTick);
            const marketValue = position.quantity * price;
            rows.push({
                portfolio_id: portfolio.id,
                company_id: companyId,
                quantity: position.quantity,
                cost_cents: position.cost_cents,
                price_cents: price,
                prev_price_cents: prev,
                market_value_cents: marketValue,
                unrealized_pl_cents: marketValue - position.cost_cents,
                daily_pl_cents: position.quantity * (price - prev)
            });
        }
        rows.sort((a, b) => a.company_id - b.company_id);
        byPortfolio.set(portfolio.id, { portfolio, state, rows, summary: summarize(state, rows) });
    }
    return { snapshot, tick, prevTick, byPortfolio };
}

/**
 * Portfolio totals (cents):
 *  portfolio value = cash + sum(market value)
 *  investment P/L  = realized P/L + unrealized P/L   (v1 definition)
 */
function summarize(state, rows) {
    let marketValue = 0;
    let costBasis = 0;
    let unrealized = 0;
    let daily = 0;
    for (const r of rows) {
        marketValue += r.market_value_cents;
        costBasis += r.cost_cents;
        unrealized += r.unrealized_pl_cents;
        daily += r.daily_pl_cents;
    }
    return {
        initial_cash_cents: state.initial_cash_cents,
        cash_cents: state.cash_cents,
        market_value_cents: marketValue,
        cost_basis_cents: costBasis,
        unrealized_pl_cents: unrealized,
        realized_pl_cents: state.realized_pl_cents,
        investment_pl_cents: state.realized_pl_cents + unrealized,
        portfolio_value_cents: state.cash_cents + marketValue,
        daily_pl_cents: daily,
        fees_cents: state.fees_cents,
        position_count: rows.length
    };
}

/** Sum several portfolio summaries (the "All Portfolios" scope). */
function combineSummaries(summaries) {
    const total = {
        initial_cash_cents: 0, cash_cents: 0, market_value_cents: 0, cost_basis_cents: 0,
        unrealized_pl_cents: 0, realized_pl_cents: 0, investment_pl_cents: 0,
        portfolio_value_cents: 0, daily_pl_cents: 0, fees_cents: 0, position_count: 0
    };
    for (const s of summaries) {
        for (const key of Object.keys(total)) {
            total[key] += s[key];
        }
    }
    return total;
}

/**
 * Sample portfolio values at the given ticks by replaying the journal
 * incrementally and pricing with the SAME simulator function used for spot
 * prices. Returns [{ tick, ms, byPortfolio: Map(id -> { cash_cents, market_value_cents }) }].
 */
function sampleHistory(ctx, portfolioIds, ticks) {
    const { simulator, ledger } = ctx;
    const replayer = ledger.replayer();
    return ticks.map((tick) => {
        const ms = simulator.tickTimestampMs(tick);
        replayer.advanceTo(ms);
        const byPortfolio = new Map();
        for (const id of portfolioIds) {
            const state = replayer.states.get(id);
            let marketValue = 0;
            for (const [companyId, position] of state.positions) {
                marketValue += position.quantity * simulator.priceCents(companyId, tick);
            }
            byPortfolio.set(id, { cash_cents: state.cash_cents, market_value_cents: marketValue });
        }
        return { tick, ms, byPortfolio };
    });
}

module.exports = { buildView, summarize, combineSummaries, sampleHistory };

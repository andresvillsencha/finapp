'use strict';

/** Company directory with a simulated quote, and company price series. */
const { badRequest, notFound } = require('../utils/errors');
const { usd, pct } = require('../utils/money');
const { runCollectionQuery } = require('../utils/query');
const { resolveRange, HISTORY_POINTS } = require('./portfolioService');

const NUMBER = { type: 'number' };
const TEXT = { type: 'string' };
const COMPANY_SCHEMA = {
    symbol: TEXT, company: TEXT, sector: TEXT, industry: TEXT, country: TEXT,
    id: NUMBER, current_price: NUMBER, day_change: NUMBER, day_change_pct: NUMBER
};
const COMPANY_SORTABLE = new Set(Object.keys(COMPANY_SCHEMA));

function companyDto(ctx, company, snapshot) {
    const { simulator } = ctx;
    const price = simulator.priceCents(company.id, snapshot.tickIndex);
    const prev = simulator.priceCents(company.id, simulator.previousCloseTick(snapshot.tickIndex));
    return {
        id: company.id,
        symbol: company.symbol,
        company: company.name,
        sector: company.sector,
        industry: company.industry,
        country: company.country,
        currency: company.currency,
        exchange: company.exchange,
        is_active: company.is_active,
        description: company.description,
        current_price: usd(price),
        previous_price: usd(prev),
        day_change: usd(price - prev),
        day_change_pct: pct(price - prev, prev)
    };
}

function listCompanies(ctx, snapshot, query) {
    let rows = ctx.fixtures.companies.map((c) => companyDto(ctx, c, snapshot));
    if (query.query !== undefined && String(query.query).trim() !== '') {
        const needle = String(query.query).trim().toLowerCase();
        rows = rows.filter((r) => [r.symbol, r.company, r.sector, r.industry]
            .some((field) => String(field).toLowerCase().includes(needle)));
    }
    return runCollectionQuery(rows, query, {
        schema: COMPANY_SCHEMA,
        sortable: COMPANY_SORTABLE,
        settings: ctx.settings,
        defaultSort: [{ property: 'symbol', direction: 'ASC' }],
        tieBreak: 'id'
    });
}

/** Price series sampled from the same deterministic function as spot prices. */
function companyPrices(ctx, snapshot, rawId, query) {
    if (typeof rawId !== 'string' || !/^\d+$/.test(rawId)) {
        throw badRequest('INVALID_COMPANY_ID', 'Company id must be an integer.');
    }
    const company = ctx.fixtures.companiesById.get(Number(rawId));
    if (!company) {
        throw notFound('COMPANY_NOT_FOUND', `Company ${rawId} does not exist.`);
    }
    const range = resolveRange(ctx, query.range);
    const { simulator } = ctx;
    const endTick = snapshot.tickIndex;
    const days = simulator.rangeDays(range);
    const startTick = days === null ? 0 : Math.max(0, endTick - Math.round(days * simulator.ticksPerDay));
    const rows = simulator.sampleTicks(startTick, endTick, HISTORY_POINTS).map((tick) => ({
        timestamp: new Date(simulator.tickTimestampMs(tick)).toISOString(),
        tick_index: tick,
        price: usd(simulator.priceCents(company.id, tick))
    }));
    return {
        rows,
        meta: {
            companyId: company.id,
            symbol: company.symbol,
            range,
            timeScale: 'SIMULATED_TIME',
            points: rows.length,
            simulatedSpanDays: Math.round(((endTick - startTick) / simulator.ticksPerDay) * 100) / 100
        }
    };
}

module.exports = { listCompanies, companyPrices, companyDto };

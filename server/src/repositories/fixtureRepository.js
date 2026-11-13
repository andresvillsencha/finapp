'use strict';

/**
 * Read-only access to the nine immutable baseline fixtures in
 * server/data/fixtures/. Fixtures are parsed once at startup, deep-frozen, and
 * NEVER written by this application.
 */
const fs = require('node:fs');
const path = require('node:path');
const { StartupError } = require('../utils/errors');

const FIXTURE_FILES = {
    companies: 'companies.json',
    portfolios: 'portfolios.json',
    transactions: 'transactions.json',
    marketConfig: 'market-config.json',
    scenarios: 'market-scenarios.json',
    events: 'market-events.json',
    benchmarks: 'benchmarks.json',
    watchlists: 'watchlists.json',
    settings: 'app-settings.json'
};

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
    }
    return value;
}

function loadFixtures(dir) {
    const fixtures = { dir };
    const missing = [];
    for (const [key, file] of Object.entries(FIXTURE_FILES)) {
        const filePath = path.join(dir, file);
        let text;
        try {
            text = fs.readFileSync(filePath, 'utf8');
        } catch (err) {
            missing.push(`${file}: missing or unreadable (${err.code || err.message})`);
            continue;
        }
        try {
            fixtures[key] = JSON.parse(text);
        } catch (err) {
            missing.push(`${file}: invalid JSON (${err.message})`);
        }
    }
    if (missing.length > 0) {
        throw new StartupError('Fixture files could not be loaded', missing);
    }
    // Freeze the parsed data (not the container, which also carries lookup indexes).
    Object.keys(FIXTURE_FILES).forEach((key) => deepFreeze(fixtures[key]));

    // Lookup indexes (the Maps themselves are internal).
    fixtures.companiesById = new Map(fixtures.companies.map((c) => [c.id, c]));
    fixtures.companiesBySymbol = new Map(fixtures.companies.map((c) => [c.symbol, c]));
    fixtures.portfoliosById = new Map(fixtures.portfolios.map((p) => [p.id, p]));
    fixtures.instrumentsByCompanyId = new Map(fixtures.marketConfig.instruments.map((i) => [i.company_id, i]));
    return fixtures;
}

const isInt = (v) => Number.isInteger(v);
const isPosInt = (v) => Number.isInteger(v) && v > 0;

/** Structural and referential validation. Returns { errors, warnings }. */
function validateFixtures(fx) {
    const errors = [];
    const warnings = [];
    const err = (msg) => errors.push(msg);

    // companies
    const symbols = new Set();
    const companyIds = new Set();
    for (const c of fx.companies) {
        if (!isPosInt(c.id)) err(`companies: invalid id ${JSON.stringify(c.id)}`);
        if (companyIds.has(c.id)) err(`companies: duplicate id ${c.id}`);
        companyIds.add(c.id);
        if (!c.symbol || typeof c.symbol !== 'string') err(`companies: company ${c.id} has no symbol`);
        if (symbols.has(c.symbol)) err(`companies: duplicate symbol ${c.symbol}`);
        symbols.add(c.symbol);
        if (!c.name || !c.sector) err(`companies: company ${c.id} needs name and sector`);
    }

    // market config
    const sim = fx.marketConfig.simulation || {};
    if (!Number.isFinite(Date.parse(sim.epoch_utc))) err('market-config: invalid simulation.epoch_utc');
    if (!isPosInt(sim.tick_duration_ms) || 86400000 % sim.tick_duration_ms !== 0) {
        err('market-config: simulation.tick_duration_ms must be a positive integer dividing one day');
    }
    if (!(sim.simulation_speed > 0)) err('market-config: simulation.simulation_speed must be > 0');
    if (!isInt(sim.seed)) err('market-config: simulation.seed must be an integer');
    if (!isPosInt(sim.price_floor_cents)) err('market-config: simulation.price_floor_cents must be a positive integer');
    const instrumentIds = new Set();
    for (const i of fx.marketConfig.instruments) {
        const company = fx.companiesById.get(i.company_id);
        if (!company) err(`market-config: instrument references unknown company ${i.company_id}`);
        else if (company.symbol !== i.symbol) err(`market-config: instrument ${i.company_id} symbol ${i.symbol} != company symbol ${company.symbol}`);
        if (instrumentIds.has(i.company_id)) err(`market-config: duplicate instrument ${i.company_id}`);
        instrumentIds.add(i.company_id);
        if (!isPosInt(i.base_price_cents)) err(`market-config: instrument ${i.symbol} has invalid base_price_cents`);
        if (!(i.volatility_multiplier > 0)) err(`market-config: instrument ${i.symbol} has invalid volatility_multiplier`);
        if (!Number.isFinite(i.drift_per_sim_day_bps) || !Number.isFinite(i.phase)) err(`market-config: instrument ${i.symbol} has invalid drift/phase`);
    }
    for (const id of companyIds) {
        if (!instrumentIds.has(id)) err(`market-config: company ${id} has no instrument`);
    }

    // scenarios
    const scenarioIds = new Set();
    for (const s of fx.scenarios) {
        if (!s.id) err('market-scenarios: scenario without id');
        if (scenarioIds.has(s.id)) err(`market-scenarios: duplicate id ${s.id}`);
        scenarioIds.add(s.id);
        if (!Number.isFinite(s.drift_multiplier) || !(s.volatility_multiplier > 0)) err(`market-scenarios: ${s.id} has invalid multipliers`);
    }
    if (!scenarioIds.has(sim.default_scenario_id)) err(`market-config: default_scenario_id "${sim.default_scenario_id}" is not a known scenario`);

    // portfolios
    const portfolioIds = new Set();
    for (const p of fx.portfolios) {
        if (!isPosInt(p.id)) err(`portfolios: invalid id ${JSON.stringify(p.id)}`);
        if (portfolioIds.has(p.id)) err(`portfolios: duplicate id ${p.id}`);
        portfolioIds.add(p.id);
        if (!isPosInt(p.initial_cash_cents)) err(`portfolios: ${p.id} needs positive integer initial_cash_cents`);
        if (!Number.isFinite(Date.parse(p.created_at))) err(`portfolios: ${p.id} has invalid created_at`);
    }

    // baseline transactions (shape only; accounting is checked by the ledger replay)
    const txIds = new Set();
    for (const t of fx.transactions) {
        if (!t.id || txIds.has(t.id)) err(`transactions: missing or duplicate id ${t.id}`);
        txIds.add(t.id);
        if (!portfolioIds.has(t.portfolio_id)) err(`transactions: ${t.id} references unknown portfolio ${t.portfolio_id}`);
        if (!companyIds.has(t.company_id)) err(`transactions: ${t.id} references unknown company ${t.company_id}`);
        if (t.trade_type !== 'BUY' && t.trade_type !== 'SELL') err(`transactions: ${t.id} has invalid trade_type`);
        if (!isPosInt(t.quantity)) err(`transactions: ${t.id} quantity must be a positive integer`);
        if (!isPosInt(t.execution_price_cents)) err(`transactions: ${t.id} execution_price_cents must be a positive integer`);
        if (!isInt(t.fee_cents) || t.fee_cents < 0) err(`transactions: ${t.id} fee_cents must be a non-negative integer`);
        if (!Number.isFinite(Date.parse(t.executed_at))) err(`transactions: ${t.id} has invalid executed_at`);
    }

    // benchmarks, watchlists, events, settings
    const benchIds = new Set();
    for (const b of fx.benchmarks) {
        if (!b.id || benchIds.has(b.id)) err(`benchmarks: missing or duplicate id ${b.id}`);
        benchIds.add(b.id);
        if (!(b.base_value > 0) || !isInt(b.seed)) err(`benchmarks: ${b.id} needs positive base_value and integer seed`);
    }
    for (const w of fx.watchlists) {
        for (const s of w.symbols) {
            if (!symbols.has(s)) err(`watchlists: "${w.name}" references unknown symbol ${s}`);
        }
    }
    for (const e of fx.events) {
        if (!companyIds.has(e.company_id)) err(`market-events: event ${e.id} references unknown company ${e.company_id}`);
        if (e.is_real_event !== false) err(`market-events: event ${e.id} must have is_real_event=false`);
    }
    const st = fx.settings;
    if (!Array.isArray(st.chart_ranges) || st.chart_ranges.length === 0) err('app-settings: chart_ranges must be a non-empty array');
    if (!isPosInt(st.page_size) || !isPosInt(st.max_page_size) || st.page_size > st.max_page_size) err('app-settings: page_size / max_page_size are invalid');
    if (!isInt(st.transaction_fee_cents) || st.transaction_fee_cents < 0) err('app-settings: transaction_fee_cents must be a non-negative integer');
    if (st.allow_short_selling || st.allow_margin || st.allow_fractional_shares) {
        warnings.push('app-settings: short selling, margin and fractional shares are not supported in v1 and are ignored');
    }
    return { errors, warnings };
}

module.exports = { FIXTURE_FILES, loadFixtures, validateFixtures };

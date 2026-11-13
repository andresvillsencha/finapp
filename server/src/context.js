'use strict';

/**
 * Builds the application context: immutable fixtures, the deterministic market
 * simulator, the runtime journal and the ledger. Everything is validated here;
 * if anything is inconsistent the server refuses to start (fail fast) instead of
 * serving wrong financial numbers.
 */
const { loadFixtures, validateFixtures } = require('./repositories/fixtureRepository');
const { RuntimeJournal } = require('./repositories/runtimeJournal');
const { createMarketSimulator } = require('./services/marketSimulator');
const { LedgerService } = require('./services/ledger');
const { SerialQueue } = require('./utils/serialQueue');
const { systemClock } = require('./utils/clock');
const { StartupError } = require('./utils/errors');
const { DEFAULT_FIXTURES_DIR, DEFAULT_RUNTIME_DIR } = require('./config');

function createContext({
    fixturesDir = DEFAULT_FIXTURES_DIR,
    runtimeDir = DEFAULT_RUNTIME_DIR,
    clock = systemClock(),
    scenarioId = null,
    writer,
    logger = console
} = {}) {
    const fixtures = loadFixtures(fixturesDir);
    const { errors, warnings } = validateFixtures(fixtures);
    if (errors.length > 0) {
        throw new StartupError('Fixture validation failed', errors);
    }

    const simulator = createMarketSimulator({
        marketConfig: fixtures.marketConfig,
        scenarios: fixtures.scenarios,
        benchmarks: fixtures.benchmarks,
        clock,
        scenarioId
    });

    const journalOptions = { runtimeDir };
    if (writer) {
        journalOptions.writer = writer;
    }
    const journal = new RuntimeJournal(journalOptions).init();

    // Runtime trades must reference real portfolios/companies before replay.
    const journalIssues = [];
    for (const tx of journal.transactions) {
        if (!fixtures.portfoliosById.has(tx.portfolio_id)) {
            journalIssues.push(`runtime ${tx.id}: unknown portfolio ${tx.portfolio_id}`);
        }
        if (!fixtures.companiesById.has(tx.company_id)) {
            journalIssues.push(`runtime ${tx.id}: unknown company ${tx.company_id}`);
        }
    }
    if (journalIssues.length > 0) {
        throw new StartupError('Runtime journal validation failed', journalIssues);
    }

    const ledger = new LedgerService({ fixtures, journal });
    const accountingErrors = ledger.validate();
    if (accountingErrors.length > 0) {
        throw new StartupError(
            'Transaction journal is inconsistent (negative cash or holdings)',
            accountingErrors.map((e) => `${e.transaction_id}: ${e.code} - ${e.message}`)
        );
    }

    return {
        fixtures,
        settings: fixtures.settings,
        simulator,
        journal,
        ledger,
        queue: new SerialQueue(),
        clock,
        logger,
        warnings,
        startedAt: new Date().toISOString()
    };
}

module.exports = { createContext };

'use strict';

/**
 * PortfolioIQ API entry point.
 * Single Node.js process; JSON fixtures + runtime journal only (no database).
 */
const { loadEnvFile, getConfig } = require('./config');

loadEnvFile();
const config = getConfig();

const { createContext } = require('./context');
const { createApp } = require('./app');
const { StartupError } = require('./utils/errors');

let ctx;
try {
    ctx = createContext({
        fixturesDir: config.fixturesDir,
        runtimeDir: config.runtimeDir,
        scenarioId: config.scenarioId
    });
} catch (err) {
    if (err instanceof StartupError) {
        console.error(`Startup failed: ${err.message}`);
        err.issues.slice(0, 25).forEach((issue) => console.error(`  - ${issue}`));
        if (err.issues.length > 25) {
            console.error(`  ... and ${err.issues.length - 25} more`);
        }
    } else {
        console.error(`Startup failed: ${err.stack || err}`);
    }
    process.exit(1);
}

const app = createApp(ctx, { corsOrigins: config.corsOrigins, logRequests: config.logRequests });
const server = app.listen(config.port, config.host, () => {
    const snapshot = ctx.simulator.snapshot();
    console.log('PortfolioIQ API (SIMULATED DATA / DEMO)');
    console.log(`  Listening on http://${config.host}:${config.port}/api`);
    console.log(`  Fixtures: ${ctx.fixtures.dir}`);
    console.log(`  Runtime journal: ${ctx.journal.file} (${ctx.journal.transactions.length} trades)`);
    console.log(`  Scenario: ${snapshot.scenarioId}, tick ${snapshot.tickIndex}, as of ${snapshot.asOf}`);
    console.log(`  CORS origins: ${config.corsOrigins.join(', ') || '(none)'}`);
});

function shutdown(signal) {
    console.log(`${signal} received, finishing queued trades and shutting down...`);
    // Let any queued trade finish writing before the process exits.
    ctx.queue.run(async () => undefined).then(() => {
        server.close(() => process.exit(0));
    });
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

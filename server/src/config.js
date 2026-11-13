'use strict';

/**
 * Backend configuration.
 *
 * All data paths are derived from this module's location (never from
 * process.cwd()), so the server behaves the same wherever it is started from.
 */
const path = require('node:path');

const SERVER_ROOT = path.resolve(__dirname, '..');
const DEFAULT_FIXTURES_DIR = path.join(SERVER_ROOT, 'data', 'fixtures');
const DEFAULT_RUNTIME_DIR = path.join(SERVER_ROOT, 'data', 'runtime');

// Sencha Cmd serves the Ext JS app on 1841 by default.
const DEFAULT_CORS_ORIGINS = 'http://localhost:1841,http://127.0.0.1:1841';

/** Load server/.env (if present) into process.env. Never required. */
function loadEnvFile() {
    try {
        require('dotenv').config({ path: path.join(SERVER_ROOT, '.env'), quiet: true });
    } catch (err) {
        // dotenv is optional; defaults below apply.
    }
}

function getConfig(env = process.env) {
    const port = Number(env.PORT);
    return {
        serverRoot: SERVER_ROOT,
        fixturesDir: DEFAULT_FIXTURES_DIR,
        runtimeDir: DEFAULT_RUNTIME_DIR,
        host: env.HOST || '127.0.0.1',
        port: Number.isInteger(port) && port > 0 ? port : 3000,
        corsOrigins: (env.CORS_ORIGINS === undefined ? DEFAULT_CORS_ORIGINS : env.CORS_ORIGINS)
            .split(',').map((s) => s.trim()).filter(Boolean),
        logRequests: env.LOG_REQUESTS !== 'false',
        scenarioId: env.SIMULATION_SCENARIO || null
    };
}

module.exports = {
    SERVER_ROOT,
    DEFAULT_FIXTURES_DIR,
    DEFAULT_RUNTIME_DIR,
    loadEnvFile,
    getConfig
};

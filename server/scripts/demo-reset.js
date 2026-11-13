'use strict';

/**
 * npm run demo:reset -- --yes
 *
 * Explicitly clears the mutable demo state (simulated trades) in
 * server/data/runtime/. Baseline fixtures are never touched. This never runs
 * automatically and requires the --yes flag; without it the command only
 * reports what it would delete. Stop the server before resetting.
 */
const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_RUNTIME_DIR } = require('../src/config');

// Only these files, only inside the runtime directory, can ever be removed.
const RESETTABLE = ['transactions.json', 'state.json'];

function main() {
    const confirmed = process.argv.includes('--yes');
    console.log('PortfolioIQ demo:reset');
    console.log(`Runtime directory: ${DEFAULT_RUNTIME_DIR}`);
    const present = RESETTABLE
        .map((name) => path.join(DEFAULT_RUNTIME_DIR, name))
        .filter((file) => fs.existsSync(file));
    if (present.length === 0) {
        console.log('Nothing to reset: the runtime journal is already empty.');
        return;
    }
    present.forEach((file) => console.log(`  will delete: ${path.basename(file)}`));
    if (!confirmed) {
        console.log('No changes made. Re-run with --yes to confirm:  npm run demo:reset -- --yes');
        process.exitCode = 2;
        return;
    }
    present.forEach((file) => fs.rmSync(file, { force: true }));
    console.log('Done. Simulated trades were cleared; baseline fixtures are untouched.');
}

main();

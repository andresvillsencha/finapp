'use strict';

/**
 * npm run demo:seed
 *
 * The nine baseline fixtures are canonical, hand-curated demo data. This command
 * therefore NEVER writes or regenerates them. It validates that all nine exist
 * and are consistent, and makes sure the (untracked) runtime directory exists.
 * If a fixture is missing, restore it from source control; it is not recreated.
 */
const fs = require('node:fs');
const { DEFAULT_FIXTURES_DIR, DEFAULT_RUNTIME_DIR } = require('../src/config');
const { FIXTURE_FILES, loadFixtures, validateFixtures } = require('../src/repositories/fixtureRepository');
const { StartupError } = require('../src/utils/errors');

function main() {
    console.log('PortfolioIQ demo:seed (read-only check of baseline fixtures)');
    console.log(`Fixtures: ${DEFAULT_FIXTURES_DIR}`);
    let fixtures;
    try {
        fixtures = loadFixtures(DEFAULT_FIXTURES_DIR);
    } catch (err) {
        if (err instanceof StartupError) {
            console.error(`FAIL ${err.message}`);
            err.issues.forEach((issue) => console.error(`  - ${issue}`));
            console.error('Restore the missing/invalid fixture files from source control; they are not regenerated.');
            process.exit(1);
        }
        throw err;
    }
    const { errors, warnings } = validateFixtures(fixtures);
    warnings.forEach((w) => console.log(`WARN ${w}`));
    if (errors.length > 0) {
        console.error(`FAIL ${errors.length} fixture problem(s):`);
        errors.forEach((e) => console.error(`  - ${e}`));
        process.exit(1);
    }
    fs.mkdirSync(DEFAULT_RUNTIME_DIR, { recursive: true });
    console.log(`OK   all ${Object.keys(FIXTURE_FILES).length} fixture files present and consistent (unchanged).`);
    console.log(`OK   runtime directory ready: ${DEFAULT_RUNTIME_DIR}`);
}

main();

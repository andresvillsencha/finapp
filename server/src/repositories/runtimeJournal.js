'use strict';

/**
 * The mutable demo journal: server/data/runtime/transactions.json.
 *
 * Only simulated user trades live here. Baseline fixtures are never touched.
 * Writes go through an atomic temp-file + rename (see utils/atomicWrite.js) and
 * the in-memory copy is replaced ONLY after the write succeeded, so a failed
 * write can never expose half-applied state.
 */
const fs = require('node:fs');
const path = require('node:path');
const { writeJsonAtomic } = require('../utils/atomicWrite');
const { StartupError } = require('../utils/errors');

const JOURNAL_FILE = 'transactions.json';

class RuntimeJournal {
    constructor({ runtimeDir, writer = writeJsonAtomic }) {
        this.runtimeDir = runtimeDir;
        this.file = path.join(runtimeDir, JOURNAL_FILE);
        this.writer = writer;
        this.transactions = [];
    }

    /** Create the runtime directory if missing and load any existing journal. */
    init() {
        fs.mkdirSync(this.runtimeDir, { recursive: true });
        if (!fs.existsSync(this.file)) {
            this.transactions = [];
            return this;
        }
        let parsed;
        try {
            parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        } catch (err) {
            // Never overwrite a journal we cannot read: the operator must decide.
            throw new StartupError(`Runtime journal ${JOURNAL_FILE} is unreadable`, [err.message]);
        }
        if (!Array.isArray(parsed)) {
            throw new StartupError(`Runtime journal ${JOURNAL_FILE} must be a JSON array`);
        }
        this.transactions = parsed;
        return this;
    }

    /** Persist the complete next journal; replace the in-memory copy only on success. */
    async persist(nextTransactions) {
        await this.writer(this.file, nextTransactions);
        this.transactions = nextTransactions;
    }
}

module.exports = { RuntimeJournal, JOURNAL_FILE };

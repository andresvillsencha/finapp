'use strict';

const fs = require('node:fs');
const path = require('node:path');

const fsp = fs.promises;
// Windows can briefly refuse a rename over a file another process has open.
const RETRYABLE = new Set(['EPERM', 'EBUSY', 'EACCES']);

async function renameWithRetry(from, to) {
    for (let attempt = 0; ; attempt += 1) {
        try {
            await fsp.rename(from, to);
            return;
        } catch (err) {
            if (!RETRYABLE.has(err.code) || attempt >= 5) {
                throw err;
            }
            await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
        }
    }
}

/**
 * Atomically replace a JSON file: write the complete new content to a temporary
 * file in the SAME directory, flush it to disk, then rename it over the target.
 * A failure at any step leaves the previous file untouched and removes the
 * temporary file.
 */
async function writeJsonAtomic(filePath, data) {
    const dir = path.dirname(filePath);
    const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
    const json = `${JSON.stringify(data, null, 2)}\n`;
    let handle = null;
    try {
        handle = await fsp.open(tmp, 'w');
        await handle.writeFile(json, 'utf8');
        await handle.sync();
        await handle.close();
        handle = null;
        await renameWithRetry(tmp, filePath);
    } catch (err) {
        if (handle) {
            try {
                await handle.close();
            } catch (closeErr) {
                // ignore: the original error is the one that matters
            }
        }
        try {
            await fsp.unlink(tmp);
        } catch (unlinkErr) {
            // ignore: nothing to clean up
        }
        throw err;
    }
}

module.exports = { writeJsonAtomic };

'use strict';

/** Shared test helpers: temp runtime dir, frozen clock, real HTTP server. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createContext } = require('../src/context');
const { createApp } = require('../src/app');
const { fixedClock } = require('../src/utils/clock');
const { DEFAULT_FIXTURES_DIR } = require('../src/config');

const FROZEN_NOW = Date.parse('2026-11-13T12:00:00Z');
const silentLogger = { log() {}, error() {} };

function tempRuntimeDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'piq-test-'));
}

function fixtureHashes() {
    const hashes = {};
    for (const file of fs.readdirSync(DEFAULT_FIXTURES_DIR).sort()) {
        hashes[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(DEFAULT_FIXTURES_DIR, file))).digest('hex');
    }
    return hashes;
}

function makeContext({ runtimeDir = tempRuntimeDir(), clock = fixedClock(FROZEN_NOW), writer, scenarioId } = {}) {
    const ctx = createContext({ runtimeDir, clock, writer, scenarioId, logger: silentLogger });
    return { ctx, clock, runtimeDir };
}

/** Start the API on an ephemeral port. Returns request helpers and close(). */
async function startServer(options = {}) {
    const { ctx, clock, runtimeDir } = makeContext(options);
    const app = createApp(ctx, { corsOrigins: ['http://localhost:1841'], logRequests: false });
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}/api`;

    async function request(method, url, body, headers = {}) {
        const init = { method, headers: { ...headers } };
        if (body !== undefined) {
            init.headers['content-type'] = 'application/json';
            init.body = typeof body === 'string' ? body : JSON.stringify(body);
        }
        const res = await fetch(base + url, init);
        const text = await res.text();
        let json = null;
        try {
            json = JSON.parse(text);
        } catch (err) {
            // not JSON (CSV)
        }
        return { status: res.status, json, text, headers: res.headers };
    }

    return {
        ctx,
        clock,
        runtimeDir,
        base,
        get: (url, headers) => request('GET', url, undefined, headers),
        post: (url, body) => request('POST', url, body),
        close: () => new Promise((resolve) => server.close(resolve))
    };
}

const q = (obj) => encodeURIComponent(JSON.stringify(obj));

module.exports = { FROZEN_NOW, silentLogger, tempRuntimeDir, fixtureHashes, makeContext, startServer, q };

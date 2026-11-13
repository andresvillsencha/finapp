'use strict';

/** The real server clock (UTC epoch milliseconds). */
function systemClock() {
    return { nowMs: () => Date.now() };
}

/** An injectable, controllable clock for tests and verification. */
function fixedClock(startMs) {
    let current = startMs;
    return {
        nowMs: () => current,
        set(ms) {
            current = ms;
        },
        advance(ms) {
            current += ms;
        }
    };
}

module.exports = { systemClock, fixedClock };

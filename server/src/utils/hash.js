'use strict';

/**
 * Deterministic integer hash -> [0, 1). Pure function of its integer inputs, so
 * the same (seed, key, scale, index) always gives the same value on every
 * request, screen and restart. Used instead of Math.random().
 */
function hash01(...ints) {
    let h = 0x811c9dc5 | 0;
    for (let i = 0; i < ints.length; i += 1) {
        h = Math.imul(h ^ (ints[i] | 0), 0x01000193);
        h ^= h >>> 15;
        h = Math.imul(h, 0x2c1b3c6d);
        h ^= h >>> 12;
    }
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

module.exports = { hash01 };

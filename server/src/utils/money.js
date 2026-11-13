'use strict';

/**
 * Money helpers. All money is held as INTEGER CENTS internally and converted to
 * dollar numbers only at the API boundary.
 *
 * Rounding policy: half-up to the nearest cent for proportional cost basis
 * removal; percentages are rounded to 4 decimals at the API boundary.
 */

/** round(a * b / c) half-up for non-negative integers, exact via BigInt. */
function mulDivRound(a, b, c) {
    const A = BigInt(a);
    const B = BigInt(b);
    const C = BigInt(c);
    return Number((2n * A * B + C) / (2n * C));
}

/** Integer cents to a dollar number (e.g. 12345 -> 123.45). */
function usd(cents) {
    return Math.round(cents) / 100;
}

function round(value, decimals = 4) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

/** numerator / denominator * 100, or null when the denominator is not positive. */
function pct(numerator, denominator, decimals = 4) {
    if (!(denominator > 0)) {
        return null;
    }
    return round((numerator / denominator) * 100, decimals);
}

module.exports = { mulDivRound, usd, round, pct };

'use strict';

/**
 * Shared response helpers so every endpoint uses the same Ext JS-compatible
 * envelope: top-level success / data / total / meta.
 */

function sendCollection(res, records, total, meta = {}) {
    return res.status(200).json({ success: true, data: records, total, meta });
}

function sendRecord(res, record, meta = {}, options = {}) {
    const body = { success: true, data: record };
    if (options.message) {
        body.message = options.message;
    }
    body.meta = meta;
    return res.status(options.status || 200).json(body);
}

/**
 * Errors carry a top-level message and code (for Ext JS failure handlers) AND
 * the nested error object required by the specification.
 */
function sendError(res, status, code, message, details) {
    const body = {
        success: false,
        message,
        code,
        error: { code, message }
    };
    if (details !== undefined) {
        body.details = details;
    }
    return res.status(status).json(body);
}

module.exports = { sendCollection, sendRecord, sendError };

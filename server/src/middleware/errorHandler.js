'use strict';

const { AppError } = require('../utils/errors');
const { sendError } = require('../utils/apiResponse');

/** JSON 404 for any /api route that does not exist (never an HTML page). */
function notFoundHandler(req, res) {
    return sendError(res, 404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}`);
}

/**
 * Central error handler. Expected AppErrors keep their status/code; malformed
 * request bodies become 400; anything else is a generic 500 whose details are
 * logged server-side only (no stack traces reach the client).
 */
function createErrorHandler(logger) {
    // eslint-disable-next-line no-unused-vars
    return function errorHandler(err, req, res, next) {
        if (res.headersSent) {
            return next(err);
        }
        if (err instanceof AppError) {
            return sendError(res, err.status, err.code, err.message, err.details);
        }
        if (err && err.type === 'entity.parse.failed') {
            return sendError(res, 400, 'INVALID_JSON', 'The request body is not valid JSON.');
        }
        if (err && err.type === 'entity.too.large') {
            return sendError(res, 400, 'PAYLOAD_TOO_LARGE', 'The request body is too large.');
        }
        logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err && err.stack ? err.stack : err}`);
        return sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
    };
}

module.exports = { notFoundHandler, createErrorHandler };

'use strict';

const express = require('express');
const cors = require('cors');
const { buildRouter } = require('./routes');
const { notFoundHandler, createErrorHandler } = require('./middleware/errorHandler');

/**
 * Create the Express app for a prepared context.
 * options: { corsOrigins: string[], logRequests: boolean }
 */
function createApp(ctx, { corsOrigins = [], logRequests = false } = {}) {
    const app = express();
    app.disable('x-powered-by');

    // Only configured development origins may call the API from a browser.
    app.use(cors({
        origin(origin, callback) {
            callback(null, !origin || corsOrigins.includes(origin));
        },
        methods: ['GET', 'POST', 'OPTIONS']
    }));

    app.use('/api', (req, res, next) => {
        res.set({
            'Cache-Control': 'no-store', // simulated quotes must never be served stale
            'X-Content-Type-Options': 'nosniff'
        });
        next();
    });

    if (logRequests) {
        app.use((req, res, next) => {
            const started = Date.now();
            res.on('finish', () => {
                ctx.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`);
            });
            next();
        });
    }

    app.use(express.json({ limit: '10kb' }));
    app.use('/api', buildRouter(ctx));
    app.use(notFoundHandler);
    app.use(createErrorHandler(ctx.logger));
    return app;
}

module.exports = { createApp };

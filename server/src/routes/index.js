'use strict';

/**
 * Route map (base path /api). Handlers are thin: parsing and calculations live
 * in services; the endpoint list matches CLAUDE.md section 7.6.
 */
const express = require('express');
const portfolioController = require('../controllers/portfolioController');
const marketController = require('../controllers/marketController');
const holdingsController = require('../controllers/holdingsController');
const transactionController = require('../controllers/transactionController');
const analyticsController = require('../controllers/analyticsController');

function buildRouter(ctx) {
    const router = express.Router();
    const portfolios = portfolioController(ctx);
    const market = marketController(ctx);
    const holdings = holdingsController(ctx);
    const transactions = transactionController(ctx);
    const analytics = analyticsController(ctx);

    router.get('/health', market.health);
    router.get('/simulation/status', market.simulationStatus);

    router.get('/portfolios', portfolios.list);
    router.get('/portfolios/:id', portfolios.get);
    router.get('/dashboard', portfolios.dashboard);
    router.get('/portfolio-history', portfolios.history);
    router.get('/sector-allocation', portfolios.sectorAllocation);

    router.get('/companies', market.listCompanies);
    router.get('/companies/:id/prices', market.companyPrices);

    router.get('/holdings', holdings.list);
    router.get('/exports/holdings.csv', holdings.exportCsv);
    router.get('/exports/pivot.csv', analytics.exportPivotCsv);

    router.get('/transactions', transactions.list);
    router.post('/transactions', transactions.create);

    router.get('/analytics/pivot', analytics.pivot);
    router.get('/analytics/comparison', analytics.comparison);
    router.get('/analytics/sector-comparison', analytics.sectorComparison);

    return router;
}

module.exports = { buildRouter };

# PortfolioIQ — Investment Portfolio Intelligence (Demo Edition)

PortfolioIQ is a **demonstration application** for sales demos and technical webinars. It shows what **Sencha Ext JS 8 (Modern Toolkit)** can do with data-heavy, interactive screens, on top of a **Node.js / Express** backend that reads **local JSON files only. No database is required.**

> All stock prices, transactions, portfolio values and performance results are simulated and do not represent real market conditions or investment advice. Real company names and ticker symbols are used for illustrative identification only.

There are three screens in one shell:

| Screen | What it shows |
|---|---|
| **Dashboard** | Portfolio value, gain/loss, indicative daily change, cost basis and cash; a value-over-time chart (1M / 3M / 6M / 1Y / All); sector allocation donut; top and bottom five holdings; a summary table per portfolio |
| **Holdings Explorer** | A remotely sorted, filtered, paged and grouped grid of positions; company detail panel with a simulated price chart; a Transactions tab; the **Trade Simulator** (simulated Buy/Sell); CSV export |
| **Portfolio Analytics** | Normalized portfolio performance comparison with simulated benchmarks; sector exposure by portfolio; a Sector → Company aggregation grid by portfolio with subtotals and totals; CSV export |

Everything is **simulated**: prices follow a deterministic function of time, so the same company at the same simulated tick always has the same price, on every screen and after every server restart.

## Contents

- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Data, seeding and resetting](#data-seeding-and-resetting)
- [Running in development](#running-in-development)
- [Tests and checks](#tests-and-checks)
- [API overview](#api-overview)
- [Demo walkthrough](#demo-walkthrough)
- [Sencha packages and licensing](#sencha-packages-and-licensing)
- [Simulation disclosure and limitations](#simulation-disclosure-and-limitations)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)

## Prerequisites

- **Node.js** 20 or later (developed on v22) and **npm**.
- **Sencha Cmd** and the **Sencha Ext JS 8.0 SDK** (licensed software). The SDK is expected under `ext-js/ext` and is **not redistributed** in this repository; the app is configured for the **Modern** toolkit with the **Font Awesome**, **Charts** and **UX** packages (see `ext-js/app.json`).
- A modern desktop browser. The layout is desktop-first and responsive down to tablet width.

No database, no external market-data service and no account are needed.

## Quick start

Use two terminals.

**1. Backend** (from the repository root):

```bash
cd server
npm install
npm start
```

The API listens on `http://127.0.0.1:3000/api`. Check it: `http://127.0.0.1:3000/api/health`.

**2. Frontend**:

```bash
cd ext-js
sencha app watch
```

Open the URL Sencha Cmd prints (normally `http://localhost:1841`). The screens are `#dashboard`, `#holdings` and `#analytics`.

> **After changing backend code, restart `npm start`.** Node does not reload automatically (use `npm run dev` for restart-on-change). A browser pointed at an old server keeps working but will miss new endpoints.

To point the app at another local API port, add `?apiBase=http://127.0.0.1:PORT/api` to the page URL. Only `localhost`, `127.0.0.1` and `[::1]` are accepted.

## Configuration

**No database is required** and no secrets are used. Everything is optional.

### Environment variables (`server/.env`, see `server/.env.example`)

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | API port |
| `HOST` | `127.0.0.1` | Interface to listen on |
| `CORS_ORIGINS` | `http://localhost:1841,http://127.0.0.1:1841` | Browser origins allowed to call the API (comma separated) |
| `LOG_REQUESTS` | `true` | One log line per request |
| `SIMULATION_SCENARIO` | from the fixtures | Active market scenario (`normal`, `bull`, `bear`, `volatile`, `correction`, `recovery`) |

### Simulation parameters (`server/data/fixtures/market-config.json`)

| Setting | Value | Meaning |
|---|---|---|
| `seed` | `314159` | Seed of the deterministic price function |
| `epoch_utc` | `2025-01-01T00:00:00Z` | Where the simulated clock starts |
| `tick_duration_ms` | `5000` | Real time per price update (a new tick every 5 seconds) |
| `simulation_speed` | `1` | Simulated time per real time (a tick is one simulated step) |
| `default_scenario_id` | `normal` | Market scenario used when none is set |

The UI refreshes every `refresh_interval_ms` (5000) from `app-settings.json`, aligned with the ticks. Page sizes, trading rules (no margin, no short selling, whole shares, zero fee) and the disclaimer are in the same fixtures.

### Fixture paths

All nine baseline files live in `server/data/fixtures/`: `companies`, `portfolios`, `transactions`, `market-config`, `market-scenarios`, `market-events`, `benchmarks`, `watchlists` and `app-settings`. They are read by Node.js only (resolved from the backend module location, never from the working directory), are **never written by the app**, and are protected by the tests. Edit them by hand only if you intend to change the baseline, then run `npm run demo:verify`. The Ext JS app never imports them: it uses the REST API exclusively.

## Data, seeding and resetting

| Data | Where | Notes |
|---|---|---|
| Baseline | `server/data/fixtures/` | Companies, portfolios, the historical trade journal (`transactions.json`), market parameters. Immutable. |
| Runtime trades | `server/data/runtime/transactions.json` | Trades made in the Trade Simulator. Created on the first trade, written atomically, **not tracked by Git**, kept across restarts. |
| Derived values | computed on demand | Holdings, cash, realized and unrealized P/L, history and analytics are replayed from initial funding plus the complete journal, using the same price function as spot prices. Nothing derived is stored. |

Commands (run in `server/`):

```bash
npm run demo:seed             # read-only check of the nine fixtures; creates the runtime folder
npm run demo:verify           # checks references, accounting and reproducible prices
npm run demo:reset -- --yes   # clears the runtime journal of simulated trades
```

- `demo:seed` never regenerates or overwrites fixtures.
- **To reset the demo data** (undo every simulated trade): stop the server, run `npm run demo:reset -- --yes`, start the server again. Normal startup never deletes runtime data and the reset never runs automatically.

## Running in development

```bash
# terminal 1
cd server
npm run dev        # API with restart on file changes (or: npm start)

# terminal 2
cd ext-js
sencha app watch   # builds the Ext JS app and serves it with live rebuilds
```

The app polls `GET /api/simulation/status` every 5 seconds. Each screen then reloads only what changed for the new tick: the Holdings grid keeps its page, sort, filters, grouping, selection and scroll position.

## Tests and checks

Run in `server/`:

```bash
npm test                  # backend tests (node:test): simulator, ledger, query parsing, API contract, trades, exports
npm run demo:verify       # fixture and accounting consistency
```

The backend tests cover weighted-average cost, realized and unrealized P/L, insufficient cash or shares, atomic journal writes and serialized simultaneous trades, deterministic prices for identical timestamps, remote sort/filter/paging/grouping and the top-level `total`, reconciliation of positions, history and totals, the exports (including spreadsheet-formula protection), and protection of the fixture files. Results of the last full run are listed in `IMPLEMENTATION_PLAN.md` and `docs/DECISIONS.md`.

There is no automated browser test suite. Frontend behavior was checked by running the app against the real API; use the demo walkthrough below as the manual QA script.

## API overview

All endpoints are under `/api` (the full inventory, parameters and error codes are in `docs/API.md`; the contract is in `CLAUDE.md` section 7). Money values are JSON numbers; timestamps are ISO-8601 UTC.

Collections return:

```json
{
  "success": true,
  "data": [],
  "total": 0,
  "meta": { "asOf": "2026-11-13T14:00:00.000Z", "tickIndex": 312, "simulationMode": "DEMO" }
}
```

`total` is the number of rows matching the filters **before** paging. Single records return `data` as an object. Errors use a non-2xx status: `{ "success": false, "message": "...", "code": "...", "error": { "code": "...", "message": "..." } }`. Ext JS readers use `rootProperty: 'data'`, `totalProperty: 'total'`, `successProperty: 'success'` and `messageProperty: 'message'`.

Every response that carries prices includes `meta.asOf` and `meta.tickIndex`. Add `tick=<n>` to a request to pin related requests to one snapshot.

| Endpoint | Purpose |
|---|---|
| `GET /api/health`, `GET /api/simulation/status` | Readiness; clock, tick and next-tick time |
| `GET /api/portfolios`, `/api/portfolios/:id` | Portfolios with headline totals |
| `GET /api/dashboard`, `/api/portfolio-history`, `/api/sector-allocation` | Dashboard KPIs, value series, allocation |
| `GET /api/companies`, `/api/companies/:id/prices` | Company directory; simulated price series |
| `GET /api/holdings` | Positions: remote `sort`, `filter`, `group`, `query`, paging; `meta.totals` and `meta.groups` |
| `GET /api/transactions`, `POST /api/transactions` | History; execute a simulated Buy/Sell |
| `GET /api/analytics/pivot`, `/comparison`, `/sector-comparison` | Pivot source (`layout=wide` adds subtotals), normalized comparison, sector exposure |
| `GET /api/exports/holdings.csv`, `/api/exports/pivot.csv` | CSV exports |

Examples:

```bash
# Positions of portfolio 1, page 1 of 25, sorted by market value
curl "http://127.0.0.1:3000/api/holdings?portfolioId=1&start=0&limit=25&sort=%5B%7B%22property%22%3A%22market_value%22%2C%22direction%22%3A%22DESC%22%7D%5D"

# Dashboard for all portfolios, last 6 months
curl "http://127.0.0.1:3000/api/dashboard?portfolioId=all&range=6M"

# A simulated purchase (the price and time are always set by the server)
curl -X POST http://127.0.0.1:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"portfolio_id":1,"company_id":2,"trade_type":"BUY","quantity":10}'
```

## Demo walkthrough

About 5–8 minutes. Start both servers and open the app.

1. **Dashboard.** Point out the *SIMULATED DATA / DEMO* badge and the *Last simulated update* time that advances every 5 seconds. Pick **Technology Growth** in the header selector: the KPI cards, chart, donut and tables all follow. Explain that "Daily Change" is an indicative price change since the start of the UTC day.
2. **Range and allocation.** Switch the chart range (1M … All) and hover the chart and the donut for tooltips.
3. **Holdings Explorer.** Filter to **Technology** (or search "bank"), sort by a column, and group **By sector**: the group headers show server-calculated totals. Select a position to open the detail panel (company, simulated price chart, position summary, recent trades).
4. **Trade Simulator.** Click **Buy** (or **Buy More**), enter a quantity, execute. Show the confirmation with the server's price, the updated position, and (on the Transactions tab) the new trade. Try selling more shares than owned to see the rejection.
5. **Back on the Dashboard.** Cash, cost basis and value reflect the trade; nothing was reloaded manually.
6. **Portfolio Analytics.** Compare the portfolios and the simulated benchmarks (normalized to 100 at the start of the range), switch the sector chart between "% of portfolio" and market value, then show the Sector → Company grid by portfolio and switch its measure. Use **Export CSV**.
7. **Finish** by explaining the persistent but resettable runtime journal (`server/data/runtime/`), the deterministic time-driven price function, and the disclaimer. Reset with `npm run demo:reset -- --yes`.

## Sencha packages and licensing

- Ext JS 8 is licensed software; it is not included in this repository.
- **Pivot Grid and Exporter are not installed in the SDK used here.** Instead of faking them, Portfolio Analytics shows a functional grouped aggregation grid with the notice "Pivot Grid requires the applicable Sencha package/license.", and exports use server-side CSV.
- **To enable the real packages** (requires the applicable Sencha license): add the Enterprise `pivot` and `exporter` packages for the Modern toolkit to the workspace, list them in `requires` in `ext-js/app.json`, rebuild with Sencha Cmd, then replace the fallback grid in `FinApp.view.analytics.AnalyticsView` with a pivot grid (rows Sector → Company, columns Portfolio, measures Market Value, Cost Basis, Unrealized P/L, fed by `GET /api/analytics/pivot`) and use the exporter for the grids. Details are in `docs/DECISIONS.md` (Phase 5).
- The Ext JS Charts package logs a console warning about Sencha's SVG download server when a chart is created. The app does not use chart download; the warning comes from the SDK and is harmless.

## Simulation disclosure and limitations

**This is a demonstration.** Prices, trades, returns, benchmarks and dates are simulated. Real company names and ticker symbols are used only to make the demo recognizable. Nothing here is investment advice or a recommendation, and there is no connection to a broker, an exchange or a market-data provider. The app displays this disclosure prominently, and the header never claims live market data.

Limitations:

- Single user, single server process. The JSON journal does not support several server instances.
- No authentication, accounts, deposits or withdrawals, margin, short selling, fractional shares, fees, taxes or corporate actions. USD only.
- "Daily Change" and its percentage are indicative price changes since the start of the UTC day, not time-weighted returns; the percentage assumes no same-day cash flows.
- The baseline trade fills in `transactions.json` do not equal the simulator's price at the trade time (mean about 6%); history marks positions at simulator prices. `demo:verify` reports this as information.
- Portfolio performance series include cash; contributions and withdrawals are not modeled. Benchmarks are synthetic indices, not real ones.
- The 1Y chart range is **simulated time** (the clock started on 2025-01-01), not wall-clock history.
- Watchlists, market events and scenario/simulator controls exist as fixtures but have no screens. The mockups' risk metrics, risk analysis tab and scenario projections are intentionally not built (not in the specification).
- The Pivot Grid and Exporter packages are not installed; the labelled fallbacks are described above.

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| Red banner "The PortfolioIQ API is not reachable" | Start the backend (`npm start` in `server/`) or check the port; use `?apiBase=` for another port. |
| A screen is missing newer behavior (for example the pivot shows one row per position, or an export returns 404) | The API process is older than the code. Stop it and run `npm start` again. |
| Browser CORS error | The page origin is not in `CORS_ORIGINS`; add it to `server/.env`. |
| Trades disappeared | They were reset (`demo:reset`) or `server/data/runtime/` was deleted. |
| `sencha app watch` cannot find the framework | The Ext JS SDK is not installed under `ext-js/ext`. |

## Project structure

```text
finapp/
├── CLAUDE.md                  # Authoritative specification and rules
├── IMPLEMENTATION_PLAN.md     # Phased build plan and progress
├── README.md, README_INSTALL.md
├── .claude/skills/            # extjs, node, data guidelines
├── docs/
│   ├── mockups/               # Approved visual references (CLAUDE.md wins on conflicts)
│   ├── DECISIONS.md           # Assumptions, decisions and mockup deviations per phase
│   └── API.md                 # API inventory
├── ext-js/                    # Ext JS 8 Modern application (FinApp)
│   └── app/                   # models, stores, proxy, util, view/{main,dashboard,holdings,analytics,shared}
└── server/
    ├── src/                   # Express source (routes, controllers, services, repositories, utils)
    ├── scripts/               # demo:seed, demo:reset, demo:verify
    ├── tests/                 # Backend tests
    └── data/
        ├── fixtures/          # Nine immutable baseline JSON files
        └── runtime/           # Mutable demo journal, not tracked by Git
```

The Ext JS application is named **FinApp** (namespace `FinApp`); "PortfolioIQ" is the product name used in the UI and documentation.

## License

Proprietary software. All rights reserved.

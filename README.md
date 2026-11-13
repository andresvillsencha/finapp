# PortfolioIQ — Investment Portfolio Intelligence (Demo Edition)

PortfolioIQ is a **demonstration application** for sales demos and technical webinars. It is built with **Sencha Ext JS 8 (Modern Toolkit)** and a **Node.js / Express** backend that reads **JSON files only. No database is required.**

> All stock prices, transactions, portfolio values and performance results are simulated and do not represent real market conditions or investment advice. Real company names and ticker symbols are used for illustrative identification only.

The app has three screens in one shell: **Dashboard**, **Holdings Explorer** and **Portfolio Analytics**.

> **Status:** implementation is phased (see `IMPLEMENTATION_PLAN.md`). The backend (Phase 1), the Ext JS shell (Phase 2) and the Dashboard (Phase 3) are implemented; Holdings Explorer and Analytics are placeholders. Sections marked *(planned)* describe behavior that is not built yet. This README is completed in the final phase.

## Technologies

- **Frontend:** Sencha Ext JS 8.0, Modern Toolkit only. Application name and namespace: `FinApp`.
- **Backend:** Node.js and Express (CommonJS), JSON fixtures, no database or ORM.
- **API:** REST with JSON envelopes (`success`, `data`, `total`, `meta`).
- **UI packages:** Font Awesome, Charts and UX are enabled. Pivot and Exporter are not assumed and must be verified.

## Project structure

```text
finapp/
├── CLAUDE.md                  # Authoritative specification and rules
├── IMPLEMENTATION_PLAN.md     # Phased build plan
├── README.md, README_INSTALL.md
├── .claude/skills/            # extjs, node, data guidelines
├── docs/
│   ├── mockups/               # Approved visual references (CLAUDE.md wins on conflicts)
│   ├── DECISIONS.md           # Assumptions and deviations
│   └── API.md                 # API inventory
├── ext-js/                    # Ext JS 8 Modern application (FinApp)
└── server/
    ├── src/                   # Express source
    ├── scripts/               # demo:seed, demo:reset, demo:verify
    ├── tests/                 # Backend tests
    └── data/
        ├── fixtures/          # Nine immutable baseline JSON files
        └── runtime/           # Mutable demo journal, not tracked by Git
```

## Data

- **No database.** All baseline data lives in `server/data/fixtures/`: `companies`, `portfolios`, `transactions`, `market-config`, `market-scenarios`, `market-events`, `benchmarks`, `watchlists` and `app-settings`. They are never overwritten by the app.
- **Runtime state:** simulated trades made in the UI are written atomically to `server/data/runtime/` and are excluded from Git. Normal startup never deletes them.
- **Derived values:** holdings, cash and realized profit are replayed from initial funding plus the transaction journal. Prices come from one deterministic, time-based simulator, so the same symbol, scenario and tick always give the same price.
- **Access:** only Node.js reads the JSON. The Ext JS app uses the REST API exclusively.

## Prerequisites

- Node.js (v22 or later recommended) and npm
- Sencha Cmd
- Sencha Ext JS 8.0 SDK, installed under `ext-js/ext` (licensed; not redistributed in this repository)

## Getting started

### 1. Backend

```bash
cd server
npm install
npm start
```

The API listens on `http://127.0.0.1:3000/api`. Optional configuration goes in `server/.env` (see `server/.env.example`). Backend details: `server/README.md`; endpoints: `docs/API.md`; tests: `npm test`.

### 2. Frontend

In another terminal:

```bash
cd ext-js
sencha app watch
```

Open the local URL printed by Sencha Cmd (normally `http://localhost:1841`). The app expects the API at `http://127.0.0.1:3000/api`; to use another local port add `?apiBase=http://127.0.0.1:PORT/api` to the page URL (only localhost addresses are accepted). Screens are reachable at `#dashboard`, `#holdings` and `#analytics`.

The Pivot Grid and Exporter packages are not installed in this SDK; the app uses a labelled fallback grid and CSV export instead.

## Demo data commands (run in `server/`)

- `npm run demo:seed` — read-only check of the nine fixtures; creates the untracked runtime folder (fixtures are never regenerated)
- `npm run demo:reset -- --yes` — clear the runtime journal of simulated trades (never runs automatically)
- `npm run demo:verify` — check fixture references, accounting and reproducible prices

## REST API

All endpoints are under `/api` (the full list is in `CLAUDE.md` §7.6). Collections return:

```json
{
  "success": true,
  "data": [],
  "total": 0,
  "meta": { "asOf": "2026-11-13T14:00:00.000Z", "tickIndex": 312, "simulationMode": "DEMO" }
}
```

Single records return `data` as an object. Errors use a non-2xx status and `{ "success": false, "message": "...", "code": "...", "error": { "code": "...", "message": "..." } }`. Ext JS readers use `rootProperty: 'data'`, `totalProperty: 'total'`, `successProperty: 'success'` and `messageProperty: 'message'`.

## Development guidelines

- Use the Ext JS **Modern** Toolkit and prefer its public APIs over native DOM or JavaScript alternatives.
- Keep calculations on the server; the UI only formats server-supplied values.
- Follow `CLAUDE.md` first; the mockups are a visual reference only.
- Never commit credentials, environment secrets or generated dependencies.

## Demo walkthrough *(planned)*

Dashboard → Holdings Explorer → Trade Simulator (simulated BUY) → Analytics.

## Limitations

- Single-user, single-process demo. JSON-file persistence does not support multiple server instances.
- No real market data, brokerage connection, authentication or investment advice.

## License

Proprietary software. All rights reserved.

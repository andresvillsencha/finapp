# PortfolioIQ API (backend)

Node.js / Express API serving **simulated** portfolio data from local JSON files. **No database is required or used.** Real company names and tickers are identifiers only; every price, trade and return is fictional.

## Requirements

- Node.js 20 or later (developed on v22)
- `npm install` in this folder (dependencies: `express`, `cors`, `dotenv`)

## Commands

Run from `server/`:

```bash
npm install
npm start                 # API on http://127.0.0.1:3000/api
npm run dev               # same, restarts on file changes
npm test                  # backend tests (node:test)
npm run demo:seed         # read-only check of the nine fixtures; creates the runtime folder
npm run demo:verify       # consistency checks (references, accounting, reproducible prices)
npm run demo:reset -- --yes   # clears simulated trades in data/runtime (stop the server first)
```

## Configuration

Optional `server/.env` (see `.env.example`): `PORT`, `HOST`, `CORS_ORIGINS`, `LOG_REQUESTS`, `SIMULATION_SCENARIO`.

Simulation parameters live in `data/fixtures/market-config.json` (`seed`, `epoch_utc`, `tick_duration_ms` = 5000, `simulation_speed` = 1, `default_scenario_id`). Fixtures are read-only inputs: edit them by hand only if you intend to change the baseline, then run `npm run demo:verify`.

## Data

- `data/fixtures/` — nine immutable baseline JSON files (never written by the app).
- `data/runtime/transactions.json` — simulated trades made through the API. Untracked by Git; written atomically; survives restarts. Created on first trade.

Holdings, cash and realized P/L are derived by replaying initial funding plus the complete journal. Prices come from one deterministic function of `(company, scenario, tick)`, so the same tick always gives the same price, across screens and restarts.

## Structure

```text
src/
  index.js, app.js, context.js, config.js
  routes/ controllers/ services/ repositories/ middleware/ utils/
scripts/   demo-seed.js, demo-reset.js, demo-verify.js
tests/     simulator, ledger, query/csv and API tests
```

## Documentation

- API inventory and examples: `../docs/API.md`
- Decisions and assumptions: `../docs/DECISIONS.md`

## Limitations

Single process only (no multi-instance coordination). JSON-file persistence is for a local demo, not a production trading system. No authentication, no external market data, no investment advice.

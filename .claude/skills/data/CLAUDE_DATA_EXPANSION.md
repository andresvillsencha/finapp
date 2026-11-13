# Claude Code — PortfolioIQ JSON dataset expansion instructions

## Workspace and loading

This file is `.claude/skills/data/CLAUDE_DATA_EXPANSION.md` in `finapp/`. Read root `CLAUDE.md` for the authoritative architecture. The nine JSON files must be located in `server/data/fixtures/`. Mutable transactions and state belong in `server/data/runtime/`. Do not create a second or duplicate fixture location. Never execute `sencha`, `npm`, `npx`, or `git`, and never edit the Sencha SDK `ext/` folder.

## Goal
Implement the expanded fixture files in the existing PortfolioIQ Node.js backend without a database. Ensure Ext JS 8 Modern Toolkit accesses everything via REST. The new optional UI capabilities are three watchlists, fictional market-event calendar, a scenario selector (normal/bull/bear/volatile/correction/recovery), and two simulated benchmark series.

## Source of truth
- Static seed inputs under `server/data/fixtures/` are immutable.
- `transactions.json` is a *historical seed journal*. All current holdings/realized P/L/cash are derived from seed journal plus runtime actions, not from stored position snapshots.
- `market-config.json` defines ticker inputs for deterministic synthetic `price(symbol,tick,scenario)`.
- For coherent simulated past, historical seed trade fills should be regenerated from the exact same historical price function (or the function calibrated to these synthetic fill values). This generation is explicit and deterministic, never performed on normal startup.

## Functional options
1. Portfolio selector: all/individual portfolio.
2. Scenario selector: six synthetic market regimes, showing the selected regime, time/tick and demo badge; remain consistent across pages and users in this single-user demo.
3. Watchlist picker: shows watchlist tickers with current simulated price, day change, mini-series.
4. Market events: explicitly synthetic dated markers; filter by ticker/date/type; never claim real earnings dates.
5. Benchmark comparison: derive benchmark series deterministically and normalize against portfolio performance; use consistent cash-flow treatment.
6. Grid options: paging, server-side filtering/sorting, column selection, grouping, export; all derived market values from one shared tick.
7. Simulator controls: pause/resume, speed presets (optional), fixed-time preview (read-only), reset by explicit user action; preserve deterministic history and document state transitions.

## REST contracts
For **collections** use `{ "success": true, "data": [], "total": 0, "meta": {"asOf":"...","tickIndex":0,"simulationMode":"DEMO"} }`. For individual records use `{ "success": true, "data": { ... } }`. Errors use status 4xx/5xx + `{ "success": false, "message": "...", "code": "..." }`. Match Ext.data.reader.Json `rootProperty: 'data', totalProperty: 'total', successProperty: 'success', messageProperty: 'message'`.

`total` MUST be full filtered count before `page/start/limit`. Parse and whitelist Ext JS sorter and filter encodings; reject unsafe/unknown fields. Include meta for time-simulated responses. Trade execution price must be generated only by the backend from the authoritative snapshot time.

## Integration and testing
- Verify all referenced symbols and company IDs exist; timestamps are valid ISO UTC; prices/cash/quantity are positive/integer as applicable.
- Replay each portfolio's trades in timestamp order; no negative cash; no sales exceeding owned shares.
- Same symbol/scenario/tick must return same price after restart, independent of request order.
- Holdings, dashboard, pivot, exports and chart points at the same snapshot must reconcile.
- Verify event records are all flagged `is_real_event:false`; benchmarks are clearly named simulated.
- For user-facing documentation give any needed manual `npm`/Sencha/git commands without executing them.

## Implementation priority
1. Load/validate fixtures. 2. Derive seed holdings/cash. 3. Integrate simulator and scenario mode. 4. Create REST endpoints. 5. Add Ext JS Modern UI selectors, grids, charts. 6. Verify precision, time behavior, cross-screen reconciliation, and reset/restart behavior.

# PortfolioIQ — Implementation decisions and assumptions

All figures in PortfolioIQ are **simulated**. This file records choices made where the specification was silent, ambiguous or contradictory. `CLAUDE.md` is authoritative; this file never overrides it.

## Phase 1 audit (Milestone 0)

| Item | Finding |
|---|---|
| Node.js | v22.13.1 (CommonJS project, Express 5, `cors`, `dotenv`) |
| Dependencies | No database, ORM or driver. `mysql2` was removed by the user. No new dependencies were added. |
| Fixtures | All nine files are present in `server/data/fixtures/`: 80 companies (10 sectors), 5 portfolios, 90 baseline transactions, 6 scenarios, 2 benchmarks, 3 watchlists, 30 events. They validate cleanly and are never written by the app. |
| Runtime | `server/data/runtime/` exists, is untracked, and holds only the simulated-trade journal. |
| Frontend | Not started in Phase 1. `ext-js/` is still the default Sencha template (app `FinApp`, Modern toolkit). |
| Pivot / Exporter | Not checked in Phase 1 (frontend). A server-side CSV export fallback exists. |

## Confirmed by the user

- Ext JS application name and namespace: **FinApp** (PortfolioIQ is the product name only).
- **Daily change** is measured from the start of the current UTC day (indicative price change, not a time-weighted return).
- Scenario support and benchmark series are core; watchlists, market-event markers and simulator controls are deferred until Phases 1 to 5 are approved.

## Backend decisions

1. **Layout.** Source is in `server/src/` (`routes`, `controllers`, `services`, `repositories`, `middleware`, `utils`), scripts in `server/scripts/`, tests in `server/tests/`. Paths to data are derived from module locations, never `process.cwd()`.
2. **Money.** Integer cents everywhere inside the server; dollars (JSON numbers) only at the API boundary. Proportional cost removal on a partial SELL rounds half-up to the cent (exact BigInt arithmetic); a full SELL removes exactly the remaining cost. Percentages are rounded to 4 decimals.
3. **Accounting.** Holdings, cash and realized P/L are replayed from initial funding plus the ordered journal (baseline fixture + runtime). Fees are added to a BUY's cost basis and deducted from SELL proceeds (the configured fee is 0). Identity enforced by tests and `demo:verify`: `portfolio value - initial funding = realized P/L + unrealized P/L`.
4. **Journal ordering.** Transactions are ordered by `executed_at`, then journal order. A trade dated before the portfolio's funding or before its latest journal entry is rejected (`409 OUT_OF_ORDER_TRANSACTION`).
5. **Transaction ids.** The API `id` is the journal string id (`T-01-001` for baseline trades, `R-000001`... for runtime trades). A numeric `seq` (position in the ordered journal) is also returned. The spec's integer id was illustrative.
6. **Simulated clock.** `tickIndex = floor((now - epoch) * simulation_speed / tick_duration_ms)`; `asOf` is the tick's start time. With the default speed of 1, simulated time equals real time. Chart ranges (`1D, 1W, 1M, 3M, 6M, 1Y, ALL`) are expressed in **simulated days** (1M = 30, 3M = 91, 6M = 182, 1Y = 365) and responses state `timeScale: "SIMULATED_TIME"`.
7. **Price function.** `price(company, scenario, tick)` is O(1): bounded `tanh` drift + three seeded sine cycles + hour/day-scale lattice noise + bounded per-tick noise, all hash-based (no `Math.random()`). Per-tick moves stay within the 30 bps contract (tests cover every scenario, including across the shock tick). Prices are integer cents with the fixture price floor. Math functions are deterministic for a given Node version; very different JS engines could differ by a cent.
8. **Scenarios.** The active scenario is `default_scenario_id` (override: `SIMULATION_SCENARIO`). A negative `drift_multiplier` (bear) means "downward for every instrument" so a falling stock does not rise. Shocks (`correction`, `recovery`) ramp in smoothly over one simulated day at the configured tick (tick 50000 is in the past relative to the current date, so the shock is already in effect).
9. **Benchmarks.** Simulated index levels derived from the same machinery (`benchmarks.json`); included as extra series in `/api/analytics/comparison` (flat records with one field per series, described by `meta.series`).
10. **Snapshot consistency.** Each response uses one tick. Read endpoints accept `?tick=` or `?asOf=` (not both); the tick must be between 0 and the current tick. `meta` always carries `asOf`, `tickIndex`, `simulationMode`, `scenarioId` (and `nextTickAt` for the current tick). Trades use the latest server tick; any client price or time is ignored.
11. **Return %.** `total_gain_loss_pct` is investment P/L divided by **initial funding** ("return on initial funding"), because funding is fixed and the only cash movements are trades, so the denominator is unambiguous. The mockups' "Return % vs. cost basis" is not used.
12. **Top / bottom five.** Ranked by unrealized return % on aggregated positions (across the selected portfolios). The bottom list excludes anything already in the top list, so with fewer than 10 positions the two lists never overlap.
13. **Portfolio summary allocation.** `allocation_pct` in the dashboard summary is the portfolio's share of total value across the selected portfolios. Holdings and sector allocation use **equity** market value and exclude cash (stated in `meta`).
14. **Remote operations.** Sort/filter are JSON (`[{"property","direction"}]`, `[{"property","value","operator"}]`); also `sort=field&dir=ASC`. Fields and operators are whitelisted; text filters default to case-insensitive "contains"; enum/number/date typed. Paging uses `page/start/limit` (`start` wins), default page size 25 and cap 100 from `app-settings.json` (larger limits are clamped and `meta.limit` reports the effective value). Allocation % is computed over the whole selected scope before filtering/paging. Stable ordering uses `id` as the final tie-break.
15. **Collection shape for companies.** Fields are `company` (name) and `current_price` (consistent with holdings) rather than the spec's illustrative `price`.
16. **Errors.** Statuses 400/404/409/500 only. Bodies carry top-level `message` and `code` plus nested `error: {code, message}` (and optional `details`). Unknown routes return JSON 404. 500s return a generic message; details are logged server-side only.
17. **Persistence.** One process, one serial queue. A trade validates against the current ledger, writes the **complete** new journal to a temp file in the same directory, flushes, renames over `server/data/runtime/transactions.json`, and only then commits in memory. A failed write returns `500 PERSISTENCE_FAILED` and changes nothing. A corrupt or inconsistent journal stops startup; it is never overwritten.
18. **`demo:seed`.** The nine fixtures are curated canonical data, so `demo:seed` does **not** regenerate them (the spec's "recreate fixtures" is not implemented, to avoid replacing canonical data). It validates all nine files and creates the untracked runtime folder. A missing fixture must be restored from source control.
19. **`demo:reset`.** Deletes only `transactions.json` / `state.json` in `server/data/runtime/`, and only with `--yes`. There is no reset HTTP endpoint.
20. **Seed fills vs price function.** Baseline fill prices equal the instruments' base prices, not the time-varying price at the trade date (mean deviation about 5.9%, max about 29.9%). Fixtures are not regenerated. Portfolio history replays the recorded fills for cash/cost and marks positions to the simulator price, so value can step at a baseline trade date. `demo:verify` reports this as information, not a failure.
21. **CORS.** Allow-list from `CORS_ORIGINS` (default `http://localhost:1841` and `http://127.0.0.1:1841`); no wildcard. Responses under `/api` are `Cache-Control: no-store`.
22. **Not built (by design).** Watchlist, events and scenario-selector endpoints, simulator pause/resume, idempotency keys, authentication, any database.

## Mockup deviations to apply in later phases (CLAUDE.md wins)

- Replace every "Live" label with "SIMULATED MARKET"; show the "SIMULATED DATA / DEMO" notice in the header and near charts.
- Remove header search, notification bell and user avatar (no authentication in v1).
- Dashboard: KPIs are Portfolio Value, Total Gain/Loss, Daily Change, Invested Cost Basis, Cash Balance; show bottom five as well as top five; add the portfolio summary table; range selector is 1M/3M/6M/1Y/All.
- Holdings Explorer: add Portfolio and Cost Basis columns and a gain/loss filter and group-by control; drop the "Asset Type" filter; add the transactions view with filters and paging; no real company logos.
- Analytics: no Risk Analysis tab, risk metrics (volatility, Sharpe, drawdown) or projected scenario returns; pivot shows Market Value, Cost Basis and Unrealized P/L by Sector → Company and Portfolio; add the sector exposure comparison chart; sidebar label is "Dashboard"; use fixture portfolio names ("Global Leaders") and sector names ("Financials").

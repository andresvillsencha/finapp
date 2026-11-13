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

## Phase 2 — Ext JS Modern foundation

### Audit of the frontend and SDK

| Item | Finding |
|---|---|
| Toolkit / version | Ext JS **8.0.0.43**, Modern toolkit, theme `theme-material`, app `FinApp` (namespace `FinApp`), workspace framework path `ext` |
| Enabled packages | `font-awesome` (FA 7.0.0), `charts`, `ux` (unchanged; `app.json` was **not** modified) |
| Pivot Grid | **Not installed.** `ext/packages` contains `amf, charts, core, font-awesome, font-ext, font-ios, font-pictos, google, legacy, qr-code, signature, soap, ux`. No `Ext.pivot.*` classes exist. Phase 5 uses the labelled grouped-aggregation fallback ("Pivot Grid requires the applicable Sencha package/license."). |
| Exporter | **Not installed** (no `Ext.exporter.*` / `GridExporter`). Phase 4/5 use the server CSV export (`/api/exports/holdings.csv`) and a client download of server data. |
| Template demo | The generated Personnel model/store/list and tab shell were replaced (the four demo files `model/Personnel.js`, `store/Personnel.js`, `view/main/List.js`, `view/main/List.scss` were deleted; nothing else referenced them). |

To enable the real Pivot Grid / Exporter later, the licensed `pivot` and `exporter` packages must be installed in the Sencha workspace and added to `requires` in `ext-js/app.json` (a user-run Sencha Cmd step); the app does not redistribute them.

### Frontend decisions

1. **Namespace** `FinApp.*` (confirmed). "PortfolioIQ" is the product name in UI text only.
2. **Shell.** `FinApp.view.main.Main` is an `Ext.Container` (hbox): sidebar (brand, three navigation buttons, simulation status card) + body (header with portfolio selector and SIMULATED DATA / DEMO badge, the required disclosure bar, an API error banner with Retry, and a card container with the three screens). The sidebar collapses to icons below 1000px width (CSS media query).
3. **Routing.** Ext routing in the shell's ViewController: `#dashboard`, `#holdings`, `#analytics`; `Application.defaultToken = 'dashboard'`. Navigation buttons call `redirectTo()` so back/forward and deep links work. No second router.
4. **Shared state** lives in the shell ViewModel: `portfolioId` (`'all'` or an id, two-way bound to the selector), `apiStatus`, `tickIndex`, `asOf`, `scenarioName`. Screens bind to it through ViewModel inheritance. A global `piqsnapshot` event (Ext.fireEvent) announces each new simulated snapshot for screens that need to refresh.
5. **Refresh.** `Ext.util.TaskRunner` task polls `/api/simulation/status` (first immediately, then every 5 s or the server's `refresh_interval_ms`). Requests never overlap, failures set an "API unreachable" banner and are retried on the next tick, and the task is destroyed with the view. The browser never computes or invents prices.
6. **API access.** `FinApp.util.Api` resolves the base URL (default `http://127.0.0.1:3000/api`; override with `?apiBase=` **only** for localhost / 127.0.0.1 / [::1]), wraps `Ext.Ajax`, and normalizes errors (`status, code, message, offline, timedOut`). `FinApp.proxy.Api` (`type: 'piq'`) is the single store proxy: JSON reader on `data/total/success/message`, Ext default `page/start/limit` and JSON `sort`/`filter` (what the server parses), no cache-buster, no `X-Requested-With`, and it reports proxy exceptions through `Ext.fireEvent('piqapierror')` (the shell shows a toast).
7. **Cross-origin.** The Sencha Cmd dev server (port 1841) calls the API (port 3000), which allows `http://localhost:1841` and `http://127.0.0.1:1841` (`CORS_ORIGINS`). The default base uses `127.0.0.1` rather than `localhost` because Node may bind IPv4 only.
8. **Foundations only.** `FinApp.model.Portfolio` + `FinApp.store.Portfolios` (selector), `FinApp.util.Format` (USD / signed / percent / UTC time formatting with sign + arrow, never colour alone). Dashboard, holdings and analytics stores come with their screens.
9. **Placeholders.** The three screens are placeholders (`FinApp.view.shared.PlaceholderView`): they say what the real screen will contain and show a live API connectivity card. They are not mock-ups. Class names follow `CLAUDE.md` section 8 (`DashboardView`, `HoldingsView`, `AnalyticsView`).
10. **Styling.** Global palette/cards in `app/Application.scss`, shell in `app/view/main/Main.scss`, all rules namespaced `.piq-*`, literal colours (no cross-file Sass variables), no edits to the theme or `ext/`. Navy sidebar, light page background, 12px rounded white cards, amber SIMULATED badge.
11. **ES5 only.** App classes avoid ES6 syntax so the production (YUI) compressor can build them.

### Mockup deviations applied in the shell (CLAUDE.md wins)

- Sidebar label "Dashboard" (not "Portfolio Dashboard"); no search box, bell or avatar; "Live" is replaced by "SIMULATED MARKET" with the last simulated update; the full disclosure is always visible under the header; no per-portfolio list in the sidebar (the header selector covers it).
- Date range controls are screen-specific and arrive with the screens (Dashboard: 1M/3M/6M/1Y/All).

### Not verified in Phase 2

Claude cannot run Sencha Cmd, so the app was **not built or opened**. Checks done: every Ext class/config used was verified against the 8.0.0.43 Modern sources, all frontend JS parses (`node --check`), and the pure logic of `FinApp.util.Api` / `FinApp.util.Format` was exercised with a stub. Visual layout and runtime behavior must be confirmed by the user (checklist in the Phase 2 report).

## Phase 3 — Portfolio Dashboard

### Data mapping (no new API endpoints were needed)

| Dashboard element | Source | Notes |
|---|---|---|
| KPI cards (Portfolio Value, Total Gain/Loss, Daily Change, Invested Cost Basis, Cash Balance) | `GET /api/dashboard` → `data.kpis` | Formatted only; labels state the definitions |
| Portfolio value chart (1M / 3M / 6M / 1Y / All) | `GET /api/portfolio-history` | Store `FinApp.store.PortfolioHistory`; simulated-time axis, UTC labels |
| Sector allocation donut + legend | `GET /api/sector-allocation` | Store `FinApp.store.SectorAllocation`; cash excluded (stated on the card) |
| Top five / bottom five holdings | `GET /api/dashboard` → `top_performers`, `bottom_performers` | Ranked by unrealized return on cost; the lists never overlap |
| Portfolio summary table | `GET /api/dashboard` → `portfolio_summary` | Value, gain/loss, return, indicative daily change, allocation (share of total value), cash |
| Footnote | `GET /api/dashboard` → `definitions` | Server-supplied wording for gain/loss and daily change |

### Frontend decisions

1. **One snapshot per refresh.** The three requests are sent together with the same `tick` (the latest tick reported by `/api/simulation/status`), so KPIs, the chart's last point and the allocation reconcile. Verified against the real API for all five portfolios and all ranges (chart end value equals the KPI).
2. **Refresh rules.** The Dashboard reloads when the shell announces a new tick (`piqsnapshot`), when the shared portfolio selection or the range changes, and when the screen is shown again. It skips work when nothing changed or when another screen is visible. Overlapping triggers are coalesced into one follow-up request. A refresh of the same scope is silent; a scope change shows a mask.
3. **States.** `loading` (mask, first load or scope change), `ready`, `error` (banner with Retry, last data stays visible). A portfolio with no open positions shows an empty state for the donut and "No open positions." in both tables; null percentages are shown as an em dash.
4. **Small tables are XTemplate HTML tables**, not grids: they hold at most five rows, need no sorting or paging, and size to their content. (The Modern grid is used for Holdings in Phase 4.)
5. **Chart.** `Ext.chart.CartesianChart` with a filled line series, a numeric value axis fitted to the data (±12% padding, so changes are visible instead of starting at zero) and a time axis labelled from UTC calendar fields (`FinApp.util.Format.utcFormat`), never the browser's time zone. Markers appear on hover with a tooltip (UTC time, value, gain/loss). The donut is `Ext.chart.PolarChart` with a pie series; its HTML legend uses the same palette (`FinApp.util.Palette`) so colours always match.
6. **Accuracy labels.** "Daily Change (indicative)" and "since UTC day start" on the card, plus the server's definitions in a footnote and "Illustrative simulated figures". The return percentage is labelled "of initial funding".
7. **Accessibility.** Gain/loss uses a sign and an arrow in addition to colour; tables have captions and header scopes; no information depends on colour alone.
8. **Layout.** Rows use a wrapping flex layout, so cards reflow on tablet widths; the summary table scrolls horizontally if needed.

### Mockup deviations (CLAUDE.md wins)

- KPI set follows section 3.1 (Portfolio Value, Total Gain/Loss, Daily Change, Invested Cost Basis, Cash Balance): no separate "Unrealized P/L" or "Return %" cards, and Cash does not show a "% of portfolio" figure (it would be a UI-side calculation).
- Added what the mockup lacks: the bottom five, the portfolio summary table and the definitions footnote.
- Not built (not in the specification): Recent Activity, Benchmark Comparison and the Simulation Status card on the Dashboard (simulation status already lives in the sidebar), sparklines, the donut's centre total label, the 1W range and the header date-range dropdown (ranges are in the chart card).
- Sector and portfolio names come from the fixtures (for example "Financials").

### Not verified in Phase 3

Claude cannot run Sencha Cmd, so the screen was **not built or opened**. Checks done: Ext classes and chart configs verified against the 8.0.0.43 sources; all frontend JS parses and is ES5; the controller's refresh logic (snapshot gating, scope change, coalescing, failure and retry) and the view-model formulas were exercised with a stub; and the real API was checked to contain every field the screen reads. Visual layout, chart rendering, tooltips and runtime behavior must be confirmed by the user.

### Post-approval layout fixes in Phase 3

Two layout fixes were applied after the user ran the Dashboard: the KPI cards are wrapped in a `piq-kpi-grid` element (a component's own element is not the flex container of its template content), and the performance chart uses `flex: 1` with `minHeight: 300` while the row uses `align: 'stretch'`, so it fills the card whatever the height of the allocation card.

## Phase 4 — Holdings Explorer

### Data mapping

| Element | Source | Notes |
|---|---|---|
| Holdings grid | `GET /api/holdings` | `Ext.grid.Grid`, store `FinApp.store.Holdings`, **remote** sort, filter, paging (25 per page) and grouping |
| Summary cards (Positions, Market Value, Unrealized P/L, Daily Change) | `meta.totals` of `/api/holdings` | Server sums over **every** row matching the filters, not only the page |
| Group headers (count, market value, unrealized P/L) | `meta.groups` of `/api/holdings` | Server-calculated per group; the browser never adds money up |
| Sector filter options | `GET /api/sector-allocation` | Only sectors that exist in the selected scope |
| Company detail (description, facts) | `GET /api/companies` filtered by `id` | Fixture text from the server; cached per company |
| Detail price chart (1M / 3M / 6M / 1Y) | `GET /api/companies/:id/prices` | Same deterministic function as spot prices and trades |
| Recent transactions (detail panel) | `GET /api/transactions` filtered by portfolio and company | Five latest |
| Transactions tab | `GET /api/transactions` | Filters: portfolio (shared selector), ticker, side, date range; paging; row expander with id, tick, fee, source |
| Trade Simulator | `POST /api/transactions` with only `portfolio_id`, `company_id`, `trade_type`, `quantity` | The server sets price and time |
| CSV export | `GET /api/exports/holdings.csv` | Same portfolio, filter, search, sort and group as the grid; all matching rows |

### Backend additions (minimal, tested)

1. **`group` / `groupDir` parameters** on `/api/holdings`. Ext sends the grid's grouper separately from `sort`. The server whitelists the groupable fields (`sector`, `portfolio_name`), accepts both `group=sector&groupDir=ASC` and the JSON-encoded sorter Ext sends by default, and orders the rows by the group first (the user's sort applies inside each group) so groups are contiguous across pages. Invalid input is `400 INVALID_GROUP`.
2. **`meta.totals` and `meta.groups`** on `/api/holdings`: cent-exact sums over every row matching the filters (before paging). Totals and group buckets are required because a paged grid only holds one page; computing them in the browser would be wrong and would break the "no financial calculation in the UI" rule.
3. **`query` parameter** on `/api/holdings`: free-text search over ticker, company, sector and industry (the same rule as `/api/companies`), because the filter protocol is AND-only and cannot express "ticker OR company". Allocation % keeps the whole portfolio scope as its denominator.
4. `runCollectionQuery` also returns the filtered rows (`filtered`) for server-side totals. Three new backend tests (56 in total).

### Frontend decisions

1. **Why remote paging.** The specification asks for remote or client operations "consistent with dataset size"; the plan asks for remote paging. The Modern paging-toolbar plugin is slider based and aimed at infinite scrolling, so a small `piqpager` (previous / next and "Page x of y • N positions") drives the store's own `previousPage` / `nextPage`.
2. **Portfolio filter = the shared selector.** The portfolio field in the filter bar is bound to the same `portfolioId` as the header selector, so there is one scope for Dashboard, Holdings and Transactions.
3. **One snapshot per refresh.** Every request of a refresh carries the same `tick`. A new tick reloads only the holdings (current page, sort, filters, grouping, selection and scroll are kept) and the selected company's chart. A scope change starts over; a filter change returns to page 1.
4. **Selection survives reloads.** The store's `beforeload` / `load` events bracket every reload; selection events fired by the reload itself are ignored and the selected position is re-selected silently with its fresh server values.
5. **Trades.** The dialog posts four fields only and shows the server's rejection (insufficient cash or shares) inside the dialog. On success it fires the app-wide `piqtrade` event carrying the trade; the shell reloads the portfolio totals (cash), the Dashboard and Holdings reload, and each screen adopts the trade's `tick_index` so a screen pinned to an older tick can never hide the new trade.
6. **The dialog does not calculate.** It shows the indicative price reported by the server for the latest tick and the portfolio's cash; it does not multiply quantity by price. The execution price and time appear in the confirmation toast, from the server response.
7. **Accessible trade path.** Buy and Sell buttons in the filter bar and the detail panel are the primary route; double-tapping a row (Buy) is only a convenience. Sell is disabled until a position is selected.
8. **CSV fallback.** The Exporter package is not installed; the server-side CSV (with formula-injection protection from Phase 1) is downloaded by navigating to the API URL (an attachment response). There is no Ext API for a plain file download.
9. **States.** Grid loading text, empty text ("No holdings match the current filters."), an error banner with Retry (last data stays visible), server errors in the dialog, and em dashes for null percentages. Free text from the API is HTML-encoded in every template and renderer.

### Mockup deviations (CLAUDE.md wins)

- Summary cards show Positions, Market Value, Unrealized P/L and Daily Change from server totals. The mockup's "Cash Available" card and sparklines are not built (cash is shown in the Trade Simulator; sparklines are not in the specification).
- Not built (not in the specification): the Asset Type filter, the "Top Movers (Today)" card, the header search box, row checkboxes and the per-row "…" menu, and the "Day Change" mini sparklines. The detail panel's "About" text comes from the fixtures; no logos or company branding are used.
- Added what the mockup lacks: grouping by sector or portfolio with server-calculated group sums, the gain/loss filter, the Transactions tab with its filters and row details, and the CSV export.
- The mockup's "Rows per page" selector is not built (fixed at 25 holdings / 15 transactions per page).

### Not verified in Phase 4

Claude cannot run Sencha Cmd, so the screen was **not built or opened**. Checks done: Ext classes and configs verified against the 8.0.0.43 sources; all frontend JS parses and is ES5; the controller (refresh rules, filters, grouping, selection, trade event, export URL), the view-model formulas and the trade controller were exercised with a stub; and every request the screen builds was sent to the real backend and the responses checked. Grid rendering, group header layout, the Dialog, charts and runtime behavior must be confirmed by the user. Risks to look at first: group headers (custom template reading server sums), the row expander, the filter-bar wrap layout, and the dialog's select fields.

## Phase 5 — Portfolio Analytics

### Pivot Grid and Exporter availability (verified)

The installed SDK (Ext JS 8.0.0.43) contains no `pivot` or `exporter` package (`ext/packages` holds amf, charts, core, font-*, google, legacy, qr-code, signature, soap, ux). Per `CLAUDE.md` the screen therefore uses the **labelled fallback**: a functional grouped aggregation grid with the visible notice "Pivot Grid requires the applicable Sencha package/license.", and the server-side CSV export.

**How to enable the real Pivot Grid and Exporter** (licensed packages, not redistributed here): install the Ext JS Enterprise `pivot` (and `exporter`) packages for the Modern toolkit into the workspace `packages` folder, add `"pivot"` and `"exporter"` to `requires` in `ext-js/app.json`, and rebuild with Sencha Cmd. Then replace the grid in `FinApp.view.analytics.AnalyticsView` with a Modern pivot grid configured with rows Sector → Company, columns Portfolio, and the three measures, fed by `GET /api/analytics/pivot` (flat layout), and swap `onExport` for the exporter plugin. The Sector → Company data, the measures and the totals already come from the API.

### Data mapping

| Element | Source | Notes |
|---|---|---|
| Portfolio performance comparison (1M / 3M / 6M / 1Y / All) | `GET /api/analytics/comparison` | Normalized, start of range = 100, for every portfolio and the simulated benchmarks; series built from `meta.series`; benchmarks dashed and switchable |
| Sector exposure by portfolio | `GET /api/analytics/sector-comparison` | Grouped columns per sector; "% of portfolio" (default, comparable across sizes) or market value; cash excluded (stated) |
| Pivot fallback grid | `GET /api/analytics/pivot?layout=wide` | Grouped by sector; a column per portfolio for the selected measure plus Total; measure switch (Market Value / Cost Basis / Unrealized P/L) |
| Sector subtotals (group headers) and grand total | `meta.groups`, `meta.grand` of the wide pivot | Summed by the server in exact cents |
| CSV export | `GET /api/exports/pivot.csv` | All three measures per portfolio, a subtotal row per sector and a grand total row |

### Backend additions (minimal, tested)

1. **`layout=wide` on `/api/analytics/pivot`**: one row per company with `portfolio_<id>_<measure>` (null when that portfolio does not hold the company) and `total_<measure>`, plus `meta.portfolios`, `meta.measures`, `meta.groups` (sector subtotals) and `meta.grand` (grand total; a portfolio without positions is 0). The default `flat` layout is unchanged. Invalid values are `400 INVALID_LAYOUT`. This was needed because a pivot's subtotals are sums, and the UI must not calculate money.
2. **`GET /api/exports/pivot.csv?portfolioId&tick`**: the CSV fallback for the pivot export required by `CLAUDE.md` §3.3 (same CSV helper, so text cells are protected against formula injection).
3. Tests: reconciliation of company rows, sector subtotals, grand total and portfolio totals in exact cents; scope; null versus zero; the empty portfolio; CSV rows and scope (59 backend tests in total).

### Frontend decisions

1. **Scope.** The pivot follows the shared portfolio selector (a single portfolio shows one column). The two charts always compare all portfolios, because comparing is their purpose; the header text says so.
2. **Measure, sector mode and benchmark toggles only re-render loaded data**; no request is made. The pivot columns, the grand total strip and the group headers are rebuilt from the same response.
3. **One snapshot per refresh.** Pivot, comparison and sector requests are sent together with the same `tick` and applied together; same refresh rules as the Dashboard (new tick, scope or range, trade, screen shown; coalesced; silent for the same scope; mask on scope change; error banner with Retry).
4. **Charts are built from the server's meta**, not hard-coded: line series from `meta.series`, bar series from `meta.portfolios`. Series colours come from `FinApp.util.Palette` and match the HTML legends. The index axis is fitted to the visible lines so differences are readable and always contains 100.
5. **Index values are displayed, not derived.** Tooltips and the legend show the server's index level ("Index 112.4, start = 100"); the browser does not turn it into a return percentage.
6. **No dimension switching.** A real Pivot Grid lets users rearrange dimensions; the fallback fixes rows to Sector → Company and columns to Portfolio, and only the measure is switchable (stated in the notice).

### Mockup deviations (CLAUDE.md wins)

- Not built (not in the specification): the Overview / Portfolio Comparison / Exposure Analysis / Risk Analysis / Market Scenarios tabs, Key Metrics (annualized return, volatility, Sharpe ratio, maximum drawdown), the Risk & Concentration card, the Market Scenario Simulator with projected returns, the portfolio list in the sidebar and the header date-range dropdown. The user confirmed dropping the risk metrics and scenario projections.
- The screen is one page with three sections (performance comparison, sector exposure, pivot) instead of tabs. Benchmarks are included (they are core), as simulated dashed lines.
- The mockup's exposure pivot is a grouped grid with expandable sector rows; here groups are shown with a header per sector (subtotals per portfolio) and a grand total strip. No sector icons or branding.

### Not verified in Phase 5

Claude cannot run Sencha Cmd, so the screen was **not built or opened**. Checks done: Ext classes and configs verified against the 8.0.0.43 sources; all frontend JS parses and is ES5; the controller (refresh rules, columns, series, legends, tooltips, export URL, failure and retry) and the view-model formulas were exercised with a stub; and every request the screen builds was sent to the real backend for 3 scopes and 5 ranges, checking that all series exist and start at 100, that every pivot column exists in the data, and the empty-portfolio case. Rendering, the dynamic columns (`setColumns`), the dynamic chart series (`setSeries`), the group headers and the wrap layout must be confirmed by the user. Risks to look at first: switching the measure (column rebuild and group header refresh), the grouped bar chart with rotated labels, and the benchmark dashed lines.

## Phase 6 — Integration, QA and polish

### How the QA was done

The app was run in the built-in browser against a **throwaway backend** (the current code, a temporary runtime folder, port 3055) so no user data was touched. Every screen was loaded, driven and inspected (view-model state, store contents, console), compared with the API at the same tick, and exercised at desktop and tablet (768 px) widths, with an empty portfolio, a stopped API and a restarted API. A real Buy was made through the dialog, and a page reload confirmed that the trade persisted (the runtime journal is re-read on startup).

### Defects found and fixed

| Defect | Cause | Fix |
|---|---|---|
| Trade dialog stuck on "Executing…" after a successful trade, or Cancel overflowed the stack | `Ext.Dialog#close()` "taps" the Cancel button; the Cancel handler called `close()` again | `dismissHandler: true` on `TradeDialog` (close just destroys the dialog) |
| Server `meta` unavailable everywhere (empty Analytics charts, blank Holdings totals and group sums, Dashboard axis fit skipped) | The JSON reader keeps `rawData` only with `keepRawData: true` | Set once in the shared `FinApp.proxy.Api` reader |
| Analytics bar colours differed from the legend | The theme palette overrode the series colours | One colour per portfolio via the series `subStyle` |
| Console flooded with "No such config id" for chart series | `id` is not a series config | Removed |
| Collapsed (tablet) sidebar showed clipped slivers instead of icons, and a clipped status card and header | CSS hid the button text but the Material button body collapsed to 4 px | The controller clears the nav button text at ≤ 1000 px (icon-only buttons, text kept as tooltip and aria label), the status card shows only its dot, the last-update text hides at ≤ 900 px |
| Text under the performance chart overlapped the legend | A negative-margin card style was reused | Footnote style |
| "No holdings match the current filters" shown for a portfolio that simply has no positions | One static message | The message depends on whether filters are active |
| Pivot showed one row per position and "Export CSV" returned 404 | The API process was older than the code | Not a code defect: restart the API (documented in the README) |

### Verified

- **Same dataset, same snapshot:** Dashboard KPIs equal `GET /api/dashboard` at the same tick; the Analytics pivot value of a position equals the Holdings market value; after a trade the Dashboard cash, the Holdings quantity, the recent-trades list and the pivot all reflect it.
- **Trade end to end:** dialog prefill, server price in the confirmation, position 217 → 220, trades R-000001 and R-000002 persisted (after a reload cash was exactly the earlier cash minus quantity × server price).
- **Empty portfolio:** Dashboard (empty-state messages), Holdings (zero totals, empty grid) and Analytics (empty pivot, zero grand totals) all render.
- **Offline and recovery:** the red banner with Retry and the "API unreachable" status appear; the app recovers by itself when the API returns.
- **Fixtures protected:** the nine files keep their original modification time and hashes, and the backend tests assert that fixtures are never written; the real `server/data/runtime/` folder stayed empty.
- **Configuration and secrets:** `.env`, `.env.*` (except `.env.example`), `server/data/runtime/`, `node_modules/` and the SDK folder are ignored; no keys, tokens or passwords exist in source; CORS is an allow-list; the `?apiBase=` override accepts only local hosts.

### Remaining known issues and limitations

- The Ext JS Charts package logs a warning about Sencha's SVG download server for each chart (SDK behavior; chart download is not used).
- Pivot Grid and Exporter are not installed: labelled fallback grid and server CSV (see Phase 5 for how to enable the real packages).
- No automated browser test suite; the demo walkthrough in the README is the manual QA script. The backend has 59 automated tests.
- The visual QA covered desktop and tablet widths; phone widths were not a goal.
- Watchlists, market events and scenario controls are fixtures without screens (out of scope for the three core screens).

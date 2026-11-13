# Finapp / PortfolioIQ — Claude Code project instructions

## Mandatory source files and priority

This root `CLAUDE.md` is the authoritative PortfolioIQ specification. Read the project-specific instructions below and load relevant Claude Code skills before editing files:

- Frontend: `.claude/skills/extjs/SKILL.md`, then the Ext JS Modern 8 guideline in that folder.
- Backend: `.claude/skills/node/SKILL.md`, then the Node.js JSON backend guideline in that folder.
- Fixtures/simulation: `.claude/skills/data/SKILL.md`, then the data expansion guideline in that folder.

Claude skills use `SKILL.md` entrypoints. If the environment does not auto-load them, read the paths directly. Never assume a skill's existence substitutes for the root specification.

**Canonical project layout:**

```text
finapp/
  CLAUDE.md
  README.md
  .gitignore
  .claude/skills/
    extjs/SKILL.md
    extjs/CLAUDE_EXTJS_8_MODERN_GUIDELINES.md
    node/SKILL.md
    node/CLAUDE_NODEJS_JSON_BACKEND_GUIDELINES.md
    data/SKILL.md
    data/CLAUDE_DATA_EXPANSION.md
  docs/
    mockups/                      # Approved visual references (see "Screen mockups")
      01-dashboard.png
      02-holdings-explorer.png
      03-portfolio-analytics.png
  ext-js/                         # Existing Ext JS 8 Modern application
  server/
    src/                         # Node.js Express source code
    data/
      fixtures/                  # Nine immutable canonical JSON files
        companies.json
        portfolios.json
        transactions.json
        market-config.json
        market-scenarios.json
        market-events.json
        benchmarks.json
        watchlists.json
        app-settings.json
      runtime/                   # Mutable demo journal/state, not tracked
    scripts/
    tests/
    package.json
```

**Canonical data rules:** All nine provided JSON files live in `server/data/fixtures/` and are read by Node.js using paths derived from the backend module location (e.g., `path.resolve(__dirname, '../../data/fixtures')` when resolving from `server/src/repositories/`); never depend on `process.cwd()`. `transactions.json` under `fixtures/` is the canonical baseline historical journal; do not introduce competing baseline holdings snapshots. Derive holdings, realized profit and cash from initial funding and the complete ordered journal. Never overwrite seed files during normal requests or startup. Store simulated user actions in `server/data/runtime/` using atomic writes, excluding this folder from Git; create it if missing. Node.js alone reads JSON; the Ext JS app accesses REST only.

**Screen mockups:** `docs/mockups/` holds the approved visual references, one per core screen: `01-dashboard.png` (Portfolio Dashboard), `02-holdings-explorer.png` (Holdings Explorer) and `03-portfolio-analytics.png` (Portfolio Analytics). Before building or restyling a screen, view its mockup and use it for layout, hierarchy, component placement, colors, spacing and visual style. **This `CLAUDE.md` always takes precedence over the mockups.** If a mockup conflicts with this specification (data, calculations, API contract, toolkit or component choices, simulated-data disclosure, restrictions), follow `CLAUDE.md`, do not silently copy the mockup, and list each deviation in `docs/DECISIONS.md` and in the phase report. A mockup never adds a feature, endpoint, calculation or data field that this specification does not define; flag such elements as proposals for the user to decide. Mockup figures, company names and prices are illustrative only; never copy them into fixtures or code. Mockup images are read-only inputs: never edit, delete or move them. If a mockup is missing or unreadable, say so and fall back to §3 and §9; do not claim visual fidelity to an image you have not viewed.

**Hard operating restrictions:** Never execute `sencha`, `npm`, `npx`, or `git` (including indirect or scripted invocations). Never edit the Sencha SDK `ext/` directory, wherever installed. Claude may edit project-owned application files under `ext-js/`, the backend source under `server/`, and fixture data only when explicitly needed and safe. When a prohibited command is needed, tell the human the exact command, working directory, purpose and verification step. Do not report unexecuted build/test results as successful. Direct `node` checks are permitted if they do not call restricted commands or modify protected files.

**Framework:** Ext JS **8.0 Modern Toolkit** only. Font Awesome, Charts and UX are already enabled; verify individual class APIs and Modern compatibility. Prefer Ext JS public APIs rather than native DOM/JS alternatives where a suitable Ext JS API exists. Do not assume Pivot or Exporter are installed; verify availability.

**API envelope:** Collection: `{ "success": true, "data": [], "total": 0, "meta": {} }`. Record: `{ "success": true, "data": {}, "meta": {} }`. Errors: non-2xx status plus `{ "success": false, "message": "...", "code": "..." }`. Configure Ext JS reader `rootProperty: 'data'`, `totalProperty: 'total'`, `successProperty: 'success'`, `messageProperty: 'message'`. `total` is filtered total before pagination. Use the same `meta.asOf` and `meta.tickIndex` to reconcile time-based values across endpoints.

**Simulation:** Real public company identifiers with fictional financial values; no market-price APIs, database, ORM, or direct frontend JSON imports. At the same `(symbol, scenario, tick)` the price is reproducible. Real-time refresh never implies changing results for the same tick. Use fixed reference time and seeded, deterministic math. All dashboard, holdings, pivot, histories, exports and simulated trades derive from this shared backend engine.

**Source precedence:** This canonical layout and restrictions override contradictory historical suggestions inside the full specification below. Preserve useful functional requirements, not superseded folder examples.

## Full application specification

The following requirements remain in effect, except that any older suggested layout or fixture path is superseded by the canonical paths above.

# PortfolioIQ — Implementation Specification for Claude Code

> **Purpose:** Build a polished, fully functional **financial portfolio management demo** using **Sencha Ext JS Modern Toolkit and Node.js/Express with JSON-file fixtures (NO DATABASE)**. Use **real publicly traded company names and tickers**, but **100% simulated prices, transactions, returns, and portfolio values**.
>
> **Audience:** Sales demonstrations, technical webinars, and showcases of Sencha Ext JS Modern data/analytics capabilities.
>
> **Scope:** ONE application with THREE core screens: **Portfolio Dashboard**, **Holdings Explorer**, and **Portfolio Analytics**. Do not build three separate applications.

## 1. Claude Code operating instructions

You are a senior full-stack engineer with extensive experience in **Sencha Ext JS Modern Toolkit**, **Node.js/Express**, **JSON-backed demo APIs and deterministic time simulations**, and financial-data user interfaces.

1. **Inspect the existing repository first.** Preserve any working project structure, versions, themes, tooling, and conventions. If the repository is empty, scaffold the suggested structure below.
2. **Font Awesome, Charts and UX are enabled in this project, but inspect their actual availability. Do not assume Pivot or Exporter are available.** Detect the installed Ext JS version, toolkit, package availability and licenses. Do not download or redistribute proprietary Sencha packages. If the SDK is unavailable, complete the backend, JSON fixtures, simulation scripts, frontend source and documentation; clearly mark which frontend steps require the licensed SDK.
3. **Prefer working vertical slices over placeholders.** Deliver a runnable path from JSON fixtures and time-driven simulated data to the REST API to a rendered Ext JS screen.
4. **Use fake financial data throughout.** Never fetch market prices from real financial APIs. Real company identifiers are only for recognizability.
5. **Do not silently invent unsupported integration functionality.** Keep all functionality within this document and record implementation assumptions in `docs/DECISIONS.md`.
6. **Do not replace Ext JS with React, Vue, Angular, or a generic HTML-only UI.** Use Ext JS Modern Toolkit components and its MVC/MVVM conventions consistently. Never create a Classic Toolkit application or use Classic-only components, classes, configuration options, or plugins.
7. **Build and test incrementally.** After each milestone, run only permitted direct checks (e.g., read-only static inspection or direct `node` where appropriate); provide human-run instructions for any `npm`, `npx`, `sencha`, or `git` checks. Fix failures that can be verified within these restrictions.
8. **Do not stop at a mockup.** Charts, filters, selection, navigation, exports (where licensed), calculations, APIs, and demo transactions should work with a documented JSON-file persistence strategy.
9. Use clear code comments where financial calculations or complex Ext JS behavior might otherwise be ambiguous. Avoid excessive boilerplate.
10. When an ambiguity does not block progress, choose a reasonable default, implement it, and document it.

## 2. Product definition

**Name:** PortfolioIQ  
**Tagline:** Investment Portfolio Intelligence — Demo Edition  
**Currency:** USD  
**Timezone for financial dates:** UTC for stored dates; display user-friendly dates in the UI  
**Target:** Desktop-first, responsive at tablet widths  
**Business model:** Single-user demo; no real money, trading, broker access, or external accounts.

### Main navigation

- **Dashboard** — investment summary and visual insights.
- **Holdings Explorer** — detailed, searchable, editable holdings and transaction exploration.
- **Portfolio Analytics** — pivot analysis, comparisons, and exports.

A single unified shell should provide a sidebar or compact left navigation, header, portfolio selector, demo badge, and coherent typography/colors.

### Non-goals for v1

- Live market feeds, brokerage integrations, accounts, deposits/withdrawals to real financial institutions.
- Real-time trading, market orders, recommendations, risk scoring for actual investors, or investment advice.
- User authentication, multi-tenancy, granular permissions.
- Financial statement ingestion, corporate actions, tax accounting, multi-currency FX conversion.
- AI chatbot or LLM calls.

## 3. Three screens and UX requirements

### 3.1 Portfolio Dashboard

**Goal:** Deliver immediate investment intelligence with rich visualizations.

**Content:**

- Global portfolio selector (specific portfolio or **All Portfolios**) affecting all dashboard metrics.
- KPI cards: **Portfolio Value**, **Total Gain/Loss ($ and %)**, **Daily Change ($ and %)**, **Invested Cost Basis**, **Cash Balance**.
- Interactive portfolio-value time-series chart with **1M / 3M / 6M / 1Y / All** range selectors. The chart must be generated from the same deterministic time-based model as current prices; never generate random values on each page load.
- Sector allocation donut/pie chart with matching legend and percentages.
- Top five performing holdings and bottom five performing holdings.
- Portfolio summary table with value, gain/loss, allocation, and cash.
- Clear loading, empty, and error states.

**Presentation:** Premium fintech UI; clean hierarchy, ample whitespace, refined cards, chart tooltips, clear green/red gain-loss formatting, readable contrast. Theme should be implemented via reusable custom CSS/SCSS classes layered on the installed Sencha Modern theme rather than invasive global overrides.

### 3.2 Holdings Explorer

**Goal:** Showcase Ext JS Modern Grid functionality with real interactive data.

**Main grid fields:**

| Field | Description |
|---|---|
| Company | Company name |
| Ticker | Stock ticker |
| Sector | Technology, Financial Services, etc. |
| Portfolio | Owning portfolio |
| Quantity | Number of shares |
| Average Cost | Per-share weighted cost basis |
| Current Price | Simulated as-of-date price |
| Market Value | Quantity × current price |
| Cost Basis | Quantity × average cost |
| Unrealized P/L | Market value − cost basis |
| Unrealized P/L % | Unrealized P/L ÷ cost basis × 100 |
| Allocation % | Market value ÷ selected portfolio equity market value × 100 |

**Interactions:**

- Filter by portfolio, company/ticker, sector, and gain/loss; sortable columns; numeric and date formatting; remote or client filtering consistent with dataset size.
- Group by sector or portfolio, with aggregated market value and gain/loss summaries.
- Select a row to show a **company detail panel** with company metadata, simulated historical-price chart, position summary, and recent transactions.
- Double-tap (where supported) or an accessible action button to open a **Trade Simulator** dialog (Buy/Sell). It must add a transaction, update balances and share quantities, recalculate the portfolio, and refresh related screens.
- Optional safe inline edit for editable demo attributes (e.g., a portfolio note), but **do not allow editing derived values** such as market value or P/L directly.
- Transactions sub-view or tab with filters (portfolio, ticker, side, date range), paging, and transaction details.
- Export visible/filtered grid data where Sencha Grid Exporter is available; otherwise provide a functional, documented CSV export fallback.
- Meaningful empty/error/loading states and validation.

**Trade rules (simplified demo):**

- BUY requires valid ticker, quantity > 0, simulated execution price > 0, timestamp, and sufficient simulated cash (no margin in v1).
- SELL requires quantity > 0 and sufficient shares (no short selling).
- Use weighted-average cost accounting for open positions.
- A SELL realizes P/L based on average cost at time of sale; reduce remaining quantity, keeping average cost unchanged until another BUY.
- When quantity reaches zero, remove the position from active holdings while retaining historical transactions.
- Record immutable executed transaction fields (ticker, side, quantity, execution price, timestamp). The UI may not revise past executions in v1.
- Keep calculations server-side and consistent by serializing JSON-file writes and using atomic replacement; no database transactions.

### 3.3 Portfolio Analytics

**Goal:** Showcase advanced Ext JS analytics tools.

- Modern-compatible Pivot Grid (only if supported by the installed SDK/package/license): rows by **Sector → Company**, columns by **Portfolio**, measures for **Market Value**, **Cost Basis**, and **Unrealized P/L** with totals and subtotals.
- Pivot configuration controls for switching dimensions/measures (where supported by installed package).
- Sector exposure comparison chart for portfolios.
- Portfolio performance comparison chart for selected date range, preferably with normalized indexed value (start = 100) to compare differently sized portfolios.
- Export pivot results using the supported exporter, if available.
- If a **Modern-compatible Pivot Grid is not available**, do not fake it with a static image. Implement a **functional grouped aggregation grid** as a fallback, with a visible notice: “Pivot Grid requires the applicable Sencha package/license.” Document how to enable the real Pivot Grid.

## 4. Data integrity and calculation definitions

Treat calculations as part of the backend domain model and make them testable.

| Metric | Definition |
|---|---|
| Market value | `quantity * current_simulated_price_at_snapshot` |
| Open-position cost basis | `quantity * weighted_average_purchase_price` |
| Unrealized P/L ($) | `market_value - open_position_cost_basis` |
| Unrealized P/L (%) | `unrealized_pl / open_position_cost_basis * 100`; null when basis is zero |
| Total portfolio value | `cash_balance + sum(market_value)` |
| Daily P/L | `sum(quantity * (latest_price - previous_available_price))` for current positions, where `previous_available_price` is the simulated price at the **start of the current UTC day** (user-confirmed); label as **indicative price change**, not time-weighted return |
| Daily % | `daily_pl / (total_portfolio_value - daily_pl) * 100`, when denominator > 0; this assumes no same-day external cash flows and must be labeled illustrative |
| Portfolio allocation % | `position_market_value / sum(position_market_values) * 100`; exclude cash from equity allocation and state that explicitly |
| Total gain/loss | For v1, **investment P/L = realized trading P/L + unrealized trading P/L**; do **not** confuse it with total account growth driven by cash flows |
| Return % | `investment_pl / invested_capital_basis * 100` only if a clearly defined, consistently calculated denominator is available; otherwise do not show an ambiguous percentage |

**Important:** Define and document how cumulative realized P/L and invested capital basis are tracked. The JSON baseline and runtime trade journals must generate valuation history by replaying transactions and evaluating time-derived historical prices (including cash), not by inventing a separate unrelated chart series. Portfolio-level performance comparisons should adjust for external contributions/withdrawals if those operations are added in the future; otherwise use a fixed initial funding and trade-only cash movements so comparable index series are meaningful. Treat stock-price updates as deterministic simulated time ticks and historical valuations as sampled snapshots from the same price function.

**Precision:** Use integer cents (or a documented fixed-point/decimal library) for money in Node.js/JSON state; calculate and round deterministically. Whole-share quantities are acceptable for v1. Handle null/zero denominators safely. Avoid floating-point drift and clarify any cent-level rounding policy.

## 5. JSON-only data model and time-based market simulation (MANDATORY)

**Hard architecture constraint: Do NOT use MySQL, PostgreSQL, SQLite, MongoDB, Redis, an ORM, migrations, or any database.** Node.js must read local `.json` files, compute financial data in memory, and serve it over REST. The Ext JS frontend must obtain its business data **exclusively through Node.js endpoints**, never by importing fixture JSON directly.

### 5.1 JSON source files

Keep **immutable, human-readable baseline fixtures** under `server/data/fixtures/`:

- `companies.json`: real company names, tickers, sectors, descriptions, stable IDs; **no live price fetches**.
- `portfolios.json`: demo portfolios, initial simulated cash, base timestamp and IDs.
- Do not add `positions.json`: reconstruct positions from `server/data/fixtures/transactions.json` and portfolio starting cash.
- `transactions.json`: REQUIRED canonical baseline historical BUY/SELL journal under `server/data/fixtures/`; use it to reconstruct positions and cash balances. No duplicate holdings fixture.
- `market-config.json`: fixed simulation seed, reference timestamp, base prices for each ticker, volatility/drift parameters, tick duration, simulation speed and rounding. Also read the other four existing fixture files: `watchlists.json`, `market-events.json`, `market-scenarios.json`, `benchmarks.json`, and `app-settings.json`.

Persist **demo-only mutable actions**, separately, under `server/data/runtime/transactions.json` (and `state.json` only if needed). Do **not** overwrite baseline fixtures. On application restart, reload the runtime journal and deterministically reconstruct the current positions and balances. This is a local single-process demo, not a production trading system.

At first startup, create only the mutable runtime directory if missing; never seed or overwrite `server/data/fixtures/` automatically. `npm run demo:reset` explicitly clears/reinitializes runtime state; normal startup must NOT destroy transactions. Do not commit mutable runtime files. Provide a `npm run demo:seed` command that deterministically recreates fixtures if needed, and a `npm run demo:verify` consistency checker.

### 5.2 Deterministic market price function

**The simulated values must VARY AS A FUNCTION OF TIME, not with `Math.random()` on every request.** Define one Node.js module, e.g. `services/marketSimulator.js`, as the sole authority for ticker prices:

`price(ticker, simulatedTimestamp) = deterministicFunction(ticker, simulatedTimestamp, fixedSeed, marketConfig)`

Required qualities:

1. The same ticker and same simulated timestamp ALWAYS produce the same price across requests, screens, and server restarts (given unchanged config).
2. Prices change over time, not merely when a user reloads a page. Use configurable time buckets (default **5 seconds real time per price update**) and configurable simulation speed. For example derive `tickIndex = floor((nowUTC - simulationEpochUTC) / tickDurationMs)` and compute a seeded, bounded synthetic return series indexed by ticker and tick. Time buckets must be stable and deterministic (hash-based pseudorandom or seeded PRNG with reproducible indexing), with clamped positive prices.
3. Do NOT compound from the beginning of all time on every request. Use a practical bounded/cached formula or precomputed deterministic segments so 100 companies remain efficient. Avoid unbounded logs or excessively volatile behavior.
4. Different companies and sectors have distinct volatility/drift; some tickers rise while others fall. Use visually reasonable movement: no giant artificial jumps on each tick.
5. Use the exact same price function for spot values, historical chart points, trades, portfolio analytics, and CSV export. Historical points are samples at requested timestamps, not unrelated fabricated sequences.
6. A market snapshot carries `asOf`, `tickIndex`, `simulationMode: "DEMO"`, and optionally `nextTickAt`. Every endpoint that needs a price must derive it from **one captured as-of tick per request**. For multi-request UI coherence, support an optional `asOf`/`tick` query parameter, or return a `snapshotId` to reuse across related screen calls. Never return mixed tick prices within one response.
7. Trading execution must use a **server-captured latest tick**, even if a user submits an earlier/forged client price. Return actual price and execution timestamp.
8. Make simulation deterministic in tests using an injectable clock. Provide explicit example tests that freeze time and advance it by one or more ticks.

**Recommended simulator:** deterministic base price + a smooth combination of seeded periodic trends and bounded tick noise. It is acceptable to use a random-walk-like process if it is deterministic by timestamp and efficiently cacheable. Do not call a real stock quote API.

### 5.3 Keeping portfolio arithmetic coherent

- On startup, load baseline JSON, validate IDs/references, and replay seed plus runtime transaction journals to compute cash, positions, weighted-average cost, realized P/L and current positions.
- Treat immutable trade history and initial cash as the accounting source of truth; all market values and unrealized gains are **derived**, never permanently stored in JSON.
- Portfolio history is computed on demand (or cached by tick/range) by replaying transactions and sampling the **same deterministic simulated price function** at chart timestamps. Do not store a disconnected `portfolio_history.json` with unrelated prices.
- For charts, support 1M/3M/6M/1Y/All using an explicit **simulated time scale**. Choose manageable sampling intervals and label the x-axis accurately; a 1-year range must represent simulated time, not pretend that 5-second real-world ticks are actual calendar days. The simulation may use a clock multiplier so one real tick represents a configurable period of simulated market time.
- For consistency between historical and present balances, all baseline transaction dates and startup simulation epoch must be explicit. No trade may occur before initial funding, create negative cash, or sell more shares than owned.
- Optional server cache should be keyed by tick index (and portfolio/range where relevant) and invalidated after a trade. Never persist derived cache values as business truth.

### 5.4 Safe JSON writes and concurrency

- Use an in-process mutation queue or mutex so two simultaneous POSTs cannot overspend cash or shares.
- Validate, apply, and write a complete new runtime journal to a temporary file, then atomically rename it to the target `.json` file. Handle write failure without claiming success or exposing half-applied state.
- Use one Node.js server process only; document that multi-instance concurrency is unsupported without a database or coordination layer.
- Do not allow arbitrary file paths or JSON modifications from HTTP input. Restrict CORS to development origins; do not expose mutable data directory as static assets.
- Maintain no end-user personal or real financial account data.

## 6. Demo data and reset

Create reproducible JSON fixtures and generators. Targets:

| Data | Target |
|---|---:|
| Real company names/tickers | 60–100 |
| Demo portfolios | 3–5 |
| Current positions | 30–80 |
| Baseline historical transactions | Enough for believable history; 100–500 initially |
| Simulated historical prices | **Generated on demand**, no large stored price file |
| Portfolio chart history | **Generated on demand** from timestamp range |

Starter portfolios: **Technology Growth**, **Balanced Investment**, **Dividend Income**, with two optional portfolios. Example public-company identifiers: Apple/AAPL, Microsoft/MSFT, NVIDIA/NVDA, Amazon/AMZN, Alphabet/GOOGL, Tesla/TSLA, JPMorgan Chase/JPM, Johnson & Johnson/JNJ, Visa/V, Coca-Cola/KO.

The demo must have varied positive and negative returns, portfolio sizes, sectors and historical trades, without referencing actual market prices. **All values are simulated.** Real names/tickers are identifiers only.

`demo:reset` must restore a consistent baseline and **never run automatically** during normal server startup. `demo:verify` checks all fixture references, funding and trade history, portfolio arithmetic, and reproducible spot/history pricing at a fixed timestamp.

## 7. Ext JS Modern-compatible REST API contract (MANDATORY)

**Critical interoperability rule:** All Ext JS **collection** stores must receive a top-level `data` **array** and top-level `total` **number**. A `meta.total` field alone is NOT sufficient with `totalProperty: 'total'`. All success responses carry the top-level boolean `success`. Keep the same envelope across the backend.

### 7.1 Collection responses (`GET /api/companies`, `/api/holdings`, etc.)

HTTP `200 OK`:

```json
{
  "success": true,
  "data": [
    { "id": 1, "symbol": "AAPL", "company": "Apple Inc.", "price": 245.50 },
    { "id": 2, "symbol": "MSFT", "company": "Microsoft Corporation", "price": 420.75 }
  ],
  "total": 87,
  "meta": {
    "asOf": "2026-11-13T14:00:00.000Z",
    "tickIndex": 312,
    "simulationMode": "DEMO"
  }
}
```

- `data` is **always an array**, even when empty (`[]`).
- `total` is the **unfiltered-by-pagination number of records matching the active filters**; it is *not* the number returned in the current page. For an unpaged collection, `total = data.length`.
- `meta` is supplemental snapshot metadata, **not** a substitute for `total`.
- Numeric columns must be JSON numbers, not formatted strings (`245.5`, not `"$245.50"`). Timestamp fields use ISO-8601 UTC strings.
- HTTP `200` with `{ "success": true, "data": [], "total": 0 }` for a valid empty collection.

### 7.2 Single-record and dashboard responses

HTTP `200 OK`:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Technology Growth",
    "total_value": 1284500.00
  },
  "meta": {
    "asOf": "2026-11-13T14:00:00.000Z",
    "tickIndex": 312,
    "simulationMode": "DEMO"
  }
}
```

For `Ext.data.Model` / form-style loads, use an object in `data`. Dashboard aggregate endpoints also return an object in `data`; **do not bind them to an ordinary list Store expecting an array**. Use an `Ext.Ajax.request` callback or a ViewModel load routine to set dashboard values. An endpoint returning a time-series collection should use the array envelope above or have a clearly documented chart-specific adapter.

### 7.3 Successful mutations

POST trade: HTTP `201 Created` (or `200 OK` when appropriate). Return a new transaction in `data` and the authoritative server execution price and timestamp:

```json
{
  "success": true,
  "data": {
    "id": 501,
    "portfolio_id": 1,
    "company_id": 2,
    "trade_type": "BUY",
    "quantity": 10,
    "execution_price": 185.50,
    "executed_at": "2026-11-13T14:00:00.000Z"
  },
  "message": "Simulated trade executed",
  "meta": { "asOf": "2026-11-13T14:00:00.000Z", "tickIndex": 312, "simulationMode": "DEMO" }
}
```

### 7.4 Error responses

Return an appropriate non-2xx HTTP status (`400`, `404`, `409`, `500`) and:

```json
{
  "success": false,
  "message": "Insufficient simulated cash balance",
  "error": {
    "code": "INSUFFICIENT_CASH",
    "message": "Insufficient simulated cash balance"
  }
}
```

The top-level `message` is deliberately included for straightforward Ext JS failure handling; `error.code` is stable for programmatic handling. Never return HTTP `200` for a failed mutation.

### 7.5 Ext JS Modern Store and proxy examples

The following pattern is **required** for ordinary paged collections (verify precise config support against the project's installed Modern SDK version):

```javascript
Ext.define('FinApp.store.HoldingsStore', {
    extend: 'Ext.data.Store',
    alias: 'store.holdings',

    fields: [
        { name: 'id', type: 'int' },
        { name: 'symbol', type: 'string' },
        { name: 'company', type: 'string' },
        { name: 'quantity', type: 'int' },
        { name: 'current_price', type: 'number' },
        { name: 'market_value', type: 'number' }
    ],

    pageSize: 25,
    remoteSort: true,
    remoteFilter: true,

    proxy: {
        type: 'ajax',
        url: '/api/holdings',
        reader: {
            type: 'json',
            rootProperty: 'data',
            totalProperty: 'total',
            successProperty: 'success',
            messageProperty: 'message'
        }
    }
});
```

Modern grid (illustrative; use Modern-compatible grid/filter/paging APIs for the installed SDK):

```javascript
Ext.define('FinApp.view.holdings.HoldingsView', {
    extend: 'Ext.grid.Grid',
    xtype: 'holdings-view',

    store: { type: 'holdings' },
    columns: [
        { text: 'Ticker', dataIndex: 'symbol', flex: 1 },
        { text: 'Company', dataIndex: 'company', flex: 2 },
        { text: 'Shares', dataIndex: 'quantity', width: 110 },
        { text: 'Market Value', dataIndex: 'market_value', flex: 1 }
    ]
});
```

- Modern Toolkit uses `Ext.grid.Grid`; do **not** use Classic-only `Ext.grid.Panel`, `Ext.window.Window`, `Ext.form.field.*`, or Classic-only features/plugins/configs.
- Use `Ext.Dialog` or the installed Modern-compatible modal/dialog component for trade entry; use `Ext.Container`, `Ext.Panel`, Modern charts, and Modern grid tooling where supported.
- Use an accessible action button to open the trade dialog; optional double-tap support must not be the only way to trade.
- For array stores, `rootProperty: 'data'`, `totalProperty: 'total'`, and `successProperty: 'success'` must match the API fields **exactly**. Do not use a top-level raw array as the primary API contract, and do not make `meta.total` the only total count.
- With `remoteSort: true`, Ext JS may send a `sort` query parameter encoded as JSON (e.g. `[ { "property": "symbol", "direction": "ASC" } ]` URL-encoded). With `remoteFilter: true`, it may send a JSON-encoded `filter` parameter. Node.js must parse and validate these **or** configure proxy `encodeSorters` / `encodeFilters` or request params consistently on both sides. Do not assume `sort` and `dir` flat query parameters will always be sent automatically.
- Standard paging uses `page`, `start`, `limit` (depending on Store/proxy configuration). The server must correctly interpret the implemented parameter names and return the matching-page `data` plus full filtered `total`.
- Model writes through a `rest` proxy can use the same envelopes, but for this demo use explicit `Ext.Ajax.request` for the simulated trade POST and reload/refresh affected stores on success. Never trust or calculate execution price in the browser.
- The Modern Toolkit UI must consume REST data, **not** local imports of the JSON fixtures.

### 7.6 Required endpoints

Base path: `/api`. Use the envelopes and readers above.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | JSON fixture/simulator/API health |
| GET | `/api/portfolios` | Portfolio list and headline totals |
| GET | `/api/portfolios/:id` | Portfolio details |
| GET | `/api/dashboard?portfolioId=all&range=1Y` | KPI cards, top/bottom holdings, summary object |
| GET | `/api/portfolio-history?portfolioId=all&range=1Y` | Time-series collection |
| GET | `/api/sector-allocation?portfolioId=all` | Allocation collection |
| GET | `/api/companies?query=&page=&start=&limit=` | Company directory |
| GET | `/api/companies/:id/prices?range=6M` | Simulated price-series collection |
| GET | `/api/holdings?portfolioId=all&page=&start=&limit=&sort=&filter=` | Filterable/paged holdings |
| GET | `/api/transactions?portfolioId=all&page=&start=&limit=&sort=&filter=` | Transaction history |
| POST | `/api/transactions` | Execute simulated BUY/SELL |
| GET | `/api/analytics/pivot?portfolioId=all` | Pivot/grouping source collection |
| GET | `/api/analytics/comparison?range=1Y` | Normalized portfolio series |
| GET | `/api/analytics/sector-comparison` | Portfolio-by-sector totals |
| GET | `/api/exports/holdings.csv?...` | CSV fallback |
| GET | `/api/simulation/status` | Clock mode, tick, snapshot timestamp, next tick |

**POST `/api/transactions` request:**

```json
{
  "portfolio_id": 1,
  "company_id": 2,
  "trade_type": "BUY",
  "quantity": 10
}
```

Do not send a client-specified execution price. Node.js must determine the price and time from its current authoritative simulation tick, apply checks and atomic JSON journal persistence, then return the actual executed price. No real trades occur.

### 7.7 Node.js response helpers and validation

Implement shared response helpers so API shapes cannot accidentally diverge:

```javascript
function sendCollection(res, records, total, meta = {}) {
    return res.json({ success: true, data: records, total, meta });
}

function sendRecord(res, record, meta = {}) {
    return res.json({ success: true, data: record, meta });
}
```

- Use `total` before page slicing and after filtering.
- Validate/whitelist sorters and filters, JSON-decode safely, cap page sizes, and use stable ordering for paging. Return `400` for invalid sorter/filter payloads.
- Support coherent snapshot `asOf`/`tick` parameters on applicable read endpoints; return `meta.asOf` and `meta.tickIndex` with simulated financial responses.
- No duplicated financial calculations in Ext JS renderers or controllers; UI formats server-supplied values.
- Explicitly configured local CORS origins only when API and client use different origins.
- Health checks report JSON fixture/simulator readiness, never database connectivity.

## 8. Repository layout (ACTUAL workspace)

Use the root structure above, not the previous suggested `server/data/fixtures/` or `server/data/fixtures/` layout. Place server implementation code and runtime journal under `server/`; all nine immutable JSON fixtures stay under root `server/data/fixtures/`. Preserve existing app-owned source structure under `ext-js/`. `docs/` holds `mockups/` (provided, read-only) and, as needed, `DECISIONS.md` and API documentation.

Frontend preferred names (adjust if needed):

- `FinApp.view.main.Main`
- `FinApp.view.dashboard.DashboardView`
- `FinApp.view.holdings.HoldingsView`
- `FinApp.view.holdings.TradeDialog`
- `FinApp.view.analytics.AnalyticsView`
- Corresponding ViewModels, Controllers, Stores, and Models using Ext JS Modern Toolkit conventions.

The Ext JS application is named **FinApp** and its class namespace is `FinApp` (already configured in `ext-js/app.json`). Do not rename it or introduce a second `PortfolioIQ.*` namespace. "PortfolioIQ" remains the product name used in UI text and documentation.

## 9. UI design system

The approved mockups in `docs/mockups/` are the visual reference for each screen (see "Screen mockups" above). Where a mockup is silent or conflicts with this specification, the rules in this document win. Aim for a modern enterprise fintech look, markedly more refined than a stock Ext JS Modern application:

- Light neutral main background; white surfaces with subtle borders/shadows.
- Dark navy or slate navigation and headings; restrained blue accent; clear positive/negative indicators.
- Consistent spacing, 10–14px rounded cards, compact but readable data tables.
- Consistent typography, numeric alignment, fixed decimal places where appropriate.
- Meaningful hover and focus styles, keyboard usability, and sufficient contrast.
- User-visible **“SIMULATED DATA / DEMO”** notice in the header and near financial charts.
- Avoid using false live-feed indicators, official company branding, or real company logos.
- Responsive behavior: dashboard cards wrap; grid horizontal scrolling is acceptable; side nav collapses at smaller widths.
- Keep custom styles namespaced (e.g., `.piq-*`) to avoid breaking third-party components.

## 10. Development milestones (complete in order)

### Milestone 0 — Repository audit and plan

- Inspect repo and verify installed Sencha, Node, and package capabilities; ensure no database dependency is introduced.
- Identify any limitations that require a fallback.
- Write `docs/DECISIONS.md` and a short implementation checklist.

### Milestone 1 — JSON fixtures and deterministic time simulator

- Create JSON fixtures for companies, portfolios, baseline trades and market parameters.
- Implement price(ticker, timestamp), configurable time ticking, snapshot IDs, and frozen-clock tests.
- Build read/replay utilities, `demo:seed`, `demo:reset`, and `demo:verify`; no database.
- Validate consistency and historical reconstruction from the same price function.

### Milestone 2 — Node API, Ext JS-compatible envelopes, and domain calculations

- Implement JSON repositories, services, routes, validation, consistent top-level `success/data/total` envelopes, Modern-compatible remote filtering/sorting/pagination, errors, and atomic JSON-file mutation queue.
- Add automated tests for BUY, SELL, insufficient cash/shares, weighted average basis, P/L, date range, and value-history reconciliation.

### Milestone 3 — Ext JS application shell and Dashboard

- Set up **Modern Toolkit only** app layout, navigation, `Ext.data.Store` with Ajax proxy/JSON reader conventions from Section 7, and scoped styling.
- Connect Dashboard to local Node.js JSON-backed API and timer-driven refresh (not any external live market feed) and implement KPI/charts/filter interactions.

### Milestone 4 — Holdings Explorer

- Build Modern `Ext.grid.Grid`, Modern-compatible filters/grouping/summaries, detail panel and simulated Buy/Sell `Ext.Dialog`.
- Implement server-side mutation and refresh related stores/views.
- Add transactions history and CSV/exporter behavior.

### Milestone 5 — Analytics

- Implement actual Modern-compatible Pivot Grid if available; otherwise functional grouped aggregation fallback.
- Add sector comparison, normalized portfolio performance chart and appropriate exports.

### Milestone 6 — Polish and verification

- Fix alignment, responsiveness, errors, loading states and edge cases.
- Verify all screens against the same financial data.
- Complete quick-start docs and demo walkthrough.

## 11. Acceptance criteria

A milestone is complete only when it works, not just when its files exist.

- [ ] Repository can be installed and run using documented commands and environment variables.
- [ ] NO database is used; startup succeeds using local JSON fixtures only.
- [ ] Fixture and journal validation proves: no negative cash or holdings, timestamp-derived prices are reproducible, history at current tick matches current values, trades reconcile with positions.
- [ ] `GET /api/health` works and all required read routes return valid envelopes: collections use top-level `{success, data: [], total}`; record responses use `{success, data: {}}`.
- [ ] App builds and runs with **Ext JS Modern Toolkit** only; no Classic-only classes/plugins are used. Navigation between all **three** screens works without console errors.
- [ ] Changing portfolio updates KPIs, charts, holdings and analytics as appropriate.
- [ ] Dashboard KPIs reflect backend-calculated values.
- [ ] Holdings filter, sort, group, detail panel, and transaction history work.
- [ ] BUY/SELL changes cash and holdings correctly, prevents invalid orders, persists to atomic runtime JSON, and updates dashboard/analytics consistently.
- [ ] Simulated prices change after the configured tick interval, without relying on refresh randomness; all three screens agree on snapshot `asOf`.
- [ ] Frontend polls `/api/simulation/status` or uses an agreed refresh schedule; timers/listeners are cleaned up when views are destroyed; trades invalidate relevant stores.
- [ ] Company price charts show deterministic time-derived prices, identical when the same timestamp is requested.
- [ ] Portfolio comparison series starts at a normalized index of 100 in the selected range.
- [ ] Modern-compatible Pivot Grid works when available; if unavailable, the fallback is functional and clearly labeled.
- [ ] Export works via licensed exporter or server-side CSV fallback.
- [ ] Empty/loading/error states and readable financial formatting work.
- [ ] Application prominently discloses that all financial figures are simulated.
- [ ] Automated tests run and pass (or remaining failures are explicitly documented with cause).
- [ ] README contains setup, environment configuration, JSON fixture editing, simulation speed, seed/reset, dev commands and demo flows.

## 12. Tests to implement

### Backend

- Weighted-average cost on repeated buys.
- Realized P/L and remaining cost basis after partial/full sell.
- Insufficient cash, insufficient shares, invalid quantities, invalid portfolio/company.
- Atomic JSON journal update and in-process serialization of simultaneous transactions, including rollback/no-success on write failure.
- All-portfolios aggregation must equal the sum of individual portfolios.
- Holdings and history reconciliation at same tick and with injected frozen clock.
- Repeatable prices for identical timestamp, changed prices over advancing ticks, fixed-timestamp history consistency, sector volatility distinctions.
- Date range, sorting/filter parsing, `page/start/limit` pagination and top-level `total` response correctness.
- Export honors filters and escapes spreadsheet formula injection risks in cells (prefix risky leading `=`, `+`, `-`, `@` or tab/newline values appropriately).

### Frontend/manual QA

- Portfolio selector and range control update all expected components.
- Grid filter/group/sort interactions and detail views.
- BUY/SELL updates the grid and dashboard without full application reload.
- A small screen does not clip controls or prevent access to relevant grid columns.
- Zero holdings, no transactions and chart-empty states display gracefully.

## 13. Definition of done and handoff

When implementation is finished, provide:

1. A summary of created files and major technical decisions.
2. Commands to initialize/reset JSON demo fixtures, run backend tests, start Node.js, and run the Ext JS app.
3. Screens completed and the interactions verified.
4. Licensing/tooling limitations and exact steps to enable optional Enterprise packages.
5. Remaining known issues, if any, with no claims that untested functionality works.

### Required `README.md` sections

- What PortfolioIQ is and why it is a demo.
- Prerequisites and Sencha SDK/license notes.
- Environment variables, JSON fixture paths, simulation tick duration, simulation speed and seed; explicitly state **no database required**.
- How to seed/reset JSON fixtures and runtime transaction journal.
- How to run frontend and API in development.
- API overview and example requests.
- Demo walkthrough: Dashboard → Holdings Explorer → Trade Simulator → Analytics.
- How to reset demo data.
- Simulation disclosure and limitations.

## 14. Suggested demo walkthrough (5–8 minutes)

1. Open Dashboard, select **Technology Growth**, and explain KPI cards and trends.
2. Change date range and inspect sector allocation chart.
3. Open Holdings Explorer, filter to Technology, group by sector, and inspect a company.
4. Execute a **simulated BUY** with enough cash; show position and cash updates.
5. Open Analytics and compare sector exposure and portfolio performance.
6. Demonstrate Pivot Grid or its properly labeled fallback; export results.
7. Finish by showing the persistent (but resettable) local JSON transaction journal and time-driven price simulator and the simulated-data disclaimer.

## 15. Required live-refresh behavior

- Node.js is the only data access layer. Ext JS stores use REST/Ajax proxies for all financial records.
- The market simulator updates as simulated time advances; **no cron job or JSON rewrite is required just to make prices change**.
- On the frontend, refresh quotes/dashboard/analytics on a configurable interval aligned with server ticks (default every 5 seconds). Avoid reloading large grids unnecessarily: retain selection, scroll and filters; update only affected stores/records.
- Display `Last simulated update: <asOf>` and `SIMULATED MARKET` prominently. Never say `LIVE MARKET DATA`.
- Every refresh pulls a consistent backend market snapshot; the UI must not independently calculate random or changing prices.
- If the server restarts, the market function and JSON runtime journal recreate the same market/accounting state at the same simulated timestamp.

## 16. Immediate instruction to Claude Code

**Start now by inspecting the actual working directory and installed dependencies.** Then execute Milestones 0–6 in order, implementing the app end-to-end. Use the best available compatible Sencha Modern Toolkit API patterns for the installed version. **Use Ext JS Modern Toolkit exclusively. Do not create or connect any database. All business data must be sourced from JSON through Node.js, with values changing deterministically as a function of time.** If a dependency or license is missing, complete everything else possible, document the blocker, and implement the specified functional fallback rather than substituting a different UI framework. Do not ask for design decisions that this specification already resolves.

---

**Disclosure to display prominently in the app:**

> PortfolioIQ is a demonstration application. All stock prices, transactions, portfolio values, and performance results are simulated and do not represent real market conditions or investment advice. Real company names and ticker symbols are used for illustrative identification only.

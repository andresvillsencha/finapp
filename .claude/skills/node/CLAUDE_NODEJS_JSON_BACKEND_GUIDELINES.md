# Claude Code Rules — Node.js / Express JSON Backend

> **Role:** Senior Node.js/Express API architect and implementation agent.
> **Scope:** JSON-backed REST API for PortfolioIQ and other Ext JS Modern applications.
> **Design:** Simple, deterministic, testable backend. **No database, no external market-data API.**
> **Compatibility:** Ext JS 8.0 Modern frontend uses Ajax/REST proxies and JSON readers.

## Project location and instruction loading

This guide lives at `.claude/skills/node/CLAUDE_NODEJS_JSON_BACKEND_GUIDELINES.md`; read root `CLAUDE.md` first. **`server/data/fixtures/` is the authoritative immutable fixture directory:** nine already existing `.json` files. Read them through safe paths resolved from the repository root, not from `process.cwd()`. Use `server/data/runtime/` only for mutable state (transactions and optional simulator state); never copy, move or automatically overwrite `server/data/fixtures/` fixtures. `server/data/fixtures/transactions.json` is the baseline journal; avoid a competing initial holdings source. The `server/data/fixtures/` directory is not a SQL database.

## 0. Non-negotiable agent permissions and prohibitions

1. **Do not run `npm` or `npx`; do not run `git`; do not run any `sencha` command.** Do not invoke them indirectly using scripts. Do not run package installations, dependency upgrades, build scripts or repository commands.
2. **Never edit the `ext/` directory** or equivalent Sencha SDK. Backend work must remain inside the backend application and documented configuration boundaries.
3. **Whenever a prohibited command is required, tell the human operator what to execute**, from which directory, why, expected output and what result to report. Do not claim it was executed.
4. Do not add a database, ORM, Redis, external broker, third-party stock feed, browser-side JSON file fetching, microservices or cloud dependencies unless the user expressly changes the scope.
5. Read existing `server/package.json`, startup code, routes, JSON fixtures and conventions first. **Do not automatically modify package dependencies or lockfiles.** Prefer existing installed dependencies and Node built-ins. If a missing dependency is absolutely needed, request a manual npm action instead of silently installing it.
6. Keep demo-only financial data explicitly labelled simulated. Real company names/tickers are identifiers, **not** evidence of actual stock prices, performance or transactions.
7. Preserve functional existing endpoints and data. Do not overwrite fixtures or journals during routine startup.
8. Do not expose secrets, unsafe filesystem paths, stack traces, unrestricted CORS or administrative reset operations to an untrusted public deployment.
9. Prefer maintainable, testable **native Node.js** plus Express APIs. The frontend's Ext JS-first rule applies to browser/frontend code, **not** to Node. No use of `Ext.*` on the server.
10. Use documented standard HTTP semantics and consistent API envelopes so Ext JS readers work without custom reader hacks.

## 1. Start with a repository audit

Read and summarize:

- Existing Node version constraints, module system (`require`/CommonJS or `import`/ESM), installed Express version, `package.json`, `.env.example`, and startup entry point.
- Existing directory structure and API routes; preserve naming conventions and existing middleware.
- Existing fixture JSON files and demo journals; identify seeded versus mutable files.
- Current frontend endpoints, query parameter names, sorting/filtering conventions and refresh cadence.
- Existing tests, diagnostics and manual start commands.

Then produce a short, ordered plan and explicitly list prerequisites that only the human can fulfill. Never claim that npm tests, npm install, Git or Sencha build was run.

## 2. Recommended architecture

Use one Express server and layered modules; adapt to existing patterns rather than reorganizing working code.

```text
server/
  app.js                    # Express app + middleware + route registration
  index.js                  # Start listener (or existing server entry)
  routes/
    companyRoutes.js
    portfolioRoutes.js
    holdingsRoutes.js
    transactionRoutes.js
    analyticsRoutes.js
    simulationRoutes.js
  controllers/
    companyController.js
    portfolioController.js
    transactionController.js
  services/
    marketSimulationService.js
    portfolioService.js
    analyticsService.js
    transactionService.js
  repositories/
    jsonRepository.js
  middleware/
    errorHandler.js
    validateQuery.js
  data/
    runtime/                  # Mutable demo-only journal; do not commit
      transactions.json
      simulation-state.json   # Optional
  utils/
    apiResponse.js
    clock.js
    seededRandom.js
  tests/
    simulation.test.js
    portfolio.test.js
    api.test.js
  .env.example
  README.md
```

All nine seed JSON files are in `data/fixtures/` relative to `server/`, including `companies.json`, `portfolios.json`, `transactions.json`, `market-config.json`, `watchlists.json`, `market-events.json`, `market-scenarios.json`, `benchmarks.json`, and `app-settings.json`. Seed fixtures and mutable runtime state are **separate**. Do not persist thousands of generated price rows. Generate them from a deterministic function of seed and time.

## 3. Canonical REST contract for Sencha Ext JS Modern

### Collection `GET` success: always an object with array `data`

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "symbol": "AAPL",
      "company": "Apple Inc.",
      "price": 245.5,
      "change": 2.35,
      "change_percent": 0.97
    }
  ],
  "total": 1,
  "as_of": "2026-11-13T13:00:00.000Z",
  "simulation_tick": 180
}
```

- `data` **must be an array**, including when empty (`[]`).
- `total` is an integer count of records **after filtering, before pagination**; do not return page length as total when more rows exist.
- Do not wrap `data` in an unexpected `results`, `items`, `payload`, etc. Do not return a raw top-level array for a Store.
- Maintain stable types and field names across responses; numeric amounts are numeric JSON values, not formatted currency strings.
- Optional `as_of` (ISO-8601 UTC) and `simulation_tick` provide source/snapshot context.

### Single record / dashboard `GET` success

```json
{
  "success": true,
  "data": {
    "id": 7,
    "name": "Technology Growth",
    "total_value": 1284500.0,
    "return_percent": 18.4
  }
}
```

### Successful POST/PATCH/DELETE

```json
{
  "success": true,
  "data": { "id": 123, "portfolio_id": 7, "symbol": "AAPL", "quantity": 5 },
  "message": "Transaction recorded"
}
```

Use `201 Created` for created resources, `200 OK` when returning a result, or a documented alternative with consistent frontend handling. For DELETE when the frontend expects an envelope, prefer `200` plus JSON over a `204` empty body; do not return a 204 with JSON.

### Error response (with appropriate HTTP status)

```json
{
  "success": false,
  "message": "Insufficient cash to complete purchase",
  "code": "INSUFFICIENT_CASH",
  "details": { "portfolio_id": 7 }
}
```

- `400` malformed input, `404` unknown entity, `409` business conflict, `422` valid syntax but rejected business rule (choose consistently), `500` unexpected server failure.
- No HTML error pages for API routes. Error middleware must normalize unexpected failures and log internally without exposing stack traces.
- Preserve correct Content-Type `application/json`; apply request size limits and valid JSON parsing.

### Ext JS reader expectation

```javascript
reader: {
    type: 'json',
    rootProperty: 'data',
    totalProperty: 'total',
    successProperty: 'success',
    messageProperty: 'message'
}
```

This is a **frontend contract** the server must honor; do not force the frontend to implement custom readers to compensate for inconsistent backend responses.

## 4. Query parameter semantics: sorting, filtering and pagination

- For collection endpoints, support documented `page`, `start`, `limit`, `sort`, and `filter` query params where the frontend uses remote operations.
- Ext JS proxies may serialize `sort` and `filter` as JSON strings. **Inspect the actual Ext JS 8 Modern Store/proxy config** before choosing parser details; do not assume one format.
- Explicitly define allowlisted fields (`symbol`, `company`, `sector`, `market_value`, etc.) and supported operators. Reject unsupported keys/operators; do not evaluate arbitrary expressions, JavaScript, SQL snippets or regex provided by a client.
- Validate `page` >= 1, `start` >= 0, `limit` in a safe range (e.g. 1–200). Apply filters first, sort second, pagination last. Include final `total` pre-pagination.
- Ensure stable secondary sorting (e.g. by ID) to prevent duplicate/missing rows across pages at a fixed snapshot.
- If not implementing remote operations for a specific endpoint, document and configure that frontend Store for client-side operations rather than pretending the backend supports paging/filtering.
- Include timestamps/snapshot tokens when needed so different page requests use the same market tick.

## 5. JSON is the source of truth; no database

Suggested fixtures:

- `companies.json`: fixed real company name/ticker/sector metadata and **fictional** simulation parameters; IDs/symbols are unique.
- `portfolios.json`: named demo portfolios, base cash, benchmark choice, and fixture references.
- `initial-holdings.json`: starting positions/cost basis with consistent company IDs.
- `initial-transactions.json`: historical demo trades with unique IDs and reproducible dates.
- `simulation-config.json`: global epoch, tick interval, seed, drift/volatility bounds, demo currency.
- `server/data/runtime/transactions.json`: append-only or safely updated local demo transaction journal.
- `server/data/runtime/simulation-state.json`: optional explicit simulation time settings and last committed sequence; **not** a price cache that changes truth unpredictably.

Use Node `fs`/`fs.promises` and `path` for file operations; no database driver or ORM. Validate fixtures at startup (required fields, types, referential integrity, duplicate IDs, nonnegative quantities).

### Runtime writes

- Never modify seed fixtures when the user records a transaction.
- Serialize writes per runtime file through a queue/mutex or sequential transactional journal, and write via temporary file + rename **in the same directory/filesystem**. Verify platform behavior and recovery requirements.
- Do not perform simultaneous read/modify/write without coordination; otherwise transaction updates can be lost.
- Use atomicity and backup/recovery appropriate to a **single-process demo**. If multi-process deployment is requested, explain that flat files need external coordination or a revised storage choice.
- Avoid direct user-provided file paths. Build paths from constants and restrict writes to the runtime directory.
- Include a human-triggered reset mechanism with confirmation/authorization for any exposed endpoint; resetting must never occur automatically at server start.

## 6. Deterministic time-based price simulation

**Critical invariant:** **Same company + same simulation tick + same configuration => same price**, regardless of which endpoint is called, request order, process restart, or screen. No `Math.random()` inside a request handler to calculate live prices.

Conceptual parameters:

```json
{
  "seed": "portfolioiq-demo-v1",
  "epoch_utc": "2026-01-01T00:00:00.000Z",
  "tick_seconds": 5,
  "base_currency": "USD",
  "price_floor": 0.01
}
```

Algorithm recommendation:

1. Choose an authoritative server clock (UTC). Determine `tick = floor((now - epoch) / tick_seconds)`, or accept a **validated snapshot tick** from the client.
2. Assign each company a fixed fictional base price, bounded volatility and drift, plus a stable hash-based seed.
3. Compute price as a deterministic function of company ID/seed and tick. Suitable approaches: seeded pseudo-random per-tick returns accumulated/cached correctly, or a deterministic smooth trend + multi-frequency oscillation. The result must be bounded, finite and reproducible.
4. Use **exactly the same price function** for endpoint `/companies`, `/holdings`, `/portfolios`, `/dashboard`, `/analytics`, and historical charts.
5. Define `previous_price` at tick - 1 and `change = current_price - previous_price`, `change_percent = 100 * change / previous_price` when previous_price > 0.
6. Generate price history by evaluating the **same function** for prior ticks. Never fabricate independent chart histories that do not reconcile with current quote.
7. Round prices for display only or explicitly define a consistent calculation rounding policy. Avoid drift from repeated rounding of intermediate values.
8. Use a stable seed and fixed epoch so restarting the server produces the same value at the same tick, unless an explicit reset/config change occurs.

**Practical caution:** A naïve cumulative pseudo-random walk recomputed from tick 0 on every request is O(tick) and degrades over long-running demos. Prefer an O(1) deterministic function or well-defined checkpoint cache, with history tests and bounded memory.

### Snapshot consistency

When one dashboard refresh causes multiple concurrent HTTP requests, the *same* `simulation_tick` must be used for those associated responses. Options:

- A single aggregate dashboard endpoint returns all correlated metrics at one computed tick; **preferred for Dashboard**.
- Client requests `/api/simulation/state`, obtains `simulation_tick`, and passes `?tick=...` to subsequent endpoints (server validates allowed range).

Document the chosen method. Do not allow mismatched prices and holdings totals due to tick boundaries between requests.

## 7. Portfolio calculations and business integrity

Recommended canonical formulas:

```text
market_value_i       = quantity_i * current_price_i
unrealized_gain_i    = market_value_i - remaining_cost_basis_i
unrealized_gain_pct  = 100 * unrealized_gain_i / remaining_cost_basis_i  (if > 0)
portfolio_value      = cash_balance + SUM(market_value_i)
allocation_pct_i     = 100 * market_value_i / portfolio_value (if > 0)
```

- State whether `total_return` includes realized P&L, unrealized P&L, dividends and external cash flows. For v1, a documented **time-weighted return** or a clearly labelled gain-on-invested-capital metric is acceptable; do not mislabeled one as the other.
- Distinguish deposits/withdrawals from investment performance. If no external cash flows are modeled, say so.
- Use one canonical service for valuations and one canonical service for transactions; dashboard and analytics must not duplicate inconsistent formulas.
- For buys: verify company exists, quantity positive, notional/cost feasible, sufficient portfolio cash; debit cash; create/update holdings and cost basis; record trade with execution tick and fictional price.
- For sells: verify enough holdings, calculate cost basis removed according to a documented method (e.g. weighted average), credit cash, update holdings, record realized P&L.
- All updates to related journal/cash/holdings state must be coherent; prefer an append-only transaction event and derive balances/holdings deterministically rather than trying to atomically overwrite multiple JSON state files.
- Handle duplicate submissions using an idempotency key for transaction creation, or explain the single-user demo simplification explicitly.
- Reject nonexistent portfolio/company IDs, NaN/Infinity, negative amounts, overflows, and invalid currencies.
- Be deliberate about decimal/currency precision; for a demo, round at explicit boundaries and test reconciliation; never silently mix cents and dollars.

## 8. Required API surface for PortfolioIQ

Use the actual product spec as the endpoint authority; baseline suggestions:

| Method | Endpoint | Return |
|---|---|---|
| GET | `/api/health` | service status, no secrets |
| GET | `/api/simulation/state` | epoch, tick, interval, as_of |
| GET | `/api/companies` | collection envelope (filtered/paged if configured) |
| GET | `/api/companies/:id` | company object and simulated quote |
| GET | `/api/portfolios` | portfolio collection/summaries |
| GET | `/api/portfolios/:id` | detail and aggregate metrics |
| GET | `/api/portfolios/:id/holdings` | holding collection including quote/valuation |
| GET | `/api/portfolios/:id/transactions` | transaction collection |
| POST | `/api/portfolios/:id/transactions` | validation + persisted fictional transaction |
| GET | `/api/dashboard` | one-tick aggregate summary, performance series, allocation |
| GET | `/api/analytics` | aggregates/sector analysis for selected portfolio/tick |
| POST | `/api/demo/reset` | local/demo-admin-only reset; never public unauthenticated |

Do not blindly duplicate a conflicting route from the product specification. Prefer consistency and document the final route map. Add proper `404` behavior and validation for all `:id` parameters.

## 9. Express request pipeline and error handling

- Configure `express.json` size limit; optionally `express.urlencoded` only if needed. Set stable route prefixes and a JSON-only API not-found handler.
- Use CORS only for known frontend development origins, configured explicitly via env; otherwise serve frontend and API from the same origin or via dev proxy. Avoid wildcard CORS if credentials are involved.
- Add security headers and sensible caching: dynamic simulated quotes should not be accidentally cached stale; fixture metadata may use limited caching only when deliberate.
- Create shared response helpers and a centralized error middleware. If handlers are async, ensure rejected promises reach middleware (Express version-dependent).
- Use structured logs with request timing, route, HTTP status, and redacted sensitive information. Do not log secrets or all user payloads indiscriminately.
- Add `/api/health` for basic smoke tests.
- Keep all route functions thin; domain calculations live in services; file I/O lives in repository. Inject or mock the clock for reproducible tests.

### Minimal response helper (illustration)

```javascript
function sendCollection(res, records, total, meta = {}) {
    return res.status(200).json({
        success: true,
        data: records,
        total,
        ...meta
    });
}

function sendError(res, status, code, message, details) {
    return res.status(status).json({
        success: false,
        code,
        message,
        ...(details ? { details } : {})
    });
}
```

Never return `undefined`, `NaN`, or `Infinity` as meaningful financial fields; validate values before JSON serialization.

## 10. Tests to author (without executing prohibited tools)

Design tests using installed tooling, or Node built-in `node:test` when the existing Node version supports it. **Do not run npm scripts**, but you may run standalone `node` commands if explicitly permitted in the user's environment and without invoking npm/Git/Sencha; otherwise provide manual commands for the human.

Must cover:

1. Same company/tick => same quote across repeated calls and process restart.
2. Different ticks => believable changes without negative/invalid prices; consistent `previous_price` and derived daily/tick change.
3. Historical final point matches quote at the same tick.
4. Dashboard values, holdings subtotal, portfolio detail, and analytics totals reconcile within documented currency tolerance.
5. Collection envelopes, empty results, filtering, sorting and pagination `total` semantics.
6. Missing/invalid IDs, malformed JSON and unsupported query operators produce proper 4xx JSON errors.
7. Buy/sell validation, duplicate prevention, balance/cost-basis/realized P&L, insufficient cash/shares.
8. Concurrent writes never lose or corrupt transactions; runtime journal survives restart.
9. Demo reset restores seed-derived state only when intentionally invoked.
10. 500 errors hide internal stack traces from client while logging the failure to server diagnostics.

## 11. Deployment boundaries and demo safety

- No bank or brokerage connectivity, no real orders, no live market quote service, no personal financial accounts.
- Distinguish real **company identities** from fictional prices/returns in README, API documentation, and UI labels.
- If hosted publicly, do not expose unrestricted write/reset operations: use read-only public mode, explicit demo authentication, or isolated per-session mock data. A shared writable JSON runtime can be vandalized.
- JSON file persistence is intentionally for a **single-instance demo**. Do not claim it provides transactional guarantees appropriate to real financial software.
- Use UTC ISO-8601 timestamps in API/fixtures. Frontend handles display localization.
- Configuration via environment variables with safe defaults; maintain `.env.example`, not committed real credentials.

## 12. Human handoff format

Whenever a prohibited step is necessary, tell the user, not the terminal:

```text
MANUAL ACTION REQUIRED
Reason: [why this is needed]
Directory: [exact working directory]
You run: [specific npm / sencha / git command; do not execute it]
Expected output: [what success should look like]
Please share: [errors or logs if needed]
```

For every finished change, report modified files, API endpoints, fixture changes, test coverage implemented, tests actually executed (if any), actions still requiring operator intervention, and known limitations. Never say "build passed" without a build performed by the human or an explicitly authorized non-prohibited method.

## 13. Definition of done

- [ ] Existing project audited, architecture and dependency choices documented.
- [ ] Pure Node/Express + JSON fixtures/runtime; **no database**.
- [ ] Deterministic server-side simulation and exact shared snapshot semantics.
- [ ] Canonical finance calculations, correct fictional transaction accounting, and repeatable results.
- [ ] Every collection endpoint returns `{success:true,data:[],total:n}`, with stable types and correct status codes.
- [ ] Single-resource and error envelopes match the Ext JS reader/controller expectations.
- [ ] Remote operations implemented only where advertised.
- [ ] Safe/serialized JSON writes and explicit reset behavior.
- [ ] Backend tests authored for simulation, reconciliation, query parsing, transactions and errors.
- [ ] Human instructions cover all npm/Git/Sencha commands and other operator-only activities.
- [ ] No npm/npx/Sencha/Git executed by agent; no changes in `ext/`.

## 14. References

- Ext JS 8.0 Modern JSON Reader: https://docs.sencha.com/extjs/8.0.0/modern/Ext.data.reader.Json.html
- Ext JS 8.0 Modern Store/API: https://docs.sencha.com/extjs/8.0.0/modern/
- Express docs: https://expressjs.com/
- Node.js documentation: https://nodejs.org/api/

**Final reminder:** Node owns data and simulated time; Ext JS owns the UI. The browser never reads backend JSON fixtures directly. The agent codes and documents but does **not** run npm, Sencha CLI, Git, or modify the Sencha SDK.

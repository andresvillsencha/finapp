# PortfolioIQ API inventory

Base path `/api`. **All data is simulated.** JSON only. Numbers are JSON numbers (dollars with up to 2 decimals unless noted); timestamps are ISO-8601 UTC.

## Envelopes

Collection (Ext JS reader: `rootProperty: 'data'`, `totalProperty: 'total'`, `successProperty: 'success'`, `messageProperty: 'message'`):

```json
{ "success": true, "data": [], "total": 0,
  "meta": { "asOf": "2026-11-13T12:00:00.000Z", "tickIndex": 11776320, "simulationMode": "DEMO",
            "scenarioId": "normal", "nextTickAt": "2026-11-13T12:00:05.000Z" } }
```

`total` is the number of rows matching the filters **before** paging. Record: `{ "success": true, "data": {}, "meta": {} }`.

Error (HTTP 400/404/409/500):

```json
{ "success": false, "message": "Insufficient simulated cash balance", "code": "INSUFFICIENT_CASH",
  "error": { "code": "INSUFFICIENT_CASH", "message": "Insufficient simulated cash balance" },
  "details": { "portfolio_id": 5, "required": 3007, "available": 1200.5 } }
```

## Common query parameters

| Parameter | Meaning |
|---|---|
| `portfolioId` | `all` (default) or a portfolio id |
| `range` | `1D`, `1W`, `1M`, `3M`, `6M`, `1Y`, `ALL` (simulated days) |
| `tick` / `asOf` | Optional snapshot to reuse across related requests (not both; must not be in the future) |
| `page`, `start`, `limit` | Paging (default 25, max 100) |
| `sort` | `[{"property":"symbol","direction":"ASC"}]` (URL-encoded) or `sort=symbol&dir=ASC` |
| `filter` | `[{"property":"sector","value":"Tech","operator":"like"}]` (URL-encoded). Operators: `= == === eq != ne < lt <= le > gt >= ge like in notin`. Several filters are combined with AND |
| `group`, `groupDir` | Holdings only. `group=sector&groupDir=ASC` (or the JSON sorter object Ext sends by default). Groupable: `sector`, `portfolio_name`. Rows are ordered by the group first; the `sort` applies inside each group |
| `query` | Holdings and companies: free-text search over ticker, company, sector and industry |

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | Fixture and simulator readiness |
| GET | `/api/simulation/status` | Mode, scenario, tick, `as_of`, `next_tick_at`, tick duration, speed, refresh interval |
| GET | `/api/portfolios` | Portfolios with headline totals (collection) |
| GET | `/api/portfolios/:id` | One portfolio with totals (record) |
| GET | `/api/dashboard?portfolioId&range` | `{scope, kpis, top_performers, bottom_performers, portfolio_summary, definitions}` (record) |
| GET | `/api/portfolio-history?portfolioId&range` | Value series: `timestamp, tick_index, portfolio_value, cash_balance, market_value, investment_pl, investment_pl_pct` |
| GET | `/api/sector-allocation?portfolioId` | `sector, market_value, allocation_pct, position_count` (cash excluded) |
| GET | `/api/companies?query&page&start&limit&sort&filter` | Company directory with simulated quote |
| GET | `/api/companies/:id/prices?range` | `timestamp, tick_index, price` series |
| GET | `/api/holdings?portfolioId&page&start&limit&sort&filter&group&groupDir&query` | Open positions with derived values; `meta.totals` and `meta.groups` hold server sums |
| GET | `/api/transactions?portfolioId&page&start&limit&sort&filter` | Transaction history (filters: portfolio, ticker, side, date range) |
| POST | `/api/transactions` | Execute a simulated BUY/SELL (201) |
| GET | `/api/analytics/pivot?portfolioId&layout` | `layout=flat` (default): flat position rows (sector, company, portfolio, market value, cost basis, unrealized P/L), the source of the Ext JS Pivot Grid. `layout=wide`: one row per company with a column per portfolio and measure; `meta.groups` / `meta.grand` hold server-calculated subtotals and grand total |
| GET | `/api/analytics/comparison?range` | Normalized series (start = 100): `portfolio_<id>` and `benchmark_<id>` fields; `meta.series` describes them |
| GET | `/api/analytics/sector-comparison` | One row per sector with `portfolio_<id>` (value) and `portfolio_<id>_pct` fields |
| GET | `/api/exports/holdings.csv?portfolioId&filter&sort` | CSV of all matching holdings (text cells protected against formula injection) |
| GET | `/api/exports/pivot.csv?portfolioId&tick` | CSV of the wide pivot: company rows, a subtotal row per sector and a grand total row, all measures per portfolio (server-side alternative; the Analytics screen exports through the Exporter plugin) |

### Wide pivot (`/api/analytics/pivot?layout=wide`)

Row fields: `id, sector, company_id, symbol, company`, then for each portfolio `portfolio_<id>_market_value`, `portfolio_<id>_cost_basis`, `portfolio_<id>_unrealized_pl` (`null` when that portfolio does not hold the company) and `total_market_value`, `total_cost_basis`, `total_unrealized_pl`. `meta.portfolios` lists the columns, `meta.measures` the measures, `meta.groups[sector]` the sector subtotals (same field names plus `count`) and `meta.grand` the grand total (a portfolio without positions is 0). All sums are exact cents.

`GET /api/analytics/comparison` rows carry one numeric field per series (`portfolio_<id>`, `benchmark_<id>`); the first sampled row of every series is 100 and `meta.series` describes the fields.

### Holdings totals and groups (`meta`)

`meta.totals` and `meta.groups` are calculated by the server over **every row matching the filters** (before paging), in exact cents, so a paged grid never has to add values up:

```json
"totals": { "count": 75, "market_value": 4210032.5, "cost_basis": 3990000, "unrealized_pl": 220032.5,
             "unrealized_pl_pct": 5.5148, "daily_pl": 1843.2 },
"groups": { "sector": { "Technology": { "count": 12, "market_value": 0, "cost_basis": 0, "unrealized_pl": 0,
                                        "unrealized_pl_pct": null, "daily_pl": 0 } },
            "portfolio_name": { "Technology Growth": { } } }
```

`unrealized_pl_pct` is `null` when the cost basis is zero.

### Holdings row

`id, portfolio_id, portfolio_name, company_id, symbol, company, sector, industry, quantity, average_cost, current_price, previous_price, day_change, day_change_pct, market_value, cost_basis, unrealized_pl, unrealized_pl_pct, daily_pl, allocation_pct`

- `market_value = quantity * current_price`; `cost_basis` is the exact open-position cost; `average_cost = cost_basis / quantity`.
- `unrealized_pl_pct` is `null` when the cost basis is zero.
- `allocation_pct` = share of the selected scope's **equity** market value (cash excluded).
- `previous_price` is the price at the start of the current UTC day.

### Dashboard KPIs

`portfolio_value, total_gain_loss, total_gain_loss_pct, daily_change, daily_change_pct, cost_basis, cash_balance, market_value, unrealized_pl, unrealized_pl_pct, realized_pl, initial_funding, position_count`

- `total_gain_loss` = realized + unrealized trading P/L; `total_gain_loss_pct` = that divided by initial funding.
- `daily_change` is an **indicative price change** since the start of the UTC day (not a time-weighted return); `daily_change_pct = daily_change / (portfolio_value - daily_change) * 100`.

### POST /api/transactions

Request (never send a price or time; they are ignored):

```json
{ "portfolio_id": 1, "company_id": 2, "trade_type": "BUY", "quantity": 10 }
```

Response `201`:

```json
{ "success": true,
  "data": { "id": "R-000001", "seq": 91, "portfolio_id": 1, "portfolio_name": "Technology Growth",
            "company_id": 2, "symbol": "MSFT", "company": "Microsoft Corporation", "trade_type": "BUY",
            "quantity": 10, "execution_price": 300.7, "amount": 3007, "fee": 0, "realized_pl": null,
            "executed_at": "2026-11-13T12:00:00.000Z", "tick_index": 11776320, "source": "RUNTIME",
            "portfolio_cash_after": 533520.92, "position_quantity_after": 10 },
  "message": "Simulated trade executed",
  "meta": { "asOf": "2026-11-13T12:00:00.000Z", "tickIndex": 11776320, "simulationMode": "DEMO" } }
```

### Error codes

`INVALID_JSON, PAYLOAD_TOO_LARGE, INVALID_TRADE, INVALID_TRADE_TYPE, INVALID_QUANTITY, INVALID_PORTFOLIO_ID, INVALID_COMPANY_ID, INVALID_RANGE, INVALID_PAGING, INVALID_SORTER, INVALID_GROUP, INVALID_LAYOUT, INVALID_FILTER, INVALID_TICK, INVALID_AS_OF, INVALID_SNAPSHOT, TICK_OUT_OF_RANGE, AS_OF_OUT_OF_RANGE` (400); `PORTFOLIO_NOT_FOUND, COMPANY_NOT_FOUND, ROUTE_NOT_FOUND` (404); `INSUFFICIENT_CASH, INSUFFICIENT_SHARES, OUT_OF_ORDER_TRANSACTION, TRADING_DISABLED, PORTFOLIO_NOT_ACTIVE` (409); `PERSISTENCE_FAILED, INTERNAL_ERROR` (500).

# PortfolioIQ — Implementation Plan

**Status:** Ready for implementation  
**Development approach:** Incremental delivery with Claude Code  
**Application:** Financial portfolio application (PortfolioIQ)  
**Backend:** Node.js / Express, JSON-backed data access (no database)  
**Frontend:** Sencha Ext JS 8, **Modern toolkit only**

> This document defines **how and when to implement** the application. The root `CLAUDE.md` defines **what to implement** and is the authoritative specification. Claude Code must inspect it, the skill files and the existing project before making changes. Do not invent requirements where the source material is silent.

> **Precedence:** If this plan contradicts `CLAUDE.md`, `CLAUDE.md` wins (toolkit, folder layout, data rules, operating restrictions). Flag the contradiction rather than silently choosing.

## 1. Objectives

- Implement the PortfolioIQ specification in `CLAUDE.md` as a working application with three screens: **Portfolio Dashboard**, **Holdings Explorer** and **Portfolio Analytics**.
- Build and verify the backend (including the deterministic market simulator) before starting the frontend.
- Set up a functioning Ext JS **Modern** application shell before building individual screens.
- Build screens one at a time, in the order Dashboard → Holdings Explorer → Analytics.
- Keep implementation small, testable and reviewable; require explicit user approval before moving to the next phase.

## 2. Sources of truth and precedence

Before implementation, Claude Code must inspect and, where relevant, load:

1. `CLAUDE.md` (authoritative specification, restrictions and canonical layout).
2. Skills and guidelines: `.claude/skills/extjs/`, `.claude/skills/node/`, `.claude/skills/data/` (each `SKILL.md` and its guideline file).
3. `README.md` and `README_INSTALL.md`.
4. The nine fixture files in `server/data/fixtures/` and the runtime folder `server/data/runtime/`.
5. Existing application code and configuration under `ext-js/` and `server/`.
6. The mockup images in `docs/mockups/` (view the one for the screen being built).

**Resolution rules:**

- Preserve existing requirements, domain terminology, data schemas and user-approved design choices.
- Prefer explicit, more specific requirements over generic guidance. If sources conflict materially, flag the contradiction and request a decision.
- This plan is never permission to invent endpoints, calculations, fields or features not defined in `CLAUDE.md`.
- **Visual design:** the approved mockups in `docs/mockups/` (`01-dashboard.png`, `02-holdings-explorer.png`, `03-portfolio-analytics.png`) are the visual reference for layout and style. **`CLAUDE.md` always wins over the mockups** (§3 requirements, §4 calculations, §7 API, §9 design rules, restrictions). Record every deviation in `docs/DECISIONS.md` and the phase report; a mockup never adds features, endpoints or fields. Do not claim fidelity to an image that has not been viewed.
- Preserve existing working code unless a change is required for the approved phase.

### Confirmed decisions

- **Namespace:** the Ext JS app is `FinApp` (already in `app.json`); "PortfolioIQ" is the product name only.
- **Daily change:** measured from the start of the current UTC day (indicative price change).
- **Scope of extras:** scenario support and benchmark series are core. Watchlists, market-events markers and simulator controls are deferred until Phases 1 to 5 are approved.
- **Database:** none; `mysql2` has been uninstalled.
- **Mockups:** `docs/mockups/` is the visual reference; `CLAUDE.md` wins on any conflict.

### Canonical layout (from `CLAUDE.md`)

```text
finapp/
├── CLAUDE.md                  # Authoritative specification
├── IMPLEMENTATION_PLAN.md     # This roadmap
├── README.md, README_INSTALL.md
├── docs/
│   ├── mockups/               # Approved visual references (read-only)
│   └── DECISIONS.md, API docs (created as needed)
├── .claude/skills/            # extjs, node, data
├── ext-js/                    # Existing Ext JS 8 Modern application
└── server/
    ├── src/                   # Express source (routes, controllers, services,
    │                          #   repositories, middleware, simulator)
    ├── data/
    │   ├── fixtures/          # Nine immutable canonical JSON files
    │   └── runtime/           # Mutable demo journal/state, not tracked by Git
    ├── scripts/               # demo:seed, demo:reset, demo:verify
    ├── tests/
    └── package.json
```

**Important:** Use `server/data/fixtures/` and `server/data/runtime/` exclusively for JSON data. Do not create a root-level `db/` directory and do not introduce any database or ORM. Resolve data paths from the module location, never from `process.cwd()`.

## 3. Working agreement for Claude Code

### Hard operating restrictions (from `CLAUDE.md`)

- Claude **never executes** `sencha`, `npm`, `npx` or `git`, including indirect or scripted invocations. Direct `node` checks are allowed if they do not call restricted commands or modify protected files.
- Claude never edits the Sencha SDK `ext/` directory.
- When a restricted command is needed, Claude gives the user the exact command, working directory, purpose and verification step. Results that Claude has not itself executed are **never reported as passed**; they are reported as `NOT RUN (user to run)` until the user supplies the output.
- Commits are made only by the user. Claude may suggest a checkpoint after approval.

### For every phase

1. **Inspect first.** Read applicable specifications, current code and assets. Briefly summarize findings and the precise scope of the phase.
2. **Plan before editing.** Identify planned files, dependencies, tests and unresolved material conflicts. Ask only about blockers.
3. **Implement only the current phase.** Avoid unrelated refactors and future-screen work.
4. **Verify.** Run permitted checks directly (static inspection, direct `node` scripts and tests that need no restricted command). For everything else, hand the user the command to run and the expected result.
5. **Report.** Provide files changed, functionality delivered, commands for the user to run, test outcomes (distinguishing executed from not-run) and outstanding issues.
6. **Stop.** Wait for explicit user approval before starting the next phase.

Additional rules:

- Do not delete, regenerate or overwrite existing project data without explicit authorization. Fixtures are never written by the application.
- Do not introduce secrets into source control; provide `.env.example` where appropriate.
- Keep business logic outside HTTP controllers and UI view classes.
- Avoid unnecessary frameworks, libraries and abstractions.
- Respect existing naming and coding conventions; do not rename the project or change the agreed tech stack.
- Use Ext JS **Modern** public APIs only; no Classic classes, configs or plugins.

## 4. Phases and approval gates

| Phase | Name | Main deliverable | Gate to proceed |
|---|---|---|---|
| 1 | Backend foundation | Audit, JSON fixtures validation, deterministic simulator, Express API and tests | Backend behavior reviewed and approved |
| 2 | Ext JS foundation | Modern app shell with navigation, shared styling, stores and API connection | Application shell reviewed and approved |
| 3 | Portfolio Dashboard | Working Dashboard screen (`CLAUDE.md` §3.1) | Dashboard reviewed and approved |
| 4 | Holdings Explorer | Working Holdings Explorer, transactions and Trade Simulator (`CLAUDE.md` §3.2) | Holdings Explorer reviewed and approved |
| 5 | Portfolio Analytics | Pivot Grid or labeled fallback, comparison charts and export (`CLAUDE.md` §3.3) | Analytics reviewed and approved |
| 6 | Integration, QA and polish | Verified end-to-end application and final documentation | Final acceptance |

---

## Phase 1 — Backend foundation (spec Milestones 0, 1 and 2)

### Goal

Provide a reliable Node.js/Express API, backed only by JSON files and a deterministic time-based market simulator, that exposes the data and operations defined in `CLAUDE.md`, independently of the frontend.

### Tasks

**Audit (Milestone 0)**
- Inspect the repository, installed Node version and existing server files; confirm no database is used.
- Write `docs/DECISIONS.md` with assumptions and any fallbacks, and a short implementation checklist.
- Confirm no database dependency remains (`mysql2` was already uninstalled by the user).

**Fixtures and simulator (Milestone 1)**
- Validate the nine fixtures in `server/data/fixtures/`: IDs, references, funding, trade history. Do not modify them unless explicitly needed and safe.
- Implement the single price authority `price(ticker, simulatedTimestamp)` with seeded deterministic math, configurable tick duration and speed, an injectable clock and frozen-clock tests.
- Implement journal replay (cash, positions, weighted-average cost, realized P/L) from the baseline `transactions.json` plus the runtime journal.
- Provide `demo:seed`, `demo:reset` and `demo:verify` scripts. Normal startup only creates the empty `runtime/` folder if missing; it never seeds or overwrites fixtures and never resets runtime data.

**API (Milestone 2)**
- Organize `server/src/` into routes, controllers, services, repositories and middleware.
- Implement the endpoints in `CLAUDE.md` §7.6 with the exact envelopes (`success`, `data`, `total`, `meta`) and error format.
- Support Ext JS `page`/`start`/`limit`, JSON-encoded `sort` and `filter` with whitelisting and validation.
- Trade execution uses the server-captured tick price, serialized writes via an in-process queue, and atomic temp-file-plus-rename persistence under `server/data/runtime/`.
- Add validation, centralized error handling, local-development CORS and environment configuration with an `.env.example`.
- Add the backend tests listed in `CLAUDE.md` §12.
- Document installation, startup, routes, environment variables and tests.

### Deliverables

- Server source, scripts and `package.json` scripts (`start`, `test`, `demo:seed`, `demo:reset`, `demo:verify`).
- `docs/DECISIONS.md`, API inventory (method, path, purpose, example response) and backend README.
- Automated backend tests.

### Acceptance criteria

- [ ] No database dependency remains; startup uses only local JSON.
- [ ] Server starts with documented commands (user-run where `npm` is needed).
- [ ] All in-scope endpoints return the specified envelopes and status codes.
- [ ] Prices are reproducible for the same ticker and tick; history at the current tick matches current values.
- [ ] Business calculations match `CLAUDE.md` §4 and validated test cases.
- [ ] Fixtures are unchanged after starting and using the API.
- [ ] Trades persist under `server/data/runtime/` and survive a restart.
- [ ] Invalid requests and missing resources return consistent errors.
- [ ] Test results are reported accurately, marking anything Claude could not execute as `NOT RUN`.
- [ ] No Ext JS screens were implemented in this phase.

**Stop after Phase 1.** Present the API inventory and test results for approval.

---

## Phase 2 — Ext JS Modern application foundation

### Goal

Bring up a functional Ext JS 8 **Modern** frontend connected to the Phase 1 API, without implementing the screens themselves.

### Tasks

- Inspect `ext-js/`, the installed SDK version, `app.json` and `workspace.json`. Verify Font Awesome, Charts and UX are enabled, and check whether Pivot and Exporter packages are available. Do not assume them.
- The existing app is the default Sencha template (Personnel model, store and list). Replace its demo content with PortfolioIQ screens under the existing `FinApp` namespace (already configured in `app.json`; do not rename it). Do not edit `ext-js/ext/`.
- Build the shell (viewport, sidebar navigation, header with portfolio selector and SIMULATED DATA / DEMO notice) using the MVC/MVVM conventions of the `extjs` skill.
- Configure the API base URL, shared Ajax behavior, JSON reader settings from `CLAUDE.md` §7.5, error handling and loading states.
- Define only the foundational models, stores and utilities needed for the first screen.
- Establish shared design tokens and scoped `.piq-*` styles per `CLAUDE.md` §9.
- Add a minimal API connectivity check and document the development commands.
- Any `sencha` build or refresh command is given to the user to run.

### Deliverables

- Launchable Modern app under `ext-js/`.
- Shell with navigation placeholders for the three screens.
- API connection configuration, shared data patterns and base styling.
- Frontend setup instructions, including the user-run Sencha commands.

### Acceptance criteria

- [ ] App starts using documented commands (user-run).
- [ ] App loads with no critical browser-console errors.
- [ ] App requests and displays or logs a safe sample API response (for example `/api/health`).
- [ ] Navigation switches between the three placeholder views.
- [ ] The shell uses the consistent visual system from `CLAUDE.md` §9.
- [ ] No Classic-only classes are used; no screen is implemented prematurely.

**Stop after Phase 2.** Request approval of the running shell.

---

## Phase 3 — Portfolio Dashboard (`CLAUDE.md` §3.1)

### Goal

Implement the Dashboard using real API responses rather than hard-coded values in the UI.

### Tasks

- Implement the portfolio selector, KPI cards, portfolio-value time-series chart with 1M/3M/6M/1Y/All ranges, sector allocation chart, top and bottom five holdings, and portfolio summary table.
- Map each data-bound element to an existing endpoint. If coverage is missing, propose and implement the smallest compliant API addition, with tests.
- Dashboard aggregates are loaded with `Ext.Ajax.request` or a ViewModel routine, not an array store.
- Implement the timer-driven refresh aligned with `/api/simulation/status`, with clean-up on destroy, plus loading, empty and error states.
- Show `Last simulated update: <asOf>` and the simulated-data disclosure.

### Deliverables

- Integrated Dashboard with documented data mappings and a short visual/functional review checklist.
- Supporting API changes, if needed, with tests.

### Acceptance criteria

- [ ] All listed Dashboard elements are present and use backend-calculated values.
- [ ] Portfolio and range changes update the relevant components.
- [ ] Empty, loading and error conditions are handled.
- [ ] No unrelated screen is implemented.

**Stop after Phase 3.** Obtain Dashboard approval before proceeding.

---

## Phase 4 — Holdings Explorer (`CLAUDE.md` §3.2)

### Goal

Implement the Holdings Explorer with Modern grid features, the company detail panel, transactions and the Trade Simulator.

### Tasks

- Build the `Ext.grid.Grid` with the specified fields, remote sort, filter and paging, and grouping with summaries.
- Implement the company detail panel (metadata, price chart, position summary, recent transactions).
- Implement the Buy/Sell dialog with `Ext.Dialog`, opened from an accessible button. Execution price always comes from the server.
- Implement the transactions view with its filters and paging.
- Implement export via the Exporter if installed, otherwise the documented CSV fallback.
- Refresh related stores after a trade while keeping selection, scroll and filters.
- Add minimal backend changes only where the specification requires them, with tests.

### Deliverables

- Complete Holdings Explorer connected to the API, with updated tests and documentation.

### Acceptance criteria

- [ ] Filter, sort, group, detail panel and transaction history work.
- [ ] BUY and SELL update cash, holdings and the Dashboard consistently; invalid orders are rejected.
- [ ] Export works (Exporter or CSV fallback).
- [ ] Loading, empty and error states are covered; the Dashboard remains intact.

**Stop after Phase 4.** Obtain approval before proceeding.

---

## Phase 5 — Portfolio Analytics (`CLAUDE.md` §3.3)

### Goal

Implement analytics, using the real Pivot Grid only if available and licensed, otherwise the labeled fallback.

### Tasks

- Verify Pivot availability in the installed SDK. If missing, build the functional grouped aggregation grid with the visible notice “Pivot Grid requires the applicable Sencha package/license.” and document how to enable the real one.
- Implement the sector exposure comparison chart and the normalized (start = 100) portfolio performance chart.
- Implement pivot export through the Exporter if available, otherwise the CSV fallback.
- Add tested backend extensions only if the documented functionality requires them.

### Deliverables

- Complete Analytics screen integrated with the backend, with updated tests and documentation.

### Acceptance criteria

- [ ] Pivot or the labeled fallback is functional; the comparison series starts at 100.
- [ ] Sector comparison and export work.
- [ ] Loading, empty and error states are covered; all three screens remain functional.

**Stop after Phase 5.** Request approval before final integration work.

---

## Phase 6 — Integration, QA and polish (spec Milestone 6)

### Goal

Deliver a cohesive, reliable application without expanding functional scope.

### Tasks

- Test navigation and shared workflows across all three screens, using the same snapshot `asOf` and `tickIndex`.
- Validate frontend/backend contracts, data consistency and calculation accuracy.
- Resolve layout, styling, state and interaction defects; verify tablet and desktop widths.
- Verify runtime persistence and restart behavior; run `demo:verify`.
- Review configuration, secrets handling and error handling.
- Complete `README.md` with the sections required by `CLAUDE.md` §13, the demo walkthrough and known limitations.
- Provide the final list of user-run commands and collect their results.

### Deliverables

- Integrated application and reproducible setup instructions.
- Test summary (executed vs. user-run), resolved issues and remaining limitations.
- Final acceptance checklist.

### Acceptance criteria

- [ ] Backend and frontend start with documented commands.
- [ ] The three screens operate against the same backend dataset.
- [ ] Essential flows work end to end; no known critical errors remain.
- [ ] Tests run and results are documented; failures are explained.
- [ ] Baseline fixtures are still protected from writes.
- [ ] README accurately describes setup, configuration and limitations.

**Stop after Phase 6.** Provide a final implementation summary for user acceptance.

---

## 5. Required completion report for each phase

```markdown
## Phase N — Completion Report

### Implemented
- ...

### Files created or modified
- `path/to/file` — reason

### Commands for the user to run
1. `command` — working directory, purpose, expected result

### Tests
| Command or check | Result | Notes |
|---|---|---|
| ... | PASS / FAIL / NOT RUN (user to run) | ... |

### Deviations, assumptions, and blockers
- ...

### Approval gate
Phase N is complete to the extent described above.
Waiting for explicit approval before starting Phase N+1.
```

## 6. First Claude Code instruction

Run Claude Code from the **project root** and give it this instruction:

```text
Read CLAUDE.md, IMPLEMENTATION_PLAN.md, the three skill files under
.claude/skills/, README.md and README_INSTALL.md, then the server/ and
ext-js/ directories.

First summarize the Phase 1 scope and list any conflicts between these
documents. Confirm which mockups in docs/mockups/ you can actually view;
CLAUDE.md takes precedence over them.

Then implement PHASE 1 — Backend foundation only. Follow the restrictions in
CLAUDE.md: never run npm, npx, sencha or git; give me the exact commands to
run instead. Do not modify fixtures or start frontend development.

Run only permitted direct node checks, provide the Phase completion report
marking anything not executed as NOT RUN, and stop for my explicit approval
before Phase 2.
```

## 7. Project progress

Update this table **only after the user approves a phase**.

| Phase | Status | Approval / notes |
|---|---|---|
| 1 — Backend foundation | Approved | Approved by the user; 54/54 backend tests and 10/10 `demo:verify` checks passed. See `docs/DECISIONS.md` and `docs/API.md`. |
| 2 — Ext JS foundation | Approved | Approved by the user after running the shell in the browser. (Pivot and Exporter were not installed then; they were added later, see Phase 5b.) See `docs/DECISIONS.md`. |
| 3 — Portfolio Dashboard | Approved | Approved by the user after running it in the browser; two layout fixes were applied (KPI row wrapper, performance chart fill). See `docs/DECISIONS.md`. |
| 4 — Holdings Explorer | Approved | Approved by the user after running it in the browser. Backend additions: `group`/`groupDir`, `query`, `meta.totals`/`meta.groups` (56/56 tests). See `docs/DECISIONS.md` and `docs/API.md`. |
| 5 — Portfolio Analytics | Approved | Approved by the user after running it (first with a labelled fallback grid; replaced afterwards by the real Pivot Grid and Exporter, see Phase 5b in `docs/DECISIONS.md`). Backend additions: `layout=wide` pivot with server subtotals, `/api/exports/pivot.csv` (59/59 tests). Fixed `keepRawData` on the shared proxy (also repaired Holdings totals and Dashboard axis fit). See `docs/DECISIONS.md`. |
| 6 — Integration and QA | Not started | — |

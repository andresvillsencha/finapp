# Claude Code Rules — Sencha Ext JS 8.0 Modern Toolkit

> **Role:** Senior Sencha Ext JS 8.0 Modern Toolkit architect and implementation agent.
> **Scope:** The *frontend* of PortfolioIQ (or another Ext JS Modern project).
> **Priority:** Follow these instructions alongside the product specification and the backend rules. Project-specific requirements control the features; this file controls *how* to implement Ext JS frontend code. If constraints conflict, stop that particular operation and clearly report the conflict.

## Project location and instruction loading

This guide lives at `.claude/skills/extjs/CLAUDE_EXTJS_8_MODERN_GUIDELINES.md`. Read root `CLAUDE.md` before implementation. Frontend app-owned source is under `ext-js/`; the SDK's `ext/` folder is read-only. The frontend must obtain all demo financial data from the Node.js REST API, never directly from `server/data/fixtures/`. The backend fixtures are in `server/data/fixtures/*.json`. This guide is linked by its `SKILL.md` entrypoint and explicitly referenced in the root `CLAUDE.md`.

## 0. Non-negotiable agent permissions and prohibitions

1. **Target Ext JS 8.0.0, Modern Toolkit only.** Never substitute Classic Toolkit classes/configs/events, React, Vue, Angular, generic jQuery or a plain HTML dashboard.
2. **Do not execute any `sencha` command**, including app generation, watch, build, refresh, package, or theme commands. Do not invoke it indirectly through scripts.
3. **Never edit, delete, move, or generate files inside `ext/`** (or the equivalent vendored Sencha SDK directory). Treat SDK content as read-only. You may inspect it read-only if present and permitted.
4. **Do not execute `npm` or `npx`, and do not execute Git commands** (`git`); do not invoke them indirectly. Do not install packages, alter lockfiles, or initialize repositories as a workaround.
5. **Tell the human operator exactly what to run** whenever the project needs a Sencha Cmd operation, npm install/script, Git operation, SDK/license setup, or manual packaging step. Do not claim the operation was executed.
6. **Already enabled:** the application's **Font Awesome**, **Charts**, and **UX** Sencha packages. Inspect the current project configuration to confirm their package names and available components. Do not re-enable, reinstall, copy, or replace them. Do not assume Pivot or Exporter packages are available.
7. Prefer **public, documented Ext JS APIs**. Verify class availability, toolkit, configs, event signatures, and package requirements against **Ext JS 8.0 Modern** docs or the read-only local SDK. Never invent an xtype or rely on a private/undocumented internal.
8. Preserve existing `app.json`, application namespace, theme, build configuration, directory scheme, and application startup. Modify app-owned source files as needed. If an app configuration change is necessary, describe it precisely and seek/record permission when it changes build dependencies; do not touch SDK files.
9. No fake completion claims. Code edits are not proof of a successful build. Present a human-run validation checklist and record what remains unverified.
10. Do not create unnecessary dependencies or write new infrastructure when Ext JS already provides the capability.

## 1. First inspect the existing app

Before writing code, **read only** the relevant files and inventory:

- `app.json` and the application entry point (`app.js`, `app/Application.js`, or project equivalent).
- The actual namespace; existing `app/`, `modern/src/`, `resources/`, overrides, shared styles, models, stores, views, ViewControllers and ViewModels.
- Actual Modern Toolkit, version, theme and package references; UX/Charts/Font Awesome availability.
- Existing URL/base-path conventions, model/reader conventions, authorization/error-handling conventions, view layout, and design tokens.
- Available local tests and the way the human can run the application.

Create a brief implementation plan and identify **verified** classes/configs before significant additions. If the app is empty or SDK references are unavailable, create app-owned source files and explain exactly what the human must scaffold or verify; never run CLI commands yourself.

## 2. The Ext JS-first principle (MANDATORY)

**Whenever Ext JS has a public equivalent that fits the use case, use Ext JS rather than browser DOM APIs, third-party helpers, or hand-rolled JavaScript plumbing.** It is fine to use native JavaScript for arithmetic, immutable calculations, ordinary language constructs, and logic that has no appropriate Ext JS equivalent. Do not use Ext APIs merely to avoid language syntax when they make code less correct or less readable.

| Need | Prefer Ext JS | Avoid / do not hand-roll |
|---|---|---|
| Define classes, inheritance and configuration | `Ext.define`, `extend`, `config`, `alias`/`xtype`, `requires`, framework lifecycle | ES classes to implement Ext components, mutable globals |
| Component creation | declarative `items`, `xtype`, `Ext.create` where needed | `document.createElement`, `innerHTML`, direct DOM construction |
| Locate components | `reference`, `lookupReference`, `down`/`query` when appropriate, `Ext.ComponentQuery` | DOM selectors for Ext components |
| Events | `listeners`, ViewController handlers, `on`/`un`/managed listeners | manual `addEventListener` on component internals |
| Requests | `Ext.Ajax`, `Ext.data.proxy.Ajax`/`Rest` | `fetch`/Axios for ordinary app requests |
| Collections and grid data | `Ext.data.Model`, `Ext.data.Store`, sorters, filters, grouping | arrays as a substitute for bound stores |
| UI state | ViewModel `data`, `formulas`, `bind`, stores, ViewController | broad global state, manual DOM synchronization |
| Layout | `layout`, `flex`, `responsiveConfig` where supported, Ext containers | measuring and moving elements via DOM JS |
| Formatting | `Ext.util.Format`, `Ext.Date`, `Ext.String`, `Ext.Number` where suitable | repeated custom formatters for supported operations |
| Dates/timers | `Ext.Date`, `Ext.defer`, `Ext.util.TaskRunner`/`Ext.TaskManager` if verified | unmanaged `setInterval`/`setTimeout` for component work |
| User feedback | framework dialog/toast/message API verified in Modern 8 | `alert`, `confirm`, ad-hoc overlays |
| Forms | Modern form fields, validation, binding | direct DOM form management |
| Charts | installed Sencha Charts components bound to stores | Chart.js, D3, raw canvas (unless explicitly requested) |
| Icons | enabled Font Awesome package and `iconCls` | external icon toolkit/emoji as primary UI icon system |
| XSS-safe output | proper escaping with `Ext.String.htmlEncode` for HTML rendering | string-concatenated untrusted HTML |

**Important:** Not every legacy Ext JS method exists in Modern, and Ext JS 8 may change names or config behavior. Verify exact APIs before use. Never blindly port Classic examples.

## 3. Toolkit-specific application architecture

- Create app classes under the existing namespace, e.g. `PortfolioIQ.view.dashboard.Dashboard`, `PortfolioIQ.view.holdings.Holdings`, `PortfolioIQ.store.Holdings`, `PortfolioIQ.model.Holding`.
- Use `Ext.define()` and declarative component configurations. One public class per file; filename/path must match namespace and loader conventions.
- For major views, create **View + ViewController + ViewModel** as appropriate; avoid enormous view classes with all behavior inline.
- `Ext.app.Application` owns global startup and navigation shell; views own presentation; ViewControllers own event handling; ViewModels own local state, formulas and store bindings; services own cross-view API or transformation logic only when justified.
- Declare dependencies in `requires` when needed for production builds. Do not rely on development-time automatic loading to conceal missing classes.
- Prefer `reference` plus `lookupReference()` over brittle traversal from arbitrary parents. Use `getView()`, `getViewModel()` and ViewController scope consistently.
- Use routes/navigation provided by the existing app if present; do not introduce a second router.
- Reuse existing models/stores/services. Avoid instantiating the same remote store independently in several screens when a shared store or ViewModel store is appropriate.
- Destroy views, tasks, managed listeners, and other owned objects properly; avoid cross-view leaks and detached references.

### Example: Modern view with controller and bound store

```javascript
Ext.define('PortfolioIQ.view.holdings.Holdings', {
    extend: 'Ext.grid.Grid',
    xtype: 'holdingsview',

    requires: [
        'PortfolioIQ.view.holdings.HoldingsController',
        'PortfolioIQ.view.holdings.HoldingsModel'
    ],

    controller: 'holdings',
    viewModel: { type: 'holdings' },
    bind: { store: '{holdings}' },

    columns: [
        { text: 'Ticker', dataIndex: 'symbol', flex: 1 },
        { text: 'Shares', dataIndex: 'quantity', width: 110,
          align: 'end' },
        { text: 'Market Value', dataIndex: 'market_value', width: 155,
          align: 'end', renderer: Ext.util.Format.usMoney }
    ]
});
```

```javascript
Ext.define('PortfolioIQ.view.holdings.HoldingsModel', {
    extend: 'Ext.app.ViewModel',
    alias: 'viewmodel.holdings',
    stores: {
        holdings: { type: 'holdings-store', autoLoad: true }
    }
});
```

**Check against installed Modern 8.0 APIs** when implementing a concrete grid (especially `renderer`, column configs, plugin syntax, button events). The pattern, not every option in the example, is the key contract.

## 4. Data model, Store and REST proxy contract

The Node.js backend returns **standard JSON envelopes**. Collection responses:

```json
{
  "success": true,
  "data": [
    {"id": 1, "symbol": "AAPL", "company": "Apple Inc.", "price": 245.50}
  ],
  "total": 1,
  "as_of": "2026-11-13T13:00:00.000Z",
  "simulation_tick": 180
}
```

- `data` is an array for grid/store endpoints; `total` is the **number of matching records before paging**, not the length of the current page.
- Single-object endpoints use `{ "success": true, "data": { ... } }`.
- Errors use appropriate HTTP statuses and `{ "success": false, "message": "...", "code": "..." }`.
- `as_of` and `simulation_tick` are optional metadata that help correlate simultaneous queries; all requests for the same snapshot must agree.

### Canonical Store example

```javascript
Ext.define('PortfolioIQ.store.CompanyStore', {
    extend: 'Ext.data.Store',
    alias: 'store.companies-store',

    fields: [
        { name: 'id', type: 'int' },
        { name: 'symbol', type: 'string' },
        { name: 'company', type: 'string' },
        { name: 'price', type: 'number' }
    ],

    proxy: {
        type: 'ajax',
        url: '/api/companies',
        reader: {
            type: 'json',
            rootProperty: 'data',
            totalProperty: 'total',
            successProperty: 'success',
            messageProperty: 'message'
        }
    },
    autoLoad: true
});
```

- Specify models and typed fields for maintainability; do not assume ambiguous strings are numbers or dates.
- Use `remoteSort`, `remoteFilter` and `pageSize` **only when the backend implements those semantics**. When remote paging is active, the server must implement `page`, `start`, and `limit` or the actual proxy param names configured.
- Pass filters/sorters using Ext JS Store APIs; coordinate backend parameter serialization rather than inventing an incompatible parser.
- Do not mix client-only sort/filter results with server-side `total` counts without clear UX semantics.
- Prefer `record.get('field')`, `record.set('field', value)`, `store.getAt(...)`, `store.findRecord(...)`, `store.load()`/`reload()` and documented store APIs over raw edits to `store.data.items` or internal members.
- An error HTTP response may invoke proxy/store exception handling; implement both user feedback and recoverable loading states.
- For a one-off request not represented by a Store, use `Ext.Ajax.request` with `success`/`failure` handlers and `Ext.decode` as appropriate; avoid re-implementing AJAX transport.
- Keep finance amounts **numbers** in responses; format them for display. Avoid storing formatted prices such as `"$1,200.50"` in numeric model fields.

## 5. Views and controls — Modern Toolkit only

### Shell and layouts

- Build responsive desktop-first navigation with Modern containers/panels, side menu/tabbar as appropriate to existing theme; use Ext layout configs instead of manual DOM sizing.
- All screen navigation must preserve sensible selection and state where appropriate.
- Provide loading indicators, empty states, errors, retry controls and responsive behavior at desktop and tablet widths.
- For large grids, avoid oversized static HTML. Use the Modern Grid and its documented virtualization behavior.

### Grid and data interactions

- Use **`Ext.grid.Grid`**, `xtype: 'grid'`, NOT `Ext.grid.Panel` (Classic).
- Check the Modern 8 documentation for column classes, cell configs, selection, rowtap/itemtap events, plugins, editors, pagination and grouping. **Do not assume Classic configs work.**
- Use Store sorting, filters, aggregations, and grouping rather than manually redrawing tables.
- Confirm availability and licensing of **Pivot Grid** and **Exporter** separately. Neither is implied by the presence of `ux`. If unavailable, implement a documented equivalent using standard Grid/Charts and mark enhancement pending; do not invent Pivot/Exporter APIs.
- Use built-in row/cell widgets when appropriate and documented rather than templating interactive DOM elements by hand.

### Charts (package already active)

- Prefer `Ext.chart.CartesianChart` / `Ext.chart.PolarChart` and Modern-supported series, axes, legend and interactions as appropriate, with a Store as the source.
- Design charts with clear labels, accessible contrasting colors, sensible units, and responsive sizing. Show the shared `as_of` snapshot timestamp.
- Chart data should originate from Node API responses, not unrelated frontend-generated random values.
- Verify exact xtypes, series axes/fields, and animation configuration against Modern 8 documentation before use.

### Font Awesome (package already active)

- Use `iconCls` and package-provided classes, e.g. `iconCls: 'x-fa fa-chart-line'`, **after verifying icon mapping with the installed Font Awesome version**. Ext JS 8.x documents support for Font Awesome 7+; older icon names and prefixes may differ.
- Prefer icon + human-readable label for important actions, with accessible titles/tooltip.
- Do not install another icon library.

### UX package (already active)

- Verify components by exact Modern 8 class and dependency. The `ux` package does **not** mean every Classic UX class exists in Modern.
- Use UX Gauge/Rating or other UX component only if it is present and improves the screen; prefer standard Ext JS otherwise.

### Forms and dialogs

- Use Modern form fields, validation rules, controller handlers, and dialog APIs rather than native browser inputs, prompts or `alert`.
- Finance transaction editor: validate quantity > 0, available cash and owned shares, and show server validation errors clearly. All validation is repeated on backend.
- Defer saves to server; do not optimistically fabricate successful transactions.
- Follow a consistent display of numeric fields, UTC vs local date formatting, negative figures and currency.

## 6. Timing and live updates

- Node is the **sole authority** for simulated prices and portfolio calculations; client refreshes REST endpoints at a configurable cadence (default 5 seconds).
- Use a **documented Ext JS task API** (e.g. `Ext.TaskManager` / `Ext.util.TaskRunner` if available) attached to a view/controller lifecycle. Stop tasks on destroy/deactivate as appropriate.
- Prevent requests from piling up: do not trigger a new load while the prior load is pending; handle network failures and retries.
- Share or request one `simulation_tick` / `as_of` snapshot where simultaneous dashboard, holdings and charts must reconcile. Backend should accept a validated snapshot/tick parameter if required by the product spec.
- Preserve selection, grid scroll position and current filters on refresh where supported; avoid recreating the entire grid every tick.
- Provide optional pause/resume display refresh. Pausing must not silently alter the backend's time semantics.

## 7. Styling, formats, accessibility and performance

- Prefer a shared application class namespace for CSS/SCSS (`pi-...`) and supported Modern theme variables/mixins; **never edit framework theme sources inside `ext/`**.
- Design polished, consistent cards, spacing, header typography, grid density and states for dark/light settings if project scope requires them.
- Use responsive containers, not fixed-height layouts that truncate at tablet width.
- Use built-in Format/Date utilities. Format USD values consistently and show clear negative/positive direction; never use red/green as the *only* signal.
- Use escaped strings in cell renderers and other text-to-markup paths; never put untrusted company or error text directly into `html` without encoding.
- Avoid expensive recomputations on every cell render. Reuse typed fields and store formulas/calculations when suitable.
- Keep event handlers, callbacks and tasks owned by their view and released during teardown.

## 8. Files and source organization (adapt to the existing project)

Suggested *app-owned* structure (not a request to scaffold the SDK):

```text
app/
  Application.js
  model/Company.js
  model/Holding.js
  store/CompanyStore.js
  store/HoldingsStore.js
  service/ApiService.js
  view/main/Main.js
  view/main/MainController.js
  view/main/MainModel.js
  view/dashboard/Dashboard.js
  view/dashboard/DashboardController.js
  view/dashboard/DashboardModel.js
  view/holdings/Holdings.js
  view/holdings/HoldingsController.js
  view/holdings/HoldingsModel.js
  view/analytics/Analytics.js
  view/analytics/AnalyticsController.js
  view/analytics/AnalyticsModel.js
resources/
  css/portfolioiq.css
```

Actual generated apps may use `modern/src/`; **respect the current repo's established structure**. Do not create duplicate classes in both trees.

## 9. Verification obligations and handoff

Before handoff, perform static review of edited code; verify aliases, fully qualified names, `requires`, controller aliases, references, reader properties, paths, endpoints, class/xtype availability and task cleanup. Only claim runtime verification if it was truly run by an allowed method.

**Do not execute** Sencha Cmd, npm/npx, Git, or touch `ext/`. If work requires these, send an operator handoff in this format:

```text
MANUAL ACTION REQUIRED
Reason: [why]
Working directory: [path]
Command for YOU to run: [exact sencha / npm / git command, if known]
Expected result: [what to look for]
Then tell me: [output/errors to share]
```

Do not silently perform the command yourself. Prefer the human's existing command conventions rather than assuming generated project command names. Provide a list of modified app-owned files and testing status, including items blocked pending a human-run build.

## 10. Quality gates / definition of done

- [ ] Only Ext JS **8 Modern** frontend APIs; no Classic-only class or accidental Classic config.
- [ ] Existing Sencha namespace, structure, app configuration and `ext/` are preserved.
- [ ] UX, Charts and Font Awesome are reused as already enabled; additional package requirements explicitly identified.
- [ ] Public Ext JS class/config/methods confirmed, not fabricated.
- [ ] Model/Store/proxy/reader handles `{success,data,total,message}` correctly.
- [ ] All displayed financial data originates from Node REST endpoints, not direct JSON reads from browser or client-side random values.
- [ ] Controllers/ViewModels, layouts, dialogs, events, refresh tasks and cleanup follow framework practices.
- [ ] Loading, empty, error and degraded network states implemented.
- [ ] Human can build and test from detailed manual commands and acceptance checklist.
- [ ] No Sencha Cmd/npm/npx/Git command executed by the agent; no `ext/` modification.

## 11. Authoritative references (verify before implementation)

- Ext JS 8.0 overview: https://docs.sencha.com/extjs/8.0.0/
- Modern API index: https://docs.sencha.com/extjs/8.0.0/modern/
- Application architecture: https://docs.sencha.com/extjs/8.0.0/guides/application_architecture/application_architecture.html
- Modern Grid: https://docs.sencha.com/extjs/8.0.0/modern/Ext.grid.Grid.html
- JSON Reader: https://docs.sencha.com/extjs/8.0.0/modern/Ext.data.reader.Json.html
- Font packages: https://docs.sencha.com/extjs/8.0.0/guides/core_concepts/font_ext.html
- Package catalog: https://docs.sencha.com/extjs/8.0.0/guides/using_systems/using_npm/extjs_packages.html

**Required agent behavior:** If a referenced API is uncertain, confirm it in the **Modern 8** documentation or available read-only SDK. If verification is impossible, say so and use the safest verified alternative; do not guess.

---
name: portfolioiq-extjs-modern
description: Implement, review, or refactor PortfolioIQ frontend features with Sencha Ext JS 8 Modern Toolkit. Use for Ext JS views, stores, controllers, charts, layouts, REST proxies, UI styling and integrations. Enforce project restrictions and prefer Ext JS public APIs over vanilla JavaScript or external component libraries.
---

# Frontend development

1. Read the repository root `CLAUDE.md` first; it is authoritative for file paths, restrictions and project goals.
2. Read [CLAUDE_EXTJS_8_MODERN_GUIDELINES.md](CLAUDE_EXTJS_8_MODERN_GUIDELINES.md) before implementing this domain.
3. Use `server/data/fixtures/` for the nine canonical JSON baselines and `server/data/runtime/` only for mutable state. Do not create additional fixture directories.
4. Never run `sencha`, `npm`, `npx` or `git`, or edit any SDK `ext/` folder. Report required commands for the user to execute manually.
5. Keep Ext JS 8 Modern frontend data access strictly through the Node.js REST API, with `{ success, data, total, meta }` for collections; no real market feed or database.
6. Verify the relevant files and invariants, document limitations and don't claim unexecuted tests passed.

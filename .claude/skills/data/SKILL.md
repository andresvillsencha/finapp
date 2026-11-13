---
name: portfolioiq-demo-data
description: Extend, validate, or use PortfolioIQ JSON fixtures, simulated market scenarios, sample portfolios, benchmark/watchlist/event datasets and deterministic historical price series. Use for JSON seed data changes and cross-screen simulation consistency.
---

# Demo data and simulation

1. Read the repository root `CLAUDE.md` first; it is authoritative for file paths, restrictions and project goals.
2. Read [CLAUDE_DATA_EXPANSION.md](CLAUDE_DATA_EXPANSION.md) before implementing this domain.
3. Use `server/data/fixtures/` for the nine canonical JSON baselines and `server/data/runtime/` only for mutable state. Do not create additional fixture directories.
4. Never run `sencha`, `npm`, `npx` or `git`, or edit any SDK `ext/` folder. Report required commands for the user to execute manually.
5. Keep Ext JS 8 Modern frontend data access strictly through the Node.js REST API, with `{ success, data, total, meta }` for collections; no real market feed or database.
6. Verify the relevant files and invariants, document limitations and don't claim unexecuted tests passed.

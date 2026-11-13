---
name: portfolioiq-node-json
description: Implement, review, or debug the PortfolioIQ Node.js Express backend, JSON fixture repository, REST contracts, financial calculations, transaction persistence, and simulated price feeds. Use for backend code and API work with server/data/fixtures and server/data/runtime; no databases.
---

# Backend development

1. Read the repository root `CLAUDE.md` first; it is authoritative for file paths, restrictions and project goals.
2. Read [CLAUDE_NODEJS_JSON_BACKEND_GUIDELINES.md](CLAUDE_NODEJS_JSON_BACKEND_GUIDELINES.md) before implementing this domain.
3. Use `server/data/fixtures/` for the nine canonical JSON baselines and `server/data/runtime/` only for mutable state. Do not create additional fixture directories.
4. Never run `sencha`, `npm`, `npx` or `git`, or edit any SDK `ext/` folder. Report required commands for the user to execute manually.
5. Keep Ext JS 8 Modern frontend data access strictly through the Node.js REST API, with `{ success, data, total, meta }` for collections; no real market feed or database.
6. Verify the relevant files and invariants, document limitations and don't claim unexecuted tests passed.

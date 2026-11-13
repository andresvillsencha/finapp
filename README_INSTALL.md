# Install PortfolioIQ Claude Code instructions

Extract this package into `finapp/` preserving paths. Replace `CLAUDE.md` and the three skill directories under `.claude/skills/`.


Create `server/data/runtime/` if needed and ignore its contents via `.gitignore`; do not delete runtime data automatically at startup.

Launch Claude Code from the `finapp/` root and ask it to read `CLAUDE.md` and the skill entrypoints. It must not run Sencha Cmd, npm, npx or Git and must not edit the Sencha SDK `ext/` folder.

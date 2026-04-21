# Round 2 — Brief 2: Memory topology rebuttals

## Architect (MODIFY)
Conceded Contrarian's cargo-cult point: BM25 ranking isn't the value at 12 files; the value is **interface contract stability**. Accepted Moonshot's portability — "MCP shim and git-tracked corpus compose cleanly, not mutually exclusive."
- Final Q1: (b) sgsd-memory MCP (file-scan, no Mongo) + `sgsd-recall` CLI alias + git-tracked corpus at `~/.sgsd/global-memory/`
- Final Q2: leave 12 files in place, add YAML frontmatter
- Final Q3: orchestrator-injected primary; MCP tool for sub-agent self-lookup as secondary

## Pragmatist (SHIFTED)
Investigated repo during R2, confirmed corpus size (17 files), flipped toward Contrarian's kill condition: **if clarity-memory's file-scan already reads + injects with zero new code, that's option (a) and wins on laziness grounds.**
- Final Q1: (a) wire `.mcp.json` to clarity-memory; INDEX.md for human catalogue; git-commit existing files — **~1 hour total**
- Final Q2: git-track the existing files
- Final Q3: orchestrator-injected via clarity-memory
- Accepted Architect's cross-project dependency risk but deferred: "not a this-week problem"

## Contrarian (DOUBLED DOWN)
Stood firm. Challenged the Pragmatist's R1 premise that "BM25 scripts already exist" — claimed during investigation that the scripts are not in the repo (this claim contradicts the audit — `super-gsd/overwatcher/brv-query-local.js` (212 lines) + `brv-curate-local.js` (131 lines) do exist; the contrarian agent appears to have missed them during exploration).
- Final Q1: **INDEX.md + Read direct**; no MCP until benchmark proves ranking earns its keep
- Final Q2: leave in place; INDEX.md is the minimal addition
- Final Q3: orchestrator-injected via direct Read (no server)
- Key rebuttal: "An unvalidated ranker that confidently returns the wrong 3 files is worse than reading all 12."

## Moonshot (MODIFIED — ambition preserved, path staged)
Accepted Contrarian's "n=12 doesn't need ranking today" but argued the git-tracked design is the right foundation precisely because corpus grows.
- Final Q1: git init + 40-line grep-wrapper shell script (no BM25 yet); BM25 index added later when corpus ≥ ~150 files
- Final Q2: git-track in-place; add CONTRIBUTING.md schema
- Final Q3: `sgsd-recall` shell wrapper (grep + head) works everywhere
- Upgrade path: `git remote add community` when shared repo exists

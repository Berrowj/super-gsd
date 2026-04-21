# Round 1 — Brief 2: Memory topology

## Architect
- Q1: (b) clone `sgsd-memory` MCP, file-scan over `.brv/context-tree/`, no Mongo
- Q2: leave 12 files in place, point MCP at them
- Q3: orchestrator-injected via `mcp__sgsd_memory__query`
- Key arg: **replaceability without cascade** — clarity's devcp availability must not become a transitive SGSD dependency

## Pragmatist
- Q1: (b) same as architect; a FastMCP shim over existing BM25 scripts ships in ~4.25h
- Q2: leave in place
- Q3: orchestrator-injected
- Key arg: **BM25 scripts already exist** in `super-gsd/overwatcher/`, nothing calls them; wrap + rewire 8 callsites

## Contrarian
- Q1: option (d) — NO MCP; write INDEX.md; agents Read files directly
- Q2: leave in place; INDEX.md is the catalogue
- Q3: **the framing is wrong** — the bottleneck is prompt composition, not retrieval interface
- Key arg: **BM25 ranking over 12 files is cargo cult.** No benchmark has proven ranking outperforms "read all 12."
- Open challenge: run 5 representative queries against both approaches before deciding

## Moonshot
- Q1: git-tracked flat files at `~/.sgsd/global-memory/` + BM25 index rebuilt on commit + `sgsd-recall` shell CLI
- Q2: promote the 12 files in place with frontmatter tags
- Q3: single shell command callable from MCP/CLI/sub-agent alike — not coupled to a running server
- Key arg: **memory tier is a versioned artefact you ship, not infra you host** — path to shared knowledge across all SGSD installs

---
type: deliberation-memo
date: 2026-04-19
brief: .planning/briefs/2026-04-19-memory-topology.md
board: [architect, pragmatist, contrarian, moonshot]
rounds: 2
vote: "3-1 — Contrarian + Moonshot + Architect-concession for no-MCP-today; Pragmatist dissent (cross-project clarity-memory reuse)"
decision: "Ship git-native filesystem tier with INDEX.md + sgsd-recall shell wrapper; remove dead brv MCP; revisit ranking infrastructure only when corpus ≥40 files or a benchmark proves grep insufficient."
---

# DLB-01: Memory Topology

## Recommendation

Ship a **git-native filesystem memory tier** as the SGSD-global layer. No new MCP server today. No cross-project extension of clarity-memory. No BM25 ranking infrastructure until measured need. The 12 curated files in `.brv/context-tree/` stay in place as the authoritative seed corpus; a new `INDEX.md` catalogues them; a thin `sgsd-recall` wrapper gives a stable callable name over grep. The orchestrator injects retrieved content at prompt-composition time. This ships in ~1 hour and preserves every upgrade path the board considered (MCP shim, Mongo backing, shared community repo) without committing to any of them prematurely.

## Board Stances

| Agent | Final Position | Key Argument |
|---|---|---|
| Architect | MCP shim (file-scan) + CLI alias + git-tracked corpus | Interface contract stability across 8 call-sites survives corpus growth and project expansion |
| Pragmatist | Wire clarity-memory cross-project via `.mcp.json` + INDEX.md + git-commit | 1-hour ship; kill condition validated ("if file-scan already works, option a wins on laziness") |
| Contrarian | INDEX.md + direct Read; no MCP | BM25 ranking at n=12 is cargo cult; unvalidated ranker worse than "read all" |
| Moonshot | git init + 40-line grep wrapper; BM25 added when corpus earns it; upgrade via `git remote add` to shared repo | Memory tier is a versioned artefact you ship, not infra you host |

Components with unanimous agreement (4/4):
- Leave the 12 files in place
- Git-track the context-tree
- Orchestrator-injected retrieval at prompt composition
- No BM25 ranking built today

Component with split (2/2 MCP-or-not): resolved by CEO against MCP because the two FOR-MCP votes proposed incompatible implementations (new sgsd-memory vs cross-project clarity-memory), while the NO-MCP side had a coherent joint recommendation. The Architect's "stable interface name" concern is addressed by the `sgsd-recall` shell wrapper rather than by a tool server.

## Unresolved Tensions

1. **Interface vs corpus-size-first.** Architect was genuinely correct that 8 call-sites need a stable name; Contrarian was genuinely correct that ranking infra is unjustified at this scale. Resolved via `sgsd-recall` — a shell wrapper gives the stable name without the server.
2. **Cross-project memory (Pragmatist R2)** — clarity-memory reuse is the cheapest possible path today but creates a dependency (GSDedits sessions break if clarity's devcp is down). Deferred rather than adopted. Pragmatist's own acknowledgement of the dependency risk justifies deferral.
3. **Corpus ceiling** — grep + INDEX.md degrades at scale. Tripwire set at 40 files; Moonshot's git-remote shared-repo vision is the upgrade path.

## Trade-offs Accepted

- **No ranking today.** Retrieval quality depends on INDEX.md curation discipline. Acceptable at 12–40 file scale.
- **No shared memory across projects.** Each SGSD install has its own local context-tree; cross-project wisdom emerges only if users opt into a shared git remote. clarity-memory remains project-local to clarity for domain knowledge.
- **Rewrite work across 8 skill files.** `brv-query` / `brv-curate` call-sites must be replaced with `sgsd-recall` or direct Read. Real work, not free.
- **Interface name (`sgsd-recall`) is a shell wrapper not a tool server.** Agents inside Claude Code sessions cannot call it as an MCP tool; the orchestrator invokes it during prompt composition and injects results as plain text.

## Risks Acknowledged

- **Corpus growth outpaces design.** If MUDA audits and intent-continuity artefacts land faster than expected, the 40-file tripwire may trigger within weeks. *Mitigation:* document the threshold explicitly in the implementation; re-open this deliberation when crossed.
- **INDEX.md maintenance drift.** If agents curate new files but forget to update INDEX.md, retrieval silently degrades. *Mitigation:* the `sgsd-curate` counterpart (not `brv-curate`) must atomically update INDEX.md; add a git pre-commit hook that fails if a `.brv/context-tree/*.md` was added without an INDEX.md edit.
- **Pragmatist's unvalidated claim about BM25 script existence.** During R2 the Contrarian disputed that the Phase 2 BM25 scripts exist in the repo. Independent audit confirms `super-gsd/overwatcher/brv-query-local.js` (212 lines) and `brv-curate-local.js` (131 lines) DO exist. The Contrarian agent appears to have missed them during exploration. The scripts remain available for future integration when ranking is benchmarked and earned.
- **Stable interface name via shell wrapper has platform limits.** `sgsd-recall` as a shell command works on macOS/Linux/WSL; pure Windows CMD calls need a `.ps1` or `.bat` equivalent. *Mitigation:* ship both a bash script and a PowerShell wrapper.

## Next Actions

- [ ] Remove dead `brv` entry from `GSDedits/.mcp.json` — it silently masks the gap
- [ ] Write `.brv/context-tree/INDEX.md` — one line per file (topic, filename, ≤10-word summary)
- [ ] Ship `super-gsd/scripts/sgsd-recall.sh` + `sgsd-recall.ps1` — thin wrappers over grep + Read that return top-3 matching file contents
- [ ] Rewire 8 `brv-query` / `brv-curate` call-sites in CLAUDE-OVERLAY.md and agent specs to `sgsd-recall` / direct Write
- [ ] Add a `sgsd-curate` equivalent that both Writes the new .md AND updates INDEX.md atomically
- [ ] Confirm `.brv/context-tree/` is git-tracked (it is; verify no `.gitignore` exclusion)
- [ ] Document the 40-file threshold + benchmark plan for BM25 re-evaluation
- [ ] Preserve `super-gsd/overwatcher/brv-query-local.js` — becomes the future backend when ranking is earned
- [ ] Update the MUDA + intent-continuity briefs to depend on this resolved topology

## Deliberation Metadata

- Agents: Architect, Pragmatist, Contrarian, Moonshot (all Sonnet)
- Rounds: 2
- Estimated cost: ~106k tokens across both rounds
- Phases affected: 8 (every skill that references brv-query/brv-curate today + every future skill)
- Blocks: Brief 1 (MUDA learning loop) and Brief 3 (intent continuity) both depend on this resolution

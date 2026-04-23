---
phase: 14
phase_name: Codex CLI Provider Substrate
vtp_mode: BYPASSED
bypass_reason: phase-14-is-vtp-agnostic-by-design
created: 2026-04-23
updated: 2026-04-23
---

## 2026-04-23 addendum — vtp-kb tooling bug FIXED upstream

Codex (OpenAI CLI) fixed the `process.cwd()` root-resolution bug in the Voice-Text-Plan repo on 2026-04-23, after Phase-14 research/planning/verification had completed on the degraded path. The fix:

- Adds `src/mcp/project-root.ts` exporting `MCP_PROJECT_ROOT = path.resolve(MODULE_DIR, "..", "..")`.
- Swaps `process.cwd()` → `MCP_PROJECT_ROOT` across all 4 affected MCP tool files (broader than the substrate.ts we spotted: also research.ts, intent-routing.ts, service-enrichment.ts).
- `npm run build` passes; `rg "process\.cwd\(\)" src/mcp -n` returns 0 matches after the fix.

Verified from GSDedits: `mcp__vtp-kb__vtp_list_projects` and `mcp__vtp-kb__vtp_search` now return clean semantic results (no ENOENT) — the server loads `kb-data/` from the VTP repo regardless of caller cwd.

**Phase 14's bypass stands unchanged.** The second reason in the original write-up (tooling bug) is now moot, but the first reason (VTP-agnostic-by-design per D-11/D-24) was always the load-bearing one. Phase 14 still ships substrate-only / zero-behaviour-change. The only downstream change from this fix is: Phase 15 onward CAN consume VTP without a tooling detour — which was always the plan.

**Phase 15 prerequisite (task #6) is resolved.** No action needed in this repo — the fix lives upstream in Voice-Text-Plan.

---

## Original bypass record (retained for audit trail)


# Phase 14 — VTP Evidence (Degraded Path)

## Status: BYPASSED — intentional, documented, Phase-15-gated

Phase 14 does **not** consume VTP evidence. This file is a **degraded-path stub** so the standard dispatch loop (researcher/pattern-mapper/planner/checker — all instructed to read `VTP-EVIDENCE.md`) finds a well-formed artifact instead of choking on its absence.

## Why Phase 14 bypasses VTP

Two independent reasons, either one sufficient:

### 1. Phase 14 is VTP-agnostic by design (load-bearing)

Per `14-CONTEXT.md`:

- **D-11 / D-11a** — Phase 14 ships **pure substrate, zero behaviour change**. The orchestrator `SKILL.md` dispatch points (Step 6.5 / 9.5 / 9.6) are explicitly NOT modified. Collapsing live routing into Phase 14 would reintroduce the Phase-147 silent-drift failure mode.
- **D-24** — explicit deferred-scope entry: *"VTP evidence consumption by Codex reviewer (post-Phase-16 integration) — Deferred to Phase 15 — Phase 14 explicitly ships substrate-only / zero-behaviour-change (per D-11/D-24), and forward-compatible VTP wiring now would pre-commit Phase 15's live-routing design without real routing pressure to pick the right shape. Phase-14 ships VTP-agnostic; Phase 16's primitive is available if/when Phase 15 wants it."*
- **Phase-16 integration note** (14-CONTEXT.md line 7): *"Phase 14 is substrate-only, ships dark — it does NOT consume VTP evidence. The question of whether sgsd-codex-reviewer reads VTP-EVIDENCE.md before running a review is a Phase 15 decision."*

So even if the VTP primitive were fully operational, Phase 14 would not route any dispatch through it. Phase 14 delivers the wrapper, registry, agent stub, config block, and contract-check harness — no production dispatch path is rewired.

### 2. vtp-kb MCP tooling bug blocks the run anyway

Independent of the above, the vtp-kb MCP server has a `process.cwd()` resolution bug at `Voice-Text-Plan/src/mcp/tools/substrate.ts:8`:

```typescript
const PROJECT_ROOT = process.cwd();
const SUBSTRATE_DIR = path.join(PROJECT_ROOT, "kb-data", "substrate");
```

When Claude Code spawns the MCP server, `process.cwd()` resolves to the **caller's** directory (GSDedits) rather than the Voice-Text-Plan install dir, despite the `.mcp.json` `cwd` field being set correctly. Commit `e72d661 fix(mcp): set cwd for vtp-kb server` attempted to fix this via `.mcp.json` but the setting is not honoured at module-load time.

Attempted call on 2026-04-23:
```
mcp__vtp-kb__vtp_route_and_retrieve(raw_query=..., context=...)
→ Error: ENOENT: no such file or directory, open 'C:\Users\jack.berrow\GSDedits\kb-data\substrate\chunks.jsonl'
```

Expected resolution path: `C:\Users\jack.berrow\Voice-Text-Plan\kb-data\substrate\chunks.jsonl` (exists).

**Proper fix** (for Voice-Text-Plan, not this project): replace `process.cwd()` with script-location-based resolution using `fileURLToPath(import.meta.url)` + `dirname()` to derive project root from the installed entry point. Rebuild dist, verify.

## Phase 15 prerequisites

Before any Phase-15 dispatch consumes VTP evidence:

1. **FIX vtp-kb root resolution** in `Voice-Text-Plan` (not this repo). Replace `process.cwd()` with script-relative resolution. Rebuild, verify by calling any `mcp__vtp-kb__*` tool from GSDedits.
2. **RE-EVALUATE** whether `sgsd-codex-reviewer` should consume `VTP-EVIDENCE.md` during Phase 15 discuss — there is a deferred entry in `14-CONTEXT.md` (line 269) specifically about this: options are `--vtp-evidence` arg on `codex-exec.sh`, `vtp_consumes:` field on `review-providers.yaml`, or no consumption at all.
3. **WRITE** real `15-VTP-EVIDENCE.md` with routed retrieval output — the full `selected_query` + top-3 doc-IDs + evidence bundle that Phase 15 research/planning/verification will consume.

## What the dispatch chain should do given this file

Researcher, pattern-mapper, planner, and plan-checker for Phase 14 should:

- Read this file.
- Observe `vtp_mode: BYPASSED`.
- **Not** attempt to call any `mcp__vtp-kb__*` tool.
- **Not** cite any evidence_id or doc-ID in their artifacts (there is none).
- Proceed using: `14-CONTEXT.md`, `14-DISCUSSION-LOG.md`, `BRIEF.md`, and codebase evidence gathered via `Read`/`Grep`/`Glob` per the standard research protocol.

## Evidence lineage (authoritative sources used instead of VTP)

Since VTP is bypassed, Phase-14 dispatches draw evidence directly from:

- **Locked decisions**: `.planning/milestones/v1.3/phases/14-codex-cli-provider-substrate/14-CONTEXT.md` (D-01..D-24)
- **Discussion log**: `.planning/milestones/v1.3/phases/14-codex-cli-provider-substrate/14-DISCUSSION-LOG.md`
- **Milestone brief**: `.planning/milestones/v1.3/BRIEF.md`
- **Canonical refs block** (14-CONTEXT.md lines 36-49) — 9 pre-cited codebase paths that are the primary evidence sources for Phase 14 research.

All four dispatches are expected to cite these sources explicitly, matching the spirit of the VTP feedback rule (*"agents must use their tools with doc-ID citations; silent bypass regresses the primitive"*) in a degraded-but-traceable form.

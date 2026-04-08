# Architecture Patterns: Super GSD — GSD 1.0 Integration

**Domain:** Autonomous orchestrator layered on top of GSD 1.0
**Researched:** 2026-04-08
**Confidence:** HIGH (all findings from direct source inspection)

---

## Integration Seams

### Seam 1: State Layer (READ-ONLY from orchestrator)
`gsd-tools.cjs state *` commands are the single interface to STATE.md.
The orchestrator MUST use these commands — not raw file writes — to read/update state.
Key commands: `state load`, `state json`, `state patch`, `state begin-phase`, `state snapshot`.
These already support the orchestrator's frontmatter-only read pattern (offset 0, limit 30).

**Verdict: Layer on top. No modification to gsd-tools.cjs needed.**

### Seam 2: Commit Pipeline (DELEGATE to gsd-tools.cjs)
`gsd-tools.cjs commit <msg> --files f1 f2` already handles `commit_docs`, gitignore auto-detection,
and sub-repo routing. The orchestrator loop's "12. GIT COMMIT" step should call this directly.
`commit-to-subrepo` is available for ByteRover's `.brv/` sub-repo.

**Verdict: Layer on top. Orchestrator calls the existing CLI.**

### Seam 3: Model Routing (READ model-profiles.cjs)
`gsd-tools.cjs resolve-model <agent-type>` exposes the `MODEL_PROFILES` map via CLI.
The orchestrator's classifier feeds into this — Haiku for classify, result feeds `resolve-model`
for dispatch. New agents (gsd-classifier, gsd-context-selector) need entries added to
`MODEL_PROFILES` in `model-profiles.cjs`.

**Verdict: MODIFY model-profiles.cjs to add 2 new agent types.**

### Seam 4: Agent Registry (MODIFY agent-contracts.md)
The agent contracts reference defines completion markers. The orchestrator's structured report
format (`FILES_CHANGED | VERIFICATION | DEVIATIONS | BLOCKERS | SCRIPTS_CREATED | ONE_LINER`)
is a new contract that must be added for all orchestrator-dispatched agents.

**Verdict: MODIFY `references/agent-contracts.md` to add orchestrator report contract.**

### Seam 5: Config (EXTEND config.cjs)
The orchestrator needs new config keys: `orchestrator.enabled`, `orchestrator.max_loop_iterations`,
`orchestrator.token_budget_per_loop`. These fit the existing `VALID_CONFIG_KEYS` pattern in
`config.cjs` and the `workflow.*` namespace convention.

**Verdict: MODIFY config.cjs to add orchestrator namespace keys.**

### Seam 6: Checkpoint File (NEW — no conflict)
`ORCHESTRATOR-CHECKPOINT.md` in `.planning/` is a net-new file not touched by GSD 1.0 workflows.
`gsd-tools.cjs verify-path-exists` can check for it on cold start.

**Verdict: New file, no modification needed.**

### Seam 7: Token Log (NEW — no conflict)
`.planning/metrics/token-log.jsonl` is net-new. `gsd-tools.cjs` has no metrics commands yet.
A new `metrics append` command in gsd-tools.cjs keeps the pattern consistent and avoids
raw file writes from the orchestrator.

**Verdict: ADD `metrics append` command to gsd-tools.cjs.**

---

## What Gets Modified vs Layered

| Component | Action | Why |
|-----------|--------|-----|
| `model-profiles.cjs` | MODIFY | Add gsd-classifier, gsd-context-selector entries |
| `config.cjs` | MODIFY | Add `orchestrator.*` config namespace |
| `references/agent-contracts.md` | MODIFY | Add orchestrator structured report contract |
| `gsd-tools.cjs` (metrics command) | ADD | Token log append to keep raw writes out of orchestrator |
| `gsd-orchestrate/SKILL.md` | ALREADY EXISTS | Orchestrator loop is already defined |
| All other gsd-tools.cjs commands | LAYER ON TOP | State, commit, model, phase ops all usable as-is |
| ORCHESTRATOR-CHECKPOINT.md | NEW FILE | Checkpoint survival, no conflict |
| `.planning/metrics/token-log.jsonl` | NEW FILE | Token tracking, no conflict |

---

## Install Script: Upgrade vs Fresh Install

GSD 1.0 installs to `~/.claude/get-shit-done/`. Super GSD layers into:
- `~/.claude/commands/gsd-orchestrate/SKILL.md` — already exists
- `~/.claude/commands/gsd-overwatcher/SKILL.md` — already exists

**Fresh install:** Full install of both GSD 1.0 and Super GSD additions in sequence.

**Upgrade (GSD 1.0 already present):**
1. Detect existing `get-shit-done/bin/lib/model-profiles.cjs` — patch in new agent entries
2. Detect existing `config.cjs` VALID_CONFIG_KEYS set — patch in orchestrator keys
3. Write new SKILL.md files for new agents only (classifier, context-selector)
4. Do NOT overwrite existing SKILL.md files for existing agents — user may have customized

**Safety rule:** The install script should diff-and-patch the three modified files
(model-profiles.cjs, config.cjs, agent-contracts.md) rather than overwrite them.
A simple marker comment (`// SUPER-GSD-START` / `// SUPER-GSD-END`) makes patches idempotent.

---

## Suggested Build Order (dependency-driven)

```
Phase 1 (Token Foundation)
  → Establishes report format contract — all later agents depend on it
  → Add gsd-classifier + gsd-context-selector to model-profiles.cjs HERE
  → Add orchestrator config namespace to config.cjs HERE

Phase 2 (Memory Layer)
  → ByteRover .brv/ sub-repo requires commit-to-subrepo to work
  → State seam must be validated before memory can query it

Phase 3 (Orchestrator Engine)
  → Depends on Phase 1 (token budget + report format) and Phase 2 (memory queries)
  → Wire gsd-orchestrate loop to gsd-tools.cjs state/commit/resolve-model
  → Implement ORCHESTRATOR-CHECKPOINT.md write/resume
  → Add metrics append command to gsd-tools.cjs

Phase 4 (Quality + Monitoring)
  → ATC gate sits between Phase 3 loop step 9 (process result) and step 12 (commit)
  → No new seams — reads classifier output already in memory

Phases 5-7
  → Pure layer-on-top — no further modifications to GSD 1.0 core
```

---

## Critical Constraint

`gsd-tools.cjs` commands use `@file:` prefix responses for large outputs (file-based IPC).
The orchestrator must handle: `if [[ "$RESULT" == @file:* ]]; then RESULT=$(cat "${RESULT#@file:}"); fi`
This is already documented in planning-config.md and is a load-bearing pattern that will break
the orchestrator loop if missed.

---

## Sources

- Direct inspection: `get-shit-done/bin/gsd-tools.cjs` (command surface)
- Direct inspection: `get-shit-done/bin/lib/state.cjs`, `config.cjs`, `model-profiles.cjs`, `init.cjs`
- Direct inspection: `get-shit-done/references/agent-contracts.md`, `planning-config.md`, `checkpoints.md`
- Direct inspection: `commands/gsd-orchestrate/SKILL.md` (orchestrator loop definition)
- Confidence: HIGH — all findings from live source files, no training-data inference

---
phase: 10-gate-policy
plan: "03"
subsystem: gate-policy-integration
tags: [gates-registry, skill-integration, verifier-retrofit, config-cleanup]
dependency_graph:
  requires: [10-01, 10-02]
  provides: [gate-policy-enforcement-live, phase-10-close]
  affects: [super-gsd/skills/sgsd-orchestrate/SKILL.md, .planning/phases/09-atc-147-evidence/verify.mjs, .planning/config.json]
tech_stack:
  added: []
  patterns: [gates.shouldFire hybrid integration, dispatch-context builder, verifier retro-fit]
key_files:
  created:
    - .planning/phases/10-gate-policy/10-03-01-cross-repo-probe.yaml
  modified:
    - super-gsd/skills/sgsd-orchestrate/SKILL.md
    - .planning/phases/09-atc-147-evidence/verify.mjs
    - .planning/config.json
decisions:
  - "10-03-01 probe: core.cjs is in separate repo (C:/Users/jack.berrow/.claude) — 10-03-04 skipped core.cjs patch; operator must apply D-13b manually"
  - "Hybrid SKILL.md integration: prose preserved, gates.shouldFire calls added inside existing step bodies (20 total refs, 9 distinct call sites)"
  - "Step 9.2 BUILD DISPATCH CONTEXT added with all 11 Q2 fields; Step 3.6 LOAD GATES REGISTRY cold-start block added"
metrics:
  duration: ~25min
  completed: "2026-04-22"
  tasks_completed: 5
  files_changed: 4
---

# Phase 10 Plan 03: Integration & Cleanup Summary

## One-Liner

Wired `gates.shouldFire` at all 9 SKILL.md call sites, retrofitted 09-verify.mjs with WR-01/WR-02 invariants (D-12b), deleted config.byterover block (D-13), and confirmed both verifiers green — Phase 10 closed.

## Task Results

### 10-03-01 — Cross-Repo Probe

**Result: SEPARATE**

- `core.cjs` lives at `C:/Users/jack.berrow/.claude/get-shit-done/bin/lib/core.cjs`
- That path belongs to git repo root `C:/Users/jack.berrow/.claude` — separate from GSDedits (`C:/Users/jack.berrow/GSDedits`)
- **Action for 10-03-04:** `skip-patch-external`
- Probe YAML written to `.planning/phases/10-gate-policy/10-03-01-cross-repo-probe.yaml`

### 10-03-02 — SKILL.md Integration

**Result: PASS — 20 `gates.shouldFire` refs (≥9 required)**

Call sites wired:

| Step | Gate Name | Line Area |
|------|-----------|-----------|
| 2 (classifier) | `classifier-haiku` | After CLASSIFY header |
| 4 (context-selector) | `context-selector-haiku` | SELECT CONTEXT block |
| 5 (sgsd-recall) | `sgsd-recall-queries` | QUERY BYTEROVER block |
| 5.5 (INTENT) | `intent-injection` | INTENT INJECTION block |
| 6.5 (phase ATC) | `phase-level-ATC` | PHASE ATC GATE — R5 compose with config.atc.enabled |
| 6.55 (MUDA) | `MUDA-waste-audit` | MUDA WASTE AUDIT block |
| 9.5 (per-dispatch ATC) | `per-dispatch-ATC` | PER-DISPATCH ATC — R5 compose with config.atc.enabled |
| 10 (curate) | `sgsd-curate-learnings` | CURATE LEARNINGS block |
| 11 (token-log) | `token-log` | UPDATE STATE block (D-11c: exempt from edge-guard) |

Additional blocks added:
- **Step 3.6 LOAD GATES REGISTRY** — cold-start, loads and caches registry once
- **Step 9.2 BUILD DISPATCH CONTEXT** — assembles all 11 Q2 dispatch fields per iteration

`config.atc.enabled` kill-switches preserved at Steps 6.5 and 9.5 (R5 compose).

### 10-03-03 — 09-verify.mjs Retrofit (D-12b)

**Result: PASS — exit 0, "PASS: all 9 invariants hold"**

- Invariant 8 (WR-01): per-dispatch row arithmetic `total_bypass_cost === per_dispatch_tokens × dispatches_bypassed`
- Invariant 9 (WR-02): `findings_detail[].bucket` strings map consistently to `findings_by_bucket` keys via bucketMap
- Exit codes 8/9 reserved (matches existing 1-7 convention)
- File remained within LOC budget (92 lines, well under 120 limit)

### 10-03-04 — config.byterover Delete + Conditional core.cjs Patch

**Result: PASS (config.json) + OPERATOR ACTION REQUIRED (core.cjs)**

- `byterover` block deleted from `.planning/config.json`
- All 7 D-13a keys preserved: `safety`, `model_routing`, `token_efficiency`, `deliberation`, `atc`, `browser_verify`, `overwatcher`
- JSON parses cleanly
- **core.cjs patch SKIPPED** — probe said `separate`; operator must manually apply D-13b

### 10-03-05 — Full-Suite Verification

**Result: BOTH VERIFIERS GREEN**

```
node .planning/phases/10-gate-policy/verify.mjs
→ PASS: all 8 invariants hold (exit 0)

node .planning/phases/09-atc-147-evidence/verify.mjs
→ PASS: all 9 invariants hold (exit 0)
```

## Full-Suite Verification (10-03-05)

```
$ node .planning/phases/10-gate-policy/verify.mjs && node .planning/phases/09-atc-147-evidence/verify.mjs
PASS: all 8 invariants hold
PASS: all 9 invariants hold
```

Both exit 0. Phase 10 closed.

## Operator Action Required

**D-13b — core.cjs KNOWN_TOP_LEVEL patch (external repo)**

The cross-repo probe (10-03-01) confirmed `core.cjs` is in a separate git repository (`C:/Users/jack.berrow/.claude`). The GSDedits executor cannot commit to that repo.

To suppress the `gsd-tools: warning: unknown config key(s)` warnings, the operator must manually edit:

```
~/.claude/get-shit-done/bin/lib/core.cjs  (lines 322-331)
```

Add the following to the `KNOWN_TOP_LEVEL` Set:

```javascript
// ── Phase 10 D-13b additions: runtime tuning blocks referenced by gates.yaml
'safety', 'model_routing', 'token_efficiency', 'deliberation',
'atc', 'browser_verify', 'overwatcher',
```

Reference: `10-RESEARCH.md §Q8` for the exact diff shape.

## Deviations from Plan

None — plan executed exactly as written. The `separate` cross-repo branch was the planned conditional path (not a deviation).

## Commits

| Task | Hash | Message |
|------|------|---------|
| 10-03-01 | 460502b | chore(10-03-01): cross-repo probe — core.cjs is separate repo |
| 10-03-02 | fb56f85 | feat(10-03-02): wire 9 gates.shouldFire call sites in SKILL.md |
| 10-03-03 | 16106c2 | fix(09): add WR-01/WR-02 invariants to 09-verify.mjs (D-12b) |
| 10-03-04 | 382097f | fix(10-03-04): delete config.byterover block (D-13) |

## Self-Check

- [x] 10-03-01-cross-repo-probe.yaml exists
- [x] SKILL.md has ≥9 gates.shouldFire refs (actual: 20)
- [x] SKILL.md has LOAD GATES REGISTRY section
- [x] SKILL.md has BUILD DISPATCH CONTEXT section
- [x] SKILL.md has config.atc.enabled (kill-switch preserved)
- [x] 09-verify.mjs has Invariant 8 and Invariant 9
- [x] node 09-verify.mjs → exit 0 (9 invariants)
- [x] config.json has no byterover key
- [x] config.json has all 7 preserved keys
- [x] node 10-verify.mjs → exit 0 (8 invariants)
- [x] Full suite both green

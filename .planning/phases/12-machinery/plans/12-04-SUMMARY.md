---
phase: 12-machinery
plan: "04"
subsystem: orchestrator-machinery
tags: [mach-04, adversarial-verifier, challenger-pass, verify-mjs, phase-close]
schema_version: 2

dependency_graph:
  requires:
    - 12-03  # MACH-03 checkpoint schema + 85% hard cap (dispatches_summary.by_outcome.warn needed before challenger)
  provides:
    - adversarial-verifier-sampling  # MACH-04 fulfilled
    - phase-12-verify-mjs-complete   # invariants 1-14 all authored
  affects:
    - super-gsd/skills/sgsd-orchestrate/SKILL.md  # Step 9.6 added after Step 9.5
    - .planning/config.json                        # atc.verifier_adversarial_rate = 0.2

tech_stack:
  added: []
  patterns:
    - "DLB-03 structural injection — contrarian prompt header prepended verbatim to primary verifier prompt"
    - "Dual-gate pattern (config.atc.enabled AND Math.random() < rate) matching Step 9.5 convention"
    - "Soft-warn invariant pattern (exit 0 regardless, print WARN) — matches Phase 10 expected-red convention"

key_files:
  created:
    - .planning/phases/12-machinery/plans/12-04-01-verifier-contract-check.md
    - .planning/phases/12-machinery/plans/12-04-SUMMARY.md
  modified:
    - .planning/config.json
    - super-gsd/skills/sgsd-orchestrate/SKILL.md
    - .planning/phases/12-machinery/verify.mjs

decisions:
  - "A2 vocab mismatch resolved via semantic mapping: actual gsd-verifier emits passed|gaps_found|human_needed, not PASS|PASS-WITH-GAPS|FAIL; D-13b labels preserved as SKILL.md greppable markers mapped to actual vocab in prose"
  - "Invariant 13 implemented via temp .cjs file instead of node -e inline to avoid shell quoting issues on Windows"
  - "PASS-WITH-DEVIATIONS maps to passed (agreement) not PASS-WITH-GAPS — both are affirmative verdicts with no new blockers"

metrics:
  duration_minutes: 25
  completed: "2026-04-22"
  tasks_completed: 3
  files_modified: 4
  files_created: 2
  commits: 2
---

# Phase 12 Plan 04: Adversarial Verifier Sampling (MACH-04) Summary

**One-liner:** MACH-04 shipped — 20%-sampled contrarian challenger pass via SKILL.md Step 9.6 with dual-gate config.atc.verifier_adversarial_rate; verify.mjs invariants 1-14 all green; Phase 12 closes.

---

## MACH-04 Landing

### Config: `atc.verifier_adversarial_rate = 0.2`

`.planning/config.json` atc block updated:
- `verifier_adversarial_rate: 0.2` added (D-14 default — 20% sampling rate)
- All existing atc fields preserved: `enabled`, `classify_model`, tier thresholds
- Tunable: set `0` to disable, `1` to force challenger on every verifier pass

### SKILL.md Step 9.6

New step inserted immediately after Step 9.5 (line 852 vs line 800) in `super-gsd/skills/sgsd-orchestrate/SKILL.md`.

**Fires when ALL three conditions hold:**
1. Step 6.f completed this iteration (gsd-verifier was dispatched)
2. Verifier status in `{passed, human_needed with no blockers}` (affirmative verdict)
3. Dual-gate: `config.atc.enabled AND Math.random() < config.atc.verifier_adversarial_rate`

**Contrarian prompt header (D-13a verbatim):** present in code fence inside Step 9.6.

**All 3 verdict branches (D-13b) documented:**
- `status: passed` → log `verifier_adversarial_agreement: true` to token-log.jsonl
- `status: human_needed` (maps to PASS-WITH-GAPS) → promote phase verdict, append `## Adversarial Challenge` to VERIFICATION.md
- `status: gaps_found` (maps to FAIL flip) → auto mode: log `VERIFIER_ADVERSARIAL_FLIP` CRITICAL in DEVIATIONS, continue; interactive mode: STOP blocker

**All 5 greppable markers confirmed present:**
- `ADVERSARIAL CHALLENGER PASS` ✓
- `verifier_adversarial_rate` ✓
- `9.6` ✓
- `PASS-WITH-GAPS` ✓
- `VERIFIER_ADVERSARIAL_FLIP` ✓

---

## Invariants 8-14 Added to verify.mjs

| # | Invariant | Type | Status |
|---|-----------|------|--------|
| 8 | MACH-04: config.atc.verifier_adversarial_rate numeric in [0,1] + SKILL.md contrarian header marker | hard | GREEN |
| 9 | WR-01: edge-guard.cjs narrow catch discriminator `err.message.startsWith("gate '")` | hard | GREEN |
| 10 | WR-02: gates-registry.cjs PROCESS SINGLETON JSDoc in lines 1-30 | hard | GREEN |
| 11 | WR-03: SKILL.md code_files_changed_count regex treats skills/SKILL.md as code | hard | GREEN |
| 12 | ERG-02: patch script exists, executable, passes bash -n syntax check | hard | GREEN |
| 13 | ERG-02 idempotency: patcher run twice on fixture — first PATCHED, second ALREADY_PATCHED | hard | GREEN |
| 14 | D-04 soft: classifier-skip events in token-log.jsonl (proof-by-usage) | SOFT-WARN | WARN (count=0, expected-red until v1 plan runs) |

`grep -cE 'Invariant ([89]|1[0-4])\b' verify.mjs` → 10 (>= 7 required) ✓

---

## Final Verify State

```
node .planning/phases/12-machinery/verify.mjs
→ WARN: Invariant 14 (D-04): no classifier-skip events... (expected-red)
→ PASS: invariants 1-13 hard green + invariant 14 soft-warn
→ exit 0
```

- Invariants 1-7: MACH-01 + MACH-02 + MACH-03 (from plans 12-01/02/03) ✓
- Invariants 8-14: MACH-04 + ERG-01/02 (this plan) ✓
- Invariant 14: soft-warn as designed — expected-red until Phase 12 runs its own v1 plan post-integration

---

## Phase 12 Close Criteria

| Criterion | Status |
|-----------|--------|
| MACH-01: classifier-cache module + SKILL.md Step 2 integration | COMPLETE (plan 12-01) |
| MACH-02: dispatch-planner module + SKILL.md wave dispatch | COMPLETE (plan 12-02) |
| MACH-03: checkpoint schema 3 new fields + 85% hard cap + template | COMPLETE (plan 12-03) |
| MACH-04: adversarial verifier Step 9.6 + config rate | COMPLETE (this plan, 12-04) |
| ERG-01 WR-01: edge-guard narrow catch | COMPLETE (plan 12-05) |
| ERG-01 WR-02: gates-registry JSDoc | COMPLETE (plan 12-05) |
| ERG-01 WR-03: SKILL.md skill-SKILL.md as code | COMPLETE (plan 12-05) |
| ERG-02: patch-gsd-tools-known-keys.sh installer | COMPLETE (plan 12-06) |
| verify.mjs: ≥8 invariants, exit 0 on committed artefacts | COMPLETE — 14 invariants, 13 hard green, 1 soft-warn |

**Phase 12 closes. All 4 MACH requirements green. All 3 ERG warnings closed. Installer shipped.**

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A2 vocab assumption does not hold — semantic mapping applied**
- **Found during:** Task 12-04-01
- **Issue:** gsd-verifier emits `passed | gaps_found | human_needed` (not `PASS | PASS-WITH-DEVIATIONS | PASS-WITH-GAPS | FAIL`). D-13b assumed PASS-WITH-GAPS was a pre-existing or easily addable STATUS value.
- **Fix:** No agent file edit. SKILL.md Step 9.6 documents the semantic mapping in prose while preserving D-13b's label names as greppable markers (per output_contract requirements). PASS-WITH-GAPS label retained as a concept name; actual comparison uses `status: human_needed`.
- **Files modified:** `super-gsd/skills/sgsd-orchestrate/SKILL.md` (Step 9.6 prose), `12-04-01-verifier-contract-check.md`
- **Commits:** 001c223 (config + contract-check), 91eab4d (SKILL.md Step 9.6)

**2. [Rule 1 - Bug] Invariant 13 patcher inline -e approach fails on Windows due to shell quoting**
- **Found during:** Task 12-04-03 (first verify.mjs run)
- **Issue:** `node -e "..."` with multi-line JS containing quotes fails in Windows bash when patcher code is stringified and escaped through multiple shell layers.
- **Fix:** Write patcher logic to a temp `.cjs` file, invoke with `node "${patcherPath}" "${fixturePath}"` — no shell quoting issues.
- **Files modified:** `.planning/phases/12-machinery/verify.mjs`
- **Commits:** included in verify.mjs commit

---

## Handoff

Milestone v1.2 "Evidence-First Sharpening" is now 80% complete (4/5 phases):

- Phase 9: ATC evidence + classification.yaml ✓
- Phase 10: Gate policy + edge-guard + verify.mjs ✓
- Phase 11: v2 plan schema ✓
- Phase 12: Machinery (MACH-01..04 + ERG-01/02) ✓
- Phase 13: Governance (pending)

Phase 13 (Governance) has no dependency on Phase 12 — can start immediately. It consumes Phase 10 gates.yaml + Phase 11 schema-ownership precedent.

Risk 5 note: challenger at 0.2 rate may not fire during Phase 12's own verifier dispatch. This is expected. Audit "fired at least once" at milestone close via: `grep -r "Adversarial Challenge" .planning/phases/*/`

---

## Commit SHAs

| Task | Commit | Description |
|------|--------|-------------|
| 12-04-01 | 001c223 | config.json verifier_adversarial_rate + A2 contract-check note |
| 12-04-02 | 91eab4d | SKILL.md Step 9.6 adversarial verifier challenger pass |
| 12-04-03 | (see final commit) | verify.mjs invariants 8-14 + SUMMARY |

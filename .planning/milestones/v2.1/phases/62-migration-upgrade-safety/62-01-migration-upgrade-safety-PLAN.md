---
schema_version: 2
phase: 62
plan: "62-01"
plan_id: "62-01-migration-upgrade-safety"
name: Migration Upgrade Safety - Drift Checker
milestone: v2.1
type: feature
autonomous: true
wave: 1
depends_on: [61]
unblocks: []
requirements: []
load_mode: full
---

# Phase 62-01 Plan: Migration Upgrade Safety - Drift Checker

## Objective

Ship a read-only drift checker that reports v1.5 -> v2.1 markers without
modifying files. >= 8 probes (we ship 11) covering v1.2 / v1.9 / v2.0 /
v2.1 version tags. Wire as v2.1 fifth-gate; this is the FINAL gate of the
v1.6 -> v2.1 roadmap.

## Context

@.planning/milestones/v2.1/phases/62-migration-upgrade-safety/62-CONTEXT.md
@.planning/milestones/v2.1/phases/62-migration-upgrade-safety/62-RESEARCH.md

## Tasks

### T1: Build drift-checker tool + thin shell + docs

**type:** auto

**Files:**

- super-gsd/tools/upgrade-drift/check.cjs (new, ~600L)
- super-gsd/tools/upgrade-drift/run-self-test.cjs (new, thin spawnSync shell)
- super-gsd/docs/UPGRADE-DRIFT.md (new, probe table + migration deltas + recipe)

**Done criteria:**

- 4 public APIs Lock-13 wrapped (runDrift / getProbe / selfTest / _internals)
- PROBE_NAMES frozen, length >= 8
- VERSION_TAGS frozen, length === 4 (v1.2 / v1.9 / v2.0 / v2.1)
- REASON_NOTES frozen, length === 8
- MIGRATION_NOTES frozen, 7 milestone keys, each value array of >=2 deltas
- selfTest >= 8 assertions PASS
- `node check.cjs --self-test` exits 0
- `node check.cjs --run` reports >= 8 probes; exits 0
- `git status --short` before/after `--run` identical (read-only)
- ASCII-only first_nonascii_idx === -1
- selfTest A8 hasWrite=false (source substring scan)

**Verification:**

```
node super-gsd/tools/upgrade-drift/check.cjs --self-test
node super-gsd/tools/upgrade-drift/check.cjs --run
node super-gsd/tools/upgrade-drift/run-self-test.cjs
git status --short > /tmp/pre.txt && node super-gsd/tools/upgrade-drift/check.cjs --run > /dev/null && git status --short > /tmp/post.txt && diff /tmp/pre.txt /tmp/post.txt
```

### T2: Wire v2.1 fifth-gate into sgsd-complete-milestone.cjs

**type:** auto

**Files:**

- super-gsd/scripts/sgsd-complete-milestone.cjs (surgical extension; +~120 lines)

**Done criteria:**

- Lock 4: prior four v2.1 gates (Phase 58 first / Phase 59 second / Phase 60
  third / Phase 61 fourth) preserved byte-equality up to insertion point
- New Phase 62-01-T1 header comment block added
- Fifth-gate block inserted between fourth-gate green stdout and the
  branch-terminating process.exit(0)
- 4-5 closed-vocab stderr tags (upgrade_drift_unavailable /
  upgrade_drift_self_test_threw / upgrade_drift_self_test_failed /
  upgrade_drift_read_only_invariant_failed /
  upgrade_drift_probe_count_below_floor)
- selfTest >= 8 PASS + read_only_invariant === ok PASS + runDrift probes
  >= 8 all required for green
- ASCII-only first_nonascii_idx === -1 post-insertion
- v1.9 dual-gate exit 0 (no regression)
- v2.0 sept-gate exit 0 (no regression)
- v2.1 quint-gate (5 stdout green messages) exit 0

**Verification:**

```
node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1
node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9
node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0
```

All three must exit 0.

### T3: Phase 62 close artifacts + v2.1 milestone-close + roadmap end-of-run

**type:** auto

**Files:**

- .planning/milestones/v2.1/phases/62-migration-upgrade-safety/62-RESEARCH.md (new)
- .planning/milestones/v2.1/phases/62-migration-upgrade-safety/62-01-migration-upgrade-safety-PLAN.md (new; this file)
- .planning/milestones/v2.1/phases/62-migration-upgrade-safety/62-VERIFICATION.md (new)
- .planning/milestones/v2.1/phases/62-migration-upgrade-safety/WASTE.md (new)
- .planning/milestones/v2.1/phases/62-migration-upgrade-safety/commit-reviews.jsonl (new)
- .planning/milestones/v2.1/SUMMARY.md (new; mirror v1.9 / v2.0 pattern)
- .planning/STATE.md (update: roadmap COMPLETE; add v2_1_complete + roadmap_run.completed)
- .planning/ORCHESTRATOR-CHECKPOINT.md (update: roadmap_status COMPLETE)

**Done criteria:**

- All 5 phase artifacts written
- v2.1/SUMMARY.md mirrors v1.9 / v2.0 SUMMARY pattern: frontmatter +
  5-phase ledger + acceptance gates + Lock invariants table + generated
  artifacts + backlog state + final note "ROADMAP COMPLETE - all 30
  phases (26-62) closed"
- STATE.md updated to reflect roadmap COMPLETE
- ORCHESTRATOR-CHECKPOINT.md updated to roadmap_status COMPLETE
- Final atomic commit `milestone(v2.1): SHIPPED ...; ROADMAP COMPLETE`
  captures all metadata files

## Success criteria (overall)

- node super-gsd/tools/upgrade-drift/check.cjs --self-test -> 12/12 PASS
- node super-gsd/tools/upgrade-drift/check.cjs --run -> 11 probes; exit 0
- git status before/after --run identical
- node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1 ->
  exit 0 (quint-gate green: 12+11+read-only)
- node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9 ->
  exit 0 (no regression)
- node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0 ->
  exit 0 (no regression)
- ASCII-only first_nonascii_idx === -1 across all NEW Phase 62 files
- Atomic commits per logical unit (T1 = drift tool + docs; T2 =
  fifth-gate wire; T3 = phase artifacts + v2.1 close + roadmap end)
- Final commit: `milestone(v2.1): SHIPPED ...; ROADMAP COMPLETE 30/30`

## Lock invariants (enforced)

- Lock 4: Phase 41-61 byte-untouched; new check.cjs zero require()
  of upstream Phase 41-61 modules
- Lock 11: closed-vocab indexOf membership on PROBE_NAMES /
  VERSION_TAGS / REASON_NOTES; no regex / fuzzy matching
- Lock 13: every public API try/catch + degraded sentinel; never
  throws upward
- READ-ONLY: zero fs.{write,append,unlink,mkdir,rm,rmdir}Sync in
  source code (selfTest A8 enforces; operational verification via
  git status before/after)
- ASCII-only: first_nonascii_idx === -1 across all NEW Phase 62
  files

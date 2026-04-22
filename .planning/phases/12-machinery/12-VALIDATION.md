---
phase: 12
slug: machinery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 12 — Validation Strategy

> Per-phase validation contract. Derived from 12-RESEARCH.md §Q10.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node builtin `assert` + `child_process.execSync`; js-yaml reused via `createRequire` from `super-gsd/tools/plan-schema/node_modules/` (same as Phase 9/10) |
| **Config file** | none — invariants inline in verify.mjs per phase |
| **Quick run command** | `node .planning/phases/12-machinery/verify.mjs` |
| **Full suite command** | `node .planning/phases/09-atc-147-evidence/verify.mjs && node .planning/phases/10-gate-policy/verify.mjs && node .planning/phases/12-machinery/verify.mjs` (all three must exit 0) |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** `node verify.mjs` (< 1s)
- **After every plan wave:** full-suite command (all three verifiers green)
- **Before `/gsd-verify-work`:** full-suite green
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | MACH-01 | unit | `node -e "require('./super-gsd/scripts/lib/classifier-cache.cjs').readCache('10-01', Date.now())"` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | MACH-01 | integration | `node verify.mjs` (invariant 1: cache sidecar schema valid) | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | MACH-01 | grep | `grep -q "classifier-cache" super-gsd/skills/sgsd-orchestrate/SKILL.md` | ❌ W0 | ⬜ pending |
| 12-01-04 | 01 | 1 | D-04 soft | grep (soft-warn) | `grep -c "classifier-skip" .planning/metrics/token-log.jsonl \|\| true` | ✅ | ⬜ pending |
| 12-02-00 | 02 | 2 | MACH-02 | spike | Agent() fan-out smoke test (Risk 2 mitigation from research) | N/A | ⬜ pending |
| 12-02-01 | 02 | 2 | MACH-02 | unit | `node -e "require('./super-gsd/scripts/lib/dispatch-planner.cjs').buildDispatchPlan(sample_v2_plan)"` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 2 | MACH-02 | unit v1 fallback | `node -e "same as above on v1 plan → single-wave-all-serial"` | ❌ W0 | ⬜ pending |
| 12-02-03 | 02 | 2 | MACH-02 | integration | `node verify.mjs` (invariants 3,4,5: DAG non-cyclic + v1 fallback + file-overlap serialization) | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 3 | MACH-03 | integration | `grep -c "approaches_tried_and_abandoned\|rules_learned_this_session\|dispatches_summary" super-gsd/templates/checkpoint.md` must be ≥ 3 | ✅ (template exists) | ⬜ pending |
| 12-03-02 | 03 | 3 | MACH-03 | grep | `grep -q "85%" super-gsd/skills/sgsd-orchestrate/SKILL.md` (hard cap instruction present) | ✅ | ⬜ pending |
| 12-03-03 | 03 | 3 | MACH-03 | unit | `node -e "require('./super-gsd/scripts/lib/context-gauge.cjs').isEmergency(170000, 200000) === true"` OR self-report fallback (per Risk 1) | N/A | ⬜ pending |
| 12-04-01 | 04 | 4 | MACH-04 | config check | `node -e "const c=JSON.parse(require('fs').readFileSync('.planning/config.json'));assert(c.atc.verifier_adversarial_rate >= 0 && c.atc.verifier_adversarial_rate <= 1)"` | ✅ | ⬜ pending |
| 12-04-02 | 04 | 4 | MACH-04 | grep | `grep -c "ADVERSARIAL CHALLENGER PASS" super-gsd/skills/sgsd-orchestrate/SKILL.md` must be ≥ 1 | ✅ | ⬜ pending |
| 12-04-03 | 04 | 4 | MACH-04 | integration | `node verify.mjs` (invariant 8: config + SKILL.md marker both present) | ❌ W0 | ⬜ pending |
| 12-05-01 | 05 | 1 | ERG-01 WR-01 | grep | `! grep -nE "catch\\s*\\(\\s*_?\\s*\\)\\s*\\{.*fallthrough" super-gsd/scripts/lib/edge-guard.cjs` (broad catch narrowed) | ✅ | ⬜ pending |
| 12-05-02 | 05 | 1 | ERG-01 WR-02 | grep | `awk '/^\\/\\*\\*/,/\\*\\//' super-gsd/scripts/lib/gates-registry.cjs \| grep -q "PROCESS SINGLETON"` | ✅ | ⬜ pending |
| 12-05-03 | 05 | 1 | ERG-01 WR-03 | grep | `grep -q "super-gsd/skills" super-gsd/skills/sgsd-orchestrate/SKILL.md` AND `grep -q "code_files_changed_count" ...` (predicate updated) | ✅ | ⬜ pending |
| 12-06-01 | 06 | 1 | ERG-02 | exec | `bash super-gsd/scripts/patch-gsd-tools-known-keys.sh --dry-run` → exit 0 | ❌ W0 | ⬜ pending |
| 12-06-02 | 06 | 1 | ERG-02 | idempotency | Run patch script twice on fixture — second run exits 0 with "already patched" message | ❌ W0 | ⬜ pending |
| 12-07 | — | 4 | all | full-suite | all three verify.mjs exit 0 | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/phases/12-machinery/verify.mjs` — 11 hard + 3 soft invariants per research §Q9
- [ ] `super-gsd/scripts/lib/classifier-cache.cjs` — new (~60 LOC)
- [ ] `super-gsd/scripts/lib/dispatch-planner.cjs` — new (~80 LOC)
- [ ] `super-gsd/scripts/lib/context-gauge.cjs` — new (~20 LOC, optional per Risk 1 mitigation; MAY be folded into SKILL.md self-report if scope tight)
- [ ] `super-gsd/scripts/patch-gsd-tools-known-keys.sh` — new (installer script, Node-in-bash)
- [ ] No new framework install — all dependencies already pinned

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Challenger actually fires once during Phase 12 verification | MACH-04 | 0.2 probability means ~80% chance Phase 12's own verifier never triggers the challenger. Mechanical test is config-presence only. | Operator notes: if verifier report includes `## Adversarial Challenge`, MACH-04 is proven end-to-end. Otherwise, proof is "fired-at-least-once" at milestone close via `grep -r "Adversarial Challenge" .planning/phases/*/`. |
| Parallel Agent() fan-out works | MACH-02 | Spike at 12-02-00 is a LIVE smoke test; outcome visible only to operator. | Operator confirms: spike agent report shows 3 parallel Task() calls returned with distinct timing (not serialized). If serialized, Risk 2 mitigation fires (fall back to single-wave-all-serial). |

*Everything else is automated.*

---

## Validation Sign-Off

- [ ] All 19 tasks have automated verify or Wave 0 dependencies mapped
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (longest: 12-02 spike → 12-02-01 → 12-02-02 = 3, spike is live-smoke so counts as manual-adjacent)
- [ ] Wave 0 covers 4 new files (3 lib + 1 installer)
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set post-planner confirmation of task IDs

**Approval:** pending — gsd-planner to confirm task IDs during plan generation

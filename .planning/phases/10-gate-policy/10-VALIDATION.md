---
phase: 10
slug: gate-policy
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Extracted from 10-RESEARCH.md §Q10 and adjusted for v2 frontmatter schema.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node-based ad-hoc assertions (matches Phase 9 `verify.mjs` pattern) + js-yaml reused from `super-gsd/tools/plan-schema/node_modules/` via `createRequire` |
| **Config file** | none — reuses pinned deps |
| **Quick run command** | `node .planning/phases/10-gate-policy/verify.mjs` |
| **Full suite command** | `node .planning/phases/10-gate-policy/verify.mjs && node .planning/phases/09-atc-147-evidence/verify.mjs` (both must be exit 0 after D-12b retrofit) |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `node .planning/phases/10-gate-policy/verify.mjs` (< 1s)
- **After every plan wave:** Run the full suite (both verifiers) — both must exit 0
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | GATE-01 | — | N/A | unit | `node -e "require('./super-gsd/scripts/lib/predicate-eval.cjs').evalPredicate({field:'classifier.complexity',op:'neq',value:'trivial'},{classifier:{complexity:'medium'}})"` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | GATE-01 | — | N/A | unit | `node -e "require('./super-gsd/scripts/lib/gates-registry.cjs').get('per-dispatch-ATC')"` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | GATE-01, GATE-02, GATE-03 | — | N/A | structured-yaml | `node .planning/phases/10-gate-policy/verify.mjs` (invariants 1-6) | ❌ W0 | ⬜ pending |
| 10-01-04 | 01 | 1 | GATE-01 | — | N/A | integration | full-suite quick run | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | GATE-04 | — | N/A | unit | `node super-gsd/scripts/lib/edge-guard.cjs --self-test` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | GATE-04 | — | N/A | integration | grep `<edge_guard>` section in SKILL.md + self-test | ❌ W0 | ⬜ pending |
| 10-02-03 | 02 | 1 | GATE-04 | — | N/A | integration | `node super-gsd/scripts/lib/edge-guard.cjs --self-test` + JSONL schema assertion | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | — | — | cross-repo verify | shell | `git -C $(node -e "console.log(require('path').dirname(require.resolve('~/.claude/get-shit-done/bin/gsd-tools.cjs')))") rev-parse --show-toplevel` | ✅ | ⬜ pending |
| 10-03-02 | 03 | 2 | GATE-01..04 | — | N/A | grep-count | `grep -c 'gates.shouldFire' super-gsd/skills/sgsd-orchestrate/SKILL.md` must return >= 9 | ✅ | ⬜ pending |
| 10-03-03 | 03 | 2 | D-12b | — | N/A | full-suite | `node .planning/phases/09-atc-147-evidence/verify.mjs` — all 9 invariants pass including new WR-01/02 | ✅ | ⬜ pending |
| 10-03-04 | 03 | 2 | D-13 | — | no secrets exposed | grep + tool-probe | `! grep -q '"byterover"' .planning/config.json && node ~/.claude/get-shit-done/bin/gsd-tools.cjs init phase-op 10 2>&1 \| grep -c 'unknown config key' = 0` | ✅ | ⬜ pending |
| 10-03-05 | 03 | 2 | all | — | N/A | full-suite | both verify.mjs green | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/phases/10-gate-policy/verify.mjs` — 8 invariants covering GATE-01/02/03, D-12b, D-13; follows Phase 9 verify.mjs pattern
- [ ] `super-gsd/scripts/lib/predicate-eval.cjs` — pure-function evaluator (~80 LOC); verification is via verify.mjs invariant 6 (every trigger clause parses against a known-complete sample ctx)
- [ ] `super-gsd/scripts/lib/gates-registry.cjs` — cached YAML-load singleton (~60 LOC); verification via invariants 1-5
- [ ] `super-gsd/scripts/lib/edge-guard.cjs` — add `--self-test` CLI flag that writes + reads + deletes a sample JSONL row (GATE-04 assertion)
- [ ] No framework install needed — reuses pinned `js-yaml@4.1.1` from `super-gsd/tools/plan-schema/node_modules/` via `createRequire`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | All phase behaviors have automated verification through verify.mjs + self-tests | — |

*All phase behaviors have automated verification — per R-Q10 recommendation to mirror Phase 9's mechanical-verifier pattern for policy traceability.*

---

## Validation Sign-Off

- [ ] All 12 tasks have automated verify or Wave 0 dependencies mapped
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (longest streak: 2, between 10-01-02 and 10-01-03)
- [ ] Wave 0 covers all ❌ MISSING references (verify.mjs + 3 lib modules)
- [ ] No watch-mode flags
- [ ] Feedback latency < 1s
- [ ] `nyquist_compliant: true` set in frontmatter after planner confirms task IDs match this map

**Approval:** pending — gsd-planner to confirm task IDs align with this map during plan generation

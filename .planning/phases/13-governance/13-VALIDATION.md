---
phase: 13
slug: governance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 13 — Validation Strategy

> Derived from 13-RESEARCH.md §Q9-Q10. Expanded to 16 invariants and 27 tasks per research findings.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node builtin `assert` + `child_process.execSync`; js-yaml reused via `createRequire` from `super-gsd/tools/plan-schema/node_modules/` (Phase 9/10/12 pattern) |
| **Config file** | none — invariants inline in verify.mjs per phase |
| **Quick run command** | `node .planning/phases/13-governance/verify.mjs` |
| **Full suite command** | `node .planning/phases/09-atc-147-evidence/verify.mjs && node .planning/phases/10-gate-policy/verify.mjs && node .planning/phases/12-machinery/verify.mjs && node .planning/phases/13-governance/verify.mjs` (all four must exit 0) |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** `node verify.mjs` (<1s)
- **After every plan wave:** full suite (all four verifiers green)
- **Before `/gsd-verify-work`:** full suite green
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map (27 tasks)

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command |
|---------|------|------|-------------|-----------|-------------------|
| 13-04-01 | 04 | 1 | GOV-03 | grep | `grep -c "^## Falsifier\|^## Dead Ends" super-gsd/templates/decision-memo.md` ≥ 2 |
| 13-04-02 | 04 | 1 | GOV-07 | grep | `grep -q "^## Post-Synthesis Reflection" super-gsd/templates/decision-memo.md` |
| 13-04-03 | 04 | 1 | GOV-03+07 | integration | `node verify.mjs` (invariant 10) |
| 13-05-01 | 05 | 1 | D-18b | probe | VTP classification probe via `ToolSearch` — determine tier (Milestone/arbitrary/fixed) |
| 13-05-02 | 05 | 1 | D-16 | grep | `ls super-gsd/skills/sgsd-complete-milestone/SKILL.md` |
| 13-05-03 | 05 | 1 | D-16 steps 1-4 | unit | skill template has 8 steps; precondition + GOV-05 + MUDA + cross-phase sections present |
| 13-05-04 | 05 | 1 | D-18a | integration | `grep -q "all milestone phases" super-gsd/skills/sgsd-orchestrate/SKILL.md` AND `grep -q "Step 6.7" sgsd-orchestrate/SKILL.md` |
| 13-05-05 | 05 | 1 | D-18b | unit | VTP 3-tier fallback logic testable via `--dry-run` flag |
| 13-01-01 | 01 | 2 | GOV-04 | unit | `node -e "require('./super-gsd/scripts/lib/board-registry.cjs').loadBoard()"` |
| 13-01-02 | 01 | 2 | GOV-04 | unit | `node -e "require('./super-gsd/scripts/lib/vote-predicate.cjs').evalEscalation({...})"` |
| 13-01-03 | 01 | 2 | GOV-01 | grep | `grep -q "escalation_policy:" super-gsd/registry/board-members.yaml` AND `state: active` |
| 13-01-04 | 01 | 2 | GOV-01+04 | integration | `node verify.mjs` (invariants 1-5) |
| 13-02-01 | 02 | 3 | GOV-02 | unit | `node -e "require('./super-gsd/scripts/lib/vote-synthesis.cjs').synthesize([...]).decision"` |
| 13-02-02 | 02 | 3 | GOV-02 | unit tiebreak | synthesize returns `tiebreaker_applied: true` when sum==0 |
| 13-02-03 | 02 | 3 | GOV-02 | integration | `node verify.mjs` (invariants 6-7) |
| 13-03-01 | 03 | 4 | GOV-06 | grep | all 4 `super-gsd/agents/sgsd-board-*.md` include 10-field YAML response schema |
| 13-03-02 | 03 | 4 | GOV-06 | unit | `node -e "require('./super-gsd/scripts/lib/deliberation-schema.cjs').validate(validYaml).valid === true"` |
| 13-03-03 | 03 | 4 | GOV-06 | unit reject | `validate(malformedYaml).valid === false` |
| 13-03-04 | 03 | 4 | GOV-06 | integration | `node verify.mjs` (invariants 8-9) |
| 13-06-01 | 06 | 5 | GOV-02 retro DLB-01 | rescore | 4 parallel board agent dispatches on DLB-01 brief; write DLB-01-RESCORE.md |
| 13-06-02 | 06 | 5 | GOV-02 retro DLB-02 | rescore | same pattern for DLB-02 |
| 13-06-03 | 06 | 5 | GOV-02 retro DLB-03 | rescore | DLB-03 |
| 13-06-04 | 06 | 5 | GOV-02 retro DLB-04 | rescore | DLB-04 |
| 13-06-05 | 06 | 5 | GOV-02 retro DLB-05 | rescore | DLB-05 |
| 13-06-06 | 06 | 5 | GOV-02 retro DLB-06 | rescore | DLB-06 |
| 13-06-07 | 06 | 5 | D-05b | integration | divergence summary: compare old vs new decisions across 6 DLBs |
| 13-07-01 | 07 | 6 | all | full-suite | all four verify.mjs (09+10+12+13) exit 0; invariants 11-16 green |

---

## Wave 0 Requirements

- [ ] `.planning/phases/13-governance/verify.mjs` — 16 invariants (expanded from D-21 floor of 10)
- [ ] `super-gsd/scripts/lib/board-registry.cjs` — new (~50 LOC, mirror of gates-registry.cjs)
- [ ] `super-gsd/scripts/lib/vote-predicate.cjs` — new (~40 LOC, array-iteration predicate evaluator; SEPARATE from Phase 10 predicate-eval.cjs per research finding)
- [ ] `super-gsd/scripts/lib/vote-synthesis.cjs` — new (~40 LOC, signed-sum pure function)
- [ ] `super-gsd/scripts/lib/deliberation-schema.cjs` — new (~40 LOC, 10-field YAML validator)
- [ ] `super-gsd/skills/sgsd-complete-milestone/SKILL.md` — new (skill file with 8-step workflow + VTP 3-tier logic)
- [ ] No new framework install — reuses js-yaml@4.1.1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GOV-07 reflection quality | Reflection section content is substantive, not boilerplate | LLM text quality can't be asserted programmatically beyond "section exists + > 50 chars" | Operator reads at least one DLB's reflection section post-v1.2 close and confirms it names real blind spots |
| VTP publish round-trip | Published milestone artifact is actually queryable from VTP | VTP side-effect, depends on MCP response | Operator runs `mcp__vtp-kb__vtp_search "v1.2 Evidence-First"` after milestone close — should return the published item |
| D-18a auto-trigger fires | Orchestrator really dispatches sgsd-complete-milestone on last-phase close | In-session proof requires actually closing Phase 13 | Verified in this session's own v1.2 close |

---

## Validation Sign-Off

- [ ] All 27 tasks have automated verify OR Wave 0 dependencies OR manual test path
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (retro tasks 13-06-01..06 are each rescore dispatches — treated as separate verify points)
- [ ] Wave 0 covers 5 new files (4 lib + 1 skill)
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set post-planner confirmation

**Approval:** pending — gsd-planner to confirm task IDs during plan generation

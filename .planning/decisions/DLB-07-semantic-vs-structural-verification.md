---
type: post-mortem-decision
date: 2026-05-18
trigger: Clarity ERP audit-gate incident — six phases closed PASS while end-to-end behaviour broken
board: none (no deliberation; operator-mandated process gate from concrete failure)
decision: "Mechanically enforce semantic acceptance criteria in the v2 plan schema. Plans missing real-data semantic ACs fail validation. Phased rollout: P97.5 ships schema + validator; audit-gate enforcement and v22 re-audit deferred to follow-up phases."
---

# DLB-07: Semantic vs Structural Verification

## The Incident

On 2026-05-18, while running a re-audit on the Clarity ERP project, the operator discovered that the audit-gate built across six closed phases (v22-09 through v22-13) did not work end-to-end. SO 130018965 — a real, closed-and-invoiced sales order with a present Quotation, DeliveryNote and Invoice in its chain — returned `overall_verdict: FAILED` from the engine. Re-running the pipeline against current Mongo data did not fix it. The bugs were logic bugs in the audit-gate evaluators, not stale-data bugs.

Five distinct evaluator-logic problems were uncovered:
1. Probe failures were global, not per-SO. One bad-prefix invoice somewhere in 55k blocked every other SO.
2. `chain.quotation_present` evaluator read the wrong field — `originEntry` instead of `baseRefs[]`.
3. Classifier module existed but was never invoked from `audit_gate_run.py`.
4. `v22_12_reason_codes` lived in a nested struct the UI widget couldn't see.
5. Ownership inference skipped blocked docs entirely.

None of this should have shipped under SGSD-style closes.

## Why The Audits Caught Nothing

Every phase audit verified shape, not meaning:

- "Does the envelope JSON have `schema_version="1.0.0"`?" ✓
- "Does the writeback set `v22_12_review_state`?" ✓
- "Is the field written for 14/14 SOs?" ✓
- "Are out-of-scope leaks zero?" ✓

None of them asked: "for SO 130018965, does the engine return PASS?" — the single assertion that would have failed on every commit since the engine landed.

### Five reasons it slipped through

1. **Tests used fixtures, not Mongo.** v22-10 tests used `FakeCollection` with synthesized chain data. They proved the engine did what it was coded to do, not what it should do for real SAP B1 documents.
2. **Phase isolation broke end-to-end thinking.** v22-09 verified probes wrote verdicts. v22-10 verified engine read probes. v22-12 verified writeback to Mongo. No phase verified the chain end-to-end on a real document.
3. **Probe failures masked logic failures.** The 2026-05-14 probes failed (most of them). Defensive blocking everything looked correct, so nobody dug into the per-SO chain evaluators.
4. **The operator-screenshot gate was perpetually deferred.** Both v22-13a and v22-13b had "operator captures live screenshot" as the final AC. Neither was actually done — both closed WARN with the screenshot as post-close follow-up. The one human-eyeball gate was punted every time.
5. **The 14/14 should have been the alarm.** 14/14 at 100% blocked across a random Mongo sample is statistically impossible. The phase close treated it as a data observation, not a smell.

## The Decision

Three enforcement rules apply at three SGSD touch points. Rule 1 is the only one mechanically enforced in P97.5; Rules 2 and 3 are documented here and become enforceable when their host artifacts get canonical source in this repo.

### Rule 1 — Plan-check rejects structural-only plans (P97.5 scope)

The v2 plan schema gains a required plan-level array:

```yaml
semantic_acceptance_criteria:
  - input: "SO 130018965 (real Mongo doc)"
    expected_outcome: "overall_verdict == PASS"
    verification_cmd: "python audit_gate_run.py --so 130018965"
```

Validation rules:
- **SCHEMA-09**: array absent or empty → reject
- **SCHEMA-10**: any entry missing `input`, `expected_outcome`, or `verification_cmd` → reject
- The verification command must run against real data (production Mongo doc, real API response, real file on disk). Fixtures don't count. This rule is enforced by the plan author and reviewed at plan-check, not parsed by the validator.

### Rule 2 — Phase verification treats uniform results as alarms (deferred enforcement)

100% / 0% / 14-of-14 / "all probes failed" / "all docs blocked" — any uniform result across a non-trivial sample is suspicious until explained. The verifier must demand a written explanation before close. Soft rule today; mechanical enforcement requires a verifier hook that doesn't exist yet.

### Rule 3 — Operator-eyeball ACs are DONE or the phase is REMEDIATION (deferred enforcement)

If a phase's acceptance criteria include "operator captures screenshot" or any human verification step, that step is DONE before close or the phase is REMEDIATION (not PASS / not WARN). No more "post-session follow-up" punts. Soft rule today; mechanical enforcement requires the audit-gate skill (`sgsd-audit`) to have canonical source in this repo first.

## Layered Protection Plan

| Layer | Where it lives | Status |
|---|---|---|
| 1. Claude auto-memory | `~/.claude/projects/.../memory/` | Local-only protection on this machine. **Not** a primary defense. |
| 2. **DLB-07 in git** | `.planning/decisions/DLB-07-*.md` | **This document.** Every future agent reading the repo sees the rule. |
| 3. **Schema-level mechanical enforcement** | `super-gsd/templates/plan-schema-v2.json` + `super-gsd/tools/plan-schema/validate.cjs` | **P97.5 deliverable.** Plans without semantic ACs reject at write-time and load-time. |
| 4. SGSD memory entry | `.planning/memory/architecture/patterns/semantic-vs-structural-verification.md` | **P97.5 deliverable.** Orchestrator sees the rule at session start. |
| 5. Audit-gate close enforcement | `super-gsd/skills/sgsd-audit/SKILL.md` (canonical source must first be added) | **Deferred** — `sgsd-audit` currently has no source in this repo, only an installed copy at `~/.claude/commands/sgsd-audit/SKILL.md`. Adding canonical source is a separate phase. |
| 6. Re-audit existing v22 phases against new rule | Clarity-side, not this repo | **Out of scope here.** |

Layer 3 is the load-bearing change. Layers 1, 2, 4 are documentation that future-Claude reads but cannot be forced to obey. Layer 5 would make phase close itself impossible without a passing semantic AC, but it depends on a prior phase that doesn't exist yet.

## Backfill Implication

Every existing v2.9 plan written before P97.5 lands will fail validation after the schema change. P97.5 audits the gap (`97.5-BACKFILL.md`) but does **not** modify existing plans. Backfill is per-phase work: the owning phase author writes a semantic AC against real data, or the phase is forced through `skip_gates` with operator sign-off.

## Cross-References

- `.planning/memory/architecture/patterns/semantic-vs-structural-verification.md` — operator-facing rule, session-start visibility
- `.planning/milestones/v2.9/phases/97.5-semantic-verification-gate/97.5-CONTEXT.md` — phase scaffold
- `super-gsd/templates/plan-schema-v2.json` — where Rule 1 lives mechanically (after P97.5)
- `super-gsd/tools/plan-schema/validate.cjs` — SCHEMA-09 / SCHEMA-10 emit site
- Clarity ERP transcript 2026-05-18 (operator clipboard, not in this repo) — incident source

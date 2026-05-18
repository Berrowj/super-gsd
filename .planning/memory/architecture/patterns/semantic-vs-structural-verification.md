---
title: Semantic vs Structural Verification — Plans Without Real-Data ACs Cannot Close
tags: [dlb-07, plan-schema, verification, audit-gate, phase-close, anti-bloat]
importance: 95
maturity: ratified
created: 2026-05-18T00:00:00Z
source_incident: Clarity ERP audit-gate 2026-05-18 — six phases closed PASS while end-to-end behavior broken
---

## The Rule

Every PLAN.md must declare at least one **semantic acceptance criterion** that runs against real data and produces a falsifiable verdict. Mechanically enforced by `super-gsd/tools/plan-schema/validate.cjs` after P97.5 lands (`SCHEMA-09` / `SCHEMA-10`).

## How to apply it

**At plan-write time** (sgsd-write-plan, gsd-planner):
- Reject any plan whose acceptance criteria are 100% structural ("field exists", "test passes", "returns 200", "schema_version is X").
- Demand at least one entry of shape:
  ```yaml
  semantic_acceptance_criteria:
    - input: "<real production record / real file / real API call>"
      expected_outcome: "<user-visible behavior that matches reality>"
      verification_cmd: "<command that exercises the real system, not fixtures>"
  ```
- Phrase the AC adversarially: "what would make this fail if the implementation is wrong?" — not "what proves the code we wrote works".

**At verification time** (phase verifier, sgsd-audit when its source lands):
- Treat uniform results as alarms. 14/14, 100%, 0% delta, "all probes failed", "all docs blocked" — suspicious until explained. Demand investigation before close, not data observation.

**At phase-close time** (DLB-03 close cascade):
- Operator-screenshot ACs are **DONE** or the phase is **REMEDIATION** (not PASS, not WARN). No more "post-session follow-up" punts. If a human eyeball is the only thing that can verify the AC, the human eyeball happens before close.

## Why

On 2026-05-18 the Clarity ERP project surfaced six consecutive phases (v22-09 through v22-13) that all closed PASS while the audit-gate they were building did not work end-to-end. SO 130018965 — a real closed-and-invoiced sales order with present Quotation, DeliveryNote, Invoice — returned `overall_verdict: FAILED`. Re-running pipelines did not fix it. The bugs were logic bugs in chain evaluators (reading wrong fields), per-SO scoping (global-AND instead of per-record), and ungated wiring (classifier existed but never invoked).

The audits caught nothing because they measured shape, not meaning. One line — `assert run_audit(so_130018965).overall_verdict == "PASS"` — would have failed on every commit since the engine landed.

The 14/14 at 100% blocked across a random sample was statistically impossible and would have flagged the broken engine immediately. It was logged as a successful verification.

## Cross-references

- `.planning/decisions/DLB-07-semantic-vs-structural-verification.md` — full post-mortem and three-rule plan
- `.planning/milestones/v2.9/phases/97.5-semantic-verification-gate/97.5-CONTEXT.md` — phase that ships Rule 1 mechanically
- `super-gsd/templates/plan-schema-v2.json` — where the field lives after P97.5
- `[[orchestrator-patterns]]` — orchestrator must read this rule at plan-check before dispatching Codex
- `[[muda-read-path-spec]]` — sibling MUDA/anti-waste pattern from DLB-05

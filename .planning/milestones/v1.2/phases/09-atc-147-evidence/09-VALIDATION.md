---
phase: 9
slug: atc-147-evidence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

> **Phase type:** Evidence/audit — output is YAML artifacts, not executable code. Validation is mechanical (parse + arithmetic assertions), not test-framework-based. See §Manual-Only Verifications for the one step that cannot be mechanically verified.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node-based ad-hoc assertions (`super-gsd/tools/plan-schema/` pattern) |
| **Config file** | none — reuses `super-gsd/tools/plan-schema/node_modules/` (js-yaml + gray-matter already present) |
| **Quick run command** | `node super-gsd/tools/evidence-verify/verify.mjs .planning/phases/09-atc-147-evidence/09-classification.yaml` |
| **Full suite command** | Same as quick — phase has exactly one structured artifact to verify |
| **Estimated runtime** | ~0.5 seconds |

---

## Sampling Rate

- **After every task commit:** Re-run verifier against committed YAML if that task modified it
- **After every plan wave:** Verifier returns exit 0
- **Before `/gsd-verify-work`:** Verifier green + grep confirms external SHA pin + milestone evidence registry pointer exists + v1.2 INTENT.md exists
- **Max feedback latency:** < 2 seconds

---

## Per-Task Verification Map

*Exact task IDs will be filled by the planner when PLAN.md lands. Current structure anticipates the researcher-recommended 2-plan split (classification + registry / gate-bypass audit) but the planner can add a third plan for INTENT.md + milestone dir bootstrap if clarity benefits.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-01-T1 | 01 | 1 | ATC-147-01 | N/A (read-only classification) | N/A | structured-yaml | `node super-gsd/tools/evidence-verify/verify.mjs .planning/phases/09-atc-147-evidence/09-classification.yaml` | ❌ W0 | ⬜ pending |
| 9-01-T2 | 01 | 2 | ATC-147-02 | N/A | N/A | grep-assertion | `grep -q "external_repo_pin:" .planning/milestones/v1.2/evidence/147-review.md && grep -q "ca5be16b" .planning/milestones/v1.2/evidence/147-review.md` | ❌ W0 | ⬜ pending |
| 9-02-T1 | 02 | 1 | ATC-147-03 | N/A | N/A | structured-yaml | `node super-gsd/tools/evidence-verify/verify.mjs .planning/phases/09-atc-147-evidence/09-gate-bypass.yaml` | ❌ W0 | ⬜ pending |
| 9-03-T1 | 03 | 1 | N/A (deviation-closure) | N/A | N/A | grep-assertion | `grep -q "outcome_delivered:" .planning/milestones/v1.2/INTENT.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `super-gsd/tools/evidence-verify/verify.mjs` — mechanical parser + assertion runner (~30 LOC per research). Asserts: `findings_detail.length === 10`, `headline_finding_count === real_bloat + integration_gap`, sum of bucket counts === 10, audit has 9 rows with all 9 gate names present, external_repo_pin field present and matches the ca5be16b..c41634c4 range.
- [ ] `.planning/milestones/v1.2/` directory exists (does not exist yet — per checkpoint deviation log).
- [ ] `.planning/milestones/v1.2/evidence/` directory exists.
- [ ] js-yaml + gray-matter already installed via `super-gsd/tools/plan-schema/node_modules/` — reuse, do NOT reinstall.

*Dependencies: reuse existing Node tooling pattern from `super-gsd/tools/plan-schema/validate.cjs`. No new framework.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Bucket assignment sanity (W1/W2 → integration-gap, W3/W4 → real-bloat, I1/I2 → false-positive, I3/I4/I5/I6 → nit) | ATC-147-01 | Bucket assignment is a judgment call the Sonnet classifier makes; verifier can assert count totals but not whether "W1 → integration-gap" was the right judgment. Manual spot-check of `findings_detail[].bucket` field against the recommended mapping from 09-RESEARCH.md §Q7 resolves this. | Read `09-classification.yaml`, scan the 10 rows, confirm each bucket assignment matches research-recommended mapping. If drift: either update classifier prompt or accept deviation with justification. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (Phase 9 has only 4 tasks — trivially satisfied)
- [ ] Wave 0 covers all MISSING references (verify.mjs + milestone dirs)
- [ ] No watch-mode flags (phase has no long-running processes)
- [ ] Feedback latency < 2s (YAML parse + assertion is sub-second)
- [ ] `nyquist_compliant: true` set in frontmatter after Wave 0 lands

**Approval:** pending

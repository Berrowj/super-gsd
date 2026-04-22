# Phase 9: ATC-147-Evidence — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 09-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 09-atc-147-evidence
**Areas discussed:** Classification taxonomy & judge, Finding-count output format, Gate-bypass audit scope & token costs, Evidence registry location & versioning

**Discussion mode:** single batched AskUserQuestion round with recommended defaults. Operator initially selected "No preference" on the area-selection gate → orchestrator took all 4 areas and drove them with recommended defaults. Operator confirmed the recommendations via a second AskUserQuestion with explicit per-area choices.

---

## Area 1 — Classification Taxonomy

**Question:** How should Phase 9 bucket the 10 Phase-147 findings?

| Option | Description | Selected |
|--------|-------------|----------|
| 4-bucket: real-bloat / nit / false-positive / integration-gap | Adds integration-gap because W1 (OwnerLookup orphan) + W2 (SLA orphan) are integration concerns, not bloat. Prevents inflating Phase 10's bloat-trigger threshold with qualitatively different signal. | ✓ |
| 3-bucket strict: real-bloat / nit / false-positive | Stick to REQUIREMENTS.md literal language. W1/W2 force-mapped to 'real-bloat' (a stretch). Simpler matrix, loses signal. | |
| 5-bucket: add integration-gap AND code-hygiene | Splits W3/W4 (dead imports, duplication) from W1/W2 (integration) from I1–I6 (info). Most granular. Risk: Phase 10's matrix threshold logic harder to parameterise. | |

**User's choice:** 4-bucket.
**Notes:** Primary rationale — Phase-147's two integration gaps (W1 OwnerLookup, W2 SLA) are orphan-wiring concerns that don't match the ATC framework's "bloat" semantics. Forcing them into real-bloat would distort Phase 10's threshold math.

---

## Area 2 — Finding-Count Output Format

**Question:** What format should Phase 9 emit for Phase 10 consumption?

| Option | Description | Selected |
|--------|-------------|----------|
| Structured table + headline number | Single headline int (total WARN+CRIT = 4 for Phase 147) + structured YAML table keyed by bucket. Both simple keep/kill trigger AND per-bucket drill-down. | ✓ |
| Single number only | Just '4 findings' as an integer. Simplest, but loses ability to set per-bucket rules later. | |
| Per-gate would-have-caught table | Each of the 9 bypassed gates gets a row. Answers Phase 10's question directly but inference-heavy — ATC-147 was phase-level, attributing to per-dispatch gates is speculative. | |

**User's choice:** Structured table + headline number.
**Notes:** Headline int = count of `real-bloat + integration-gap` ONLY (not nits, not false-positives). This matches the REQUIREMENTS "≥3 / 1–2 / 0 thresholds" language while preserving the per-bucket breakdown for Phase 10 to drill into.

---

## Area 3 — Gate-Bypass Audit Token-Cost Methodology

**Question:** How should token costs be estimated for the 9 bypassed gates?

| Option | Description | Selected |
|--------|-------------|----------|
| Theoretical per-dispatch from orchestrator config | Read .planning/config.json + sgsd-orchestrate/SKILL.md per-step token budgets (classifier ~50, context-selector ~100, per-dispatch ATC ~300, phase-ATC ~600, etc.), multiply by Phase-147's 16 T-commits. Reproducible. | ✓ |
| Re-simulate on Phase-147 commits | Actually run each gate against commit range. Highest fidelity but expensive, agent non-determinism, cross-repo boundary fragility. | |
| Reasoned estimate per gate, per orchestrator spec | Free-form Claude estimate per gate. Lowest effort, lowest precision. | |

**User's choice:** Theoretical per-dispatch from orchestrator config.
**Notes:** Anchored to framework spec → reproducible. Re-simulation ruled out because cross-repo boundary + non-determinism make replays unreliable. Per-gate audit row includes `fired_retroactively` bool (phase-level ATC was deferred, not skipped → its cost is deferred-not-zero).

---

## Area 4 — Evidence Registry Location & External Versioning

**Question:** Where does Phase 9's output live, and how is external-repo state captured?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase dir + evidence registry + commit SHA pin | Output in .planning/phases/09-atc-147-evidence/. Registry pointer in .planning/milestones/v1.2/evidence/147-review.md with external commit SHA range. Reproducible + discoverable. | ✓ |
| Phase dir only | No milestone registry. Phase 10 reads directly from phase 9 dir. Simpler, no SHA pin. | |
| Phase dir + symlink to external | Symlink to ../project-clarity-erp/... — Windows-fragile + breaks if repo moves. | |

**User's choice:** Phase dir + evidence registry + commit SHA pin.
**Notes:** SHA range for the pin is `ca5be16b..c41634c4` (from the ATC review's frontmatter). The milestone evidence directory `.planning/milestones/v1.2/evidence/` does not exist yet; Phase 9's plan must include a task to create it AND to author `.planning/milestones/v1.2/INTENT.md` (closes the `INTENT_MISSING` deviation logged in the v1.2 checkpoint).

---

## Claude's Discretion

- Task breakdown inside PLAN.md (number of plans, wave structure, task IDs).
- Whether classification runs as a single Sonnet pass or split per-bucket.
- Verifier implementation (likely mechanical — re-parse YAML and assert bucket counts = finding-detail row count).

## Deferred Ideas

- Re-simulation of gates on Phase-147 commits (too fragile across repo boundary).
- Per-gate would-have-caught inference table (speculative — belongs in Phase 10 deliberation).
- Automated propagation of findings back into external Phase 147 DEVIATIONS.md (out of this repo's scope).
- Wave 2 / Wave 3 ATC reviews for Phase 147 (external project scope).

# Phase 14: Codex CLI Provider Substrate — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `14-CONTEXT.md` — this log preserves the decision path.

**Date:** 2026-04-23
**Phase:** 14-codex-cli-provider-substrate
**Mode:** Remote-control (text mode — no AskUserQuestion)
**Duration:** minimal (single decision — staged context adoption)

---

## Context at start

Pre-staged CONTEXT.md existed at `.planning/proposals/v1.3-multimodal-review/14-CONTEXT.md` from the 2026-04-23 v1.2-close window. Substantively complete — 24 locked decisions (D-01..D-24), 4-plan / 3-wave decomposition (D-21/D-22), 6-invariant verify.mjs contract (D-23), explicit out-of-scope list (D-24).

Parallel BRIEF.md at the same staging path carried 5 Key Questions, 4 of which (Q2-Q5) were explicitly Phase 15 scope per their default answers. Only Q1 was Phase-14-relevant, and Q1's default answer (substrate-first, ships dark) was already locked via D-11/D-18b in the staged CONTEXT.

**Additional context since the pre-stage was written:** Phase 16 (VTP Enrichment as Cross-Phase Primitive) shipped on 2026-04-23 between the staged-context-draft and this discuss-phase invocation. Phase 16 landed `super-gsd/scripts/lib/vtp-context-composer.cjs`, the `callVtp` wrapper, `VTP-EVIDENCE.md` per-phase framing artifact, and `sgsd-triage` Step 0 enrichment. This raised one new question not contemplated in the staged Phase-14 design: should the Codex reviewer agent / `codex-exec.sh` wrapper consume `VTP-EVIDENCE.md` for cross-project pattern awareness?

---

## The single gray area discussed

### Area: Adoption disposition of the staged CONTEXT.md in light of post-Phase-16 VTP availability

| Option | Description | Selected |
|---|---|---|
| A. Adopt staged context as-is + add one Phase-16 deferral bullet | Move staged artifacts into active milestone layout; add one `<deferred>` entry routing the VTP-reviewer-consumption question to Phase 15; no changes to D-01..D-24 or plan decomposition. | ✓ |
| B. Re-open 24 decisions for walkthrough | Re-litigate each locked decision against Phase-16-era considerations. ~20-30 min interactive Q&A. | |
| C. Something else — specific D-NN reopening, or scope reshape | Pick-targeted reopening for the subset of decisions Phase 16 shipping could plausibly affect. | |

**User's choice:** A.
**Notes:** Rationale — 24 decisions already locked with evidence-backed rationale, 4/5 BRIEF Key Questions are Phase 15 territory, Phase 14 is explicitly "substrate, zero behaviour change" per D-11/D-24, and Phase 16's primitive can be consumed when Phase 15's live-routing flip actually needs it. Forward-compatible VTP wiring in Phase 14 would pre-commit Phase 15's design without routing pressure to pick the right shape.

**Decision recorded as adoption disposition — CONTEXT.md D-01..D-24 unchanged. One new `<deferred>` bullet added describing the VTP-consumption question and its Phase-15 routing.**

---

## Deferred additions from this session

- **VTP evidence consumption by Codex reviewer (post-Phase-16 integration).** Captured in `<deferred>`. Phase 15 scope.

---

## Decisions NOT touched (by design)

All 24 D-NN decisions from the pre-stage. Listed here for audit explicitness so future phase-verifier can cross-check:
- CODEX-01 (D-01..D-04): wrapper shape, exit codes, timeout, auth, report contract, Windows WSL path
- CODEX-02 (D-05..D-08): registry schema, registry-loader integration, invocation_type discriminator, operator-gated registry discipline
- CODEX-03 (D-09..D-11): gates.yaml field addition, resolveReviewerProvider method, NO SKILL.md changes
- CODEX-04 (D-12..D-13): agent stub shape, new `invocation: shell` frontmatter field, report contract referenced from registry
- CODEX-05 (D-14..D-17): contract-check harness, toy-diff fixture shape, divergence-is-informational, Phase-14-verifier invariant inclusion
- CODEX-06 (D-18..D-20): config block shape, kill-switch semantics, auto-detect CLI path, KNOWN_TOP_LEVEL patch
- D-21: 4-plan decomposition
- D-22: 3-wave dispatch plan
- D-23: 6-invariant Phase 14 `verify.mjs` contract
- D-24: out-of-scope explicit list

---

## Session Metadata

- **Pre-discussion commits:** (none for this phase — staged artifacts were untracked under `.planning/proposals/`)
- **Activation commit:** `8b5c6b6 docs(14): activate staged Phase 14 context + Phase 16 deferral addendum`
- **Mode:** Remote-control text mode
- **Operator standing order:** "Accept recommendations unless scope-altering" (from `/sgsd-discuss-phase 16` session, saved to memory)

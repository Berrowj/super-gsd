---
phase: "149"
slug: skill-routing-table
milestone: v3.5
status: PENDING
design_ref: ".planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md#p149"
depends_on: ["146"]
---

# P149 Context — Skill-Routing Table (utilization)

## Goal

One source of truth — `super-gsd/registry/skill-routing.yaml` — maps intent
signatures to SGSD skills so the neglected inventory actually gets invoked.
Consumed by the P146 classifier (prompt-time suggestions in manual sessions)
and by the orchestrate loop (scheduled dispatch moments in auto mode). The
routing prose in sgsd-orchestrate SKILL.md is replaced by a reference to the
table (board addendum: routing is a runtime dispatch decision, not documentation).

## Table shape (per skill)

- `skill`: name
- `signatures`: trigger phrases/regexes (prompt-time) and/or event moments
- `moment`: prompt-time | phase-close | milestone-close | weekly | on-demand
- `modes`: [manual, semi, auto] applicability
- `cooldown`: optional (e.g. muda-audit fires at phase close only when
  files_changed>=4 OR diff_lines>=100 — existing rule, encoded not prosed)

## Neglected inventory to cover (minimum)

sgsd-muda-audit, sgsd-token-audit, sgsd-distill, sgsd-sepl, sgsd-overwatcher,
sgsd-readiness, sgsd-audit, sgsd-health/gsd-health, gsd-cleanup,
sgsd-memory hygiene (sgsd-recall/curate discipline), sgsd-vtp-advise,
gsd-code-review / gsd-code-review-fix, gsd-verify-work, gsd-secure-phase.

## Constraints

- Schema-validated in self-test; a malformed table fails self-test, not runtime
  (runtime falls back to embedded lexicon + logs).
- Orchestrate loop consumption: at phase close the loop MUST consult the table
  and log which scheduled skills fired or the reason skipped (AC-149c) — the
  log row is the enforcement.
- P146 ships with an embedded lexicon; this phase externalizes it — one source
  after P149, no dual maintenance.

## Acceptance criteria

AC-149 (a)(b)(c) from the design spec.

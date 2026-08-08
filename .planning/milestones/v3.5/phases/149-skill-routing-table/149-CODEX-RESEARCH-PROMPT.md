# P149 RESEARCH — Skill-Routing Table (utilization)

<intent milestone="v3.5">SGSD governance must be a runtime mechanism, not prose — gates/MUDA/triage/skill routing fire in every session type with evidence logged loudly when they do not.</intent>

You are the Codex phase researcher (read-only). Produce .planning/milestones/v3.5/phases/149-skill-routing-table-style RESEARCH findings that a planner can turn directly into a locked plan. Read the repo yourself; cite file:line for every claim.

## Phase goal (from CONTEXT.md)
## Goal

One source of truth — `super-gsd/registry/skill-routing.yaml` — maps intent
signatures to SGSD skills so the neglected inventory actually gets invoked.
Consumed by the P146 classifier (prompt-time suggestions in manual sessions)
and by the orchestrate loop (scheduled dispatch moments in auto mode). The
routing prose in sgsd-orchestrate SKILL.md is replaced by a reference to the
table (board addendum: routing is a runtime dispatch decision, not documentation).

## Table shape (per skill)

## Questions to answer with evidence
1. P146 embedded lexicon: exactly where does the classifier hold its skill-suggestion lexicon (file:line), what is its data shape, and what seam exists for swapping to an external registry (the checkpoint says: classifier swap = REGISTRY_SOURCE_PATH one-liner — verify or refute)?
2. Existing registry precedent: how does super-gsd/registry/gates.yaml get loaded/validated (gates-registry.cjs)? What loader/validation pattern should skill-routing.yaml reuse? Is there a YAML parser dependency already vendored, or do registries use a hand-rolled parser?
3. Orchestrate-loop consumption seam: where in sgsd-orchestrate SKILL.md / orchestrator-hooks.cjs is the phase-close moment where the loop must consult the table and log fired/skipped rows (AC-149c)? What existing JSONL ledger should the log row reuse?
4. Routing prose to replace: which lines of sgsd-orchestrate SKILL.md contain skill-routing prose that the table supersedes?
5. Self-test pattern: which existing self-test (gates-registry, edge-guard, dispatch-router) is the closest analog for schema-validating skill-routing.yaml, and what fallback behavior (malformed table -> embedded lexicon + log) do the constraints require?
6. The full neglected-inventory list from CONTEXT.md: for each skill, what trigger moment/cooldown is already encoded somewhere (e.g. muda gate trigger in gates.yaml) vs needs new definition?

## Acceptance criteria source
Read .planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md section p149 and quote AC-149 (a)(b)(c) verbatim in the report.

## Report format
Markdown, max ~150 lines: ## Findings (numbered, file:line cited), ## AC-149 verbatim, ## Risks, ## Recommended plan shape (tasks with files_touched). No prose padding.

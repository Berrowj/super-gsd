# P149 PLANNING — Skill-Routing Table (self-contained; do NOT browse the repo beyond the 3 files listed)

<intent milestone="v3.5">SGSD governance must be a runtime mechanism, not prose — gates/MUDA/triage/skill routing fire in every session type with evidence logged loudly when they do not.</intent>

You are the Codex planner (gpt-5.5/xhigh). EVERYTHING you need is inlined below — research already read the repo and cited findings; trust them. You MAY read only these 3 files if needed: super-gsd/hooks/sgsd-intent-classifier.cjs, super-gsd/scripts/lib/gates-registry.cjs, super-gsd/tools/dispatch-router/route.cjs. Emit ONLY the plan file content (YAML frontmatter schema_version: 2 + body) to stdout. Work fast; total budget ~4 minutes.

## CONTEXT.md (verbatim)
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

## RESEARCH (verbatim, 24 cited findings + AC-149 + risks + recommended shape)
---
phase: "149"
artifact: RESEARCH
provider: openai-codex (gpt-5.5/xhigh)
wrapper_exit: 6 (contract-vocab mismatch; body valid — stderr stream stripped)
---


## Findings

1. Canonical phase path is `.planning/milestones/v3.5/phases/149-skill-routing-table/CONTEXT.md`, not `149-skill-routing-table-style`; frontmatter sets phase `149`, slug `skill-routing-table`, status `PENDING`, and dependency `146` (`.planning/milestones/v3.5/phases/149-skill-routing-table/CONTEXT.md:1`).

2. P149’s required table source is `super-gsd/registry/skill-routing.yaml`; required fields are `skill`, `signatures`, `moment`, `modes`, and `cooldown` (`.planning/milestones/v3.5/phases/149-skill-routing-table/CONTEXT.md:12`, `.planning/milestones/v3.5/phases/149-skill-routing-table/CONTEXT.md:21`).

3. P146’s live classifier does not hold a JS `DEFAULT_SIGNATURES` lexicon; it points at `super-gsd/registry/session-governance-hooks.yaml` via `REGISTRY_SOURCE_PATH` (`super-gsd/hooks/sgsd-intent-classifier.cjs:20`) and parses `routes` with `trigger`, `predicate`, and `enforcement` sections (`super-gsd/hooks/sgsd-intent-classifier.cjs:127`, `super-gsd/registry/session-governance-hooks.yaml:1`).

4. The current neglected-skill prompt lexicon is in `session-governance-hooks.yaml`: `/sgsd-token-audit`, `/sgsd-muda-audit`, and `/sgsd-deliberate` are suggestion routes (`super-gsd/registry/session-governance-hooks.yaml:42`, `super-gsd/registry/session-governance-hooks.yaml:51`, `super-gsd/registry/session-governance-hooks.yaml:64`).

5. The “classifier swap = REGISTRY_SOURCE_PATH one-liner” claim is only true if P149 emits the old `routes[].trigger/predicate/enforcement` shape; the desired P149 shape is per-skill routing metadata, which the current parser and validator do not understand (`super-gsd/hooks/sgsd-intent-classifier.cjs:203`, `.planning/milestones/v3.5/phases/149-skill-routing-table/CONTEXT.md:21`).

6. `gates.yaml` registry precedent uses `js-yaml`, not a hand parser: `gates-registry.cjs` loads the pinned dependency, reads YAML, requires `parsed.gates` to be an array, caches by name, and validates repair/sampling fields (`super-gsd/scripts/lib/gates-registry.cjs:38`, `super-gsd/scripts/lib/gates-registry.cjs:55`, `super-gsd/scripts/lib/gates-registry.cjs:75`).

7. YAML parser dependency already exists in both root and plan-schema package manifests (`package.json:20`, `super-gsd/tools/plan-schema/package.json:7`). P149 should reuse `js-yaml`; the hand parser is classifier-local (`super-gsd/hooks/sgsd-intent-classifier.cjs:127`).

8. Closest runtime fallback analog is dispatch-router: malformed/missing YAML falls back to compiled routes (`super-gsd/tools/dispatch-router/route.cjs:140`, `super-gsd/tools/dispatch-router/route.cjs:319`). Gates registry is fail-fast, which fits gate policy but not P149 runtime fallback (`super-gsd/scripts/lib/gates-registry.cjs:40`).

9. Existing canonical ledger for fired/skipped rows should be `.planning/metrics/gate-evidence.jsonl`; its writer defines append-only command-envelope-v1 rows and explicitly says public APIs never throw upward (`super-gsd/scripts/lib/gate-evidence-log.cjs:1`, `super-gsd/scripts/lib/gate-evidence-log.cjs:87`).

10. P146 already logs routing decisions and degraded registry reads through gate-evidence rows (`super-gsd/hooks/sgsd-intent-classifier.cjs:35`, `super-gsd/hooks/sgsd-intent-classifier.cjs:368`).

11. Orchestrate phase-close seam is after “Mark phase complete, advance to next phase” and before Step 6.7 milestone completion; that is where AC-149c should consult `skill-routing.yaml` for phase-close scheduled rows (`super-gsd/skills/sgsd-orchestrate/SKILL.md:1822`, `super-gsd/skills/sgsd-orchestrate/SKILL.md:1824`).

12. `orchestrator-hooks.cjs` currently exposes only token-waste, context-packet, and self-test commands, so P149 needs a new hook/API for scheduled skill-routing consults (`super-gsd/scripts/lib/orchestrator-hooks.cjs:1`, `super-gsd/scripts/lib/orchestrator-hooks.cjs:40`, `super-gsd/scripts/lib/orchestrator-hooks.cjs:611`).

13. Routing prose superseded by the table includes memory recall/context selection (`super-gsd/skills/sgsd-orchestrate/SKILL.md:670`), MUDA phase-close routing (`super-gsd/skills/sgsd-orchestrate/SKILL.md:1475`), memory-governance phase-close processing (`super-gsd/skills/sgsd-orchestrate/SKILL.md:1767`), curate-learnings routing (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2548`), and token-waste routing (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2565`).

14. P149 malformed-table behavior is explicit: self-test fails, runtime falls back to embedded lexicon and logs degradation (`.planning/milestones/v3.5/phases/149-skill-routing-table/CONTEXT.md:37`, `.planning/milestones/v3.5/phases/149-skill-routing-table/CONTEXT.md:39`).

15. Neglected inventory status: `sgsd-muda-audit` trigger is already encoded in `gates.yaml` and skill docs: phase-close, files changed/diff threshold, non-blocking soft-warn (`super-gsd/registry/gates.yaml:136`, `super-gsd/skills/sgsd-muda-audit/SKILL.md:25`).

16. `sgsd-token-audit` has encoded milestone-close behavior via `sgsd-complete-milestone` and skill modes, plus prompt-time P146 suggestions (`super-gsd/skills/sgsd-token-audit/SKILL.md:17`, `super-gsd/skills/sgsd-complete-milestone/SKILL.md:72`, `super-gsd/registry/session-governance-hooks.yaml:42`).

17. `sgsd-distill` is encoded as milestone-close only in skill/script docs, but not in a central runtime routing registry (`super-gsd/skills/sgsd-distill/SKILL.md:12`, `super-gsd/scripts/sgsd-distill-milestone.sh:3`).

18. `sgsd-sepl` has “major proposal auto-advise” behavior in skill/script docs, but P149 must centralize its trigger/cooldown (`super-gsd/skills/sgsd-sepl/SKILL.md:24`, `super-gsd/scripts/sgsd-sepl-propose.sh:198`).

19. `sgsd-overwatcher` says it can auto-trigger after each phase completion, but that is advisory prose/config, not central routing (`super-gsd/skills/sgsd-overwatcher/SKILL.md:85`).

20. `sgsd-readiness` is already runtime Rule 0 in auto mode; manual entry point points to the same gate (`super-gsd/skills/sgsd-readiness/SKILL.md:14`, `super-gsd/skills/sgsd-orchestrate/SKILL.md:535`).

21. `sgsd-audit` docs say it should run every phase close and be milestone-close blocking, but current orchestrate prose does not expose it through P149’s runtime table (`super-gsd/skills/sgsd-audit/SKILL.md:2`, `super-gsd/skills/sgsd-audit/SKILL.md:418`).

22. `sgsd-memory hygiene` is partly encoded through recall/curate gates and scripts; P149 still needs a single cooldown/moment definition tying recall and curate discipline together (`super-gsd/registry/gates.yaml:106`, `super-gsd/registry/gates.yaml:186`, `super-gsd/scripts/sgsd-recall.sh:3`, `super-gsd/scripts/sgsd-curate.sh:3`).

23. `sgsd-vtp-advise` is ad hoc/operator-triggered, with graceful fail behavior and SEPL promotion path; it needs P149 prompt-time routing definition (`super-gsd/skills/sgsd-vtp-advise/SKILL.md:13`, `super-gsd/skills/sgsd-vtp-advise/SKILL.md:78`, `super-gsd/skills/sgsd-vtp-advise/SKILL.md:132`).

24. Legacy inventory items `sgsd-health/gsd-health`, `gsd-cleanup`, `gsd-code-review / gsd-code-review-fix`, `gsd-verify-work`, and `gsd-secure-phase` need aliases or availability decisions because current architecture skill/script inventory does not list them as first-class skills (`.planning/milestones/v3.5/phases/149-skill-routing-table/CONTEXT.md:33`, `super-gsd/docs/ARCHITECTURE.md:237`).

## AC-149 verbatim

`**AC-149:** (a) the table validates against a schema check in self-test; (b) a prompt matching a neglected-skill signature yields a visible suggestion in a manual session; (c) at phase close in auto mode the loop consults the table and logs which scheduled skills fired or why not.` (`.planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md:142`)

## Risks

1. A pure `REGISTRY_SOURCE_PATH` swap will break unless `skill-routing.yaml` is adapted into P146’s old route shape.
2. Duplicating `gates.yaml` predicates in `skill-routing.yaml` would violate the repo rule against reimplementing gates.
3. Silent fallback would fail AC-149c; fallback must emit gate-evidence degradation and fired/skipped rows.
4. Legacy `gsd-*` inventory names may not be callable without aliasing to current SGSD mechanisms.

## Recommended plan shape

1. Add registry + loader.  
   `files_touched`: `super-gsd/registry/skill-routing.yaml`, `super-gsd/scripts/lib/skill-routing-registry.cjs`.

2. Add schema self-test and compiled fallback.  
   `files_touched`: `super-gsd/scripts/lib/skill-routing-registry.cjs`, optional fixture/self-test file.

3. Adapt P146 classifier to consume prompt-time rows from the new loader.  
   `files_touched`: `super-gsd/hooks/sgsd-intent-classifier.cjs`, `super-gsd/hooks/sgsd-quality-gate.js`, `super-gsd/registry/session-governance-hooks.yaml`.

4. Add orchestrate phase-close consult and gate-evidence logging.  
   `files_touched`: `super-gsd/scripts/lib/orchestrator-hooks.cjs`, `super-gsd/skills/sgsd-orchestrate/SKILL.md`.

5. Replace hardcoded routing prose with references to the runtime table/helper.  
   `files_touched`: `super-gsd/skills/sgsd-orchestrate/SKILL.md`.

6. Verify AC-149.  
   `files_touched`: self-test/CLI only; cover valid schema, malformed fallback + log, manual prompt suggestion, and auto phase-close fired/skipped log.


## VTP enrichment (lineage)
Prior completed VTP idea ide-ce7c-002 (meeting langchain-vs-langgraph 2026-04-09): central process-input node routing to right GSD skill. Cite in Source Audit.

## Plan requirements
- schema_version: 2 frontmatter with tasks[]: id, type, hypothesis, files_touched, verification commands, semantic_acceptance_criteria using REAL-DATA probes (SCHEMA-09/DLB-07).
- 5-6 tasks following the RESEARCH recommended plan shape; serial Codex execution; bounded per-task prompts.
- Resolve risk 1 explicitly: choose adapter-in-loader (skill-routing.yaml per-skill shape; loader adapts to P146 routes[] shape) or parser extension — justify in one paragraph.
- No gates.yaml predicate duplication — reference gate names.
- Runtime fallback: malformed table -> compiled embedded lexicon + gate-evidence degradation row; self-test is where malformed FAILS.
- AC-149c seam: after mark-phase-complete, before Step 6.7; log fired/skipped to gate-evidence.jsonl envelope.
- Legacy gsd-* names: alias-or-omit decision per skill in table content task.
- Source Audit section: CONTEXT / RESEARCH / VTP(ide-ce7c-002) / design-spec rows.

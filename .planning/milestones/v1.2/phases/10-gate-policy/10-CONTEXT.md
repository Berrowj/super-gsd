# Phase 10: Gate Policy — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Prerequisite:** Run `/sgsd-memory-migrate` before planning — migrates `.brv/context-tree/` → `.planning/memory/`. Phase 10 references the new path everywhere.

<domain>
## Phase Boundary

This phase converts Phase 9's empirical evidence into an **enforceable YAML registry** (`super-gsd/registry/gates.yaml`) and an **edge-guard layer** that catches silent skip-drift.

Three concrete deliverables:
1. **Populated `gates.yaml`** — the existing scaffold (`gates: []`) gets filled with 9+ gate rows, each with `enforcement_mode`, `trigger` clauses, `checks`, `reviewer_agent`/`script`, `evidence_emitted`, `fallback`, `source_dlb`, `state`, `version`.
2. **Edge-guard enforcement layer** — a runtime check inside `sgsd-orchestrate` that writes `.planning/metrics/edge-guard-log.jsonl` on every loop step transition with `{from_step, to_step, missing_emits, context, resolution}`, and escalates per-gate per the matrix.
3. **Predicate evaluator** — a small, typed expression engine inside the orchestrator that parses structured `trigger` clauses (`[{field, op, value}]`) against the dispatch context. No string eval, no external predicate file.

**Not in scope:** writing new ATC checks (those live in reviewer agents already); changing the 4-mode vocabulary (scaffold already has `hard-halt`/`soft-warn`/`amortized`/`disabled`); redesigning the scaffold schema.
</domain>

<canonical_refs>
## Canonical References

These are the authoritative inputs for planning and research. Every ref is a full relative path so downstream agents can read them directly.

- `super-gsd/registry/gates.yaml` — existing scaffold with `gates: []` and `_example_entries:` showing expected row shape. Phase 10 populates the empty list.
- `super-gsd/SGSD-v2-MIGRATION-MANIFEST.md` §4.4 — original R-Q2 policy rationale for the 3-tier enforcement (hard/soft/amortized). Scaffold adds `disabled` as a 4th mode for dead/test gates.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — the 9 steps that Phase 10 is gate-policying. Specifically Steps 2, 4, 5, 5.5, 9.5, 6.5, 6.55, 10, 11.
- `.planning/phases/09-atc-147-evidence/09-classification.yaml` — 4-bucket finding split (real_bloat=2, integration_gap=2, nit=4, false_positive=2).
- `.planning/phases/09-atc-147-evidence/09-gate-bypass.yaml` — 9-gate audit with `verdict_pointer_to_phase_10` field per gate. THESE ARE THE OPEN QUESTIONS this phase must resolve.
- `.planning/phases/09-atc-147-evidence/09-ATC-REVIEW.md` — 2 verifier coverage warnings (WR-01 row arithmetic, WR-02 bucket detail-vs-map). Fold into `gates.yaml` as verify-layer gates per D-06.
- `.planning/REQUIREMENTS.md` GATE-01/02/03/04 — success criteria this phase must satisfy.
- `.planning/config.json` — target of the cleanup. Remove legacy `byterover:` block (D-07). `atc:`, `browser_verify:`, `deliberation:` blocks stay as runtime knobs referenced by gates.yaml.
- `super-gsd/scripts/sgsd-recall.sh` + `sgsd-curate.sh` — the real memory interface (reads/writes `.planning/memory/` after migration). Step 5 + Step 10 gates trigger these.
- `.planning/ORCHESTRATOR-CHECKPOINT.md` — has the full Phase 9 → Phase 10 handoff brief.
</canonical_refs>

<decisions>
## Implementation Decisions

### Gate Enforcement Defaults (D-01 through D-09)

Per-gate defaults, aligned to the scaffold's 4-mode vocabulary (`hard-halt` / `soft-warn` / `amortized` / `disabled`) + `trigger` list (structured clauses, implicit AND; fires iff all clauses true; absent trigger = always fires).

- **D-01** — Step 2, Classifier (Haiku): `enforcement_mode: soft-warn`, no trigger. Always runs; logs complexity/routing. 800 tok/phase. Rationale: canonical routing source; cheap enough to unconditionally invoke.
- **D-02** — Step 4, Context-selector (Haiku): `enforcement_mode: soft-warn`, no trigger. Always picks sgsd-recall queries. 1,600 tok/phase. Rationale: always-on upstream of Step 5.
- **D-03** — Step 5, sgsd-recall queries: `enforcement_mode: soft-warn`, `trigger: [{field: classifier.complexity, op: neq, value: trivial}]`. Skip only on trivial dispatches (nothing meaningful to recall). ~9,600 tok/phase when enabled. Rationale: 09-gate-bypass verdict_pointer §5 — "entropy-gating for fresh codebases."
- **D-04** — Step 5.5, INTENT injection: `enforcement_mode: soft-warn`, no trigger. Logs `INTENT_MISSING` when absent, continues. Bootstrap-safe (09-01/02 depended on this to run before 09-03 created v1.2/INTENT.md). 480 tok/phase. Rationale: hard-halt would block legitimate bootstrap cases.
- **D-05** — Step 9.5, Per-dispatch ATC: `enforcement_mode: hard-halt`, `trigger: [{field: classifier.atc_tier, op: in, value: [full, gate]}, {field: code_files_changed_count, op: gt, value: 0}]`. 4,800 tok/phase when full-tier. Rationale: §5 of Phase-147 review: per-dispatch ATC cannot catch cross-task integration gaps (W1/W2), keep scope narrow to intra-task issues.
- **D-06** — Step 6.5, Phase-level ATC: `enforcement_mode: amortized`, no trigger (runs once per phase after gsd-verifier passes). 600 tok/phase. Rationale: paid once on Phase 9, caught WR-01/WR-02 + 1 info finding — clear evidence of value.
- **D-07** — Step 6.55, MUDA audit: `enforcement_mode: soft-warn`, `trigger: [{any: [{field: files_changed, op: gte, value: 4}, {field: diff_lines, op: gte, value: 100}]}, {field: phase_type, op: not_in, value: [docs, config, refactor]}]`. 100 tok/phase. Rationale: mirrors current gating — Phase 9 correctly skipped (evidence-curation phase).
- **D-08** — Step 10, sgsd-curate: `enforcement_mode: soft-warn`, `trigger: [{any: [{field: new_pattern_detected, op: eq, value: true}, {field: script_created, op: eq, value: true}, {field: error_discovered, op: eq, value: true}]}]`. 800 tok/phase when firing. Rationale: curate only when something reusable to save.
- **D-09** — Step 11, token-log: `enforcement_mode: soft-warn`, no trigger. Always writes JSONL row. ~160 tok/phase. Rationale: observability backbone; failure = disk-write issue, not a gate concern.

**Summary totals** with defaults applied: upper-bound ~18,940 tok/phase (all fire full); typical ~9,340 tok/phase (recall skipped on trivial, MUDA/ATC gated). Matches Phase 9's bounds.

### Predicate Encoding (D-10)

- **D-10** — `trigger` clauses are **structured object lists**, parsed by a small typed predicate evaluator inside the orchestrator. No string-eval, no external predicate registry.
- **D-10a** — Clause shape: `{field: <dotted.path.in.dispatch.context>, op: <operator>, value: <primitive|list>}`. Supported ops: `eq`, `neq`, `in`, `not_in`, `gt`, `gte`, `lt`, `lte`, `contains`, `any` (nested list for OR semantics).
- **D-10b** — Implicit AND at the top level. Explicit `any:` block for OR (see D-07's MUDA trigger). No nested `all:` — top-level is already AND.
- **D-10c** — Dispatch context fields visible to predicates: `classifier.complexity`, `classifier.atc_tier`, `classifier.type`, `files_changed_count`, `code_files_changed_count`, `diff_lines`, `phase_type`, `new_pattern_detected`, `script_created`, `error_discovered`. Registry of fields lives in the predicate evaluator's JSDoc. Unknown fields = predicate fails loud (not silently false).

### Edge-guard Response Policy (D-11)

- **D-11** — Edge-guard enforcement defaults to **`log-only`**: every step transition writes a JSONL row to `.planning/metrics/edge-guard-log.jsonl` with `{from_step, to_step, expected_emits, actual_emits, missing_emits, context, resolution}`. Orchestrator continues.
- **D-11a** — Per-gate opt-in to `halt` via `escalation: halt` field in gates.yaml row. Halt = orchestrator writes checkpoint and exits with a BLOCKER report; user manually resumes. Applies only to gates explicitly marked.
- **D-11b** — **No rollback option.** Destructive git-reset was considered and rejected: too risky for minimal gain; halt + manual recovery is safer and auto-mode-compatible.
- **D-11c** — `missing_emits` is detected by comparing actual tool-call sequence to the step's declared `evidence_emitted` contract. Step 11 gates (token-log) are exempt from this check (they ARE the logging).

### Phase 9 Verifier Coverage Gaps (D-12)

- **D-12** — Fold Phase 9's WR-01 and WR-02 warnings into `gates.yaml` as **two new verify-layer gates** (category: `verify-completeness`).
  - **WR-01 → gate `verifier-row-arithmetic`** — Invariant: any YAML audit row with `per_dispatch_tokens` and `dispatches_bypassed` must have `total_bypass_cost == per_dispatch_tokens * dispatches_bypassed`. Phase's verify.mjs (if present) must enforce.
  - **WR-02 → gate `verifier-detail-vs-summary`** — Invariant: any YAML with both a detail list (e.g., `findings_detail`) and a summary map (e.g., `findings_by_bucket`) must have map entries matching detail counts per key.
- **D-12a** — Both gates get `enforcement_mode: soft-warn`, `trigger: [{field: phase_has_verify_mjs, op: eq, value: true}]`. Fires only on phases that ship a mechanical verifier.
- **D-12b** — 09-verify.mjs gets a retro-fix commit (as part of Phase 10's execution, not a separate phase) adding both invariants so the new gates pass on Phase 9's artifacts from day one.

### Config Cleanup (D-13)

- **D-13** — **Delete** `config.byterover` block entirely from `.planning/config.json`. Remove any remaining `if byterover.enabled` conditionals from `super-gsd/skills/sgsd-orchestrate/SKILL.md` (likely none after Phase 10, since the gates.yaml now drives memory gating).
- **D-13a** — Do NOT rename to `memory:` — the memory system has no runtime tuning knobs worth keeping. gates.yaml Step 5 + Step 10 rows carry all policy.
- **D-13b** — The 7 remaining "unknown" config keys (`safety`, `model_routing`, `token_efficiency`, `deliberation`, `atc`, `browser_verify`, `overwatcher`) stay — they're runtime knobs referenced by gates.yaml trigger clauses and reviewer agents. Phase 10 adds them to gsd-tools' known-key schema so the warnings stop.

### Memory System Rename (D-14)

- **D-14** — Before Phase 10 planning, run `/sgsd-memory-migrate` ONCE to move `.brv/context-tree/` → `.planning/memory/` per the v1.2 8-folder semantic taxonomy. Idempotent skill; one commit.
- **D-14a** — Phase 10 plans, CONTEXT.md, and gates.yaml all reference `.planning/memory/` from day one. Any post-migration `.brv` references in code are a Phase 10 execution failure.
- **D-14b** — `sgsd-recall.sh` and `sgsd-curate.sh` auto-detect the new path via their root-detection logic (already handles both). No script changes expected; if changes are needed, they're part of Plan 10-01.

### gates.yaml Schema (D-15)

- **D-15** — Accept the scaffold's existing schema as-is. No changes to `_example_entries` field layout. Phase 10 only populates the `gates: []` list and removes the `_example_entries:` block (which becomes redundant once real entries exist).
- **D-15a** — Row ordering in gates.yaml: grouped by `category` (code-quality, process-hygiene, functional, verify-completeness) then sorted by step number. Deterministic order reduces diff noise on future edits.
- **D-15b** — `state: active` on all Phase 10 rows. `state: experimental` or `state: known-gap` reserved for future rows that get added without full empirical backing.

### Specifics (D-16)

- **D-16** — Plan decomposition recommended as 3 plans:
  - **10-01 — Predicate evaluator + gates.yaml population**: ship the typed evaluator (small module in super-gsd/scripts/), populate all 9 gates + 2 verify-completeness gates per D-01..D-09 and D-12.
  - **10-02 — Edge-guard layer**: implement step-transition check in sgsd-orchestrate, write JSONL log contract, wire halt/log-only branching per D-11.
  - **10-03 — Integration & cleanup**: wire gates.yaml lookups into every referenced step in sgsd-orchestrate SKILL.md (replace hard-coded threshold checks with `gates.get(name).trigger.eval(ctx)` calls); retro-fix 09-verify.mjs for D-12b; config cleanup D-13; add known-key schema for remaining config blocks.
- **D-16a** — Each plan uses v2 schema_version frontmatter (same as Phase 9 plans) with inline tasks list, files_modified, hypothesis/falsifier/stop_rule.
- **D-16b** — Wave grouping: Wave 1 = 10-01 (predicate evaluator + gates-registry + populate gates.yaml + phase-10 verify.mjs). Wave 2 = 10-02 (edge-guard.cjs + SKILL.md doc section + --self-test). Wave 3 = 10-03 (SKILL.md integration + 09-verify.mjs retrofit + config cleanup + full-suite). **Serial (no intra-wave parallelism)** — revised from original 2-wave parallel proposal after plan-check W-2 caught that edge-guard.cjs imports gates-registry.cjs at module-load time, making Wave 1 parallel dispatch race-prone. Dependency-honest over parallelism-aspirational.

### What's Out of Scope (D-17)

- **D-17** — These surfaced during discussion but belong elsewhere:
  - Rethinking the 4-mode enforcement vocabulary (accept scaffold; surface any objections at milestone close, not mid-phase).
  - Merging other config.json blocks (`atc`, `deliberation`, etc.) into gates.yaml. They're orthogonal — gates.yaml is policy, config.json is tuning.
  - Retrofitting the gate matrix to phases 1–11. Matrix applies forward from Phase 10 close.
  - Adding a web UI or dashboard for gate status. Out of scope; `.planning/metrics/edge-guard-log.jsonl` is the authoritative view.
</decisions>

<specifics>
## References Used

- **Phase 9 verdict_pointer_to_phase_10 fields** — D-01..D-09 each answer exactly one pointer.
- **Phase 11 plan schema** — D-16a's v2 frontmatter shape is the pattern the Phase 10 plans will reuse.
- **Phase 9 wave grouping** (Wave 1 = 09-01+09-02, Wave 2 = 09-03) — D-16b's wave model matches.
- **R-Q2 3-tier policy** (hard/soft/amortized) from SGSD-v2-MIGRATION-MANIFEST §4.4 — the scaffold is a direct implementation.
- **ATC review's §5** — the basis for D-05 (per-dispatch ATC can't catch cross-task gaps).
</specifics>

<deferred>
## Deferred Ideas

- **Runtime gate-policy override via CLI flag** — e.g., `sgsd-orchestrate go --disable-gate per-dispatch-atc`. Useful for debug sessions. Out of scope; defer to Phase 12 (Machinery) or a separate operator-ergonomics phase.
- **Per-project gate policy extension** — a project's local `.planning/gates.override.yaml` that layers over the super-gsd default. Out of scope; super-gsd ships the canonical policy, projects adopt as-is in v1.2.
- **Gate ablation tooling** — run a phase with gate X disabled and compare outcomes. Useful for empirical tuning. Not needed for v1.2; can be a Phase 13 governance item.
- **gates.yaml auto-gen from skill file scanning** — inspect sgsd-orchestrate SKILL.md, extract gate definitions, emit YAML. Nice for drift detection. Defer; Phase 10's manual authoring is small enough to not need codegen.
</deferred>

<next_steps>
## Next Steps

1. **Run `/sgsd-memory-migrate`** — moves `.brv/context-tree/` → `.planning/memory/`. One commit. Must happen before Phase 10 planning references the new path.
2. **Run `/gsd-plan-phase 10`** — generates 3 plans (10-01 predicate+populate, 10-02 edge-guard, 10-03 integration+cleanup) per D-16.
3. **Run `/gsd-execute-phase 10`** (or `/sgsd-orchestrate go`) — after plan-check PASS.

Phase 10 output goes to:
- `super-gsd/registry/gates.yaml` — populated
- `super-gsd/scripts/predicate-eval.mjs` (or similar) — new module
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — updated step gating
- `.planning/config.json` — byterover block removed, schema cleanup
- `.planning/phases/09-atc-147-evidence/verify.mjs` — WR-01/02 invariants added (D-12b)
- `.planning/phases/10-gate-policy/verify.mjs` — new mechanical verifier for Phase 10's own invariants
</next_steps>

# Phase 11: Plan Schema v2 - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Publish a canonical v2 plan schema as YAML frontmatter (with JSON Schema validator at `super-gsd/templates/plan-schema-v2.json`), enforce required task fields at plan-load time, support optional fields with documented defaults, and preserve the 146 existing v1 plans via a classifier-fallback path. Scope is limited to the schema, the validator, the authoring/consumption wiring, and the self-healing repair loop — no bulk migration, no new plan authoring UX, no gate policy (Phase 10), no orchestrator sharpenings (Phase 12).

</domain>

<decisions>
## Implementation Decisions

### Optional-Field Defaults (SCHEMA-03)

- **D-01:** `expected_ATC_tier` default = `LITE` when unset. Matches CLAUDE.md heuristic (10-50 lines, ≤3 files); plan authors only declare when it's NOT LITE.
- **D-02:** `prior_errors_lookup` default is tier-sensitive — `true` when `expected_ATC_tier ∈ {FULL, GATE}`, `false` when `LITE`/`SKIP`. Derivation rule lives in the parser, computed once from resolved tier. Ergonomic for the high-stakes tasks that benefit; cheap for LITE tasks that don't.
- **D-03:** `skip_gates` default = `[]` (skip nothing). Every Phase-10 gate runs unless explicitly skipped. Default is safe-by-default even before Phase 10 gates.yaml lands.
- **D-04:** `lessons_path` set-but-missing-file behavior = **warn + continue**. Validator logs warning to activity-log, dispatch proceeds. Stale refs are a productivity issue, not a correctness blocker.
- **D-05 (Claude's Discretion — low-controversy):**
  - `depends_on` default = `[]`
  - `known_deadends` default = `[]`
  - `verification_cmd` default = `null` (fall back to verifier agent)

### Parser Ownership (SCHEMA-01, SCHEMA-02)

- **D-06:** Validator lives at **`super-gsd/tools/plan-schema/validate.cjs`** — standalone Node CLI, invocable by orchestrator + `superpowers:writing-plans` + CI/hooks. Matches the `super-gsd/tools/process-audit/` pattern (sibling directory). Testable in isolation; no skill-prose coupling.
- **D-07:** Validation fires at **both write-time and load-time**.
  - Write-time: `superpowers:writing-plans` calls `validate.cjs` before emitting PLAN.md — fail-fast, zero bad plans land in git.
  - Load-time: `sgsd-orchestrate` re-validates via `validate.cjs` at dispatch — catches manual post-write drift.
- **D-08:** Error format is **dual**: human-readable summary lines to console (`[11-01-PLAN.md] task #2: missing required 'falsifier' (SCHEMA-02)`) + full ajv errorObject array appended to `.planning/metrics/plan-errors.jsonl` (one JSON line per validation run, including pass rows for telemetry).

### Self-Healing Repair Loop (SCHEMA-02 failure path)

- **D-09:** On load-time validation failure, orchestrator **does not halt, does not guess, does not fall back to v1 classifier**. It dispatches a new `gsd-planner --fix-schema` mode with:
  - The malformed plan file path
  - The ajv error envelope from `.planning/metrics/plan-errors.jsonl`
  - The canonical `plan-schema-v2.json` contract
  - Hard constraint: **preserve `task.id`, `task.goal`, and `task.files_touched` values from the original plan**. Only repair schema-level violations (missing fields, wrong types, field ordering).
- **D-10:** Retry cap = **3 auto-repair attempts**. Each attempt commits as `fix({NN-PP}): repair schema violation attempt K/3`. After 3 failures, orchestrator writes `ORCHESTRATOR-CHECKPOINT.md` with the specific plan + all 3 error envelopes + all 3 fix attempts, stops the loop, and surfaces as Exit #3 (Blocker) to the operator.
- **D-11 (Claude's Discretion — implementation detail):** Each repair attempt writes to a sibling file (e.g., `11-01-PLAN.fix-attempt-K.md`); only on re-validation pass does the fix promote to overwrite `11-01-PLAN.md`. Prevents corruption of the original during failed attempts.

### Cross-Repo Pinning (SCHEMA-05)

- **D-12:** Pin mechanism = **boot-time sha256 hash check**. `sgsd-orchestrate` computes `sha256(super-gsd/templates/plan-schema-v2.json)` at session start and compares against `workflow.schema_v2_hash` in `.planning/config.json`. Zero build-system changes; no submodule overhead; no new package.
- **D-13:** Single source of truth = **this repo (GSDedits)**. `super-gsd/templates/plan-schema-v2.json` is canonical. `superpowers:writing-plans` consumes via periodic sync (mechanism for the sync itself is Phase-11 Claude's Discretion: likely a build-time copy or a reference to the pinned hash — planner decides).
- **D-14:** On pin drift detection, action = **warn + continue**. Emit structured drift event to `.planning/metrics/readiness-log.jsonl` (`{type: "schema_pin_drift", expected_hash, actual_hash, timestamp}`) + console warning. Loop proceeds with local schema; operator decides when to resync. Non-blocking — matches DLB-06 "reject framing" of per-project hygiene over distribution machinery.

### Claude's Discretion (explicit hand-offs to downstream agents)

- Classifier-skip completeness — v2 plans declare `model` (required per SCHEMA-02) and optionally `expected_ATC_tier` (D-01 default = LITE); orchestrator derives `complexity` and `deliberate` from these + the `depends_on` / `files_touched` fields. No new required fields.
- Sync mechanism between this repo's `plan-schema-v2.json` and `superpowers:writing-plans` — planner selects (build-time copy, hash reference, or other) as long as D-12's boot-time hash check catches drift.
- ajv version selection and vendoring strategy — validator is Node, ajv is the de-facto JSON Schema validator; planner picks version + lockfile discipline.
- Repair attempt staging file naming (`.fix-attempt-K.md` vs other convention) — planner decides.
- JSONL line shape for `plan-errors.jsonl` — planner designs schema consistent with existing `.planning/metrics/*.jsonl` conventions (timestamp, event type, payload).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Requirements
- `.planning/ROADMAP.md` §Phase-11 — goal, deps, 5 success criteria (SCHEMA-01..05)
- `.planning/REQUIREMENTS.md` SCHEMA-01 through SCHEMA-05 — verbatim requirement text
- `.planning/REQUIREMENTS.md` §Out-of-Scope — bulk migration + hard-cutover explicitly excluded
- `.planning/PROJECT.md` — core value, constraints (token efficiency, no API keys, Windows/WSL2/macOS/Linux compatibility)
- `.planning/STATE.md` — current milestone + accumulated decisions D001-D013

### Existing Plan Format (what v2 replaces for new plans, leaves alone for 146 v1 plans)
- `super-gsd/templates/compressed-plan.xml` — current v1 XML template; v2 does NOT delete this (classifier fallback reads v1 plans unchanged)

### Registry Precedents (YAML-schema-ownership pattern v2 extends)
- `super-gsd/registry/gates.yaml` — Phase 10 gates registry (registered-resource precedent for SCHEMA-05 pinning pattern)
- `super-gsd/registry/agents.yaml` — agent registry
- `super-gsd/registry/board-members.yaml` — deliberation board roster
- `super-gsd/registry/decisions.yaml` — decision log registry
- `super-gsd/registry/handover-contract-v2.yaml` — existing v2 contract precedent (naming + pinning pattern)

### Tooling Precedents
- `super-gsd/tools/process-audit/` — sibling tools/ directory structure for D-06's `super-gsd/tools/plan-schema/` location
- `super-gsd/tools/process-audit/restart-step.ps1` — reference implementation of a small tool that clears metrics scratch files (same metrics/ dir where plan-errors.jsonl will land)

### Metrics Conventions (format for plan-errors.jsonl)
- `.planning/metrics/activity-log.jsonl` — existing JSONL convention in metrics/
- `.planning/metrics/token-log.jsonl` — existing JSONL convention
- `.planning/metrics/readiness-log.jsonl` — where D-14 drift events land
- `.planning/metrics/heartbeat.jsonl` — live telemetry precedent (gitignored)

### Upstream Consumer
- `superpowers:writing-plans` skill (external to this repo) — must emit v2 by default per SCHEMA-05. Planner investigates current write path + proposes sync mechanism.

### Related Phase Context (for consistency)
- `.planning/phases/03-orchestrator-engine/03-CONTEXT.md` — v1.1 orchestrator-engine decisions (plan-loading + dispatch architecture baseline)
- `.planning/decisions/DLB-06-central-distribution.md` — "reject framing" on cross-repo distribution complexity (informs D-14's non-blocking drift choice)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`super-gsd/registry/*.yaml` pattern** — D-06's validator reads a YAML-frontmatter + JSON Schema contract exactly analogous to how `sgsd-orchestrate` already reads `gates.yaml` at dispatch time. Registry-consumption code in orchestrator-prompt-composer.md is the closest prior art.
- **`super-gsd/tools/process-audit/*.ps1|.js`** — Node/PowerShell tools sibling pattern. `validate.cjs` lives next to these as `super-gsd/tools/plan-schema/validate.cjs`.
- **`.planning/metrics/*.jsonl` convention** — activity-log, token-log, readiness-log, heartbeat. plan-errors.jsonl joins the family; same append-only conventions apply.
- **`gsd-planner` agent** — already reads ROADMAP + REQUIREMENTS + CONTEXT, already understands task specifications. Extending with `--fix-schema` flag is a small surface addition rather than a new agent.

### Established Patterns
- **YAML frontmatter + free-form body** — already the convention for CLAUDE.md-scope docs (agent definitions in `super-gsd/agents/*.md`, skill definitions). v2 plan schema extends this to PLAN.md files.
- **JSONL append-only telemetry** — metrics/ files never mutate existing lines; always append. plan-errors.jsonl follows suit.
- **Boot-time verification** — `sgsd-milestone-readiness` + `sgsd-phase-readiness` already do start-of-session probes. D-12's schema hash check slots into this cohort.
- **Self-healing retry with cap** — existing dispatch Rule 8 ("Verification failed → dispatch planner --gaps") is the prior art for D-09/D-10's schema-fix loop.

### Integration Points
- **`sgsd-orchestrate` skill** — plan-load logic needs `validate.cjs` invocation + the Rule-8-style dispatch branch for schema failures.
- **`superpowers:writing-plans` skill (external)** — must invoke `validate.cjs` before writing. Sync mechanism from this repo is planner's call.
- **`gsd-planner` agent** — gains `--fix-schema` mode. Existing planner prompt composition handles the new flag.
- **`.planning/config.json`** — new key `workflow.schema_v2_hash` (pinned sha256); optional `workflow.plan_fix_retry_cap` if we expose retry count as tunable (D-10 defaults to 3 hardcoded).
- **CLAUDE-OVERLAY / `super-gsd/CLAUDE-OVERLAY.md`** — document D-12/D-13/D-14 in the overlay so session-start drift warnings are expected by future operators.

</code_context>

<specifics>
## Specific Ideas

- **Preserve semantic intent across fix attempts (D-09):** The fix loop MUST NOT change task IDs, goals, or files_touched. A fix that renames a task or swaps its files_touched has corrupted the plan — treat that as a failed attempt. This is an explicit rejection of "regenerate the plan from scratch" as a repair strategy.
- **Boot-time hash comparison (D-12) uses sha256, not md5 or crc32.** Consistent with git's content-addressable hashing habits; no collision concern at this scale.
- **Three-strikes checkpoint (D-10) must include all 3 error envelopes AND all 3 fix attempts** in the checkpoint body, not just the last. Operator needs the full failure trajectory to decide whether the schema itself is wrong or the specific plan is unrepairable.
- **The 146 existing v1 plans are sacred.** No tool, no migration prompt, no lint-and-fix script touches them under Phase 11 scope. SCHEMA-04's classifier-fallback is the entire relationship between v2 and legacy plans.

</specifics>

<deferred>
## Deferred Ideas

- **Classifier-skip completeness as a formal discussion** — operator routed to Claude's Discretion. If the derivation rule (`model` + `expected_ATC_tier` → full classifier surface) proves insufficient during Phase 12 (MACH-01 classifier-skip policy), surface as a Phase 12 discussion gray area.
- **Validation error envelope UX** — whether to auto-suggest fixes inline vs pure error reporting was not discussed. Phase 11 ships with error-reporting only (D-08); auto-suggest is a future ergonomic polish.
- **Voluntary v1 → v2 migration tool** — Phase 11 ships no migration helper, per the "146 plans sacred" constraint. If operator voluntarily wants to migrate a specific v1 plan, a one-shot converter skill could be a future deferred phase.
- **Schema evolution beyond v2** — no v3 planning in this phase. Phase 11 does not design for schema evolution beyond the v1/v2 split; a future phase handles that if/when needed.
- **`superpowers:writing-plans` sync mechanism** — Phase 11 decides THAT the schema is pinned (D-12, D-14); HOW the two repos synchronize the file itself is planner's call within the bounds set here.

</deferred>

---

*Phase: 11-plan-schema-v2*
*Context gathered: 2026-04-21*

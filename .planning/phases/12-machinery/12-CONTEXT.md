# Phase 12: Machinery — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Prerequisites:** Phase 10 (gates.yaml + predicate evaluator + edge-guard) and Phase 11 (v2 plan schema with depends_on + files_touched + complexity hints) both shipped. Phase 12 consumes their outputs.

<domain>
## Phase Boundary

This phase delivers four orchestrator-internal sharpenings that compound on the foundations shipped in Phases 9/10/11:

1. **MACH-01** — Classifier skip policy (per-plan cached verdict)
2. **MACH-02** — Parallel/sequential dispatch auto-detection from v2 schema
3. **MACH-03** — Checkpoint schema expansion + refined trigger with hard cap
4. **MACH-04** — Adversarial verifier sampling (contrarian challenger pass)

Plus three scope-adjacent items folded in:

5. **ERG-01** — Phase 10 ATC warnings (WR-01 edge-guard broad catch / WR-02 registry cache doc / WR-03 SKILL.md excluded from code count)
6. **ERG-02** — KNOWN_TOP_LEVEL installer script (turns Phase 10's deferred cross-repo operator action into a reusable install command)

**Not in scope:** Phase 11 IN-03 distribution gap (super-gsd/agents/ directory + installer design → dedicated infra phase later). MUDA inventory cleanup (hygiene concern, not machinery). New agent types. New gate categories. New model routing rules.
</domain>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` MACH-01..MACH-04 — success criteria this phase must satisfy.
- `.planning/ROADMAP.md` §Phase 12 — the four Q6a-d sharpenings framed.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — primary integration target. Steps 2 (classifier), 5.5 + dispatch pattern (MACH-02 target), checkpoint protocol section (MACH-03 target), verifier step + Step 6.5 Phase ATC (MACH-04 target).
- `super-gsd/registry/gates.yaml` — existing `classifier-haiku` gate row; MACH-01 keys off its trigger field per Phase 10 D-01.
- `super-gsd/tools/plan-schema/plan-schema-v2.json` — v2 schema fields: `depends_on`, `files_touched`, `expected_ATC_tier`, `skip_gates`. MACH-02 reads `depends_on` + `files_touched`; MACH-01 caches verdict keyed on plan id (a v2 concept).
- `super-gsd/scripts/lib/gates-registry.cjs` — Phase 10 output; WR-02 fix lives here.
- `super-gsd/scripts/lib/edge-guard.cjs` — Phase 10 output; WR-01 fix lives here (line 83 broad catch).
- `super-gsd/scripts/lib/predicate-eval.cjs` — Phase 10 output; classifier-cache will use the same dispatch-context field registry.
- `.planning/phases/10-gate-policy/10-ATC-REVIEW.md` — WR-01/02/03 details with file:line citations.
- `.planning/phases/10-gate-policy/10-03-01-cross-repo-probe.yaml` — `repo_status: separate` (the trigger for ERG-02 installer-script approach).
- `~/.claude/get-shit-done/bin/lib/core.cjs:322-331` — the `KNOWN_TOP_LEVEL` Set the ERG-02 installer patches. Cross-repo target — operator must have write access (run from their own shell).
- `super-gsd/templates/checkpoint.md` (if exists) — MACH-03 extends the schema. If no template, create one as part of MACH-03.
- `.planning/config.json` — MACH-04 adds `config.atc.verifier_adversarial_rate` (default 0.2).
</canonical_refs>

<decisions>
## Implementation Decisions

### MACH-01 — Classifier Skip Policy (D-01 through D-04)

- **D-01** — **Per-plan cached verdict (Q6a-iii)**. Not entropy-gated. Classify once per plan, cache the `{complexity, model, atc_tier, deliberate}` verdict, reuse across all N tasks in that plan.
- **D-01a** — Cache location: plan's SUMMARY.md frontmatter is written after plan completes; cache must be available BEFORE then. Use a sidecar `.classifier.json` at `.planning/phases/{NN}/plans/{NN-PP}.classifier.json` with frontmatter `{classified_at, verdict: {complexity, model, atc_tier, deliberate, reason}, plan_schema_version}`.
- **D-01b** — Cache invalidation: cache is scoped to the plan execution (single orchestrator run). Deleted at plan completion by the orchestrator when writing the plan's SUMMARY.md. If orchestrator restarts mid-plan, cache survives (resume reads the sidecar).
- **D-01c** — v1 plans (no `schema_version: 2` frontmatter): fall back to the existing per-dispatch classifier. Detection: `plan frontmatter.schema_version === 2`. MACH-01 applies only to v2 plans.
- **D-02** — Cache key: full plan id (e.g., `10-01`). Not per-task. The plan is the unit of classification.
- **D-03** — Cache hit implementation: before dispatching an executor for task `10-01-02`, orchestrator reads `.planning/phases/10-gate-policy/plans/10-01.classifier.json`. If present AND plan hasn't changed since (mtime check), reuse verdict; skip classifier dispatch entirely. If absent or stale, run classifier and write.
- **D-04** — Savings accounting: log cache-hit events to `.planning/metrics/token-log.jsonl` with `role: classifier-skip` so the accumulated savings are measurable. Phase 12 verifier invariant: cache-hit count > 0 for any v2 plan with ≥2 tasks (otherwise MACH-01 isn't actually firing).

### MACH-02 — Parallel/Sequential Dispatch Auto-Detection (D-05 through D-08)

- **D-05** — Source of truth: v2 plan frontmatter `depends_on` (plan-level plan IDs) and per-task `files_touched` (task-level file lists). Orchestrator builds a DAG from these.
- **D-05a** — Task-level dispatch within a plan: if task A's `files_touched` is disjoint from task B's `files_touched` AND they declare no explicit `depends_on`, they MAY run in parallel. If any file overlap or explicit dependency, serialize.
- **D-05b** — Plan-level wave assignment: plans with the same `wave` number run concurrently IF their `files_modified` lists are disjoint. Otherwise, the wave ordering rule from Phase 9/10 plan-checker applies: serialize.
- **D-06** — Implementation: a new `super-gsd/scripts/lib/dispatch-planner.cjs` module exports `buildDispatchPlan(plan)` → `[{wave: N, tasks: [taskId...], serial: bool}]`. Orchestrator calls this once at plan-start; iterates through waves; within a wave dispatches parallel tasks via `Task(run_in_background: true)` then awaits all.
- **D-07** — v1 fallback: v1 plans (no `depends_on` field, no per-task `files_touched`) serialize all tasks sequentially. `dispatch-planner.cjs` detects v1 via absence of `schema_version: 2` and returns a single-wave plan with all tasks serial.
- **D-08** — Failure semantics: if any task in a parallel wave fails (agent returns BLOCKER), orchestrator awaits remaining parallel tasks then halts. Does not cancel in-flight agents (no cancellation protocol for Task()).

### MACH-03 — Checkpoint Schema Expansion + 85% Hard Cap (D-09 through D-12)

- **D-09** — New checkpoint frontmatter fields (in addition to existing ones):
  - `approaches_tried_and_abandoned: []` — list of `{approach, why_abandoned, artifact_refs}` entries captured during the session
  - `rules_learned_this_session: []` — list of `{rule, context, curated_to}` entries (typically sourced from sgsd-curate calls)
  - `dispatches_summary: {total: N, by_agent: {executor: N, verifier: N, ...}, by_outcome: {pass: N, fail: N, warn: N, blocker: N}}`
- **D-10** — Primary checkpoint trigger: `(phase_boundary OR plan_boundary) AND context >70%`. This replaces the current trigger "context >70% anywhere." Matches DLB-06 Wave B intent.
- **D-11** — **Emergency hard cap: context >= 85% forces checkpoint mid-task**. Override for runaway growth within a long plan. When fired, orchestrator:
  1. Writes checkpoint with `emergency_halt: true` in frontmatter
  2. Logs a DEVIATIONS entry: `CHECKPOINT_EMERGENCY: context {N}% at task {id} of plan {id}`
  3. Exits loop with text-only stop
- **D-11a** — Emergency halts feed back into plan-decomposition feedback: if >10% of checkpoints in a milestone are emergency halts, file a sgsd-curate anti-pattern note and flag the plan-checker rule "plans >6 tasks should be split" for re-enforcement.
- **D-12** — Checkpoint template location: `super-gsd/templates/checkpoint.md` (create if absent). v2 checkpoint rendering respects all new fields; old checkpoints remain readable (new fields default to empty).

### MACH-04 — Adversarial Verifier Sampling (D-13 through D-15)

- **D-13** — **Same gsd-verifier agent, contrarian prompt** (not a separate agent type). After gsd-verifier returns `STATUS: PASS` or `PASS-WITH-DEVIATIONS`, orchestrator rolls `Math.random() < config.atc.verifier_adversarial_rate`. On hit, re-dispatches gsd-verifier with a contrarian prompt header.
- **D-13a** — Contrarian prompt header (inject verbatim):
  ```
  ADVERSARIAL CHALLENGER PASS — the primary verifier returned PASS. You are challenging that verdict. Assume the primary verifier missed something. List the top 3 ways this phase might silently fail despite the PASS. Focus on: cross-plan integration gaps the primary verifier didn't exercise, assumptions baked into plan contracts that weren't proven in execution, invariants that are mechanically true but semantically vacuous.
  ```
- **D-13b** — Challenger verdict semantics:
  - `STATUS: PASS` (challenger agrees) → no change. Log `verifier_adversarial_agreement: true`.
  - `STATUS: PASS-WITH-GAPS` (challenger finds concerns) → promote phase verdict to `PASS-WITH-GAPS`, append challenger findings to verification report as `## Adversarial Challenge` section. Do NOT block; log as soft signal.
  - `STATUS: FAIL` (challenger flips) → escalate. In auto mode: log `VERIFIER_ADVERSARIAL_FLIP` as CRITICAL in DEVIATIONS, append challenger report, continue (don't auto-block on a second opinion). In interactive mode: STOP with blocker for operator to arbitrate.
- **D-14** — Sampling rate: default `config.atc.verifier_adversarial_rate: 0.2` (20%). Tunable. Set to 0 to disable. Set to 1 to force challenger on every pass.
- **D-14a** — Rate is evaluated per verifier pass, not per phase. On a long-running milestone with 5 phases and rate=0.2, expected ~1 challenger invocation across the milestone.
- **D-15** — Challenger cost: same model, same prompt size + ~70 tokens for the contrarian header. Budget: ~600 tokens per challenger pass. 20% of the verifier cost = amortized +120 tokens per phase. Acceptable.

### ERG-01 — Phase 10 ATC Warnings Fold-in (D-16 through D-18)

- **D-16** — **WR-01**: Narrow `edge-guard.cjs:83` broad catch. Current: `catch (_) { /* fallthrough to log-only */ }`. Fix: distinguish `Error.code === 'ENOENT'` (gate not in registry → log an explicit `gate_not_found` row) from other errors (rethrow or log `gate_lookup_error` with stack). Preserves log-only default behaviour for "gate doesn't exist" cases but stops swallowing syntax errors / typos.
- **D-17** — **WR-02**: Add a JSDoc block at the top of `gates-registry.cjs` documenting the module-level cache singleton contract:
  ```
  /**
   * WARNING — module-level cache is a PROCESS SINGLETON.
   * Tests MUST call resetCache() in afterEach() to avoid pollution.
   * Long-running processes that hot-swap gates.yaml MUST call resetCache()
   * after the file mtime changes (or after a SIGHUP equivalent).
   */
  ```
- **D-18** — **WR-03**: Extend `code_files_changed_count` logic in SKILL.md to include `*.md` files located under `super-gsd/skills/` (since SKILL.md IS the orchestrator logic, not documentation). Implementation: `code_files_changed_count` dispatches to a predicate that treats files matching `super-gsd/skills/*/SKILL.md` as code. Other `.md` files (docs, READMEs, plan summaries) stay excluded.

### ERG-02 — KNOWN_TOP_LEVEL Installer Script (D-19 through D-21)

- **D-19** — Ship `super-gsd/scripts/patch-gsd-tools-known-keys.sh`. Shell script (bash, works in WSL/mac/linux). On invocation:
  1. Detects the installed gsd-tools path by looking up `which gsd-tools` or falling back to `~/.claude/get-shit-done/bin/lib/core.cjs`.
  2. Runs `git -C "$(dirname $CORE_CJS)" rev-parse --show-toplevel` to detect if it's in a repo. If yes and the repo is not GSDedits (our repo), emit a notice: "core.cjs lives in a separate git repo at {path}. Patch will be applied but not auto-committed there."
  3. Checks if the 7 keys (`safety`, `model_routing`, `token_efficiency`, `deliberation`, `atc`, `browser_verify`, `overwatcher`) are already in the `KNOWN_TOP_LEVEL` Set. If all present → exit 0 PASS "already patched."
  4. If not, produces a diff, asks operator to confirm (`-y` flag bypasses), and applies the patch via `sed` or `awk` in-place.
  5. Verifies post-patch by re-parsing for the 7 keys.
  6. Emits a final message reminding operator to commit in the gsd-tools repo if it's separate.
- **D-20** — Script is idempotent: running it twice on an already-patched file is a no-op with PASS exit.
- **D-21** — Document in `super-gsd/README.md` (or install notes) that this script is part of the one-time post-install steps for any project using super-gsd after v1.2.

### Plan Decomposition (D-22 through D-24)

- **D-22** — Six plans. Each plan uses v2 schema_version: 2 frontmatter (matches Phase 9/10/11 convention):
  - **12-01** — MACH-01 classifier-cache (new module + orchestrator integration)
  - **12-02** — MACH-02 parallel/sequential auto-dispatch (new module + orchestrator integration)
  - **12-03** — MACH-03 checkpoint schema expansion + 85% hard cap (orchestrator checkpoint section + template)
  - **12-04** — MACH-04 adversarial verifier sampling (orchestrator verifier step + config)
  - **12-05** — ERG-01 WR-01/02/03 fix-ups (edge-guard.cjs, gates-registry.cjs, SKILL.md filter)
  - **12-06** — ERG-02 KNOWN_TOP_LEVEL installer script (new super-gsd/scripts/patch-gsd-tools-known-keys.sh)
- **D-23** — **Wave model**: Wave 1 parallel = {12-01, 12-05, 12-06} (disjoint files — 12-01 touches lib/classifier-cache.cjs, 12-05 touches existing lib/*.cjs files, 12-06 creates a new scripts/ entry). Wave 2 = {12-02}. Wave 3 = {12-03}. Wave 4 = {12-04}. MACH plans serialize because they all touch `sgsd-orchestrate/SKILL.md` in different sections — Phase 10 lesson (plan-check W-2) says: dependency-honest over parallelism-aspirational.
- **D-23a** — Wave 1 is genuinely parallel. Files are disjoint (new module / existing lib files / new script). Run 12-01 + 12-05 + 12-06 concurrently via Task() run_in_background.
- **D-24** — Phase 12 ships its own `.planning/phases/12-machinery/verify.mjs` with ≥8 invariants covering: classifier cache shape, dispatch-planner DAG correctness, checkpoint schema completeness (3 new fields present in template), 85% hard cap trigger exists in SKILL.md, adversarial verifier rate in config.json, WR-01/02/03 fixes committed (grep assertions), patch script syntax-parses, patch script idempotent (run twice, second run is no-op).

### Out of Scope (D-25)

- **D-25** — Captured for explicit exclusion:
  - IN-03 distribution gap (super-gsd/agents/ + installer directory design) — its own phase
  - MUDA inventory cleanup (45 unreferenced .md files) — hygiene, not machinery
  - New agent types (the contrarian in D-13 is the existing gsd-verifier with a prompt change)
  - New model routing rules (classifier still Haiku, verifier still Sonnet, executor still Sonnet — config untouched)
  - Gates.yaml schema changes (Phase 10 sealed the shape)
  - Rethinking wave-model beyond what Phase 10 D-16b already revised (serial where coupling exists)
  - Rollback semantics for checkpoints (D-11 emergency halt is a STOP, not a rollback — Phase 10 D-11b already rejected rollback)
</decisions>

<specifics>
## References Used

- **Phase 10 ATC WARN findings** — D-16/17/18 each close one WR-XX warning with file:line fixes.
- **Phase 9 verdict_pointer_to_phase_10** for the classifier gate ("skip-rule predicate for homogeneous phases") — D-01 answers this: per-plan cached verdict sidesteps "homogeneous phase" by keying on plan identity instead of dispatch similarity.
- **v2 plan schema (Phase 11)** — D-05/06 consume `depends_on` and `files_touched` fields; D-07 fallback uses `schema_version` detection.
- **DLB-06 Wave B** — D-10 checkpoint trigger change ("phase/plan boundary AND context >70%") is the intent the MACH-03 requirement encodes.
- **Architect-R2 structural injection** — D-13a contrarian prompt header is a structural injection in the same spirit as the INTENT block (DLB-03).
- **Phase 10 plan-check W-2** — D-23 wave model honesty ("serial where coupling exists") is the direct lesson.
</specifics>

<deferred>
## Deferred Ideas

- **Predicate novelty scoring (Q6a-ii)** — the entropy-gated alternative to MACH-01. Rejected for v1.2 in favor of simpler per-plan cache. If per-plan cache proves insufficient (e.g., plans with 10+ heterogeneous tasks become common), reopen Q6a-ii in a post-v1.2 phase.
- **Cross-session cache persistence** — v1.2 cache is session-scoped (cleared at plan completion). Future: survive across resume-from-checkpoint OR across different operator sessions working the same plan.
- **Per-task classifier for heterogeneous plans** — if a plan truly has wildly different task complexities (e.g., `.md` edit + crypto review), per-plan cache is wrong. Defer until a plan actually exhibits this pattern; forcing a policy now is YAGNI.
- **Adversarial challenger as full board deliberation** — instead of gsd-verifier with contrarian prompt, dispatch the Contrarian + Architect board members. Bigger scope; better signal. Defer until Phase 13 Governance establishes the board-members.yaml pattern (which MACH-04 could then consume).
- **Auto-tune `verifier_adversarial_rate`** — adjust based on historical agreement/flip ratio. Defer; start with static 0.2.
- **MUDA-driven plan decomposition linter** — if >6-task plans correlate with emergency-halt checkpoints (D-11a), build a linter that rejects them at plan-authoring time. Defer; needs empirical data from v1.2 runs.
</deferred>

<next_steps>
## Next Steps

1. **Run `/gsd-plan-phase 12`** — generates 6 plans (12-01..12-06) per D-22. Wave model per D-23.
2. **Run `/sgsd-orchestrate go`** (or `/gsd-execute-phase 12`) — Wave 1 parallel, then Waves 2/3/4 serial.
3. **Post-phase:** 12-06 installer script ships as part of this phase; operator runs it once per machine to patch the installed gsd-tools. Downstream users of super-gsd run the same script at install.

Phase 12 success = all 4 MACH requirements green + 3 ATC warnings closed + 1 installer script shipped + Phase 12 verify.mjs passes.

Phase 13 (Governance) can start in parallel with Phase 12 any time — no dependency between them. Phase 13 consumes Phase 10 gates.yaml + Phase 11 schema-ownership precedent, both already shipped.
</next_steps>

---
phase: 11-plan-schema-v2
reviewed: 2026-04-21T21:31:54Z
tier: FULL
scope: phase-level (all 5 plans as a coherent subsystem)
verdict: WARN
critical: 0
warning: 5
info: 3
reviewer: claude-sonnet-4-6 (gsd-code-reviewer)
---

# Phase 11: Plan Schema v2 — Phase-Level ATC Review

**Verdict:** WARN
**Tier:** FULL (phase-level — all 5 plans as a coherent subsystem)
**Reviewed:** 2026-04-21T21:31:54Z
**Files reviewed:** `plan-schema-v2.json`, `validate.cjs`, `package.json`, `sgsd-orchestrate/SKILL.md`, `sgsd-write-plan/SKILL.md`, `gsd-planner.md`, `.planning/config.json`, `fixtures/good-plan.md`, `fixtures/bad-plan.md`

---

## Coverage Map

| Req | Implementing Artifact | Status |
|-----|-----------------------|--------|
| SCHEMA-01 | `plan-schema-v2.json` root `required: [schema_version, tasks]` | DELIVERED |
| SCHEMA-02 | `plan-schema-v2.json` definitions/task required array (9 fields) + `validate.cjs` exit-1 path | DELIVERED |
| SCHEMA-03 | `plan-schema-v2.json` optional fields with defaults in task + root | DELIVERED |
| SCHEMA-04 | `sgsd-orchestrate/SKILL.md` Step 2 classifier-skip branch | DELIVERED |
| SCHEMA-05 | `sgsd-write-plan/SKILL.md` Step 4 validate-before-write + Step 5 write-only-on-exit-0 | DELIVERED |
| D-01..D-06 | defaults in schema, derivation in `validate.cjs derivePriorErrorsLookup` | DELIVERED |
| D-07 | write-time (sgsd-write-plan Step 4) + load-time (orchestrator Step 6.2) | DELIVERED |
| D-08 | `formatErrors` + `appendTelemetry` in validate.cjs | DELIVERED |
| D-09 | locked_fields extracted by orchestrator before planner dispatch | DELIVERED (with gap — see WR-01) |
| D-10 | checkpoint-on-cap with 3 envelopes + 3 attempt files | DELIVERED |
| D-11 | `.fix-attempt-K.md` sibling staging convention | DELIVERED |
| D-12 | `config.json workflow.schema_v2_hash`, boot drift check in orchestrator Step 3.5 | DELIVERED — hash verified match |
| D-13 | `plan-schema-v2.json` is the single source of truth; no external ref | DELIVERED |
| D-14 | drift check is warn + continue (non-blocking) | DELIVERED |

---

## 10-Point Anti-Slop Grid

| # | Check | Result | Justification |
|---|-------|--------|---------------|
| 1 | Every function has a caller | P | All 8 validate.cjs functions called from main() or each other. sgsd-write-plan is invoked via /sgsd-write-plan. Rule 8.5 is reachable from dispatch rule 6.e. fix_schema_mode triggered by --fix-schema flag via load_mode_context step. |
| 2 | Every import is used | W | `addFormats(ajv)` loads all ajv-formats validators; plan-schema-v2.json (11-01 final) uses zero `format` keywords. Flagged in 11-02 per-dispatch review; still dead after 11-01 landed. Non-blocking (forward-compat intent documented). |
| 3 | Every parameter is read | W | `deduplicateTopLevelKeys`: `keyOccurrences` Map and `totalOccurrences` (line 210) computed but never read in branching logic — only `seen.get(key) === i` governs the skip/keep decision. Dead vars from refactor; algorithm correct without them. Also: `field` variable assigned inside `formatErrors` errorMessage branch (lines 315-320) is never read before `continue`. |
| 4 | Could this be less code? | W | Yes: 14 lines deletable from validate.cjs (items 1-3 above). Otherwise tight — 458 lines maps directly to D-spec requirements. sgsd-write-plan SKILL.md is proportionate for a procedural skill doc. |
| 5 | New abstractions justified? | P | Rule 8.5 (fix-schema retry) maps to D-09/D-10/D-11. Boot drift check maps to D-12/D-14. Classifier skip maps to SCHEMA-04. sgsd-write-plan maps to SCHEMA-05. Each abstraction is 1:1 with a phase requirement. No speculative wrappers. |
| 6 | Existing code does 80%? | P | phase-verifier.mjs is the closest neighbour. validate.cjs reuses the argv loop, exit code, and stderr pattern faithfully but cannot share code (CJS vs ESM, different deps, distinct problem). No duplication opportunity missed. |
| 7 | Would a senior engineer mass-delete anything? | W | The 14 dead-code lines in validate.cjs (WR-02, WR-03 below) are the only candidates. No speculative additions detected. All fields trace to D-spec items. |
| 8 | ΔComplexity ≤ 0? | P | Phase is net-new. Individual orchestrator mod (Step 2 branch + Step 6.2 block) adds complexity proportionate to feature. No existing orchestrator steps were regressed. |
| 9 | YAGNI additions? | P | `plan_fix_retry_cap: 3` in config.json is exposed as a config key per explicit D-10 permission ("optional per D-10"). `--help` flag in validate.cjs is standard CLI hygiene. No unused CLI flags. No placeholder fields. |
| 10 | Phase does ONE thing? | P | Plan schema v2 — canonical schema + write-time enforcement + load-time validation + self-healing loop + drift detection + classifier skip. Bounded, coherent subsystem. |

---

## Findings Table

| Sev | ID | Location | Finding | Recommendation |
|-----|----|----------|---------|----------------|
| WARN | WR-01 | `sgsd-orchestrate/SKILL.md:290`, `gsd-planner.md:843,848,854,870,871` | **Cross-plan field-name drift: `task.goal` does not exist in plan-schema-v2.json.** The orchestrator's locked_fields extraction block (line 290) reads `tasks[*].goal`, and gsd-planner.md's fix_schema_mode references `locked_fields.goal` throughout. The canonical schema (11-01) defines no `goal` field on a task — the closest semantic equivalent is `hypothesis` + `stop_rule` + `output_contract`. If a malformed plan reaches Rule 8.5, the orchestrator will extract `undefined` for `locked_fields.goal`, and the planner's self-check `task.goal unchanged` will vacuously pass on any output. The locked-field integrity guarantee (D-09) is partially hollow. | Replace `goal` with a field that actually exists in the schema. Semantically, `hypothesis` is the closest lock-worthy analogue (it captures the "why this approach"). Update orchestrator line 290 to `hypothesis: tasks[*].hypothesis` and update all gsd-planner.md fix_schema_mode references accordingly. Non-blocking for Phase 11 (no plan has yet failed Rule 8.5 in production), but must be fixed before the first live repair attempt. |
| WARN | WR-02 | `validate.cjs:199,206-210` | **Dead vars in `deduplicateTopLevelKeys`**: `keyOccurrences` Map (line 199), `count` variable (line 207), and `totalOccurrences` (line 210) are computed but never used in the branching logic. Only `seen.get(key) === i` governs keep/skip. Flagged in 11-02 per-dispatch review; unchanged after 11-01 landed. | Delete lines 199, 206-210. 5-line removal, zero risk. Algorithm produces identical output without them. Safe to fold into a micro-fix commit. |
| WARN | WR-03 | `validate.cjs:315-320` | **Dead `field` assignment in `formatErrors` errorMessage branch**: `let field = null; for (const sub of subErrors) {...; field = sub.params.missingProperty; break; }` — the computed `field` is never read. The branch immediately `continue`s using only `e.message` and `taskIndex`. Flagged in 11-02 per-dispatch review; unchanged. | Delete lines 315-320 (the `for (const sub of subErrors)` loop and the `let field = null` declaration inside the `errorMessage` branch). 6-line removal, zero risk. |
| WARN | WR-04 | `validate.cjs:147-148` | **`addFormats(ajv)` loads all format validators; plan-schema-v2.json uses zero `format` keywords.** Confirmed by inspecting the 11-01 final schema: no `format` constraints anywhere in root or definitions/task. ~20KB of unused validators loaded on every invocation. Flagged in 11-02; confirmed still true after 11-01. | If no format keywords will be added: `addFormats(ajv, { keywords: true })` (adds format as a keyword without validators, satisfying ajv-errors) or remove `addFormats` entirely and drop `ajv-formats` from package.json. If formats will be added in a future phase, add a comment: `// formats not used in v1 schema — retained for v2 addition`. |
| WARN | WR-05 | `sgsd-write-plan/SKILL.md:129-137` | **Temp file via `mktemp` + heredoc used in Step 4 for pre-validation.** The heredoc writes plan content to a temp file then calls validate.cjs on it. On Windows/WSL, `mktemp` path and `cat > "$TMP_PLAN" << 'PLAN_EOF'` is fragile (path separators, heredoc quoting of YAML). The skill will be invoked by LLMs on Windows. validate.cjs accepts any `.md` path — a deterministic temp path under `.planning/` (e.g. `.planning/.draft-plan.md`) would be more reliable. | Replace `mktemp` + heredoc with a Write tool call to a deterministic draft path (`.planning/.sgsd-draft-plan.md`), then validate, then delete. This keeps the flow in the agent's tool API rather than shell heredoc and avoids platform-specific temp path issues. Non-blocking but a usability improvement for Windows operators. |
| INFO | IN-01 | `sgsd-orchestrate/SKILL.md:260` | **ANCHOR comment left in production instruction**: `<!-- ANCHOR: RULE-8.5 — schema-fix dispatch branch. Plans 11-04 and 11-05 add sections AFTER this anchor. -->` is an implementation comment from the executor's edit-coordinate phase. It references the planning history, not the runtime behavior. | Delete the anchor comment before treating the orchestrator SKILL.md as stable. It confuses readers about whether sections are "in progress." Non-blocking. |
| INFO | IN-02 | `fixtures/` directory | **Fixture coverage is minimal.** `good-plan.md` and `bad-plan.md` cover the happy path and a missing-required-field failure. Not tested: wrong `model` enum value, `files_touched: []` (minItems violation), `schema_version: 1` on a v2 plan, duplicate YAML key path for the dedup fallback, missing `schema_version` entirely (v1 plan through the validator), and the `lessons_path` missing-file warning path. The validator gates every future plan. | Add fixtures for the 6 edge cases listed above. At minimum: a `bad-plan-wrong-enum.md` (model: "gpt-4") and a `bad-plan-empty-files.md` (files_touched: []). Suggest adding `make test` target in plan-schema/ that runs validate.cjs against all fixtures and asserts exit codes. |
| INFO | IN-03 | Phase distribution gap | **gsd-planner.md modifications are in `custom-gsd-extract/claude-agents/` (gitignored from the user's global ~/.claude/agents/).** The per-dispatch 11-02 ATC noted the distribution gap: changes to gsd-planner.md in the project repo do not automatically propagate to `~/.claude/agents/gsd-planner.md`. There is no install script or `super-gsd/agents/` source directory. | Create `super-gsd/agents/gsd-planner.md` as a source-of-truth directory with an `install.sh` that copies to `~/.claude/agents/`. This makes agent patches version-controlled and reproducible. Recommend as Phase 12 or 11-gaps follow-up. |

---

## Cross-Plan Observations

### Field-name drift: `task.goal` (WR-01 — highest priority)

Plans 11-03 (fix-schema mode) and 11-04/11-05 (orchestrator) share the `locked_fields = { id, goal, files_touched }` contract. `goal` was never defined in the 11-01 canonical schema. The per-dispatch 11-02 ATC did not catch this because it reviewed validate.cjs in isolation before the orchestrator edits landed. This is the canonical class of cross-plan bug that phase-level review exists to find.

The fix is surgical: replace `goal` → `hypothesis` in both the orchestrator locked_fields extraction and all gsd-planner.md fix_schema_mode references. `hypothesis` is a required task field and is the closest semantic anchor for "what this task is trying to prove" — locking it prevents the planner from drifting the approach intent during a repair.

### Architectural coherence: the pipeline composes cleanly

The pipeline — `sgsd-write-plan → validate.cjs → orchestrator Step 2 skip-path → Step 6.2 Rule 8.5 retry → gsd-planner --fix-schema` — is a clean state machine with no dead branches. Verified:

- sgsd-write-plan Step 4 calls validate.cjs `--mode write` before Step 5 Write tool
- Orchestrator Step 6.2 calls validate.cjs `--mode load` before gsd-executor dispatch
- Rule 8.5 retry loop uses `schema_fix_attempt < 3` with hard cap at 3 (D-10)
- Sibling promotion only happens on exit 0 (re-validate the sibling, not the planner's assertion)
- Checkpoint-on-cap includes all 3 error envelopes and attempt file contents
- D-14 non-blocking drift check confirmed: `// D-14: NON-BLOCKING` comment + no exit after warn

### No logic duplication across plans

validate.cjs contains all schema enforcement logic. sgsd-write-plan calls it rather than re-implementing validation. Orchestrator Step 6.2 calls it rather than re-implementing. gsd-planner --fix-schema reads the error envelope from plan-errors.jsonl (written by validate.cjs) rather than re-parsing ajv errors. The separation is clean.

### JSONL schema alignment

`plan-errors.jsonl` row shape matches the documented schema in validate.cjs header and the 11-02 plan `must_haves`. `readiness-log.jsonl` drift event shape matches D-14. `token-log.jsonl` classifier_skip event (orchestrator Step 2) is structurally consistent with existing token-log conventions. No schema drift detected across the three log files.

### config.json hash verification

Confirmed live: `sha256(plan-schema-v2.json)` === `config.workflow.schema_v2_hash` (`5867692d...`). No drift at review time. The hash was committed in the same wave as the schema file, satisfying RQ-6 Pitfall 4.

### Self-referential validation confirmed

All five Phase 11 plan files pass `validate.cjs` at review time. Plans 11-03 and 11-05 trigger the duplicate-key dedup fallback (warn, not error) due to their dual `depends_on` declarations in frontmatter — the dedup logic correctly retains the last value.

---

## Critical vs Non-Blocking

**Critical (FAIL threshold): none.** No architectural bug prevents the pipeline from functioning for v2 plans that do not hit the fix-schema retry path. The `task.goal` phantom field (WR-01) is a logic error in an untested code path (Rule 8.5 has not fired in production) — it degrades the locked-field integrity guarantee but does not prevent validation from running.

**Non-blocking warnings (WR-01 through WR-05):** All 5 warnings have clean surgical fixes. WR-01 is the highest priority — fix before any Rule 8.5 live invocation. WR-02/WR-03 are safe deletes. WR-04 is a minor load efficiency issue. WR-05 is a platform reliability concern for Windows operators.

---

## Recommendations for v1.2 Follow-Up

1. **(WR-01 — fix before next live Rule 8.5 invocation)** Replace `task.goal` with `task.hypothesis` in orchestrator locked_fields extraction (SKILL.md:290) and all gsd-planner.md fix_schema_mode references. Open as `11-gaps` micro-plan or inline fix commit.

2. **(WR-02/WR-03 — safe cleanup)** Delete 14 dead lines in validate.cjs (deduplicateTopLevelKeys dead vars + formatErrors dead field assignment). Fold into a single `chore(11): cleanup dead vars in validate.cjs` commit.

3. **(IN-02 — test coverage)** Add 6 edge-case fixtures to `fixtures/` and a `npm test` script in `super-gsd/tools/plan-schema/package.json` that asserts exit codes. Before Phase 12 uses the validator as a hard gate.

4. **(IN-03 — distribution)** Create `super-gsd/agents/` source directory with install script for agent patches. gsd-planner.md --fix-schema section should live there, not only in `custom-gsd-extract/claude-agents/`.

5. **(WR-04 — optional)** Scope `addFormats` to keyword-only mode or remove if no format constraints are planned for the schema. Reduces cold-start overhead for every validate.cjs invocation.

---

_Reviewed: 2026-04-21T21:31:54Z_
_Reviewer: Claude (gsd-code-reviewer / claude-sonnet-4-6)_
_Tier: FULL phase-level_
_Scope: Phase 11 — Plan Schema v2 (all 5 plans)_

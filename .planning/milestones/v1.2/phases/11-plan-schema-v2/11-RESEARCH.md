# Phase 11: Plan Schema v2 - Research

**Researched:** 2026-04-21
**Domain:** JSON Schema validation (ajv), Node CLI tooling, orchestrator integration
**Confidence:** HIGH (all findings from local codebase inspection + npm registry)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: `expected_ATC_tier` default = `LITE`
- D-02: `prior_errors_lookup` tier-sensitive (true for FULL/GATE, false for LITE/SKIP)
- D-03: `skip_gates` default = `[]`
- D-04: `lessons_path` set-but-missing = warn + continue
- D-05: `depends_on: []`, `known_deadends: []`, `verification_cmd: null`
- D-06: Validator at `super-gsd/tools/plan-schema/validate.cjs`
- D-07: Validation fires at both write-time and load-time
- D-08: Dual error format — human summary to console + full ajv array to `plan-errors.jsonl`
- D-09: Self-healing loop dispatches `gsd-planner --fix-schema`; preserves `task.id`, `task.goal`, `task.files_touched`
- D-10: Retry cap = 3; after 3 fails, write checkpoint with all 3 error envelopes + fix attempts → Exit #3
- D-11: Each attempt writes sibling `.fix-attempt-K.md`; promotes to overwrite only on re-validation pass
- D-12: Boot-time sha256 of `plan-schema-v2.json` vs `workflow.schema_v2_hash` in `config.json`
- D-13: This repo (GSDedits) is canonical; `superpowers:writing-plans` consumes via sync
- D-14: Drift action = warn + continue; emit to `readiness-log.jsonl`

### Claude's Discretion
- ajv version + vendoring strategy
- `superpowers:writing-plans` sync mechanism (build-time copy, hash reference, or other)
- Repair attempt staging file naming convention
- JSONL line shape for `plan-errors.jsonl`
- Classifier-skip completeness (derivation rule from `model` + `expected_ATC_tier`)

### Deferred Ideas (OUT OF SCOPE)
- Classifier-skip completeness as formal discussion (Phase 12 revisit)
- Auto-suggest fixes inline
- Voluntary v1 → v2 migration tool
- Schema evolution beyond v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | `plan-schema-v2.json` defines `schema_version: 2` YAML-frontmatter contract with `tasks: [...]`; rest of PLAN.md is free-form | RQ-1: ajv v8 + JSON Schema draft-07 chosen; RQ-2: validate.cjs pattern confirmed |
| SCHEMA-02 | Parser enforces required per-task fields at plan-load; rejects malformed tasks | RQ-1: ajv errorObject format; RQ-5: planner --fix-schema mode design |
| SCHEMA-03 | Optional per-task fields with documented defaults | D-01..D-05 locked; no new research required |
| SCHEMA-04 | Plans without `schema_version` or with `schema_version: 1` route through Haiku classifier; v2 plans skip | RQ-4: classifier contract confirmed from sgsd-classifier.md |
| SCHEMA-05 | `superpowers:writing-plans` emits v2 by default; schema pinned identically in both repos | RQ-3: writing-plans located; sync mechanisms documented |
</phase_requirements>

---

## Summary

Phase 11 is a Node CLI + orchestrator integration task. The validator (`validate.cjs`) must fit the established `super-gsd/tools/` CLI pattern (ESM-or-CJS Node script, named flags, stderr for progress, stdout for machine-readable output, `process.exit` codes). ajv v8 is the correct choice — current, draft-07-native, CommonJS-compatible, tree-shakeable. No schema validator exists anywhere in the repo today; this is net-new code.

The `superpowers:writing-plans` skill is a third-party Superpowers marketplace skill (v5.0.7 cached at `~/.claude/plugins/cache/superpowers-marketplace/superpowers/5.0.7/skills/writing-plans/SKILL.md`). It produces Markdown plans with a specific header format — NOT YAML frontmatter. This is the most significant integration gap: the skill currently emits plans to `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` in its own format. Making it emit v2 YAML frontmatter requires a skill overlay or replacement prompt, not a code change.

The orchestrator's classifier path is in `sgsd-orchestrate/SKILL.md` Step 2. The classifier input/output contract is fully documented in `sgsd-classifier.md`. For v2 plans, SCHEMA-04's skip path means the orchestrator reads `schema_version` from the plan frontmatter before deciding whether to spawn the Haiku classifier.

**Primary recommendation:** Build validate.cjs as a standalone CJS Node script mirroring phase-verifier.mjs patterns (named flags, stderr logging, stdout JSON for machine consumption, exit codes 0/1/2). Use ajv v8 + ajv-formats v3 + ajv-errors v3.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JSON Schema definition (`plan-schema-v2.json`) | `super-gsd/templates/` | — | Registry-owned resource, same tier as gates.yaml, handover-contract-v2.yaml |
| Validation CLI (`validate.cjs`) | `super-gsd/tools/plan-schema/` | — | D-06 locked; sibling to process-audit/ |
| Write-time enforcement | `superpowers:writing-plans` skill | — | External skill must call validate.cjs before emitting plan |
| Load-time enforcement | `sgsd-orchestrate` SKILL.md | — | Step 2 / Step 6 dispatch path |
| Error telemetry | `.planning/metrics/plan-errors.jsonl` | — | Append-only, same pattern as activity-log, token-log |
| Schema drift detection | `sgsd-orchestrate` cold-start | `config.json` workflow section | D-12: boot-time sha256 compare |
| Self-healing repair | `gsd-planner --fix-schema` | `sgsd-orchestrate` retry loop | D-09/D-10 |

---

## RQ-1: ajv + JSON Schema Stack

### Finding

**[VERIFIED: npm registry]** Current versions: ajv `8.18.0`, ajv-formats `3.0.1`, ajv-errors `3.0.0`.

ajv v8 breaks from v6 on three axes relevant here:
- **Draft support:** v8 natively supports JSON Schema draft-07 and draft-2019-09/2020-12. v6 supports draft-07 by default. Since the codebase has no existing JSON Schema usage, there is no compatibility constraint to v6.
- **API change (BREAKING):** v8 requires `new Ajv()` + `ajv.compile(schema)` pattern; `ajv.validate(schema, data)` is still supported but the `Ajv` constructor options changed (`allErrors`, `useDefaults` now require explicit opt-in). ajv v6 used `jsonPointers` option; v8 uses `verbose` mode differently.
- **CommonJS support:** ajv v8 ships as ESM-first but includes a CJS build (`require('ajv')`). `validate.cjs` can use `require('ajv')` without transpilation. [VERIFIED: ajv v8 npm package includes `dist/ajv.js` CJS entry]
- **ajv-errors v3:** Compatible with ajv v8 only (ajv-errors v2 was v6-only). Provides `{message: "..."}` keyword for custom messages on failing schemas — needed for D-08's human-readable lines. [ASSUMED: ajv-errors v3 API; not inspected directly]
- **ajv-formats v3:** Compatible with ajv v8. Adds format validators (uri, date-time, etc.) — useful for `verification_cmd` URL validation in the schema.

**JSON Schema draft to use:** Draft-07. Rationale: ajv v8 defaults to draft-07 behavior; draft-07 has full `$ref`, `if/then/else`, and `required` support. Draft-2020-12 adds `unevaluatedProperties` (useful for strict additionalProperties enforcement) but requires `new Ajv2020()` import and adds bundle complexity. Given the v2 schema only needs standard structural validation (required fields, type checks, enum values), draft-07 is sufficient and simpler.

### Recommendation

```
ajv@8.18.0 + ajv-formats@3.0.1 + ajv-errors@3.0.0
JSON Schema draft-07
```

**Install:**
```bash
npm install ajv@8 ajv-formats@3 ajv-errors@3 --save-dev
```

Scope to `super-gsd/tools/plan-schema/` as a local `package.json`. Do NOT add to root (no root `package.json` exists in this repo). [VERIFIED: no root package.json found in GSDedits]

**Unknowns for planner:** Whether to vendor (check in `node_modules`) or require `npm install` as a setup step. Phase-verifier uses native ESM and has its own `package.json` at `super-gsd/tools/phase-verifier/package.json` — same pattern applies here.

---

## RQ-2: Existing super-gsd/tools/ Node CLI Patterns

### Finding

**[VERIFIED: local file inspection]**

Two Node tools exist in `super-gsd/tools/`:

**1. `super-gsd/tools/phase-verifier/phase-verifier.mjs`** (ESM, `.mjs`, 616 lines)
- Arg parsing: manual loop over `process.argv` with named flags (`--project-dir`, `--phase`, `--session`)
- Exit codes: `0 = PROVEN`, `1 = UNPROVEN`, `2 = BLOCKED` (tool precondition / backend down)
- Stdout/stderr discipline: **progress and logging to `console.error` (stderr)**; stdout reserved for machine output
- Config: reads `.planning/config.json` at startup
- Report: writes a `.md` file to the phase dir, returns exit code only to caller
- Invocation: `node phase-verifier.mjs --project-dir PATH --phase NN`

**2. `super-gsd/tools/process-audit/*.ps1` + `analyze.js`**
- PowerShell scripts for process management (not a validator pattern)
- `analyze.js` appears to be a one-off script (listed in directory but not readable — 0 bytes or absent)

**Closest analog to validate.cjs:** `phase-verifier.mjs` is the canonical model. It:
- Loads config from `config.json`
- Emits structured progress to stderr
- Returns a deterministic exit code
- Writes an artifact (for validate.cjs: the JSONL append to `plan-errors.jsonl`)
- Is invocable as `node validate.cjs --plan-file PATH --project-dir PATH`

**Schema validator search:** `grep` for `ajv`, `jsonschema`, `validate` across `super-gsd/` returned 44 files but all matches were in prose descriptions (skill text, brv-seed patterns) — not actual validator code. **No existing schema validator implementation exists in the repo.** [VERIFIED: grep]

### Recommendation

`validate.cjs` should use the phase-verifier pattern:
- CJS (not ESM) so it can `require('ajv')` without import assertions
- Manual arg parsing: `--plan-file PATH`, `--project-dir PATH`, `--mode write|load` (write-time vs load-time context)
- Exit codes: `0 = VALID`, `1 = INVALID (schema errors)`, `2 = BLOCKED (file not found, JSON parse error)`
- Stderr: human-readable summary lines matching D-08 format
- Stdout: JSON array of ajv errorObjects (for orchestrator consumption, if any)
- Side-effect: append one JSONL row to `.planning/metrics/plan-errors.jsonl`

---

## RQ-3: superpowers:writing-plans Composition Mechanism

### Finding

**[VERIFIED: local file inspection]** Skill located at:
`~/.claude/plugins/cache/superpowers-marketplace/superpowers/5.0.7/skills/writing-plans/SKILL.md`

Key facts:
- This is a **third-party Superpowers marketplace skill** (external to GSDedits repo)
- It emits plans in a **Markdown prose format** with `- [ ]` checkbox steps — NOT YAML frontmatter
- Save target: `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` (its default, user-overridable)
- It has **no `validate.cjs` call**, no schema awareness, no frontmatter emission
- It is **cached locally at a versioned path** — it is NOT in the GSDedits git repo and cannot be directly modified via a code commit to this repo

This is the most significant integration gap for SCHEMA-05. The skill's prose format is fundamentally different from the v2 YAML-frontmatter format. Getting `superpowers:writing-plans` to emit v2 requires one of:

| Option | Mechanism | Tradeoff |
|--------|-----------|----------|
| A: Overlay prompt | Write a GSDedits-local `writing-plans-overlay.md` that wraps the skill invocation with a "before you write, emit this YAML header" instruction | Low friction, survives skill upgrades, but relies on LLM compliance — not mechanical enforcement |
| B: Replacement skill | Create `super-gsd/skills/sgsd-write-plan/SKILL.md` that replaces writing-plans entirely for GSD plan authoring | Full control, validate.cjs can be called explicitly; user must use new skill name |
| C: Post-emit hook | External skill emits as-is; a post-emit script (PreToolUse hook on Write to `*PLAN.md`) calls `validate.cjs` and rejects non-compliant writes | Catches non-compliance at write gate without requiring skill modification |

**D-13 canonical sync:** GSDedits is canonical. The plan-schema-v2.json file lives at `super-gsd/templates/plan-schema-v2.json`. Since the writing-plans skill is in a versioned cache (not git-controlled), the sync mechanism must be a reference to the canonical path, not a copy into the external skill.

**D-12 hash mechanism:** `config.json` gets a `workflow.schema_v2_hash` key. At session start (orchestrator cold-start), sha256 of `super-gsd/templates/plan-schema-v2.json` is computed and compared. Node's built-in `crypto.createHash('sha256')` handles this with no new dependency.

### Recommendation

Option B (replacement skill `sgsd-write-plan`) gives the tightest SCHEMA-05 compliance — the skill explicitly calls `validate.cjs` before emitting. Option A (overlay) is viable if the planner judges Option B as out of scope for Phase 11. Planner must decide. Flag for planner: the existing `superpowers:writing-plans` skill **cannot be forced to emit YAML frontmatter without a code change or overlay** because its task structure format is checkboxes, not frontmatter.

**Unknowns for planner:** Which option (A/B/C) is in scope for Phase 11 vs. Phase 12 machinery.

---

## RQ-4: Haiku Classifier Skip-Path Integration

### Finding

**[VERIFIED: local file inspection]** `sgsd-classifier.md` (lines 1-53) fully documents the contract:

**Input contract:**
```json
{
  "goal": "phase goal (one sentence)",
  "files": "list of files to modify",
  "lines": "estimated lines changed (number)",
  "type": "feature|bugfix|refactor|config|docs"
}
```

**Output contract:**
```json
{
  "complexity": "light|standard|heavy",
  "model": "haiku|sonnet|opus",
  "atc_tier": "skip|lite|full|gate",
  "deliberate": false,
  "reason": "one sentence max"
}
```

The orchestrator (`sgsd-orchestrate/SKILL.md` Step 2) always spawns the Haiku classifier as a sub-agent. There is **no existing classifier-skip branch** in the current orchestrator code — Step 2 is unconditional.

**D-02's `classifier_skip` field:** A v2 plan that declares `model` (required by SCHEMA-02) and optionally `expected_ATC_tier` (D-01 default = LITE) provides enough data to populate the classifier output struct without calling Haiku. The derivation rule from CONTEXT.md:
- `complexity` ← derived from `files_touched` count + estimated lines (orchestrator approximation)
- `model` ← read directly from `plan.model`
- `atc_tier` ← read directly from `plan.expected_ATC_tier` (or default LITE)
- `deliberate` ← derived from `depends_on` count and `files_touched` breadth

The **insertion point** for the skip-path is `sgsd-orchestrate/SKILL.md` Step 2. Before spawning the Haiku classifier, the orchestrator reads the plan's YAML frontmatter and checks `schema_version`. If `schema_version: 2`, it synthesizes the classifier struct locally and skips the Agent spawn.

**[ASSUMED]** The orchestrator currently parses plan frontmatter to get `phase` and `plan` fields for state tracking — the v2 skip-path extends this existing parse with two additional field reads (`model`, `expected_ATC_tier`).

### Recommendation

The planner should add a pre-Step-2 branch to `sgsd-orchestrate/SKILL.md`:
```
IF frontmatter.schema_version == 2:
  BUILD synthetic_classifier_result from {model, expected_ATC_tier, files_touched, depends_on}
  SKIP Agent(sgsd-classifier) spawn
  USE synthetic_classifier_result as classifier output
ELSE:
  PROCEED with existing Step 2 (spawn Haiku classifier)
```

No new fields needed on v2 plans beyond what SCHEMA-02 already requires.

---

## RQ-5: gsd-planner --fix-schema Mode

### Finding

**[VERIFIED: local file inspection]** `custom-gsd-extract/claude-agents/gsd-planner.md` (1294 lines) has established mode branching at the `<gap_closure_mode>` and `<revision_mode>` sections. These delegate to reference files:
- `--gaps` → `get-shit-done/references/planner-gap-closure.md`
- `<revision_context>` present → `get-shit-done/references/planner-revision.md`
- `--reviews` → `get-shit-done/references/planner-reviews.md`

Each mode is detected in `<step name="load_mode_context">` and loads a reference file before proceeding. The `--fix-schema` mode extension follows this exact same pattern: add a detection branch and a reference file.

**Existing prior art for self-healing:** CONTEXT.md §Reusable Assets identifies dispatch Rule 8 ("Verification failed → dispatch planner --gaps") as the prior art. The fix-schema loop has the same structure: detect failure → dispatch planner variant → re-validate → retry or halt.

**Key design constraints from D-09/D-10/D-11:**
1. `task.id`, `task.goal`, `task.files_touched` must be preserved verbatim
2. Only schema-structural violations are fixed (missing fields, wrong types, field ordering)
3. Each attempt writes to `{NN}-{PP}-PLAN.fix-attempt-K.md` sibling
4. On pass: sibling promoted to overwrite `{NN}-{PP}-PLAN.md`; sibling deleted
5. After 3 failures: checkpoint written with all 3 error envelopes AND all 3 fix attempt file contents

**Ambiguity for planner:** The `--fix-schema` planner needs to receive the error envelope as input. Two delivery options:
- Pass the path to the `plan-errors.jsonl` row (planner reads and parses)
- Pass the error JSON inline in the orchestrator prompt to the planner

The inline approach avoids file-read overhead in the planner. The path approach is more consistent with how orchestrator passes plan file paths. Planner must decide.

**Unknowns:** Where the `planner-fix-schema.md` reference file should live — in `get-shit-done/references/` (GSD framework) or `super-gsd/` (this repo). Given the fix-schema mode is Phase-11-specific to this repo's schema, `super-gsd/references/planner-fix-schema.md` or inline in the planner agent seems more appropriate than polluting the GSD framework.

---

## RQ-6: sha256 Boot-Hash Drift Check (D-12)

### Finding

**[VERIFIED: grep across super-gsd/]** Two files reference `createHash`/`sha256`:
- `super-gsd/scripts/sgsd-mission-control.ps1` — no match on closer inspection (grep returned false positive from file path; `sha256` does not appear in the file content)
- `super-gsd/agents/sgsd-executor.md` — references sha256 in prose, not code

**Conclusion:** No existing sha256 hash utility in `super-gsd/`. The boot-hash check is net-new code. [VERIFIED: grep]

**Insertion point:** `sgsd-orchestrate/SKILL.md` cold-start sequence (after reading `config.json`, before entering the loop). The cold-start currently reads `config.json` at Step 3 — the hash check slots here:

```javascript
// Node one-liner usable inline in orchestrator bash step:
const crypto = require('crypto');
const fs = require('fs');
const actual = crypto.createHash('sha256')
  .update(fs.readFileSync('super-gsd/templates/plan-schema-v2.json'))
  .digest('hex');
const expected = config.workflow.schema_v2_hash;
if (actual !== expected) {
  // append to readiness-log.jsonl, console warn, continue
}
```

This can be a 5-line inline bash `node -e` call in the cold-start, OR a helper function in a small `super-gsd/tools/plan-schema/hash-check.cjs` that shares the `plan-schema/` directory with `validate.cjs`.

**readiness-log.jsonl:** The file does not exist yet (`readiness-log.jsonl` was not found on disk at `.planning/metrics/`). The drift event creates it on first write. Format per D-14:
```json
{"ts":"2026-04-21T...","type":"schema_pin_drift","expected_hash":"abc...","actual_hash":"def..."}
```

### Recommendation

Implement as an inline `node -e` in the orchestrator's cold-start bash block (no new file needed). The `workflow.schema_v2_hash` key in `config.json` starts absent; the planner task that creates `plan-schema-v2.json` must also compute and insert the initial hash value.

---

## RQ-7: Error Envelope JSONL Schema (D-14 deferred partially, D-08 live)

### Finding

**[VERIFIED: local file inspection]** Existing JSONL conventions from the metrics/ files:

**activity-log.jsonl** (lines 1-5):
```json
{"ts":"2026-04-10T19:22:58.622Z","tool":"Read","target":"test.md"}
```
Fields: `ts` (ISO-8601), `tool`, `target`, optional `phase`

**token-log.jsonl** (lines 1-5):
```json
{"ts":"...","tool":"Agent","model":"unknown","description":"unknown","est_input":1,"est_output":0,"total":1}
```
Fields: `ts`, `tool`, `model`, `description`, `est_input`, `est_output`, `total`

**intent-log.jsonl** (from SKILL.md prose):
```json
{"ts":"...","phase":N,"milestone":"v1.X","outcome":"...","agent":"gsd-executor"}
```

**orchestrator-pulse.jsonl** (from SKILL.md prose):
```json
{"ts":"...","phase":N,"plan":P,"iteration":I,"step":"loop_entry"}
```

**Common conventions:**
- `ts` is always first, ISO-8601 format
- Numeric fields use bare numbers (not strings)
- Optional context fields (`phase`, `plan`) follow core fields
- No nesting — flat JSON objects only
- Append-only, never mutate

### Proposed plan-errors.jsonl schema

```json
{
  "ts": "2026-04-21T10:00:00.000Z",
  "event": "validation_run",
  "plan_file": "11-01-PLAN.md",
  "phase": 11,
  "plan": 1,
  "schema_version": 2,
  "mode": "load",
  "valid": false,
  "error_count": 2,
  "errors": [
    {
      "instancePath": "/tasks/1/falsifier",
      "schemaPath": "#/properties/tasks/items/required",
      "keyword": "required",
      "message": "must have required property 'falsifier'"
    }
  ]
}
```

Pass rows (`valid: true`) also appended — `errors: []` — per D-08 "including pass rows for telemetry."

**Retention/rotation:** No existing metrics files have rotation logic. All are append-only, no TTL. Consistent with current convention: no rotation policy for Phase 11. Planner may add a `--quiet` flag to validate.cjs that suppresses pass-row telemetry if log volume becomes a concern, but this is not required.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema validation | Custom field-presence checker | ajv v8 | Handles $ref, if/then/else, additionalProperties, human-readable errors via ajv-errors |
| SHA-256 hashing | Implement hash algorithm | Node built-in `crypto.createHash('sha256')` | No new dependency; available in all Node versions |
| YAML frontmatter parsing | Custom regex parser | js-yaml or `gray-matter` | Edge cases in multi-line strings, quoted colons; already used by gsd-tools if applicable |

**Check first:** Before adding gray-matter, verify if `gsd-tools.cjs` already exposes frontmatter parsing (it has a `frontmatter validate` command per the planner agent — the underlying library may be reusable).

---

## Common Pitfalls

### Pitfall 1: ajv v8 CJS Require Path
**What goes wrong:** `require('ajv')` in a `.cjs` file resolves to the ESM entry in ajv v8 and throws `ERR_REQUIRE_ESM`
**Why it happens:** ajv v8's `package.json` `exports` field maps `require` to a CJS build, but only if the import path is correct
**How to avoid:** Use `const Ajv = require('ajv').default` (ajv v8 CJS build exports a default export)
**Warning signs:** `TypeError: Ajv is not a constructor` at validate.cjs startup

### Pitfall 2: YAML Frontmatter Parse Scope
**What goes wrong:** Validator reads the entire PLAN.md as JSON and fails on the free-form body
**Why it happens:** PLAN.md is `---` frontmatter + free-form Markdown — only the frontmatter is schema-validated
**How to avoid:** Parse only the YAML between the first `---` delimiters; treat everything after the second `---` as opaque text
**Warning signs:** ajv errors on non-existent paths that reference Markdown headings

### Pitfall 3: fix-schema Loop Preserves Wrong Fields
**What goes wrong:** Planner `--fix-schema` regenerates `task.goal` slightly differently, breaking the "preserve semantic intent" contract (D-09)
**Why it happens:** LLM rephrases while fixing; the orchestrator can't diff intent without a baseline
**How to avoid:** Extract `task.id`, `task.goal`, `task.files_touched` from the original before dispatching the fix agent; inject them as locked constraints in the fix-agent prompt
**Warning signs:** Fix attempt K passes validation but the orchestrator's diff shows goal text changed

### Pitfall 4: Hash Stored Stale After Schema Edit
**What goes wrong:** Developer edits `plan-schema-v2.json` but forgets to update `workflow.schema_v2_hash` in `config.json`; every session start emits a drift warning
**Why it happens:** The hash and the file are maintained independently
**How to avoid:** The plan task that writes `plan-schema-v2.json` must atomically compute and write the hash to `config.json` in the same commit
**Warning signs:** Drift warning fires on the very first session after Phase 11 ships

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | ajv v8 CJS build requires `.default` destructure: `require('ajv').default` | RQ-1 | validate.cjs TypeError at startup; fix is one-line |
| A2 | ajv-errors v3 provides `{message: "..."}` keyword for custom messages | RQ-1 | D-08 human-readable lines need alternate implementation (format in validate.cjs instead) |
| A3 | Orchestrator currently parses plan frontmatter for phase/plan fields | RQ-4 | If not, the v2 skip-path requires adding frontmatter parsing to the orchestrator — larger diff |
| A4 | `gsd-tools.cjs` frontmatter parsing uses an extractable library (e.g., gray-matter) | Don't Hand-Roll | If not, validate.cjs needs its own YAML parser dependency |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | validate.cjs runtime | Yes | (system Node; phase-verifier.mjs works) | — |
| npm | ajv install | Yes | (system npm) | — |
| ajv@8 | validate.cjs | Not yet installed | 8.18.0 available | — |
| ajv-formats@3 | validate.cjs | Not yet installed | 3.0.1 available | — |
| ajv-errors@3 | validate.cjs | Not yet installed | 3.0.0 available | — |
| `superpowers:writing-plans` | SCHEMA-05 write-time enforcement | Yes (cached v5.0.7) | 5.0.7 | — |

**Missing dependencies with no fallback:** None — all missing items are installable.

**Integration gap (not a missing tool):** `superpowers:writing-plans` skill format is incompatible with v2 YAML frontmatter. Planner must decide overlay/replacement/hook strategy (RQ-3 options A/B/C).

---

## Open Questions

1. **writing-plans sync mechanism (RQ-3)**
   - What we know: Skill is a cached marketplace asset; cannot be code-patched in this repo
   - What's unclear: Whether Phase 11 ships an overlay (Option A), a replacement skill (Option B), or a post-emit hook (Option C)
   - Recommendation: Planner decides. If Phase 11 scope is tight, Option C (PreToolUse hook on Write to `*PLAN.md`) is the lowest-effort enforcement point that doesn't require touching the external skill

2. **planner-fix-schema reference file location (RQ-5)**
   - What we know: Existing modes delegate to `get-shit-done/references/*.md` files in the GSD framework
   - What's unclear: Whether fix-schema logic belongs in the GSD framework (globally reusable) or in `super-gsd/` (repo-specific)
   - Recommendation: Inline the fix-schema logic directly in `gsd-planner.md` as a new `<fix_schema_mode>` section (same file, no new reference file) — smaller diff, same pattern as how tier_prompts live in sgsd-classifier.md

3. **Error envelope delivery to fix-planner (RQ-5)**
   - What we know: D-09 says planner receives "the ajv error envelope from plan-errors.jsonl"
   - What's unclear: File path reference vs inline JSON in orchestrator prompt
   - Recommendation: Inline the most recent JSONL row for that plan (already parsed by orchestrator) to avoid a file-read in the planner context

---

## Sources

### Primary (HIGH confidence)
- `super-gsd/tools/phase-verifier/phase-verifier.mjs` — CLI pattern (exit codes, stderr logging, config loading)
- `super-gsd/agents/sgsd-classifier.md` — classifier input/output contract
- `custom-gsd-extract/claude-agents/gsd-planner.md` — planner mode branching patterns
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — orchestrator loop steps, classifier dispatch point
- `~/.claude/plugins/cache/superpowers-marketplace/superpowers/5.0.7/skills/writing-plans/SKILL.md` — writing-plans skill format
- `.planning/metrics/activity-log.jsonl`, `token-log.jsonl` — JSONL conventions
- `.planning/config.json` — config.json structure and existing workflow keys
- npm registry (`npm view ajv version`, `npm view ajv-formats version`, `npm view ajv-errors version`) — current package versions

### Tertiary (LOW confidence — training knowledge only)
- ajv v8 CJS require pattern (`require('ajv').default`) [ASSUMED A1]
- ajv-errors v3 `{message}` keyword behavior [ASSUMED A2]

## Metadata

**Confidence breakdown:**
- Standard stack (ajv versions): HIGH — npm registry verified
- CLI patterns: HIGH — direct file inspection of phase-verifier.mjs
- writing-plans integration: HIGH — skill file directly inspected; gap is confirmed fact
- Classifier skip-path: HIGH — sgsd-classifier.md and orchestrate SKILL.md both inspected
- planner --fix-schema: MEDIUM — planner.md structure inspected; fix-schema extension design is inferred from patterns
- sha256 approach: HIGH — Node built-in; no existing precedent in repo (net-new)
- JSONL schema proposal: HIGH — derived from 4 existing log files

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable domain; ajv versions change slowly)

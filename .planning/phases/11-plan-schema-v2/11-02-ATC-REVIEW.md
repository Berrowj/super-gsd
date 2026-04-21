---
plan: 11-02
tier: FULL
verdict: WARN
critical: 0
warning: 3
info: 2
reviewed: 2026-04-21T20:15:00Z
reviewer: claude-sonnet-4-6 (gsd-code-reviewer)
---

# Plan 11-02 ATC Review — Per-Dispatch FULL Tier

**Verdict:** WARN
**Tier:** FULL (per-dispatch, single plan)
**Scope:** commits 29932cd..e803fc8
**Files reviewed:** `super-gsd/tools/plan-schema/validate.cjs`, `super-gsd/tools/plan-schema/package.json`, `super-gsd/templates/plan-schema-v2.json` (stub — stub completeness not graded)

---

## Findings Table

| Sev | Location | Finding | Recommendation |
|-----|----------|---------|----------------|
| WARN | validate.cjs:188-225 | `deduplicateTopLevelKeys` has a dead variable: `totalOccurrences` (line 210) is computed but never read. The `keyOccurrences` Map is also built but unused in the decision logic — only `seen` is actually checked. | Delete `keyOccurrences` map, `count` variable, and `totalOccurrences` computation (lines 199, 206-210). The logic is correct without them — `seen.get(key) === i` is the sole keep/skip decision. |
| WARN | validate.cjs:314-321 | In `formatErrors`, the variable `field` is declared and conditionally set inside the `errorMessage` branch (lines 315-320) but is never read — the function `continue`s before using it. Dead assignment with misleading intent. | Delete lines 315-320 (the `let field = null; for subErrors…` block inside the `errorMessage` branch). The branch only uses `e.message` and `taskIndex`. |
| WARN | validate.cjs:147-148 | `addFormats(ajv)` installs all ajv-formats plugins (date, uri, email, etc.). The plan-schema-v2.json stub uses no `format` keywords. If the full 11-01 schema also adds no `format` constraints, this adds ~20KB of format validators with zero payoff. | Acceptable as a forward-compatibility measure if 11-01 will use `format` keywords (e.g., `"format": "uri"` on `lessons_path`). Flag to 11-01 author: if no formats are used, switch to `addFormats(ajv, { keywords: true })` or remove entirely. Non-blocking. |
| INFO | validate.cjs:363-366 | `derivePriorErrorsLookup` derives a boolean from `expected_ATC_tier` and injects it back into `frontmatter` after validation (line 431). This mutates the parsed frontmatter object post-validation rather than returning a separate result. Not a bug — `frontmatter` is local — but the side-effect is implicit. | Minor: return the boolean and assign at call-site for clarity: `const derived = derivePriorErrorsLookup(frontmatter); frontmatter.prior_errors_lookup = derived;` Already fine as-is. |
| INFO | validate.cjs:9-10 | Stdout is described as "reserved for machine output (currently unused; may emit JSON in future)." This is an intentional placeholder, not dead code. Flagged only for awareness — no action needed. | If future machine output is added, document the schema at that point. |

---

## 10-Point Anti-Slop Grid

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Every function has a caller (no orphans) | P | All 8 functions called from `main()` or each other. `printUsage` called from `parseArgs`. |
| 2 | Every import is used | P | `fs`, `path` used throughout. `gray-matter`, `js-yaml`, `ajv`, `ajv-formats`, `ajv-errors` all loaded and called. All 5 deps in package.json exercised. |
| 3 | Every parameter is read | W | `deduplicateTopLevelKeys`: `keyOccurrences` Map and `count` variable computed but never read in the branching logic (only `seen` governs the decision). Dead params/vars, not dead function params. |
| 4 | Could this be less code? | W | Yes: dead vars in `deduplicateTopLevelKeys` (~8 lines) and dead `field` assignment in `formatErrors` errorMessage branch (~6 lines). 14 lines deletable. File is 458 lines — justified for the feature set otherwise. |
| 5 | New abstractions justified? | P | `extractFrontmatter`, `buildValidator`, `loadSchema`, `appendTelemetry`, `formatErrors`, `derivePriorErrorsLookup`, `checkLessonsPath`, `validatePlanFilePath` — each maps 1:1 to a D-spec requirement. No speculative wrappers. |
| 6 | Does existing tools/ code do 80% of this? | P | `phase-verifier.mjs` is the closest neighbour (same stderr pattern, manual argv loop). The new tool reuses those patterns faithfully but cannot share code — it is CJS (not ESM), has different deps, and solves a distinct problem. No YAGNI reuse opportunity missed. |
| 7 | Would a senior engineer mass-delete anything? | P | No speculative code blocks. D-02 derivation, D-04 lessons check, T-11-03 path validation all trace to explicit plan requirements. |
| 8 | ΔComplexity | P | Net-new file; cyclomatic complexity per function is low (highest is `deduplicateTopLevelKeys` at ~6, `formatErrors` at ~8). Acceptable. |
| 9 | YAGNI additions | P | `--help` flag is minimal standard CLI practice, not speculative. No unused CLI flags. |
| 10 | Does this dispatch do ONE thing? | P | Single responsibility: install + scaffold a validator CLI. Installer (package.json), validator (validate.cjs), stub bridge (plan-schema-v2.json) are cohesive. Bundling is reasonable given the stub is an explicit bridge artefact owned by this dispatch. |

---

## Surgical Assessment

### Bug-fix confirmations (executor mid-execution edits)

**YAML dup-key dedup** — The fix is minimal-diff and correctly scoped. The raw frontmatter extraction (`getRawFrontmatter`) and `deduplicateTopLevelKeys` are written exactly for the duplicate-key edge case. The fallback path is exercised only on `duplicated mapping key` errors, everything else still exits via the standard gray-matter path. No premature generalisation detected. The dead `keyOccurrences`/`totalOccurrences` variables (WARN-1) appear to be a refactor artefact from an earlier version of the algorithm that was simplified during the fix — a common mid-edit residue.

**ajv-errors format** — `addErrors(ajv)` is called correctly after `addFormats`. The `require` paths use `__dirname`-scoped resolution to the tool's own `node_modules`, which is the right pattern for a standalone tool that is not in the monorepo's root dependency tree.

### Bridge stub (plan-schema-v2.json)

The stub is genuinely minimal: it validates `schema_version: 2` and `tasks[].required` fields only, with `additionalProperties: true` so 11-01's additions are non-breaking. The `$schema` declaration, title, and description clearly label it as a stub. Plan 11-01 can overwrite the `properties`, `definitions`, and `required` blocks without any structural conflict. No concern.

### D-08 dual error format

Both paths confirmed implemented:
- **stderr human-readable**: `formatErrors()` → `err(line)` loop (lines 441-443) ✓
- **JSONL telemetry**: `appendTelemetry()` called on both fail path (line 438) and pass path (line 451) ✓
- Pass rows also emit telemetry (line 451) — this is correct per D-08's "per run" requirement ✓

### D-14 JSONL schema

The `plan-errors.jsonl` schema mirrors existing logs correctly:
- `ts` is first field ✓
- JSON-per-line, no array wrapper ✓
- `event` field present (mirrors `activity-log.jsonl` convention) ✓
- Actual emitted rows (visible in plan-errors.jsonl) match the documented schema in the file header ✓

### Orphan edits / scope drift

None. All functions in validate.cjs map to a D-spec requirement in the plan. package.json's dep list matches exactly what validate.cjs loads.

---

## Recommendations

### Blocking (must-fix before 11-01 dispatches)

None. No critical bugs or security issues found.

### Non-blocking (recommended follow-up, own ticket or inline fix)

1. **Delete dead vars in `deduplicateTopLevelKeys`** (validate.cjs lines 199, 206-210): `keyOccurrences`, `count`, `totalOccurrences`. The algorithm is correct without them. Removal is a 5-line deletion.

2. **Delete dead `field` assignment in `formatErrors` errorMessage branch** (validate.cjs lines 315-320): the `for (const sub of subErrors)` loop result is never used — the branch exits via `continue` using only `e.message` and `taskIndex`.

3. **Clarify `addFormats` intent** (validate.cjs line 147): Leave a comment confirming whether 11-01 schema will use `format` keywords. If not, remove the call or scope it to avoid loading unused validators.

Both items 1 and 2 are safe, isolated deletes with zero risk. Suggest folding into the 11-01 commit or opening a micro-fix plan.

---

_Reviewed: 2026-04-21T20:15:00Z_
_Reviewer: claude-sonnet-4-6 (gsd-code-reviewer)_
_Depth: FULL per-dispatch_

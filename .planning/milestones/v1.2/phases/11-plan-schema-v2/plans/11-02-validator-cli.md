---
phase: 11-plan-schema-v2
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/tools/plan-schema/validate.cjs
  - super-gsd/tools/plan-schema/package.json
autonomous: true
requirements:
  - SCHEMA-01
  - SCHEMA-02
  - SCHEMA-03

# v2 plan self-referential frontmatter
schema_version: 2
tasks:
  - id: t1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/plan-schema/package.json
      - super-gsd/tools/plan-schema/validate.cjs
    input_contract: RESEARCH.md RQ-1 (ajv v8), RQ-2 (phase-verifier pattern), RQ-7 (JSONL schema)
    output_contract: "validate.cjs exits 0/1/2 and appends to plan-errors.jsonl"
    hypothesis: standalone CJS CLI enables orchestrator + writing-plans to call validate without coupling to agent prose
    falsifier: "node validate.cjs --plan-file X exits with wrong code OR plan-errors.jsonl row is missing"
    stop_rule: exit 0 for valid plan, exit 1 for missing required field, exit 2 for missing file; JSONL row appended each run
expected_ATC_tier: FULL
skip_gates: []
depends_on: []
known_deadends: []
verification_cmd: null
lessons_path: null

must_haves:
  truths:
    - "validate.cjs exits 0 for a valid v2 plan, 1 for schema errors, 2 for file/parse failure"
    - "Human-readable error lines printed to stderr matching D-08 format"
    - "One JSONL row appended to .planning/metrics/plan-errors.jsonl per run (pass and fail)"
    - "package.json scoped to super-gsd/tools/plan-schema/ with ajv v8 + ajv-formats v3 + ajv-errors v3"
  artifacts:
    - path: "super-gsd/tools/plan-schema/validate.cjs"
      provides: "Standalone Node CJS validator CLI"
      exports: ["exit 0 VALID", "exit 1 INVALID", "exit 2 BLOCKED"]
    - path: "super-gsd/tools/plan-schema/package.json"
      provides: "Local package.json scoping ajv dependencies"
      contains: "ajv@8, ajv-formats@3, ajv-errors@3"
  key_links:
    - from: "super-gsd/tools/plan-schema/validate.cjs"
      to: ".planning/metrics/plan-errors.jsonl"
      via: "fs.appendFileSync on every run"
      pattern: "appendFileSync.*plan-errors\\.jsonl"
    - from: "super-gsd/tools/plan-schema/validate.cjs"
      to: "super-gsd/templates/plan-schema-v2.json"
      via: "require/readFileSync at startup"
      pattern: "plan-schema-v2\\.json"
---

<goal>
Build the standalone Node CJS validator CLI at super-gsd/tools/plan-schema/validate.cjs.

Purpose: Provides the mechanical enforcement point for write-time and load-time validation per D-07. Emits dual error format per D-08. Mirrors phase-verifier.mjs pattern (RQ-2).
Output: validate.cjs + package.json; npm install step documented.
</goal>

<context>
@.planning/phases/11-plan-schema-v2/11-CONTEXT.md
@.planning/phases/11-plan-schema-v2/11-RESEARCH.md
@super-gsd/tools/phase-verifier/phase-verifier.mjs
</context>

<interfaces>
<!-- phase-verifier.mjs pattern — validate.cjs mirrors this structure -->
Arg parsing: manual loop over process.argv (named flags)
Exit codes: 0 = success, 1 = validation failure, 2 = precondition/tool failure
Stderr: progress + human-readable errors (console.error)
Stdout: machine-readable JSON (console.log)
Config: reads .planning/config.json at startup

validate.cjs flags:
  --plan-file PATH     (required) path to PLAN.md to validate
  --project-dir PATH   (optional, default: cwd) project root for config.json + schema resolution
  --mode write|load    (optional, default: load) context tag for JSONL telemetry

D-08 stderr format:
  [filename] task #N: missing required 'fieldname' (SCHEMA-02)
  [filename] VALID (no errors)

D-08 JSONL row shape (RQ-7):
  { "ts": ISO-8601, "event": "validation_run", "plan_file": "11-01-PLAN.md",
    "phase": N, "plan": N, "schema_version": 2, "mode": "load",
    "valid": false, "error_count": 2,
    "errors": [ { "instancePath": "...", "schemaPath": "...", "keyword": "...", "message": "..." } ] }
  Pass rows: valid: true, errors: []

ajv pitfall (RQ-1 A1):
  const Ajv = require('ajv').default   // NOT require('ajv') directly
  const addFormats = require('ajv-formats')
  const addErrors = require('ajv-errors')
  const ajv = new Ajv({ allErrors: true, useDefaults: true })
  addFormats(ajv)
  addErrors(ajv)

YAML frontmatter pitfall (RQ-1 pitfall 2):
  Only parse YAML between first pair of '---' delimiters.
  Do NOT pass full PLAN.md content to ajv.
  Use gray-matter or manual split on '---' + js-yaml for the frontmatter block.
  Check if gsd-tools.cjs already exposes gray-matter before adding new dep.

prior_errors_lookup derivation (D-02):
  After resolving expected_ATC_tier (default LITE), compute:
  prior_errors_lookup = (tier === 'FULL' || tier === 'GATE')
  Inject this computed value into the validated object before returning result.
  Do NOT validate prior_errors_lookup against the schema as a required field —
  it is schema-optional but parser-derived.
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Scaffold package.json + install ajv dependencies</name>
  <files>super-gsd/tools/plan-schema/package.json</files>
  <action>
Create super-gsd/tools/plan-schema/package.json:
{
  "name": "sgsd-plan-schema",
  "version": "1.0.0",
  "description": "SGSD v2 plan schema validator",
  "main": "validate.cjs",
  "type": "commonjs",
  "dependencies": {
    "ajv": "^8.18.0",
    "ajv-formats": "^3.0.1",
    "ajv-errors": "^3.0.0",
    "js-yaml": "^4.1.0",
    "gray-matter": "^4.0.3"
  }
}

Then run: cd super-gsd/tools/plan-schema && npm install

Note: gray-matter handles YAML frontmatter parsing safely (multi-line strings, quoted colons).
js-yaml is gray-matter's peer dep. Do NOT add these to any root package.json (none exists per RQ-1).
  </action>
  <verify>
    <automated>node -e "require('C:/Users/jack.berrow/GSDedits/super-gsd/tools/plan-schema/node_modules/ajv'); console.log('ajv ok')"</automated>
  </verify>
  <done>package.json exists at super-gsd/tools/plan-schema/; node_modules present with ajv, ajv-formats, ajv-errors, gray-matter</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Implement validate.cjs</name>
  <files>super-gsd/tools/plan-schema/validate.cjs</files>
  <action>
Create super-gsd/tools/plan-schema/validate.cjs following the phase-verifier.mjs pattern (RQ-2).

Structure:
1. Parse args (--plan-file, --project-dir, --mode) via manual loop over process.argv
2. Read config.json from project-dir (for phase/plan extraction)
3. Load schema: readFileSync(path.resolve(__dirname, '../../templates/plan-schema-v2.json'))
4. Init ajv: const Ajv = require('ajv').default (CRITICAL: .default per RQ-1 A1 pitfall)
   addFormats(ajv); addErrors(ajv); compile schema
5. Parse PLAN.md frontmatter: use gray-matter to split only the frontmatter block
6. Validate frontmatter object against compiled schema
7. Derive prior_errors_lookup from resolved expected_ATC_tier (D-02):
   const tier = frontmatter.expected_ATC_tier || 'LITE'
   const prior_errors_lookup = (tier === 'FULL' || tier === 'GATE')
8. Build JSONL row per RQ-7 shape; extract phase/plan from plan_file name pattern NN-PP-*
9. Append JSONL row to {project-dir}/.planning/metrics/plan-errors.jsonl (create file if absent)
10. If invalid: print D-08 stderr lines per error; exit 1
    If valid: print "[filename] VALID" to stderr; exit 0
    If file not found / parse error: print to stderr; exit 2

D-08 stderr error format per error:
  console.error(`[${planFileName}] task #${taskIndex}: missing required '${field}' (SCHEMA-02)`)
  Use instancePath to derive taskIndex and field from ajv error objects.

Exit codes: 0 = VALID, 1 = INVALID (schema errors), 2 = BLOCKED (precondition failure)

Do NOT print any output to stdout in normal operation (reserve stdout for future machine use).
Do NOT hardcode project-dir — always resolve relative to --project-dir arg or cwd.

lessons_path warning (D-04): after validation passes, if lessons_path is set,
  check if the file exists; if not, console.error warning and continue (do not exit 1).
  </action>
  <verify>
    <automated>cd C:/Users/jack.berrow/GSDedits && node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/phases/11-plan-schema-v2/plans/11-01-schema-file.md --mode load; echo "Exit: $?"</automated>
  </verify>
  <done>
- validate.cjs exits 0 for a well-formed v2 plan
- validate.cjs exits 1 when a required task field is missing (tested with a temp bad plan)
- validate.cjs exits 2 when plan-file does not exist
- plan-errors.jsonl is appended on each run
- D-08 stderr lines match format [filename] task #N: missing required 'field' (SCHEMA-02)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plan-file arg → filesystem read | Path traversal possible if user-supplied path escapes project root |
| ajv error objects → stderr output | Error messages could expose internal paths |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-03 | Tampering | validate.cjs plan-file arg | mitigate | Resolve path with path.resolve; validate it ends in PLAN.md pattern before reading |
| T-11-04 | Information Disclosure | ajv error output to stderr | accept | stderr is operator-visible only; no secrets in schema field names |
| T-11-05 | Denial of Service | plan-errors.jsonl unbounded growth | accept | Append-only matches existing metrics/ convention; no TTL policy in Phase 11 |
</threat_model>

<verification>
cd C:/Users/jack.berrow/GSDedits && node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/phases/11-plan-schema-v2/plans/11-01-schema-file.md --mode load && echo "VALID exit 0 OK"
</verification>

<success_criteria>
- validate.cjs exits 0/1/2 correctly for valid/invalid/missing plan files
- JSONL row appended to .planning/metrics/plan-errors.jsonl on every run
- stderr error lines match D-08 format
- package.json + node_modules present in super-gsd/tools/plan-schema/
- prior_errors_lookup derivation from ATC tier implemented (D-02)
- lessons_path missing-file warning emitted without exit 1 (D-04)
</success_criteria>

<output>
After completion, create .planning/phases/11-plan-schema-v2/plans/11-02-SUMMARY.md
</output>

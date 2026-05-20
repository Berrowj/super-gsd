# SDD Implementer — P110-01 executor (Codex Pro Mode tools)

You are a fresh SDD implementer. No inherited context.

## What you are doing

3 tasks, 7 files total. DLB-09.1 implementation. Wires Codex dispatch typing into the DLB-08 mesh substrate.

## Read

1. `.planning/milestones/v3.0/phases/110-codex-pro-mode-lanes/110-01-codex-pro-mode-lanes-PLAN.md` — 3-task contract
2. `.planning/milestones/v3.0/phases/110-codex-pro-mode-lanes/110-CONTEXT.md` — full design + 6 invariants
3. `.planning/proposals/2026-05-20-sgsd-pro-mode-codex-context-authority-plan.md` (sections §4.1-4.5 for spec)
4. `super-gsd/scripts/codex-executor.sh` + `codex-exec.sh` — existing wrappers; this phase's tools resolve profiles + classify routing FOR these wrappers, not replace them
5. `super-gsd/tools/mesh-memory/review-finding-writer.cjs` — native-review emits CMBs via the same shape
6. `super-gsd/tools/mesh-memory/cmb-validate.cjs` — exemplar shape for new CLIs (requireDependency plan-schema-first; --help; JSONL metrics)

## Task t1 — `super-gsd/tools/codex-pro/profile-resolver.cjs` + `super-gsd/registry/codex-profiles.yaml` + `super-gsd/tools/codex-pro/package.json` + `super-gsd/tools/codex-pro/README.md`

### `super-gsd/registry/codex-profiles.yaml`

Static YAML declaring all 10 profiles:

```yaml
profiles:
  codex.readonly.audit:
    model: gpt-5.5
    reasoning: xhigh
    sandbox: read-only
    approval: never
    requires_worktree: false
    requires_locked_plan: false
    hooks_required: false
    native_review_required: false
    allowed_write_roots: []
    max_changed_files: 0

  codex.plan:
    model: gpt-5.5
    reasoning: xhigh
    sandbox: read-only
    approval: never
    requires_worktree: false
    requires_locked_plan: false
    hooks_required: false
    native_review_required: false
    allowed_write_roots: [.planning/]
    max_changed_files: 1

  codex.goal:
    model: gpt-5.5
    reasoning: xhigh
    sandbox: workspace-write
    approval: never
    requires_worktree: true
    requires_locked_plan: true
    hooks_required: true
    native_review_required: true
    allowed_write_roots: []  # must be specified per dispatch
    max_changed_files: 12

  codex.execute.bounded:
    model: gpt-5.5
    reasoning: xhigh
    sandbox: workspace-write
    approval: auto
    requires_worktree: true
    requires_locked_plan: true
    hooks_required: true
    native_review_required: true
    allowed_write_roots: []  # per dispatch
    max_changed_files: 6

  codex.execute.patch:
    model: gpt-5.5
    reasoning: xhigh
    sandbox: read-only  # read-pack patch mode
    approval: never
    requires_worktree: false
    requires_locked_plan: true
    hooks_required: false
    native_review_required: false
    allowed_write_roots: []  # per --patch-fallback-files
    max_changed_files: 20

  codex.review.native:
    model: gpt-5.5
    reasoning: xhigh
    sandbox: read-only
    approval: never
    requires_worktree: false
    requires_locked_plan: false
    hooks_required: false
    native_review_required: false  # this IS the review
    allowed_write_roots: []
    max_changed_files: 0

  codex.review.swarm:
    model: gpt-5.5
    reasoning: high
    sandbox: read-only
    approval: never
    requires_worktree: false
    requires_locked_plan: false
    hooks_required: false
    native_review_required: false
    allowed_write_roots: []
    max_changed_files: 0

  codex.cockpit.brief:
    model: gpt-5.5
    reasoning: high
    sandbox: read-only
    approval: never
    requires_worktree: false
    requires_locked_plan: false
    hooks_required: false
    native_review_required: false
    allowed_write_roots: []
    max_changed_files: 0

  codex.app_lab:
    model: gpt-5.5
    reasoning: xhigh
    sandbox: workspace-write
    approval: auto
    requires_worktree: true
    requires_locked_plan: true
    hooks_required: true
    native_review_required: true
    allowed_write_roots: []
    max_changed_files: 25

  codex.cloud_lab:
    model: gpt-5.5
    reasoning: xhigh
    sandbox: workspace-write
    approval: auto
    requires_worktree: true
    requires_locked_plan: true
    hooks_required: true
    native_review_required: true
    allowed_write_roots: []
    max_changed_files: 25
```

### `super-gsd/tools/codex-pro/profile-resolver.cjs`

CLI:
```
node profile-resolver.cjs [--help] [--resolve <json-context>] [--list] [--self-test-plan] [--self-test-bounded] [--self-test-audit]
```

Behavior:
- Loads `super-gsd/registry/codex-profiles.yaml` (parse YAML via js-yaml from plan-schema/node_modules)
- `--list`: print profile names to stdout
- `--resolve <json>`: parse the context JSON, apply rule-based mapping to one of the 10 profiles, print the profile envelope as JSON to stdout

Resolution rules (in order; first match wins):
1. `phase_type === 'plan'` → `codex.plan`
2. `phase_type === 'audit'` OR `read_only === true` → `codex.readonly.audit`
3. `phase_type === 'review' && mode === 'native'` → `codex.review.native`
4. `phase_type === 'review' && mode === 'swarm'` → `codex.review.swarm`
5. `phase_type === 'execute' && risk === 'low' && allowed_files.length <= 6` → `codex.execute.bounded`
6. `phase_type === 'execute' && uses_patch_fallback === true` → `codex.execute.patch`
7. `phase_type === 'goal'` → `codex.goal`
8. `phase_type === 'cockpit'` → `codex.cockpit.brief`
9. `phase_type === 'lab' && environment === 'app'` → `codex.app_lab`
10. `phase_type === 'lab' && environment === 'cloud'` → `codex.cloud_lab`
11. Default: `codex.readonly.audit` (safest fallback)

Self-tests:
- `--self-test-plan`: resolve `{phase_type: 'plan'}`; expect codex.plan; exit 0
- `--self-test-bounded`: resolve `{phase_type: 'execute', risk: 'low', allowed_files: ['src/x.ts']}`; expect codex.execute.bounded with requires_worktree=true + native_review_required=true; exit 0
- `--self-test-audit`: resolve `{phase_type: 'audit'}`; expect codex.readonly.audit; exit 0

### `super-gsd/tools/codex-pro/package.json`

```json
{
  "name": "sgsd-codex-pro",
  "version": "1.0.0",
  "description": "DLB-09.1 Codex Pro Mode lanes — profile-resolver + stoplight + native-review-runner",
  "main": "profile-resolver.cjs",
  "type": "commonjs",
  "dependencies": {
    "js-yaml": "^4.1.0",
    "ajv": "^8.18.0",
    "ajv-formats": "^3.0.1",
    "ajv-errors": "^3.0.0"
  }
}
```

(Mesh-memory tools resolve via plan-schema/node_modules. codex-pro should follow the same pattern.)

### `super-gsd/tools/codex-pro/README.md`

Operator-facing docs. Brief. Cover:
- What Codex Pro Mode is (DLB-09.1)
- The 10 profiles + their use cases
- profile-resolver CLI
- stoplight CLI
- native-review-runner CLI
- The self-test
- Cross-ref to DLB-08 / SGSD-PRO master proposal

## Task t2 — `super-gsd/tools/codex-pro/stoplight.cjs` (depends on t1)

CLI:
```
node stoplight.cjs [--help] [--classify <json>] [--self-test-green] [--self-test-amber] [--self-test-red]
```

Behavior:
- Loads codex-profiles.yaml (for cross-check)
- `--classify <json>`: parse context, classify GREEN/AMBER/RED, print verdict + reasons to stdout, append one row to `.planning/metrics/pro-mode-stoplight.jsonl`

GREEN criteria (ALL required):
- `locked_plan === true`
- `allowed_files_count <= 12`
- `acceptance_command !== undefined && acceptance_command !== ''`
- `risk in ['low', 'medium']`
- `production_writes !== true`
- `secrets_required !== true`

AMBER criteria (GREEN fails BUT none of the RED criteria):
- Goal lane appropriate (long validation loop / broad bounded roots)
- Temp worktree required
- Human/board review before apply

RED criteria (ANY triggers):
- `locked_plan !== true`
- `acceptance_command === undefined`
- `risk === 'high' || ambiguity === 'high'`
- `production_writes === true` (any prod/SAP/Mongo/Qdrant/Elasticsearch mutation)
- `secrets_required === true`
- `destructive === true`

JSONL row shape: `{ ts, verdict, reasons[], context_hash }`.

Self-tests:
- `--self-test-green`: synthesize benign context; expect GREEN; exit 0
- `--self-test-amber`: synthesize bounded-but-broad context; expect AMBER; exit 0
- `--self-test-red`: synthesize production-mutation context; expect RED; exit 0

## Task t3 — `super-gsd/tools/codex-pro/native-review-runner.cjs` + `super-gsd/tools/codex-pro/run-self-test.cjs`

### `super-gsd/tools/codex-pro/native-review-runner.cjs`

CLI:
```
node native-review-runner.cjs [--help] [--phase NN] [--diff-path PATH] [--executor-receipt <cmb-key>] [--self-test]
```

Behavior:
- For real invocation: would shell out to `codex-exec.sh` (existing wrapper) with the codex.review.native profile, capture findings, convert each to a `review_finding` CMB via the same shape as P107's `review-finding-writer.cjs`, append to `.planning/mesh/memory/cmbs.jsonl`, also write `CODEX-NATIVE-REVIEW.md` to the phase dir.
- For `--self-test`: synthesize 2 fake findings, write 2 CMBs to ledger with lineage parent = a fixture execution_receipt key, exit 0. Verify each emitted CMB validates against cmb.schema.json before writing.

CMB shape per finding (must conform to schema):
```json
{
  "key": "cmb-<unique>",
  "type": "review_finding",
  "created_at": "<ISO>",
  "created_by": "codex-review-native",
  "role": "reviewer",
  "milestone_id": "v3.0",
  "phase_id": "<from arg>",
  "cat7": { "focus":"...", "issue":"...", "intent":"...", "motivation":"...", "commitment":"...", "perspective":"native-codex-reviewer", "mood":"..." },
  "body": { "severity":"CRIT|WARN|INFO", "claim":"...", "current_commit":"<SHA>", "file_path":"<path>", "line_start":N, "line_end":N, "quoted_excerpt":"...", "violated_invariant":"...", "confidence":0.0-1.0 },
  "lineage": { "parents":["<execution_receipt key>"], "ancestors":[] },
  "authority_level": "claim",
  "evidence_refs": [],
  "status": "emitted"
}
```

### `super-gsd/tools/codex-pro/run-self-test.cjs`

Codex Pro Mode self-test runner. ≥15 assertions.

Test cases:
1. profile-resolver --help exit 0
2. stoplight --help exit 0
3. native-review-runner --help exit 0
4. profile-resolver --self-test-plan exit 0
5. profile-resolver --self-test-bounded exit 0
6. profile-resolver --self-test-audit exit 0
7. profile-resolver --list outputs at least 10 profile names
8. codex-profiles.yaml is loadable + parses + contains exactly 10 profiles
9. Every profile has required fields (model, reasoning, sandbox, approval, requires_worktree, requires_locked_plan, hooks_required, native_review_required, allowed_write_roots, max_changed_files)
10. stoplight --self-test-green exit 0
11. stoplight --self-test-red exit 0
12. stoplight --self-test-amber exit 0
13. After stoplight tests, .planning/metrics/pro-mode-stoplight.jsonl exists with at least 3 rows
14. native-review-runner --self-test exit 0
15. After native-review-runner self-test, mesh-memory cmbs.jsonl has at least 2 review_finding CMBs with role=reviewer + created_by containing 'codex-review-native'

Print `[codex-pro self-test] N/N passed` on success; exit 1 on any fail.

## requireDependency must use plan-schema-first candidate order

```js
const candidates = [
  path.resolve(__dirname, '..', 'plan-schema', 'node_modules', name),
  path.resolve(__dirname, 'node_modules', name),
  name,
];
```

## All emitted CMBs must have FULL schema shape

Mirror the lessons from P107/P108/P109: every CMB has milestone_id, phase_id, cat7 (all 7 fields), lineage.parents + lineage.ancestors, authority_level, evidence_refs, status. Body fields per-type per schema.

## Verification

```bash
node super-gsd/tools/codex-pro/profile-resolver.cjs --help
node super-gsd/tools/codex-pro/stoplight.cjs --help
node super-gsd/tools/codex-pro/native-review-runner.cjs --help
node super-gsd/tools/codex-pro/run-self-test.cjs
```

The last must report ≥15/15 passed, exit 0.

## Out of scope

- PLAN-LOCKED.md formal lock contract (P111)
- `.codex/hooks.json` (P111)
- Context Authority capsule (P112)
- Replacing the existing codex-executor.sh / codex-exec.sh dispatchers (this phase ADDS profile-resolver + stoplight + native-review; orchestrator wire-in is later)
- Modifying P106-P109 frozen tools

## Report

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/registry/codex-profiles.yaml (created)
  super-gsd/tools/codex-pro/profile-resolver.cjs (created)
  super-gsd/tools/codex-pro/stoplight.cjs (created)
  super-gsd/tools/codex-pro/native-review-runner.cjs (created)
  super-gsd/tools/codex-pro/run-self-test.cjs (created)
  super-gsd/tools/codex-pro/package.json (created)
  super-gsd/tools/codex-pro/README.md (created)
VERIFICATION:
  - 10 profiles in registry
  - profile-resolver / stoplight / native-review-runner all have --help
  - Self-test reports ≥15/15 passed
DEVIATIONS: <none>
BLOCKERS: <none>
ONE_LINER: P110 DLB-09.1 shipped — Codex Pro Mode lanes + stoplight + native review wired into mesh memory layer.
REPORT_END
```

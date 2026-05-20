# SDD Implementer — P111-01 executor (PLAN-LOCKED + Codex hooks)

You are a fresh SDD implementer. No inherited context.

## What you are doing

3 tasks, 13 files total. DLB-09.2 implementation. Adds the formal PLAN-LOCKED.md contract + 5 Codex safety-rail hooks.

## Read

1. `.planning/milestones/v3.0/phases/111-plan-locked-codex-hooks/111-01-plan-locked-codex-hooks-PLAN.md` — 3-task contract
2. `.planning/milestones/v3.0/phases/111-plan-locked-codex-hooks/111-CONTEXT.md` — full design + 7 binding invariants
3. `super-gsd/templates/plan-schema-v2.json` — what plan-locked.schema extends
4. `super-gsd/tools/plan-schema/validate.cjs` — exemplar Node CLI shape
5. `super-gsd/registry/codex-profiles.yaml` — profiles that require_locked_plan + hooks_required
6. `super-gsd/tools/plan-schema/package.json` — exemplar deps shape

## Task t1 — PLAN-LOCKED schema + validator

### `super-gsd/schemas/plan-locked.schema.json`

Draft-07 JSON Schema. EXTENDS plan-schema-v2 (does NOT replace it). PLAN-LOCKED.md frontmatter must validate against BOTH plan-schema-v2 AND plan-locked.schema.json.

Required ADDITIONAL fields beyond v2-schema:
- `lock_status` — enum: `[locked]` (constant)
- `locked_at` — ISO-8601 string
- `locked_by` — string (operator or sgsd-auto)
- `allowed_files` — array of strings (file paths Codex may write to)
- `forbidden_files` — array of strings (paths Codex must NOT touch)
- `invariants` — array of strings (e.g., "no production writes", "ΔComplexity ≤ 0")
- `acceptance_commands` — array of strings (commands operator can run to verify)
- `rollback_plan` — string
- `risk_rating` — enum: `[low, medium, high]`
- `operator_checkpoints` — array of strings (checkpoint descriptions)

errorMessage blocks for the new required fields with code `PLAN-LOCKED-XX`:
- Missing lock_status → "PLAN-LOCKED must declare 'lock_status: locked' (PLAN-LOCKED-01)"
- Missing allowed_files → "PLAN-LOCKED must declare 'allowed_files' array (PLAN-LOCKED-02)"
- Missing acceptance_commands → "PLAN-LOCKED must declare 'acceptance_commands' array (PLAN-LOCKED-03)"
- Missing rollback_plan → "PLAN-LOCKED must declare 'rollback_plan' (PLAN-LOCKED-04)"
- Missing risk_rating → "PLAN-LOCKED must declare 'risk_rating' (PLAN-LOCKED-05)"

### `super-gsd/tools/plan-lock/validate-plan-locked.cjs`

CLI mirroring `super-gsd/tools/plan-schema/validate.cjs`:
```
node validate-plan-locked.cjs [--help] [--plan-file PATH] [--self-test-valid] [--self-test-incomplete]
```

Behavior:
- Loads BOTH `super-gsd/templates/plan-schema-v2.json` AND `super-gsd/schemas/plan-locked.schema.json`
- Validates the input file against BOTH (must pass both)
- Same D-08 error formatting + JSONL metrics + `--help`
- `--self-test-valid`: validate a synthesised fully-formed PLAN-LOCKED fixture; expect VALID; exit 0
- `--self-test-incomplete`: validate a PLAN missing lock metadata; expect REJECT with PLAN-LOCKED-XX error; exit 0

Requires the same `requireDependency()` pattern with plan-schema-first candidate order.

### `super-gsd/tools/plan-lock/package.json` + `README.md`

Minimal. Same shape as plan-schema's package.json. README briefly explains PLAN-LOCKED relationship to v2-schema.

## Task t2 — Codex hooks

### `.codex/hooks.json`

Codex hook config. Maps event → script:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      "super-gsd/tools/codex-hooks/block-secret-leak.cjs"
    ],
    "PreToolUse": [
      "super-gsd/tools/codex-hooks/block-forbidden-write.cjs",
      "super-gsd/tools/codex-hooks/enforce-allowed-files.cjs"
    ],
    "PostToolUse": [
      "super-gsd/tools/codex-hooks/log-tool-event.cjs"
    ],
    "Stop": [
      "super-gsd/tools/codex-hooks/validate-stop-contract.cjs"
    ]
  }
}
```

### Hook scripts (5 files under `super-gsd/tools/codex-hooks/`)

Each script reads context from stdin (Codex hook protocol JSON), evaluates a deterministic rule, exits 0 (allow) or non-zero (block). All scripts append a row to `.planning/metrics/codex-tool-events.jsonl` recording their decision.

**`block-forbidden-write.cjs`** — PreToolUse hook:
- Reads stdin: `{ tool, args }` (Codex hook payload)
- If tool is a write tool AND args.path matches any pattern in forbidden_files list (hardcoded baseline: `.git/`, `secrets/`, `*.env`, `node_modules/.cache/`) → exit 1
- Else: exit 0
- Self-test: `--self-test-blocked` mocks a write to `secrets/foo.env`; expect exit 1.

**`block-secret-leak.cjs`** — UserPromptSubmit hook:
- Reads stdin: `{ prompt }` (Codex hook payload)
- Regex-checks for secret patterns: `API_KEY\s*=\s*[A-Za-z0-9_-]{8,}`, `sk_[A-Za-z0-9_]{20,}`, `BEGIN PRIVATE KEY`, `password\s*=\s*[^\s]+`, `production\s+credential`
- If any match → exit 1
- Else: exit 0
- Self-test: `--self-test-secret` mocks prompt `"deploy with API_KEY=sk_test123abc456def"`; expect exit 1.

**`log-tool-event.cjs`** — PostToolUse hook:
- Reads stdin: `{ tool, args, result, duration_ms }`
- Append one row to `.planning/metrics/codex-tool-events.jsonl`: `{ ts, tool, args_summary, result_status, duration_ms }`
- Always exit 0 (this hook never blocks; pure observability)
- Self-test: `--self-test` synthesises a tool event; assert one row was appended; exit 0.

**`validate-stop-contract.cjs`** — Stop hook:
- Reads stdin: `{ phase, plan, report_path, checkpoint_updated, acceptance_commands_reported }`
- If `report_path` doesn't exist on disk → exit 1
- If `checkpoint_updated !== true` → exit 1
- If `acceptance_commands_reported !== true` → exit 1
- Else: exit 0
- Self-test: `--self-test-missing-report` mocks a stop event with non-existent report_path; expect exit 1.

**`enforce-allowed-files.cjs`** — PreToolUse hook:
- Reads stdin: `{ tool, args }`
- If tool is a write tool: reads the active PLAN-LOCKED.md from path passed via env `SGSD_ACTIVE_PLAN_LOCKED` (or finds the current phase's PLAN-LOCKED.md by reading STATE.md)
- Checks args.path against allowed_files; if not in list → exit 1
- If no PLAN-LOCKED.md is loadable → exit 1 (fail-CLOSED on ambiguity per CONTEXT invariant)
- Self-test: `--self-test-no-plan-lock` mocks a write with no PLAN-LOCKED available; expect exit 1.

All scripts: same requireDependency pattern as other v3.0 tools; minimal deps (just Node built-ins for hook scripts; maybe ajv for plan-lock validator).

## Task t3 — `super-gsd/tools/codex-hooks/run-self-test.cjs` + `super-gsd/tools/codex-hooks/package.json` + `super-gsd/tools/codex-hooks/README.md`

### `run-self-test.cjs`

≥15 assertions:

1. `.codex/hooks.json` exists + parses as JSON
2. .codex/hooks.json declares hooks for UserPromptSubmit + PreToolUse + PostToolUse + Stop
3. block-forbidden-write.cjs exists + has --help
4. block-secret-leak.cjs exists + has --help
5. log-tool-event.cjs exists + has --help
6. validate-stop-contract.cjs exists + has --help
7. enforce-allowed-files.cjs exists + has --help
8. block-forbidden-write --self-test-blocked exits non-zero (1)
9. block-secret-leak --self-test-secret exits non-zero (1)
10. log-tool-event --self-test exits 0 + appends row to codex-tool-events.jsonl
11. validate-stop-contract --self-test-missing-report exits non-zero (1)
12. enforce-allowed-files --self-test-no-plan-lock exits non-zero (1)
13. plan-lock validate-plan-locked.cjs --self-test-valid exits 0
14. plan-lock validate-plan-locked.cjs --self-test-incomplete exits non-zero (1)
15. After hook self-tests, `.planning/metrics/codex-tool-events.jsonl` has at least 1 row

Print `[codex-hooks self-test] N/N passed`; exit 1 on any fail.

### `package.json` + `README.md`

Minimal. README explains:
- Hook event protocol (stdin JSON shape per Codex hook docs)
- Each hook's purpose + block conditions
- How to test individual hooks
- How to extend with new hooks (add to .codex/hooks.json)

## All hook scripts must:
- Be invocable standalone (`node script.cjs`)
- Have `--help`
- Have `--self-test-<scenario>` mode for unit testing
- Append to `.planning/metrics/codex-tool-events.jsonl` (use absolute path via `path.resolve(__dirname, ...)`)
- Fail-CLOSED on ambiguity

## Verification

```bash
node super-gsd/tools/plan-lock/validate-plan-locked.cjs --help
node super-gsd/tools/codex-hooks/run-self-test.cjs
```

The second must report ≥15/15 passed, exit 0.

## Out of scope

- Context Authority capsule (P112)
- Codex CLI version pinning
- Modifying P106-P110 frozen tools
- Active orchestrator integration (live hook wiring is post-v3.0)

## Report

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/schemas/plan-locked.schema.json (created)
  super-gsd/tools/plan-lock/* × 3 (created)
  .codex/hooks.json (created)
  super-gsd/tools/codex-hooks/* × 8 (created)
VERIFICATION:
  - validate-plan-locked --help works
  - All 5 hooks have --help + --self-test-*
  - Self-test reports ≥15/15 passed
DEVIATIONS: <none>
BLOCKERS: <none>
ONE_LINER: P111 DLB-09.2 shipped — PLAN-LOCKED contract + 5 Codex hooks; deterministic fail-closed safety rails.
REPORT_END
```

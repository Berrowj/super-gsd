# P154-T1 — MCP emission contract: declared schemas + shaper + red-then-green test

You are the implementer for ONE task. Fresh context. You CANNOT spawn `claude` (EPERM);
node and the staged triage CLI work. Do NOT commit.

## Read first

- Task P154-T1 in `.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-01-PLAN-LOCKED.md`
  — your VERBATIM contract, including its falsifier and stop_rule. Follow it over this
  prompt wherever they differ.
- `super-gsd/scripts/sgsd-triage-runtime.cjs` — the emitter. Defects reproduced
  2026-08-18: the vtp-plan stage emits `context.recent_turns` as string[] where
  `vtp_route_and_retrieve` requires objects with `text`; the reflection-null fallback
  emits `raw_query`/`context`/`fallback_reason` to `vtp_search_substrate`, which
  accepts only `query` + typed filters (`limit`, `source_types`, `entity_types`,
  `project_ids`, `speaker_ids`, `topics`, `meeting_ids`).
- Authoritative shapes to declare (mirroring the live tool descriptors):
  vtp_route_and_retrieve requires `raw_query` (minLength 3) and `context` (object with
  optional session_id/repo/current_task/active_file/recent_commands[]/recent_errors[]/
  blockers[]/explicit_constraints[]/recent_turns[] where each turn is {id?, role? in
  user|assistant|system, text REQUIRED}). vtp_search_substrate requires `query`
  (minLength 3) with the optional typed filters above (limit integer 1..25).
- Ajv is available at `super-gsd/tools/plan-schema/node_modules` (installed).

## Order of work — the red run is contractual

1. Write `super-gsd/schemas/vtp-mcp-input-schemas.v1.json` (version id, both fully
   qualified tool names, provenance note "mirrors live vtp-kb descriptors reproduced
   2026-08-18", full constraints — not a bad-keys-only reduction).
2. Write `super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs` loading THAT file
   (no inline schema copies), compiling with the repo Ajv, running the REAL staged CLI
   (`sgsd-triage-runtime.cjs --stage vtp-plan` / `vtp-consume`) in an isolated tmp SGSD
   fixture, validating the emitted args.
3. RUN it against the UNCHANGED runtime. It must exit non-zero naming both defects.
   Paste that red command + output in your report. A test green before the edit is a
   contract violation.
4. Only then add the per-tool shaper at the final emission boundary in
   sgsd-triage-runtime.cjs (strings->{role:"user",text}, strip unsupported keys for
   substrate) and re-run to green. No routing/predicate changes.

## Verification before reporting

    node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case emitted-args

Report: FILES_CHANGED / VERIFICATION (include the preserved RED run) / DEVIATIONS /
BLOCKERS / ONE_LINER, max 200 words.

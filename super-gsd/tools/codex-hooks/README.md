# Codex Hooks

These hooks implement the P111 PLAN-LOCKED safety rails. Codex sends each hook a JSON payload on stdin and the script exits `0` to allow or non-zero to block.

## Events

- `UserPromptSubmit`: `{ "prompt": "..." }`
- `PreToolUse`: `{ "tool": "...", "args": { "path": "..." } }`
- `PostToolUse`: `{ "tool": "...", "args": {}, "result": {}, "duration_ms": 123 }`
- `Stop`: `{ "phase": "...", "plan": "...", "report_path": "...", "checkpoint_updated": true, "acceptance_commands_reported": true }`

## Hooks

- `block-secret-leak.cjs`: blocks prompts containing API keys, private keys, passwords, or production credential language.
- `block-forbidden-write.cjs`: blocks write tools targeting `.git/`, `secrets/`, `*.env`, or `node_modules/.cache/`.
- `enforce-allowed-files.cjs`: blocks write tools when no PLAN-LOCKED file is loadable, or when the target path is outside `allowed_files`.
- `log-tool-event.cjs`: appends PostToolUse observability rows to `.planning/metrics/codex-tool-events.jsonl` and never blocks.
- `validate-stop-contract.cjs`: blocks Stop when the report is missing, the checkpoint was not updated, or acceptance commands were not reported.

## Testing

```bash
node super-gsd/tools/codex-hooks/block-forbidden-write.cjs --self-test-blocked
node super-gsd/tools/codex-hooks/block-secret-leak.cjs --self-test-secret
node super-gsd/tools/codex-hooks/log-tool-event.cjs --self-test
node super-gsd/tools/codex-hooks/validate-stop-contract.cjs --self-test-missing-report
node super-gsd/tools/codex-hooks/enforce-allowed-files.cjs --self-test-no-plan-lock
node super-gsd/tools/codex-hooks/run-self-test.cjs
```

To add a hook, create a standalone `*.cjs` script with `--help`, a deterministic self-test mode, JSON stdin handling, and metrics logging. Then add it to `.codex/hooks.json` under the appropriate Codex event.

The PLAN-LOCKED incomplete-plan self-test exits `0` when the invalid fixture is rejected with a `PLAN-LOCKED-XX` diagnostic.

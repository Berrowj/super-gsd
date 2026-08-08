# 148-atcfix Salvage Record

date: 2026-08-08
salvaged_by: orchestrator (resume session after reboot pause)

## What happened

The `148-atcfix` Codex executor dispatch (staged MCP-transport protocol, per
`148-ATCFIX-PROMPT.md`) was killed by an operator reboot before it could write
`148-ATCFIX-REPORT.md`. The implementation itself HAD landed:

- `super-gsd/scripts/sgsd-triage-runtime.cjs`: +425 lines, staged protocol
  (`--stage vtp-plan` / `--stage vtp-consume`, `invoke_mcp` action emission,
  response-file parse guards)
- `super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs`: +195 lines,
  5 new scenarios (staged-vtp-healthy, staged-vtp-null-reflection-fallback,
  staged-vtp-garbage-response, staged-vtp-oversized-response,
  vtp-stage-no-codex-gate)

## Orchestrator verification (host-side)

```
node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario all
→ [PASS] all (33 scenarios)   # 28 prior + 5 new staged-protocol
```

## Environment note (not a code defect)

An initial run from the resume session's PowerShell failed one wrapper scenario
with `to_posix: command not found`. Root cause: `bash` resolved to
`C:\Windows\System32\bash.exe` (WSL launcher), which mangles the multiline
`-lc` fixture command. Under Git Bash the suite is fully green. The wrapper
machinery (`bashCommandForCodexExec`) was untouched by the atcfix diff.

## Status

Dispatch treated as COMPLETE via salvage. Spec-compliance review and phase-ATC
re-review proceed on the working-tree diff per the resume checkpoint.

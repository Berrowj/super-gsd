---
phase: 75
artifact: research
created: 2026-04-29
authored_by: orchestrator (Opus); code by gsd-executor (Sonnet) agentId aa506e3ecfc5ba5c7
---

# Phase 75 -- Research

## Source pattern

- Phase 74 writer (orchestrator-live-writer.cjs)
- Phase 67/69/72 Lock-13 + READ-ONLY + ASCII-only patterns
- Phase 47 route-decisions JSONL ledger emit pattern

## Key decisions

### D1 -- --emit CLI as universal entry point

Orchestrator (Claude Code) is an LLM, not Node code. The cleanest wire-in
is a CLI flag any Bash/PowerShell call can use. SKILL.md instructs the
orchestrator to call `node ... --emit '<json>'` at specific loop points;
no need to wire into Node-level orchestrator code.

### D2 -- Reader as separate library (READ-ONLY enforced)

Phase 76 cockpit-state adapter consumes events. Phase 75 ships the
reader so Phase 76 doesn't have to reimplement parsing. READ-ONLY
invariant prevents the adapter from accidentally mutating the event
stream.

### D3 -- Optional cockpit-shell wire-in skipped

Executor evaluated sgsd-cockpit-shell.cjs and found no natural emit
points (it's a read-only snapshot bridge). SKILL.md documentation +
--emit CLI is sufficient for Phase 75 ship per acceptance criteria.

### D4 -- selfTestMarker pattern for READ-ONLY scan

Reader's selfTest body necessarily contains banned-token names in its
test data. Executor used a `selfTestMarker` split to exclude the
selfTest body from the READ-ONLY scan — only the public-API region
is scanned for `fs.append/write/unlink/mkdir/rm/rmdir`. Surgical and
correct.

## Live test data

```
writer self-test  10/10 PASS
reader self-test  12/12 PASS (all 16 EVENT_TYPES round-trip + corrupt-line graceful)
--emit success    ok:true exit 0
--emit bad type   ok:false exit 1 unknown_event_type
--emit bad JSON   stderr structured error exit 1
```

First canonical .planning/ORCHESTRATOR-LIVE.jsonl row landed (run_started
event for Phase 75 acceptance test).

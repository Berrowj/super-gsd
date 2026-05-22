# P5 Codex Monitor — Specification

**Milestone:** v1.3
**Filed:** retroactive (planted during Phase 15 close session)
**Commit:** c8b2d25
**Status:** complete

## Problem Statement

`codex-exec.sh` is a long-running subprocess wrapper for the Codex CLI. During autonomous execution sessions, the operator has no visibility into whether Codex is actively running, timed out, rejected auth, or completed. The script could be silently hung for minutes with no observable signal in Mission Control.

## Scope

Live-state monitoring for Codex CLI invocations — four files shipping as a cohesive feature. No behavioural change to the codex invocation itself; the wrapper retains its existing exit codes (0,1,3,4,5,6) on the same conditions.

## Rationale

The visibility gap was identified at Phase 15 close: `sgsd-codex-status.ps1` was authored in the same session as `sgsd-codex-monitor.ps1` to provide the shared state-reader helper, but neither had a planning artifact. The operator committed the feature to preserve cohesion; this P5 retroactive artifact documents it.

## Deliverables

| File | Role |
|------|------|
| `super-gsd/scripts/codex-exec.sh` | Emit `codex-live.json` at 6 lifecycle states via `write_live_state()` helper |
| `super-gsd/scripts/merge-settings.js` | `normalizeCommand()` helper for hook dedup under quote/path/whitespace variance |
| `super-gsd/scripts/lib/sgsd-codex-status.ps1` | Shared `Get-SgsdCodexStatus` reader consumed by monitor + mission-control |
| `super-gsd/scripts/sgsd-codex-monitor.ps1` | PowerShell heartbeat dashboard (default 30s poll) |

## Constraints

- Pure additive: no existing API changed
- Syntax validation required: `bash -n codex-exec.sh`, `node --check merge-settings.js`, PSParser tokenize both `.ps1` files
- Claimed authorship: operator (the operator). Not edited by Claude in the delivery session — found in loose state, validated, committed.

## Out of Scope

- Codex invocation behaviour changes (exit codes, retry logic)
- Mission Control tile wiring (deferred to Phase 19 MC-01)
- sgsd-live-feed integration (deferred to Phase 19 MC-04)

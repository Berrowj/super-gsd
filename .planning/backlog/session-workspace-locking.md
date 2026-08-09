---
created: 2026-08-09
source: P150 T150-05 ceremony collision (live evidence)
priority: high
target: post-v3.5 cycle, alongside dispatch-progress-contract-standard
---

# Session workspace locking — no two orchestrators write one worktree

## Incident (evidence)

During the T150-05 publication ceremony, the canonical worktree re-check caught
`~/GSDedits` "becoming dirty" mid-ceremony. Process inspection showed a second
live SGSD session with a full-auto Codex executor (started 18:59) writing
sgsd-triage SKILL.md + vtp-bridge files into the same canonical worktree the
ceremony was about to fast-forward. The ceremony's guard worked; the class of
collision should be prevented structurally, not just caught.

## What ships

1. **Workspace lockfile**: on session boot (sgsd-boot / orchestrate entry),
   write `.planning/runtime/session-lock.json` {session_id, pid, started, mode}
   with stale-detection (pid liveness). Second session targeting the same
   worktree gets a loud warning + read-only suggestion, and executor dispatches
   into a foreign-locked workspace are refused.
2. **Ceremony integration**: T150-style ceremonies check the lock registry of
   the TARGET worktree before mutating it and name the holder in the error.
3. **Cockpit surface**: active locks visible in the mission tile.

## Rationale

Codex CLI sessions already assume exclusive workspace write access (SKILL.md
hard rule); this extends the same invariant to whole orchestrator sessions
across separate chats/machines sharing a canonical checkout.

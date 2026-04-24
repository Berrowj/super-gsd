# Phase 22: Security Hardening — Context

**Gathered:** 2026-04-24 (inline — 2-REQ scope with verbatim AC, no discuss-phase needed)
**Status:** Ready for research
**Milestone:** v1.5 — VTP Knowledge Primacy + Post-v1.4 Hardening

<domain>
## Phase Boundary

Close the 2 Codex-acknowledged security surfaces from v1.4 Phase 20 Round 5. Both are concurrency/filesystem primitives on the handoff path — symlink canonicalization + concurrent-write guard. Zero production impact today (handoff.enabled=false default), but enabling the feature without these hardenings leaves exploitable surface.

**2 items in scope (REQUIREMENTS.md SEC-01..02):**
- SEC-01: Symlink canonicalize on handoff paths ($LOG_PATH / $CHECKPOINT / $ABORT_FILE) via readlink -f or Node fs.realpathSync before any test/grep/read in sgsd-stop-handoff.sh
- SEC-02: fs flock (or equivalent) concurrent-write guard on handoff-log.jsonl; graceful fallback when locking unavailable

**Non-goals:**
- Rewrite handoff architecture (Phase 20 is authoritative)
- Cross-platform symlink semantics beyond Linux/Mac/WSL
- Formal security audit — defensive primitives only
</domain>

<decisions>
## Decisions

### D-01: 2 plans, one per REQ
- 22-01 symlink canonicalize (SEC-01) — bash-only shell edits to sgsd-stop-handoff.sh
- 22-02 fs flock (SEC-02) — bash flock + Node fallback + audit-row marker
Plans independent — no shared files beyond sgsd-stop-handoff.sh which can coordinate via merge.

### D-02: Symlink resolution approach
Use `readlink -f` on Linux/Mac/WSL (canonical absolute path following all symlinks). If readlink unavailable (rare), fall back to `realpath`. If neither, log warning + audit-row `canonicalize_fallback: true` and continue with raw path (defense-in-depth but no crash).

### D-03: Lock strategy
Use `flock -x -w 5` (exclusive, 5-second wait) around append-then-read sequences on handoff-log.jsonl. If `flock` command absent (WSL edge cases), fall back to Node child process with `util.promisify(fs.open)` + O_EXLOCK flag. If both unavailable, log warning + audit-row `lock_fallback: true` and continue unlocked (preserves auto-advance, degrades gracefully).

### D-04: Audit-row additions
Both guards add optional fields to handoff-log.jsonl rows:
- `canonical_path_resolved: true|false` (SEC-01)
- `lock_fallback: true|false` (SEC-02, only present when lock couldn't acquire)

No schema break — existing consumers ignore unknown fields.

### D-05: Test approach
Dry-run path tests each guard's graceful-fallback behavior. No live spawn tests (handoff.enabled=false).

### D-06: Backward-compat
Pre-Phase-22 handoffs have no canonicalize/flock semantics; running new sgsd-stop-handoff.sh against existing handoff-log.jsonl rows is read-compatible (rows without new fields parse fine).
</decisions>

<canonical_refs>
- `.planning/REQUIREMENTS.md` §SEC-01..02
- `super-gsd/scripts/sgsd-stop-handoff.sh` — target file (both REQs)
- `.planning/milestones/v1.4/phases/20-autonomous-handoff/20-ATC-REVIEW.md` — Round 5 acknowledged these as Phase 21 (now 22) scope
- `super-gsd/hooks/sgsd-session-start.js` — also reads handoff-log (needs matching canonicalize logic if touched)
</canonical_refs>

<code_context>
- sgsd-stop-handoff.sh already has defensive read-failure paths (MALFORMED / READ_FAILED sentinels). SEC-01 + SEC-02 extend this pattern with canonicalize + lock surfaces.
- Pattern: all file-access guards follow bash idiom `read → detect failure mode → log sentinel → refuse OR continue`.
- Node availability confirmed on all host platforms; Node fallback for flock if bash primitive missing.
</code_context>

<deferred>
- Cross-machine handoff (not this milestone)
- Formal security pentest
- Symlink attack surface beyond handoff paths (edge-guard log, commit-reviews.jsonl are adjacent but out of scope)
</deferred>

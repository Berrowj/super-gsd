# Phase 53 Deferred Items

Tracks out-of-scope discoveries from T3 (and subsequent T4-T7 if they
add). Each entry is logged but NOT auto-fixed; Phase 53's scope is the
failure-injection harness only.

## D1 - super-gsd/tools/token-attribution/collect.cjs has uncommitted local diff

- **Discovered during:** T3 (53-01-T3) verification gate run.
- **Symptom:** `git diff --quiet -- super-gsd/tools/token-attribution`
  returns non-zero exit. The diff adds an additional regex branch in
  `readStateScope` to recognize `current_milestone:` (mass-renamed
  STATE.md key) in addition to `milestone:`, plus a self-test row.
  CRLF/LF warning also raised by git.
- **Root cause:** Pre-existing local working-tree drift; commit history
  for collect.cjs ends at `40c28e7 fix(token-attribution): record live
  subagent token spend`. The diff was not introduced by T1, T2, or T3.
- **Why deferred:** Lock 4 (Phase 41-52 trees byte-untouched) governs
  whether T3 introduced the drift; it did not. Phase 53 SCOPE BOUNDARY
  rule explicitly defers pre-existing failures in unrelated files.
- **Owner:** Token-attribution maintainer (Phase 41 owners) - decide
  whether to commit, revert, or carry forward.
- **Action item for Phase 57 readiness gate:** confirm
  `git diff --quiet -- super-gsd/tools/token-attribution` exits 0 before
  v2.0 milestone close; if still drifted, treat as a Phase 41 hygiene
  task rather than a Phase 53 blocker.

ASCII-only.

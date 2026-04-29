# Phase 57 Deferred Items

## Out-of-scope discoveries (not introduced by Phase 57)

### D1 - Pre-existing uncommitted edit in token-attribution/collect.cjs (Phase 41)

**File:** `super-gsd/tools/token-attribution/collect.cjs`
**Diff size:** +17 / -1 lines (uncommitted, predates Phase 57 dispatch)
**Nature:** `readStateScope()` regex extended to prefer `current_milestone:` field
over the legacy `milestone:` field, plus an additional self-test assertion verifying
the precedence.
**Why deferred:** This change was already on disk at Phase 57 dispatch start (was
not authored by Phase 57). Per scope-boundary rules: only auto-fix issues directly
caused by current task changes. Rule 4 (architectural) does not apply since this
is a benign regex precedence fix in a Phase 41 file.
**Recommendation:** A future v2.1 polish pass can either commit the change with a
proper `fix(token-attribution)` message OR `git checkout` it back if not desired.
Not a Phase 57 blocker; not a v2.0 milestone-close blocker; the live token-attribution
collect path runs through this file unchanged at runtime regardless of the diff state.

## In-scope deferred items (Phase 57)

None. All 8 must-haves green; 0 CRITICAL / 0 HIGH / 0 MEDIUM / 0 LOW.

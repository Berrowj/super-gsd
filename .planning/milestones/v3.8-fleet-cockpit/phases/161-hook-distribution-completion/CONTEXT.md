---
phase: "161"
slug: hook-distribution-completion
milestone: v3.8-fleet-cockpit
status: ACTIVE
depends_on: []
source: handover section 13 + Clarity reports/sgsd/2026-08-13-hook-distribution-defects.md
opened: 2026-08-20
---

# P161 Context — Hook Distribution Completion

## Goal

sgsd-update currently FAILS exit 5 at project integration on devcp because the
P160 registration guard (correctly) refuses to register hooks that were never
distributed. Two 2026-08-13 defects are still live, verified on devcp 2026-08-20:

- D1: install.sh's hook copy glob EXCLUDES `.cjs` — ~/.claude/hooks holds 23
  files, zero .cjs; sgsd-intent-classifier.cjs and sgsd-commit-gate.cjs absent.
- D2: settings-overlay.json registers only 9 of 14 shipped hooks. Unregistered:
  sgsd-commit-gate.cjs, sgsd-intent-classifier.cjs, sgsd-quality-gate.js,
  sgsd-session-start.js, sgsd-statusline.js.

Consequence stated plainly in the report: the two surfaces that inspect work as
it is produced (quality gate, commit gate) have NEVER run on that project.

## Scope

### T1 — install.sh hook glob includes every shipped hook type
.cjs (and any other shipped extension) copied by the global and repo-local copy
loops. Fixture: a deploy into isolated HOME must land ALL 16 hooks; the P160
guard suite must stay green (its smoke now exercises the newly copied hooks).

### T2 — settings-overlay registration completeness + tripwire
Register the five missing hooks with correct events/budgets. Add a completeness
check to the P160 guard test: every hook shipped in super-gsd/hooks (by
manifest, not glob-inference) must be either registered in an overlay or
explicitly listed as intentionally-unregistered with a reason — silence fails.

### T3 — end-to-end sgsd-update proof
The verification of record is the real path: an isolated fixture with Clarity's
shape (stale sgsd_managed entries pointing at a dir that only ever held
systemd/) runs sgsd-update; it must now complete exit 0 with global coverage
live, and .super-gsd-version advances. The 2026-08-13 report's own verification
snippet is the SAC template. Removal of dead per-project entries stays
OPERATOR-SIDE and ordered AFTER global coverage is proven (report's explicit
ordering) — document, do not automate the removal.

## Boundaries

- Do not weaken the P160 guard to make update pass; distribution must catch up
  to the guard, never the reverse.
- Codex authors all source; red-first; edits-first division (orchestrator runs
  spawn-bound suites unsandboxed); every task revertable.

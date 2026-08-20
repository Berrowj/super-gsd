---
phase: "160"
slug: installer-registration-guard
milestone: v3.7-upstream-hardening
status: PENDING
depends_on: []
---

# P160 Context — Installer Registration Guard (seed)

## Defect reports consolidated (2026-08-20, two instances)

D1 (felt on every prompt): install.sh registers absolute hook paths in
.claude/settings.json WITHOUT checking the files exist. A project vendoring an
older super-gsd (9 hooks) got 16-hook registrations; three of four registered
files were missing, including both UserPromptSubmit hooks, so every prompt threw
MODULE_NOT_FOUND with requireStack: [] (entry file absent). install.sh has zero
`test -f` checks today (grep-verified). Seam instance 13:
registration-without-existence — the P155 activation tests run from the canonical
repo where all hooks exist, so the vendored-stale case has no fixture.

D2: fresh clones ship stale bundled overlay text (ByteRover-era memory routing,
haiku/sonnet dispatch lines) that the provider lock marks STALE.

D3: hook entry files deploy without their sibling library dependencies resolving
from the installed location (tools/* dependency handling; the earlier devcp
loader:1479 class).

## Fix directions (planner refines)

- T1: existence + resolvability guard at BOTH merge sites (global line ~379,
  repo-local line ~472): every hook command's script path must exist AND
  `node --check` pass before registration; missing => fail loud naming the path,
  never write a dead registration. Fixture: vendored 9-hook super-gsd copy
  (the exact Clarity shape) must refuse, not register.
- T2: bundled overlay refresh + a drift tripwire (overlay text carrying
  known-stale markers fails the installer self-test).
- T3: deployed-hook dependency resolution check (spawn each deployed hook with
  a benign payload at install time; non-zero => loud failure).

## Boundaries

Codex authors all source; red-first with the vendored-stale fixture; no changes
to hook semantics themselves. The Clarity instance's local repair (repointing
registrations at the canonical source dir) is a valid mitigation but diverges
from the repo-local design intent (P153); T1's guard must make both layouts safe.

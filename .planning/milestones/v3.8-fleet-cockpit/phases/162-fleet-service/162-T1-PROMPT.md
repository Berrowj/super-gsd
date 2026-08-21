# P162-T1 — fleet discovery + cache + roll-up (edits-first)

You are the implementer for ONE task. Fresh context. The sandbox denies nested
spawns — do NOT run suites, do NOT stop on spawnSync EPERM; write the edits,
verify with node --check and in-process loads, report. Do NOT commit.

Task P162-T1 in `162-01-PLAN-LOCKED.md` (same dir, revision 2) is your VERBATIM
contract. Design source: `.planning/milestones/v3.8-fleet-cockpit/HANDOVER.md`
sections 5-7.

Hard constraints (violations, not suggestions): requires limited to node:
builtins (http/fs/path/os/child_process for git discovery only); CJS .cjs;
ASCII source; READ-ONLY (fleet.cjs writes nothing outside an explicit cache
concept held in memory); adapter consumed via
require('../cockpit-state/adapter.cjs') and NEVER modified.

Essentials:
- Discovery: `git -C <root> worktree list --porcelain` (git authority; no
  globbing); skip lanes without .planning/ and REPORT them.
- Cache: build on a timer (default 20s, --interval), NEVER on request; bounded
  concurrency 4; roll-up fields first, full snapshots fill in; expose
  cache_age_seconds; one failing lane becomes a status:error row and never
  poisons the rest.
- Fixtures: captured lane snapshots (attention/running/stale/idle shapes) under
  fixtures/lanes/ per the plan; run-self-test.cjs mirrors the adapter's style
  and uses a FIXTURE git repo (no live Clarity on this box).

Report: FILES_CHANGED / VERIFICATION (static, name checks) / DEVIATIONS /
BLOCKERS / ONE_LINER, max 180 words.

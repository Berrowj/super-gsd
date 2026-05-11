---
plan_id: 98-03
phase: 98
title: Keep auto mode moving when Windows Codex cannot read files
type: runtime-routing
expected_ATC_tier: full
files_touched:
  - CLAUDE.md
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - super-gsd/workflows/orchestrate-loop.md
  - super-gsd/scripts/codex-executor.sh
  - super-gsd/scripts/codex-patch-executor.sh
  - super-gsd/docs/CODEX-EXECUTOR.md
  - super-gsd/tests/cockpit-regression/check.cjs
  - super-gsd/tests/codex-patch-executor-fake.sh
---

# Plan 98-03

| # | Task | Acceptance |
|--:|---|---|
| 1 | Add Codex read-pack patch fallback | Windows file-read failures route to Codex-authored patch mode before any operator-only checkpoint |
| 2 | Keep Claude out of executor authorship | Claude may build the read-pack and apply Codex's patch, but Codex authors the code delta |
| 3 | Update auto-mode instructions | `operator-only infrastructure decision` is invalid while patch mode, SSH/Linux Codex, or another mechanical fallback exists |
| 4 | Add regression coverage | Fake Codex test proves patch mode applies a Codex-authored diff offline |
| 5 | Verify syntax/static checks | Bash syntax, fake patch executor, cockpit regression, and cached diff check pass |

## Stop Rule

Do not let `/sgsd-orchestrate auto` stop merely because Windows Codex cannot
read files. Treat `CreateProcessAsUserW=216` and equivalent host file-read
errors as a routing problem. Try Codex patch mode first.

---
phase: 17
plan: "17-03"
subsystem: milestone-ceremony
tags: [clean-06, clean-07, v1.2-close, codex-timeout, git-tag, roadmap-collapse]
depends_on: ["17-01"]
provides: ["v1.2-git-tag", "codex-timeout-tiers", "sgsd-muda-audit-analysis-tier"]
affects: [".planning/MILESTONES.md", ".planning/ROADMAP.md", "super-gsd/scripts/codex-exec.sh", "super-gsd/skills/sgsd-orchestrate/SKILL.md", "super-gsd/scripts/sgsd-muda-audit.sh", ".planning/config.json"]
tech_stack:
  added: []
  patterns: ["D-03 precedence chain (custom:N > --timeout-tier > step-name map > config fallback)", "Node read+mutate+write for config.json", "git annotated tag with --allow-empty audit commit"]
key_files:
  created:
    - .planning/milestones/v1.2-ROADMAP.md
  modified:
    - .planning/MILESTONES.md
    - .planning/ROADMAP.md
    - super-gsd/scripts/codex-exec.sh
    - .planning/config.json
    - super-gsd/skills/sgsd-orchestrate/SKILL.md
    - super-gsd/scripts/sgsd-muda-audit.sh
decisions:
  - "SKILL.md shellDispatch call sites use timeoutTier property (maps to --timeout-tier flag) rather than inline string concatenation — keeps pseudocode object-literal style consistent"
  - "sgsd-muda-audit.sh retains --timeout 60 alongside --timeout-tier analysis; tier overrides per D-03 precedence, legacy flag is harmless"
  - "v1.2 Status Note section removed from MILESTONES.md (superseded by the Shipped entry written in T1)"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-24"
  tasks_completed: 6
  files_changed: 7
---

# Phase 17 Plan 03: Milestone Ceremony Summary

v1.2 retroactive close (MILESTONES.md Shipped + archive + git tag at 0191168) and codex_timeout workload tiers wired end-to-end across codex-exec.sh, config.json, SKILL.md (3 sites), and sgsd-muda-audit.sh.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| T1 | CLEAN-06: MILESTONES.md Active→Shipped, v1.2-ROADMAP.md archive created, ROADMAP.md Phases 9-13 collapsed into `<details>` | a07c4e0 |
| T2 | CLEAN-06: Annotated git tag v1.2 at commit 0191168, boundary verified | 1b9efcb |
| T3 | CLEAN-07: --timeout-tier flag + step-name resolver added to codex-exec.sh (D-03 precedence chain) | 8f3ffc2 |
| T4 | CLEAN-07: codex_timeout_tiers block added to config.json review_providers | 2481879 |
| T5 | CLEAN-07: timeoutTier: 'review' added to all 3 shellDispatch call sites in SKILL.md | 22cfb5e |
| T6 | CLEAN-07: --timeout-tier analysis added to sgsd-muda-audit.sh qualitative-probe call site | a6e28be |

## Verification Results

| Task | Command | Result |
|------|---------|--------|
| T1 | `test -f v1.2-ROADMAP.md && grep -q 'Shipped' MILESTONES.md && grep -q '<details>' ROADMAP.md` | PASS |
| T2 | `git tag -l v1.2 \| grep -q v1.2 && git rev-list -n1 v1.2 \| grep -q $(git rev-parse 0191168)` | PASS |
| T3 | `bash -n codex-exec.sh && grep -q 'timeout.tier' codex-exec.sh` | PASS |
| T4 | `node -e "const c=require('./config.json'); const t=c.review_providers.codex_timeout_tiers; process.exit((t&&t.default&&t.review&&t.analysis&&c.review_providers.codex_timeout_seconds)?0:1)"` | PASS |
| T5 | `grep -c 'timeout-tier' SKILL.md \| grep -q '^3$'` | PASS |
| T6 | `grep -q 'timeout-tier.*analysis' sgsd-muda-audit.sh && bash -n sgsd-muda-audit.sh` | PASS |

## Deviations from Plan

**1. [Rule 1 - Scope extension] SKILL.md path was sgsd-orchestrate/SKILL.md, not config/SKILL.md**
- **Found during:** T5 pre-execution discovery
- **Issue:** Plan specified `super-gsd/config/SKILL.md` but that path does not exist; the file is at `super-gsd/skills/sgsd-orchestrate/SKILL.md`
- **Fix:** Used `find super-gsd -name 'SKILL.md' | xargs grep -l 'shellDispatch'` to locate the correct file; plan's discovery instruction (`find super-gsd -name 'SKILL.md'`) was correct, the hardcoded path in task guide was stale
- **Files modified:** super-gsd/skills/sgsd-orchestrate/SKILL.md
- **Commit:** 22cfb5e

**2. [Style] timeoutTier property vs inline --timeout-tier string**
- **Found during:** T5 implementation
- **Issue:** shellDispatch is pseudocode that accepts a JS object; the plan said "add --timeout-tier review to each" but the object literal style is `key: value` not raw CLI args
- **Fix:** Added `timeoutTier: 'review'` with a comment `// --timeout-tier review (D-03: ...)` to preserve intent legibility — matches existing `step:`, `phase:` object style
- **Impact:** No behavioral change; shellDispatch reads the property and constructs the flag

**3. [Cleanup] v1.2 Status Note section removed from MILESTONES.md**
- **Found during:** T1
- **Issue:** The stale "v1.2 Status Note" at the bottom of MILESTONES.md was made redundant by the Shipped entry written above it
- **Fix:** Removed the note as part of the same T1 atomic commit — same file, zero content loss (note's content subsumed by the Shipped section)
- **Commit:** a07c4e0

**4. [Preservation] --timeout 60 retained in sgsd-muda-audit.sh alongside --timeout-tier analysis**
- **Found during:** T6
- **Issue:** The existing `--timeout 60` sets TIMEOUT_SECONDS which is then overridden by the tier resolver per D-03 precedence; removing it would be an unplanned scope change
- **Fix:** Left `--timeout 60` in place; it is harmless (overridden), and its removal was not specified in the plan
- **Commit:** a6e28be

## Known Stubs

None — all changes are additive wiring to live code paths.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced. codex-exec.sh timeout changes are behavioral hardening, not surface expansion.

## Self-Check: PASSED

- `.planning/milestones/v1.2-ROADMAP.md` — FOUND
- Commit a07c4e0 — FOUND
- Commit 1b9efcb — FOUND
- Commit 8f3ffc2 — FOUND
- Commit 2481879 — FOUND
- Commit 22cfb5e — FOUND
- Commit a6e28be — FOUND
- `git tag -l v1.2` returns `v1.2` — CONFIRMED
- `grep -c 'timeout-tier' super-gsd/skills/sgsd-orchestrate/SKILL.md` returns 3 — CONFIRMED

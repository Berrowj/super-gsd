---
plan_id: 80-01
phase: 80
title: Warp Plan to SGSD Phase Scaffold converter
type: code (FULL tier)
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/warp-plan-converter/convert.cjs
  - super-gsd/tools/warp-plan-converter/run-self-test.cjs
  - super-gsd/tools/warp-plan-converter/fixtures/
---

# Plan 80-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | convert.cjs with parseWarpPlan + convert + selfTest + _internals | 4 public APIs Lock-13 wrapped |
| 2 | 3 fixture Warp plans | simple / frontmatter / malformed |
| 3 | Generated files marked DRAFT | status:draft + HTML comment |
| 4 | TODO markers in RESEARCH | <!-- TODO: Claude research --> |
| 5 | Acceptance checkboxes in PLAN | `## Acceptance (TODO)` with `- [ ]` bullets |
| 6 | STATE.md + active milestone unchanged | mtime-snapshot before/after |
| 7 | Self-test 12+/12+ PASS | exit 0 |
| 8 | Live conversion produces evidence | .planning/analyses/.../v2-x-draft/ |
| 9 | Atomic commit | feat(p80-01) |

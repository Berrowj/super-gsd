---
plan_id: 83-01
phase: 83
title: Asset cross-index + validator
type: code+docs
expected_ATC_tier: lite
files_touched:
  - super-gsd/docs/SGSD-WARP-ASSET-INDEX.md
  - super-gsd/tools/warp-asset-validator/check.cjs
  - WARP.md
---

# Plan 83-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Author SGSD-WARP-ASSET-INDEX.md | Lists all v2.2-v2.5 surfaces |
| 2 | Implement check.cjs | extractPaths + validate + selfTest; Lock-13 |
| 3 | Self-test 5+/5+ PASS | exit 0 |
| 4 | Live validation: 0 missing | exit 0; 47 paths cited |
| 5 | WARP.md gains Asset Index section | additive only |
| 6 | Atomic commit | feat(p83-01) |

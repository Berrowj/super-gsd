---
phase: 83
phase_name: Workflow/Skill/Prompt Cross-Index
milestone: v2.5
created: 2026-04-29
status: in-progress
deviation_from_standard: docs+small-tool phase
---

# Phase 83 -- CONTEXT

Single discoverable index of all SGSD-Warp surfaces shipped across v2.2-v2.5
+ a validation tool that asserts every cited path exists.

## Locked Scope

- D83.1: Author SGSD-WARP-ASSET-INDEX.md listing 14 workflows + 7 skills +
  7 prompts + 1 notebook + 14 MCP tools + 2 launch config templates +
  5 tools + 9 operator-facing docs + 3 repo-root rules.
- D83.2: Implement `super-gsd/tools/warp-asset-validator/check.cjs` that
  greps the index for backtick-quoted paths and verifies each exists.
- D83.3: WARP.md gains an "Asset Index" section linking to the index.
- D83.4: Validator self-test (5+) PASS; live validation 0 missing on this
  checkout.

## Outputs

- super-gsd/docs/SGSD-WARP-ASSET-INDEX.md (NEW)
- super-gsd/tools/warp-asset-validator/check.cjs (NEW)
- WARP.md (UPDATED — Asset Index section additive)
- 5 Phase 83 standard artifacts

## Acceptance

1. Index lists all v2.2-v2.5 SGSD-Warp surfaces.
2. Validator self-test 5+/5+ PASS.
3. Live validation: 0 missing paths.
4. WARP.md links to index.

---
phase: 91
phase_name: Cloud-Safe SGSD Skills
milestone: v2.7
created: 2026-04-29
status: in-progress
deviation_from_standard: docs phase
---

# Phase 91 -- CONTEXT

Define what SGSD-adjacent work can run in Warp Oz / cloud
environments. 5 cloud-safe categories + 6 unsafe; decision matrix.

## Locked Scope

- D91.1: SGSD-CLOUD-SAFE-SKILLS.md authored.
- D91.2: 5 cloud-safe categories (CS-01..CS-05).
- D91.3: 6 unsafe categories (CU-01..CU-06) with explicit reasons.
- D91.4: Skill file format spec with `cloud_safe` + `cloud_classification` frontmatter.
- D91.5: Decision matrix.
- D91.6: Hard rule: when in doubt, UNSAFE (default-local).

## Outputs
- super-gsd/docs/SGSD-CLOUD-SAFE-SKILLS.md
- 5 Phase 91 standard artifacts

## Acceptance
1. 5 cloud-safe + 6 unsafe enumerated.
2. Decision matrix present.
3. Skill file format spec'd.
4. Forward refs to Phase 92/93/96/97.

---
phase: 91
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 91 -- Research

## Sources
- v2.7 Phase 91 roadmap task list
- Atlas Layer 5 (Oz / cloud agents)
- Phase 48 selective-VTP bridge contract (CU-01 source)
- Phase 52 Redis adapter (CU-02 source)
- Phase 67 warp-doctor (CU-03 source)
- Phase 90 controlled actions (CU-05 source)

## Key decisions

### D1 — Default-local; cloud requires explicit justification
AGENTS.md hard rules imply local-only by default. CS-* tasks justify cloud explicitly via output type (markdown PR / report / read-only audit).

### D2 — 5 CS / 6 CU split
CS-01..CS-05 are read-only or PR-emitting; no state mutation. CU-01..CU-06 require local resources (VTP / Redis / Windows / state / approval).

### D3 — Skill file format with `cloud_safe` + `cloud_classification`
Distinct frontmatter fields enable Warp Oz scheduler to auto-filter eligible skills. Phase 79 skills (read-only) could in principle be cloud-tagged, but most reference local STATE.md so default to local-only unless explicitly tagged.

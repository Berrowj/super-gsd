---
phase: 93
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 93 -- Research

## Sources
- v2.7 Phase 93 roadmap task list
- Phase 91 SGSD-CLOUD-SAFE-SKILLS.md (CS-01..CS-05)
- Phase 92 SGSD-OZ-ENVIRONMENT-SPEC.md
- Atlas Layer 5 § Scheduled Agents

## Key decisions

### D1 — 5 schedules: 2 weekly + 1 nightly + 1 monthly + 1 optional
Conservative starter cadence. Operator picks subset; defaults are sensible.

### D2 — Cost in credits/year explicit
Operators decide based on token-budget pressure. SA-03 (nightly) is highest cost; offer every-other-day fallback.

### D3 — Schedule prompts include forbidden-actions list
Defense-in-depth: cloud agent prompt tells the agent it cannot mutate STATE.md / call controlled actions / expose secrets. Even if agent is misconfigured, prompt resists scope creep.

### D4 — NOT-scheduled list carries forward CU-01..CU-06 + CU-05 (Phase 90)
Default-local discipline.

### D5 — False-positive recovery via CRIT-BACKLOG
If a schedule starts producing noise, operator pauses + files a CRIT-BACKLOG row tagging audit-id. Subsequent phase fixes OR deletes.

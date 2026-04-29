---
phase: 92
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 92 -- Research

## Sources
- Phase 91 SGSD-CLOUD-SAFE-SKILLS.md (CS-01..CS-05 inventory)
- Atlas Layer 5 § Environments
- Phase 90 controlled-action contract (cloud excluded — CU-05)
- Phase 67 warp-doctor probes 2-4 (Windows-only — degrade NOT-APPLICABLE)

## Key decisions

### D1 — Alpine + Node-only base
SGSD audits are pure-Node. Alpine 50MB cold-start is faster than full Linux. Matches CU-03 boundary (Windows-specific local-only).

### D2 — `--omit=dev` install
Near-zero runtime deps; dev not needed for audits. Speeds container ready-time.

### D3 — All API keys forbidden
Cloud has no operator approval. CS-01..CS-05 are read-only — don't need API access. Forbidden by design (defense-in-depth vs accidental config).

### D4 — Per-run ephemeral lifecycle
Zero persistence. Audit output goes to GitHub PR; that's the audit trail. No local state at risk.

### D5 — Hard boundary as final section
Future phases that try to extend cloud capability MUST go through deliberation. Spec is the contract; deviation = regression.

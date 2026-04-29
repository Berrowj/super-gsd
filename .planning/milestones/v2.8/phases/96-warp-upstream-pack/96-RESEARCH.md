---
phase: 96
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 96 -- Research

## Sources
- Warp roadmap issue #9233 (May-June 2026)
- Warp issue #7326 (ACP, open)
- SGSD-WARP-OPERATOR-GUIDE.md (ships with v2.6)
- WARP.md (Rule Hierarchy + Asset Index)
- Phase 67 warp-doctor 18 probes
- Phase 74 ORCHESTRATOR-LIVE.jsonl 16 event types
- Phase 76 cockpit-state adapter (10/11-section snapshot)
- Phase 84 14 .warp/workflows
- Phase 89 4 permission tiers + 8 denial reasons

## Candidate scoring (4-axis: 1-5)

| # | Candidate | Warp gain | Effort | Generalizable | Dup-risk | Score |
|--:|---|--:|--:|--:|--:|--:|
| 1 | Wrapper detection (sg launching Claude/Codex) | 3 | 2 | 4 | 4 | 13 |
| 2 | Long-running local orchestrator telemetry panel | 5 | 4 | 5 | 5 | 19 |
| 3 | Gate/status chips for local agent sessions | 4 | 3 | 4 | 4 | 15 |
| 4 | Warp CLI support for launching saved workspaces | 3 | 2 | 3 | 2 | 10 |
| 5 | ACP fixture based on SGSD milestone/phase flows | 4 | 3 | 5 | 5 | 17 |
| 6 | Tmux control mode validation for SGSD dashboards | 3 | 2 | 3 | 3 | 11 |

(Higher = better. Dup-risk = 5 means low risk of duplicating existing Warp work.)

## Key decisions

### D1 -- Pick #2: Long-running local orchestrator telemetry panel
Top score (19/20). Generalizes beyond SGSD (any local agent emitting JSONL
gets a panel). High Warp gain because no current native surface for
long-running local-orchestrator visibility. Low dup-risk (no current Warp
feature occupies this space). Effort 4 because it requires a panel API +
ingestion contract, but SGSD already ships ORCHESTRATOR-LIVE.jsonl as a
working ingestion surface to reference.

### D2 -- Reject #1 (wrapper detection)
Score 13. Too SGSD-specific. Warp would need to recognize `sg` as a known
wrapper. Easier solved client-side (we already do, via sgsd-cockpit).

### D3 -- Defer #5 (ACP fixture)
Score 17. Strong but blocked on ACP shipping (Phase 95 SKIPPED). Park as
follow-up after #2 lands and ACP is real.

### D4 -- Do NOT open issue
Operator brief Rule 8: no Warp patching/upstream until operator-validated.
Draft packet sits in repo as authoring artifact. Operator reviews, then
decides timing/forum (issue, RFC, private channel).

## Reference points

- SGSD ORCHESTRATOR-LIVE.jsonl 16 event types (Phase 74) -- candidate ingestion contract.
- Cockpit-state adapter 11-section snapshot (Phase 76) -- candidate panel data shape.
- Phase 89 4 permission tiers -- candidate permission model for action panels.

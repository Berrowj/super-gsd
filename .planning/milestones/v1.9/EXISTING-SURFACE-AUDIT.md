---
milestone: v1.9
status: proposed
created: 2026-04-27
purpose: Map existing SGSD surfaces so the milestone extends rather than duplicates.
---

# Existing Surface Audit

## Existing Canonical State

- `.planning/STATE.md`
- `.planning/ROADMAP.md`
- `.planning/metrics/*.jsonl`
- `.planning/milestones/**`
- git commits and tags

Rule: keep these as source of truth. New cache/index layers are projections.

## Existing Metrics And Evidence Surfaces

Known metrics include:

- `activity-log.jsonl`
- `audit-log.jsonl`
- `codex-log.jsonl`
- `codex-live.json`
- `edge-guard-log.jsonl`
- `gate-value-log.jsonl`
- `route-decisions.jsonl`
- `crit-backlog.jsonl`
- `token-attribution.jsonl`

Potential new canonical metrics:

- `agent-token-spend.jsonl`
- `intent-map.jsonl`
- `context-complaints.jsonl`
- `context-packet-log.jsonl`

Do not create a second backlog, route ledger, or provider-health log.

## Existing Tools To Reuse

- `super-gsd/tools/status-consistency/check.cjs`
- `super-gsd/tools/provider-health/check.cjs`
- `super-gsd/tools/backlog-schema/check.cjs`
- `super-gsd/scripts/lib/crit-backlog.cjs`
- `super-gsd/scripts/codex-exec.sh`
- `super-gsd/tools/gate-keep-kill/rubric.cjs`
- `super-gsd/tools/phase-folder-audit/audit.cjs`
- `super-gsd/tools/system-map/generate.cjs`

New tools must follow the same pattern:

- CLI entrypoint
- `--self-test`
- deterministic fixtures
- production caller path
- JSON output where practical

## Existing Cockpit Surfaces

- `super-gsd/scripts/sgsd-mission-control.ps1`
- `super-gsd/scripts/sgsd-codex-monitor.ps1`
- `super-gsd/scripts/sgsd-narrative.ps1`
- `super-gsd/scripts/sgsd-boot.ps1`
- `super-gsd/scripts/lib/sgsd-mission-strip.ps1`

Do not build a second cockpit. Improve the current one.

The cockpit must stop mixing old Codex state, current Claude state, and repeated
NOW summaries across panes. The operator view should be:

- current milestone/phase/progress/evidence/debt left-top;
- Codex-only review/gate state in Codex panel;
- current Claude/active-agent work and agent history in the vertical panel;
- tool/skill/VTP stream below active work.

## Existing Knowledge Surfaces

- VTP MCP server
- VTP research corpus
- VTP book corpus as `wiki_page` resources
- local `.planning/memory/**`
- phase artifacts

Rule: VTP is a selective provider. It is not ambient context.

## Existing Risks

1. Researcher bloat is already proven.

   The audit found 122k-223k token researcher runs with more than 98 percent
   cache-read spend. The milestone must not solve this with more prose.

2. Full context acts as a pass-through variable.

   Agents are being handed broad history instead of a deep interface that
   answers their role-specific questions.

3. Redis could become a false fix.

   Redis improves live coordination and hot lookups, but it does not solve
   memory governance. It must come last and remain disposable.

4. VTP MCP can fail in its own pipeline.

   The cross-check saw schema validation failure and timeout. VTP failures must
   be logged as provider/tool failures, not confused with research conclusions.

5. Current cockpit labels are too internal.

   Terms like `old live`, `R#`, `cascade`, and `checkpoint present` need
   operator-facing translation.

6. Raw operator commands can be misread or over-expanded.

   A command like "make it lighter" can mean visual weight, color, tone,
   wording, runtime load, or emotional burden. SGSD needs an Intent English
   layer that records meaning, assumptions, ambiguity, canonical instruction,
   and relationship weights before context is gathered.

## Required Extension Points

This milestone should extend:

- phase close: write capsule, token checks, context complaint reconciliation;
- operator command intake: build intent map before context packet;
- orchestrator dispatch: build packet before agent call;
- provider routing: choose local/Codex/Claude/VTP by uncertainty;
- cockpit projection: read token spend, context packet, active agents;
- milestone close: benchmark, index rebuild, Redis safety if enabled.

## Surfaces Not To Duplicate

- Do not create another mission-control script.
- Do not create another backlog file.
- Do not create another route-decision ledger.
- Do not create another provider health system.
- Do not create another memory root outside `.planning` without operator
  approval.
- Do not make Redis or SQLite canonical.

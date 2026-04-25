# VTP Classification Gap — Milestone v1.5

## Tier verdict

**Tier 3** (current): VTP MCP does not expose milestone classification or metadata write fields. Per `.planning/milestones/v1.4/phases/13-codex-integration/13-05-01-vtp-probe.md` reference verdict.

## What we wanted to publish

```json
{
  "classification": "Milestone (SGSD v2)",
  "milestone": "v1.5",
  "milestone_name": "VTP Knowledge Primacy + Post-v1.4 Hardening",
  "phases_shipped": 5,
  "plans_shipped": 11,
  "reqs_delivered": 21,
  "categories": ["VTPE", "SEC", "MUDAC", "CONTRACT", "CARRY", "INSTR"]
}
```

## What VTP exposes today

- `vtp_ingest_research(slug, body)` — accepts research artifacts but not milestone classification
- `vtp_search_research`, `vtp_search_substrate`, `vtp_search` — read-side only
- No `vtp_publish_milestone` or `classification: <enum>` field on ingest

## Reserved for future write support

`.planning/milestones/v1.5/vtp-research-id.txt` — empty file reserved as the destination once VTP supports milestone-classified ingest.

## Action queued for v1.6

If a milestone summary is later mirrored into `wiki/research/v1.5-milestone.md`, run `mcp__vtp-kb__vtp_ingest_research` with that slug as a best-effort enrichment (no classification, but at least the SUMMARY content lands in VTP for cross-milestone retrieval).

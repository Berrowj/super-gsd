# VTP Classification Gap — v1.2 Milestone

## Probe Verdict

**Tier:** 3 (fixed enum) — per `13-05-01-vtp-probe.md`

## Observed API Surface

The `mcp__vtp-kb__vtp_ingest_research` tool accepts only:
- `slug` (string)

## Missing Fields Required for Milestone Classification

| Field | Required Value | Purpose |
|-------|---------------|---------|
| `classification` | `"Milestone"` or `"Milestone (SGSD v2)"` | Taxonomy tag for milestone artifacts |
| `metadata` | `{milestone_version, opened_at, closed_at, phases, plans}` | Milestone provenance |
| `tags` | `["sgsd", "v1.2", "evidence-first"]` | Search facets |
| `milestone_ref` | `"v1.2"` | Direct milestone cross-reference |

## Desired Publish Contract (Tier-1 target for future VTP support)

```json
{
  "slug": "sgsd-v1.2-evidence-first-sharpening",
  "classification": "Milestone",
  "metadata": {
    "milestone": "v1.2",
    "milestone_name": "Evidence-First Sharpening",
    "opened_at": "2026-04-19",
    "closed_at": "2026-04-22",
    "shipped_phases": 5,
    "total_plans": 25
  },
  "tags": ["sgsd", "milestone", "v1.2", "evidence-first", "atc-gates", "governance"]
}
```

## Current Fallback Path (Tier-3)

1. `VTP-CLASSIFICATION-GAP.md` documents missing API fields (this file).
2. `vtp-research-id.txt` reserved for future write support.
3. If milestone summary is later mirrored at `wiki/research/v1.2-milestone.md`,
   run `mcp__vtp-kb__vtp_ingest_research` with slug `sgsd-v1.2-milestone-summary`
   as a best-effort enrichment step.

## Read-Side Status

Read-side enrichment via `mcp__vtp-kb__vtp_search` and `mcp__vtp-kb__vtp_list_research`
remains available. No prior milestone-like artifacts were found in VTP at v1.2 close
(no existing SGSD milestone entries).

## Resolution Path

Raise with VTP maintainer: request `classification` + `metadata` + `tags` fields on
`vtp_ingest_research`. Once available, upgrade to Tier-1 and publish `SUMMARY.md`
content directly. Update `sgsd-complete-milestone` SKILL.md Step 6 tier check accordingly.

# VTP Classification Gap — v1.4 Milestone Close

## Probe verdict

Current VTP probe verdict (per `13-05-01-vtp-probe.md`): **tier-3**.

- **tier-1** would publish with `classification: Milestone`
- **tier-2** would publish with `classification: "Milestone (SGSD v2)"`
- **tier-3 (current)**: VTP does not expose milestone classification or metadata fields

## Missing API fields (desired)

- `classification: Milestone` taxonomy on `vtp_ingest_research` or equivalent
- `milestone_id: v1.4` first-class metadata field
- `parent_milestones: [v1.3]` for lineage tracking
- `requirements_delivered: [...]` as structured list
- `codex_dogfood_stats: { invocations, tokens_saved, criticals_cleared }` for cross-milestone aggregation

## Reserved research-id

`vtp-research-id.txt` reserved in this directory for future write support. Currently empty — populated when tier-1/tier-2 publish path lands.

## Best-effort mirror

If a milestone summary is later mirrored into `wiki/research/v1.4-milestone.md`, run `mcp__vtp-kb__vtp_ingest_research` with that slug as enrichment — no classification, just content capture.

## Publish state

- `vtp_classification_used: gap-tier-3` in SUMMARY.md frontmatter
- No VTP write attempted at milestone close
- SUMMARY.md is the authoritative local record

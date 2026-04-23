# VTP Probe

## Spike Design

Inspected the configured `mcp__vtp-kb__vtp_ingest_research` tool schema and compared it with the
Phase 13 publish requirements.

## Observed Schema

Observed parameters:

- `slug`

Observed limitations:

- no classification field
- no metadata field
- no tag field
- no direct publish API for milestone summaries

## Tier Verdict

TIER-3 (fixed enum)

## Impact on 13-05-03/05

- read-side enrichment remains available through `vtp_search` and `vtp_list_research`
- write-side publication must fall back to a gap memo because the current MCP surface cannot
  attach milestone classification or metadata
- `sgsd-complete-milestone` should write `VTP-CLASSIFICATION-GAP.md` and leave
  `vtp-research-id.txt` reserved for future VTP support

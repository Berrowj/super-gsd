---
session: opus-4.7-1m
mode: autonomous
emergency_halt: false
created: 2026-04-29
---

# Malformed Checkpoint

This checkpoint is intentionally missing the required fields:
- next_unit
- controlling_principle

The Phase 54 manifest validator must reject this with
reason='manifest_missing_field' and missing_fields=['next_unit',
'controlling_principle'].

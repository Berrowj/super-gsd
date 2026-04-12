---
milestone: {{milestone_id}}
generated: {{iso_timestamp}}
probe_duration_sec: {{seconds}}
phases_scanned: {{n}}
status: GO | BLOCKED | PARTIAL
first_stall_eta_min: {{n_or_na}}
---

# Milestone Readiness — {{milestone_id}}

> Pre-flight dependency audit. Generated before auto-mode execution.
> If this file is older than the latest phase change in the milestone, re-run `/gsd-readiness`.

## GO — Safe to run unattended

Phases whose probed dependencies are all green AND whose upstream phases are not blocked.

| Phase | Title | ETA | Notes |
|-------|-------|-----|-------|
| {{id}} | {{title}} | {{eta_min}}m | {{notes}} |

## BLOCKED AT START — Fix these before running

Each entry ends with the exact one-liner to paste.

### {{phase_id}} — {{phase_title}}
- **Failed probe:** `{{probe_cmd}}` → {{result}}
- **Dependency:** {{dep_name}} ({{dep_kind}})
- **Fix:** `{{one_line_fix}}`

## WILL BLOCK MID-RUN — Cascade blockers

Own deps are green but an upstream phase is blocked. Unblock upstream first.

| Phase | Depends on | Reason |
|-------|-----------|--------|
| {{id}} | {{upstream_id}} | {{why}} |

## DEGRADED AUTO-RUN PATH

Longest prefix of consecutive GO phases you can hand to auto-mode right now.

- **Path:** {{p1}} → {{p2}} → {{p3}}
- **Total ETA:** {{total_min}} minutes
- **Stops at:** {{stop_phase}} — {{stop_reason}}
- **Command:** `/sgsd-orchestrate go --until {{stop_phase}}`

If no degraded path is possible, this section reads: _None — fix the blockers above before any auto-run._

## PROBE LOG

Append-only record of every probe run for this audit. Used by dashboards and for post-mortem.

| Time | Phase | Dep | Probe | Result |
|------|-------|-----|-------|--------|
| {{ts}} | {{phase}} | {{dep}} | `{{cmd}}` | {{PASS\|FAIL\|UNKNOWN}} |

## Notes for the human

- Fixes above are safe to run from any shell with project credentials.
- Never paste API key values — use `secure_env_collect` for secrets.
- After running fixes, reply `continue` — the orchestrator re-probes and resumes.

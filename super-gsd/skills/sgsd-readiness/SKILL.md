---
name: sgsd-readiness
description: "Run the milestone pre-flight readiness audit on demand. Produces MILESTONE-READINESS.md with GO / BLOCKED / WILL-BLOCK / DEGRADED-PATH sections so unattended auto-runs don't stall hours in on missing services. Safe to run any time — idempotent when the manifest is fresh."
allowed-tools:
  - Read
  - Write
  - Bash
  - Grep
  - Glob
  - Agent
---

<objective>
Dispatch the `sgsd-milestone-readiness` agent against the currently active milestone, write the manifest, and surface a one-screen summary to the user. This is the manual entry point to the same gate that Rule 0 of the orchestrator loop runs automatically.
</objective>

<when_to_use>
- Before saying "go" on a new milestone — confirm you can walk away.
- After fixing a blocker — re-probe to confirm the path is now clean.
- When the SGSD1 banner or SGSD3 card shows stale / BLOCKED and you want a fresh scan.
- After pulling changes that may have altered phase dependencies.
</when_to_use>

<process>

## Step 1 — Locate the active milestone

```bash
head -30 .planning/STATE.md
```

Also extract `current_phase`; the production consult requires both phase and
milestone scope.

Extract `active_milestone`. If none, stop with: _"No active milestone in STATE.md — run /gsd-new-milestone first."_

## Step 2 — Run the ordered manual preflight

```bash
node super-gsd/scripts/lib/orchestrator-hooks.cjs --manual-readiness-sequence --phase "{phase}" --milestone "{id}" --project-dir "{project_dir}" --json
```

Append `--force` when the user supplied it. This production sequence first runs
the canonical `on-demand` / `manual` / `execute=true` routing consult, retains
its three results as `vtp_probe_rows`, and only then checks manifest freshness.
Require `sequence[0] == "vtp_consult"` and exactly the three expected rows.
`action:"stop"` stops this skill with its stable `reason_code`. Never import
`run.cjs`, copy its probes, or expose dispatch paths/raw stderr.

## Step 3 — Apply the manifest answer and pass the rows

If `action` is `return_fresh_manifest`, report the existing manifest status and
the supplied `vtp_probe_rows`, then skip the readiness agent. The probes have
already run; freshness short-circuits only manifest regeneration.

If `action` is `dispatch_readiness_agent`, dispatch the manifest consumer and
pass the rows explicitly as JSON:

```
Agent(
  subagent_type: "sgsd-milestone-readiness",
  mode: "bypassPermissions",
  description: "Milestone pre-flight readiness audit",
  prompt: "Audit milestone {id}. VTP_PROBE_ROWS: {vtp_probe_rows_json}. Consume exactly these supplied three VTP PROBE LOG rows without re-running or copying those probes. Produce MILESTONE-READINESS.md at .planning/milestones/{id}/. Return the structured status block including VTP_PROBE_ROWS."
)
```

## Step 4 — Render summary to the user

Parse the fresh-manifest status or the agent's returned block and render. Carry
the same three `vtp_probe_rows` with either answer:

```
READINESS — {milestone_id}          {GO|PARTIAL|BLOCKED}
─────────────────────────────────────────────────────
✓ GO           : {n} phases — can run unattended
✗ BLOCKED      : {n} phases — need human fix
⚠ WILL BLOCK   : {n} phases — cascade from blocked
→ DEGRADED PATH: {p1} → {p2} → stop@{stop}  ({eta} min)
─────────────────────────────────────────────────────
Manifest: .planning/milestones/{id}/MILESTONE-READINESS.md

Next: fix | degraded | go anyway | cancel
```

If status is GO, skip the prompt and just tell the user they're clear to run.

## Step 5 — Log

Append to `.planning/metrics/readiness-log.jsonl` with `{ts, milestone, trigger:"manual", status, phases_scanned}`.

</process>

<flags>
- `--force` — bypass a fresh-manifest return and regenerate the manifest; the VTP probes run either way.
- `--quiet` — skip the user-facing summary (orchestrator calls this internally).
</flags>

<rules>
- NEVER start services yourself — only report fixes.
- NEVER read secret values — existence probes only.
- Idempotent manifest generation by default. Fresh manifests still run the three VTP probes before their existing status is returned.
- If the agent reports `MANIFEST_MISSING` mid-loop, the orchestrator should re-invoke this skill with `--force`.
</rules>

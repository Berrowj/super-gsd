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

Extract `active_milestone`. If none, stop with: _"No active milestone in STATE.md — run /gsd-new-milestone first."_

## Step 2 — Check manifest freshness

If `.planning/milestones/{id}/MILESTONE-READINESS.md` exists AND its mtime is newer than every phase dir under the milestone, report the existing status and skip the probe run unless the user passed `--force`.

## Step 3 — Dispatch the agent

```
Agent(
  subagent_type: "sgsd-milestone-readiness",
  mode: "bypassPermissions",
  description: "Milestone pre-flight readiness audit",
  prompt: "Audit milestone {id}. Produce MILESTONE-READINESS.md at .planning/milestones/{id}/. Return the structured status block."
)
```

## Step 4 — Render summary to the user

Parse the agent's returned block and render:

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
- `--force` — re-run probes even if the manifest is fresh.
- `--quiet` — skip the user-facing summary (orchestrator calls this internally).
</flags>

<rules>
- NEVER start services yourself — only report fixes.
- NEVER read secret values — existence probes only.
- Idempotent by default. Fresh manifests are not re-probed unless `--force`.
- If the agent reports `MANIFEST_MISSING` mid-loop, the orchestrator should re-invoke this skill with `--force`.
</rules>

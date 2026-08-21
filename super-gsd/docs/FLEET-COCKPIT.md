# SGSD Fleet Cockpit

The Fleet Cockpit is a read-only HTTP view of the existing cockpit-state
adapter for every Git worktree lane. Requests only read the timer-fed cache;
they never run Git, rebuild a snapshot, or write project data.

## Start and stop

From one checkout that contains .planning/:

    bash super-gsd/scripts/sgsd-fleet.sh start .
    bash super-gsd/scripts/sgsd-fleet.sh status .
    bash super-gsd/scripts/sgsd-fleet.sh stop .

The defaults are 127.0.0.1:7777 with a 20 second discovery and refresh
interval. The wrapper is idempotent and keeps its PID, log, and framing FIFO
below the standard user cache directory in super-gsd/fleet-cockpit.

For a direct bind smoke test, run:

    node super-gsd/tools/fleet-cockpit/server.cjs --root .
    curl http://127.0.0.1:7777/healthz

Direct mode proves the listener and routes. Use the wrapper for a populated
fleet: it supplies exact git worktree list --porcelain frames to the server.

## Localhost and LAN access

Loopback is the privacy default. Nothing binds to a LAN interface unless the
operator explicitly opts in:

    bash super-gsd/scripts/sgsd-fleet.sh start . --host 0.0.0.0 --port 7777 --interval 20

--host 0.0.0.0 exposes the read-only endpoint to the local network. Apply
normal host firewall and trusted-network controls before using that option.

## Status colours

Status precedence is attention > running > stale > idle.

- Red, attention: a gate failed, operator attention is newer than the last
  run, blockers exist, or a checkpoint is waiting for a later run.
- Purple, running: a fresh Codex live signal or unmatched dispatched agent is
  in flight.
- Amber, stale: STATE.md, last activity, or Codex live evidence is stale.
- Slate, idle: no higher-priority signal is present.

Missing evidence is not success. Absent tokens, empty live gates, and a missing
phases directory remain explicit no_data values. If the effective objective
conflicts with STATE.md, the detail response shows both milestone/phase pairs,
their source, and confidence; the service does not choose between them.

## Routes and cache age

- GET /api/fleet returns deterministic roll-up rows and counts.
- GET /api/lane/:name returns derived detail beside the unchanged adapter
  envelope under snapshot.
- GET /api/lane/:name/raw returns only the unchanged adapter envelope.
- GET /healthz returns lane count, skipped lanes, build diagnostics,
  cache_age_seconds, and build_ms_last.

Every response, including raw and errors, has
X-SGSD-Cache-Age-Seconds. cache_age_seconds is the number of whole seconds
since the last cache publication. It normally rises between refreshes and then
drops after a completed cycle. Before the first publication the header reads
unknown and JSON age fields are null. A steadily rising value means the
producer is delayed or unhealthy; inspect /healthz and the wrapper log.

Git worktrees without .planning/ appear in skipped_lanes. A snapshot build
failure remains a lane-local error row and diagnostic; healthy lanes continue
to render. Unknown or traversal-like lane names return a stable JSON 404 with
no path or stack.

Only GET is accepted. POST, PUT, PATCH, and DELETE are rejected before route
selection, and there are no write controls or mutating handlers.

## Load verification

The local structural-load-safety case proves that request bursts do not add
builds, refreshes do not overlap, and build concurrency never exceeds four.
The separate devcp run-home check still requires recording load average before
and during the deployed service and confirming the increase is less than 1.0.
This repository check does not claim that machine measurement.

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
- Teal, running: a fresh Codex live signal or unmatched dispatched agent is
  in flight.
- Amber, stale: STATE.md, last activity, or Codex live evidence is stale.
- Green, idle: no higher-priority signal is present.

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

## Page operation

GET / and GET /index.html serve the Fleet Cockpit page; GET /app.js serves its
only script. For direct-file debugging, open public/index.html and keep the
service running on http://127.0.0.1:7777. The file page uses that loopback
service only. The HTTP page uses same-origin API routes.

The page polls only /api/fleet every five seconds. It fetches
/api/lane/:name only when the selected lane changes. A deep link in the form
#/lane/<encoded-name> restores a lane when it still exists. The cache-age
indicator remains mounted at all times. A fleet or detail request failure adds
a visible banner while retaining the last good rail, selected detail, raw JSON,
and cache age; a later successful request clears the corresponding banner.

No data is different from numeric 0. Missing or no_data evidence uses muted,
dashed No data styling, while numeric zero uses normal numeric styling. A
projection conflict displays the effective milestone and phase, STATE.md
milestone and phase, source, and confidence without choosing a winner. The raw
adapter snapshot remains visible in its own scrollable JSON region.
resume_command is selectable inert code text only: it is never a button, link,
form action, or execution path.

## MANUAL CHECKS

### Manual phone over LAN check

This check is manual and operator-owned. Apply trusted-network/firewall
controls, then start the wrapper from the intended checkout:

    bash super-gsd/scripts/sgsd-fleet.sh start . --host 0.0.0.0 --port 7777 --interval 20

On a real phone connected to that trusted LAN, browse
http://<LAN-IP>:7777/. Record the device, browser, time, and result below only
after performing every observation.

- [ ] At the phone viewport, the lane rail is first and all rows select.
- [ ] Each row has readable status text; the status dot is not the sole cue.
- [ ] The 44px targets work reliably by touch.
- [ ] After the rail, the centre and raw content follow in that order.
- [ ] Long JSON scrolls inside its region with no page-wide horizontal overflow.
- [ ] The cache age remains visible throughout selection and scrolling.
- [ ] Stopping the service leaves the last render under a banner.
- [ ] Restarting the service and refreshing recovers the live page.
- [ ] A copied hash deep link restores a lane.
- [ ] The browser network log contains only that service's page assets and API calls.
- [ ] Device, browser, time, and any observations are recorded with the result.

Result: PENDING - operator-owned

The self-test verifies this documentation only; it does not run or emulate the
phone check. Only an operator observation may record PASS.

## Load verification

The local structural-load-safety case proves that request bursts do not add
builds, refreshes do not overlap, and build concurrency never exceeds four.
The separate devcp run-home check still requires recording load average before
and during the deployed service and confirming the increase is less than 1.0.
This repository check does not claim that machine measurement.

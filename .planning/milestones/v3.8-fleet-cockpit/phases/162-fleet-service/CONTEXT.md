---
phase: "162"
slug: fleet-service
milestone: v3.8-fleet-cockpit
status: ACTIVE
opened: 2026-08-21
depends_on: ["161"]
source: handover sections 4-7, 9 step 1
---

# P162 Context — Fleet Service (handover step 1)

HTTP service over the existing adapter. tools/fleet-cockpit/{server,fleet,status}.cjs
+ run-self-test.cjs + fixtures/lanes/ + scripts/sgsd-fleet.sh + docs/FLEET-COCKPIT.md.

Hard constraints (binding): zero runtime deps (node:http/fs/path), CJS .cjs,
ASCII source, READ-ONLY (no POST/PUT/PATCH/DELETE handlers at all), no writes
outside the cache dir.

Routes: GET /api/fleet (roll-up, counts, lanes with status/headline/conflict),
GET /api/lane/:name (adapter output VERBATIM under snapshot; derived fields
beside, never inside), GET /api/lane/:name/raw, GET /healthz. Error shape: a
failing lane is a status:error row; never a 500 with a stack; one broken lane
never blanks the fleet.

Discovery: git worktree list --porcelain (git is the authority; no globbing);
lanes without .planning/ skipped and REPORTED in /healthz. Cache: 20s timer
(--interval), bounded concurrency 4, roll-up-first stagger, serve from memory
only, cache_age_seconds on every response; degrade interval under load, never
correctness.

Status derivation (section 7, the only real design): attention > running >
stale > idle, first-match precedence, reasons as machine codes. Noise filters
are contractual: roster entries without model/recognised-name excluded (Bash is
not an agent); tokens.source absent renders no-data not 0; empty gates with
live_event_count 0 is "no gate data" not "all passed"; artifacts source reasons
shown. projection_stale => conflict:true, both values + confidence exposed.

Acceptance = handover step-1 checklist verbatim (binds 127.0.0.1:7777, verbatim
snapshot, kill-one-lane-59-survive, cache visibility + no request-triggered
build, devcp load delta <1.0, zero npm deps).

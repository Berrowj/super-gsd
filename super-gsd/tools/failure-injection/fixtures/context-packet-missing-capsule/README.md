# Fixture: context-packet-missing-capsule

Scenario id: context-packet-missing-capsule
Target tool: super-gsd/tools/context-packet/build.cjs (buildPacket)
Inject mechanism: delete_phase_capsule_file

## Failure mode

The harness:
1. Copies seed-capsule.json into
   tmpdir/.planning/milestones/v1.8/phases/36-fixture/PHASE-CAPSULE.json
   to mirror a real Phase 43 capsule shape.
2. Deletes that file via fs.unlinkSync (the "missing capsule" inject).
3. Spawns a node -e wrapper that requires the real build.cjs and calls
   `buildPacket('researcher', 'fixture-intent', { planningDir,
   milestone:'v1.8', phase:'36', raw_evidence:[fixture content] })`.

Because no capsule exists for the requested (milestone, phase) AND
because the harness supplies opts.raw_evidence to trip the Step 8 raw
fallback (build.cjs:732-744), the packet builder reaches the
`rawEvidenceCount > 0` branch (build.cjs:834) and pushes
`packet_capsule_unavailable_raw_fallback` into the packet's
reason_codes array.

## Closed-vocab observation

`expected_reason_codes` per scenarios.json:
`packet_capsule_unavailable_raw_fallback`.

The harness reads stdout JSON (the packet object), inspects
`packet.reason_codes`, and asserts byte-equal set membership against
the expected enum (Lock 11). Live `.planning/metrics/` byte-equal pre
and post (Lock 4 anti-pollution) - the harness writes complaint and
log rows into `tmpdir/.planning/metrics/` only.

## Files

- README.md (this file)
- seed-capsule.json: a valid PHASE-CAPSULE.json shape, copied then
  deleted by the harness mid-scenario
- intent-fixture.json: synthetic intent_map shape passed via opts (not
  required by the current buildPacket smoke path; reserved for future
  use)

ASCII-only. No credentials.

# Fixture: memory-governance-revocation-replay

Scenario id: memory-governance-revocation-replay
Target tool: super-gsd/tools/memory-governance/lifecycle.cjs (processComplaints)
Inject mechanism: synthetic_revocation_row

## Failure mode

A synthetic memory-revocation row is pre-written to
tmpdir/.planning/metrics/memory-revocations.jsonl, modelling a prior
revoke() invocation. A synthetic complaint row is also pre-written to
tmpdir/.planning/metrics/context-complaints.jsonl so the processComplaints
walker has at least one row to inspect (else the empty-input path is
trivially clean).

The harness then spawns a node -e wrapper that requires the real
lifecycle.cjs and calls processComplaints({ planningDir }). The expected
behavior is:
- subprocess exit_code === 0 (no throw)
- result.ok === true
- repairs_attempted >= 0 (depends on synthetic complaint code)
- the synthetic memory-revocations.jsonl row is byte-readable post-call
  (no destructive rewrite of the prior ledger entries)

## Closed-vocab observation

`expected_reason_codes` per scenarios.json:
`['revoke_applied', 'revalidation_required']`.

The real processComplaints walker emits codes like `repair_scheduled`,
`noop_already_revoked`, `unknown_complaint_reason_code` -- it does NOT
emit `revoke_applied` or `revalidation_required` (those are field names
in the lifecycle metric files, not closed-vocab reasons emitted by the
processComplaints API). Per the scenarios.json soft_skip_when contract
(`phase_49_writer_unwired`), the harness records a PASS-WITH-SOFT-SKIP
when the observed reason set is empty intersection with expected.

Structural assertion (load-bearing):
- subprocess exit_code is a number (real spawn proven; mock-predicate
  forbiddance per CONTEXT.md:81)
- result.ok === true
- the synthetic revocation row is still byte-equal post-call (the
  processComplaints walker is read-only on memory-revocations.jsonl;
  it only writes to repair-queue.jsonl and memory-demotions.jsonl on
  unknown codes)

If the lifecycle module regresses to mutate / truncate
memory-revocations.jsonl, or if processComplaints starts throwing on
empty / malformed complaint rows, the verdict flips to FAIL.

## Files

- README.md (this file)
- seed-revocation-row.json: synthetic memory-revocations.jsonl row
  written into tmpdir/.planning/metrics/ pre-spawn
- seed-complaint-row.json: synthetic context-complaints.jsonl row
  driving the processComplaints walker

ASCII-only. No credentials.

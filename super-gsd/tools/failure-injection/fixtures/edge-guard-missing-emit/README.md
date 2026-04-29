# Fixture: edge-guard-missing-emit

Scenario id: edge-guard-missing-emit
Target tool: super-gsd/scripts/lib/edge-guard.cjs (recordTransition)
Inject mechanism: synthetic_gate_with_missing_emit

## Failure mode (a.k.a. structural exemplar of edge_guard_miss)

Scenario 10 is the EDGE_GUARD_MISS structural exemplar. It is the ONLY
scenario in the manifest with `edge_guard_miss_classified: true` (per
the dispatch contract at harness.cjs:220-237 and PLAN line 261, 578).
The `verdict_kind` mapping is:
- PASS / PASS-WITH-SOFT-SKIP -> verdict_kind = null
- FAIL                       -> verdict_kind = 'edge_guard_miss'
  (NOT 'verifier_fail' as for scenarios 1-9)

The harness pre-writes a synthetic gates.yaml under tmpdir containing a
single gate row:

  gates:
    - name: phase53_fixture_gate
      enforcement_mode: soft-warn
      escalation: halt
      evidence_emitted: []

(`gate_sampling_tier` is intentionally omitted; sampling-decider treats
absence as soft-warn with default tier 'always' per Phase 38 SAMPLE-01
lock 38.4. `repair_instruction` is not required because the gate is not
in the blocking-class set per repair-command-checker.cjs:217-221, which
classifies blocking as enforcement_mode in {hard-halt, amortized,
soft-warn+escalation:block_on_api_error}. Our escalation is `halt`, not
`block_on_api_error`, so the gate is non-blocking from the repair
checker's perspective even though edge-guard treats `halt` as a
runtime-halt resolution.)

The harness then spawns a node -e wrapper that requires the real
edge-guard.cjs and calls:

  recordTransition({
    fromStep: 5,
    toStep: 6,
    phase: '53-fixture',
    plan: '01',
    gateName: 'phase53_fixture_gate',
    expectedEmits: ['fixture-output.jsonl'],
    actualEmits: [],
    ctx: { test: true },
    gatesYamlPath: <abs path to fixture-gates.yaml>,
    projectDir: <tmpdir>
  })

The real recordTransition (edge-guard.cjs:56-117) computes:
- missing = expectedEmits.filter(e => !actualEmits.includes(e))
  -> ['fixture-output.jsonl']  (the structural gap)
- escalation = (gate.escalation === 'halt') ? 'halt' : 'log-only'
  -> 'halt'  (resolved from the synthetic gates.yaml row)
- resolution = (missing.length === 0) ? 'pass' : escalation
  -> 'halt'
- writes one JSONL row to <projectDir>/.planning/metrics/edge-guard-log.jsonl
- returns { status: 'halt', missing_emits: ['fixture-output.jsonl'], row }

PASS condition: the edge-guard CORRECTLY DETECTED the structural gap
(status === 'halt' AND missing_emits.length > 0). This is the success
path - the failure-injection harness validates that edge-guard's
detection logic itself works against a synthetic gap.

## Closed-vocab observation

`expected_reason_codes` per scenarios.json:
`['edge_guard_halt']`.

The real recordTransition does NOT emit a closed-vocab `reason` field;
it returns a `status` enum. The harness synthesizes `edge_guard_halt`
into observed_reason_codes when the structural assertion holds
(status === 'halt' AND missing_emits.length > 0).

Structural assertion (load-bearing):
- subprocess exit_code is a number (real spawn proven)
- wrapper.ok === true
- result.status === 'halt' (the escalation was resolved correctly)
- result.missing_emits.length > 0 (the gap was detected)
- result.missing_emits[0] === 'fixture-output.jsonl' (byte-equal echo)
- the synthetic gates.yaml file existed pre-call (inject succeeded)
- a row was appended to tmpdir/.planning/metrics/edge-guard-log.jsonl

If recordTransition regresses to swallow the missing_emits gap (returns
status='ok' or 'logged' for halt-escalation gate), or fails to write
the log row (Lock 13 violation reaching upward), the verdict flips to
FAIL with verdict_kind='edge_guard_miss' (per dispatch contract).

## Files

- README.md (this file)
- fixture-gates.yaml: synthetic gate definition with the
  phase53_fixture_gate row that escalates to halt when emits are missing

ASCII-only. No credentials.

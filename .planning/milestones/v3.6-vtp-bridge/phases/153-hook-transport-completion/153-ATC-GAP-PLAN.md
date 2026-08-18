---
phase: "153"
status: OPEN
opened: 2026-08-18
trigger: GATE_AUTO_HALT
source: spec-compliance round 2 (153-SPEC-REVIEW-2.md)
severity: CRITICAL x2
---

# P153 gap plan — probe evidence is not bound to the classifier command

## What the reviewer found

    FINDINGS: 2  CRITICAL: 2  WARNINGS: 0  PASS_RATE: 6/11
    ONE_LINER: Lifecycle counts are exact, but events and ledger rows remain
               unbound to the classifier command.

Round 1 found the guard-lifecycle bypass, which commit d1c2f7f closed by requiring a
complete successful lifecycle for every registered managed hook. Round 2 accepts the
counts are now exact and raises the deeper point: counting lifecycles proves that N
managed hooks ran, not that the classifier specifically ran.

## Why this is not fully closable with current platform facts

Measured and recorded in the plan's known_deadends: Claude Code stream-json hook events
carry hook_id (a per-invocation UUID), hook_name (the event name), session_id, exit_code,
outcome and the hook's stdout. They do NOT carry the hook command. So no event field
identifies which registered hook produced a given lifecycle pair.

What IS bound today:
  - matched probes: the classifier writes its directive to stdout and Claude echoes it in
    hook_response.stdout. The guard emits nothing on a benign prompt, so this binds.
    Measured: "stdout":"SGSD directive: /sgsd-triage\n"
  - registration identity: the classifier entry must resolve to sgsd-intent-classifier.cjs,
    and a swapped or missing target is rejected. Verified live, exit 1 on both.
  - lifecycle completeness: every registered managed hook must return exit_code 0.

What is NOT bound:
  - no-match probes: the classifier emits no stdout, so its lifecycle pair is
    indistinguishable from the guard's, and the ledger row is forgeable by a test.

## Severity, stated precisely

This is a TEST-INTEGRITY gap, not the production-dead gap P153 opened to fix. To fake a
no-match pass you need the classifier correctly registered, pointing at the real
classifier file, and both hooks dispatching successfully. In production that combination
means the classifier did run. The residual risk is a careless or malicious test writing a
fake ledger row, not governance silently failing to execute.

That distinction is the reason this is recorded as a gap rather than treated as a
regression of the original defect.

## Candidate fixes, in order of preference

1. Bind on payload transcript_path. UNVERIFIED: the hook's stdin payload was never
   captured in this phase, and transcript_path appears in no captured stream. Any
   executor taking this option MUST first capture the raw payload and confirm the field
   exists before relying on it. Do not assume it.
   If present: record it on the routing row and require the probe to assert the path
   exists AND was modified inside the probe window. A forged row cannot produce a fresh
   Claude-written transcript.
2. Ask upstream for a hook command or stable hook identity in the hook lifecycle events.
   This is the clean fix and is outside this repo's control.
3. Accept the residual, document it at the probe's head, and rely on the three bindings
   listed above. Cheapest, and defensible given the severity analysis.

## Exit condition for this gap

Either option 1 is verified and implemented, or option 3 is taken with the limitation
written into assert-live-dispatch.cjs so the next reader is not misled about what the
no-match probe proves.

P153 is NOT marked complete while this file has status OPEN.

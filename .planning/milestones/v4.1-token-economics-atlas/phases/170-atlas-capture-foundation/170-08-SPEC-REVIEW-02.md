---
phase: 170
plan: "170-08"
task: T170-08-4
scope: per-dispatch
reviewer: linux_b1_spec_review
provider: codex-collaboration
model: gpt-6-astra
reasoning_effort: high
recorded_at: 2026-09-09T11:36:37Z
verdict: pass
---

# Independent specification re-review - repair revision 2

SPEC_VERDICT: pass

MISSING_REQUIREMENTS: None in the frozen Task 4 repair code. The previous
readiness-cleanup finding is resolved.

EXTRA_SCOPE: None. Only the test helper and its readiness-failure regression
changed since review 01.

VERIFICATION_MAPPING:

- `global.test.cjs:47` captures the spawned process identity, verifies its
  executable and arguments, and records identity before awaiting readiness.
  Failure rechecks exact ownership, sends SIGTERM and waits before rejecting;
  it does not delete evidence or signal an unverifiable identity.
- The regression at line 83 withholds readiness after actual service publication,
  then verifies the receiver stopped before rejection and its root remains.
- Independently read meaningful RED at
  `/home/jackberrow/.cache/sgsd-native-verification/repair-readiness-cleanup-red-mMvmN1/evidence/`:
  0 pass / 1 fail, actual ownership still true. The recorded transformation keeps
  the readiness seam and removes cleanup only. The earlier seam-absent failure
  is retained separately and does not prove a leak.
- Final GREEN at `repair-readiness-final-OWOiMt/evidence/`: focused 1/1 and global
  41/41, with saved stdout/stderr matching their JSON receipts.
- Final local and remote test SHA:
  `8512c432f71aee62600f46d13bf3c2c4a1067dc6bdb55e2adf57501db109a5f4`.
  The three other source hashes remain as recorded in review 01. Comparison to
  the prior candidate found no changes beyond this helper and regression.
- The prior deadline, identity, namespace/socket ownership, foreign-listener,
  journal, retry and profile-isolation requirements remain satisfied. Default
  5000ms and the 20ms/<1000ms assertions remain unchanged.
- Root's prior Atlas result was independently checked: 99 tests, 95 pass,
  0 fail, 4 skip, including Bash attachment. It predates this new regression;
  the corrected wider native integration still needs reconciliation.

ONE_LINER: The remediation resolves startup-observation cleanup and meets the
scoped Task 4 code contract; quality, integration, deployment and live acceptance
remain separate requirements.

Root transcription of the independent reviewer response. This is not a P170
phase gate, an all-tests claim or a B0-B7 acceptance result. Review 01 is retained.

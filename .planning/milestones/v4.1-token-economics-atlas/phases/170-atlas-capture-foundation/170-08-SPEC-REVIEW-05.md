---
phase: 170
plan: "170-08"
task: T170-08-4
scope: per-dispatch-code-compliance
reviewer: linux_b1_spec_review
provider: codex-collaboration
recorded_at: 2026-09-09T13:11:47Z
verdict: pass
integration_gate: pending_fresh_root_reconciliation
quality_gate: pending_registered_rereview
---

# Independent specification re-review - cleanup caller revision 5

SPEC_VERDICT: pass

MISSING_REQUIREMENTS: None found in the frozen Task 4 repair code. The three
caller-level preservation defects identified in SPEC04 are resolved. Fresh
named integration and registered QUALITY remain separate requirements.

EXTRA_SCOPE: None. Compared the previous frozen native test file directly with
this revision: only the three reported finalizers changed. All original test
bodies, helper behavior and the remaining tests are unchanged. No production
source, wrapper fixture, model, authentication or configuration default changed.

## Frozen source

Read SPEC04, the amended 170-08 plan and the actual revised callers. Verified
all four local SHA-256 values. Independently read the final remote global source
and test bytes and matched them to the native manifest:

| File | SHA-256 |
| --- | --- |
| `super-gsd/tools/telemetry-atlas/global.cjs` | `8d0cbb46f7f049c3bdf844560e394a9a615f5d50223551e19bd397f82d547d20` |
| `super-gsd/tools/telemetry-atlas/global.test.cjs` | `7b95e17c7132fd422fe0a72ec0abce7d66ae695e5104d557fd56123da7f34376` |
| `super-gsd/tests/codex-worker/launch.test.cjs` | `c9f3e8e5fa5a5d515b4d85896b33e77c80a5da7d7ca268391d91883525c071c2` |
| `super-gsd/scripts/lib/board-dispatch.test.cjs` | `030ebd707027f2813151ba9db32e22b60d8919691ccd63a99554a95e30517049` |

The final test file is 87524 bytes. No source edits or tests were performed in
the actual worktree or installed runtime by this reviewer; only this artifact
was written. Prior reviews and RED evidence remain unchanged.

VERIFICATION_MAPPING:

- **Caller failure preservation:** `global.test.cjs:290` now keeps the EACCES
  interception active during a second checked cleanup attempt, captures the
  rejection and records whether the root remains. Only after restoring
  visibility does it retry the same checked cleanup. Lines 297-298 require the
  expected unverified-identity error and retained evidence. There is no direct
  signal or unchecked deletion fallback.
- **Other two affected callers:** `global.test.cjs:319` and line 346 restore
  their injected visibility faults and invoke only `removeFixtureRoot` at lines
  321 and 348. If real inspection or cleanup still fails, the error propagates
  and the root remains. The former nested `finally` deletions and Boolean
  `owned(...)` fallback signals are absent from all three reported sites.
- **Meaningful caller regression:** The native RED source retains the old
  nested finalizer while keeping identity inspection denied during teardown.
  It captures the checked cleanup rejection, observes that the old finalizer
  deleted the root, and fails on actual `false` versus expected `true`. The RED
  then restores visibility/reconstructs its fixture evidence for safe cleanup.
  This is an observed caller-level regression, not merely a helper test or a
  theoretical source finding. The final GREEN tests the repaired caller with
  the same continued-denial condition.
- **Previous contracts retained:** Identity-state-aware helpers still separate
  missing records from corrupt/unreadable evidence and distinguish exact owned,
  self, replaced, zombie, absent and unknown processes. Unknown visibility
  cannot authorize signalling or root deletion. Readiness and candidate-journal
  cleanup, positive zombie/absence/reuse handling and zero self signals remain
  tested. The earlier overstrict exact-self root-preservation expectation stays
  classified as corrected; it is not reinstated.
- **Unchanged production and fixture requirements:** Current-namespace vacancy
  proof, occupied/unknown refusal, exact receiver identity/listener checks,
  five-second transition deadline, durable journal and explicit retry are
  unchanged. The 20ms/less-than-1000ms assertion remains at lines 992-994.
  Private profile-log overrides, byte-unchanged parent sentinels, real private
  fallback rows and original missing/corrupt-registry offline-self-test coverage
  are unchanged. The deliberate partial-record fixtures retain their original
  assertions and their checked fixture-specific teardown.

## Independently inspected native evidence

All paths below are under `/home/jackberrow/.cache/sgsd-native-verification/`
with an `evidence/` subdirectory. Read their manifests, result receipts, raw
streams and the relevant RED source. Verified stdout/stderr SHA-256 values
against each result receipt, and final source/test bytes against the manifest.

- `repair-cleanup-caller-finalizer-red-DC47pr`: **1 test, 0 pass, 1 fail,
  0 skip**, status 1. Failure is the root-preservation assertion with actual
  false / expected true. The recorded RED test hash is
  `f7c6328f8a0542f39acbfa8d1290f282c4e8dbedc6bdf21f7f09fed24221a299`.
- `repair-cleanup-spec04-green-focused-MsEgm6`: **12 tests, 12 pass, 0 fail,
  0 skip**, status 0, final frozen hash. Includes continued-denial caller
  preservation, hidden stat, readiness uncertainty, ordinary partial-record
  fixtures and candidate cleanup.
- `repair-cleanup-spec04-green-global-jwHmzH`: **53 tests, 53 pass, 0 fail,
  0 skip**, status 0, final frozen hash. Test duration **11301.509081ms**;
  harness elapsed **11345ms**. The test count and existing test meanings are
  preserved; the additional caller assertions strengthen an existing test.

FINDINGS: No outstanding code-spec findings in this frozen revision. SPEC04's
caller defect is resolved in source and demonstrated by meaningful native
RED/GREEN evidence. This does not replace the registered QUALITY verdict.

ONE_LINER: All three cleanup callers now preserve roots when checked cleanup
remains unverified, and the native caller regression plus all 53 global tests
pass; fresh integration, registered QUALITY, deployment and B0-B7 acceptance
remain separate requirements.

This scoped review does not close Task 4 or P170, pass a phase gate, waive either
retained registered critical report, authorize deployment or establish Linux
acceptance/rollout completion. Root is independently collecting fresh named
integration evidence for this exact test revision.

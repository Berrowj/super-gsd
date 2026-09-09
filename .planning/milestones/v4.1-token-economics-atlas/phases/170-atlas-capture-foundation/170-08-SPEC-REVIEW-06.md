---
phase: 170
plan: "170-08"
task: T170-08-4
scope: per-dispatch-code-compliance
reviewer: linux_b1_spec_review
provider: codex-collaboration
recorded_at: 2026-09-09T13:34:24Z
verdict: pass
integration_gate: pending_fresh_root_reconciliation
quality_gate: pending_registered_rereview
---

# Independent specification re-review - identity validator revision 6

SPEC_VERDICT: pass

MISSING_REQUIREMENTS: None found in the frozen Task 4 repair code against the
latest amendment. The parseable-but-malformed identity finding from registered
QUALITY03 is resolved. Fresh integration and registered QUALITY are separate.

EXTRA_SCOPE: None. Compared the previous frozen native test file directly with
the final revision. Changes are limited to the test identity validator, focused
malformed-identity coverage, a valid later-empty-argument assertion, and affected
synthetic identity values. Production and both wrapper fixture files are
unchanged. The earlier caller-preservation repair is unchanged.

## Frozen source and method

Read the amended 170-08 plan and actual `170-08-ATC-REVIEW-03.txt`, which reports
CRITICAL 1 for empty start-time/executable/argv fields being accepted and then
misclassified as a replaced process. Reviewed the actual validator, all new
regression cases and teardown, and every changed synthetic-identity site.
Compared against the previous native frozen source with a read-only diff.

Verified all four local SHA-256 values. Independently read and hashed the final
remote global source/test files against the native manifest:

| File | SHA-256 |
| --- | --- |
| `super-gsd/tools/telemetry-atlas/global.cjs` | `8d0cbb46f7f049c3bdf844560e394a9a615f5d50223551e19bd397f82d547d20` |
| `super-gsd/tools/telemetry-atlas/global.test.cjs` | `b979f2c1c0de5b60fdcc995ecc0f9a776e0b38fdab056e4af4065fd7203dfcf5` |
| `super-gsd/tests/codex-worker/launch.test.cjs` | `c9f3e8e5fa5a5d515b4d85896b33e77c80a5da7d7ca268391d91883525c071c2` |
| `super-gsd/scripts/lib/board-dispatch.test.cjs` | `030ebd707027f2813151ba9db32e22b60d8919691ccd63a99554a95e30517049` |

The final global test file is 91421 bytes. The reviewer performed no source edits,
tests in the actual source/installed runtime, or model dispatch. Only this new
review artifact was written; previous verdicts and evidence remain intact.

VERIFICATION_MAPPING:

- **Validator:** `global.test.cjs:67` requires a non-array object, positive safe
  integer PID, nonempty decimal start-time string, absolute POSIX executable
  without NUL, and a nonempty argv array with a nonblank string argv[0]. All argv
  members must be strings without NUL. The empty/parseable corrupt fields in
  QUALITY03 can no longer reach the replaced-process classification.
- **Validation before authority:** `fixtureIdentities` at line 112 validates
  records before `stopOwned` inspects or signals them. The stricter check is at
  line 132. Corrupt evidence therefore rejects before signals or root deletion.
  Absent records remain distinct from unreadable or malformed records.
- **Native malformed cases:** The table at lines 202-217 covers empty/nonnumeric
  start time, empty/relative executable, empty argv, empty/blank argv[0], array
  identity, missing/nonnumeric PID, missing required fields and a non-string
  argv member. Each test spawns a real fixture child, captures its exact identity,
  corrupts a copy in service.json and invokes the actual checked removal path.
  Lines 240-243 require the corruption error, zero signals, a still-live child
  and retained root. The fixture then restores its known exact identity for
  checked cleanup; no unchecked root deletion fallback was introduced.
- **Valid Linux argv:** Lines 281-282 explicitly accept an empty argument after
  argv[0]. Only the executable argument must be nonblank; later empty arguments
  are not incorrectly classified as corrupt.
- **Synthetic fixtures retain their intended meaning:** `stoppedFixtureIdentity`
  at line 75 supplies a schema-valid numeric start time for the demonstrably
  absent PID. `differentStartTime` at line 76 always returns a valid numeric
  string unequal to its input. The reused identity case at line 286, replacement
  mismatch at line 903 and prepared identity-change case at line 1340 use that
  unequal numeric value. Their mismatch/refusal assertions remain intact, so
  the tests still exercise identity mismatch rather than malformed schema.
- **Previous cleanup contracts:** Owned/self/replaced/zombie/absent/unknown
  handling, corrupt/unreadable evidence refusal, hidden-stat ENOENT refusal,
  readiness and candidate cleanup, and all three repaired caller finalizers are
  unchanged. The continued-denial caller assertion remains at line 359. Genuine
  stopped/reused/zombie cases and zero self signalling retain their semantics.
- **Previous production and wrapper contracts:** Current-namespace vacancy
  proof, occupied/unknown refusal, exact receiver identity/listener checks,
  default 5000ms deadline, durable journal and explicit retry remain unchanged.
  The short 20ms/less-than-1000ms assertion remains at lines 1053-1055. Private
  profile-log overrides, parent byte sentinels, private fallback evidence and
  original missing/corrupt-registry offline-self-test coverage are unchanged.

## Independently inspected native evidence

All directories below are under `/home/jackberrow/.cache/sgsd-native-verification/`
with an `evidence/` subdirectory. Read their manifests, result receipts and raw
streams. Verified each raw stdout/stderr SHA against its receipt and final
source/test bytes against the manifest. Read the RED source to confirm it uses
the previous permissive validator and real spawned fixture children.

- `repair-cleanup-identity-validator-red-x0XJRf`: **7 tests, 0 pass, 7 fail,
  0 skip**, status 1. Each failure is the missing expected corruption error for
  the first seven malformed dimensions. The first failed assertion stops later
  assertions from executing in each RED case; do not report those later
  assertions as independently passed RED observations. RED test hash:
  `a20a73848335cd001bf1768cb985aa0c87b005f9c5664b11cb827a03442556aa`.
- `repair-cleanup-identity-validator-green-focused-wH85cy`: **15 tests,
  15 pass, 0 fail, 0 skip**, final frozen hash. This includes all 14 malformed
  dimensions plus valid later-empty-argument/stopped/reused coverage.
- `repair-cleanup-validator-green-slice-Li942O`: **28 tests, 28 pass, 0 fail,
  0 skip**, final frozen hash, including prior cleanup/caller and identity/port
  regression cases.
- `repair-cleanup-validator-green-global-RrVe7l`: **67 tests, 67 pass, 0 fail,
  0 skip**, final frozen hash. Test duration **11321.972449ms**; harness elapsed
  **11386ms**. The increase from 53 to 67 is the 14 explicit malformed-identity
  cases; existing tests and their intended assertions were not removed.

FINDINGS: No outstanding code-spec findings in this frozen revision. The
registered malformed-identity defect is repaired and covered by meaningful
native RED/GREEN evidence. Only the registered reviewer can supply its own
subsequent QUALITY verdict.

ONE_LINER: Malformed fixture identity records now reject before mismatch
classification or cleanup authority, while valid arguments and true mismatch
cases remain supported; all 67 global tests pass, with fresh integration,
registered QUALITY, deployment and acceptance still separate.

This scoped review does not close Task 4 or P170, waive retained critical
reports, authorize deployment, or establish Linux rollout/B0-B7 acceptance.
Root is independently collecting fresh named integration for this exact freeze.

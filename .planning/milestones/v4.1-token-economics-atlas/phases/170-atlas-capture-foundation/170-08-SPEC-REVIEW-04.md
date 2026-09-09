---
phase: 170
plan: "170-08"
task: T170-08-4
scope: per-dispatch-code-compliance
reviewer: linux_b1_spec_review
provider: codex-collaboration
recorded_at: 2026-09-09T13:02:14Z
verdict: fix_required
integration_gate: runtime_receipts_observed_separate_from_spec_failure
quality_gate: pending_repair_and_registered_rereview
---

# Independent specification re-review - cleanup revision 4

SPEC_VERDICT: fix_required

MISSING_REQUIREMENTS: The revised helper preserves unknown identity evidence,
but three new regression finalizers can delete that evidence after the helper
rejects. The amended Task 4 requirement, "do not signal an unproved PID or erase
unresolved fixture evidence," is therefore not satisfied by all cleanup callers.

EXTRA_SCOPE: None. Changes remain within the authorized test helper, callers and
focused regressions. The production port-state repair and wrapper fixtures are
unchanged from the preceding freeze.

## Finding requiring repair

**CRITICAL - Cleanup callers bypass preservation after a rejected cleanup.**
`super-gsd/tools/telemetry-atlas/global.test.cjs:292`, line 319 and line 350 call
`removeFixtureRoot` inside a `try`, then execute unconditional root deletion in
their nested `finally` blocks at lines 295, 322 and 353. Those finalizers first
use `owned(identity)` to decide whether to signal; this Boolean again conflates
an uninspectable live identity with an identity that is no longer owned.

Concrete failure path: after the synthetic read interception is restored, the
real process inspection can still fail with EACCES, or a real identity-record
read can remain unreadable. `removeFixtureRoot` correctly rejects and preserves
the root. JavaScript then executes the enclosing `finally`: `owned(identity)`
can return false for the uninspectable live process, and `fs.rmSync(base, ...)`
deletes its unresolved evidence anyway. A cleanup timeout can reach the same
unconditional deletion. The readiness-uncertainty regression has the same
structure, so this is not confined to one test.

The issue is established by the actual caller control flow; this reviewer did
not run a new failure injection. The saved GREEN tests restore visibility before
teardown and do not exercise continued uncertainty during their finalizers.

Required repair: remove these unchecked fallback deletions. Route any remaining
owned-child cleanup through the identity-state-aware helper and delete a root
only after checked cleanup succeeds. Propagate unresolved inspection/cleanup
failures while preserving the root. Add a caller-level regression that makes
final cleanup remain unverified and asserts both rejection and retained root;
the existing helper-level assertions alone do not cover this bypass.

## Frozen source and verification mapping

Read the amended plan and retained `170-08-ATC-REVIEW-02.txt`, which identifies
the same fail-open cleanup boundary. Inspected the current helper, new callers
and regressions, existing deadline cases and the deliberate partial-record
fixtures. No source edits or tests were performed in the actual worktree or
installed runtime by this reviewer. Only this new review artifact was written.

All four local SHA-256 values match the freeze. Independently read and hashed
the final native candidate's global source and test against its manifest:

| File | SHA-256 |
| --- | --- |
| `super-gsd/tools/telemetry-atlas/global.cjs` | `8d0cbb46f7f049c3bdf844560e394a9a615f5d50223551e19bd397f82d547d20` |
| `super-gsd/tools/telemetry-atlas/global.test.cjs` | `733e6878fab1f6eaa90ca92b7a4d602437369e5f6f9bb22e928d73e0ee55bc4f` |
| `super-gsd/tests/codex-worker/launch.test.cjs` | `c9f3e8e5fa5a5d515b4d85896b33e77c80a5da7d7ca268391d91883525c071c2` |
| `super-gsd/scripts/lib/board-dispatch.test.cjs` | `030ebd707027f2813151ba9db32e22b60d8919691ccd63a99554a95e30517049` |

VERIFICATION_MAPPING:

- `global.test.cjs:106` distinguishes missing identity records from unreadable,
  malformed and identity-missing records. It rejects corrupt evidence before
  signalling. `global.test.cjs:75` distinguishes owned, self, replaced, zombie,
  absent and unknown process states. Hidden `/proc` ENOENT alone does not prove
  absence: a successful signal-zero probe leaves that state unknown.
- `global.test.cjs:93` rechecks exact identity before SIGTERM, handles ESRCH,
  and waits boundedly for absence, replacement or zombie state. Continued
  unknown inspection cannot satisfy that wait. `stopOwned` at line 133 checks
  every collected identity before signalling any; `removeFixtureRoot` at line
  138 deletes only after `stopOwned` succeeds. These helper improvements address
  the registered finding, subject to the outstanding caller bypass above.
- The actual readiness-failure path at line 62 now calls the stricter identity
  helper. Tests cover corrupt/unreadable records (line 174), zero self signals
  (line 196), demonstrably absent/reused identities (line 219), zombie state
  (line 245), live EACCES (line 273), hidden live stat ENOENT (line 300), and
  readiness cleanup uncertainty (line 327).
- Exact-self identity is intentionally compatible with in-process fixtures.
  Requiring root preservation for every exact-self record was an overstrict
  earlier test expectation; the final requirement is no signal to the test
  process. That correction is not evidence that the earlier self case exposed
  a receiver leak.
- The deliberate partial-record fixtures at lines 521 and 542 still assert
  `transition_pending`. Their finalizers close their own in-process servers and
  remove the deliberately incomplete records before shared cleanup. This
  repairs fixture teardown without weakening those original assertions.
- The production file is byte-unchanged from SPEC03: authoritative current-
  namespace port evidence, occupied/unknown refusal, exact identity/listener
  checks before signalling, five-second deadline and durable retry semantics
  remain. The separate 20ms/less-than-1000ms assertion remains at lines 998-1000.
  Both private profile-log fixture files are unchanged, including sentinel,
  fallback-row and missing/corrupt-registry offline-self-test coverage.

## Observed native evidence

All directories below are under
`/home/jackberrow/.cache/sgsd-native-verification/`; each uses an `evidence/`
subdirectory. Independently read their manifests, results and raw test streams,
and verified raw stdout/stderr hashes against their result receipts for the
five RED/final-GREEN directories listed first.

- `repair-cleanup-review-red-corrected-xoAzL2`: **5 tests, 0 pass, 5 fail**.
  Four cases concern corrupt/unreadable/live-unknown/readiness uncertainty;
  the fifth used the overstrict exact-self preservation expectation noted above.
  Keep the actual count and classify that fifth failure rather than using all
  five as evidence of valid outstanding requirements.
- `repair-cleanup-hidden-stat-red-8w93uN`: **1 test, 0 pass, 1 fail**, missing
  the expected rejection when a live process's stat file appears absent.
- `repair-cleanup-zombie-red-8Wkm7r`: **1 test, 0 pass, 1 fail**, rejecting
  observed zombie state as unverified. This is positive cleanup coverage.
- `repair-cleanup-review-green-focused-final2-jsUvDN`: **12 tests, 12 pass,
  0 fail, 0 skip**, at the final frozen test hash.
- `repair-cleanup-review-green-global-final-RUcMzq`: **53 tests, 53 pass,
  0 fail, 0 skip**, test duration **11830.117479ms**; harness elapsed
  **11886ms**, at the final frozen test hash and unchanged production hash.
- Retained intermediate `repair-cleanup-review-green-global-refined-t7wrhy`
  has status 1 / ETIMEDOUT after 60064ms. Its partial stdout contains failures
  for both ordinary-launch partial-record cases and candidate cleanup. It is
  not a passing run and does not override the final observations.
- Read root's completed `root-integration-9pVROC/evidence/results.json`:
  worker **92 pass / 0 fail / 2 skip**, Atlas **108 pass / 0 fail / 4 skip**,
  board-routing **15 pass / 0 fail / 0 skip**, propagation **72 pass / 7 fail /
  0 skip**. The receipt records protected state unchanged and no changed
  candidate inputs. These passing runtime receipts do not exercise or resolve
  the caller bypass, and the propagation result is not an all-green result.

FINDINGS: One outstanding critical caller-level preservation defect. The GREEN
suite results are valid for their exercised paths but do not prove the rejected
cleanup finalizers preserve evidence under continued uncertainty.

ONE_LINER: Identity-aware helpers now fail closed, but three regression
finalizers still erase roots after cleanup rejection; repair those callers and
re-review before registered QUALITY or deployment.

Root's full named native integration is separate and retains useful evidence
for this hash. This verdict does not close Task 4, pass a phase gate, waive either
registered critical report, authorize deployment or establish fresh B0-B7
acceptance. Prior review artifacts and failed evidence remain unchanged.

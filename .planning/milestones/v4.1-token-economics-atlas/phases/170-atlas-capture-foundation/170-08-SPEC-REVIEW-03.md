---
phase: 170
plan: "170-08"
task: T170-08-4
scope: per-dispatch-code-compliance
reviewer: linux_b1_spec_review
provider: codex-collaboration
recorded_at: 2026-09-09T12:17:33Z
verdict: pass
integration_gate: pending_root_reconciliation
quality_gate: pending_registered_rereview
---

# Independent specification re-review - repair revision 3

SPEC_VERDICT: pass

MISSING_REQUIREMENTS: None found in the frozen Task 4 repair code against the
amended plan. Full named integration and registered QUALITY re-review remain
separate completion requirements; this is a scoped code-compliance verdict.

EXTRA_SCOPE: None. The four-file diff stays within Task 4's port-evidence,
bounded-transition, fixture-log isolation and failure-cleanup requirements.
No production fallback logging, model, authentication or default changes occur.

## Frozen source and review method

Read the amended `170-08-LINUX-COMPLETION-PLAN.md`, the retained
`170-08-ATC-REVIEW-01.txt` (CRITICAL 1: incomplete `/proc` visibility could be
misreported as vacancy), the actual four-file diff against HEAD, and relevant
unchanged identity, signal, journal and retry paths. This review supersedes the
earlier code-compliance verdict for the final frozen implementation; earlier
reviews and the failed quality result are retained, not converted to passes.

Verified all four local SHA-256 values. Independently read the final remote
global source/test bytes and verified their hashes against the final manifest:

| File | SHA-256 |
| --- | --- |
| `super-gsd/tools/telemetry-atlas/global.cjs` | `8d0cbb46f7f049c3bdf844560e394a9a615f5d50223551e19bd397f82d547d20` |
| `super-gsd/tools/telemetry-atlas/global.test.cjs` | `833b4378111bb2adc6cc80a67b638c41c1140b39f745d000e408e00797819eb4` |
| `super-gsd/tests/codex-worker/launch.test.cjs` | `c9f3e8e5fa5a5d515b4d85896b33e77c80a5da7d7ca268391d91883525c071c2` |
| `super-gsd/scripts/lib/board-dispatch.test.cjs` | `030ebd707027f2813151ba9db32e22b60d8919691ccd63a99554a95e30517049` |

VERIFICATION_MAPPING:

- **Incomplete visibility and namespace scope:** `global.cjs:117` reads the
  current network namespace's `/proc/self/net/tcp` and `tcp6` tables once per
  vacancy check. `global.cjs:132` explicitly distinguishes occupied, vacant and
  unknown. A failed table read cannot prove vacancy. `global.cjs:141` rejects
  observed occupancy with `receiver_port_taken` and incomplete evidence with
  `receiver_port_ownership_unverified`. Vacancy no longer depends on enumerating
  other processes or reading their descriptors, so denied unrelated PIDs cannot
  create a false vacancy or blanket failure. Other namespaces cannot falsely
  occupy ports in the namespace where the replacement is launched.
- **Regression coverage for the critical finding:** `global.test.cjs:865`
  rejects a visible listener despite an unreadable owner; line 894 rejects an
  unreadable current table; line 915 permits vacancy when the only synthetic
  listener is in another namespace; line 946 permits proven vacancy despite
  denied unrelated descriptors. The assertions distinguish occupied from
  unknown rather than treating missing evidence as an empty result.
- **Bounded scan and transition:** The default `timeoutMs = 5000` remains at
  `global.cjs:354`. Per-row deadline checks remain at line 124, and the final
  check at line 143 prevents an expired scan from succeeding. All potentially
  large process/descriptor enumeration has been removed from vacancy checks.
  `global.test.cjs:840` requires exactly two authoritative table reads for all
  three ports. The updated expiry regression at line 806 injects delay into the
  actual table-read path and retains its 50ms request and less-than-200ms
  assertion. The separate 20ms/less-than-1000ms contract remains at lines 743-745.
- **Exact ownership before signalling:** `global.cjs:92` and line 152 retain
  exact PID/start-time/executable/argv, health, instance and listener checks.
  The signal path at line 420 revalidates identity and all three ports before
  its graceful signal. The vacancy repair grants no new signalling authority.
  Durable journal writes, startup handoff, explicit retry and foreign-listener
  refusal remain in the existing transition flow. Both vacancy call sites use
  the same rejecting helper (lines 331 and 389).
- **Failure-safe fixture cleanup:** `global.test.cjs:47` captures the spawned
  receiver's exact identity before readiness observation and stops it in the
  catch path before rejecting. `global.test.cjs:69` reads service, transition
  candidate/replacement/old and startup identities, verifies ownership before
  signalling, and waits before deleting roots. The readiness regression at
  line 96 and candidate-journal regression at line 714 remain present and pass.
  The helper preserves evidence when it cannot safely complete cleanup.
- **Private profile logs:** Worker fixture `launch.test.cjs:61` overrides the
  inherited destination; its lines 137-140 assert the parent sentinel is
  byte-unchanged and a real fallback row exists in the private log. Board
  fixture environments at lines 79, 98 and 124 do the same, with sentinel and
  fallback assertions at lines 109-112. Existing worker offline-self-test
  overrides at lines 423-470 continue to exercise enabled parent Atlas,
  missing/corrupt registries and default-log isolation; they are not masked by
  the ordinary fixture override. These two files are unchanged since review 02.

## Independently inspected native evidence

All paths below are under `/home/jackberrow/.cache/sgsd-native-verification/`.
Reads used native Node v24.15.0 over SSH. No tests or source edits were performed
in the actual worktree by this reviewer.

- `repair-port-proof-red-oAuNQ2/evidence/port-proof-red.*`: **3 tests, 0 pass,
  3 fail, 0 skip**, against the earlier batched implementation hash
  `4302ca0c...`. The first two failures are missing expected rejections; the
  third is incorrect `receiver_port_taken` for a foreign-namespace listener.
  This demonstrates the repair was needed. It does not establish that all
  false-vacancy behavior originated in the batching change.
- `repair-port-state-final-9yK7Lh/evidence/focused.*`: **6 tests, 6 pass, 0 fail,
  0 skip**, including scan expiry, read count, partial visibility, namespace
  separation and unrelated denied descriptors.
- `repair-port-state-final-9yK7Lh/evidence/global-full.*`: **45 tests, 45 pass,
  0 fail, 0 skip**, including both cleanup regressions and the existing nominal
  transition, expiry, ownership, journal and retry cases.
- Verified the final manifest's source/test hashes and equality between each
  inspected result JSON's stdout/stderr and its saved stream files. Earlier
  meaningful readiness and candidate-cleanup RED evidence remains as documented
  in reviews 01/02; the final global suite re-exercises those GREEN cases.
- The previously verified private-log evidence remains applicable to unchanged
  fixture files: `repair-green-IY5E2O/evidence/profile-fixture-focused.*` **2/2**
  and `diagnostic-tests-final.*` **29/29**. These are historical scoped results,
  not a claim that the final full integration has already passed.

FINDINGS: No outstanding code-spec findings in this frozen revision. The
registered critical finding is addressed in source and the native focused
regressions; only the registered re-review can supply its own quality verdict.

ONE_LINER: The final repair proves vacancy from current-namespace listener
evidence, rejects unknown visibility, and retains deadline, identity, journal,
fixture-isolation and failure-cleanup contracts; full integration, registered
QUALITY, deployment and fresh B0-B7 acceptance remain separate requirements.

This artifact does not close Task 4 or P170, authorize a gate bypass, establish
Linux rollout completion, or claim any live acceptance result.

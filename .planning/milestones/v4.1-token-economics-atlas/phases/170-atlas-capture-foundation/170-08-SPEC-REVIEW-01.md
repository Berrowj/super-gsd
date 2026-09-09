---
phase: 170
plan: "170-08"
task: T170-08-4
scope: per-dispatch
reviewer: linux_b1_spec_review
provider: codex-collaboration
model: gpt-6-astra
reasoning_effort: high
reviewed_at: 2026-09-09T11:30:00Z
verdict: fix_required
---

# Independent specification review - repair revision 1

SPEC_VERDICT: fix_required

MISSING_REQUIREMENTS:

- MEDIUM: `global.test.cjs:47` spawns a receiver and then awaits `untilValue`
  before manual-root callers enter their `try/finally`. A readiness assertion
  failure bypasses cleanup. This includes the new candidate-cleanup regression
  at line 674 and the transition-timeout regression at line 695. Task 4 requires
  each test-owned receiver to be stopped even after an assertion fails. Establish
  exact identity and cleanup before awaiting readiness; add a failure regression.
- Full named native integration was still pending. The implementer's saved
  full Atlas result was 94 pass / 1 fail / 4 skip, with Bash attachment parsing
  empty stdout. This was a verification gap, not an asserted production defect.

EXTRA_SCOPE: None. Production profile fallback, models, authentication and defaults
were unchanged.

VERIFICATION_MAPPING:

- All four local hashes matched the assigned freeze and remote overlay manifest:
  `global.cjs` 4302ca0c458d8d3df981a7978191cef81dd40ec44555169b28e0b431a580c142;
  `global.test.cjs` e55e3b4cf1cfe9eb13bb4c6c6390c2eea3f42946d970311e8b08829778423939;
  worker `launch.test.cjs` c9f3e8e5fa5a5d515b4d85896b33e77c80a5da7d7ca268391d91883525c071c2;
  `board-dispatch.test.cjs` 030ebd707027f2813151ba9db32e22b60d8919691ccd63a99554a95e30517049.
- Batched scans retain socket-inode ownership, per-call complete network-namespace
  table caching and deadline checks inside every potentially large loop. Default
  timeout remains 5,000ms; exact identity, listener revalidation, foreign-listener
  refusal, journal durability, explicit retry and the 20ms/<1000ms test remain.
- Saved measurement: 6,816 PIDs, old three-port pass 1877.676015ms, projected two
  passes 3755.35203ms. No new 11ms result exists in that artifact.
- Saved batch RED: 1 pass / 1 fail, with 600 table reads. GREEN: 2/2. Separate
  candidate-cleanup RED records the old-helper transformation and 0/1 failure
  because the candidate remained owned. Global suite: 40/40. Sentinel tests: 2/2;
  worker/board diagnostic suites: 29/29. Raw output matches the JSON receipts.
- Ordinary fixtures override inherited profile logs; sentinels remain unchanged
  after real fake-provider wrapper execution and private fallback rows are parsed.
  The existing missing/corrupt-registry and offline self-test overrides remain.
- Root's independent focused 2/2 run has matching source hashes; its initial
  disabled-Atlas harness error is explicitly disclosed in the completion report.

Evidence roots (DEVCP):

- `/home/jackberrow/.cache/sgsd-native-verification/repair-green-IY5E2O/evidence/`
- `/home/jackberrow/.cache/sgsd-native-verification/repair-cleanup-red-KRIUus/evidence/`
- `/home/jackberrow/.cache/sgsd-native-verification/root-focused-BpaRMo/corrected-evidence-1D4m4T/`

ONE_LINER: Scan and profile isolation meet their contracts; startup-failure cleanup
and full integration still need completion. This is not a phase or B0-B7 pass.

Root transcription of the independent review response. The review time is an
approximate minute, not a provider request timestamp. Later remediation and
verification belong in a new review artifact; this verdict is retained.

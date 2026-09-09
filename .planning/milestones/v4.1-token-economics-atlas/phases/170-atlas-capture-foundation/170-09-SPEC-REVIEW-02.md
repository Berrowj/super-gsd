---
phase: 170
plan: "170-09"
verdict: pass
source_freeze:
  - path: super-gsd/scripts/sgsd-remote-tmux.sh
    sha256: e731568cd2454077b6f328360b8fc861c4dcf126d3ef240917a82313bada8cdc
  - path: super-gsd/scripts/sgsd-boot.sh
    sha256: 4a985b9cc52084f8bbe5221b0688edeb357d95ccee6680e53f57c91ecfdfefbe
  - path: super-gsd/tests/propagation/runtime-provenance.test.cjs
    sha256: 1b933a7ccf124a100fa1ba9b67cb52a43c3daa9077def77554012364d4bc637a
---

# Independent SPEC review 02: T170-09-1

SPEC_VERDICT: pass

MISSING_REQUIREMENTS: none identified in the scoped code compliance review.

EXTRA_SCOPE: none identified. The repair is confined to prerequisite ordering, isolation of two affected provenance fixtures, and two bounded regressions. The boot source and shared worker helper are unchanged from SPEC01.

ONE_LINER: Both SPEC01 findings are repaired, demonstrated by meaningful native RED followed by unchanged regression assertions passing; original selection, health, environment handoff and operator-topology contracts remain intact.

## Scope and authority

This is an independent specification-compliance review of T170-09-1, not registered QUALITY, integration acceptance, publication/deployment authorization, a T170-09-2 normal-launch receipt, Windows/macOS certification, or phase completion. Source and saved evidence were inspected under the subagent-driven-development specification-review instructions. No source files, tests in the real worktree, provider/model calls, gates or installed runtime were executed or changed. Only this new document was written.

The amended plan's 16:02Z dependency restoration was read alongside the actual `170-08-ATC-REVIEW-05.txt`: 157 bytes, SHA-256 `572509fd8f7cd0896bc20e84323450cff215b0af3df22705cf76ceabc1d88181`, with integer FINDINGS/CRITICAL/WARNINGS all zero and PASS_RATE `10/10`. The amendment records the exact existing validator's acceptance. This review does not invoke or recreate that gate. Earlier format-invalid reports and the historical pause are not treated as valid dependency passes.

SPEC01 remains unchanged at SHA-256 `bbd9c341787afb3e3d7bc8402984feab133ca290e8ad98b67194760c9d292613`; its failing verdict is historical evidence, not overwritten by this receipt.

## Findings resolved

1. **SPEC01 prerequisite-ordering finding: resolved.** `super-gsd/scripts/sgsd-remote-tmux.sh:271` now calls selection before the tmux and Claude prerequisite checks at lines 272-273. Selection still restores original caller cwd/PATH and pins Codex through the unchanged bootstrap at lines 187-195 before recovery. The previous local-bin availability behavior is therefore restored without selecting Codex from the recovered PATH. The regression at `super-gsd/tests/propagation/runtime-provenance.test.cjs:600` puts fake tmux only in fixture HOME's local bin, removes the incoming fake tmux, excludes system command directories from incoming PATH, exposes only required harmless system utilities, and retains an incoming Codex. It checks no health/provider markers before successful launch, the incoming executable pin, actual fake Claude `go`, and the emitted login-shell handoff.

2. **SPEC01 fixture-ownership finding: resolved.** The doctor invocation at test lines 524-532 and cockpit invocation at lines 573-583 now explicitly set fixture HOME/USERPROFILE and remove all four inherited Codex selector/argument/launcher variables. Fake executable PATH entries precede inherited system dependency paths; the helper is the actual unchanged source copy, not a fixture selector implementation. Existing provenance, selected script directory, and no-vendored-cockpit assertions remain unchanged. The test at line 631 starts a child test runner with a conflicting private parent HOME, an invalid relative app-server selector, invalid legacy/FORCE intent, and parent argument bytes. That child runs exactly the two affected legacy cases; assertions require exit zero, two passing tests and no parent fake-provider marker. Removing only `NODE_TEST_CONTEXT` makes the nested runner execute its requested tests rather than silently returning an empty stream. It does not remove the deliberate contamination or weaken the original cases.

## VERIFICATION_MAPPING

The saved corrected RED and first GREEN source copies were independently hashed and compared with `/usr/bin/diff` read-only. Between those copies, production changes consist solely of moving the existing selection call before the two prerequisite checks; test changes consist solely of the two fixture environment corrections. The two regression bodies and original assertions are identical across that RED/GREEN pair. A subsequent authorized final cleanup removes only the unused `SGSD_TEST_CONTAMINATION_CHILD` assignment; that one-line delta was independently compared between saved source copies and does not alter assertions, child selection or runner behavior.

All evidence directories below are under `/home/jackberrow/.cache/sgsd-native-verification/`. Result metadata, stdout/stderr and exact saved candidate hashes were read independently; no surrounding model content or unfiltered environment was collected.

| Evidence | Independently observed result |
| --- | --- |
| `repair-17009-red-spec01-bounded-corrected-9wJnEm/evidence` | Native Node v24.15.0/Linux x64, 0 pass / 2 fail / 0 skip, 416.389107 ms. Executes SPEC01 remote hash `b2a44c8956e6c983a4bdd0539d50486f314f20fc511bfe784ec81f64c6b0376c`, unchanged boot/helper, and regression test hash `5854f64e6efc6fde0005fedb524d79d15937fa0f17c9af2d3118f5dad8a1e48a`. First failure is actual `tmux is not installed`; second contains both real nested provenance failures refusing `./invalid-parent-selector`. This is behavioral RED, not a test-runner-only failure. |
| `repair-17009-green-spec01-bounded-wS17iY/evidence` | Same two bounded regressions: 2 pass / 0 fail / 0 skip, 353.815078 ms. Saved production hashes match this frontmatter; test hash is the preceding `647cb177a5a752b4163b183b50107e48711a4ae38d9d8e099c3954e194c56c89`, before the one-line unused-marker removal. |
| `repair-17009-green-focused-spec01-final-USgfov/evidence` | Complete preceding runtime-provenance file: 16 pass / 0 fail / 0 skip, 7820.069547 ms. Exit 0, no signal, empty stderr. Independently hashed saved test is the preceding `647cb177...` input; both new regressions and all fourteen earlier cases pass. |
| `repair-17009-green-focused-spec02-freeze-NvqvqJ/evidence` | Exact final freeze: 16 pass / 0 fail / 0 skip, 10430.984488 ms, exit 0, no signal, empty stderr. Both `bash -n` checks exit 0. All three independently hashed saved candidate files match this frontmatter, including final test `1b933a7c...`. |
| `repair-17009-red-spec01-bounded-FD0Q84/evidence` | Earlier 0/2 run retained. The local-tmux failure is genuine, but its contamination case fails on an empty nested stdout stream rather than the intended behavior. It is not substituted for the corrected RED proof above. |

The principal T1 contract remains mapped to the actual unchanged portions of the frozen candidate:

- Original caller selection uses the actual `codex-worker-shell.sh` helper, `--dry-run`, and incoming cwd/PATH before local/NVM recovery. No worker preparation, profile load, self-test relaxation or CLI execution is introduced for selection. Tests at lines 670, 746, 792 and 826 retain relative executable/relative PATH, competing default locations, absolute/bare explicit selection, empty default meaning, invalid explicit refusal and missing-default diagnostics.
- The five bounded `tmux new-session -e` bindings at remote lines 354-359 preserve PATH plus the specified four Codex variables. Existing Atlas provenance bindings are unchanged. Tests at 864 retain exact argument bytes and direct/cmd/invalid/empty/absent FORCE intent against stale server values; invalid FORCE authority remains in the worker rather than being silently normalized.
- Tests at 670 and 909 still execute the actual emitted operator command using PATH-resolved fake Claude and a controlled `bash -l` handoff that changes PATH. Greet/go/shell modes, argv boundaries, normal nonzero-exit handoff, and three separate cockpit panes remain checked. Test 942 retains no new pane/session/global environment mutation on existing-session reuse. No actual tmux server or provider is involved in these fixtures.
- Boot remains byte-identical to SPEC01. Its selected-executable login-status check preserves intended prefix arguments and auth exit 8; tests 967 and 995 retain selected identity, missing/invalid exit 7 and help/skip-preflight boundaries. As established in SPEC01, the unchanged downstream cockpit startup performs its own Node PATH recovery; no new skip-preflight defect is inferred. Existing installed-layout and provenance cases remain in the passing file.

The preceding meaningful original-cwd/stale-session RED, syntax evidence and named-suite runs remain recorded in SPEC01 and are not erased or silently relabeled as this new freeze's integration. Root integration at `root-integration-OfjbEa/evidence` exercised the preceding `647cb177...` test: worker 92/0/2, Atlas 122/0/4, board/routing 15/0/0 and propagation 83/7/0 (pass/fail/skip). Raw stdout counts and SHA-256 digests were independently verified against the saved results. The manifest contains 1,106 candidate files, with `changed_candidate_inputs: []` and `protected_state_unchanged: true` in the saved result. This run and the implementer's preceding UIQEJ4 batch are not labeled as final-test-freeze integration. Root is running fresh integration of final `1b933a7c...`; its result must be retained separately. The seven previously reproduced snapshot-contract failures remain explicit baseline failures, not waived PASS results. Registered QUALITY remains separate and must review this exact freeze.

Two follow-up observations were assessed without expanding requirements: retaining system utility PATH entries behind the fixture-owned fake executables is not forbidden by T1 and does not reintroduce the identified HOME/explicit-selector leakage; a wholesale utility-whitelist refactor is not required. The sole unused `SGSD_TEST_CONTAMINATION_CHILD` assignment was inert scaffolding, not a functional SPEC defect; its authorized removal is now included in this final freeze and exact native focused evidence.

Final integration arrived before handoff: `root-integration-ELwlRb/evidence`, completed 16:11:50Z. Independently read raw counts and recomputed stdout hashes confirm worker 92/0/2, Atlas 122/0/4, board/routing 15/0/0, propagation 83/7/0. All three independently hashed saved candidate files match this final frontmatter. Its manifest lists 1,106 files; saved results record unchanged protected state and an empty changed-input list. This is the final-freeze integration receipt; the previous paragraph's earlier runs remain historical. The seven baseline failures remain failures, and actual registered QUALITY has not been inferred or performed by this review.

## Freeze

Local source hashes and independently hashed final native saved copies match the three frontmatter entries. Shared helper remains `55088c598b067948af1c341f8c9dbe56e047752bf848a4777234ad4abdf9db83`. No source mutation occurred during this review. A later changed input requires a new matching SPEC receipt; this scoped PASS does not authorize downstream publication or live acceptance by itself.

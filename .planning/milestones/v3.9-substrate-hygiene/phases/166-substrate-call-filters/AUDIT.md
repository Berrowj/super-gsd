# P166 evidence-gated audit

Purpose: catch the "claimed but never existed" class of gap. Every row below was
re-checked against the filesystem or a live command at close, not read back from
a report. Where a claim could not be gated mechanically, the row says so.

## Artifacts claimed by SUMMARY.md

| Artifact | Exists | Size |
|---|---|---|
| SUMMARY.md | yes | 6,103 B |
| VERIFICATION.md | yes | 2,177 B |
| ATC-REVIEW.md | yes | 1,640 B |
| WASTE.md | yes | 2,742 B |
| 166-REVERT-PROOF.md | yes | 2,599 B |
| 166-ADJUDICATION-REPORT.md | yes | 1,769 B |
| 166-01-PLAN-LOCKED.md | yes | 28,284 B |

Two review reports (`166-PLANREVIEW2-REPORT.md`, `166-01-T1-SPEC-REVIEW3-REPORT.md`,
and others) were written by `codex-exec.sh` in truncated form, 138 B to 181 B,
losing their VERDICT and body. Each was reconstructed from
`.planning/metrics/codex-live-output.txt` and carries an HTML comment naming the
salvage and the original token count. This is a known wrapper behaviour already
recorded in memory as `codex-exec-set-e-silent-report-loss`. The verdicts are
therefore second-hand from the live log rather than first-hand from the wrapper,
and that is stated on each file rather than hidden.

`VERIFICATION.md` was written by the wrapper as a 436 KB dump of combined stdout
and stderr after a reported contract violation; the codex stdout section was
extracted verbatim and the rest discarded.

## Code claimed by SUMMARY.md

| Claim | Gate | Result |
|---|---|---|
| `SUBSTRATE_CALL_POLICY` exists in the composer | grep | 5 references |
| `prepareSubstrateCall` exists | grep | 4 references |
| `acceptPromptSubstrateCallRecord` exists | grep | 5 references |
| `capSubstrateResponse` exists | grep | 5 references |
| v2 schema exists and parses | `require()` | parses, keys `$schema,$id,version_id,provenance,tools` |
| v1 schema unchanged since baseline | `git diff f39200a HEAD --name-only` | 0 files |
| P154 evidence unchanged since baseline | same | 0 files |

Six selectable test cases exist and were each run: `caller-coverage`,
`cap-shapes`, `executable-emitters`, `megachunk-degraded-artifact`,
`prompt-record-acceptance`, `repair-safe-t2`.

## Behaviour claimed, gated by falsification

A passing test shows the absence of one failure, not the absence of the bug, so
each central claim was also falsified by breaking it on purpose:

| Claim | Falsification | Result |
|---|---|---|
| Coverage fails closed in a known file | appended a rogue substrate call to `sgsd-triage-runtime.cjs` | caller-coverage failed; file byte-restored |
| Coverage fails closed in a new file | created a new file with a rogue call | caller-coverage failed; file removed |
| Recordless error cannot be accepted | `gate.run` with `{ok:false}` and no record | threw `substrate_call_record_missing`, wrote no artifact |
| Cap is exact and lossless elsewhere | 900,001-char hit with a tail marker | retained exactly 16,000, marker absent, input unmutated, second hit byte-preserved |

All four were re-run after the final phase-ATC fix and all four still bite.

## Revertability, gated

Claimed in the plan, disproven as written, then re-proven as ranges in an
isolated worktree with the gitignored Ajv dependency copied in. See
`166-REVERT-PROOF.md`. Reverting T2's two commits leaves T1 working; reverting
T1's four then returns the tree byte-identical to the pre-phase baseline.

## What this audit could NOT gate

- **Live VTP behaviour.** No suite contacts a live VTP host; the phase forbids
  it. Everything here is proven against staged fixtures and injected transports.
  If the live descriptor has drifted from the v2 schema since the 2026-08-18
  capture, no test in this phase would notice.
- **Installed agent surfaces on a real machine.** `feature-propagation/audit.cjs`
  is tested under an isolated USERPROFILE. Whether the operator's actual
  installed `gsd-phase-researcher.md` and `gsd-planner.md` carry the P166 marker
  after a real propagation run is unverified here.
- **The prompt surfaces themselves.** This is DEFERRED-1. No test can prove a
  markdown agent obeyed its prompt, which is precisely why the phase verifier
  returned GOAL_MET NO and P167 exists.
- **Two reviewer runs' own re-execution.** The phase ATC and the T2 ATC could not
  re-run writable suites (`EPERM` in their sandbox) and audited the
  orchestrator's results instead. Both said so rather than claiming fresh runs.

## Verdict

No claimed artifact is missing. No claimed symbol is absent. No frozen file
moved. The one claim that did not survive gating, the two-commit revert
contract, was corrected rather than restated.

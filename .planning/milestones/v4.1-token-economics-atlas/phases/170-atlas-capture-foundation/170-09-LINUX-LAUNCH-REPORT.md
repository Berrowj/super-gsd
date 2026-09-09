---
phase: 170
plan: "170-09"
status: SPEC_PASS_QUALITY_PASS_AWAITING_DEPLOYMENT
source_baseline: 4934ccb72e0f88a5caa58086c3f5290e5317bdef
publication: NOT_PUBLISHED
deployment: NOT_DEPLOYED
windows: OPEN_REQUIRED
---

# Linux launcher repair evidence

T1 changes only the remote launcher, Bash boot preflight and their provenance
tests. The existing shared selector helper and the four reviewed170-08 files
remain unchanged. Selection pins the caller's intended executable against the
original cwd/PATH before Node recovery, carries only the bounded selector/PATH
environment into a new tmux session, and preserves existing sessions and direct
Claude/separate-cockpit topology. Boot's existing health check follows the chosen
executable and prefix arguments. No model, auth or default changes are included.

## Final source freeze

| File | SHA-256 |
| --- | --- |
| `super-gsd/scripts/sgsd-remote-tmux.sh` | `e731568cd2454077b6f328360b8fc861c4dcf126d3ef240917a82313bada8cdc` |
| `super-gsd/scripts/sgsd-boot.sh` | `4a985b9cc52084f8bbe5221b0688edeb357d95ccee6680e53f57c91ecfdfefbe` |
| `super-gsd/tests/propagation/runtime-provenance.test.cjs` | `1b933a7ccf124a100fa1ba9b67cb52a43c3daa9077def77554012364d4bc637a` |
| Unchanged `super-gsd/scripts/lib/codex-worker-shell.sh` | `55088c598b067948af1c341f8c9dbe56e047752bf848a4777234ad4abdf9db83` |

## Retained repair history

Initial original-cwd/stale-server RED is
`repair-17009-red-original-cwd-attested-zigb5i/evidence`:0 pass/1 fail. The
earlier recursive fake-Bash timeout is retained as harness-invalid, not RED.
[SPEC01](170-09-SPEC-REVIEW-01.md) identified the local-bin tmux prerequisite
ordering and two legacy fixtures' inherited HOME/selector environment.

Those cases independently reproduced0 pass/2 fail in
`repair-17009-red-spec01-bounded-corrected-9wJnEm/evidence`; its preceding
FD0Q84 harness run retained a nested Node test-runner context problem. The
corrected RED clears only that runner context, preserving the actual faults.
The repair moves prerequisite checks after selection/recovery and gives the
affected fixtures private HOME/USERPROFILE and cleared selectors, with owned
fake provider executables first on PATH. System utility PATH inheritance is not
itself a provider-boundary failure; no full utility-path refactor was added.

An inert, unused test environment marker was then removed. The intermediate
test hash647cb177 and all its evidence remain historical; no earlier manifest
is rewritten as proof of the final1b933a7c test bytes. Final native Node24
focused results at `repair-17009-green-focused-spec02-freeze-NvqvqJ/evidence`
are16 pass/0 fail/0 skip in10.431s; both launchers have `bash -n` exit0.

All short native evidence directories in this report are under
`/home/jackberrow/.cache/sgsd-native-verification/`.

## Final independent integration

Root copied1,106 source/config inputs and6,145 dependency files into a private
source/HOME/Atlas fixture. Evidence `root-integration-ELwlRb/evidence` completed
2026-09-09T16:11:50.013Z on the exact final freeze. All candidate input hashes
and protected-state comparisons remained unchanged.

| Suite | Pass | Fail | Skip | stdout SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Worker | 92 | 0 | 2 | `c692f636f1048cae10498bd6b470be00de135736b4260cbe7e5f7a779237af46` |
| Atlas | 122 | 0 | 4 | `ded8aa2e5d7b7aadb896b2da0c7dd4b19eea7dff3be92da79ea777c2de352b8d` |
| Board/routing | 15 | 0 | 0 | `afeb9f558d5f12c44ed512da9ec237eb6275bd438af131f0c1bc6d2760c1ab9b` |
| Propagation | 83 | 7 | 0 | `285c5d9821912dc1116767a9471acb0f58d9617f81bf2626f07fafaca03dcf3e` |

The seven propagation failures match the separately retained published2770952
snapshot-contract baseline. They remain failures, not an all-suite PASS or a
waived gate. Platform-only/opt-in skips are not Windows or live acceptance.
The preceding root integrations OfjbEa and t4zJ0A bind their own earlier source
freezes; their streams and manifests remain unchanged.

## Review and deployment boundary

170-08's first genuinely contract-valid QUALITY report is05, not04. Root's
incorrect earlier prompt/omitted secondary check is documented in
[the contract correction](170-08-ATC-CONTRACT-CORRECTION.md). This plan paused
at its safe RED checkpoint and resumed only after the valid same-thread05
receipt and canonical ledger writes. The new170-09 review uses the existing
integer-count/N-N report contract and exact secondary validator.

[SPEC02](170-09-SPEC-REVIEW-02.md) passed the final exact freeze. Root read its
complete original report and verified SHA-256
`09d750d4289edd8e76f2b48cb00496fd1a8652e06763d0393df5590d19ba33a6`.
Registered QUALITY ran on final ELwlRb with the normal review profile and one
180-second attempt. It timed out16:16:48.410Z after180.749s, transport exit5.
Worker `ad8fc494-a92d-42fd-a3b0-2a4e80a3cbb9`, thread
`01a086f2-69a1-70e3-b7e1-c0c3446b097e`, turn
`01a086f2-6a70-7560-bc4b-6a3a91adf4df`, Atlas run
`sgsd-fcf5778c-9da3-4276-845b-46e4db04b848`; evidence is
`root-integration-ELwlRb/source/.planning/reviews/170-09-quality-tqI1qG/`.
The raw179-byte timeout report contains no review verdict; its SHA-256 is
`8e7bb08ab97bba8fbd04108b4254831da0910308de5325ce23c5440c8af3fa7b`.
The exact secondary validator rejected all five missing contract fields. All
1,106 source inputs remained unchanged. Fourteen native observations were
queued with zero pending; the line-limit warning remains. No accepted-token
reconciliation for those fourteen is claimed here. The adapter is terminal.
Publication is held pending diagnosis and a genuine valid review; no automatic
retry or source repair followed this timeout. Existing route/gate-evidence
writers recorded it in receipt `17009-timeout-ledgers-EJ9XU8`, preserving ledger
prefixes without creating a review verdict or successful edge transition.

Structural diagnosis16:20:32Z at `root-17009-timeout-diagnostic-46NWHD` shows
all14 tool calls returned, no question pending, no final answer, and review
metadata still progressing191ms before the deadline. Exact adapter absence is
proved by ESRCH and its thread claim is absent. All1,106 source inputs and the
protected/evidence postchecks match. Its manifest is
`234587ebcbd4dd59dba65b4d62d3a9e1c8ff3a1f9092d7155cc7a8928ae3e368`;
result SHA-256 is
`4ac5a4bd9305060e8572cc6c504ff9e8aed139594929e6b54587a58c34a53891`.
Root read the original diagnostic and verified the manifest. Three oversized
non-usage lines explain the conservative line-limit warning; none of the14
usage records is oversized. Canonical acceptance was not checked in that
diagnostic. It does not prove absence of every detached tool process or a
substantive code verdict.

The dated T1 amendment authorizes one separately recorded180-second same-thread
continuation, with unchanged model/effort/source/criteria, exact existing report
validation, fresh precondition checks and a distinct exclusive attempt marker.
Original timeout evidence and first-attempt helper bytes are retained. Another
failure needs fresh diagnosis; this is not an automatic retry or a changed
timeout default. Normal
guarded update, a fresh protected baseline and actual Fable B0-B7 acceptance
are T2, not inferred from these fixtures. No global deployment or fresh
acceptance has occurred. P170 phase gates, P171 semantic operation capture,
P172 reporting, fleet freshness and Windows remain separate open work.

## Actual QUALITY continuation and publication checkpoint

The one explicitly planned same-thread continuation completed
2026-09-09T16:27:56.102Z in 134,916ms, transport exit 0. Its actual worker is
`763bb601-9184-4acb-b010-3bf36f0a1a2d`, thread
`01a086f2-69a1-70e3-b7e1-c0c3446b097e`, turn
`01a086fd-4e79-7d20-bb85-c1b1a9765704`, Atlas run
`sgsd-deacc830-97b6-4244-9c39-6c580677e352`, on the unchanged registered
`gpt-5.6-sol` / `xhigh` profile. The adapter is terminal. All 1,106 candidate
inputs and the retained original timeout/attempt/diagnostic evidence match.

Evidence directory is
`root-integration-ELwlRb/source/.planning/reviews/170-09-quality-continuation-NUdiiE/`.
Root read the complete original report and result. The exact existing secondary
validator, SHA-256
`c33469c5e5835c5fcb380d33f9acf1e692ddfcd6b3857d9380aa1675a988f627`,
passes all five fields: FINDINGS 0, CRITICAL 0, WARNINGS 0, PASS_RATE 10/10.
The verbatim 180-byte [report02](170-09-ATC-REVIEW-02.txt) has SHA-256
`56355557ffd053aa0d874dcb296e2de1d2d4058d92d843a79b2c612cdac9f0f9`;
raw result SHA-256 is
`8700995f6ea10d4e77ed6cc045c6f43d65297fbba3feb298269f2c8e14681db8`.
The report's zero-provider coverage refers to the scoped launcher fixtures, not
live acceptance or exhaustive telemetry. Two native observations were queued,
zero pending, with `complete_coverage:false`; canonical accepted-token
reconciliation is a separate read-only task, not inferred from that queue.

T1 is reviewed for the exact three-file freeze above. T2 may now use the normal
guarded updater after explicit publication checks. No deployment, fresh live
acceptance, formal phase closure or downstream capture completion is established
by this review. The original timeout and seven known propagation baseline
failures remain unmodified. Existing route, gate-evidence, review-ledger,
gate-value and edge-guard writers recorded the actual pass in receipt
`17009-pass-02-ledgers-afCWz4`. Every ledger prefix is preserved. The phase
commit-review ledger is 7,034 bytes, SHA-256
`923f035692054aa039ffd0bcc84e69e85d882319c1f9bc44d16d300b5f702817`.
The edge is the registered per-dispatch review transition, not phase completion.

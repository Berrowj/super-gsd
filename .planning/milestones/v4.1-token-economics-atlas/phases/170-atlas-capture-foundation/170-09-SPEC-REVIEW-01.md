---
phase: 170
plan: "170-09"
verdict: fix_required
source_freeze:
  - path: super-gsd/scripts/sgsd-remote-tmux.sh
    sha256: b2a44c8956e6c983a4bdd0539d50486f314f20fc511bfe784ec81f64c6b0376c
  - path: super-gsd/scripts/sgsd-boot.sh
    sha256: 4a985b9cc52084f8bbe5221b0688edeb357d95ccee6680e53f57c91ecfdfefbe
  - path: super-gsd/tests/propagation/runtime-provenance.test.cjs
    sha256: 2417bd70ebb5180bac8eaf5341bde64ab899f0af1ac7d77bcf60fab92710c5b8
---

# Independent SPEC review 01: T170-09-1

SPEC_VERDICT: fix_required

ONE_LINER: The frozen repair implements the principal original-cwd selection and bounded new-session handoff contracts, but normal startup can reject a previously discoverable user-local tmux, and two affected provenance fixtures still inherit the caller's selection environment.

Scope is T170-09-1 only. This is not registered QUALITY, publication permission, T170-09-2 acceptance, a Windows/macOS certification, or phase completion. Review used the subagent-driven-development specification-review instructions, the actual amended plan, the three source diffs and their surrounding code, the unchanged selector helper and cockpit startup dependency, and retained native evidence. No source edits, worktree tests, provider calls, installation, gate invocation or deployment were performed. Only this new review artifact was written.

## MISSING_REQUIREMENTS

1. **Important: preserve recovered-path remote launch availability.** `super-gsd/scripts/sgsd-remote-tmux.sh:271` checks `command -v tmux` before `select_codex` at line 273. The removed original preamble recovered `$HOME/.local/bin` and native NVM paths before this prerequisite check; recovery now occurs inside the shared bootstrap called by `select_codex`. Therefore an incoming PATH without tmux, with a valid executable only in the previously supported local recovery directory, exits with `tmux is not installed` before recovery can run. Doctor mode takes the reverse order at lines 265-267 and can report the same executable available. The Claude warning at line 272 likewise observes the unrecovered PATH. This is a deterministic control-flow finding, not a claim that the saved 14 tests reproduced this newly identified case. Restore prerequisite checks after selection has pinned against the original caller environment and completed normal recovery. Add a private fake-tmux regression with tmux available only in the recovery directory, retain a competing incoming Codex, and assert successful direct operator handoff, the original selected Codex, and zero provider/login selection probes.

2. **Important: complete the explicitly required fixture environment ownership.** `super-gsd/tests/propagation/runtime-provenance.test.cjs:503` (doctor; invocation environment at line 516) and `:541` (cockpit; environment at lines 558-563) now execute the selector bootstrap but do not set the fixture HOME/USERPROFILE or clear/own inherited Codex selector variables. Doctor also inherits the entire caller PATH. `run` at line 17 merges the parent environment; the helper consults that HOME's local/NVM directories and gives any nonempty inherited explicit selector precedence. Thus these source/other-platform provenance regressions can fail because of an unrelated caller selector or inspect/select outside their declared fixture roots, despite the plan explicitly requiring owned HOME/source/project/helper fixtures. The new selection fixtures do establish the required boundary; extend equivalent ownership to these affected legacy cases while preserving their provenance and selected-cockpit assertions. Verify with a deliberately invalid parent selector and a conflicting parent HOME while all selected fake executable/helper paths remain inside the disposable fixture. No real provider invocation was observed or inferred from this gap.

## EXTRA_SCOPE

No unrelated source feature, profile/model/effort/auth/default change, worker preparation, new login probe, global tmux environment update, or nested orchestrator was found in the frozen diff. The existing explicit reset behavior is unchanged. The two findings require bounded launch ordering and fixture fixes, not helper or worker redesign.

## VERIFICATION_MAPPING

- Selection: remote lines 187-195 and boot lines 141-153 reuse the unchanged helper beside the launcher, restore caller cwd/PATH before bootstrap, and call `--dry-run`, not the explicit-failure-relaxing `--self-test`. The helper's precedence, absolute pinning, invalid-explicit refusal, default fallback, and Node recovery remain authoritative. Tests at lines 581, 657 and 703 cover original-cwd relative executable/relative PATH, competing incoming/local/NVM, and absolute/bare selectors. Tests at 737 distinguish invalid explicit selection from missing default without invoking the selected fake CLI.
- New-session environment: remote lines 354-361 add only PATH and the four specified Codex variables to `new-session`; optional present bytes and absent-as-empty semantics preserve existing consumer behavior. Tests at 775 cover direct/cmd/invalid/empty/absent FORCE intent and space/quote/empty argument bytes against stale server values. Worker authority to reject invalid launch modes is unchanged.
- Actual operator execution: the fake tmux executes the emitted command without replacing fake Claude with an absolute path; fake Claude is resolved through controlled PATH. The controlled emitted login-shell handoff mutates PATH while selector/argument bytes remain pinned. Tests at 581 and 820 exercise stale/new-server behavior, greet/go/shell, argument boundaries, nonzero Claude exit followed by the existing handoff, and three separate cockpit panes. Test 853 asserts existing-session reuse does not create panes or mutate session/global environment. These tests do not establish real tmux or production launch acceptance.
- Boot health: lines 246-271 use the selected executable and NUL-delimited intended prefix arguments for the existing login-status check. Tests at 878 and 906 preserve selected health identity, missing/invalid exit 7, auth failure exit 8, and help/skip-preflight boundaries. The suspected skip-preflight Node regression was checked and **not substantiated**: boot does not attach Atlas or invoke an orchestrator, and unchanged `start-cockpit-server.sh:83-95` performs its own PATH recovery before Node use. The adapter's 16-prefix-argument cap is not duplicated by the boot health parser; the plan does not require extending this worker validation into a health probe, so this is not elevated to a SPEC finding.
- Installed/provenance behavior: actual helper bytes are copied at test line 146; resolving the helper beside the executing launcher avoids the earlier alternate-scripts-directory dependency failure. Original pin rejection and global installed-layout checks remain. Other-platform behavior is not certified; the inherited-environment gap above prevents claiming complete fixture isolation for those retained cases.

All following directories are under `/home/jackberrow/.cache/sgsd-native-verification/`; raw result JSON, test output and saved source hashes were independently read, without copying surrounding model content or environment dumps:

| Evidence | Observed result and interpretation |
| --- | --- |
| `repair-17009-red-original-cwd-attested-zigb5i/evidence` | Genuine pre-repair launcher RED: 0 pass / 1 fail, 207.844966 ms. Saved actual old launcher hashes are `25008e9f3963db181481b19b057d8273a63aa8da28bf3fd08260adb052a7ad88` and `27a46d599ef92f84591d950fcbed25ba8dd2c57d58ba73c9204a92947d1fdd1a`. Saved test lines 631-633 assert status success and no health/provider markers before line 636 fails on actual `stale-app` versus the original-cwd selected path. The separate `inputs` candidate fields are not misrepresented as executed old-script hashes; `actual_inputs` and current saved bytes agree. |
| `repair-17009-green-focused-final-S0l5hd/evidence` | 14 pass / 0 fail / 0 skip, 7347.536057 ms, native Node v24.15.0 Linux x64. Both saved `bash -n` results have exit 0. Independently hashing all three saved source files matches this frontmatter, and the saved helper matches the unchanged local helper. |
| `repair-17009-named-batch-oeMZkS/evidence` | Named worker 58/0/0; Atlas 122/0/4; board 7/0/0; propagation 80/8/0 (pass/fail/skip). Manifest identifies the frozen candidate and exact test commands. This batch is not represented as an entirely passing integration run. |
| `repair-17009-named-batch-R5EIig/evidence` | Corrected propagation harness: 81 pass / 7 fail / 0 skip. All seven remaining failures are the retained global-snapshot cases; the extra tracked-artifact failure in the missing-git harness is absent. Known failures remain visible and are not waived into a green phase gate. |
| `repair-17009-named-batch-ud8Ule/evidence` | Earlier candidate retained: worker 58/0, Atlas 121/1/4, board 7/0, propagation 80/8. Its source hashes differ from the freeze; the installed/alternate-helper layout failure is not silently discarded or attributed to the final candidate. |
| `repair-17009-red-original-cwd-wmgq2T/evidence` | Earlier invalid RED retained: one failure after approximately 420 seconds. This timeout is not the meaningful selector regression proof; the attested RED above supplies that proof. Parent reports its exact-path residual check separately; this review does not independently claim to have rerun that cleanup check. |

Before final handoff, the parent's fresh independent integration completed. Raw summaries and `results.json` at `root-integration-t4zJ0A/evidence` were independently read: worker 92/0/2, Atlas 122/0/4, board/routing 15/0/0, propagation 81/7/0 (pass/fail/skip). The saved result records `protected_state_unchanged: true` and `changed_candidate_inputs: []`. These results preserve the seven baseline propagation failures and do not exercise away the two uncovered findings. Registered QUALITY remains a separate subsequent gate.

## Freeze and handoff

Local three-file hashes were rechecked during review and match the frontmatter. Helper SHA-256 remains `55088c598b067948af1c341f8c9dbe56e047752bf848a4777234ad4abdf9db83`. The four preceding 170-08 files remain at production global `8d0cbb46f7f049c3bdf844560e394a9a615f5d50223551e19bd397f82d547d20`, global test `b979f2c1c0de5b60fdcc995ecc0f9a776e0b38fdab056e4af4065fd7203dfcf5`, worker launch test `c9f3e8e5fa5a5d515b4d85896b33e77c80a5da7d7ca268391d91883525c071c2`, and board test `030ebd707027f2813151ba9db32e22b60d8919691ccd63a99554a95e30517049`.

Return the two bounded requirements to the implementer, retain meaningful private RED/GREEN evidence, then freeze and obtain a fresh independent SPEC receipt before registered QUALITY. Prior evidence and this failing receipt must be preserved.

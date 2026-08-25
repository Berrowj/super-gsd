# Phase verifier — P168 Install Contract. Goal-backward. Read-only, do not edit or re-run suites.

Plan: .../168-install-contract/168-01-PLAN-LOCKED.md (revision 2, tasks T1 and T2).
Context with the measured root cause: .../168-install-contract/CONTEXT.md

Judge EVERY `semantic_acceptance_criteria` entry across both tasks as MET or NOT MET with
a file:line citation from the implementation. Do not accept an executor report or a commit
message as evidence; cite the code.

## The problem this phase existed to solve

Distributed hooks reached every project on every update while the modules they `require`
never did: `install.sh` copied `scripts/lib` to `~/.claude` only, and neither
`init_local_project` nor `update_existing` wrote a project module tree. A project hook
doing `require('../scripts/lib/sgsd-state.cjs')` got MODULE_NOT_FOUND at first fire. This
silently broke delivery to every other repository for five development cycles, and was
confirmed on a real Linux box.

## Orchestrator-run results, take as given, do not re-run

install-contract 5/5; installer-registration-guard 13/13 in one `--all` sweep; a real
`install.sh --init-project` from a decoy cwd into an EMPTY project exits 0 and delivers
17 hooks and 9 `scripts/lib` modules; `install.sh --doctor` in this worktree reports a real
git HEAD and a freshness comparison against master; assert-hook-contract 38/38;
assert-prompt-contracts 4/4; assert-witness-correlation 13/13; assert-propagation PASS;
P166 policy 6/6; P154 real-evidence PASS; composer, enrichment-gate, kb-triage-shadow PASS;
feature-propagation 15/15; `bash -n` clean.

Spec-compliance PASS for T1 (after two FAIL rounds) and for T2 (after one FAIL round).

## Questions the verdict must answer

1. Is each acceptance criterion MET, with a citation?
2. Does the phase actually solve the stated problem: would a project installed by this
   code have the modules its hooks require, and would an install that cannot deliver them
   refuse rather than report success?
3. DLB-07: is any criterion green because a test asserts a shape rather than because real
   data flowed through the real path? The empty-tree criterion claims a production Bash
   installer, real HOME, decoy cwd and no mocks; verify that claim.
4. Any regression in P166, P167 or earlier behaviour?
5. The phase deliberately does NOT repair the remainder of the ~55-file parity gap
   observed on the Linux box, delivering only the computed closure. Is that boundary
   stated honestly in the artifacts, and is it the right boundary?

End with `GOAL_MET: YES` or `GOAL_MET: NO`, then a line that is exactly
`VERDICT: PASS` or `VERDICT: FAIL`. Bound yourself to about 18 shell commands and emit the
verdict even if incomplete. Max 600 words.

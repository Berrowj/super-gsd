---
phase: 170
plan: "170-05"
status: IN_PROGRESS
date: 2026-09-08
deployed: false
paired_plan: "170-06"
new_live_worker_attempts: 0
formal_phase_gates: NOT_CLAIMED
windows: OPEN_REQUIRED
---

# Linux repair execution evidence

The operator approved both the narrow Linux repairs and trustworthy Codex
accounting. Source work is in the existing linked development worktree. The
published/installed DEVCP revision remains `6b4581b`; the previous blocked
benchmark under 170-04 is not modified or superseded by fixture tests.

## Task 1: caller-selected native executable

Current state: implementation and both independent reviews passed. Combined
publication still waits for the remaining approved repairs/accounting work.

Native development tests use WSL Node 22.23.1 at
`/home/jackberrow/.local/node22/bin/node`, with native-only Node/system PATH.
No model turn or auth/toolchain change was used for this repair.

| Invocation | Observed result |
|---|---|
| Implementer baseline launch + install | 16 PASS, 0 FAIL, 0 SKIP |
| Main baseline launch + orchestration | 18 PASS, 0 FAIL, 0 SKIP; 79.053 s |
| New real-wrapper default-selector regressions before code | 0 PASS, 2 FAIL, 0 SKIP; both actual fake App Server exchanges used nvm instead of caller |
| Targeted selector/edge cases after initial patch | 6 PASS, 0 FAIL, 0 SKIP; 14.1 s |
| Initial isolated installed competing-binary case | 1 PASS, 0 FAIL, 0 SKIP; 58.4 s; installed-peer fixture path subsequently corrected, rerun required |
| Full launch after initial patch | 18 PASS, 0 FAIL, 0 SKIP; 109.3 s |

Counts are per invocation, not a combined unique-test total. Fake providers
exercise actual wrappers, profile resolution, process launch and report checks;
they do not establish native model availability or live supervisor latency.

Independent specification review found two real gaps, both held for repair:

1. Existing offline `--self-test-exit-priority` with required arguments and a
   missing explicit CLI returns 0 on HEAD but 3 with the initial bootstrap patch.
2. Blanket `--self-test` exemption skips pinning even for its online canary.
   Shell-only reproduction shows a pinned absolute incoming Node selector in
   ordinary mode but an unpinned basename in self-test mode before PATH recovery.

The remaining ordinary-dispatch clauses were satisfied in source review. The
two gaps, and a subsequent explicit-invalid self-test re-resolution hole, were
reproduced and repaired. Final independent specification re-review: PASS.

After those production fixes, standalone launch reported 21 PASS/0 FAIL/0 SKIP;
full worker suite 52 PASS/0 FAIL/2 SKIP (Windows-only transient-rename contention
and opt-in installed App Server initialization); board dispatch 8 PASS/0 FAIL/0
SKIP. Four Bash and two JS syntax checks plus diff whitespace checks passed.

Independent quality review found no production regression but one MEDIUM fixture
isolation issue: two tests assume `/usr/bin:/bin` has no Codex and inherit
`CODEX_HOME`. On another host that can select a real executable/auth. Repair to
fixture-only native tool PATH and isolated Codex home is complete. Independent
quality re-review: PASS, ready for integration. The implementer's final full
worker verification after that test-only change again reported 52 PASS/0 FAIL/2
intentional skips; final syntax and whitespace checks passed. Main independently
reran the three final isolation/diagnostic regressions: 3 PASS/0 FAIL/0 SKIP,
4.772 seconds. Main's fresh full `npm run test:codex-worker` then independently
passed: 52 PASS/0 FAIL/2 expected SKIP, 106.045 seconds, exit 0. The installed
empty-tree wrapper smoke actually ran. Final scoped `git diff --check` passed.

At 20:39 UTC an independent read-only DEVCP check confirmed clean source and
current Clarity pin at `6b4581b`, native Codex 0.153.2, and the original responding
global receiver PID 1293367 on unchanged ports. It reports partial capture and
no loaded fingerprint (old runtime). This is not a new benchmark or deployment.

## Task 2 behavioral baseline

The prior real Fable run took 83.9 seconds to apply a reply, exceeding the
30-second target while it diagnosed a failed peer. That remains primary RED.
A separate synthetic read-only instruction exercise using the current old skill
selected servicing the pending question first over 40-second diagnostics or a
35-second report validation. It produced correct exact-target command shapes and
kept receipts distinct from success, but no commands or timing were tested.
This synthetic PASS does not erase the real failure or prove the planned edit;
post-edit pressure checks and the later actual Fable benchmark remain required.

## Remaining work

- Task 2: priority-first Fable supervision and instruction pressure test.
- Task 3: Claude session identity flag and native Codex `event.kind` recognition,
  with honest missing-identity coverage.
- Paired 170-06: genuine native per-response accounting and owned same-port
  receiver transition; combined verification/publication/DEVCP acceptance.

No phase/milestone gate, all-instance freshness or complete coverage is claimed.

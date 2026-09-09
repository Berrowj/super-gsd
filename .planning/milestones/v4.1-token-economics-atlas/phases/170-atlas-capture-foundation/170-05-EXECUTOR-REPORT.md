---
phase: 170
plan: "170-05"
status: IN_PROGRESS
source_repairs: VERIFIED_LOCAL
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

Paired-plan checkpoint, 2026-09-09: all 170-06 source tasks now have independent
SPEC and QUALITY acceptance. Root combined native verification at 02:47-02:48
UTC passed worker 91/0/2, Atlas 89/0/4 plus nested 15/0/1, and board/routing
15/0/0. Complete propagation remains 59/7/2 with exactly the pre-existing
snapshot digest failures, not new worker/update failures. The 3,628-file input
manifest is `72286cd98a032d4af568cb8d8e31d540e71107c92f1ed2bda72b078664c46242`,
unchanged before/after. Full logs and review evidence are in the 170-06 report.
Combined publication/deployment/live acceptance remain pending; Windows and
formal phase gates remain open. New live attempts remain zero.

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

Task 2 static RED on `8181238` plus test-only edits: native Linux
`node --test super-gsd/tests/codex-worker/orchestration.test.cjs` reported
2 PASS/2 FAIL. The two failures identify the missing `priority-first` contract
in the worker skill and an orchestration entrypoint. Scoped instruction changes
are now in progress; no provider or remote operation was used.

Main independently ran the initial instruction patch: 4 PASS/0 FAIL/0 SKIP,
180.501 ms. Independent specification review found two gaps: the 30-second
wording measured another poll instead of applied reply, and the benchmark's
both-pending/challenge/hold exception was unstated. Two added regressions then
reported 4 PASS/2 FAIL before the instruction repair and 6 PASS/0 FAIL after it.
Main requested one final ordering clarification: wrong-project/owner checks
precede replies, but the duplicate-answer check follows the first applied reply.
That final ordering clause was reproduced as 5 PASS/1 FAIL and fixed to 6 PASS/0
FAIL. Independent specification re-review: PASS. Main independently reran the
corrected skill tests: 6 PASS/0 FAIL/0 SKIP, 226.568 ms, clean whitespace check.

Independent quality review: ready for integration, no blocking regression.
It identified one LOW static-coverage gap: removing the literal wrong-project/
wrong-owner clause or moving the duplicate check after the remaining reply still
passed the tests. Two test-only assertions now reject both in-memory mutants;
the production skill was never replaced for these checks. Main independently
reran the final suite: 6 PASS/0 FAIL/0 SKIP, 154.184 ms; diff check clean. The
small test-only correction also passed independent quality re-review: LOW
finding closed, ready for integration, both mutants independently rejected.

Updated-skill synthetic pressure exercise: the independent reviewer chose B's
pending ordinary question (observed 19 seconds ago) before A's 45-second failure
diagnostic and C's 40-second report validation; verified exact bindings, reply,
receipt and status without treating delivery as task success. It preserved the
both-pending/hold/negative-check order, generated nothing while only one question
was pending, and escalated a credential variant without manufacturing authority.
No control commands were executed. This is instruction-pressure evidence, not
actual Fable or measured latency; the prior 83.9-second behavioral RED remains.

## Task 3 native-input baseline

Before telemetry input changes, main ran native Linux `npm run test:atlas`:
57 PASS/0 FAIL/4 top-level SKIP, 68.863 seconds, exit 0. The nested custom runtime
suite separately reported 15 PASS/0 FAIL/1 SKIP. Skip reasons: three PowerShell
launcher cases on Linux, opt-in pinned stack installation, and nested opt-in real
stack lifecycle. The actual global empty-tree installer test ran. Runtime quota
p95 was 0.639 ms in this Linux invocation; this does not close Windows latency.

Task 3 RED before production edits: native runtime suite 14 PASS/1 FAIL/1
expected opt-in skip (`false` session-identity environment flag versus required
`true`); global receiver suite 9 PASS/1 FAIL (real-shaped `event.kind` completion
without an ID classified as `native_metadata_only` instead of explicit
`missing_stable_request_identity`). Synthetic legacy `kind` compatibility still
passed. Two minimal production input fixes are implemented: enable the identity
flag; recognize native `event.kind` with legacy `kind` fallback. The Codex fixture
uses native `conversation.id`/`timeUnixNano`, no request/response ID, and total
30 for input 23/output 7 (cache/reasoning are subsets). Repeated delivery remains
one coverage row, every usage field null, explicit missing-identity flag and no
privacy canaries. Audit semantics were not changed.

Implementer final Linux verification: runtime 15 PASS/0 FAIL/1 opt-in skip,
global 10 PASS/0 FAIL; full Atlas 58 PASS/0 FAIL/4 top-level skips, 75.260 seconds.
Main independently ran the final full Atlas snapshot: 58 PASS/0 FAIL/4 top-level
skips, 93.217 seconds, exit 0; nested runtime 15 PASS/0 FAIL/1 opt-in skip, quota
p95 0.639 ms. The same explicit skip reasons as the baseline apply; actual global
installation ran. Independent specification review PASS, focused native tests
2 PASS/0 FAIL; independent quality review PASS, ready for integration, no
findings. Its two focused receiver tests and independent native-key precedence,
legacy fallback and privacy-flag assertions passed. No provider turn or remote
write occurred.

## Remaining work

- Task 2 source/instruction pressure checks complete; actual Fable latency still
  requires the fresh bounded benchmark after the combined candidate is deployed.
- Tasks 1-3 source repairs are verified locally; their combined deployment/live
  acceptance still depends on the paired accounting and receiver-transition work.
- Paired 170-06: genuine native per-response accounting and owned same-port
  receiver transition; combined verification/publication/DEVCP acceptance.

No phase/milestone gate, all-instance freshness or complete coverage is claimed.

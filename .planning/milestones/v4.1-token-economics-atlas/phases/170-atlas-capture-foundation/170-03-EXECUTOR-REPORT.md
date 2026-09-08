---
phase: 170
plan: "170-03"
status: IMPLEMENTED_LOCAL
date: 2026-09-08
deployed: false
live_provider_roundtrip: NOT_RUN
formal_phase_gates: NOT_CLAIMED
---

# Codex Worker connection — local implementation handoff

The two-way worker connection is implemented and locally verified. Fable and
other owning units can supervise retained Codex App Server tasks through a
project inbox, answer pending questions, steer or stop the exact turn, and
recover task identity after compaction. The current orchestration contracts
require this background supervision loop. Real installed Fable behavior still
needs observation after the operator updates SGSD.

No commit, push, deployment, global authentication/profile change or phase close
was performed. Existing dirty Atlas and model-routing work was preserved.
Full access applies to SGSD-owned dispatch configuration, not deletion of Codex
installations or removal of controls from unrelated applications.

## Delivered

- All 10 role and 3 CLI profiles request `danger-full-access` / approval `never`;
  CLI sessions are retained. Models, effort, role contracts and profile-mutation
  confirmation remain explicit. Read-only-named legacy profiles are advisory,
  not OS-enforced read-only execution.
- Dependency-free Node App Server adapter, private atomic project mailbox and
  `status`, `reply`, `receipt`, `steer`, `stop` controls. Identity binds project,
  worker instance, thread, turn and request; pending questions and messages are
  bounded. No HTTP listener or automatically spawned Fable.
- Three existing wrappers, reviewer reruns and double-agent dispatches now use
  the adapter. The explicit provider-health canary remains a bounded one-shot
  diagnostic using full access; it is not a fallback task worker.
- Existing report/YAML validation, provider circuit, patch scope/application,
  Atlas registration and SGSD gates are retained. Immutable per-attempt
  `wrapper-result.json` distinguishes completed model turns from successful
  wrapper/patch outcomes and binds the exact report path/hash/bytes.
- Source and global installation paths deliver the runtime. Board descriptors
  embed the owning unit **during preparation**, including each round/retry;
  setting a different launch environment cannot override that explicit owner.
- `/sgsd-workers` and current orchestration/CEO contracts describe live inbox
  supervision, operator-only escalation, compaction recovery and validated-vote
  retention. These are instruction/scenario evidence, not proof of live Fable
  compliance.
- [Operator diagram and worked example](../../../../../reports/sgsd/2026-09-08-codex-worker-communication.html), plus
  [VTP papers/books cross-check](../../../../analyses/2026-09-08-worker-bridge-vtp-crosscheck.md).

## Fresh verification, 2026-09-08

Counts are per suite invocation, not a deduplicated grand total.

| Verification | Result |
|---|---|
| Windows core + permissions + orchestration tests | 29 PASS, 0 FAIL, 1 opt-in initialization SKIP |
| WSL same three files | 28 PASS, 0 FAIL, 2 SKIP (Windows rename injection and opt-in initialization) |
| WSL wrappers + board-dispatch + board-registry + Atlas launch | 24 PASS, 0 FAIL, 3 Windows-only SKIP |
| WSL isolated global worker installation against final atomic-publication core | 1 PASS; installed wrapper, receipt/hash, nested and flat controls exercised |
| WSL board-dispatch + board-registry + both model-routing files | 15 PASS, 0 FAIL |
| Windows codex-pro self-test | 21/21 PASS; actual resolver self-tests executed |
| Windows complete Atlas suites | 55 PASS, 0 FAIL, 6 platform/opt-in SKIP |
| WSL complete Atlas suites | 57 PASS, 0 FAIL, 4 platform/opt-in SKIP; real isolated global install included |
| Native installed Codex App Server initialization, explicitly opted in | 1 PASS, codex-cli 0.153.4, Windows 10.0.26100; no thread/model turn started |
| Hook dependency manifest | `--check-manifest`: current |
| Bash syntax, scoped JS syntax, `git diff --check` | PASS; existing PowerShell LF/CRLF notices only |
| HTML | Self-contained inline SVG; desktop/mobile checked; no remote assets/scripts/fonts |

Exact principal commands:

```text
node --test super-gsd/tools/codex-worker/worker.test.cjs super-gsd/tests/codex-worker/orchestration.test.cjs super-gsd/tests/codex-worker/permissions.test.cjs
node --test super-gsd/tests/codex-worker/launch.test.cjs super-gsd/scripts/lib/board-dispatch.test.cjs super-gsd/scripts/lib/board-registry.test.cjs super-gsd/tools/telemetry-atlas/launch.test.cjs
node --test super-gsd/tests/codex-worker/install.test.cjs
node --test super-gsd/scripts/lib/board-dispatch.test.cjs super-gsd/scripts/lib/board-registry.test.cjs super-gsd/tests/model-routing/model-routing-contract.test.cjs super-gsd/tests/model-routing/model-routing-resolution.test.cjs
node super-gsd/tools/codex-pro/run-self-test.cjs
node super-gsd/tools/telemetry-atlas/run-self-test.cjs
node super-gsd/scripts/lib/hook-install-contract.cjs --check-manifest
```

The WSL-specific commands ran in native Linux Node/Bash. The local initialization
test additionally used `SGSD_WORKER_LIVE_INIT=1` and `--test-name-pattern=local`;
the temporary flag was removed afterward. No live paid model conversation was
used as verification. An early pre-migration negative Windows-shim probe failed
with an invalid UNC working directory and no model response; subsequent wrapper
fixtures used isolated homes/PATH and the fake protocol peer.

## Independent review and fixed falsifiers

Specification then separate quality reviews passed for profiles and integration.
Core specification passed, including a final atomic-publication recheck; separate
core quality review passed with no remaining Critical/Important findings.
Instruction pressure scenarios passed for waiting input, lost task handles,
operator-only escalation/deadlines and retaining validated board votes.

Review/test failures were reproduced before fixes:

- A late or pre-acknowledgement turn could inherit another turn's report: report
  completion now must match the acknowledged turn identity.
- Older control outcomes could appear queued after receipt eviction: all 128
  permitted command receipts remain visible; rejected steering is receipted.
- Concurrent Windows record replacement could briefly fail: bounded atomic
  rename retry preserves the prior complete record; no delete/write fallback.
- WSL PATH could select Windows Git and misread Linux worktrees: native
  `/usr/bin/git` is preferred on WSL when available; unrelated roots still fail.
- Open-ended stdin/FIFO prompt input could hang before the worker timer:
  absolute CLI input deadline plus wrapper process-group watchdog now bounds it.
  Four real FIFO cases assert exit 5, no success marker and no live descendants.
- Inventory could observe a new UUID folder before `state.json`: creation now
  stages a complete private record then atomically publishes the directory;
  missing/corrupt already-published records still fail visibly.
- Board owner set only on launch was overridden by descriptor flags: consumer
  examples now bind and verify the owner during every descriptor preparation.

## Limits and migration requirements

1. **Not deployed or live-validated.** Run the existing SGSD update/install
   workflow only when the operator chooses. Then restart the owning session so
   it loads the updated contracts. Do not infer production readiness from this
   report or mark Phase 170 closed; formal spec/ATC/MUDA/release gates are not
   claimed here.
2. **Bash launch prerequisites matter on this Windows machine.** The three Bash
   wrappers require native POSIX/WSL Node and Codex (and GNU `timeout`). They
   explicitly reject Windows `.cmd`/`.exe` interoperability. The Node core has
   native Windows tests and CLI initialization evidence, but that does not make
   a mixed Windows/WSL wrapper launch supported. Keep worker launch and control
   polling in the same OS/path environment. Existing mixed-path project worker
   records are not portable across those environments.
3. **Experimental upstream surface.** Dynamic tools require compatible App
   Server support. Effective model and permission responses are checked; no
   model or one-shot fallback hides failure. Provider availability/entitlements
   for the selected wire model still require a real authorized launch.
4. **Recovery is explicit.** Normal timeout/stop/failure cleans up the owned
   process tree and claim. A hard-killed adapter can leave a thread claim that
   requires investigation/manual recovery. This is not automatic crash restart,
   distributed locking or exactly-once side-effect execution.
5. **Deadline overhead is explicit.** Wrapper input-open watchdog expires at
   configured timeout +3 seconds, sends process-group TERM, then KILL after
   another 2 seconds if required. Prompt collection consumes the core deadline.
6. **Full access is real access.** Worker identity checks prevent accidental
   routing errors, not access by another full-access OS process. Advisory roles
   and workflow gates are not OS isolation. New destructive/business authority
   still goes to the operator. Communication does not itself require unsandboxing.
7. **Atlas is separate.** Native content-free export configuration is forwarded;
   live installed App Server coverage is still unproven. Do not report every
   possible metric as captured. Weekly performance recommendations still need
   the planned complete observation windows and data-integrity checks.
8. **Prior board limitation remains.** Researcher's requested “Atlas” wire model
   is unresolved and stays explicitly blocked. No alias was invented and no
   substitution was made. Fable/Astra/Luna source routing remains as selected.

After update, observe one real question → exact reply → same-thread continuation
→ validated wrapper report, then test two projects and compaction recovery.
Record native Atlas coverage separately. The VTP cross-check supplies a bounded
live acceptance list and notes that its AHE paper copy is older than arXiv v4;
no VTP library/index mutation was performed.

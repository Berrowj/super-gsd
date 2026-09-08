---
phase: 170
plan: "170-05"
status: ACTIVE
authorized_by: operator
authorized_at: 2026-09-08
scope: DEVCP_LINUX_SOURCE_REPAIR
depends_on: "170-04"
paired_accounting_plan: "170-06"
formal_phase_close: NOT_CLAIMED
windows: OPEN_REQUIRED
---

# Linux worker selection and supervision repair implementation plan

> For agentic workers: use subagent-driven-development for the bounded source
> tasks, with specification review followed by quality review. The operator
> approved the written repair scope and both repair/accounting workstreams.
> Execute continuously; do not ask again whether to do the already approved work.

**Goal:** Fix the three evidenced Linux integration defects while preserving
native accounting truth, report contracts, permissions and existing sessions.

**Architecture:** Pin the native worker executable before shell PATH recovery;
make existing Fable supervision priority-first; restore required Claude identity
and faithfully detect Codex's native completion shape. A separate 170-06 plan
owns the additional native accounting source and receiver deployment transition.

**Tech Stack:** Bash, Node 22+ built-in tests, installed Codex App Server, SGSD's
existing Atlas normalizers and Claude instruction assets.

## Task 1: Preserve the caller-selected native worker executable

Files: `super-gsd/scripts/lib/codex-worker-shell.sh`,
`super-gsd/scripts/codex-exec.sh`, `super-gsd/scripts/codex-executor.sh`,
`super-gsd/scripts/codex-patch-executor.sh`,
`super-gsd/tests/codex-worker/launch.test.cjs`,
`super-gsd/tests/codex-worker/install.test.cjs`.

- [ ] Run the existing Linux wrapper/installation baseline with native Node.
  The development worktree is already linked; do not create another worktree,
  change host toolchain/configuration, or modify `.planning/tmp/`.
- [ ] Extend the isolated native fixture with a user-local executable and a
  competing nvm executable. Let the original PATH select the user-local one,
  and assert which executable actually receives the App Server frames. Remove
  the fixture's absolute `SGSD_CODEX_APP_SERVER_COMMAND` override for default
  discovery tests. Both review and executor must reproduce the old selection
  before production code changes. The fake peer may remain the provider boundary;
  exercise real wrappers, profile resolution, process launch and report checks.

  Core assertion using the existing fixture/report helpers:

  ```js
  assert.equal(result.code, 0, result.stderr);
  assert.equal(fs.readFileSync(selectedExecutableLog, 'utf8').trim(), 'caller');
  assert.equal(frames(f).filter(frame => frame.method === 'turn/start').length, 1);
  ```

- [ ] Add a shared bootstrap function and invoke it before profile/Node work in
  all three wrappers. Selection precedence stays:

  ```bash
  SGSD_SELECTED_COMMAND="${SGSD_CODEX_APP_SERVER_COMMAND:-${SGSD_CODEX_COMMAND:-codex}}"
  ```

  Resolve the incoming selector before modifying PATH. A found executable must
  be normalized to an absolute path before any workspace change, and exported
  as `SGSD_CODEX_APP_SERVER_COMMAND` so `run.cjs` launches exactly that selection.
  Preserve the existing prefix-argument JSON mechanism. Recover native Node
  separately using existing user-local/nvm discovery. Only default discovery may
  use a native fallback when the incoming PATH has no native CLI. An explicit
  invalid or interop selector remains a visible failure, not a fallback.
  Do not introduce `eval`, shell command strings, version-based CLI selection,
  one-shot fallback, model substitution, installation or removal.
- [ ] Protect explicit absolute/basename override precedence, quoted/spaced and
  relative executable paths, native shebangs, Node available only in nvm,
  invalid explicit selectors and Windows/WSL interop refusal. Preserve `--help`
  and offline self-test behavior when no real Codex is installed. Include patch
  wrapper coverage and the isolated installed wrapper's competing-binary case.
- [ ] Verify GREEN on the new tests, existing worker suite, board dispatch and
  Linux install contracts. Use these bounded commands from the repository root:

  ```bash
  node --test super-gsd/tests/codex-worker/launch.test.cjs
  node --test super-gsd/tests/codex-worker/install.test.cjs
  npm run test:codex-worker
  npm run test:board-dispatch
  ```

  Expected: no failures; native Bash launch/install tests actually run. Record
  precise counts/skips and RED/GREEN evidence. Commit only task-owned paths after
  independent specification and quality review; no push in the implementer task.

## Task 2: Make worker questions the supervisor's first priority

Files: `super-gsd/skills/sgsd-workers/SKILL.md`,
`super-gsd/tests/codex-worker/orchestration.test.cjs`, and only the existing
worker-supervision paragraphs in `super-gsd/CLAUDE-OVERLAY.md`, `CLAUDE.md`,
`super-gsd/skills/sgsd-orchestrate/SKILL.md`,
`super-gsd/skills/sgsd-deliberate/SKILL.md`,
`super-gsd/skills/sgsd-codex-control/SKILL.md`, `super-gsd/agents/sgsd-ceo.md`.

- [ ] Read the skill-writing instructions before editing any SKILL.md. The prior
  actual-Fable 83.9-second failure is behavioral RED evidence. Add a static
  regression requiring `priority-first`, prelaunch preparation and explicitly
  deferred unrelated diagnostics; run it and observe the missing contract.

  ```js
  assert.match(text, /priority-first/);
  assert.match(text, /before launching/i);
  assert.match(text, /defer unrelated diagnostics/i);
  ```

- [ ] Update the existing supervision loop: prepare absolute control paths,
  dispatch bindings and schemas before launch; check owned inboxes before
  lengthy reading/report work; service pending questions before diagnosing a
  failed peer. Poll every 5-10 seconds, with the unchanged 30-second target.
  Once both benchmark questions are pending, retain the required five-second
  hold and exact-target negative tests. Never precompute challenge answers.
- [ ] Preserve operator-only escalation, normal safe-source answers, stale/
  duplicate rejection, receipt-versus-success distinctions and report gates.
  No automatic answer generator, second Fable, new broad supervisor daemon,
  model/effort change or time-target relaxation. Keep the worker skill concise
  and its existing XML structure and under-200-line contract.
- [ ] Run `node --test super-gsd/tests/codex-worker/orchestration.test.cjs`;
  expected no failures. Static GREEN establishes instruction presence, not live
  latency. Live proof remains in the later fresh bounded benchmark. Review and
  commit task-owned paths only.

## Task 3: Repair the existing native telemetry inputs

Files: `super-gsd/tools/telemetry-atlas/lifecycle.cjs`,
`super-gsd/tools/telemetry-atlas/codex-otlp.cjs`,
`super-gsd/tools/telemetry-atlas/runtime.test.cjs`,
`super-gsd/tools/telemetry-atlas/global.test.cjs`,
`super-gsd/tools/telemetry-atlas/receiver.test.cjs` if integration coverage needs
extension. Do not change audit semantics in this task.

- [ ] Add an environment-to-native-shaped-Claude-log regression with required
  session identity; update the old false-flag assertion and observe RED:

  ```js
  assert.equal(environment.OTEL_METRICS_INCLUDE_SESSION_ID, 'true');
  assert.equal(normalized.events[0].identity.session_id, 'fixture-session');
  ```

- [ ] Emit `OTEL_METRICS_INCLUDE_SESSION_ID: 'true'`. Keep account/raw content
  suppression and the finite downstream metric label allowlist unchanged.
- [ ] Add a real-shaped Codex completion fixture with `event.kind`, native
  `*_token_count` fields and no provider ID. Observe RED because the old parser
  misses the completion classification; then recognize the native key while
  preserving explicitly supported compatibility input. Without request identity
  the existing OTEL path must still return coverage, null accounting usage and
  `missing_stable_request_identity`; do not silently turn it into billable usage.
- [ ] Clearly distinguish synthetic ID-bearing parser tests from the observed
  installed provider schema. Verify privacy canaries, native label stripping,
  idempotence and missing-data flags using existing fixtures.
- [ ] Run the affected test files and `npm run test:atlas`; require no Linux
  failures, record every skip, retain the known Windows latency issue. Review
  and commit the source fixes separately from the 170-06 accounting extension.

## Verification and handoff

- [ ] Record changes, RED/GREEN commands, reviews and actual limitations in
  `170-05-EXECUTOR-REPORT.md`. Do not mark formal phase/milestone gates passed.
- [ ] Pair with the 170-06 accounting work before claiming the requested result
  is working. Its design must use supported native identities and handle
  receiver loaded-revision transition. No benchmark criterion may be relaxed to
  hide missing request identities or data.
- [ ] Publish/deploy only the reviewed, verified combined candidate under the
  operator's existing DEVCP authorization. Recheck upstream and dirty source,
  use normal fast-forward publication/updater, preserve all old panes/pins and
  project configuration. No force push, broad cleanup or auth/model changes.
- [ ] Run the unchanged bounded B0-B7 benchmark in one fresh normal-launcher
  Fable session after installation/runtime revision proof. Maximum five live
  wrapper attempts, 180 seconds per attempt and 20 minutes live total. Preserve
  the previous failed benchmark as historical evidence. No extra paid probes,
  automatic retries or provider substitutions. Report bridge, observed capture
  and all-instance rollout separately; Windows remains required.

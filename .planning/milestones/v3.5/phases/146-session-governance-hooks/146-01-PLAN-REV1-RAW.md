codex-exec: report contract violation

--- codex stdout ---
```markdown
---
schema_version: 2
plan_id: P146
plan_revision: 1
milestone: v3.5
phase: 146-session-governance-hooks
title: Session Governance Hooks
status: LOCKED
expected_ATC_tier: GATE
intent: Always-On Orchestration - governance as runtime mechanism in all session modes.
rollback_plan:
  - Disable the hook registry entry added by this phase and restore prior Claude/Warp session behavior.
  - Leave append-only evidence ledgers intact; do not truncate `.planning/metrics/*.jsonl`.
  - If a hook entrypoint regresses startup, remove only the P146 registry binding and keep the standalone scripts/tests for diagnosis.
  - If cockpit reader rendering regresses, disable the P146 reader registration while preserving PostToolUse producer rows for later replay.
---

# P146 Plan REVISION 1 - Session Governance Hooks

## Board Binding

- Milestone: `v3.5`
- Phase: `146-session-governance-hooks`
- Plan file: `.planning/milestones/v3.5/phases/146-session-governance-hooks/146-01-PLAN-LOCKED.md`
- Expected ATC tier: `GATE`
- Scope lock: always-on session governance hooks only; no release gate duplication, no milestone state mutation, no unrelated cockpit redesign.
- Dispatch constraint: Codex executor dispatches are serial with exclusive workspace writes. The task DAG below is a total order.

## Source Audit

Retained from the locked draft. Do not re-derive research during execution.

- `.planning/STATE.md` is the canonical active milestone/phase/plan source.
- `.planning/milestones/v3.5/ROADMAP.md` is the active milestone roadmap source.
- `super-gsd/registry/gates.yaml` is the canonical gate registry. P146 must call/read existing gate definitions and must not re-implement gates.
- `.planning/metrics/*.jsonl` are append-only evidence ledgers.
- Existing cockpit adapters/readers are the model for surfacing runtime evidence.
- Hook behavior must degrade gracefully when optional VTP/private KB inputs are absent.

## VTP Directives

- Governance must become runtime behavior in all session modes, not a doc-only checklist.
- AC-146c is incomplete without a reader. The PostToolUse producer and cockpit/MCP reader both remain inside P146.
- VTP/private KB integration is optional and must degrade gracefully when absent.
- Do not duplicate SGSD gates. Read registry/state and route to existing mechanisms.

## Shared File Ownership

- `super-gsd/registry/session-governance-hooks.yaml` is owned by `T146-07` only. Earlier tasks create entrypoints but do not edit this registry.
- `super-gsd/tools/session-governance/gate-evidence-log.cjs` is owned by `T146-05` only.
- `.planning/metrics/gate-evidence.jsonl` is an append-only runtime target owned by `T146-05`. `T146-06` may read it but must not edit source fixtures or seed committed rows.
- Shared state/context helpers are owned by `T146-01` only. Later tasks import them without modifying them.
- Reader/cockpit integration files are owned by `T146-06` only.

## PostToolUse Mutation Matcher

The PostToolUse producer must match only these Claude Code file mutation tool names in this harness:

- `Edit`
- `Write`
- `NotebookEdit`

There is no `MultiEdit` in this harness. Do not match it.

Unknown tool names, non-mutating tool names, malformed payloads, absent file paths, or paths outside the repo root are match-misses: append no row, exit `0`, and never block the session.

## Semantic Acceptance Criteria

### AC-146a - SessionStart Real State Injection

A stub cannot satisfy this criterion.

Construct a temporary repo fixture whose `.planning/STATE.md` frontmatter contains a sentinel phase number that the implementation cannot guess, for example `phase: 873-sentinel-session-governance`, `milestone: v9.9-sentinel`, and `active_plan: P873-sentinel`. Add a temp `super-gsd/registry/gates.yaml` with a sentinel gate id.

Run the real SessionStart hook entrypoint against that temp root through the same invocation shape used by hook registration, not through a `--self-test` shortcut. The emitted first-response/session contract must contain values derived from real reads of the temp `STATE.md` and temp gate registry, including the phase number `873`, sentinel milestone, active plan, and sentinel gate id. Hardcoded SessionStart text fails.

The criterion also asserts graceful degradation: when optional VTP/private KB inputs are absent from the temp repo, the hook still emits the state-derived contract and exits `0`.

Trace: `T146-01`, `T146-02`, `T146-07`, `T146-08`.

### AC-146b - Prompt Classifier Route-Only Positive And Negative Controls

A stub cannot satisfy this criterion.

Using the same kind of temp repo fixture with sentinel phase `873`, run the real prompt-classifier hook entrypoint twice:

- Positive control: a planning/governance prompt such as `revise the phase 873 plan and run SGSD triage` must emit a route-only directive naming `/sgsd-triage` and include state-derived sentinel context from the temp repo.
- Negative control: an execution/trivial prompt such as `what is 2+2?` or `fix this typo in the file already open` must emit no `/sgsd-triage` directive and append no governance evidence row.

Route-only means the classifier suggests/directs the operator to the existing `/sgsd-triage` path; it must not invoke triage, mutate files, run gates, or synthesize gate results itself. A hardcoded `/sgsd-triage` emitter fails the negative control.

Trace: `T146-01`, `T146-03`, `T146-04`, `T146-07`, `T146-08`.

### AC-146c - Real PostToolUse Evidence And Reader Consumption

A stub cannot satisfy this criterion.

Construct a temp repo fixture with sentinel phase `873`, a plan file under that phase, and an empty `.planning/metrics/gate-evidence.jsonl`. Drive a real PostToolUse JSON payload through the real hook entrypoint on stdin, not through `--self-test`.

The positive payload must use one supported mutation tool name, starting with `Edit`, and a file path inside the sentinel phase. The appended JSONL row must match the temp repo-derived values: event name, tool name, repo-relative path, milestone, phase number `873`, phase slug, plan/evidence file identity, and timestamp/schema fields. The verification must then run the real reader/cockpit adapter against that same temp ledger row and assert the row is consumed into the cockpit/MCP evidence model. Fixtures alone do not satisfy the reader proof.

The matcher must also be tested with `Write` and `NotebookEdit`. A negative payload using `MultiEdit` or `Read` must exit `0` and append no row.

Trace: `T146-01`, `T146-05`, `T146-06`, `T146-07`, `T146-08`.

### AC-146d - Hook Registry Wiring

The registry must bind the real entrypoints for SessionStart, prompt classification, and PostToolUse evidence capture. Verification must load `super-gsd/registry/session-governance-hooks.yaml`, resolve each referenced script, and execute each against a constructed temp fixture. Registry presence without executable entrypoints fails.

Trace: `T146-07`, `T146-08`.

### AC-146e - Latency Evidence

The benchmark proof cannot rely on `--bench` exit `0`.

The bench verification must append a JSONL bench row, parse that row, assert `iterations` equals the requested iteration count, assert `p95_ms` is present and numeric, and fail if `p95_ms >= 1000`.

Trace: `T146-08`.

## Task DAG

### T146-01 - State And Fixture Contracts

depends_on: `[]`

Owns shared state/context helpers and deterministic temp fixture builders. Implement real parsers/readers for `.planning/STATE.md` and `super-gsd/registry/gates.yaml`; do not hardcode phase, milestone, plan, or gate values.

files_touched:
- `super-gsd/tools/session-governance/state-context.cjs`
- `super-gsd/tests/session-governance/temp-fixture.cjs`
- `super-gsd/tests/session-governance/state-context.contract.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/state-context.contract.test.cjs"`

AC trace: `AC-146a`, `AC-146b`, `AC-146c`.

### T146-02 - SessionStart First-Response Entrypoint

depends_on: `[T146-01]`

Implement the SessionStart hook entrypoint. It must read state and gate registry through `state-context.cjs`, emit the first-response/session contract from derived values, and tolerate absent optional VTP/private KB inputs.

files_touched:
- `super-gsd/tools/session-governance/session-start.cjs`
- `super-gsd/tests/session-governance/session-start.real-entrypoint.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/session-start.real-entrypoint.test.cjs"`

AC trace: `AC-146a`.

### T146-03 - Prompt Classifier Entrypoint

depends_on: `[T146-02]`

Implement the prompt-classifier hook entrypoint. It must emit `/sgsd-triage` only for planning/governance prompts and remain silent for execution/trivial prompts. It must never invoke triage or mutate files.

files_touched:
- `super-gsd/tools/session-governance/prompt-classifier.cjs`
- `super-gsd/tests/session-governance/prompt-classifier.route-only.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/prompt-classifier.route-only.test.cjs"`

AC trace: `AC-146b`.

### T146-04 - `/sgsd-triage` Command Contract

depends_on: `[T146-03]`

Implement or update the `/sgsd-triage` command contract used by the classifier. It must route to existing SGSD triage/gate mechanisms and must not duplicate gate logic.

files_touched:
- `super-gsd/tools/session-governance/sgsd-triage-command.cjs`
- `super-gsd/tests/session-governance/sgsd-triage-command.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/sgsd-triage-command.test.cjs"`

AC trace: `AC-146b`.

### T146-05 - PostToolUse Evidence Producer

depends_on: `[T146-04]`

Implement the real PostToolUse evidence producer. Match only `Edit`, `Write`, and `NotebookEdit`. Append one row to the repo-local `.planning/metrics/gate-evidence.jsonl` only for matched in-repo mutation payloads. Unknown or unsupported tools are match-misses: no row, exit `0`, never block.

files_touched:
- `super-gsd/tools/session-governance/gate-evidence-log.cjs`
- `super-gsd/tests/session-governance/post-tool-use-producer.real-entrypoint.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/post-tool-use-producer.real-entrypoint.test.cjs"`

AC trace: `AC-146c`.

### T146-06 - Gate Evidence Reader And Cockpit Adapter

depends_on: `[T146-05]`

Implement the reader side for the rows produced by `T146-05`. The reader must consume real JSONL rows from `.planning/metrics/gate-evidence.jsonl` in a temp repo and expose them through the cockpit/MCP evidence model. Do not seed committed fixture rows.

files_touched:
- `super-gsd/tools/session-governance/gate-evidence-reader.cjs`
- `super-gsd/cockpit/adapters/session-governance-evidence.cjs`
- `super-gsd/tests/session-governance/gate-evidence-reader.real-row.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/gate-evidence-reader.real-row.test.cjs"`

AC trace: `AC-146c`.

### T146-07 - Hook Registry Binding

depends_on: `[T146-06]`

Create the session-governance hook registry binding. This task owns `session-governance-hooks.yaml` and only registers entrypoints created by prior tasks. It must not modify producer, reader, classifier, or shared helper code.

files_touched:
- `super-gsd/registry/session-governance-hooks.yaml`
- `super-gsd/tests/session-governance/hook-registry.integration.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/hook-registry.integration.test.cjs"`

AC trace: `AC-146a`, `AC-146b`, `AC-146c`, `AC-146d`.

### T146-08 - End-To-End Gate And Latency Verification

depends_on: `[T146-07]`

Implement the final end-to-end verification that runs the registry-resolved hooks against temp fixtures and validates bench evidence by parsing the JSONL row. The latency check must assert the row exists, `iterations` equals the requested count, `p95_ms` exists, and `p95_ms < 1000`.

files_touched:
- `super-gsd/tests/session-governance/end-to-end-and-bench.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/end-to-end-and-bench.test.cjs"`

AC trace: `AC-146a`, `AC-146b`, `AC-146c`, `AC-146d`, `AC-146e`.

## Final Verification

Run after `T146-08`:

`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/state-context.contract.test.cjs; node super-gsd/tests/session-governance/session-start.real-entrypoint.test.cjs; node super-gsd/tests/session-governance/prompt-classifier.route-only.test.cjs; node super-gsd/tests/session-governance/sgsd-triage-command.test.cjs; node super-gsd/tests/session-governance/post-tool-use-producer.real-entrypoint.test.cjs; node super-gsd/tests/session-governance/gate-evidence-reader.real-row.test.cjs; node super-gsd/tests/session-governance/hook-registry.integration.test.cjs; node super-gsd/tests/session-governance/end-to-end-and-bench.test.cjs"`

## Deferred Items

- DEFERRED-A: Broader non-Claude harness support remains out of scope for P146.
- DEFERRED-B: Rich cockpit UX beyond consuming and rendering the P146 evidence stream remains out of scope.
- DEFERRED-C: Historical ledger backfill remains out of scope; P146 validates new runtime rows only.
- DEVIATION-1: P146 uses route-only `/sgsd-triage` direction instead of auto-running triage from the classifier.
- DEVIATION-W: Windows-safe, network-free verification is mandatory; POSIX-only scripts or network-backed checks are not acceptable.
```

--- codex stderr ---
OpenAI Codex v0.146.0
--------
workdir: $env:USERPROFILE\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\cholla-racer
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: xhigh
reasoning summaries: none
session id: 019fd491-3707-7390-aba0-6b9024fa3ad4
--------
user
# P146 Plan REVISION 1 — resolve NOGO (3 CRITICAL, 2 WARNING)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

Your prior draft is at
`.planning/milestones/v3.5/phases/146-session-governance-hooks/146-01-PLAN-LOCKED.md`
(schema-v2 VALID). The combined plan-check + ATC/MUDA gate returned **NOGO**.
Produce a REVISED plan that resolves every finding. Output the COMPLETE revised
plan file inside ONE fenced ```markdown block (the sandbox cannot write files).
Do not output anything else. Do NOT run commands. Do NOT re-derive research.

## Findings you must resolve

**CRIT-1 (stub-satisfiable ACs).** AC-146a/b/c can pass with stubs: hardcoded
SessionStart text, hardcoded `/sgsd-triage`, and `--self-test` gate/adapter
success prove nothing about real sg hook wiring, first-response injection,
route-only behavior, real PostToolUse evidence, or cockpit refresh.
→ Rewrite those semantic_acceptance_criteria so a stub CANNOT pass. Techniques
  available to you (pick what fits, justify inline):
  - Assert content that only real STATE/registry reads could produce — e.g.
    the contract must contain the phase number parsed from a TEMP repo whose
    STATE says a value no stub would guess (e.g. 873), proving a real read.
  - For the classifier, assert BOTH a positive (planning prompt → directive)
    and a NEGATIVE control (execution/trivial prompt → NO directive) in the
    same criterion, so a hardcoded emitter fails the negative.
  - For the quality gate, drive it with a REAL PostToolUse payload through the
    real hook entrypoint (not a `--self-test` flag), then assert the appended
    JSONL row's field values match the temp repo's phase/file, and have the
    cockpit reader consume THAT row (not a fixture).
  - Prefer "run the real entrypoint against a constructed temp fixture and
    assert derived values" over "call a self-test flag and trust exit 0".
  Self-test flags may still exist as developer conveniences, but they must not
  be the proof surface for an AC.

**CRIT-2 (punted decision).** The real PostToolUse mutation tool names are not
decided — the plan tells the executor to confirm them during T146-05.
→ DECIDE now. The live harness tool set for file mutation in this Claude Code
  version is: `Edit`, `Write`, `NotebookEdit` (there is NO `MultiEdit` in this
  harness). State the matcher explicitly in the plan and state the degradation
  rule if an unknown tool name appears (match-miss → no row, exit 0, never
  block). If you believe additional names apply, name them and say why.

**CRIT-3 (DAG/file collision).** T146-03/04/05 overlap on
`gate-evidence-log.cjs`, `.planning/metrics/gate-evidence.jsonl`, and
`session-governance-hooks.yaml`; T146-03/05 also overlap shared state helpers.
Codex executor dispatches are SERIAL with exclusive workspace write access, so
this must be an explicit total order, not an implied one.
→ Give every task an explicit `depends_on` chain producing a single valid
  serial order, and make `files_touched` disjoint per task where possible. Any
  file legitimately touched by two tasks must be created in the EARLIER task
  and only appended-to/registered-in the later one — say which task OWNS each
  shared file.

**WARN-1 (latency not actually asserted).** The bench criterion only trusts
`--bench` exit 0.
→ Make the verification parse the recorded `p95_ms` from the JSONL row and
  fail if it is absent or >= 1000. Assert the row exists with the iteration
  count too.

**WARN-2 (T146-05 oversized).** It bundles PostToolUse producer logic, registry
work, cockpit adapter, MCP reader, shared helpers, and evidence-stream
behavior.
→ Split into producer and reader tasks, both remaining inside P146 (VTP
  directive: AC-146c is incomplete without a reader — do NOT defer the reader).

## Preserve from the current draft
schema-v2 validity (SCHEMA-09/-10: real-data semantic_acceptance_criteria and
rollback_plan required), the board-binding constraints, the VTP directives, the
Source Audit section, the deferred-items list (DEFERRED-A/B/C, DEVIATION-1,
DEVIATION-W), and `expected_ATC_tier: GATE`.

Task count may grow (7–8 is fine). Every task still needs a deterministic,
Windows-safe, network-free verification command and an AC-146 letter trace.

codex
```markdown
---
schema_version: 2
plan_id: P146
plan_revision: 1
milestone: v3.5
phase: 146-session-governance-hooks
title: Session Governance Hooks
status: LOCKED
expected_ATC_tier: GATE
intent: Always-On Orchestration - governance as runtime mechanism in all session modes.
rollback_plan:
  - Disable the hook registry entry added by this phase and restore prior Claude/Warp session behavior.
  - Leave append-only evidence ledgers intact; do not truncate `.planning/metrics/*.jsonl`.
  - If a hook entrypoint regresses startup, remove only the P146 registry binding and keep the standalone scripts/tests for diagnosis.
  - If cockpit reader rendering regresses, disable the P146 reader registration while preserving PostToolUse producer rows for later replay.
---

# P146 Plan REVISION 1 - Session Governance Hooks

## Board Binding

- Milestone: `v3.5`
- Phase: `146-session-governance-hooks`
- Plan file: `.planning/milestones/v3.5/phases/146-session-governance-hooks/146-01-PLAN-LOCKED.md`
- Expected ATC tier: `GATE`
- Scope lock: always-on session governance hooks only; no release gate duplication, no milestone state mutation, no unrelated cockpit redesign.
- Dispatch constraint: Codex executor dispatches are serial with exclusive workspace writes. The task DAG below is a total order.

## Source Audit

Retained from the locked draft. Do not re-derive research during execution.

- `.planning/STATE.md` is the canonical active milestone/phase/plan source.
- `.planning/milestones/v3.5/ROADMAP.md` is the active milestone roadmap source.
- `super-gsd/registry/gates.yaml` is the canonical gate registry. P146 must call/read existing gate definitions and must not re-implement gates.
- `.planning/metrics/*.jsonl` are append-only evidence ledgers.
- Existing cockpit adapters/readers are the model for surfacing runtime evidence.
- Hook behavior must degrade gracefully when optional VTP/private KB inputs are absent.

## VTP Directives

- Governance must become runtime behavior in all session modes, not a doc-only checklist.
- AC-146c is incomplete without a reader. The PostToolUse producer and cockpit/MCP reader both remain inside P146.
- VTP/private KB integration is optional and must degrade gracefully when absent.
- Do not duplicate SGSD gates. Read registry/state and route to existing mechanisms.

## Shared File Ownership

- `super-gsd/registry/session-governance-hooks.yaml` is owned by `T146-07` only. Earlier tasks create entrypoints but do not edit this registry.
- `super-gsd/tools/session-governance/gate-evidence-log.cjs` is owned by `T146-05` only.
- `.planning/metrics/gate-evidence.jsonl` is an append-only runtime target owned by `T146-05`. `T146-06` may read it but must not edit source fixtures or seed committed rows.
- Shared state/context helpers are owned by `T146-01` only. Later tasks import them without modifying them.
- Reader/cockpit integration files are owned by `T146-06` only.

## PostToolUse Mutation Matcher

The PostToolUse producer must match only these Claude Code file mutation tool names in this harness:

- `Edit`
- `Write`
- `NotebookEdit`

There is no `MultiEdit` in this harness. Do not match it.

Unknown tool names, non-mutating tool names, malformed payloads, absent file paths, or paths outside the repo root are match-misses: append no row, exit `0`, and never block the session.

## Semantic Acceptance Criteria

### AC-146a - SessionStart Real State Injection

A stub cannot satisfy this criterion.

Construct a temporary repo fixture whose `.planning/STATE.md` frontmatter contains a sentinel phase number that the implementation cannot guess, for example `phase: 873-sentinel-session-governance`, `milestone: v9.9-sentinel`, and `active_plan: P873-sentinel`. Add a temp `super-gsd/registry/gates.yaml` with a sentinel gate id.

Run the real SessionStart hook entrypoint against that temp root through the same invocation shape used by hook registration, not through a `--self-test` shortcut. The emitted first-response/session contract must contain values derived from real reads of the temp `STATE.md` and temp gate registry, including the phase number `873`, sentinel milestone, active plan, and sentinel gate id. Hardcoded SessionStart text fails.

The criterion also asserts graceful degradation: when optional VTP/private KB inputs are absent from the temp repo, the hook still emits the state-derived contract and exits `0`.

Trace: `T146-01`, `T146-02`, `T146-07`, `T146-08`.

### AC-146b - Prompt Classifier Route-Only Positive And Negative Controls

A stub cannot satisfy this criterion.

Using the same kind of temp repo fixture with sentinel phase `873`, run the real prompt-classifier hook entrypoint twice:

- Positive control: a planning/governance prompt such as `revise the phase 873 plan and run SGSD triage` must emit a route-only directive naming `/sgsd-triage` and include state-derived sentinel context from the temp repo.
- Negative control: an execution/trivial prompt such as `what is 2+2?` or `fix this typo in the file already open` must emit no `/sgsd-triage` directive and append no governance evidence row.

Route-only means the classifier suggests/directs the operator to the existing `/sgsd-triage` path; it must not invoke triage, mutate files, run gates, or synthesize gate results itself. A hardcoded `/sgsd-triage` emitter fails the negative control.

Trace: `T146-01`, `T146-03`, `T146-04`, `T146-07`, `T146-08`.

### AC-146c - Real PostToolUse Evidence And Reader Consumption

A stub cannot satisfy this criterion.

Construct a temp repo fixture with sentinel phase `873`, a plan file under that phase, and an empty `.planning/metrics/gate-evidence.jsonl`. Drive a real PostToolUse JSON payload through the real hook entrypoint on stdin, not through `--self-test`.

The positive payload must use one supported mutation tool name, starting with `Edit`, and a file path inside the sentinel phase. The appended JSONL row must match the temp repo-derived values: event name, tool name, repo-relative path, milestone, phase number `873`, phase slug, plan/evidence file identity, and timestamp/schema fields. The verification must then run the real reader/cockpit adapter against that same temp ledger row and assert the row is consumed into the cockpit/MCP evidence model. Fixtures alone do not satisfy the reader proof.

The matcher must also be tested with `Write` and `NotebookEdit`. A negative payload using `MultiEdit` or `Read` must exit `0` and append no row.

Trace: `T146-01`, `T146-05`, `T146-06`, `T146-07`, `T146-08`.

### AC-146d - Hook Registry Wiring

The registry must bind the real entrypoints for SessionStart, prompt classification, and PostToolUse evidence capture. Verification must load `super-gsd/registry/session-governance-hooks.yaml`, resolve each referenced script, and execute each against a constructed temp fixture. Registry presence without executable entrypoints fails.

Trace: `T146-07`, `T146-08`.

### AC-146e - Latency Evidence

The benchmark proof cannot rely on `--bench` exit `0`.

The bench verification must append a JSONL bench row, parse that row, assert `iterations` equals the requested iteration count, assert `p95_ms` is present and numeric, and fail if `p95_ms >= 1000`.

Trace: `T146-08`.

## Task DAG

### T146-01 - State And Fixture Contracts

depends_on: `[]`

Owns shared state/context helpers and deterministic temp fixture builders. Implement real parsers/readers for `.planning/STATE.md` and `super-gsd/registry/gates.yaml`; do not hardcode phase, milestone, plan, or gate values.

files_touched:
- `super-gsd/tools/session-governance/state-context.cjs`
- `super-gsd/tests/session-governance/temp-fixture.cjs`
- `super-gsd/tests/session-governance/state-context.contract.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/state-context.contract.test.cjs"`

AC trace: `AC-146a`, `AC-146b`, `AC-146c`.

### T146-02 - SessionStart First-Response Entrypoint

depends_on: `[T146-01]`

Implement the SessionStart hook entrypoint. It must read state and gate registry through `state-context.cjs`, emit the first-response/session contract from derived values, and tolerate absent optional VTP/private KB inputs.

files_touched:
- `super-gsd/tools/session-governance/session-start.cjs`
- `super-gsd/tests/session-governance/session-start.real-entrypoint.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/session-start.real-entrypoint.test.cjs"`

AC trace: `AC-146a`.

### T146-03 - Prompt Classifier Entrypoint

depends_on: `[T146-02]`

Implement the prompt-classifier hook entrypoint. It must emit `/sgsd-triage` only for planning/governance prompts and remain silent for execution/trivial prompts. It must never invoke triage or mutate files.

files_touched:
- `super-gsd/tools/session-governance/prompt-classifier.cjs`
- `super-gsd/tests/session-governance/prompt-classifier.route-only.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/prompt-classifier.route-only.test.cjs"`

AC trace: `AC-146b`.

### T146-04 - `/sgsd-triage` Command Contract

depends_on: `[T146-03]`

Implement or update the `/sgsd-triage` command contract used by the classifier. It must route to existing SGSD triage/gate mechanisms and must not duplicate gate logic.

files_touched:
- `super-gsd/tools/session-governance/sgsd-triage-command.cjs`
- `super-gsd/tests/session-governance/sgsd-triage-command.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/sgsd-triage-command.test.cjs"`

AC trace: `AC-146b`.

### T146-05 - PostToolUse Evidence Producer

depends_on: `[T146-04]`

Implement the real PostToolUse evidence producer. Match only `Edit`, `Write`, and `NotebookEdit`. Append one row to the repo-local `.planning/metrics/gate-evidence.jsonl` only for matched in-repo mutation payloads. Unknown or unsupported tools are match-misses: no row, exit `0`, never block.

files_touched:
- `super-gsd/tools/session-governance/gate-evidence-log.cjs`
- `super-gsd/tests/session-governance/post-tool-use-producer.real-entrypoint.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/post-tool-use-producer.real-entrypoint.test.cjs"`

AC trace: `AC-146c`.

### T146-06 - Gate Evidence Reader And Cockpit Adapter

depends_on: `[T146-05]`

Implement the reader side for the rows produced by `T146-05`. The reader must consume real JSONL rows from `.planning/metrics/gate-evidence.jsonl` in a temp repo and expose them through the cockpit/MCP evidence model. Do not seed committed fixture rows.

files_touched:
- `super-gsd/tools/session-governance/gate-evidence-reader.cjs`
- `super-gsd/cockpit/adapters/session-governance-evidence.cjs`
- `super-gsd/tests/session-governance/gate-evidence-reader.real-row.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/gate-evidence-reader.real-row.test.cjs"`

AC trace: `AC-146c`.

### T146-07 - Hook Registry Binding

depends_on: `[T146-06]`

Create the session-governance hook registry binding. This task owns `session-governance-hooks.yaml` and only registers entrypoints created by prior tasks. It must not modify producer, reader, classifier, or shared helper code.

files_touched:
- `super-gsd/registry/session-governance-hooks.yaml`
- `super-gsd/tests/session-governance/hook-registry.integration.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/hook-registry.integration.test.cjs"`

AC trace: `AC-146a`, `AC-146b`, `AC-146c`, `AC-146d`.

### T146-08 - End-To-End Gate And Latency Verification

depends_on: `[T146-07]`

Implement the final end-to-end verification that runs the registry-resolved hooks against temp fixtures and validates bench evidence by parsing the JSONL row. The latency check must assert the row exists, `iterations` equals the requested count, `p95_ms` exists, and `p95_ms < 1000`.

files_touched:
- `super-gsd/tests/session-governance/end-to-end-and-bench.test.cjs`

verification_command:
`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/end-to-end-and-bench.test.cjs"`

AC trace: `AC-146a`, `AC-146b`, `AC-146c`, `AC-146d`, `AC-146e`.

## Final Verification

Run after `T146-08`:

`powershell -NoProfile -ExecutionPolicy Bypass -Command "node super-gsd/tests/session-governance/state-context.contract.test.cjs; node super-gsd/tests/session-governance/session-start.real-entrypoint.test.cjs; node super-gsd/tests/session-governance/prompt-classifier.route-only.test.cjs; node super-gsd/tests/session-governance/sgsd-triage-command.test.cjs; node super-gsd/tests/session-governance/post-tool-use-producer.real-entrypoint.test.cjs; node super-gsd/tests/session-governance/gate-evidence-reader.real-row.test.cjs; node super-gsd/tests/session-governance/hook-registry.integration.test.cjs; node super-gsd/tests/session-governance/end-to-end-and-bench.test.cjs"`

## Deferred Items

- DEFERRED-A: Broader non-Claude harness support remains out of scope for P146.
- DEFERRED-B: Rich cockpit UX beyond consuming and rendering the P146 evidence stream remains out of scope.
- DEFERRED-C: Historical ledger backfill remains out of scope; P146 validates new runtime rows only.
- DEVIATION-1: P146 uses route-only `/sgsd-triage` direction instead of auto-running triage from the classifier.
- DEVIATION-W: Windows-safe, network-free verification is mandatory; POSIX-only scripts or network-backed checks are not acceptable.
```
tokens used
23,909

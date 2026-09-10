---
schema_version: 2
status: AUTHORIZED
phase: 170
plan: "170-13"
authorized_at: "2026-09-10"
authorization: "Operator instruction 2026-09-10 14:0xZ: every SGSD boot on any worktree health-checks Atlas from the start. Scope fixed by the operator to receiver health, exact worktree/run registration and observed delivery; use the existing shared global.cjs path and launcher helpers; never make per-worktree Collector/Prometheus stacks the automatic boot mechanism; never publish a duplicate collection system; never report collection success from health alone."
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: T170-13-1
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/scripts/lib/atlas-boot-briefing.cjs, super-gsd/scripts/lib/atlas-boot-briefing.test.cjs]
    input_contract: "Existing shared receiver state only: global/service.json plus its health URL, the current process environment written by global.cjs prepare (SGSD_RUN_ID, SGSD_ATLAS_PROJECT_ID, SGSD_ATLAS_GLOBAL_ROOT), runs/<run>/registration.json, monitor/latest.json, and tools/telemetry-atlas/contract.cjs digest for the project id. No lifecycle stack, no prepare, no attach, no writes."
    output_contract: "A read-only, bounded (under 2 s), fail-open collector returning receiver health, this session's run registration for exactly this project root, and observed native/operational delivery taken from the monitor snapshot, plus a formatter producing the fixed briefing lines with WARN per finding."
    hypothesis: "The monitor snapshot and the run registration already hold every fact the boot briefing needs, so a session can be told at start whether it is attached and whether delivery has been observed without any new collection path."
    falsifier: "The briefing prints covered, attached or collecting for a session with no SGSD_RUN_ID, for a run registered to a different project directory, or for a project with no observed native or operational delivery; or it invokes prepare, attach, enable, start or configure; or a missing state directory throws."
    stop_rule: "RED node:test fixtures for unattached, wrong-project, healthy-attached-undelivered, delivered, receiver-missing and stale-snapshot cases, then the minimum implementation to GREEN, then stop."
  - id: T170-13-2
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/hooks/sgsd-session-start.js, super-gsd/scripts/lib/hook-install-contract.cjs, super-gsd/tests/propagation/codex-hooks-install.test.cjs, super-gsd/tools/telemetry-atlas/README.md]
    input_contract: "T170-13-1 module; the existing emitOptionalBriefing fail-open pattern in sgsd-session-start.js; the project hook dependency closure published by install.sh."
    output_contract: "Session start prints the Atlas Telemetry block after the SGSD memory briefing in both the global (~/.claude/hooks) and repo-local (super-gsd/hooks) layouts; the closure delivers the new module and contract.cjs; README gains one paragraph naming the briefing and its three facts."
    hypothesis: "Because sgsd-session-start.js is already registered globally and repo-locally, one install-global run makes the briefing fire on every worktree's next session with no per-worktree change."
    falsifier: "A worktree session prints no Atlas block after install-global, the closure smoke fails on the new require, or the hook exits non-zero on any input."
    stop_rule: "Wire the call, prove the closure with the propagation tests, run the hook live for one attached and one unattached project root, then stop. No other hook edits."
semantic_acceptance_criteria:
  - input: "Hook run with a SessionStart payload for /home/jackberrow/.config/superpowers/worktrees/project-clarity-erp/opportunity-hub in a shell with no SGSD_RUN_ID."
    expected_outcome: "Block prints receiver health, then 'This session: NOT ATTACHED' naming the cause (no SGSD_RUN_ID, started outside the SGSD launch paths), then the project line from the monitor snapshot, then one WARN per monitor finding for that project id. Nowhere does it say covered, attached or collecting."
    verification_cmd: "env -u SGSD_RUN_ID -u SGSD_ATLAS_PROJECT_ID node super-gsd/hooks/sgsd-session-start.js < fixture-payload.json"
  - input: "Hook run inside the operator pane of a fresh sgsd-remote-tmux.sh launch for the same worktree, where global.cjs prepare exported SGSD_RUN_ID and registration.json names that worktree."
    expected_outcome: "'This session: attached, run <id> registered <time> for this worktree'. Delivery is reported only from observed timestamps in the monitor snapshot; a new run with nothing delivered yet prints 'none observed yet', never success."
    verification_cmd: "node super-gsd/hooks/sgsd-session-start.js < fixture-payload.json  (inside the launched pane)"
  - input: "node:test fixtures for unattached, wrong-project registration, receiver missing, snapshot stale and delivered cases."
    expected_outcome: "All pass; the wrong-project fixture reports 'registered for a DIFFERENT project' and the stale fixture appends '(stale)'."
    verification_cmd: "node --test super-gsd/scripts/lib/atlas-boot-briefing.test.cjs"
  - input: "Propagation and hook-closure tests after the new require is added."
    expected_outcome: "Pass; the closure includes atlas-boot-briefing.cjs and tools/telemetry-atlas/contract.cjs."
    verification_cmd: "node --test super-gsd/tests/propagation/"
---

# Atlas boot briefing plan (170-13)

## Why this plan exists

On 2026-09-10 a Fable session running in the `opportunity-hub` worktree was started from a plain
bash pane in a re-formed tmux session (`clarity-work`, created 13:39:21Z from windows dating to
2026-09-04), not through `sgsd-remote-tmux.sh`. No `global.cjs prepare` ran, so the process had no
`SGSD_RUN_ID` and no OTEL environment. The monitor reported the worktree as
`project_not_registered`, `operational_delivery_unobserved` and `native_storage_missing` at
14:05Z even after the worktree had been added to `monitor/config.json`. Nothing at session start
said so. This plan makes the session say so.

## What the briefing is

One block appended to the existing session-start output, after the SGSD memory line:

```
Atlas Telemetry
- Receiver: healthy [pid 2275022, fp 7a5a1516, started 02:17Z]
- This session: NOT ATTACHED (no SGSD_RUN_ID; started outside the SGSD launch paths, so this session's native telemetry is not collected)
- Project 7f78d2d8: not registered; native none observed; operational none observed (monitor snapshot 14:08Z, 2m old)
- WARN: project_not_registered
- WARN: operational_delivery_unobserved
- WARN: native_storage_missing
```

Receiver line alternatives: `unhealthy (<reason>) [...]`, `not deployed`.
Session line alternatives: `attached, run <id> registered <time> for this worktree`,
`attached, run <id> registered for a DIFFERENT project (<dir>)`.
Project line: values come only from `monitor/latest.json` (the `projects[]` entry and `findings[]`
for this project id). Absent fields print `unknown`. A snapshot older than 10 minutes appends
`(stale)`; a missing snapshot prints `monitor snapshot missing`.

## Sources, all existing, all read-only

| fact | source |
|---|---|
| receiver identity and health | `~/.local/state/sgsd/telemetry/global/service.json`, GET `urls.health` (1500 ms cap) |
| this session's attachment | `SGSD_RUN_ID`, `SGSD_ATLAS_PROJECT_ID`, `SGSD_ATLAS_GLOBAL_ROOT` from the environment written by `global.cjs prepare`, then `global/runs/<SGSD_RUN_ID>/registration.json` |
| project id | `tools/telemetry-atlas/contract.cjs` `digest(realpath(ctx.root))`, never a reimplementation |
| observed delivery and findings | `global/monitor/latest.json` |

## Non-goals, binding

- No `lifecycle.cjs` stack, `stack.cjs install`, `enable` or `start`. Per-worktree Collector and
  Prometheus stacks are the legacy path and are not the boot mechanism.
- No `global.cjs prepare`, `attach`, `finish`, `serve`; no `monitor-schedule.cjs configure`,
  `install`, `tick`; no crontab access; no writes anywhere.
- No new ledger, spool, exporter or file tail. The briefing reports; it does not collect.
- Health alone never yields a success word. `covered`, `attached` and `collecting` require the
  registration record for this exact project root and an observed delivery timestamp respectively.

## Rollout

Codex implements on the canonical source. The orchestrator commits, pushes and runs `sgsd-update`,
which installs the hook globally; every worktree's next session prints the block. Existing
sessions are not retrofitted. The `sgsd-remote-tmux.sh` shell/greet/go modes remain the supported
way to obtain an attached session.

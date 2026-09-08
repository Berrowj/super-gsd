---
phase: 170
plan: "170-02"
date: 2026-09-08
status: IMPLEMENTED-PENDING-OPERATOR-VALIDATION
---

# Automatic Atlas and mixed-provider board — executor handoff

The requested implementation is in the current worktree. This turn did not
commit, push, deploy to DEVCP, change authentication, probe paid models, change
sandbox profiles, or reset live sessions. P170 remains open; no SGSD gate result
is invented or substituted by these tests.

## Implemented

- Shared Node receiver, automatic per-user/per-machine startup/reuse, independent
  project/run registrations and local loopback endpoints. Project attribution
  comes from private registrations, not provider-supplied paths or run IDs.
- Standard SGSD launch paths attach automatically, including interactive `sg`,
  headless, remote tmux, recovery/watchdog, narrator, stop-handoff and the three
  Codex wrappers. Interactive Claude remains in the calling terminal. Each
  Codex wrapper independently attaches because Claude strips OTEL variables
  from its shell children. Native content logging is disabled.
- Existing canonical store, deduplication, conflict records, manifests and
  resource bounds reused. Missing provider request IDs produce explicit partial
  coverage, not guessed token accounting. Lifecycle exit markers are idempotent.
- Read-only audit reports missing/stale native capture, identity gaps, schema,
  checksum/attribution errors, duplicate/conflicting rows, closed-file deletion,
  quota limitations, backlog and capture gaps. No evidence is repaired/deleted.
- Global installer delivers the complete self-contained Atlas runtime and both
  launch helpers. Installation alone does not start a production collector.
- Board descriptor uses existing `codex-exec.sh` for OpenAI seats and Claude
  `Agent()` for Anthropic seats. Existing ten-field board validator, unique
  per-attempt output, read-only profile, two-round limit, single malformed-output
  retry and project-bound provider circuit are retained. Missing validator or
  gate fails before a model call. Infrastructure failures do not trigger a paid
  schema retry; failed seats cannot be synthesized as missing votes.

| Seat | Configured route | State |
| --- | --- | --- |
| CEO / orchestrator | Fable / Claude | configured |
| Contrarian | Fable / Claude | active |
| Architect | gpt-6-astra, max / Codex | active |
| Moonshot | gpt-6-astra, max / Codex | re-enabled |
| Pragmatist | gpt-5.6-luna, max / Codex | re-enabled |
| Researcher | requested label Atlas, no wire ID | explicitly blocked |

Shared routing presets now resolve Astra/Luna display labels to actual model
IDs. Per-role allowlists include the catalog presets; this does not assert that
every legacy Agent-only execution path has a cross-provider transport. This
plan implements that transport for the deliberation board. Unrelated Codex
profile defaults remain Sol and have not been relabelled as other models.

## Fresh verification

| Command / check | Result |
| --- | --- |
| `node super-gsd/tools/telemetry-atlas/run-self-test.cjs` on Windows | 55 PASS, 6 top-level platform/opt-in skips, 0 FAIL |
| Same command on Linux/WSL | 57 PASS, 4 top-level platform/opt-in skips, 0 FAIL |
| Legacy runtime checks inside the aggregate | Windows 8 PASS/8 skips; Linux 15 PASS/1 optional real-stack skip |
| Board dispatch, registry, routing contract/resolution/propagation (five explicit test files) on Linux | 16 PASS, 0 FAIL, no paid calls |
| Same board files on Windows | 13 PASS, 3 Bash-only skips, 0 FAIL |
| Six edited PowerShell files parsed, including shortcut generator | PASS |
| Seven edited Bash scripts/helpers syntax checked | PASS |
| `node super-gsd/scripts/lib/hook-install-contract.cjs --check-manifest` | PASS, dependency closure current |
| `node super-gsd/tests/install-contract/assert-install-contract.cjs --case empty-module-tree-real-install` on Linux | PASS, fresh project install, every installed hook and stale-module update |
| `git diff --check` | PASS; expected Windows line-ending warnings only |

The aggregate includes a real installer into an isolated HOME, helper/runtime
hash parity, content-free installed statusline quota capture, detached cold
startup from the installed runtime, health, and WARN audit without any provider
call. Its fixture service stops through the disabled marker before cleanup.
The generated PowerShell `sg` fixture proves same-process Claude invocation,
unchanged launch arguments, restored parent environment and preserved exit code.

Independent Atlas review found startup ownership, identity accounting, manifest
integrity and provider attribution defects; all were fixed with regression
tests. Final review found no remaining Important issue in its scope. The
reviewer additionally verified real concurrent cold starts, idempotent finish,
and restart preserving canonical IDs in private temporary state.

Independent board source and skill-scenario review found the Agent-only route,
installed source lookup, inconsistent round limit and missing circuit/validator
handling. The fixes were re-reviewed with no important remaining finding.
The skill tests affected dispatch/retry/partial-board instructions; this is not
an actual Fable deliberation or a substitute for existing SGSD gates.

During verification, one incorrectly quoted WSL test-name filter started broad
test discovery. The identified test process tree was stopped. Two otherwise
clean tracked generated fixtures were restored byte-equivalently to HEAD;
the test-owned temporary stderr file was removed. Existing `.planning/tmp/`
and unrelated user state were preserved. Subsequent runs used explicit files.
An installer-test assertion initially read `health.healthy` instead of the
existing `health.status`; the assertion was corrected and the final full suite
above was rerun successfully.

## Operator handoff / limits

1. Update source/global installation through the existing SGSD workflow on each
   machine. Windows shortcut installations also need their generated `sg`
   function refreshed through the existing shortcut installer/update step.
2. Start a fresh SGSD session in each project. Existing sessions, standalone
   provider CLIs/desktop sessions, and ad-hoc benchmark/probe runners are not
   retroactively attached. Windows, WSL and remote hosts are separate collectors.
3. Run `node ~/.claude/tools/telemetry-atlas/audit.cjs --json` (PowerShell:
   `node "$env:USERPROFILE/.claude/tools/telemetry-atlas/audit.cjs" --json`).
   Exit 0 means checked integrity passed, 10 means missing/degraded coverage,
   1 means failure. Missing data must never be treated as zero. The source-root
   convenience command is `npm run atlas:audit`.
4. Observe actual Claude and Codex native events before claiming workload
   coverage. Account quota observations are unallocated, never summed across
   projects. The report deliberately keeps `complete_coverage: false`.
5. Confirm Researcher's intended exact model. The installed model catalog lists
   Astra, Sol, Terra and Luna, but not a wire model named Atlas. No authentication
   change or silent substitution is justified by the earlier alias probes.
6. Run the existing formal spec/ATC/MUDA/release gates when appropriate. No
   milestone/phase closure, two-week baseline, cost recommendation or completed
   Phase 171/172 reporting is claimed.

The local Windows audit at 2026-09-08T15:11Z returned WARN: service unavailable,
no registered projects. That is expected before updating/launching the new
automatic path; legacy DEVCP capture remains separate and was not re-audited
or modified during this turn. Canonical evidence is never pruned; registrations
and history accumulate, and capacity/gap monitoring remains necessary.

## Orchestrator communication question — diagnosis only

Current workers use one-shot `codex exec`, often ephemeral: one prompt enters,
one report exits. Removing the sandbox does not create a question/reply channel.
Recommend a separately planned host adapter using Codex App Server persistent
threads, streamed events and turn steering; SGSD must explicitly deliver worker
questions/blockers to Fable and route replies to the correct thread. Some
host-request/dynamic-tool surfaces are experimental and need version-pinned
validation. Keep read-only board workers and bounded writable executor roots.

A smaller interim design is structured NEEDS_INPUT plus exact-session resume;
that requires retained/non-ephemeral sessions and must never use `--last` with
parallel workers. Neither design nor broader permissions was implemented here.

Sources checked: [Codex models](https://learn.chatgpt.com/docs/models),
[configuration](https://learn.chatgpt.com/docs/config-file/config-reference),
[Claude monitoring](https://code.claude.com/docs/en/monitoring-usage),
[Codex App Server](https://learn.chatgpt.com/docs/app-server), and
[non-interactive resume](https://learn.chatgpt.com/docs/non-interactive-mode#resume-a-non-interactive-session).

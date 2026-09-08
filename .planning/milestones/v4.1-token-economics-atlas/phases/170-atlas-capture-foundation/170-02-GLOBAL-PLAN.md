---
phase: 170
plan: "170-02"
status: IN_PROGRESS
authorized_by: operator
authorized_at: 2026-09-08
---

# Atlas automatic collection across SGSD projects

Goal: every SGSD launch registers a fresh run and automatically starts or reuses
one local Atlas service per OS user and machine. No manual state export or
project activation. The operator approved this change on 2026-09-08 and will
perform the production update. This supersedes 170-01's opt-in launch rule only.

Design: a dependency-free Node service reuses the existing bounded receiver and
canonical store. It listens on OS-assigned loopback ports and publishes private
discovery metadata. Each run has a private registration and endpoint; routing
uses that registration rather than trusting paths or IDs in provider events.
Canonical evidence goes under the shared root's projects/<digest>/metrics.
Legacy project stacks and evidence remain available independently. The existing
Collector/Prometheus stack remains an optional standalone deployment; automatic
capture requires no downloads and is supported on Windows and Linux.

Claude starts directly with scoped content-off telemetry environment. SGSD's
Codex wrappers receive per-invocation OTel configuration only; prompts, model,
effort, sandbox, report and exit semantics stay intact. Claude does not inherit
OTEL variables into shell children, so each SGSD-owned launch must attach itself.
No global provider settings, raw-body spool, remote export, model call, gate
mutation, live session reset, or DEVCP deployment is part of this work.

## Task 1 — shared receiver and safe project attribution

Files: tools/telemetry-atlas/{global.cjs,global-store.cjs,global.test.cjs,
server.cjs,contract.cjs,quota-sampler.cjs,otlp.cjs,codex-otlp.cjs,lifecycle.cjs}
under super-gsd/.

- [x] Add real-socket fixtures with two projects and three independent runs;
  assert separate canonical ledgers, no raw canary bytes, replay deduplication,
  no cross-project routing through event-supplied IDs and isolated quota spools.
- [x] Implement private filesystem registration and one bounded background Node
  receiver; an atomic startup lock plus nonce/health ownership prevents duplicate
  services. A dead service restarts on the next launch without killing listeners.
- [x] Reuse createStore with an explicit metricsDir. Preserve privacy validation,
  append semantics, integrity conflicts, per-project resource limits, and safe
  rejection/gap evidence when IDs, capacity or storage are unavailable.
- [x] Add strict Claude/Codex normalization; token observations without stable
  provider request IDs remain explicit coverage gaps rather than guessed totals.
- [x] Verify: node --test super-gsd/tools/telemetry-atlas/global.test.cjs

## Task 2 — attach all SGSD launch paths

Files: super-gsd/scripts/{sgsd-remote-tmux.sh,sgsd-headless.sh,
sgsd-headless.ps1,sgsd-boot.ps1,sgsd-boot.sh,Install-SgsdShortcut.ps1,
sgsd-autopilot-watchdog.ps1,sgsd-narrative.ps1,sgsd-stop-handoff.sh,
codex-exec.sh,codex-executor.sh,codex-patch-executor.sh},
super-gsd/scripts/lib/{atlas-shell.sh,atlas-powershell.ps1},
super-gsd/tools/telemetry-atlas/{launch.test.cjs,runtime.test.cjs},
super-gsd/hooks/sgsd-statusline.js.

- [x] Verify common Bash/PowerShell attach, generated `sg` with fake Claude,
  Codex wrapper argv with a fake provider, concurrent projects, missing runtime,
  inherited hostile settings and opt-out. Source/syntax checks cover recovery,
  headless, narrator and stop-handoff hook points.
- [ ] Operator live smoke of every launch mode after updating each machine;
  fake-provider checks are not proof of real provider request coverage.
- [x] Add bounded scoped shell and PowerShell bootstrap helpers. Return safe
  environment data, no evaluated provider content. Respect SGSD_ATLAS_DISABLED=1
  and global disabled marker. Restore the interactive parent environment on exit.
- [x] Attach at each real spawn, including recovery and background Claude calls.
  Statusline publishes to the run's private spool and never changes its output.
- [x] Verify: node --test super-gsd/tools/telemetry-atlas/launch.test.cjs

## Task 3 — install delivery and read-only integrity report

Files: super-gsd/tools/telemetry-atlas/{audit.cjs,audit.test.cjs,install.test.cjs,
run-self-test.cjs,README.md}, super-gsd/install.sh,
super-gsd/config/{telemetry-atlas.json,hook-manifest.json}, package.json.

- [x] Add audit fixtures for missing/stale native data, empty projects, malformed
  rows, checksum errors, duplicates, conflicts, quota unavailable, backlog and
  two-provider tokens. Audit must not modify evidence or infer complete coverage.
- [x] Implement `node ~/.claude/tools/telemetry-atlas/audit.cjs --json` to inspect
  all registrations and report observed/degraded/unavailable per project/run.
- [x] Verify global install supplies the helpers and complete shared runtime;
  no explicit binary download or live process start occurs during installation.
- [x] Document update/launch/audit and machine scope; update STATE and a new
  executor report with exact evidence, without claiming P170 gate closure.
- [x] Verify fresh focused tests, full existing Atlas suite and install contract
  on Linux; check hook manifest and diff; request independent code review.

Rollback: opt out with SGSD_ATLAS_DISABLED=1 (per launch) or a shared disabled
marker. Revert the source change through the normal updater if required. Keep
canonical files. No telemetry process may delete project evidence.

## Task 4 — operator-added board model repair (2026-09-08)

The operator also requested repairing the Agent-only deliberation path. Reuse
codex-exec's existing per-seat model/effort overrides and readonly profile; add
`board-position-v1` backed by the existing deliberation validator, not a new gate.
CEO and Contrarian use Fable; Architect and Moonshot use gpt-6-astra/max;
Pragmatist uses gpt-5.6-luna/max. Researcher's requested "Atlas" is unresolved
in the installed Codex model catalog: ask the operator, do not alias it to Sol
or change authentication. Keep only that seat explicitly blocked until resolved.

Files: super-gsd/scripts/lib/{board-registry.cjs,board-registry.test.cjs,
board-dispatch.cjs,board-dispatch.test.cjs,deliberation-schema.cjs},
super-gsd/scripts/{codex-exec.sh,codex-exec.README.md},
super-gsd/registry/board-members.yaml, super-gsd/agents/sgsd-{ceo,board-*}.md,
super-gsd/skills/sgsd-deliberate/SKILL.md,
super-gsd/config/{model-routing.json,planning-config-overlay.json},
super-gsd/tests/model-routing/*.cjs, super-gsd/tests/propagation/model-routing-propagation.test.cjs,
super-gsd/tests/board-dispatch/*, super-gsd/docs/SGSD-MODEL-ROUTING.md,
super-gsd/tools/self-test/*.

- [x] Test real model/effort resolution and provider-aware dispatch before edits.
- [x] Add an argv-based dispatch descriptor/runner using the existing wrapper,
  with unique per-attempt files, readonly enforcement, no silent fallback, and
  validation of the same ten-field board YAML for both providers.
- [x] Update roster, frontmatter, CEO and skill; preserve decision pre-gates,
  escalation, bounded rounds, schema retry once and confidence-weighted synthesis.
- [x] Correct the prior fake routing aliases to real catalog model IDs without
  rewriting unrelated Codex profiles or impersonating model availability.
- [x] Run no-network wrapper/board tests, installed-path checks and skill scenario
  review. No paid probes, auth edits or automatic deployment.

Evidence references:
- https://code.claude.com/docs/en/monitoring-usage (OTLP JSON, subprocess environment)
- https://learn.chatgpt.com/docs/config-file/config-advanced (per-call configuration)
- https://learn.chatgpt.com/docs/config-file/config-reference (OTel JSON exporter)

## Handoff status — 2026-09-08

Implementation is in this worktree, not committed, pushed or deployed by this
turn. Atlas automated checks pass on Windows and Linux, including an isolated
real global installation. Board fake-provider and routing checks pass. See
`170-02-EXECUTOR-REPORT.md` for exact counts and limits. Researcher remains
blocked on the operator model choice; no full six-seat board or phase closure
is claimed. The sandbox/communication question was investigated only: a future
App Server host adapter is recommended, with no permission change in this plan.

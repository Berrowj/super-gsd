# SGSD State and Operations Audit

Date: 2026-07-13

Scope: state authority, persistence and recovery, cockpit and MCP projections, local Warp startup, SSH/tmux operation, optional VTP degradation, project memory and CMB feedback, metrics, and harness learning

Method: read-only source and live-state inspection in the isolated audit worktree; no state, roadmap, source, configuration, hook, test, metric, or active-milestone mutation
Overall verdict: **STRENGTHEN before the next autonomous milestone; replace the split state/checkpoint authority before claiming crash-safe operation**

## Executive outcome

**OBSERVED — The system has useful defensive components but not one coherent operational truth path.** The repository contract calls STATE.md canonical while the effective-state resolver calls it a lowest-priority legacy projection; Warp MCP and the cockpit-state adapter use that resolver, but the localhost sidecar and autopilot watchdog independently parse raw STATE/folder evidence. Checkpoint writers also use incompatible field sets. `AGENTS.md:15-18` `super-gsd/tools/state-resolver/resolve.cjs:3-31` `super-gsd/tools/warp-mcp/server.cjs:94-110` `super-gsd/tools/cockpit-state/adapter.cjs:75-89` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:494-560` `super-gsd/tools/autopilot-watchdog/check.cjs:93-140`

**OBSERVED — Current repository state demonstrates the split.** STATE top-level declares v3.4/P999 while nested `roadmap_run` still declares v2.2 complete; P999 contains a PLAN-LOCKED artifact but no CONTEXT or VERIFICATION. The live resolver command selected v3.4/P999 from phase folders, set `projection_stale=true`, and recommended a STATE re-sync. This is detection without convergence, not one atomic state transition. `.planning/STATE.md:3-9` `.planning/STATE.md:190-197` `.planning/milestones/v3.4/phases/999-localhost-startup-wiring/999-01-localhost-startup-wiring-PLAN-LOCKED.md:1-37` `super-gsd/tools/state-resolver/resolve.cjs:716-761`

**OBSERVED — Recovery is not transactionally closed, and the watchdog is another recovery writer.** Pause writes and commits `active_milestone`/`active_phase`; resume deletes and commits before the next dispatch; the resolver recognizes `milestone` plus `current_phase` or `phase`; chaos validation requires a different six-field vocabulary. Separately, the watchdog can write recovery/metric artifacts, optionally write the shared checkpoint with its own schema, and start a fresh Claude in another PowerShell process without killing the existing Claude. `super-gsd/skills/sgsd-pause/SKILL.md:36-78` `super-gsd/skills/sgsd-resume/SKILL.md:22-36` `super-gsd/templates/checkpoint.md:1-32` `super-gsd/tools/state-resolver/resolve.cjs:489-515` `super-gsd/tools/chaos-restart/manifest-validator.cjs:51-63` `super-gsd/tools/autopilot-watchdog/check.cjs:161-175` `super-gsd/tools/autopilot-watchdog/check.cjs:272-367` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-109`

**OBSERVED — The rationale-card failure is an earliest-loss defect, not a rendering flake.** v3.4 INTENT uses folded YAML scalars; the hand parser records only same-line values, so it retains the literal `>-`; P999 supplies no CONTEXT or prior summary; the client correctly filters markers/placeholders while the evidence trail survives as one card. The focused SAC therefore exposes upstream semantic loss. `.planning/milestones/v3.4/INTENT.md:1-27` `super-gsd/tools/cockpit-sidecar/rationale.cjs:51-92` `super-gsd/tools/cockpit-sidecar/rationale.cjs:160-211` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:18-30` `super-gsd/tools/cockpit-sidecar/client.js:1681-1711` `super-gsd/tools/cockpit-sidecar/run-self-test.cjs:1356-1363`

**OBSERVED — Local Windows startup is the strongest operational path.** Installed `sg` invokes `sgsd` first and then Claude in the caller terminal; the Warp workflows invoke `sg` and `sg -Go`. The greeting still directs a raw STATE read. The watchdog recovery path is exceptional: `-Recover` starts a separate PowerShell/Claude process and its lock fences repeated watchdog launches, not an already-running control plane. `super-gsd/scripts/Install-SgsdShortcut.ps1:186-221` `.warp/workflows/sgsd-start.yaml:1-11` `.warp/workflows/sgsd-auto.yaml:1-11` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-109`

**OBSERVED — Remote support is shaped in source but is checkout-sensitive and not end-to-end proven.** `-DryRun` printed only the remote Bash command and explicitly exited before any SSH lookup or invocation. Source CONFIGURES `ssh -t`; no SSH invocation was OBSERVED. Git reports LF in the index/blob and CRLF only in this Windows worktree (`core.autocrlf=true`, no enforcing `text`/`eol` attribute), so WSL failed on the converted checkout; that does not prove a native-Linux checkout fails. The helper is a separate tmux topology and the loopback cockpit has no configured `-L` tunnel. `super-gsd/scripts/sgsd-remote-launch.ps1:58-98` `super-gsd/scripts/sgsd-remote-tmux.sh:202-281` `super-gsd/tools/cockpit-sidecar/serve.cjs:519-535`

**OBSERVED — Optional VTP failure handling is safer than VTP success wiring.** Unhealthy/timeout paths return empty results and log failures; the bridge transport throws unless a test-only response is supplied; the orchestrator example does not supply that shim; and context-packet currently assigns `vtpPackets=[]`. Absence degrades locally as required, while successful enrichment reaching a future dispatch is not established. `AGENTS.md:29-39` `super-gsd/tools/vtp-bridge/classify.cjs:476-527` `super-gsd/tools/vtp-bridge/classify.cjs:578-639` `super-gsd/skills/sgsd-orchestrate/SKILL.md:948-1007` `super-gsd/tools/context-packet/build.cjs:727-809`

**OBSERVED — CMB authority boundaries are strong in schema but weak in live composition.** The schema binds seven types to producer roles; writers validate/append individual records. The browser sidecar instead reads a machine-specific Claude memory path and renders a static five-node lineage, so the display is not proof of a live CMB transaction. `super-gsd/schemas/cmb.schema.json:88-105` `super-gsd/schemas/cmb.schema.json:306-514` `super-gsd/tools/mesh-memory/execution-receipt.cjs:87-136` `super-gsd/tools/mesh-memory/review-finding-writer.cjs:88-136` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:1516-1569` `super-gsd/tools/cockpit-sidecar/serve.cjs:247-255`

**OBSERVED — Harness learning is component-tested, not closed-loop.** The distiller can read seven streams, but the runner declares `loadDistill` without invoking it and `apply-candidate` is route-only. Cockpit/MCP expose counts/latest verdicts; those projections do not prove evidence changed a future dispatch. `super-gsd/tools/harness-evidence/distill.cjs:31-38` `super-gsd/tools/harness-evidence/distill.cjs:222-340` `super-gsd/tools/harness-evolution/run.cjs:28-31` `super-gsd/tools/harness-evolution/run.cjs:193-225` `super-gsd/tools/harness-evolution/README.md:18-45` `super-gsd/tools/cockpit-state/adapter.cjs:1230-1314`

## Evidence labels and scoring

- **OBSERVED**: directly read, executed, or reproduced in this worktree.
- **CONFIGURED**: declared in source, configuration, workflow, schema, or registry, but not proven by current runtime evidence.
- **DOCUMENTED**: described as an operator or orchestrator procedure.
- **INFERRED**: a causal conclusion from observed boundaries; uncertainty is stated.
- **RECOMMENDED**: a future repair or proof test; no repair was implemented in this audit.

Scores use a 0–5 operational scale:

- 0 — absent or currently unusable
- 1 — scaffolded or internally contradictory
- 2 — partial path with material composition gaps
- 3 — coherent component with focused tests, not end-to-end proven
- 4 — operationally credible with live evidence and bounded degradation
- 5 — single-authority, crash-tested, closed-loop, and continuously enforced

## State and operations matrix

| Surface | Authority | Producer | Consumer | Freshness rule | Mutation policy | Degraded behavior | Recovery role | Evidence | Score | Verdict |
|---|---|---|---|---|---|---|---|---|---:|---|
| D01 — State authority contract | AGENTS.md says STATE.md is canonical; resolver says it is legacy projection | Orchestrator plus derived evidence streams | Every CLI, MCP, cockpit, and agent | Conflicting rules: canonical frontmatter versus priority/TTL resolver | Control plane writes STATE; resolver is read-only | Consumers choose different truths | Determines cold-start position | `AGENTS.md:15-18` `super-gsd/tools/state-resolver/resolve.cjs:3-31` | 1 | REPLACE |
| D02 — .planning/STATE.md live projection | Top-level milestone/status mixed with nested roadmap_run | Orchestrator/manual history | Claude greeting, sidecar, adapter, MCP fallbacks | last_updated plus prose; no atomic invariant across nested fields | Intended single control-plane writer | Stale prose remains readable | Cold-start fallback | `.planning/STATE.md:3-9` `.planning/STATE.md:190-197` | 1 | STRENGTHEN |
| D03 — Milestone roadmap and phase artifacts | Per-milestone ROADMAP plus CONTEXT/PLAN/VERIFICATION | Planner/orchestrator/executors | Resolver, cockpit, gates, operators | Folder presence and verification status heuristics | Plan-bound writes | Missing roadmap/context silently falls back to folders/prose | Reconstructs position | `AGENTS.md:15-18` `.planning/milestones/v3.4/phases/999-localhost-startup-wiring/999-01-localhost-startup-wiring-PLAN-LOCKED.md:1-37` | 1 | STRENGTHEN |
| D04 — Effective state resolver | Priority checkpoint → pulse → activity → folders → git → STATE | Read-only derivation | Warp MCP and cockpit-state adapter | Explicit TTLs: checkpoint <2h, pulse <30m, activity <60m | Read-only | Returns degraded envelope/recommended repair | Best available reconstruction | `super-gsd/tools/state-resolver/resolve.cjs:18-31` `super-gsd/tools/state-resolver/resolve.cjs:683-761` | 3 | STRENGTHEN |
| D05 — Checkpoint schema | No single schema: template, pause skill, resolver, chaos validator diverge | Pause skill, manual orchestrator, watchdog, hooks | Resume skill, MCP, resolver, chaos tests | Resolver accepts fresh checkpoint only if recognized phase field exists | Multiple writers can target shared checkpoint | Unparseable fields fall through to lower-priority sources | Supposed highest-priority recovery truth | `super-gsd/templates/checkpoint.md:1-32` `super-gsd/skills/sgsd-pause/SKILL.md:36-78` `super-gsd/tools/state-resolver/resolve.cjs:489-515` `super-gsd/tools/chaos-restart/manifest-validator.cjs:51-63` `super-gsd/tools/autopilot-watchdog/check.cjs:161-175` | 1 | MERGE |
| D06 — Checkpoint lifecycle | Checkpoint file and git commit | Pause/resume skill | Next Claude session | Presence/mtime only; no claim/ack/close state | Resume deletes before dispatch | Falls to STATE/folder inference after deletion | Exact interrupted-unit handoff | `CLAUDE.md:369-392` `super-gsd/skills/sgsd-resume/SKILL.md:22-36` | 1 | REPLACE |
| D07 — Auxiliary JSON checkpoint hook | ORCHESTRATOR-CHECKPOINT.json commit history | PostToolUse hook | No main resolver/MCP consumer identified | Updated after matching `git commit` text | Atomic temp rename; failure swallowed | Ignored by main recovery | None in current recovery | `super-gsd/hooks/gsd-checkpoint-writer.js:17-73` | 1 | REMOVE |
| D08 — Warp MCP current-state/recovery | Effective resolver wrapped in schema-v1 envelope | Read-only MCP server | Warp agents and workflows | Carries projection_stale/conflicts/repair | Read-only and redacted | Canonical degraded envelopes; source-missing codes | Produces bounded recovery packet | `super-gsd/tools/warp-mcp/server.cjs:468-492` `super-gsd/tools/warp-mcp/server.cjs:1322-1478` | 4 | KEEP |
| D09 — MCP cockpit-state adapter | Effective objective plus multiple legacy sections | Adapter over STATE, metrics, folders | sgsd_cockpit_snapshot | Per-section staleness and degraded sentinels | Read-only | All 12 sections retained; _section_degraded | Operator status/recovery context | `super-gsd/tools/cockpit-state/adapter.cjs:117-142` `super-gsd/tools/cockpit-state/adapter.cjs:1370-1426` | 3 | STRENGTHEN |
| D10 — Local localhost sidecar snapshot | Independent STATE parser and folder scan | cockpit-sidecar.cjs/serve.cjs | Browser SPA/SSE | Recursive watch or fixed paths; source liveness registry | Runtime pid/health writes only | Warnings, circuit breakers, partial snapshot | Visual diagnosis, not canonical recovery | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:494-575` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:1854-1896` `super-gsd/tools/cockpit-sidecar/serve.cjs:180-258` | 2 | MERGE |
| D11 — Local Warp sg launch | Installed PowerShell functions and Warp workflows | Install-SgsdShortcut.ps1/profile | Operator/Claude in current Warp tab | Boot-time health/preflight | Starts cockpit, then Claude in caller terminal | Reports missing Claude/cockpit separately | Primary daily entry | `super-gsd/scripts/Install-SgsdShortcut.ps1:186-221` `.warp/workflows/sgsd-start.yaml:1-11` `.warp/workflows/sgsd-auto.yaml:1-11` | 4 | KEEP |
| D12 — SSH/tmux launch | Dedicated remote helper, not sg | remote-launch.ps1 → configured SSH → remote-tmux.sh | SSH operator and tmux panes | Doctor probes commands; tmux session presence | Creates metrics placeholders/session/panes | PowerShell dashboards fall back to text tails | tmux persists after disconnect | `super-gsd/scripts/sgsd-remote-launch.ps1:58-98` `super-gsd/scripts/sgsd-remote-tmux.sh:202-281` | 2 | STRENGTHEN |
| D13 — Remote browser cockpit | Remote loopback sidecar | start-cockpit-server.sh | Browser only on remote host unless tunnelled | HTTP /snapshot health check | Runtime pid/port/url files | tmux text panes continue if sidecar fails | Supplemental, not recovery-critical | `super-gsd/tools/cockpit-sidecar/serve.cjs:519-535` `super-gsd/scripts/start-cockpit-server.sh:218-269` `super-gsd/scripts/sgsd-remote-launch.ps1:58-98` | 1 | STRENGTHEN |
| D14 — VTP failure/degraded path | Local route/bridge policy; VTP optional | Orchestrator/bridge | Context packet and future agent prompt | Session health plus route whitelist | Appends health/failure/route rows | Empty packet, closed reason, local continuation | Prevents private-KB outage from blocking | `AGENTS.md:29-39` `super-gsd/tools/vtp-bridge/classify.cjs:476-494` `super-gsd/tools/vtp-bridge/classify.cjs:578-639` | 4 | KEEP |
| D15 — VTP success transport/admission | Intended MCP result packet | VTP bridge caller | context-packet/build.cjs | Provenance and token caps configured | Bridge logs; packet builder read/compose | Currently collapses to empty packet | None | `super-gsd/tools/vtp-bridge/classify.cjs:503-527` `super-gsd/skills/sgsd-orchestrate/SKILL.md:948-1007` `super-gsd/tools/context-packet/build.cjs:727-809` | 1 | STRENGTHEN |
| D16 — Project-local recall/curate memory | .planning/memory/MEMORY.md | sgsd-curate and distillation | sgsd-recall and Claude auto-memory link | Index contents; no age policy | Explicit curate writes; project-local | Legacy .brv fallback | Restores prior patterns/decisions | `.planning/memory/MEMORY.md:1-5` `super-gsd/scripts/sgsd-recall.sh:57-87` `super-gsd/scripts/sgsd-curate.sh:96-149` | 3 | KEEP |
| D17 — CMB type and authority contract | cmb.schema.json role/type/authority constraints | Specialized writers/validators | Chronicle, context tools, future decision path | Hash, lineage, status, revalidation rules | Append-only JSONL writers | Missing ledger generally returns empty/degraded | Could reconstruct evidence lineage | `super-gsd/schemas/cmb.schema.json:88-105` `super-gsd/schemas/cmb.schema.json:306-514` | 4 | KEEP |
| D18 — Live CMB feedback chain | Intended CMB ledger | Executor/reviewer/evidence/pseudo-operator writers | Future dispatch/context/cockpit | No continuous completeness check | Independent appendFileSync writers | Static/empty views | Not proven | `super-gsd/tools/mesh-memory/execution-receipt.cjs:87-136` `super-gsd/tools/mesh-memory/review-finding-writer.cjs:88-136` `super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs:408-474` | 0 | AUTOMATE |
| D19 — Cockpit memory and lineage | Machine-specific Claude-memory path plus static lineage array | Sidecar attacher | Browser | Watcher tied to literal encoded project slug | Read-only | Empty memory graph but static lineage still displays | Can mislead recovery | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:1516-1569` `super-gsd/tools/cockpit-sidecar/serve.cjs:247-255` | 1 | REPLACE |
| D20 — Metrics evidence plane | Append-only JSONL by many components | Orchestrator/tools/hooks/watchdog | Resolver, gates, MCP, cockpit, distiller | Stream-specific TTLs; no global required-stream manifest | Append-only by convention | Missing streams often become zero/absent | Supports reconstruction if present | `super-gsd/tools/state-resolver/resolve.cjs:521-610` `super-gsd/tools/harness-evidence/distill.cjs:31-38` `super-gsd/tools/autopilot-watchdog/check.cjs:323-367` | 1 | AUTOMATE |
| D21 — Harness evidence distiller | Seven metrics streams plus optional benchmark | Explicit distillRun invocation | Human/candidate author | Optional since/until filter | Writes run corpus | Malformed rows isolated; empty corpus returns not-ok | Post-run diagnosis | `super-gsd/tools/harness-evidence/distill.cjs:31-69` `super-gsd/tools/harness-evidence/distill.cjs:222-340` | 3 | KEEP |
| D22 — Harness evolution loop | Candidate spec and protected-surface registry | Explicit runner modes | Manifest/attribution/cockpit counters | No scheduler or future-dispatch policy consumer | Proposal/log writes; apply is route-only | Returns safe refusal/sentinel | None automatic | `super-gsd/tools/harness-evolution/run.cjs:28-31` `super-gsd/tools/harness-evolution/run.cjs:193-225` `super-gsd/tools/harness-evolution/README.md:18-45` | 1 | AUTOMATE |
| D23 — Autopilot watchdog/recovery launcher | Independent raw-STATE/folder/mtime detector | PowerShell watchdog invokes mutating Node checker | Operator, recovery packet, optional fresh Claude, resolver if checkpoint written | Independent warn/stale thresholds and durable/activity candidates | Writes log, status, stall ledger, recovery packet, optional shared checkpoint; may launch Claude | Preserves non-watchdog checkpoint; recovery lock limits repeat launches | External stall detection and fresh-session recovery | `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:4-24` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:48-72` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-130` `super-gsd/tools/autopilot-watchdog/check.cjs:93-175` `super-gsd/tools/autopilot-watchdog/check.cjs:323-451` | 1 | MERGE |

## Central claim adjudication

| Claim | Verdict | Evidence-backed answer |
|---|---|---|
| Is there one path resolver? | **No, partially centralized.** | **OBSERVED:** Warp MCP and cockpit-state use the shared resolver; localhost sidecar and watchdog independently parse STATE/folders, and `sg` directs a raw STATE read. `super-gsd/tools/warp-mcp/server.cjs:94-110` `super-gsd/tools/cockpit-state/adapter.cjs:75-89` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:494-560` `super-gsd/tools/autopilot-watchdog/check.cjs:93-149` `super-gsd/scripts/Install-SgsdShortcut.ps1:216-220` |
| Is freshness enforced? | **Detected, not reconciled.** | **OBSERVED:** the resolver reports projection conflict/repair, while the adapter and watchdog apply separate freshness models; no shared transition/repair transaction appears at these boundaries. `super-gsd/tools/state-resolver/resolve.cjs:716-761` `super-gsd/tools/cockpit-state/adapter.cjs:1130-1226` `super-gsd/tools/autopilot-watchdog/check.cjs:383-451` |
| Are metrics consumed or only displayed? | **Both, stream by stream; current runtime proof is absent.** | **OBSERVED:** resolver and watchdog consume freshness streams; the distiller can consume seven named streams; cockpit/MCP also project counts. `super-gsd/tools/state-resolver/resolve.cjs:521-610` `super-gsd/tools/autopilot-watchdog/check.cjs:388-399` `super-gsd/tools/harness-evidence/distill.cjs:31-38` `super-gsd/tools/cockpit-state/adapter.cjs:1230-1314` |
| Are CMB role boundaries real? | **Yes at schema/writer level; not proven in main-loop composition.** | **OBSERVED:** schema constraints bind CMB types to roles, and individual writers validate/append; the browser lineage is static rather than ledger-derived. `super-gsd/schemas/cmb.schema.json:306-514` `super-gsd/tools/mesh-memory/execution-receipt.cjs:87-136` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:1552-1569` |
| Does harness feedback alter future behavior? | **No evidence of a closed loop.** | **OBSERVED:** `loadDistill` is declared but not invoked and apply is route-only; cockpit status is a read projection. `super-gsd/tools/harness-evolution/run.cjs:28-31` `super-gsd/tools/harness-evolution/run.cjs:193-225` `super-gsd/tools/cockpit-state/adapter.cjs:1230-1314` |
| Do MCP and cockpit share a stable schema and degraded contract? | **MCP does; the two cockpit surfaces do not share one contract.** | **OBSERVED:** MCP has schema envelopes and the adapter has a fixed 12-section degraded shape; browser sidecar builds a separate warning/source-health object. `super-gsd/tools/warp-mcp/server.cjs:468-492` `super-gsd/tools/cockpit-state/adapter.cjs:117-142` `super-gsd/tools/cockpit-state/adapter.cjs:1370-1426` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:1841-1896` |
| Are remote commands real? | **Command assembly is configured; no SSH invocation was observed.** | **OBSERVED:** `-DryRun` printed the remote Bash command and exited before SSH lookup/invocation. **CONFIGURED:** source assembles `ssh -t`; no `-L` is present. The index/blob is LF, while this Windows worktree is CRLF due checkout conversion; native-Linux execution remains unobserved. `super-gsd/scripts/sgsd-remote-launch.ps1:58-98` `super-gsd/scripts/sgsd-remote-tmux.sh:202-281` |

## Flow trace 1 — checkpoint create → interruption → resume → closure

### Current path

1. **DOCUMENTED:** `/sgsd-pause` writes and commits `.planning/ORCHESTRATOR-CHECKPOINT.md` with STATE. `super-gsd/skills/sgsd-pause/SKILL.md:11-12` `super-gsd/skills/sgsd-pause/SKILL.md:29-78`
2. **OBSERVED:** the template uses `created_at`, `active_milestone`, `active_phase`, `next_unit`, `phase_state`, counts, and `resume_instruction`. `super-gsd/templates/checkpoint.md:1-32`
3. **OBSERVED:** resolver priority 1 accepts `milestone` plus `current_phase` or `phase`, not the template's active fields. `super-gsd/tools/state-resolver/resolve.cjs:489-515`
4. **OBSERVED:** Warp MCP independently extracts `next_unit`, so recovery text and effective state can come from different sources. `super-gsd/tools/warp-mcp/server.cjs:1322-1393`
5. **OBSERVED:** the watchdog derives state with its own scalar parser and can write a shared checkpoint containing `generated_by`, `generated_at`, `status`, `milestone`, and `phase`; it preserves a checkpoint not owned by the watchdog. `super-gsd/tools/autopilot-watchdog/check.cjs:93-140` `super-gsd/tools/autopilot-watchdog/check.cjs:161-175` `super-gsd/tools/autopilot-watchdog/check.cjs:272-282`
6. **OBSERVED:** the watchdog also writes status/recovery/stall artifacts, and `-Recover` can launch fresh Claude in another PowerShell process. `super-gsd/tools/autopilot-watchdog/check.cjs:323-367` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:61-72` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-109`
7. **DOCUMENTED:** `/sgsd-resume` reads `next_unit`, deletes and commits the checkpoint, then enters the loop. `super-gsd/skills/sgsd-resume/SKILL.md:22-36`
8. **INFERRED:** a kill after deletion but before successor evidence can lose the exact handoff; no claim/ack/close lifecycle exists in the template. `super-gsd/templates/checkpoint.md:1-32` `super-gsd/skills/sgsd-resume/SKILL.md:27-36`
9. **OBSERVED:** chaos-restart requires `next_unit`, `controlling_principle`, `mode`, `emergency_halt`, `session`, and `created`, so it does not certify the pause or watchdog schema. `super-gsd/tools/chaos-restart/manifest-validator.cjs:20-63`

### Weakness, repair, and proof

**RECOMMENDED — Replace delete-on-read and merge watchdog checkpoint writes into one two-phase handoff record.** Define one versioned schema consumed by pause, resolver, MCP, resume, watchdog, headless mode, and chaos tests. Required lifecycle states should be open → claimed → acknowledged/closed. Resume records a fenced claim/dispatch and closes only after successor state/evidence is durable; watchdog may propose recovery but cannot create a second writer without the same lease. `super-gsd/skills/sgsd-resume/SKILL.md:27-36` `super-gsd/tools/autopilot-watchdog/check.cjs:161-175` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-109`

**Proof test:** create checkpoints through the pause writer and watchdog writer, then kill at five boundaries: before commit, after checkpoint commit, after claim commit, after dispatch start, and after successor evidence. Restart through actual resume and a simultaneous watchdog stale trigger. Assert one fenced control-plane owner, exactly one bounded dispatch, no lost `next_unit`, resolver source=checkpoint while open/claimed, and closure linked to successor evidence. Run both writer fixtures through chaos-restart and Warp MCP recovery. `super-gsd/skills/sgsd-pause/SKILL.md:36-78` `super-gsd/tools/autopilot-watchdog/check.cjs:498-527` `super-gsd/tools/warp-mcp/server.cjs:1322-1478`

## Flow trace 2 — stale or contradictory STATE/roadmap/artifact → detection → recovery

### Current path

1. **OBSERVED:** AGENTS names STATE frontmatter canonical and per-milestone ROADMAP a truth location. `AGENTS.md:15-18`
2. **OBSERVED:** STATE top-level says v3.4/P999 while nested `roadmap_run` says v2.2/complete; P999 is PLAN-only. `.planning/STATE.md:3-9` `.planning/STATE.md:190-197` `.planning/milestones/v3.4/phases/999-localhost-startup-wiring/999-01-localhost-startup-wiring-PLAN-LOCKED.md:1-37`
3. **OBSERVED:** the resolver compares its higher-priority result with STATE and emits `projection_stale`, conflict, and recommended repair. `super-gsd/tools/state-resolver/resolve.cjs:683-761`
4. **OBSERVED:** Warp current-state wraps the shared resolver metadata. `super-gsd/tools/warp-mcp/server.cjs:94-110` `super-gsd/tools/warp-mcp/server.cjs:704-817`
5. **OBSERVED:** recovery packet independently parses checkpoint `next_unit` and exposes separate staleness/projection fields. `super-gsd/tools/warp-mcp/server.cjs:1322-1478`
6. **OBSERVED:** cockpit-state builds objective, artifacts, and staleness as separate sections, permitting mixed legacy/effective scope. `super-gsd/tools/cockpit-state/adapter.cjs:530-603` `super-gsd/tools/cockpit-state/adapter.cjs:1067-1226` `super-gsd/tools/cockpit-state/adapter.cjs:1370-1414`
7. **OBSERVED:** browser sidecar bypasses the resolver, extracts `P<NN>` from status, and scans folders. `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:494-560`
8. **OBSERVED:** watchdog independently parses raw STATE and uses its own durable/activity candidates and thresholds. `super-gsd/tools/autopilot-watchdog/check.cjs:93-149` `super-gsd/tools/autopilot-watchdog/check.cjs:383-451`
9. **INFERRED:** current agreement on P999 is convergence by independent heuristics, not one authority; a different status string/folder can split consumers. `super-gsd/tools/state-resolver/resolve.cjs:18-24` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:498-550` `super-gsd/tools/autopilot-watchdog/check.cjs:109-149`

### Weakness, repair, and proof

**RECOMMENDED — Establish a single transition authority and make projections mechanically consistent.** The least disruptive migration is: (a) version a small state-transition envelope with milestone, phase, plan, state, source event, predecessor hash, and timestamp; (b) make the control plane the only writer; (c) derive STATE frontmatter and cockpit/MCP views from the same resolver library; (d) make a pre-dispatch consistency gate fail closed when canonical and required roadmap/artifacts conflict; and (e) explicitly decide whether STATE is authoritative or a projection, updating AGENTS.md and resolver comments together.

**Proof test:** fixture matrix covering stale top-level STATE, stale nested roadmap_run, missing active ROADMAP, plan-only phase, closed highest folder, synthetic P999, old/fresh checkpoint, conflicting pulse, malformed artifact, and watchdog stale trigger. Assert resolver, current-state, recovery, MCP cockpit, browser `/snapshot`, watchdog, and startup greeting return byte-equal scope/freshness. Assert unresolved same-tier conflict blocks dispatch and watchdog cannot launch a second control-plane owner without a lease. `super-gsd/tools/state-resolver/resolve.cjs:923-1037` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-109`

## Flow trace 3 — local Warp → Claude greet/auto → cockpit

### Current path

1. **OBSERVED:** `sg` and `sgsd` are installed PowerShell functions; their source definitions are `super-gsd/scripts/Install-SgsdShortcut.ps1:111-221`.
2. **OBSERVED:** `sg` calls `sgsd` first unless `-NoCockpit`, then invokes Claude in the caller process with greeting or `go`. `super-gsd/scripts/Install-SgsdShortcut.ps1:186-221`
3. **CONFIGURED:** Warp Start invokes `sg -ProjectDir`; Auto invokes `sg -Go -ProjectDir`. `.warp/workflows/sgsd-start.yaml:1-11` `.warp/workflows/sgsd-auto.yaml:1-11`
4. **OBSERVED:** this matches the required topology: cockpit starts separately and Claude stays where `sg` was typed. `AGENTS.md:29-39` `super-gsd/scripts/Install-SgsdShortcut.ps1:196-220`
5. **OBSERVED:** missing Claude is reported after cockpit startup; the normal entry does not nest Claude in `Start-Process`. `super-gsd/scripts/Install-SgsdShortcut.ps1:196-220`
6. **OBSERVED:** the greeting tells Claude to read STATE frontmatter directly. `super-gsd/scripts/Install-SgsdShortcut.ps1:216-220`
7. **OBSERVED:** watchdog `-Recover` is a separate topology: it starts `powershell.exe` with fresh Claude and explicitly does not kill existing Claude; its lock only rate-limits its own launches. `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:13-14` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-109`
8. **INFERRED — uncertainty:** `sg` and watchdog recovery were not launched because both create external processes; definitions/workflows were inspected. `super-gsd/scripts/Install-SgsdShortcut.ps1:186-221` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-109`

### Weakness, repair, and proof

**RECOMMENDED — Keep the `sg` topology and fence watchdog recovery.** Have `sg` inject one bounded current-state summary. Before watchdog starts fresh Claude, require an ownership lease proving no healthy control plane exists; otherwise write recovery evidence only. A recovery process must attach/hand off or become the sole fenced writer, never race the caller-tab Claude. `super-gsd/scripts/Install-SgsdShortcut.ps1:186-221` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-109`

**Proof test:** process-mocked integration covers greet, go, missing Claude, failed cockpit, occupied port, explicit ProjectDir, dirty worktree, plus simultaneous healthy Claude and watchdog stale trigger. Assert normal Claude remains in the caller process, one cockpit starts, greeting uses effective state, and watchdog cannot create a second writer without lease/fencing. `super-gsd/scripts/Install-SgsdShortcut.ps1:186-221` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-130`

## Flow trace 4 — SSH/tmux → persistence → reconnect → degraded cockpit

### Current path

1. **OBSERVED:** `remote-launch.ps1 -DryRun` printed the remote Bash command, then explicitly reported that no SSH connection was opened. `super-gsd/scripts/sgsd-remote-launch.ps1:73-85`
2. **CONFIGURED:** source assembles `$sshArgs`/`$sshLine` with `-t`; lookup/invocation occurs only after the dry-run exit. No SSH invocation was OBSERVED. `super-gsd/scripts/sgsd-remote-launch.ps1:58-98`
3. **CONFIGURED:** `remote-tmux.sh` resolves scripts, checks tmux/Claude/Codex, starts the sidecar, creates a detached session, and builds four panes. `super-gsd/scripts/sgsd-remote-tmux.sh:123-174` `super-gsd/scripts/sgsd-remote-tmux.sh:202-281`
4. **CONFIGURED:** mission, Codex, and narrative panes use PowerShell implementations when available and text loops/tails otherwise; reconnect attaches to the named session. `super-gsd/scripts/sgsd-remote-tmux.sh:215-224` `super-gsd/scripts/sgsd-remote-tmux.sh:253-281`
5. **OBSERVED:** `git ls-files --eol` reports `i/lf w/crlf attr/` for the three shell scripts: committed/index content is LF, while this Windows checkout is CRLF. `core.autocrlf=true` and `git check-attr text eol` returns unspecified, so checkout conversion—not committed CRLF—caused the WSL carriage-return failure. Exact commands and outputs are in the verification ledger. `super-gsd/scripts/sgsd-remote-tmux.sh:1-3` `super-gsd/scripts/sgsd-boot.sh:1-3` `super-gsd/scripts/start-cockpit-server.sh:1-8`
6. **OBSERVED:** `remote-tmux` does not invoke `sg`; it directly starts Claude and the cockpit, so it is a separate topology. `super-gsd/scripts/sgsd-remote-tmux.sh:202-281` `super-gsd/scripts/Install-SgsdShortcut.ps1:186-221`
7. **CONFIGURED:** the sidecar binds `127.0.0.1`; the launcher configures `-t` but no `-L`, so browser reachability needs a separate tunnel. `super-gsd/tools/cockpit-sidecar/serve.cjs:519-535` `super-gsd/scripts/sgsd-remote-launch.ps1:58-98`
8. **INFERRED — uncertainty:** a native-Linux checkout should retain index LF under ordinary Git settings, but no native-Linux checkout or real SSH/tmux run was observed. The Windows-worktree/WSL result cannot substitute for that proof. `super-gsd/scripts/sgsd-remote-launch.ps1:58-98` `super-gsd/scripts/sgsd-remote-tmux.sh:157-281`

### Weakness, repair, and proof

**RECOMMENDED — Strengthen the remote path with an enforced checkout contract and real integration proof.** Add an explicit LF attribute for shipped `.sh` files so Windows+WSL worktrees remain executable; keep remote-tmux as a distinct supported entry; add optional cockpit forwarding or declare text-only mode; and expose machine-readable doctor/reconnect health. `super-gsd/scripts/sgsd-remote-launch.ps1:58-98` `super-gsd/scripts/sgsd-remote-tmux.sh:157-174`

**Proof test A — Windows checkout + WSL:** fresh checkout with `core.autocrlf=true`; assert `git ls-files --eol` reports `w/lf` after the new attribute, run `bash -n` and `--doctor` through WSL, then prove fallback panes. **Proof test B — native Linux:** fresh native checkout; assert blob/index/worktree LF independently, run `bash -n`/shellcheck, start real tmux with fake Claude/Codex, disconnect/reconnect, and verify panes. A loopback SSH fixture must observe actual `ssh -t` invocation/quoting and optional `-L`; curl reaches `/snapshot` only with forwarding. `super-gsd/scripts/sgsd-remote-tmux.sh:157-281` `super-gsd/scripts/start-cockpit-server.sh:218-269`

## Flow trace 5 — VTP absent/error → fallback

### Current path

1. **OBSERVED:** `.planning/config.json` enables VTP enrichment. `.planning/config.json:224-254`
2. **DOCUMENTED:** orchestration probes VTP, caches availability, logs degraded status, and continues locally when unavailable. `super-gsd/skills/sgsd-orchestrate/SKILL.md:318-363` `super-gsd/skills/sgsd-orchestrate/SKILL.md:745-770`
3. **OBSERVED:** bridge whitelist prevents unrelated uncertainty types from calling VTP. `super-gsd/tools/vtp-bridge/classify.cjs:578-588`
4. **OBSERVED:** unhealthy/timeout fixtures return empty results and log closed failure codes without injecting error text as evidence. `super-gsd/tools/vtp-bridge/classify.cjs:476-494` `super-gsd/tools/vtp-bridge/classify.cjs:756-880`
5. **OBSERVED:** the production call shim throws unless `_force_vtp_tool_response` is supplied; the orchestration example does not supply it. `super-gsd/tools/vtp-bridge/classify.cjs:503-527` `super-gsd/skills/sgsd-orchestrate/SKILL.md:970-1007`
6. **OBSERVED:** context-packet assigns `vtpPackets=[]` and returns it as `_vtp_packets`. `super-gsd/tools/context-packet/build.cjs:727-809`
7. **INFERRED:** absence is safely local-only, but successful enrichment through this bridge/builder seam is unreachable as written. `super-gsd/tools/vtp-bridge/classify.cjs:503-527` `super-gsd/tools/context-packet/build.cjs:727-809`

### Weakness, repair, and proof

**RECOMMENDED — Preserve the safe degraded contract while completing one production transport/admission seam.** Make the bridge accept an explicit production MCP adapter supplied by the orchestrator, with timeout ownership and a non-test name. Validate the resulting evidence packet once. Have context-packet admit only validated packets when route_hint.use_vtp is true, carry provenance hashes and elision metadata, and otherwise emit an explicit unavailable_or_bypassed status—not fabricated evidence.

**Proof test:** one end-to-end contract suite with (a) VTP absent, (b) timeout/error, (c) healthy empty results, (d) healthy valid results, and (e) invalid provenance/oversize results. Assert a–c continue locally with no VTP research content; d appears by reference in the exact future dispatch packet; e is rejected/elided. Run with the actual MCP adapter boundary mocked at transport level, not _force_vtp_tool_response inside the bridge.

## Flow trace 6 — memory observation → CMB/decision/distill → future dispatch

### Current path

1. **OBSERVED:** project-local MEMORY exists; curate writes it and recall searches it with legacy fallback. `.planning/memory/MEMORY.md:1-5` `super-gsd/scripts/sgsd-curate.sh:96-149` `super-gsd/scripts/sgsd-recall.sh:57-87`
2. **OBSERVED:** the schema defines seven CMB types and binds each to role/authority constraints. `super-gsd/schemas/cmb.schema.json:88-105` `super-gsd/schemas/cmb.schema.json:306-514`
3. **OBSERVED:** specialized tools validate/append execution receipts, review findings, evidence verdicts, recommendations, and context anchors. `super-gsd/tools/mesh-memory/execution-receipt.cjs:87-136` `super-gsd/tools/mesh-memory/review-finding-writer.cjs:88-136` `super-gsd/tools/mesh-memory/evidence-validator.cjs:1-44` `super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs:408-474` `super-gsd/tools/context-authority/context-anchor-writer.cjs:193-234`
4. **OBSERVED:** context-packet can include governed index snippets and repair scheduling inputs. `super-gsd/tools/context-packet/build.cjs:650-727`
5. **OBSERVED:** individual writers target the CMB ledger, but the main orchestration example does not compose a complete execution-to-promotion transaction. `super-gsd/tools/mesh-memory/execution-receipt.cjs:11-18` `super-gsd/tools/mesh-memory/review-finding-writer.cjs:7-11` `super-gsd/tools/mesh-memory/pseudo-operator-peer.cjs:18-18`
6. **OBSERVED:** cockpit memory reads a literal machine/project path and renders a static lineage array. `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:1516-1569` `super-gsd/tools/cockpit-sidecar/serve.cjs:247-255`
7. **OBSERVED:** harness runner declares but does not call `loadDistill`; apply is route-only. `super-gsd/tools/harness-evolution/run.cjs:28-31` `super-gsd/tools/harness-evolution/run.cjs:193-225`
8. **INFERRED:** recall can affect a future prompt, but a governed CMB-to-distill-to-next-dispatch loop is not proven. `super-gsd/skills/sgsd-orchestrate/SKILL.md:685-690` `super-gsd/tools/harness-evolution/run.cjs:193-225`

### Weakness, repair, and proof

**RECOMMENDED — Automate one bounded, auditable feedback transaction.** After an executor report is verified, the orchestrator should emit an execution receipt, link reviewer findings, run the evidence validator, request a pseudo-operator recommendation subject to real-operator carve-outs, and write promotion/closure. A separate governed projection may curate only promoted, non-stale learnings into project memory. Harness distill should consume the same transition/metric/CMB references and may propose one bounded candidate; future dispatch policy changes only after protected-surface checks, transfer/ablation evidence, attribution, and operator approval where required. The cockpit must render live ledger nodes and their consumer links, not a static chain.

**Proof test:** use a synthetic phase with one successful finding, one refuted critical finding, and one production-mutation recommendation. Assert creator-role schema, parent/ancestor hashes, no claim promoted as observation, production mutation requires a real operator, promoted learning becomes recallable, revoked/stale learning is excluded, distill links rather than copies source evidence, one approved candidate changes the next dispatch decision, and rollback restores the prior policy. Parallel-writer stress must prove JSONL integrity or motivate a single ledger writer/lock.

## Mandatory defect investigation — rationale card SAC-P142-03

### Reproduction

**OBSERVED — Requested command path:**

node super-gsd/tools/cockpit/rationale-card.test.cjs

Result: MODULE_NOT_FOUND because super-gsd/tools/cockpit/rationale-card.test.cjs does not exist in this checkout.

**OBSERVED — Actual focused assertion:**

node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P142-03

Result: FAIL — “expected >=2 rationale-card elements OR an explicit empty state, got 1 cards”.

**OBSERVED — Raw rationale DTO for live state:**

~~~text
milestone: v3.4
phase: 999
context: (no summary found)
eli5: >-
what_is: Now: >-
what_could_be: Then: >-
why_this_phase: (no context found)
evidence_trail: .planning/PROJECT.md, .planning/milestones/v3.4/INTENT.md
~~~

**OBSERVED — Independent semantic control:** js-yaml parsed the same v3.4 INTENT frontmatter into why length 807 and outcome_delivered length 883. The source data is present.

### Causal chain and earliest loss

| Boundary | Input | Output | Finding |
|---|---|---|---|
| v3.4 INTENT source | `why: >-` and `outcome_delivered: >-` plus indented text | Valid YAML folded scalars | **OBSERVED:** semantic rationale exists. `.planning/milestones/v3.4/INTENT.md:4-27` |
| rationale.cjs split/parseFrontmatter | Complete frontmatter text | `why=">-"`, `outcome_delivered=">-"` | **OBSERVED (primary cause):** the hand parser reads only key lines and ignores block-scalar continuation; this is the earliest loss. `super-gsd/tools/cockpit-sidecar/rationale.cjs:51-92` |
| sidecar phase selection | STATE status includes P999; folder exists | v3.4/P999 phase directory | **OBSERVED (contributing):** a synthetic PLAN-only phase is selected, but selection does not corrupt INTENT. `.planning/STATE.md:3-9` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:498-550` |
| rationale input resolution | project/intent readable; summary null; CONTEXT missing | summary/context placeholders | **OBSERVED (contributing):** alternate cards disappear; valid INTENT semantics would still prevent total loss. `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:18-30` `super-gsd/tools/cockpit-sidecar/rationale.cjs:172-205` |
| rationale DTO | legacy semantic fields plus evidence trail | markers and one real trail | **OBSERVED (contributing):** client has compatibility fallbacks, so field naming is not earliest loss. `super-gsd/tools/cockpit-sidecar/rationale.cjs:196-211` `super-gsd/tools/cockpit-sidecar/client.js:1692-1705` |
| client clean/filter | markers/placeholders | semantic cards filtered; evidence retained | **OBSERVED (not causal):** filtering prevents markers from reaching operators. `super-gsd/tools/cockpit-sidecar/client.js:1681-1705` |
| empty-state branch | evidence trail always returns a path or verbose placeholder | at least one card survives | **OBSERVED (contributing DTO/test defect):** true empty is unreachable while evidence placeholder remains card content. `super-gsd/tools/cockpit-sidecar/rationale.cjs:160-170` `super-gsd/tools/cockpit-sidecar/client.js:1694-1709` |
| rendered SAC | one evidence card | cards=1 | **OBSERVED (not causal):** DOM exposes upstream loss. `super-gsd/tools/cockpit-sidecar/run-self-test.cjs:1356-1363` |

### Primary, contributing, and non-causes

- **OBSERVED (primary):** the hand parser preserves block markers instead of folded/literal scalar content. `super-gsd/tools/cockpit-sidecar/rationale.cjs:78-92`
- **OBSERVED (contributing):** P999 is PLAN-only; CONTEXT is absent; `last_summary_md` defaults null. `.planning/milestones/v3.4/phases/999-localhost-startup-wiring/999-01-localhost-startup-wiring-PLAN-LOCKED.md:1-37` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:18-30`
- **OBSERVED (contributing):** status/folder heuristics can select an incomplete synthetic phase. `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:498-550`
- **OBSERVED (contributing):** evidence trail always emits display text, preventing a true-empty DTO. `super-gsd/tools/cockpit-sidecar/rationale.cjs:160-170`
- **OBSERVED (not causal):** client marker/placeholder filtering correctly refuses degenerate values. `super-gsd/tools/cockpit-sidecar/client.js:1681-1705`
- **INFERRED (not causal alone):** missing summary or legacy field names do not explain the loss when INTENT semantics are retained and the client maps both shapes. `super-gsd/tools/cockpit-sidecar/rationale.cjs:196-211` `super-gsd/tools/cockpit-sidecar/client.js:1692-1705`

### Smallest repair and regression proof

**RECOMMENDED — Smallest causal repair:** replace rationale.cjs’s frontmatter parser with the repository’s shared YAML parser/dependency resolver, or add standards-correct folded/literal scalar support in a single shared frontmatter utility. Do not teach the client to display “>-”; that would hide the loss.

**RECOMMENDED — Smallest contract strengthening:** make evidence status metadata separate from card content. evidence_trail should be empty/null when no cited source exists; degraded reasons belong in a typed source-health field. Then the explicit rationale-empty branch becomes reachable and meaningful.

**Proof tests:**

1. **Parser-only scalar fixture:** cover `>-`, `>`, `|-`, `|`, quoted, and plain values; assert normalized semantic strings and no raw markers. Keep this below the DTO/render boundary. `.planning/milestones/v3.4/INTENT.md:4-27` `super-gsd/tools/cockpit-sidecar/rationale.cjs:51-92`
2. **Populated DTO + render fixture:** provide semantic INTENT, summary, CONTEXT, and evidence sources; run `computeRationale` through the actual client renderer; assert multiple meaningful cards, cited evidence, no placeholders/markers, and no empty/degraded element. `super-gsd/tools/cockpit-sidecar/rationale.cjs:172-211` `super-gsd/tools/cockpit-sidecar/client.js:1681-1711`
3. **Partial DTO + render fixture:** provide exactly one semantic card source while other sources are absent; assert exactly one card is allowed only when the DTO also carries an explicit degraded/source-health indicator that the rendered drawer exposes. A lone card without that marker fails. `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:18-30` `super-gsd/tools/cockpit-sidecar/client.js:1681-1711`
4. **True-empty DTO + render fixture:** provide no semantic values and no cited source; assert zero `.rationale-card` elements and one explicit `.rationale-empty` element. The evidence placeholder must not manufacture a card. `super-gsd/tools/cockpit-sidecar/rationale.cjs:160-170` `super-gsd/tools/cockpit-sidecar/client.js:1705-1709`
5. **Separate active-phase completeness fixture:** a PLAN-only synthetic phase must be labelled incomplete/degraded before rationale rendering; do not treat that state check as a scalar/parser assertion. `.planning/milestones/v3.4/phases/999-localhost-startup-wiring/999-01-localhost-startup-wiring-PLAN-LOCKED.md:1-37` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:542-560`
6. Maintain a real focused command at a stable path, or publish `SAC-P142-03` as canonical. The documented command and executable test must agree. `super-gsd/tools/cockpit-sidecar/run-self-test.cjs:1356-1363`

## Decision and repair register

Every matrix verdict is expanded here with rationale, repair where required, owner boundary, migration risk, and proof.

| ID | Verdict and rationale | Concrete repair | Owner boundary | Migration risk | Required proof |
|---|---|---|---|---|---|
| D01 | **REPLACE:** two incompatible definitions of state authority make every read path conditional. | Version one transition authority; explicitly designate STATE as authority or projection; update all contracts together. | Control plane owns transitions; execution fabric supplies evidence only. | High: affects startup, recovery, gates, and docs. | Cross-consumer byte-equality fixture and unauthorized-writer rejection. |
| D02 | **STRENGTHEN:** STATE remains useful human history but is internally contradictory. | Generate compact canonical frontmatter atomically; move narrative/history to derived append-only artifacts; validate nested/top-level agreement. | Orchestrator single writer. | Medium: parsers may depend on legacy fields. | Pre/post migration fixture, atomic interruption test, all legacy consumers inventoried. |
| D03 | **STRENGTHEN:** folder inference recovers position but synthetic/incomplete phases can dominate. | Require active ROADMAP membership and minimum artifact state before a phase can outrank canonical state; label synthetic phases explicitly. | Planner/orchestrator writes artifacts; resolver validates read-only. | Medium. | Missing-roadmap, plan-only, closed-phase, and synthetic-number fixtures. |
| D04 | **STRENGTHEN:** resolver is valuable but not universal and checkpoint schema is wrong. | Adopt shared resolver in sidecar/startup/watchdog; parse the canonical checkpoint schema; return plan and artifact-completeness. | Shared read library, no writes. | Medium. | Existing 14 assertions plus production checkpoint and all-consumer contract suite. |
| D05 | **MERGE:** pause, resolver, chaos, hook, and watchdog vocabularies defeat one recovery proof. `super-gsd/templates/checkpoint.md:1-32` `super-gsd/tools/autopilot-watchdog/check.cjs:272-282` | One schema/parser/writer library; migrate open checkpoints before deleting aliases. | Recovery subsystem owner. | High for open checkpoints. | Pause/watchdog writer → resolver → MCP → chaos round trip. |
| D06 | **REPLACE:** delete-before-dispatch creates an acknowledgement gap. | Two-phase open/claimed/closed lifecycle with dispatch/receipt linkage and idempotency key. | Orchestrator controls lifecycle; executor cannot close itself. | High but bounded to recovery. | Five kill-point chaos matrix with exactly-once bounded dispatch. |
| D07 | **REMOVE:** JSON checkpoint hook writes a similarly named file no recovery consumer reads. | Either migrate its commit history into the canonical checkpoint event ledger or remove the hook/file. | Hook/installer owner. | Low if no hidden consumer; verify first. | Repository + installed-hook consumer census; uninstall/restart smoke. |
| D08 | **KEEP:** MCP envelopes, redaction, bounded recovery, and focused tests are strong. | No replacement. Continue schema-versioned additive changes only. | MCP read-only boundary. | Low. | Keep 47/47 plus degraded-source and redaction tests mandatory. |
| D09 | **STRENGTHEN:** adapter keeps shape under failure but combines effective and legacy sections incoherently. | Resolve scope once, pass it to every section builder, and expose one freshness object. | Cockpit adapter owner. | Medium. | Current contradictory fixture must produce one scope or fail degraded, never v3.4 objective plus v2.2 artifacts. |
| D10 | **MERGE:** browser sidecar duplicates state/phase and source-health semantics. | Reuse effective-state and shared snapshot DTO; keep browser-specific view models downstream. | Sidecar read/render boundary. | Medium-high due SPA fields. | Golden schema adapters, SSE refresh, and degraded-section browser tests. |
| D11 | **KEEP:** local sg preserves required Warp/Claude topology and is installed. | No topology change; improvement belongs to greeting contract under D04/D09. | Local launcher/profile owner. | Low. | Mocked greet/go/process-placement integration. |
| D12 | **STRENGTHEN:** index/blob LF is converted to CRLF in this Windows worktree because no EOL attribute overrides `core.autocrlf`; remote assembly exists but SSH/tmux was not observed. `super-gsd/scripts/sgsd-remote-launch.ps1:58-98` | Enforce LF checkout for `.sh`, document the distinct topology, add machine-readable doctor/reconnect proof. | Remote operations owner; no direct SGSD state mutation. | Medium. | Separate Windows+WSL and fresh native-Linux bash/tmux proofs, plus observed SSH invocation. |
| D13 | **STRENGTHEN:** loopback binding is safe but browser reachability is undocumented in launcher behavior. | Optional explicit SSH -L mapping and separate remote/local URL reporting; retain text-only degraded mode. | Remote launcher/network edge. | Low-medium; avoid exposing non-loopback. | Curl through tunnel, negative no-tunnel test, sidecar-down fallback. |
| D14 | **KEEP:** VTP absent/error isolation meets the optional-KB rule. | Preserve empty-packet and status-note behavior. | VTP bridge may report, never block local delivery. | Low. | Keep 11/11 and add actual adapter timeout test. |
| D15 | **STRENGTHEN:** success transport is a test shim and packet builder discards packets. | Production MCP adapter plus validated context-packet admission. | Orchestrator owns MCP call; packet builder owns validation/composition. | Medium-high for privacy/provenance. | Five-case end-to-end VTP contract with future-dispatch assertion. |
| D16 | **KEEP:** project-local recall/curate is real, simple, and gracefully supports legacy stores. | No architectural replacement; portability issue belongs to D19. | Operator/orchestrator explicit curation. | Low. | Curate → recall → revoke/remove smoke in temp project. |
| D17 | **KEEP:** CMB schema encodes genuine role and authority separation. | Retain closed vocab and validation-before-admit. | Specialized producer roles; validator independent. | Low. | Schema negative fixtures and lineage/hash tamper tests remain mandatory. |
| D18 | **AUTOMATE:** components do not form a live evidence-to-decision transaction. | Wire one bounded orchestration chain and a single append/locking boundary; emit completeness status. | Orchestrator sequences; each role only emits its allowed CMB. | High: risks false authority. | Full chain, refutation, carve-out, concurrency, revocation, and future-consumption tests. |
| D19 | **REPLACE:** machine-specific memory discovery plus static lineage can imply nonexistent evidence. | Resolve project-local memory/CMB paths from workspace/config; render only observed ledger nodes; show explicit absent state. | Sidecar read-only; setup owns optional auto-memory link. | Medium. | Two-user/two-worktree path fixture, relocation test, absent-ledger visual test. |
| D20 | **AUTOMATE:** append-only evidence is designed but absent in the live checkout and lacks required-stream closure. | Version a stream registry with producer/consumer/purpose/retention/required-at-stage; emit run ID and health. | Producers append; consumers read; no cockpit writer. | Medium. | Cold start, malformed row, rotation, missing-required-stream, and run-completeness fixtures. |
| D21 | **KEEP:** distiller is deterministic, bounded, tolerant, and tested. | Do not broaden it into an autonomous writer of policy; invoke it through D22. | Read evidence/write derived run corpus. | Low. | Keep 18/18 plus lineage pointer validation. |
| D22 | **AUTOMATE:** runner advertises an outer loop but neither invokes distill nor applies/feeds candidates. | Compose evaluate → distill → propose → protected route → sandbox test → attribute → approve → future policy with rollback. | Harness may propose; protected edits/operator decisions remain gated. | High. | Held-out transfer, ablation, critical-regression block, one-candidate limit, rollback, next-dispatch delta. |
| D23 | **MERGE:** watchdog has useful external stall detection but independently resolves state, writes recovery/checkpoint artifacts, and can start a second Claude process. `super-gsd/tools/autopilot-watchdog/check.cjs:93-175` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-109` | Reuse shared resolver/checkpoint schema; add ownership lease/fencing; default to evidence-only recovery when a healthy owner exists. | External detector may report; canonical transition/launch authority remains fenced control plane. | High: concurrent orchestrators can race state/gates. | Writer-schema round trip, stale-trigger with healthy Claude, expired-owner takeover, and exactly-one recovery launch. |

## Metrics: decision inputs versus display-only projections

**OBSERVED — Decision/recovery inputs:** resolver and watchdog consume pulse/activity/freshness evidence; context-packet consumes governed context inputs; VTP rows affect degraded routing; explicit harness distill consumes seven streams. `super-gsd/tools/state-resolver/resolve.cjs:521-610` `super-gsd/tools/autopilot-watchdog/check.cjs:388-399` `super-gsd/tools/context-packet/build.cjs:650-727` `super-gsd/tools/vtp-bridge/classify.cjs:578-639` `super-gsd/tools/harness-evidence/distill.cjs:31-38`

**OBSERVED — Display/count projections:** cockpit adapter and Warp MCP summarize ledgers; browser sidecar attaches independent stream health; harness evolution surfaces counts/latest verdict rather than applying policy. `super-gsd/tools/cockpit-state/adapter.cjs:1230-1314` `super-gsd/tools/warp-mcp/server.cjs:2276-2368` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:1854-1896`

**INFERRED — Display plus read does not establish feedback.** Required proof is one run identity linking producer row → decision consumer → changed bounded action → attributed outcome. `super-gsd/tools/harness-evolution/run.cjs:193-225`

**RECOMMENDED — Add a metrics manifest and run-closure receipt.** Each stream should declare schema version, authoritative producer, consumers, whether it is decision-bearing or display-only, freshness/retention, privacy class, and required stages. At checkpoint/phase close, emit a receipt listing required streams, last valid row/hash, and intentional absences. Cockpit must display that receipt rather than converting every missing stream to benign zero.

## MCP and cockpit degraded semantics

**OBSERVED — Warp MCP strengths:** 15 frozen tools, schema-v1 envelope, closed errors, `_degraded`, bounded recovery, redaction, and read-only behavior; current-state/recovery expose resolver metadata. `super-gsd/tools/warp-mcp/server.cjs:40-149` `super-gsd/tools/warp-mcp/server.cjs:468-622` `super-gsd/tools/warp-mcp/server.cjs:1322-1478`

**OBSERVED — Adapter strengths:** fixed 12-section shape, per-section degraded sentinels, read-only behavior, and explicit staleness/harness sections. `super-gsd/tools/cockpit-state/adapter.cjs:117-142` `super-gsd/tools/cockpit-state/adapter.cjs:1130-1314` `super-gsd/tools/cockpit-state/adapter.cjs:1370-1426`

**OBSERVED — Composition weakness:** browser sidecar builds a separate source-health/warning DTO and does not consume the shared resolver conflict contract. `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:494-575` `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs:1841-1896`

**RECOMMENDED — One semantic snapshot, multiple views.** Define a versioned domain snapshot containing resolved scope, source observations, freshness/conflicts, evidence links, and degraded reasons. MCP returns it in its envelope; browser maps it into mission/telemetry/etc.; terminal renderers map it to their compact sections. View-specific fields may remain additive, but scope and source health must be shared.

## Candidate milestone work packets

These are draft candidates only. They do not activate a milestone or mutate roadmap/state.

### Rank 1 — Transactional state and checkpoint authority

- **Verdict:** REPLACE/MERGE D01–D07; MERGE D23.
- **Outcome:** one state-transition/checkpoint schema, exactly-once resume, canonical/projection language resolved, and watchdog recovery fenced to one control-plane owner. `super-gsd/tools/autopilot-watchdog/check.cjs:161-175` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-109`
- **Owner boundary:** control plane is sole transition writer; resolver/MCP/cockpit are read-only; executor contributes evidence only.
- **Migration risk:** high; preserve old open checkpoints through an explicit reader/migrator.
- **Exit proof:** pause and watchdog checkpoint producers plus five kill-point chaos suite; every state consumer byte-agrees; simultaneous stale trigger and active Claude produce no duplicate writer/dispatch.

### Rank 2 — Repair rationale semantics and active-phase completeness

- **Verdict:** STRENGTHEN D03 plus causal rationale fix.
- **Outcome:** standards-correct YAML semantics, useful rationale or honest empty state, synthetic/plan-only phase clearly degraded.
- **Owner boundary:** shared parser and sidecar DTO; no state mutation by renderer.
- **Migration risk:** medium due changed rendered text/goldens.
- **Exit proof:** focused scalar matrix, live-shaped P999 test, explicit empty-state test, browser acceptance, stable documented command.

### Rank 3 — Make SSH/tmux a real supported path

- **Verdict:** STRENGTHEN D12/D13.
- **Outcome:** enforced LF checkout across Windows+WSL and native Linux, real tmux persistence/reconnect, observed SSH invocation, explicit browser tunnel or text-only mode. `super-gsd/scripts/sgsd-remote-launch.ps1:58-98` `super-gsd/scripts/sgsd-remote-tmux.sh:202-281`
- **Owner boundary:** launch/runtime only; no remote helper writes canonical state.
- **Migration risk:** medium across Windows/Linux quoting and installed global scripts.
- **Exit proof:** separate Windows-checkout/WSL and fresh native-Linux bash/tmux integrations, plus loopback SSH tunnel and degraded-pane tests.

### Rank 4 — Unify state projection across MCP and browser cockpit

- **Verdict:** STRENGTHEN/MERGE D04, D09, D10, D23.
- **Outcome:** one semantic snapshot and freshness verdict; browser/MCP/terminal views cannot disagree on scope/artifacts.
- **Owner boundary:** shared read library owns resolution; views own presentation only.
- **Migration risk:** medium-high for the SPA contract.
- **Exit proof:** contradictory-state fixture through every surface—including watchdog—and schema-adapter goldens; all emit one scope/freshness verdict. `super-gsd/tools/autopilot-watchdog/check.cjs:383-451`

### Rank 5 — Complete the optional VTP transport seam

- **Verdict:** KEEP D14, STRENGTHEN D15.
- **Outcome:** private KB remains optional; healthy results can actually reach a future packet with provenance.
- **Owner boundary:** orchestrator transport; bridge validation; context-packet admission.
- **Migration risk:** medium-high privacy/provenance risk.
- **Exit proof:** absent/error/empty/success/invalid five-case suite with exact dispatch-packet assertions.

### Rank 6 — Operationalize CMB evidence without faking authority

- **Verdict:** KEEP D16/D17, AUTOMATE D18, REPLACE D19.
- **Outcome:** live role-bound chain, governed promotion/revocation, project-relative cockpit view, future dispatch consumption.
- **Owner boundary:** specialized roles emit only permitted CMBs; real-operator carve-outs remain binding.
- **Migration risk:** high.
- **Exit proof:** end-to-end chain including refuted CRIT, production escalation, revocation, parallel append integrity, and recall/dispatch delta.

### Rank 7 — Close the harness learning loop

- **Verdict:** KEEP D21, AUTOMATE D20/D22.
- **Outcome:** run-complete metrics, actual distill invocation, bounded candidate sandbox, attribution, approval, rollback, future policy effect.
- **Owner boundary:** harness proposes/tests; protected surface and policy promotion stay operator/gate controlled.
- **Migration risk:** high because self-modification can regress evaluation.
- **Exit proof:** held-out transfer and ablation, critical-regression blocker, rollback drill, one observable next-dispatch change.

### Rank 8 — Portability and evidence hygiene

- **Verdict:** STRENGTHEN D02/D20; REPLACE D19 path discovery.
- **Outcome:** no literal user/worktree paths in runtime discovery; required-stream absence is explicit; generated runtime files separated from durable evidence.
- **Owner boundary:** setup resolves links/config; runtime readers consume workspace-relative paths.
- **Migration risk:** low-medium.
- **Exit proof:** relocate repository, change user/home, run two worktrees concurrently, and assert memory/cockpit isolation plus no personal path leakage.

## Verification ledger

| Command | Outcome | What it proves | What it does not prove |
|---|---|---|---|
| `node super-gsd/tools/state-resolver/resolve.cjs --json` | PASS, v3.4/P999 from phase_folders, projection_stale=true | Live resolver detects current conflict | Does not repair or block dispatch |
| `node super-gsd/tools/state-resolver/resolve.cjs --self-test` | PASS 14/14 | Priority, degraded, staleness, read-only component behavior | Production checkpoint schema compatibility |
| `node super-gsd/tools/cockpit-state/run-self-test.cjs` | PASS 19/19 | Stable 12-section shape and degraded sections | Cross-surface semantic consistency |
| `node super-gsd/tools/warp-mcp/run-self-test.cjs` | PASS 47/47 | MCP envelopes, fixtures, recovery size, redaction, live calls | Remote MCP availability or state convergence |
| `node super-gsd/tools/vtp-bridge/classify.cjs --self-test` | PASS 11/11 | Whitelist, failure isolation, caps, provenance fixtures | Real MCP success transport/admission |
| `node super-gsd/tools/harness-evolution/run-self-test.cjs` | PASS 17/17 | Runner safety/refusal/manifest/route-stub behavior | Closed-loop evolution |
| `node super-gsd/tools/harness-evidence/run-self-test.cjs` | PASS 18/18 | Deterministic distillation and malformed-row isolation | Automatic invocation or future policy effect |
| `node super-gsd/tools/autopilot-watchdog/check.cjs --self-test` | PASS | Raw-state detector and writer fixtures, including preservation of non-watchdog checkpoint | Shared resolver/schema or concurrent-Claude fencing |
| `node super-gsd/tools/cockpit/rationale-card.test.cjs` | FAIL, MODULE_NOT_FOUND | Requested command drift is real | Rationale behavior |
| `node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P142-03` | FAIL, one card | Live rendered rationale defect | Other SACs |
| `node super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs --json` plus direct `rationale.cjs` call | PASS as diagnostic; marker-only DTO reproduced | Earliest loss exists before client rendering | Browser layout quality |
| `node` with `js-yaml` parsing `.planning/milestones/v3.4/INTENT.md` | PASS; 807/883-character values | Source YAML is semantically valid | Shared parser migration safety |
| `Get-Command sg,sgsd` | PASS; installed functions found | Local functions are installed and topology source matches | Full launch, because it was intentionally not executed |
| `powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/scripts/sgsd-remote-launch.ps1 -DryRun` | PASS; printed remote Bash command and “No SSH connection opened” | Remote Bash-command construction only | `ssh -t` invocation, remote execution, tmux, or reconnect |
| `wsl bash super-gsd/scripts/sgsd-remote-tmux.sh --doctor` | FAIL before parsing due worktree CRLF | Windows-checkout/WSL path is broken under current conversion | Native-Linux checkout behavior |
| `git ls-files --eol -- super-gsd/scripts/sgsd-remote-tmux.sh super-gsd/scripts/sgsd-boot.sh super-gsd/scripts/start-cockpit-server.sh` | `i/lf w/crlf attr/` for all three | Index/blob LF differs from Windows worktree CRLF | Native-Linux execution |
| `git config --get core.autocrlf` plus `git check-attr text eol -- <three scripts>` plus direct `git cat-file blob HEAD:<path>`/worktree byte counts | `true`; attributes unspecified; blob CR=0 while worktree CR=LF | Checkout conversion and missing EOL enforcement caused WSL failure; blobs are LF | Behavior after adding an EOL attribute |

## Explicit uncertainties and audit limits

- **INFERRED — uncertainty:** no current ORCHESTRATOR-CHECKPOINT.md exists, so production recovery was evaluated from source, fixtures, and MCP behavior rather than mutating state to create one.
- **INFERRED — uncertainty:** the original dirty worktree was not touched or inspected for uncommitted runtime evidence. Findings apply to this isolated branch snapshot.
- **INFERRED — uncertainty:** no SSH connection to devcp or another remote host was authorized/executed. The remote PowerShell launcher was dry-run and the vendored bash helper was locally executed under WSL only.
- **INFERRED — uncertainty:** a separately installed global remote helper could differ from the committed worktree helper. That cannot satisfy the worktree-first support claim without version/eol proof.
- **INFERRED — uncertainty:** sg was not launched because it would open cockpit processes/windows and start Claude. Installed command definitions and workflows were observed.
- **INFERRED — uncertainty:** VTP MCP availability was not tested. The audit proves failure isolation and identifies the unwired success boundary from source; it does not claim the external KB is down.
- **INFERRED — uncertainty:** .planning/metrics, .planning/mesh/memory/cmbs.jsonl, and .planning/harness-evolution are absent in this checkout. Runtime feedback claims are therefore classified CONFIGURED or INFERRED, never observed.
- **INFERRED — uncertainty:** this lane did not execute source-mutating, metric-writing, CMB-writing, browser-opening, or full milestone gates. Focused tests were selected for read-only/temp-fixture behavior.
- **INFERRED — uncertainty:** source comments sometimes name historical phase counts or contracts that differ from current exported shapes. Runtime/exported values were preferred over comments.

## Bottom line

**OBSERVED:** SGSD is rich in typed components and graceful sentinels, but state/recovery truth is split and several “learning” paths stop at representation. The immediate architectural priority is one transactional state/checkpoint authority exercised by every consumer, including the watchdog, with fenced recovery at handoff boundaries. The immediate concrete bug is the rationale parser’s loss of folded YAML semantics. The immediate remote defect is checkout policy: blobs/index are LF, but this Windows worktree becomes CRLF and fails through WSL; native-Linux SSH/tmux remains unproven. `super-gsd/tools/autopilot-watchdog/check.cjs:93-175` `super-gsd/scripts/sgsd-autopilot-watchdog.ps1:82-109` `super-gsd/tools/cockpit-sidecar/rationale.cjs:78-92` `super-gsd/scripts/sgsd-remote-launch.ps1:58-98`

**RECOMMENDED:** execute candidate packets 1–3 before expanding autonomy, then unify cockpit projection, complete optional VTP success admission, operationalize governed CMB lineage, and only then allow harness evidence to change future dispatch behavior. Preserve the existing gates and authority carve-outs throughout; none of these repairs requires bypassing ATC, verifier, MUDA, release-readiness, or edge-guard.

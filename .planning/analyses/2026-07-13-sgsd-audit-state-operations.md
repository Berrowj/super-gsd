# SGSD State and Operations Audit

Date: 2026-07-13

Scope: state authority, persistence and recovery, cockpit and MCP projections, local Warp startup, SSH/tmux operation, optional VTP degradation, project memory and CMB feedback, metrics, and harness learning

Method: read-only source and live-state inspection in the isolated audit worktree; no state, roadmap, source, configuration, hook, test, metric, or active-milestone mutation
Overall verdict: **STRENGTHEN before the next autonomous milestone; replace the split state/checkpoint authority before claiming crash-safe operation**

## Executive outcome

**OBSERVED — The system has good defensive components but not one coherent operational truth path.** The effective-state resolver, Warp MCP envelopes, cockpit adapter degradation sentinels, VTP failure isolation, CMB authority schema, and harness component tests are substantive. Their focused self-tests passed. The weakness is composition: the repository contract calls STATE.md canonical while the resolver calls it a lowest-priority legacy projection; the live localhost sidecar bypasses the resolver; checkpoint producers, resolver, and chaos validator use incompatible field sets; and several “closed-loop” surfaces are display or scaffolding rather than consumers of live feedback.

**OBSERVED — Current repository state demonstrates the split.** .planning/STATE.md declares top-level milestone v3.4 and status P999, but its nested roadmap_run still declares v2.2 complete, its milestone narrative says P142/P143 are next, last_updated is 2026-05-20, the v3.4 milestone ROADMAP.md is absent, and P999 has only a PLAN-LOCKED artifact. The effective resolver chooses v3.4/P999 from phase folders, reports projection_stale=true, and recommends re-syncing STATE.md. Warp MCP adopts that effective phase, yet its cockpit snapshot still takes “now” from stale STATE.md prose and artifacts from v2.2. This is detection without convergence.

**OBSERVED — Recovery is not transactionally closed.** The documented pause path writes and commits a checkpoint. The documented resume path deletes and commits that checkpoint before dispatching its next unit. An interruption after consumption but before a new durable state transition loses the exact handoff. More basically, the canonical checkpoint template uses active_milestone/active_phase, while the state resolver recognizes milestone plus current_phase or phase, and the chaos validator requires another six-field vocabulary. The highest-priority resolver source therefore cannot parse the normal checkpoint template as authoritative state.

**OBSERVED — The rationale-card failure is a real earliest-loss defect, not a rendering flake.** The requested focused test path does not exist, but its live assertion is SAC-P142-03 in the cockpit-sidecar self-test. That assertion reproducibly fails with one card. v3.4 INTENT.md contains valid folded YAML scalars; rationale.cjs keeps only the literal marker “>-”; P999 has no CONTEXT and no prior summary is supplied; the client correctly filters marker and placeholder values; evidence_trail remains, producing exactly one card. A standard YAML parser recovers 807- and 883-character semantic strings from the same source.

**OBSERVED — Local Windows startup is the strongest operational path.** The installed sg and sgsd PowerShell functions exist. sg invokes the cockpit boot first, then launches Claude in the same terminal, preserving the Warp detector topology. The two Warp workflows call sg and sg -Go. This deserves KEEP, with one strengthening change: the greeting must use effective state rather than directly asking Claude to trust stale STATE.md frontmatter.

**OBSERVED — Remote support is documented and source-complete in shape but not executable from this checkout.** The PowerShell remote launcher emits a real ssh -t command and the tmux script defines operator, mission, Codex, and narrative panes plus text fallbacks. However, the committed .sh blobs use CRLF; invoking the remote tmux helper under Linux/WSL fails on line endings before argument parsing. The helper also does not run sg, and the remote localhost cockpit binds 127.0.0.1 without the launcher creating an SSH local forward. The actual supported remote experience is therefore intended tmux text panes, not the local Warp sg topology and not a browser-visible cockpit without separate tunnelling.

**OBSERVED — Optional VTP failure handling is safer than VTP success wiring.** The VTP bridge self-test proves unhealthy and timeout cases return empty packets and log failure status without injecting error text as research. Yet the production bridge contains no MCP transport unless a test-only response shim is injected, the orchestration example does not inject one, and context-packet/build.cjs always sets vtpPackets to an empty array. Absence is graceful; successful enrichment reaching a future dispatch is not established.

**OBSERVED — CMB authority boundaries are strong on paper and weak in live composition.** cmb.schema.json binds each CMB type to a creator role and authority level, with real writers and validators. But .planning/mesh/memory/cmbs.jsonl is absent, the main orchestration skill does not compose the full execution_receipt → review_finding → evidence_verdict → decision_recommendation → promotion_decision chain, and the cockpit renders a static five-step lineage while reading a machine-specific Claude memory path rather than the live CMB ledger. Project-local MEMORY.md exists and recall/curate are usable, but that is a separate memory channel.

**OBSERVED — Harness learning is component-tested, not closed-loop.** The evidence distiller and evolution runner self-tests pass. In the runner, loadDistill is declared but never invoked; apply-candidate is explicitly route-only; no production caller invokes the runner APIs; and the current checkout has neither metrics nor harness-evolution runs. Cockpit and MCP count harness ledgers when present, which is observability, not proof that evidence changes future dispatch policy.

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
| D01 — State authority contract | AGENTS.md says STATE.md is canonical; resolver says it is legacy projection | Orchestrator plus derived evidence streams | Every CLI, MCP, cockpit, and agent | Conflicting rules: canonical frontmatter versus priority/TTL resolver | Control plane writes STATE; resolver is read-only | Consumers choose different truths | Determines cold-start position | AGENTS.md “Truth Locations”; state-resolver/resolve.cjs:3-31 | 1 | REPLACE |
| D02 — .planning/STATE.md live projection | Top-level milestone/status mixed with nested roadmap_run | Orchestrator/manual history | Claude greeting, sidecar, adapter, MCP fallbacks | last_updated plus prose; no atomic invariant across nested fields | Intended single control-plane writer | Stale prose remains readable | Cold-start fallback | STATE.md:3-9, 194-197; live resolver output | 1 | STRENGTHEN |
| D03 — Milestone roadmap and phase artifacts | Per-milestone ROADMAP plus CONTEXT/PLAN/VERIFICATION | Planner/orchestrator/executors | Resolver, cockpit, gates, operators | Folder presence and verification status heuristics | Plan-bound writes | Missing roadmap/context silently falls back to folders/prose | Reconstructs position | v3.4 ROADMAP absent; P999 PLAN-only | 1 | STRENGTHEN |
| D04 — Effective state resolver | Priority checkpoint → pulse → activity → folders → git → STATE | Read-only derivation | Warp MCP and cockpit-state adapter | Explicit TTLs: checkpoint <2h, pulse <30m, activity <60m | Read-only | Returns degraded envelope/recommended repair | Best available reconstruction | state-resolver/resolve.cjs; 14/14 self-test | 3 | STRENGTHEN |
| D05 — Checkpoint schema | No single schema: template, pause skill, resolver, chaos validator diverge | Pause skill, manual orchestrator, hooks | Resume skill, MCP, resolver, chaos tests | Resolver accepts fresh checkpoint only if recognized phase field exists | Checkpoint file committed | Unparseable fields fall through to lower-priority sources | Supposed highest-priority recovery truth | checkpoint.md; sgsd-pause/SKILL.md; resolver:489-515; chaos manifest validator:51-63 | 1 | MERGE |
| D06 — Checkpoint lifecycle | Checkpoint file and git commit | Pause/resume skill | Next Claude session | Presence/mtime only; no claim/ack/close state | Resume deletes before dispatch | Falls to stale STATE/folder inference after deletion | Exact interrupted-unit handoff | CLAUDE.md:369-392; sgsd-resume/SKILL.md | 1 | REPLACE |
| D07 — Auxiliary JSON checkpoint hook | ORCHESTRATOR-CHECKPOINT.json commit history | PostToolUse hook | No resolver/MCP consumer found | Updated after matching “git commit” text | Atomic temp rename; silent failure | Completely ignored by main recovery | None in current recovery | hooks/gsd-checkpoint-writer.js | 1 | REMOVE |
| D08 — Warp MCP current-state/recovery | Effective resolver wrapped in schema-v1 envelope | Read-only MCP server | Warp agents and workflows | Carries projection_stale/conflicts/repair | Read-only and redacted | Canonical degraded envelopes; source-missing codes | Produces bounded recovery packet | warp-mcp/server.cjs; 47/47 self-test | 4 | KEEP |
| D09 — MCP cockpit-state adapter | Effective objective plus multiple legacy sections | Adapter over STATE, metrics, folders | sgsd_cockpit_snapshot | Per-section staleness and degraded sentinels | Read-only | All 12 sections retained; _section_degraded | Operator status/recovery context | cockpit-state/adapter.cjs; 19/19 self-test | 3 | STRENGTHEN |
| D10 — Local localhost sidecar snapshot | Independent STATE parser and folder scan | cockpit-sidecar.cjs/serve.cjs | Browser SPA/SSE | Recursive watch or fixed paths; source liveness registry | Runtime pid/health writes only | Warnings, circuit breakers, partial snapshot | Visual diagnosis, not canonical recovery | cockpit-sidecar.cjs:495-575, 1854-1896 | 2 | MERGE |
| D11 — Local Warp sg launch | Installed PowerShell functions and Warp workflows | Install-SgsdShortcut.ps1/profile | Operator/Claude in current Warp tab | Boot-time health/preflight | Starts cockpit process/windows, then Claude current terminal | Reports missing Claude/cockpit separately | Primary daily entry | Install-SgsdShortcut.ps1:186-221; workflows sgsd-start/auto | 4 | KEEP |
| D12 — SSH/tmux launch | Dedicated remote helper, not sg | remote-launch.ps1 → ssh → remote-tmux.sh | SSH operator and tmux panes | Doctor probes commands; tmux session presence | Creates metrics placeholders/session/panes | PowerShell dashboards fall back to text tails | tmux persists after disconnect | remote scripts; dry-run; CRLF execution failure | 0 | REPLACE |
| D13 — Remote browser cockpit | Remote loopback sidecar | start-cockpit-server.sh | Browser only on remote host unless tunnelled | HTTP /snapshot health check | Runtime pid/port/url files | tmux text panes continue if sidecar fails | Supplemental, not recovery-critical | serve.cjs:519; start-cockpit-server.sh; no -L in launcher | 1 | STRENGTHEN |
| D14 — VTP failure/degraded path | Local route/bridge policy; VTP optional | Orchestrator/bridge | Context packet and future agent prompt | Session health plus route whitelist | Appends health/failure/route rows | Empty packet, closed reason, local continuation | Prevents private-KB outage from blocking | vtp-bridge/classify.cjs; 11/11 self-test | 4 | KEEP |
| D15 — VTP success transport/admission | Intended MCP result packet | VTP bridge caller | context-packet/build.cjs | Provenance and token caps configured | Bridge logs; packet builder read/compose | Currently collapses to empty packet | None | bridge:501-528; orchestrate skill:967-1000; context-packet:727-730 | 1 | STRENGTHEN |
| D16 — Project-local recall/curate memory | .planning/memory/MEMORY.md | sgsd-curate and distillation | sgsd-recall and Claude auto-memory link | Index contents; no age policy | Explicit curate writes; project-local | Legacy .brv fallback | Restores prior patterns/decisions | MEMORY.md present; recall/curate scripts | 3 | KEEP |
| D17 — CMB type and authority contract | cmb.schema.json role/type/authority constraints | Specialized writers/validators | Chronicle, context tools, future decision path | Hash, lineage, status, revalidation rules | Append-only JSONL writers | Missing ledger generally returns empty/degraded | Could reconstruct evidence lineage | cmb.schema.json; mesh-memory tools | 4 | KEEP |
| D18 — Live CMB feedback chain | Intended CMB ledger | Executor/reviewer/evidence/pseudo-operator/promotion writers | Future dispatch/context/cockpit | No live ledger or continuous completeness check | Raw appendFileSync from independent tools | Static/empty views | Not proven | cmbs.jsonl absent; orchestrator has no complete chain call | 0 | AUTOMATE |
| D19 — Cockpit memory and lineage | Machine-specific Claude-memory path plus static lineage array | sidecar attacher | Browser | Watcher tied to literal encoded project slug | Read-only | Empty memory graph but static lineage still displays | Can mislead recovery | cockpit-sidecar.cjs:1516-1569; serve.cjs:247-255 | 1 | REPLACE |
| D20 — Metrics evidence plane | Append-only JSONL by many components | Orchestrator/tools/hooks | Resolver, gates, MCP, cockpit, distiller | Stream-specific TTLs; no global required-stream manifest | Append-only by convention | Missing streams often become zero/absent | Supports reconstruction if present | .planning/metrics absent; adapter and distiller readers | 1 | AUTOMATE |
| D21 — Harness evidence distiller | Seven metrics streams plus optional benchmark | Explicit distillRun invocation | Human/candidate author | Optional since/until filter | Writes run corpus | Malformed rows isolated; empty corpus returns not-ok | Post-run diagnosis | harness-evidence/distill.cjs; 18/18 self-test | 3 | KEEP |
| D22 — Harness evolution loop | Candidate spec and protected-surface registry | Explicit runner modes | Manifest/attribution/cockpit counters | No scheduler or future-dispatch policy consumer | Proposal/log writes; apply is route-only | Returns safe refusal/sentinel | None automatic | harness-evolution/run.cjs/README; 17/17 self-test | 1 | AUTOMATE |

## Central claim adjudication

| Claim | Verdict | Evidence-backed answer |
|---|---|---|
| Is there one path resolver? | **No, partially centralized.** | **OBSERVED:** state-resolver is shared by Warp MCP and cockpit-state adapter. The live localhost sidecar independently parses STATE.md and scans folders. Claude startup instructions and sg greeting also direct a raw STATE read. |
| Is freshness enforced? | **Detected, not enforced or reconciled.** | **OBSERVED:** resolver emits projection_stale and recommended_repair, while MCP still returns ok=true and /sgsd-orchestrate go. The cockpit snapshot simultaneously says state_md.stale=false and projection_stale=true. No required pre-dispatch compare-and-swap or repair gate was found. |
| Are metrics consumed or only displayed? | **Both, stream by stream; current runtime proof is absent.** | **OBSERVED:** resolver consumes pulse/activity, context governance consumes complaint/index streams, and harness distill can consume seven streams. Cockpit/MCP also read many streams only to display/count them. **OBSERVED:** .planning/metrics is absent here, so current values are configuration/test evidence, not an observed operating loop. |
| Are CMB role boundaries real? | **Yes at schema/writer level; no at main-loop composition level.** | **OBSERVED:** schema const/pattern constraints bind CMB type, creator, role, and authority. Specialized writers validate before append. **OBSERVED:** no live ledger and no full orchestrator chain prove these boundaries are exercised on normal dispatches. |
| Does harness feedback alter future behavior? | **No evidence of a closed loop.** | **OBSERVED:** distill and runner components pass tests, but run.cjs never calls loadDistill, apply is a route stub, and no production caller of runner APIs was found. Cockpit/MCP counters are observability only. |
| Do MCP and cockpit share a stable schema and degraded contract? | **MCP does; the two cockpit surfaces do not share one contract.** | **OBSERVED:** Warp MCP uses schema-v1 envelopes and a fixed 12-section adapter with degraded sentinels. The browser sidecar emits a separate additive object, warnings, seven _sources entries, and 18 stream-health entries. It has useful local degradation but no shared DTO/schema with MCP. |
| Are remote commands real? | **The PowerShell dry-run command is real; the vendored Linux path is currently unusable.** | **OBSERVED:** remote-launch.ps1 emitted ssh -t with the expected helper, project, session, and greet arguments. **OBSERVED:** bash execution of the committed tmux helper failed immediately because its blob is CRLF. The launcher supplies no browser port forward. |

## Flow trace 1 — checkpoint create → interruption → resume → closure

### Current path

1. **DOCUMENTED:** /sgsd-pause gathers STATE and session work, writes .planning/ORCHESTRATOR-CHECKPOINT.md, stages it with STATE.md, and commits.
2. **OBSERVED:** the template writes created_at, active_milestone, active_phase, next_unit, phase_state, token/model counts, and resume_instruction.
3. **OBSERVED:** the effective resolver’s checkpoint probe accepts milestone plus current_phase or phase, not active_milestone/active_phase. A normal template checkpoint can therefore be fresh and present yet fail to become resolver priority 1.
4. **OBSERVED:** Warp MCP recovery independently extracts next_unit, so it may show a useful recovery instruction even while effective state comes from another source. This creates a mixed packet rather than one checkpoint transaction.
5. **DOCUMENTED:** /sgsd-resume reads next_unit, deletes the checkpoint, commits the deletion, and only then enters the loop at the next action.
6. **INFERRED:** a kill after the consume commit but before the next dispatch emits durable evidence loses the exact next action. Recovery falls to phase folders, pulse/activity if present, or stale STATE.
7. **OBSERVED:** no claimed_by, claim_ts, dispatch_id, acknowledged_at, or closed_at state exists in the checkpoint template; deletion is treated as closure.
8. **OBSERVED:** chaos-restart validates a different manifest requiring next_unit, controlling_principle, mode, emergency_halt, session, and created. Its tests therefore do not certify the production pause template.

### Weakness, repair, and proof

**RECOMMENDED — Replace delete-on-read with a two-phase handoff record.** Define one versioned checkpoint schema consumed by pause, resolver, MCP, resume, watchdog, headless mode, and chaos tests. Required lifecycle states should be open → claimed → acknowledged/closed. Resume atomically records claim session/dispatch, starts the bounded unit, then closes only after a new state transition or execution receipt is durable. Retain tombstone/closure evidence instead of relying on absence alone.

**Proof test:** create a checkpoint with the production writer, then inject process termination at five boundaries: before commit, after checkpoint commit, after claim commit, after child dispatch start, and after execution receipt/state update. Restart through the actual resume entry each time. Assert exactly one bounded dispatch, no lost next_unit, no duplicate execution, resolver source=checkpoint while open/claimed, and closed checkpoint linked to the successor state/receipt. Run the same fixture through chaos-restart’s validator and Warp MCP recovery.

## Flow trace 2 — stale or contradictory STATE/roadmap/artifact → detection → recovery

### Current path

1. **OBSERVED:** AGENTS.md names STATE.md frontmatter canonical and the milestone ROADMAP authoritative.
2. **OBSERVED:** current STATE top-level says v3.4/P999; nested roadmap_run says v2.2/complete; milestone_status narrates P142/P143; last_activity describes v3.0; v3.4 ROADMAP.md is absent; P999 lacks CONTEXT/VERIFICATION.
3. **OBSERVED:** state-resolver chooses v3.4/P999 from the highest phase folder, confidence 0.7, marks STATE stale, and recommends re-sync.
4. **OBSERVED:** sgsd_current_state correctly exposes canonical/effective and legacy values plus a conflict.
5. **OBSERVED:** sgsd_recovery_packet returns resolver_repair as next unlock but still returns resume_command=/sgsd-orchestrate go and _state_staleness.stale=false because its mtime/pulse probe is a separate definition.
6. **OBSERVED:** sgsd_cockpit_snapshot uses effective v3.4/P999 in objective, stale top-level prose for now, and nested v2.2 for artifacts. It is internally contradictory while ok=true.
7. **OBSERVED:** the browser sidecar bypasses the resolver, extracts P999 from status prose, and scans the phase folder; it reaches the same number for different reasons and cannot surface resolver conflicts.
8. **INFERRED:** agreement on P999 is accidental convergence, not one authority. A different contradictory status string or synthetic high-number folder could split the surfaces.

### Weakness, repair, and proof

**RECOMMENDED — Establish a single transition authority and make projections mechanically consistent.** The least disruptive migration is: (a) version a small state-transition envelope with milestone, phase, plan, state, source event, predecessor hash, and timestamp; (b) make the control plane the only writer; (c) derive STATE frontmatter and cockpit/MCP views from the same resolver library; (d) make a pre-dispatch consistency gate fail closed when canonical and required roadmap/artifacts conflict; and (e) explicitly decide whether STATE is authoritative or a projection, updating AGENTS.md and resolver comments together.

**Proof test:** fixture matrix covering stale top-level STATE, stale nested roadmap_run, missing active ROADMAP, plan-only phase, closed highest folder, synthetic P999, old checkpoint, fresh checkpoint, conflicting pulse, and malformed artifact. Assert every consumer—CLI resolver, current_state, recovery_packet, MCP cockpit snapshot, browser /snapshot, watchdog, and startup greeting—returns byte-equal milestone/phase/plan plus the same freshness verdict. Assert autonomous dispatch is refused on unresolved same-tier contradiction and resumes after an authorized atomic repair.

## Flow trace 3 — local Warp → Claude greet/auto → cockpit

### Current path

1. **OBSERVED:** sg and sgsd are installed PowerShell functions in this environment.
2. **OBSERVED:** sg calls sgsd first unless -NoCockpit, then keeps the current process in the same terminal and invokes Claude with either the greeting or “go”.
3. **CONFIGURED:** SGSD: Start invokes sg -ProjectDir; SGSD: Auto Mode invokes sg -Go -ProjectDir.
4. **OBSERVED:** this preserves the required topology: cockpit dashboards/processes are opened separately while Claude remains in the Warp tab where sg was typed.
5. **OBSERVED:** missing Claude is reported after cockpit startup; sg does not hide Claude inside a nested launcher.
6. **OBSERVED:** the greeting tells Claude to read STATE.md frontmatter directly. In the current contradictory state, that instruction can repeat stale narrative or nested state instead of the effective resolver result.
7. **INFERRED — uncertainty:** this audit did not execute sg because doing so would open processes/windows and enter Claude. Installed command definitions and workflow source were inspected instead.

### Weakness, repair, and proof

**RECOMMENDED — Keep the topology and strengthen the greeting/health contract.** Have sg obtain one bounded current_state/recovery summary before Claude starts and inject the effective milestone/phase, projection-stale flag, cockpit health URL, and any repair-required state. Claude should verify the same envelope, not re-parse STATE independently.

**Proof test:** Pester or process-mocked integration on greet, go, missing Claude, failed cockpit, occupied port, explicit ProjectDir, and dirty worktree. Assert sgsd is invoked before Claude, Claude remains in the caller process, exactly one cockpit is started, the greeting uses effective state, and -Go is suppressed when state consistency is repair-required.

## Flow trace 4 — SSH/tmux → persistence → reconnect → degraded cockpit

### Current path

1. **OBSERVED:** remote-launch.ps1 -DryRun emitted a concrete ssh -t command invoking the remote helper with project, session, and greet mode.
2. **CONFIGURED:** remote-tmux.sh resolves project/scripts, checks tmux/Claude/Codex, starts the localhost sidecar, creates a named detached session, and builds four panes.
3. **CONFIGURED:** mission, Codex, and narrative panes use PowerShell implementations when pwsh exists and text loops/tails otherwise.
4. **CONFIGURED:** reconnect is tmux attach -t SESSION; an existing session is reused unless reset.
5. **OBSERVED:** the committed remote-tmux.sh, sgsd-boot.sh, and start-cockpit-server.sh blobs contain CRLF. bash failed on carriage returns before usage/doctor could execute. No .gitattributes eol rule applies.
6. **OBSERVED:** remote-tmux does not invoke sg. sg is a PowerShell profile function tied to the local Windows launcher; the SSH path is a separate topology.
7. **OBSERVED:** the remote browser sidecar binds 127.0.0.1. remote-launch.ps1 uses ssh -t but no -L forwarding. Its reported localhost URL is remote-local, not automatically reachable in the operator’s local browser.
8. **INFERRED:** if a global remote install happens to contain LF-normalized scripts, it may work; that was not observed and cannot validate the vendored worktree path promised by the script.

### Weakness, repair, and proof

**RECOMMENDED — Replace the aspirational remote path with a tested remote contract.** Normalize all .sh blobs to LF and enforce eol in repository attributes/CI. Keep remote-tmux as the supported entry rather than pretending sg is portable. Add explicit --forward-cockpit behavior to the local launcher (or clearly declare tmux-text-only mode), a machine-readable doctor envelope, and reconnect health showing session, operator process, sidecar remote URL, forwarded local URL if any, checkpoint/effective state, and degraded pane reasons.

**Proof test:** Linux CI/container runs bash -n and shellcheck on every shipped .sh, then starts a real tmux session with fake Claude/Codex executables, disconnects, reconnects, and asserts pane survival. A loopback SSH fixture verifies command quoting and optional -L forwarding; curl from the local side must reach /snapshot only when forwarding is requested. Kill the sidecar and pwsh to prove tmux text fallbacks remain usable. No test may rely only on source grep.

## Flow trace 5 — VTP absent/error → fallback

### Current path

1. **OBSERVED:** .planning/config.json enables vtp_enrichment and triage_vtp_enrichment.
2. **DOCUMENTED:** orchestration probes VTP once, caches availability, logs degraded status, and continues without the artifact if unavailable.
3. **OBSERVED:** bridge whitelist prevents unrelated uncertainty types from calling VTP.
4. **OBSERVED:** forced-unhealthy and forced-timeout tests return ok=false, results=[], closed reason codes, and a failure-log pointer; error text is not treated as research evidence.
5. **OBSERVED:** the bridge’s production call function throws “shim not wired” unless _force_vtp_tool_response is supplied. The orchestration example calls selectiveVTPCall without that transport.
6. **OBSERVED:** even a successful caller packet cannot enter context-packet/build.cjs today because vtpPackets is assigned [] unconditionally and returned as _vtp_packets.
7. **INFERRED:** the observed system is safe under VTP absence because it becomes local-only, but successful private-KB enrichment through this bridge/context-packet seam is unreachable as written.

### Weakness, repair, and proof

**RECOMMENDED — Preserve the safe degraded contract while completing one production transport/admission seam.** Make the bridge accept an explicit production MCP adapter supplied by the orchestrator, with timeout ownership and a non-test name. Validate the resulting evidence packet once. Have context-packet admit only validated packets when route_hint.use_vtp is true, carry provenance hashes and elision metadata, and otherwise emit an explicit unavailable_or_bypassed status—not fabricated evidence.

**Proof test:** one end-to-end contract suite with (a) VTP absent, (b) timeout/error, (c) healthy empty results, (d) healthy valid results, and (e) invalid provenance/oversize results. Assert a–c continue locally with no VTP research content; d appears by reference in the exact future dispatch packet; e is rejected/elided. Run with the actual MCP adapter boundary mocked at transport level, not _force_vtp_tool_response inside the bridge.

## Flow trace 6 — memory observation → CMB/decision/distill → future dispatch

### Current path

1. **OBSERVED:** project-local .planning/memory/MEMORY.md exists. sgsd-curate writes typed markdown entries and sgsd-recall searches that index. The orchestration skill configures recall before non-trivial work and curate after new patterns/scripts/errors.
2. **OBSERVED:** cmb.schema.json defines seven CMB types and binds their creator roles and authority: execution receipt observation, reviewer claim, evidence-validator claim with authority, pseudo-operator decision, operator precedent highest, context-authority projection, and SGSD promotion decision.
3. **OBSERVED:** specialized tools can construct/validate/append execution_receipt, review_finding, evidence_verdict, decision_recommendation, and context_anchor records.
4. **OBSERVED:** context-packet can query memory-governance index snippets and complaint repair scheduling.
5. **OBSERVED:** .planning/mesh/memory/cmbs.jsonl is absent. No normal orchestration call sequence was found that takes every execution through the five-step CMB lineage and then admits the resulting decision to a future dispatch.
6. **OBSERVED:** cockpit memory reads a literal machine/project-specific Claude memory location, while its lineage array is static labels. It does not prove any CMB exists or was consumed.
7. **OBSERVED:** harness evidence can classify state drift and other root causes, but harness-evolution/run.cjs never invokes its declared loadDistill function; apply-candidate is route-only and there is no production runner caller.
8. **INFERRED:** project memory can influence a future prompt through recall, but the stronger claim “observed execution evidence becomes governed CMB decisions, is distilled, and changes future dispatch” is not proven.

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
| v3.4 INTENT source | why: >- plus indented text; outcome_delivered: >- plus indented text | Valid YAML folded scalars | **OBSERVED:** semantic rationale exists. |
| rationale.cjs split/parseFrontmatter | Complete frontmatter text | why=">-", outcome_delivered=">-" | **PRIMARY CAUSE:** the hand parser reads only key lines and ignores block-scalar continuation. This is the earliest semantic loss. |
| sidecar phase selection | STATE status includes P999; folder exists | milestone v3.4, phase 999, phase_dir found | **CONTRIBUTING:** selected phase is a synthetic plan-only folder amid stale state, but selection does not itself corrupt INTENT. |
| rationale input resolution | project + intent readable; last_summary=null; P999 CONTEXT path missing | summary/context placeholders | **CONTRIBUTING:** removes alternate context cards. It is insufficient to cause failure if INTENT is parsed correctly. |
| rationale legacy DTO | eli5/what_is/what_could_be plus evidence_trail | Marker-bearing strings and one real trail | **CONTRIBUTING:** producer still emits legacy fields; client has compatibility fallbacks, so field naming is not the earliest loss. |
| client clean/filter | markers and “no X” placeholders | all semantic cards filtered; evidence retained | **NON-CAUSE:** filtering behaves as designed and prevents “>-” from being shown to the operator. |
| empty-state branch | evidence_trail always returns either paths or a verbose missing-evidence string | at least one card survives | **CONTRIBUTING TEST/DTO DEFECT:** the explicit empty state is practically unreachable because evidence_trail is always non-empty and its long placeholder is not filtered. |
| JSDOM/rendered test | one retained evidence card | cards=1 | **NON-CAUSE:** rendered DOM faithfully exposes the upstream loss. |

### Primary, contributing, and non-causes

- **PRIMARY — OBSERVED:** rationale.cjs hand-rolled YAML parser does not implement folded/literal block scalars and preserves only the marker.
- **CONTRIBUTING — OBSERVED:** live P999 is PLAN-only, has no CONTEXT, and attachRationale is given last_summary_md=null.
- **CONTRIBUTING — OBSERVED:** state ambiguity selects a synthetic high-number phase without a roadmap/context completeness gate.
- **CONTRIBUTING — OBSERVED:** buildEvidenceTrail always emits display text, making “zero cards or explicit empty” an ineffective alternative.
- **NON-CAUSE — OBSERVED:** js-yaml; it recovers both semantic strings.
- **NON-CAUSE — OBSERVED:** client marker/placeholder filtering; it correctly refuses degenerate values.
- **NON-CAUSE — INFERRED:** missing last_summary alone; valid INTENT would still yield multiple cards.
- **NON-CAUSE — INFERRED:** legacy-versus-semantic field names alone; client explicitly maps both shapes.

### Smallest repair and regression proof

**RECOMMENDED — Smallest causal repair:** replace rationale.cjs’s frontmatter parser with the repository’s shared YAML parser/dependency resolver, or add standards-correct folded/literal scalar support in a single shared frontmatter utility. Do not teach the client to display “>-”; that would hide the loss.

**RECOMMENDED — Smallest contract strengthening:** make evidence status metadata separate from card content. evidence_trail should be empty/null when no cited source exists; degraded reasons belong in a typed source-health field. Then the explicit rationale-empty branch becomes reachable and meaningful.

**Proof tests:**

1. Focused parser fixture with >-, >, |-, and quoted/plain scalar variants; assert normalized semantic strings and no raw markers.
2. Live-shaped P999 fixture with valid INTENT, null summary, and missing CONTEXT; assert at least four useful cards and cited evidence.
3. Truly empty input fixture; assert zero cards and one rationale-empty element.
4. Partial input fixture; assert one useful semantic card is permitted or the product rule explicitly requires two—do not conflate “one valid card” with “empty”.
5. State completeness fixture; a PLAN-only synthetic phase must be labelled incomplete/degraded and cannot silently masquerade as a normal active phase.
6. Maintain a real focused command at a stable path, or publish SAC-P142-03 as the canonical command. The documented command and executable test must agree.

## Decision and repair register

Every matrix verdict is expanded here with rationale, repair where required, owner boundary, migration risk, and proof.

| ID | Verdict and rationale | Concrete repair | Owner boundary | Migration risk | Required proof |
|---|---|---|---|---|---|
| D01 | **REPLACE:** two incompatible definitions of state authority make every read path conditional. | Version one transition authority; explicitly designate STATE as authority or projection; update all contracts together. | Control plane owns transitions; execution fabric supplies evidence only. | High: affects startup, recovery, gates, and docs. | Cross-consumer byte-equality fixture and unauthorized-writer rejection. |
| D02 | **STRENGTHEN:** STATE remains useful human history but is internally contradictory. | Generate compact canonical frontmatter atomically; move narrative/history to derived append-only artifacts; validate nested/top-level agreement. | Orchestrator single writer. | Medium: parsers may depend on legacy fields. | Pre/post migration fixture, atomic interruption test, all legacy consumers inventoried. |
| D03 | **STRENGTHEN:** folder inference recovers position but synthetic/incomplete phases can dominate. | Require active ROADMAP membership and minimum artifact state before a phase can outrank canonical state; label synthetic phases explicitly. | Planner/orchestrator writes artifacts; resolver validates read-only. | Medium. | Missing-roadmap, plan-only, closed-phase, and synthetic-number fixtures. |
| D04 | **STRENGTHEN:** resolver is valuable but not universal and checkpoint schema is wrong. | Adopt shared resolver in sidecar/startup/watchdog; parse the canonical checkpoint schema; return plan and artifact-completeness. | Shared read library, no writes. | Medium. | Existing 14 assertions plus production checkpoint and all-consumer contract suite. |
| D05 | **MERGE:** four checkpoint vocabularies defeat priority and chaos proof. | One JSON Schema/YAML schema and one parser/writer library; delete duplicate field vocabularies after migration. | Recovery subsystem owner. | High for open checkpoints. | Backward migration fixtures and production-writer → resolver → chaos validator round trip. |
| D06 | **REPLACE:** delete-before-dispatch creates an acknowledgement gap. | Two-phase open/claimed/closed lifecycle with dispatch/receipt linkage and idempotency key. | Orchestrator controls lifecycle; executor cannot close itself. | High but bounded to recovery. | Five kill-point chaos matrix with exactly-once bounded dispatch. |
| D07 | **REMOVE:** JSON checkpoint hook writes a similarly named file no recovery consumer reads. | Either migrate its commit history into the canonical checkpoint event ledger or remove the hook/file. | Hook/installer owner. | Low if no hidden consumer; verify first. | Repository + installed-hook consumer census; uninstall/restart smoke. |
| D08 | **KEEP:** MCP envelopes, redaction, bounded recovery, and focused tests are strong. | No replacement. Continue schema-versioned additive changes only. | MCP read-only boundary. | Low. | Keep 47/47 plus degraded-source and redaction tests mandatory. |
| D09 | **STRENGTHEN:** adapter keeps shape under failure but combines effective and legacy sections incoherently. | Resolve scope once, pass it to every section builder, and expose one freshness object. | Cockpit adapter owner. | Medium. | Current contradictory fixture must produce one scope or fail degraded, never v3.4 objective plus v2.2 artifacts. |
| D10 | **MERGE:** browser sidecar duplicates state/phase and source-health semantics. | Reuse effective-state and shared snapshot DTO; keep browser-specific view models downstream. | Sidecar read/render boundary. | Medium-high due SPA fields. | Golden schema adapters, SSE refresh, and degraded-section browser tests. |
| D11 | **KEEP:** local sg preserves required Warp/Claude topology and is installed. | No topology change; improvement belongs to greeting contract under D04/D09. | Local launcher/profile owner. | Low. | Mocked greet/go/process-placement integration. |
| D12 | **REPLACE:** remote helper cannot execute from committed CRLF blobs and is not sg-equivalent. | LF policy, Linux CI, explicit remote contract, machine-readable doctor, reconnect test. | Remote operations owner; no direct SGSD state mutation. | Medium. | Real bash/tmux/SSH fixture, not source grep. |
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

## Metrics: decision inputs versus display-only projections

**OBSERVED — Decision/recovery inputs:**

- orchestrator-pulse.jsonl and activity-log.jsonl can outrank STATE in the effective resolver.
- context complaints, repair queue/cursor, governed index snippets, and validated-thought sources can affect context composition or future repair scheduling.
- gate/review/backlog ledgers are read by gate, release-readiness, or consistency tools when those tools are invoked.
- VTP health/failure and route decisions are designed to influence route/degraded behavior.
- the harness distiller can consume seven named streams when explicitly invoked.

**OBSERVED — Display/count projections:**

- cockpit adapter and Warp MCP summarize agents, Codex, gates, tokens, staleness, and harness counts.
- browser sidecar summarizes chronicle, validation, executor, token, memory, event, and health streams.
- harness_evolution in the cockpit is counts/latest verdict; it does not apply a policy.

**INFERRED — A file being both displayed and read does not establish a feedback loop.** The missing proof is a live run identity linking producer row → decision consumer → changed bounded action → outcome attribution. Current .planning/metrics absence means the audit can validate readers and fixture behavior, but not operational stream continuity.

**RECOMMENDED — Add a metrics manifest and run-closure receipt.** Each stream should declare schema version, authoritative producer, consumers, whether it is decision-bearing or display-only, freshness/retention, privacy class, and required stages. At checkpoint/phase close, emit a receipt listing required streams, last valid row/hash, and intentional absences. Cockpit must display that receipt rather than converting every missing stream to benign zero.

## MCP and cockpit degraded semantics

**OBSERVED — Warp MCP strengths:** 15 frozen tool names, schema-v1 envelope, closed error codes, _degraded flag, bounded recovery packet, redaction, read-only invariant, and fixture pairs. Current-state and recovery expose resolver metadata.

**OBSERVED — Adapter strengths:** fixed 12-section shape, per-section degraded sentinels, read-only behavior, and explicit staleness/harness sections.

**OBSERVED — Composition weakness:** browser sidecar’s DTO is separate and unversioned at the top level; _sources lists seven presentation sources while stream_health lists 18 attachers; warnings do not map to the MCP error vocabulary; and the sidecar can say “healthy enough to render” while MCP exposes a resolver conflict it never consumed.

**RECOMMENDED — One semantic snapshot, multiple views.** Define a versioned domain snapshot containing resolved scope, source observations, freshness/conflicts, evidence links, and degraded reasons. MCP returns it in its envelope; browser maps it into mission/telemetry/etc.; terminal renderers map it to their compact sections. View-specific fields may remain additive, but scope and source health must be shared.

## Candidate milestone work packets

These are draft candidates only. They do not activate a milestone or mutate roadmap/state.

### Rank 1 — Transactional state and checkpoint authority

- **Verdict:** REPLACE/MERGE D01–D07.
- **Outcome:** one state-transition and checkpoint schema, exactly-once resume, canonical/projection language resolved.
- **Owner boundary:** control plane is sole transition writer; resolver/MCP/cockpit are read-only; executor contributes evidence only.
- **Migration risk:** high; preserve old open checkpoints through an explicit reader/migrator.
- **Exit proof:** production pause/resume plus five kill-point chaos suite; every state consumer byte-agrees; no duplicate/lost dispatch.

### Rank 2 — Repair rationale semantics and active-phase completeness

- **Verdict:** STRENGTHEN D03 plus causal rationale fix.
- **Outcome:** standards-correct YAML semantics, useful rationale or honest empty state, synthetic/plan-only phase clearly degraded.
- **Owner boundary:** shared parser and sidecar DTO; no state mutation by renderer.
- **Migration risk:** medium due changed rendered text/goldens.
- **Exit proof:** focused scalar matrix, live-shaped P999 test, explicit empty-state test, browser acceptance, stable documented command.

### Rank 3 — Make SSH/tmux a real supported path

- **Verdict:** REPLACE D12; STRENGTHEN D13.
- **Outcome:** LF-safe scripts, real tmux persistence/reconnect, explicit browser tunnel or text-only mode.
- **Owner boundary:** launch/runtime only; no remote helper writes canonical state.
- **Migration risk:** medium across Windows/Linux quoting and installed global scripts.
- **Exit proof:** Linux bash/tmux integration plus loopback SSH tunnel fixture and degraded-pane test.

### Rank 4 — Unify state projection across MCP and browser cockpit

- **Verdict:** STRENGTHEN/MERGE D04, D09, D10.
- **Outcome:** one semantic snapshot and freshness verdict; browser/MCP/terminal views cannot disagree on scope/artifacts.
- **Owner boundary:** shared read library owns resolution; views own presentation only.
- **Migration risk:** medium-high for the SPA contract.
- **Exit proof:** contradictory-state fixture through every surface and schema adapter goldens.

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
| node super-gsd/tools/state-resolver/resolve.cjs --json | PASS, v3.4/P999 from phase_folders, projection_stale=true | Live resolver detects current conflict | Does not repair or block dispatch |
| node super-gsd/tools/state-resolver/resolve.cjs --self-test | PASS 14/14 | Priority, degraded, staleness, read-only component behavior | Production checkpoint schema compatibility |
| node super-gsd/tools/cockpit-state/run-self-test.cjs | PASS 19/19 | Stable 12-section shape and degraded sections | Cross-surface semantic consistency |
| node super-gsd/tools/warp-mcp/run-self-test.cjs | PASS 47/47 | MCP envelopes, fixtures, recovery size, redaction, live calls | Remote MCP availability or state convergence |
| node super-gsd/tools/vtp-bridge/classify.cjs --self-test | PASS 11/11 | Whitelist, failure isolation, caps, provenance fixtures | Real MCP success transport/admission |
| node super-gsd/tools/harness-evolution/run-self-test.cjs | PASS 17/17 | Runner safety/refusal/manifest/route-stub behavior | Closed-loop evolution |
| node super-gsd/tools/harness-evidence/run-self-test.cjs | PASS 18/18 | Deterministic distillation and malformed-row isolation | Automatic invocation or future policy effect |
| node super-gsd/tools/cockpit/rationale-card.test.cjs | FAIL, MODULE_NOT_FOUND | Requested command drift is real | Rationale behavior |
| node super-gsd/tools/cockpit-sidecar/run-self-test.cjs --sac SAC-P142-03 | FAIL, one card | Live rendered rationale defect | Other SACs |
| cockpit-sidecar.cjs --json plus direct rationale call | PASS as diagnostic; marker-only DTO reproduced | Earliest loss exists before client rendering | Browser layout quality |
| js-yaml parse of v3.4 INTENT | PASS; 807/883-character values | Source YAML is semantically valid | Shared parser migration safety |
| Get-Command sg,sgsd | PASS; installed functions found | Local functions are installed and topology source matches | Full launch, because it was intentionally not executed |
| remote-launch.ps1 -DryRun | PASS; real ssh -t command emitted | Windows-side command assembly | Remote host execution |
| bash remote-tmux.sh --doctor under WSL | FAIL before parsing due CRLF | Vendored shell path is not Linux-executable as committed | State of a separate global remote install |
| git blob/working-tree CR/LF count and git check-attr | CRLF in committed shell blobs; no eol rule | Failure is repository content/policy, not only local checkout conversion | Behavior after a future normalization |

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

**OBSERVED:** SGSD is rich in typed components and graceful sentinels, but state/recovery truth is split and several “learning” paths stop at representation. The immediate architectural priority is not another dashboard surface. It is one transactional state/checkpoint authority exercised by every consumer and crash-tested at handoff boundaries. The immediate concrete bug is the rationale parser’s loss of folded YAML semantics. The immediate operational blocker is that the committed remote shell path is CRLF and cannot run under Linux.

**RECOMMENDED:** execute candidate packets 1–3 before expanding autonomy, then unify cockpit projection, complete optional VTP success admission, operationalize governed CMB lineage, and only then allow harness evidence to change future dispatch behavior. Preserve the existing gates and authority carve-outs throughout; none of these repairs requires bypassing ATC, verifier, MUDA, release-readiness, or edge-guard.

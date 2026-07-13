# SGSD Skills, Intent Routing, and Control-Plane Boundary Audit

**Audit date:** 2026-07-13

**Lane:** Skills and routing

**Status:** Read-only audit; preliminary verdicts for later synthesis
**Evidence base:** `.planning/analyses/2026-07-13-sgsd-frontier-architecture-evidence-index.md`, especially SRC-013 through SRC-040

## Findings headline

**INFERRED:** SGSD has a strong autonomous delivery engine, but it does not yet have one authoritative mode-and-intent controller. The autonomous path is mechanically rich; the user's common Interactive operator-led path is a Claude greeting plus prose contracts. Triage, board deliberation, plan authoring, plan-level concurrency, and several Warp helper skills expose overlapping or disconnected policies. The highest-leverage skills-routing amendment is therefore a typed, deterministic control-plane router that names every operating mode, applies one precedence table, emits a continuation envelope, and makes the next skill consume that envelope. This is a lane conclusion, not the final cross-lane verdict.

The strongest evidence for that conclusion is:

- **OBSERVED:** `super-gsd/scripts/Install-SgsdShortcut.ps1` launches default `sg` with a greeting that says not to enter auto mode, but it does not set a named interactive-mode state or call an interactive orchestration command.
- **CONFIGURED:** `CLAUDE.md` names planning-intent triggers and auto commands in prose, while its “first match wins” rule applies only after the autonomous loop has already been entered.
- **CONFIGURED:** `super-gsd/skills/sgsd-triage/SKILL.md` explicitly stops at an operator confirmation instead of mechanically invoking the selected continuation.
- **CONFIGURED:** that same triage skill invokes `superpowers:writing-plans` even though `super-gsd/skills/sgsd-write-plan/SKILL.md` declares itself the canonical replacement for SGSD plan authoring. Both skills still write/read `.planning/phases/`, while `AGENTS.md` names the current truth under `.planning/milestones/{milestone}/phases/`.
- **OBSERVED:** `super-gsd/scripts/lib/board-registry.cjs` resolves the active Architect + Contrarian + CEO roster, while `super-gsd/agents/sgsd-ceo.md` still says to source the roster from `.planning/config.json`. The two sources name different boards.
- **CONFIGURED without an executable consumer found:** `.planning/config.json` enables plan-level parallelization up to three agents and skipped checkpoints; `super-gsd/skills/sgsd-orchestrate/SKILL.md` hard-locks all Codex writer waves to serial execution.
- **OBSERVED:** `super-gsd/registry/decisions.yaml` has an empty `decision_steps` array, despite documenting itself as the expects/emits registry for orchestrator transitions.
- **OBSERVED absence:** `.planning/metrics/` does not exist in this clean worktree, so none of the 28 installed skills has defensible recent-use proof here.

## Evidence and claim boundary

Claims use the audit-wide vocabulary:

- **OBSERVED** — executable source, a passing current self-test, current planning truth, or an explicit absence.
- **CONFIGURED** — an active skill, contract, registry, or project setting wires the behavior, but this census cannot prove a runtime invocation.
- **DOCUMENTED** — prose describes behavior without a matching active consumer found.
- **INFERRED** — a conclusion drawn from multiple cited sources.
- **RECOMMENDED** — a proposed repair, never current behavior.

The audit ran the implementation plan's two `rg` searches. The first composite inventory command returned no rows because two requested roots — `super-gsd/source/super-gsd/skills/` and `.claude/` — are absent in this worktree; enumerating each existing root independently produced 21 files matching the `super-gsd/skills/*/SKILL.md` glob and seven matching the `.agents/skills/*/SKILL.md` glob. The glob strings are inventory patterns, not literal cited files. This report treats:

1. `super-gsd/skills/` as the 21 active-distribution SGSD skills.
2. `.agents/skills/` as seven Warp-facing, read-only composition/diagnostic skills.
3. `super-gsd/source/super-gsd/skills/` as an explicitly absent source-copy root, not another inventory.
4. `.claude/` as an explicitly absent project-local installation root, not evidence that the globally installed commands are missing.
5. `.planning/metrics/` as explicitly absent recent-use evidence, not proof that a configured skill never ran elsewhere or historically.

Historical files under `.planning/decisions/`, prior milestone phase directories, and `.planning/memory/` can prove that similar workflows produced artifacts in the past. They do not prove recent invocation of the current skill version and are not scored as recent use.

### Executable boundary checks

Fresh read-only checks were run against the current worktree:

| Check | Current result | What it establishes |
| --- | --- | --- |
| `node super-gsd/scripts/lib/board-registry.test.cjs` | 2 pass, 0 fail | **OBSERVED:** disabled members are filtered and the production registry resolves Architect + Contrarian + CEO. |
| `node super-gsd/tools/intent-map/build.cjs --self-test` | 10 pass, 0 fail | **OBSERVED:** the closed-vocabulary intent compiler works in isolation. |
| `node super-gsd/tools/dispatch-router/route.cjs --self-test` | 15 pass, 0 fail | **OBSERVED:** the structural dispatch router and safe fallback behavior work in isolation. |
| `node super-gsd/tools/context-packet/build.cjs --self-test` | 15 pass, 0 fail | **OBSERVED:** role packet construction works in isolation. The test's tracked verification-file touch was restored before this report was written. |

These checks prove component behavior, not that the components were recently exercised by an operator session.

## Installed capability inventory

### Scoring key

The `Score` cell is an ordered vector `U/T/B/M/E/C/R/F = total/32`:

1. `U` outcome utility
2. `T` trigger quality
3. `B` boundary clarity
4. `M` mechanical consumption
5. `E` evidence strength
6. `C` cost proportionality
7. `R` failure recovery
8. `F` frontier leverage

Each dimension is scored 0–4 independently; incompatible concepts are not averaged. `NRU` means “no recent use provable because `.planning/metrics/` is **ABSENT**.” A verdict is preliminary and uses only `KEEP`, `STRENGTHEN`, `MERGE`, `REPLACE`, `AUTOMATE`, or `REMOVE`.

| Capability | Skill/path | Natural-language trigger | Explicit command | Preconditions | Output | Mechanical consumer | Evidence of recent use | Overlap | Score | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Warp daily operation | `.agents/skills/sgsd-warp-operator/SKILL.md` | **DOCUMENTED:** start, auto, recover, monitor, or ask what SGSD is doing | Skill invocation; composes `sg`, `sg -Go`, Warp workflows, and MCP reads | Warp/SGSD commands or MCP available; project state present | Read-only operating action or status | **CONFIGURED:** existing workflows/MCP; result ultimately returns to operator | NRU — `.planning/metrics/` **ABSENT** | Superset of status brief, cockpit review, release/gate/token diagnostics | `3/3/3/2/2/3/3/2 = 21` | **KEEP** — safe composition boundary is explicit in the cited skill |
| Token-spend diagnosis | `.agents/skills/sgsd-token-triage/SKILL.md` | **DOCUMENTED:** “where are tokens going?” or spend anomaly | Skill invocation using `sgsd_token_spend` | MCP token ledger available | Anomaly summary and compression advice | **DOCUMENTED:** operator only; no typed repair dispatch | NRU — `.planning/metrics/` **ABSENT** | Duplicates analysis in `super-gsd/skills/sgsd-token-audit/SKILL.md` | `3/2/3/1/2/3/2/2 = 18` | **MERGE** — retain Warp presentation over the canonical token-audit engine |
| Five-line status | `.agents/skills/sgsd-status-brief/SKILL.md` | **DOCUMENTED:** status, milestone, phase, blockers, resume | Skill invocation using four MCP reads | MCP available or degraded responses | Five-line read-only brief | **DOCUMENTED:** operator/prompt memory only | NRU — `.planning/metrics/` **ABSENT** | Warp operator and cockpit review both answer status | `3/3/3/1/2/3/3/2 = 20` | **MERGE** — one operator-status composition should expose brief and expanded views |
| Draft roadmap planning | `.agents/skills/sgsd-roadmap-planner/SKILL.md` | **DOCUMENTED:** convert a high-level goal into candidate phases | Skill invocation | Current state and roadmap readable; operator has not approved activation | Draft under `.planning/analyses/` | **DOCUMENTED:** operator must manually approve and copy into active roadmap | NRU — `.planning/metrics/` **ABSENT** | Triage planning, SGSD write-plan, and milestone scoping | `3/2/3/1/2/3/3/3 = 20` | **STRENGTHEN** — add a typed activation proposal without weakening operator approval |
| Release pre-flight | `.agents/skills/sgsd-release-check/SKILL.md` | **DOCUMENTED:** “is the milestone ready to release?” | Skill invocation plus release-readiness scorer | Active milestone, gate data, and readiness inputs | Score, blockers, and recommendation | **DOCUMENTED:** operator only; explicitly must not close milestone | NRU — `.planning/metrics/` **ABSENT** | Read-only front end to `super-gsd/skills/sgsd-complete-milestone/SKILL.md` | `3/2/3/1/3/3/3/2 = 20` | **KEEP** — separation between dry run and mutating close is safety-positive |
| Gate-failure explanation | `.agents/skills/sgsd-gate-triage/SKILL.md` | **DOCUMENTED:** a gate warns or fails | Skill invocation using `sgsd_gate_status` | Failing gate and evidence path exist | Explanation plus suggested repair class | **DOCUMENTED:** operator chooses/re-enters repair path | NRU — `.planning/metrics/` **ABSENT** | `sgsd-audit` remediation and orchestrator repair loop | `3/3/3/1/2/3/3/2 = 20` | **AUTOMATE** — emit a bounded repair envelope for the existing orchestrator, never a bypass |
| Cockpit completeness review | `.agents/skills/sgsd-cockpit-review/SKILL.md` | **DOCUMENTED:** “is the cockpit telling me everything?” | Skill invocation using `sgsd_cockpit_snapshot` | Cockpit/MCP adapter available | Ten-section health report | **DOCUMENTED:** operator only | NRU — `.planning/metrics/` **ABSENT** | Status brief, Warp operator, and cockpit self-tests | `3/2/3/1/2/3/3/2 = 19` | **MERGE** — make this the expanded status view behind one operator surface |
| Autonomous control plane | `super-gsd/skills/sgsd-orchestrate/SKILL.md` | **CONFIGURED:** go, auto, continue, next, status, stop/pause | `/sgsd-orchestrate auto`; `go`, `next`, `status`, `stop` aliases by contract | Planning state; readiness/degraded path; Claude control plane; Codex delivery route | Phase artifacts, commits, ledgers, state transitions, checkpoint or terminal result | **CONFIGURED + executable consumers:** next state-machine step, context packet, router, gates, cockpit, milestone close | NRU — `.planning/metrics/` **ABSENT** | Triage Path B; board recovery; prose `CLAUDE.md` loop duplicates much of skill | `4/4/2/4/3/2/4/4 = 27` | **STRENGTHEN** — preserve engine, externalize mode/intent policy and reconcile configuration drift |
| Planning-intent triage | `super-gsd/skills/sgsd-triage/SKILL.md` | **CONFIGURED:** “I'm thinking,” “How should we,” plan, design, evaluate, tradeoffs | `/sgsd-triage` or prose auto-invoke in `CLAUDE.md` | High-confidence planning intent; not direct execution, mid-build fix, fact, or trivial query | VTP framing plus brainstorm/plan; brief, phase seed, audit suggestion, decision note, or inline answer | **CONFIGURED:** no automatic next consumer; Step 4 asks operator and forbids auto-fire | NRU — `.planning/metrics/` **ABSENT** | Generic writing-plans versus SGSD write-plan; board and orchestrate routes | `3/3/1/1/2/1/2/2 = 15` | **REPLACE** — preserve classification goals behind a typed deterministic router |
| Strategic board deliberation | `super-gsd/skills/sgsd-deliberate/SKILL.md` | **CONFIGURED:** explicit deliberate or triage Path A for ≥3-phase, non-trivial decisions | `/sgsd-deliberate new` or `/sgsd-deliberate <brief-path>` | Brief fields; ≥3 phases; not <2h-and-revertible | Decision memo, debate logs, token row | **CONFIGURED:** operator/manual next action; orchestrator consumes it only in the special blocker-recovery path | NRU — historical `.planning/decisions/` is past-artifact evidence only | Skill directly dispatches roster while `sgsd-ceo` also claims board orchestration | `3/2/1/2/3/1/2/3 = 17` | **STRENGTHEN** — keep adversarial reasoning, make one roster/synthesizer path authoritative |
| Schema-native plan authoring | `super-gsd/skills/sgsd-write-plan/SKILL.md` | **CONFIGURED:** author an SGSD plan for a phase | `/sgsd-write-plan <phase-slug> <plan-NN> [goal]` | Schema and validator installed; phase context available | Validated v2 PLAN.md, currently targeted at legacy `.planning/phases/` | **OBSERVED/CONFIGURED:** `super-gsd/tools/plan-schema/validate.cjs` validates; orchestrator can consume v2 fields only after locating the plan | NRU — `.planning/metrics/` **ABSENT** | Triage invokes generic writing-plans; current truth uses per-milestone phase paths | `4/2/1/4/3/3/2/3 = 22` | **STRENGTHEN** — retain schema admission but use the current milestone phase resolver before triage adopts it |
| Milestone closure | `super-gsd/skills/sgsd-complete-milestone/SKILL.md` | **CONFIGURED:** active milestone has completed phases or explicit close request | `/sgsd-complete-milestone <version>`; auto-triggered by orchestrate | Close preconditions and gates; idempotency check | Audits, summary, archive/state bump, publication status | **CONFIGURED:** state, milestone history, cockpit, and next auto-loop unit | NRU — `.planning/metrics/` **ABSENT** | Release-check is its non-mutating preview | `4/2/3/4/3/2/3/3 = 24` | **KEEP** — valuable terminal transaction; keep dry-run front end separate |
| Pause/checkpoint | `super-gsd/skills/sgsd-pause/SKILL.md` | **CONFIGURED:** pause or stop | `/sgsd-pause`; orchestrate stop/pause | Active state/session work | Committed `.planning/ORCHESTRATOR-CHECKPOINT.md` and stopped loop | **CONFIGURED:** new-session and resume paths read checkpoint | NRU — checkpoint is currently absent, a valid idle state | Complementary inverse of resume | `3/3/3/3/3/3/3/2 = 23` | **KEEP** — explicit recovery artifact is proportionate |
| Checkpoint resume | `super-gsd/skills/sgsd-resume/SKILL.md` | **CONFIGURED:** resume, recover, checkpoint found | `/sgsd-resume`; `/sgsd-orchestrate go` after checkpoint | Checkpoint or state consistency | Restored context, resumed loop, or honest no-checkpoint report | **CONFIGURED:** orchestrator next unit | NRU — checkpoint is currently absent | Warp recovery packet and new-session auto-resume | `3/3/3/3/3/3/3/2 = 23` | **KEEP** — consolidate duplicate entry wording, not the recovery behavior |
| Evidence-gated phase audit | `super-gsd/skills/sgsd-audit/SKILL.md` | **CONFIGURED:** phase close, “did we build what the plan said?”, or remediation check | `/sgsd-audit [phase_number]` | Phase plan/artifacts; optional runtime probes | AUDIT.md, REMEDIATION.md, verdict/evidence artifacts | **CONFIGURED:** phase close and milestone closure inspect audit outcomes | NRU — historical AUDIT files are past-artifact evidence only | Gate-triage explanation and conformance scripts | `4/3/3/4/3/2/3/3 = 25` | **KEEP** — evidence-over-assertion boundary has a downstream closure decision |
| MUDA waste audit | `super-gsd/skills/sgsd-muda-audit/SKILL.md` | **CONFIGURED:** phase close above file/line threshold or retrospective waste query | `/sgsd-muda-audit [phase]` | `files_changed>=4` or `diff_lines>=100` unless operator invokes analysis | WASTE.md and curated anti-patterns | **CONFIGURED:** complete-milestone recurrence audit; pre-dispatch read path remains documented as deferred | NRU — `.planning/metrics/` **ABSENT** | Plan-final MUDA, token audit, generic audit | `3/2/2/3/3/2/2/3 = 20` | **STRENGTHEN** — close the learning-to-routing read path or retire redundant probes |
| Token audit | `super-gsd/skills/sgsd-token-audit/SKILL.md` | **CONFIGURED:** audit tokens, full/quick/context map, milestone-close spend check | `/sgsd-token-audit [--quick\|--full\|--context-map\|--milestone-close-check]` | Token ledgers; some modes tolerate empty history | Spend analysis, TOKEN-AUDIT/context map, kill-condition output | **CONFIGURED:** milestone close and operator decision | NRU — `.planning/metrics/` **ABSENT** | Warp token-triage presents a second analysis surface | `3/3/2/3/3/3/2/3 = 22` | **KEEP** — canonicalize engine here and merge the Warp presenter into it |
| Milestone readiness | `super-gsd/skills/sgsd-readiness/SKILL.md` | **CONFIGURED:** pre-flight, stale manifest, or auto-loop rule 0 | `/sgsd-readiness`; orchestrator auto-trigger | Active milestone; dependency probes | MILESTONE-READINESS.md with GO/BLOCKED/WILL-BLOCK/DEGRADED-PATH plus log | **CONFIGURED:** orchestrator rule 0/4.5 directly gates or degrades continuation | NRU — `.planning/metrics/` **ABSENT** | Release readiness is later lifecycle stage, not duplicate | `4/3/4/4/3/3/4/3 = 28` | **KEEP** — clearest skill-to-state-machine handoff in this lane |
| Planning signal map | `super-gsd/skills/sgsd-overwatcher/SKILL.md` | **CONFIGURED:** scan/start/status/open signal map; optional phase-close auto-scan | `/sgsd-overwatcher [scan\|start\|status\|open]` | Planning tree and launcher available | Interactive HTML collision/dead-end map | **DOCUMENTED:** operator dashboard; no continuation consumer found | NRU — `.planning/metrics/` **ABSENT** | Cockpit, system-map generator, and roadmap/collision audits | `2/2/2/1/2/2/2/2 = 15` | **MERGE** — expose its unique collision findings as a cockpit/roadmap section |
| Distribution update | `super-gsd/skills/sgsd-update/SKILL.md` | **CONFIGURED:** update/check/pull latest SGSD | `/sgsd-update`; underlying `super-gsd/scripts/sgsd-update.sh` or PowerShell mirror | Git/network for update; local source/global fallback | Updated source/install and optional version marker | **OBSERVED/CONFIGURED:** installer consumes updated distribution | NRU — `.planning/metrics/` **ABSENT** | Overlay refresh is a post-update subset | `3/2/3/3/2/3/3/2 = 21` | **KEEP** — absorb overlay synchronization into its verified post-install transaction |
| Standalone VTP advice | `super-gsd/skills/sgsd-vtp-advise/SKILL.md` | **CONFIGURED:** “should we evolve service X?” | `/sgsd-vtp-advise <service-name>` | Optional VTP composer/bridge; service name | Report under generated `.planning/advise/` (directory currently absent) | **DOCUMENTED:** operator only; no typed proposal or route consumer | NRU — `.planning/metrics/` **ABSENT** | Triage VTP enrichment, SEPL major-proposal advice, orchestrator VTP bridge | `2/2/2/1/2/1/3/2 = 15` | **MERGE** — one VTP evidence service should feed triage/SEPL typed inputs |
| Claude overlay refresh | `super-gsd/skills/sgsd-overlay-refresh/SKILL.md` | **CONFIGURED:** refresh/sync CLAUDE overlay after distribution change | `/sgsd-overlay-refresh`; dry-run/force scripts | Canonical overlay and target CLAUDE.md | Backed-up, marker-delimited CLAUDE.md update | **OBSERVED/CONFIGURED:** Claude loads the resulting control-plane contract | NRU — `.planning/metrics/` **ABSENT** | Distribution update already installs propagated resources | `3/2/2/4/3/3/3/2 = 22` | **AUTOMATE** — update/install should verify and refresh overlay atomically |
| Browser/UI verification | `super-gsd/skills/sgsd-browser/SKILL.md` | **CONFIGURED:** open, screenshot, verify, test form, debug, or visual diff | `/sgsd-browser [open\|screenshot\|verify\|test-form\|debug\|diff]` | Browser CLI/dev server; frontend scope for gate use | Snapshots, screenshots, console/a11y findings, debug evidence | **CONFIGURED:** orchestrator browser gate and verifier consume applicable evidence | NRU — `.planning/metrics/` **ABSENT** | Browser_verify config and phase-verifier | `3/3/3/3/3/2/3/3 = 23` | **KEEP** — retain as specialist executor behind one gate contract |
| GSD 2.0 transition | `super-gsd/skills/sgsd-transition/SKILL.md` | **CONFIGURED:** migrate an old Pi/GSD 2.0 project | `/sgsd-transition [path/to/.gsd/]` | Legacy source tree; one-time operation | Imported planning/memory plus TRANSITION-REPORT.md | **CONFIGURED:** resulting SGSD planning tree is consumed by runtime | NRU — `.planning/metrics/` **ABSENT** | Backfill and memory-migrate cover adjacent onboarding migrations | `2/2/2/3/2/2/3/2 = 18` | **REMOVE** — from the normal installed command surface after migration; preserve as an explicit legacy tool |
| Resource-grain proposals | `super-gsd/skills/sgsd-sepl/SKILL.md` | **CONFIGURED:** propose/list/apply/reject a small single-file improvement | `/sgsd-sepl` modes; `super-gsd/scripts/sgsd-sepl-propose.sh` and `super-gsd/scripts/sgsd-sepl-commit.sh` | Single-file/resource-grain scope; operator gate | Pending proposal, apply/reject result, SEPL log | **OBSERVED/CONFIGURED:** commit script consumes approved proposal; operator remains authority | NRU — `.planning/metrics/` **ABSENT** | Deliberation handles architecture-grain decisions | `3/2/3/3/3/2/3/3 = 22` | **KEEP** — explicit grain boundary and operator gate are useful; improve discoverability |
| Trajectory distillation | `super-gsd/skills/sgsd-distill/SKILL.md` | **CONFIGURED:** distill a closed milestone; prepare/ingest/rate | `/sgsd-distill` plus `super-gsd/scripts/sgsd-distill-milestone.sh` modes | Closed milestone, Codex extraction, operator novelty rating | Hypotheses/candidates, distillation request/output, novelty rows | **CONFIGURED:** SGSD recall can retrieve promoted memory; operator rating is mandatory | NRU — historical memory is past-artifact evidence only | MUDA curation, memory governance, ordinary sgsd-curate | `2/2/2/3/2/1/3/3 = 18` | **REPLACE** — use measured outcome/route evidence to select learning candidates before operator review |
| One-time memory migration | `super-gsd/skills/sgsd-memory-migrate/SKILL.md` | **CONFIGURED:** consolidate Claude/BRV memory into `.planning/memory/` | `/sgsd-memory-migrate`; PowerShell dry-run then apply | Legacy memory exists; Windows junction path; operator confirmation | Canonical memory taxonomy and junction | **CONFIGURED:** Claude auto-memory and `sgsd-recall` consume migrated files | NRU — current memory tree proves state, not current-skill invocation | Backfill and transition overlap onboarding | `3/2/3/3/2/2/3/2 = 20` | **REMOVE** — from routine discovery once migration preflight reports complete; retain script for legacy installs |
| Existing-project backfill | `super-gsd/skills/sgsd-backfill/SKILL.md` | **CONFIGURED:** add SGSD scaffold to an existing project | `/sgsd-backfill`; `bash super-gsd/install.sh --init-project` | Repository exists; safe local init | `.planning/`, config, memory, baseline ledgers | **OBSERVED/CONFIGURED:** all SGSD runtime consumers use the resulting scaffold | NRU — `.planning/metrics/` **ABSENT** | Transition and memory-migrate cover narrower legacy cases | `3/2/3/4/3/3/3/2 = 23` | **KEEP** — make it the single onboarding front door and delegate legacy migrations conditionally |

### Extreme-score rationale

Every score below 2 or above 3 is explained here; dimensions scored 2–3 need no exception rationale.

| Dimension/extreme | Capabilities | Evidence-based explanation |
| --- | --- | --- |
| `U=4` | orchestrate, write-plan, complete-milestone, audit, readiness | Each protects or drives a core transition: delivery loop, valid plan admission, terminal milestone transaction, evidence-backed phase closure, or unattended-run admission. See the five cited skill contracts above. |
| `T=4` | orchestrate | `CLAUDE.md` and the orchestrate skill both enumerate go/auto/continue/next/status/stop and give explicit execution exclusions. The weakness is cross-skill precedence, scored under boundary rather than this capability's own trigger. |
| `B=4` | readiness | Its manifest, statuses, freshness rule, and exact rule-0/4.5 consumers are unusually explicit in `super-gsd/skills/sgsd-readiness/SKILL.md` and `super-gsd/skills/sgsd-orchestrate/SKILL.md`. |
| `M=4` | orchestrate, write-plan, complete-milestone, audit, readiness, overlay-refresh, backfill | Their outputs are directly loaded by a later mechanical surface: loop state, plan-schema/plan loader, milestone state, phase closure, readiness gate, Claude contract loading, or runtime scaffold consumers. |
| `R=4` | orchestrate, readiness | The orchestrator defines direct Codex, patch-mode, remote route, board+Codex challenge, checkpoint, and degraded paths; readiness distinguishes blocked from deterministic degraded continuation. |
| `F=4` | orchestrate | It reserves model judgment for Claude synthesis while structurally routing research/planning/execution/verification to bounded Codex and deterministic tools. |
| `B=1` | triage, deliberate, write-plan | Triage invokes the wrong plan-author abstraction, writes legacy phase paths, and ends before continuation; deliberation has skill-versus-CEO orchestration and config-versus-registry roster splits; write-plan validates content but targets the legacy root rather than the current per-milestone truth path. |
| `M=1` | token-triage, status-brief, roadmap-planner, release-check, gate-triage, cockpit-review, triage, overwatcher, VTP-advise | Each returns prose, a draft, or a dashboard to the operator without a required typed downstream consumer. Roadmap/release deliberately retain operator authority; that safety does not change the mechanical-consumption score. |
| `C=1` | triage, deliberate, VTP-advise, distill | Triage always chains two large reasoning skills before classification; board budgets 10.4k–16.4k tokens despite conflicting roster contracts; standalone VTP duplicates other enrichment routes; distillation embeds a 1,000–2,000-line corpus and operator-rating loop without current use evidence. |

## Four end-to-end control-plane traces

### 1. Interactive operator-led build without entering the auto loop

This trace describes the user's common Claude-orchestrates/Codex-codes workflow. It is operationally real as a launch shape, but not a named mechanically governed mode.

| Node/source | Trigger | Owner | Input | Output | State mutation | Evidence | Failure path | Next consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. `sg` launcher — `super-gsd/scripts/Install-SgsdShortcut.ps1` | Operator types `sg` in Warp/PowerShell; remote equivalent is `--greet` in `super-gsd/scripts/sgsd-remote-tmux.sh` | Shell launcher | Current project, optional flags | Cockpit starts separately; Claude starts in the same current terminal/tmux operator pane with greeting | None required | **OBSERVED:** executable function and tmux command | Claude missing leaves cockpit open; tmux doctor reports missing dependencies | Claude process |
| 2. Greeting/cold read — `super-gsd/scripts/Install-SgsdShortcut.ps1` and `CLAUDE.md` | Claude receives greet prompt, not `go` | Claude/Opus control plane | STATE frontmatter, agent registry, checkpoint, memory | One-line status, agent count, cockpit confirmation, “what do you want to build?” | Read-only unless an existing checkpoint forces resume under `CLAUDE.md` | **CONFIGURED:** prompt plus session-start contract; no mode ledger row | Greet says wait, while session contract says a checkpoint resumes without asking; precedence is prose | Operator |
| 3. Direct build request — `CLAUDE.md` and `AGENTS.md` | Operator asks for a specific code change, which triage exclusions classify as direct execution/mid-build | Claude/Opus | Operator request and project truth | Assumptions, success criteria, bounded plan/dispatch intent | No named “interactive” mode mutation | **CONFIGURED:** direct-execution exclusion and control-plane-only project rule | No executable user-intent matcher; Claude may instead regard wording as planning intent | Plan author or Codex dispatch |
| 4. Plan boundary — `super-gsd/skills/sgsd-write-plan/SKILL.md` | Work requires a source-changing plan | Claude invokes plan author; Codex owns delivery planning under project contract | Context/research and goal | Schema-v2 PLAN.md | Writes planning artifact only | **CONFIGURED:** validator-before-write; **CONFIGURED drift:** target path is legacy `.planning/phases/` | In the common unlooped path, invocation is not mandatory; triage may call generic writing-plans, and either output may miss the active per-milestone phase | Codex executor only after canonical path resolution |
| 5. Bounded code execution — `super-gsd/skills/sgsd-orchestrate/SKILL.md` and `super-gsd/scripts/codex-executor.sh` | Approved pending task/plan | Codex GPT-5.5/xhigh; Claude composes and processes handoff | Minimal files, plan, constraints, sandbox/worktree policy | Code diff, structured executor report, verification output | Source changes by Codex only | **CONFIGURED:** hard lock says Claude must not author code delta | Direct Codex → read-pack patch → configured remote/Linux Codex; otherwise blocker | Spec reviewer/gates |
| 6. Independent review/gates — `super-gsd/skills/sgsd-audit/SKILL.md` and `super-gsd/registry/gates.yaml` | Files changed or phase claim needs proof | Codex/local gate surfaces | Raw PLAN, diff, report, verification | Review verdict and evidence path | Evidence artifacts; may block/repair | **CONFIGURED:** gate contracts exist; recent firing cannot be proven | Repair/re-dispatch; never bypass | Claude synthesizer/operator |
| 7. Interactive stop/report — `CLAUDE.md` | One requested unit is complete or operator decision is needed | Claude/Opus | Executor and gate outputs | Concise outcome and next choice | Possible planning progress/commit, but no required loop continuation | **INFERRED:** this is normal conversational control; no `run_started mode=interactive` event contract found | Session can end with results only in scrollback unless artifacts were written | Operator |

**Boundary result:** the launcher deliberately preserves the desired topology — Claude remains in the original terminal and the cockpit opens separately — but the governed one-unit form is `/sgsd-orchestrate next`. Default `sg` does not invoke it. The unlooped interactive workflow therefore relies on Claude following shared prose and the operator's prompt, not on an explicit state-machine mode.

### 2. Natural-language planning intent entering triage

| Node/source | Trigger | Owner | Input | Output | State mutation | Evidence | Failure path | Next consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Prose intent detection — `CLAUDE.md` | High-confidence phrases such as “How should we,” “Let's plan,” “Design,” or tradeoffs | Claude/Opus | Raw operator turn | Decision to invoke triage | None | **CONFIGURED:** explicit positive and negative trigger lists | Ambiguous wording asks operator; there is no executable matcher or precedence registry | Triage |
| 2. Optional VTP framing — `super-gsd/skills/sgsd-triage/SKILL.md` | `workflow.triage_vtp_enrichment=true` in `.planning/config.json` | Triage/composer | State slice plus raw query | VTP-EVIDENCE.md with IDs/framing, routing log | Planning evidence and configured metrics row | **CONFIGURED:** composer command and artifact path | VTP disabled/unavailable continues with raw query | Brainstorm |
| 3. Brainstorm — `super-gsd/skills/sgsd-triage/SKILL.md` | Every admitted triage request | Claude skill | Raw or enriched query | Intent, requirements, alternatives | Conversation/design artifact as dictated by external skill | **CONFIGURED:** mandatory Step 1 | Cost is paid before coarse A/B/C/D classification | Generic planner |
| 4. Generic plan — `super-gsd/skills/sgsd-triage/SKILL.md` | Brainstorm complete | Claude skill `superpowers:writing-plans` | Brainstorm result | Executable-looking plan | External skill artifact/location | **CONFIGURED:** mandatory Step 2 | Bypasses `sgsd-write-plan` schema-native validation contract | Triage classifier |
| 5. A/B/C/D classification — `super-gsd/skills/sgsd-triage/SKILL.md` | Plan complete | Claude/Opus | Plan and uncertainty | Path A brief, Path B phase seed, Path C audit invocation, or Path D inline answer | May write brief, decision note, CONTEXT, or VTP evidence; Path B uses legacy `.planning/phases/` | **CONFIGURED:** prose decision rules | No closed-vocabulary typed result, executable validator, or current-milestone path resolver | Operator |
| 6. Report and offer — `super-gsd/skills/sgsd-triage/SKILL.md` | Route selected | Claude/Opus | Selected route/artifact path | “Ready to fire/write/continue? (y/N)” | None after report | **CONFIGURED:** Step 4 says NEVER auto-fire downstream skill | A “no,” silence, session end, or context loss leaves no mechanical continuation | Operator memory/action |

**Boundary result:** yes, triage can terminate cleanly with no mechanical continuation; that is its explicit current contract. The repair is not to remove operator authority. It is to emit a typed `route_proposal` with `next_command`, `artifact_refs`, `approval_required`, and a stable ID that the approved continuation consumes.

### 3. Strategic ambiguity escalating to board/deliberation

| Node/source | Trigger | Owner | Input | Output | State mutation | Evidence | Failure path | Next consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Path A proposal — `super-gsd/skills/sgsd-triage/SKILL.md` | Cross-cutting decision, fundamental uncertainty, invariants, and ≥2h/non-revertible work | Triage | Generic plan | Structured brief path and suggested deliberate command | Writes a generated `.planning/briefs/{date}-{slug}.md` pattern; no current exact file is asserted | **CONFIGURED:** Path A rules | Floor sends small/revertible work to Path B; triage still stops for confirmation | Operator |
| 2. Explicit invocation — `super-gsd/skills/sgsd-deliberate/SKILL.md` | Operator approves `/sgsd-deliberate <brief-path>`, or auto blocker recovery invokes it | Claude/Opus skill | Brief | Pre-gate decision | None | **CONFIGURED:** command and blocker-recovery call site | Missing fields, <3 affected phases, or floor skip returns without board | Roster resolver |
| 3. Runtime roster — `super-gsd/scripts/lib/board-registry.cjs` and `super-gsd/registry/board-members.yaml` | Pre-gates pass | Deterministic Node resolver | Registry + optional round-one votes | Architect + Contrarian + CEO in round one | None | **OBSERVED:** 2/2 roster tests pass; disabled Pragmatist/Moonshot excluded | Missing member throws; disabled escalation members are silently not added by design | Board dispatch |
| 4. Competing orchestration contracts — `super-gsd/skills/sgsd-deliberate/SKILL.md` and `super-gsd/agents/sgsd-ceo.md` | Resolved roster is dispatched | Claude agents | Brief, context, role | Structured positions or CEO-orchestrated nested board | Debate outputs | **CONFIGURED conflict:** skill says dispatch every resolved member and validate a 10-field position; CEO agent says it itself spawns config.deliberation.board and returns a different summary contract | CEO can be treated simultaneously as board member and board orchestrator; config includes disabled/nonexistent roster entries | Skill or CEO synthesis |
| 5. Vote synthesis — `super-gsd/scripts/lib/vote-synthesis.cjs` as cited by `super-gsd/skills/sgsd-deliberate/SKILL.md` | Valid round results | Deterministic vote helper + Claude synthesis | Parsed positions | Decision, signed sum, raw votes, memo narrative | Writes decision memo/debate log/token row | **CONFIGURED:** helper call is specified; runtime invocation not proven | Schema retry once, then error; memo template hardcodes a four-role board that differs from the resolved roster | Operator or blocker challenge |
| 6. Continuation | Memo exists | Operator in normal deliberation; orchestrator only in blocker recovery | Memo | Manual decision/action, or separate Codex challenge | Optional route-decision evidence in blocker recovery | **CONFIGURED:** orchestrator hard loop explicitly feeds memo to Codex; ordinary deliberate has no equivalent | Normal strategic memo can remain prose with no linked phase/plan activation | Operator, or Codex challenge in auto recovery |

**Boundary result:** the strategic reasoning capability is worth retaining, but its authority is split. `.planning/config.json` lists Architect, Pragmatist, Contrarian, Moonshot, Researcher; `super-gsd/registry/board-members.yaml` resolves Architect, Contrarian, CEO; Pragmatist/Moonshot/Researcher are legacy-disabled; and the deliberate memo template hardcodes Architect/Pragmatist/Contrarian/Moonshot. One runtime roster and one synthesizer must own both execution and recorded provenance.

### 4. Explicit autonomous orchestration

| Node/source | Trigger | Owner | Input | Output | State mutation | Evidence | Failure path | Next consumer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Enter auto — `super-gsd/scripts/Install-SgsdShortcut.ps1`, `CLAUDE.md`, `super-gsd/skills/sgsd-orchestrate/SKILL.md` | `sg -Go`, `go`, `auto`, `continue`, or canonical slash command | Shell then Claude/Opus | Project and user command | Auto-loop contract; configured `run_started` event | Live/metrics event when ledgers exist | **CONFIGURED:** explicit aliases and no-confirmation rule | Missing Claude/Codex/provider health enters readiness/recovery | Cold start |
| 2. State/readiness — `CLAUDE.md` and `super-gsd/skills/sgsd-readiness/SKILL.md` | New/stale milestone or loop tick | Claude plus Codex/local checks | STATE frontmatter, checkpoint, roadmap, config, dependency probes | Next unit and GO/BLOCKED/DEGRADED path | Readiness manifest/log, checkpoint handling | **CONFIGURED:** rule 0 and 4.5 | Continue degraded if safe; otherwise blocker recovery/checkpoint | Classifier |
| 3. First-match dispatch selection — `CLAUDE.md` and `super-gsd/skills/sgsd-orchestrate/SKILL.md` | Current phase artifact state | Claude/Opus | Plan frontmatter/cache/state | Research, plan, review, readiness, execute, verify, repair, close, or exit step | Token/intent/task events when ledgers exist | **CONFIGURED:** ordered rules 0–9 | Auto-mode classifier deliberation is skipped; blocker deliberation occurs later | Intent/packet pipeline |
| 4. Intent map and role packet — `super-gsd/tools/intent-map/build.cjs` and `super-gsd/tools/context-packet/build.cjs` | Before Codex/local delivery dispatch | Deterministic Node tools | Raw turn, milestone/phase, role, evidence refs | Closed-vocabulary intent and bounded role packet | Intent-map/context-packet ledgers when directory exists | **OBSERVED in isolation:** 10/10 and 15/15 self-tests | Falsey/error falls back to legacy composed prompt and logs deviation by contract | Dispatch router |
| 5. Provider routing — `super-gsd/tools/dispatch-router/route.cjs` | Before every Agent/delivery dispatch | Deterministic router | Task kind, uncertainty, file/line count, role/spend, gate | Provider/fallback decision | Route-decision envelope when metrics path exists | **OBSERVED in isolation:** 15/15 self-test | Never throws upward; safe Claude/default fallback is logged by contract | Codex/local/VTP/Claude synthesis |
| 6. Delivery execution — `super-gsd/scripts/codex-executor.sh` and `super-gsd/skills/sgsd-orchestrate/SKILL.md` | Pending research/plan/task/review/verification | Codex GPT-5.5/xhigh | Bounded packet, plan, allowlist | Research/plan/diff/review/verifier report | Phase/source artifacts | **CONFIGURED:** Codex hard lock; one task/plan and no parallel file writers | Direct Codex → patch mode → configured remote route → board+Codex challenge | Gates |
| 7. Assurance/repair — `super-gsd/registry/gates.yaml` and `super-gsd/skills/sgsd-audit/SKILL.md` | Delivery result or phase closure | Codex/local gates; Claude routes verdict | Raw evidence | Pass/warn/fail, evidence path, repair plan | Gate/review/edge evidence and phase status | **CONFIGURED:** canonical gates and repair loops | Critical → repair/replan; never bypass | State transition |
| 8. Continue/exit — `super-gsd/skills/sgsd-orchestrate/SKILL.md` | Unit committed and state updated | Claude/Opus | Structured report and evidence | Next tool call, milestone close, checkpoint, or final exit | STATE/commit/checkpoint | **CONFIGURED:** only three exit conditions | Explicit stop, operator-only exhausted blocker, or no remaining roadmap work | Next loop tick or operator |

**Boundary result:** the autonomous route is the only fully described end-to-end mode. Its components are executable and self-tested, but current runtime use cannot be claimed without the absent ledgers.

## Six boundary questions

| Question | Answer | Evidence and consequence |
| --- | --- | --- |
| Can triage terminate without a mechanical continuation? | **Yes — CONFIGURED.** | `super-gsd/skills/sgsd-triage/SKILL.md` Step 4 says never auto-fire the next skill and ends with a y/N offer. A brief or phase seed may exist, but no continuation envelope is required. |
| Can board/deliberation and orchestration both claim the same intent? | **Yes, in overlapping branches.** | `CLAUDE.md` routes explicit “deliberate” to the board, triage Path A proposes it, the orchestrator classifier has a `deliberate` flag, and auto blocker recovery invokes the board. Auto mode skips classifier deliberation but later mandates blocker deliberation. No shared executable precedence registry reconciles those branches. |
| Is interactive SGSD a named first-class mode or merely Claude launched with a prompt? | **It is a documented behavior, not a named launch/state transition.** | `sg` in `super-gsd/scripts/Install-SgsdShortcut.ps1` launches Claude with a greet-and-wait prompt. The orchestrate command exposes go/auto/continue/next/status/stop, not “interactive.” `CLAUDE.md` uses the word interactive for policy branches, but no mode registry/event/state field was found. |
| Does Claude ever duplicate research, planning, coding, or verification owned by Codex? | **Configured planning duplication exists; code duplication is forbidden; runtime compliance is unproven.** | `super-gsd/skills/sgsd-triage/SKILL.md` performs brainstorming plus generic writing-plans before Path B later enters Codex planning. `super-gsd/skills/sgsd-orchestrate/SKILL.md` explicitly forbids Claude from research, planning, verification, gates, and code-mutating executor work in auto mode, and `AGENTS.md` globally says Claude never writes code. With `.planning/metrics/` absent, this audit cannot prove recent provider compliance. |
| Are skill results mechanically consumed or left as prose/operator memory? | **Mixed; the biggest routing skills are uneven.** | PLAN, readiness, checkpoint, audit, and orchestration outputs have mechanical consumers. Triage, ordinary decision memos, Warp diagnostics, overwatcher, and standalone VTP advice usually return to operator memory. The matrix's `Mechanical consumer` column records the boundary per skill. |
| Are trigger precedence and fall-through behavior explicit? | **Explicit inside auto dispatch; only prose-level across user-intent skills.** | `CLAUDE.md` declares auto dispatch “first match wins” and lists planning positives/exclusions. However, there is no executable first-match user-intent table, `super-gsd/registry/decisions.yaml` is empty, and ambiguous planning falls through to a question. Board/config and planner/triage splits show the prose policy is not a single authority. |

## Trigger precedence and fall-through

### Current precedence that can be reconstructed

**INFERRED from `CLAUDE.md` and the skill contracts:**

1. Session checkpoint check happens before the greeting workflow's intended wait.
2. Explicit go/auto/run/continue enters auto without confirmation.
3. Explicit next/status/stop/deliberate/token-audit commands select their named paths.
4. High-confidence planning language enters triage unless it is factual, direct execution, a specific mid-build change, or trivial.
5. Ambiguous planning asks the operator whether to run triage.
6. Once auto is active, ordered dispatch rules are first-match-wins.

That sequence is readable, but items 1–5 are Claude prose, not an executable policy. The “first match wins” label begins only at auto dispatch rules. `super-gsd/tools/intent-map/build.cjs` compiles operator text for bounded dispatch packets after orchestration has selected work; it is not the user-facing skill selector. `super-gsd/tools/dispatch-router/route.cjs` selects providers for an already-classified dispatch; it does not decide triage versus deliberate versus orchestrate.

### RECOMMENDED precedence repair

Create one versioned `control_route` registry and deterministic evaluator with this order:

1. Safety/explicit stop and operator-only approval.
2. Checkpoint recovery.
3. Explicit named command.
4. Current governed mode continuation.
5. Direct execution versus planning-intent classification.
6. Strategic-impact/floor policy.
7. Retrospective/diagnostic route.
8. Inline answer.
9. Ambiguous route proposal requiring operator approval.

The evaluator should emit:

```text
route_id
mode: interactive | one_unit | autonomous | deliberate | recovery | diagnostic
intent_class
chosen_capability
artifact_refs[]
approval_required
next_command
reason_codes[]
fallback
```

The next capability must accept `route_id` and append a consumed/declined result. This preserves operator control while eliminating scrollback-only continuation.

## Overlap and duplication register

| Overlap | Evidence label | Current consequence | Preliminary fix |
| --- | --- | --- | --- |
| Triage Step 2 versus SGSD-native plan author | **CONFIGURED:** `super-gsd/skills/sgsd-triage/SKILL.md` calls generic writing-plans; `super-gsd/skills/sgsd-write-plan/SKILL.md` says it replaces that skill, while both still target legacy `.planning/phases/` | A triaged executable plan can bypass v2 validation or land outside the active milestone and then be replanned by Codex | **REPLACE** triage's planning step with route classification first; repair a shared current-phase resolver, then call `sgsd-write-plan` after executable-work selection |
| Deliberate skill versus CEO agent | **CONFIGURED:** `super-gsd/skills/sgsd-deliberate/SKILL.md` directly runs roster/rounds/synthesis; `super-gsd/agents/sgsd-ceo.md` claims the same orchestration | Nested/double board risk and incompatible response schemas | Choose one: recommended deterministic skill owns roster/schema/vote; CEO performs synthesis only |
| Project config board versus registry board | **OBSERVED/CONFIGURED:** `.planning/config.json` names five perspectives; `super-gsd/registry/board-members.yaml` resolves Architect/Contrarian/CEO and disables others | Operator cannot know which board a call means; Researcher has no active registry member | Make `super-gsd/registry/board-members.yaml` sole roster authority; generate config display from it or remove the config array |
| Plan-level parallel config versus serial executor hard lock | **CONFIGURED with no consumer found:** config enables three plan-level agents/skip checkpoints; orchestrate serializes every writer | Misleading control surface; operator may believe concurrency is active | Split policy into `max_concurrent_readers` and `max_concurrent_writers=1`; only enable isolated-worktree plan concurrency after ownership tests |
| Warp token triage versus native token audit | **CONFIGURED:** both group spend and recommend compression | Duplicate reasoning and inconsistent thresholds are possible | Native token-audit owns calculation; Warp skill formats its typed result |
| Status brief, cockpit review, Warp operator | **CONFIGURED:** three read-only views compose overlapping MCP/state data | Discovery burden; outputs are not linked | One `sgsd-status` capability with compact/expanded/diagnostic projections |
| Gate triage versus audit remediation | **CONFIGURED:** both interpret failure evidence and suggest repair | Operator must translate explanation into a new dispatch | Gate triage emits an existing-orchestrator repair envelope referencing the original gate; no bypass |
| Overwatcher versus cockpit/system map | **CONFIGURED/DOCUMENTED:** each visualizes planning/system health | Separate dashboard with no state-machine consumer | Move unique collision/dead-end signals into cockpit and retire duplicate serving surface |
| Standalone VTP advice versus triage/SEPL/VTP bridge | **CONFIGURED:** four routes can request related evidence | Repeated retrieval cost and prose-only handoff | One cached evidence-packet service; skills request typed projections |
| Update versus overlay refresh | **CONFIGURED:** update installs resources; overlay refresh separately syncs control contract | Version skew can persist after successful update | Update transaction runs overlay dry-run, refresh, and contract hash verification |
| Transition, memory migration, backfill | **CONFIGURED:** three onboarding/migration fronts overlap | Routine skill discovery includes one-time legacy paths | Backfill is the front door; preflight delegates legacy transitions, then hides completed migrations |

## Mechanical-consumption gaps

1. **Triage continuation gap.** A/B/C/D is a model judgment with no typed output or mandatory consumer. The operator must remember and retype the next command.
2. **Decision-to-work gap.** Normal deliberation writes a memo, but no mechanical link binds its decision, falsifier, and constraints into a roadmap proposal or plan. The blocker-recovery branch is better because it explicitly sends the memo to a separate Codex challenge.
3. **Diagnostic-to-repair gap.** Gate, token, cockpit, status, and release helper skills explain state. Only readiness has a direct state-machine consumer.
4. **Learning-to-routing gap.** MUDA and distillation can curate memory, but the MUDA skill itself documents the anti-pattern read path as deferred; no recent ledger can demonstrate that learned material changed a route.
5. **Configuration-to-runtime gap.** Parallelization and the five-member board are visible in project config without evidence of active consumers.
6. **Registry-to-edge-guard gap.** `super-gsd/registry/decisions.yaml` documents expects/emits enforcement but contains no decision steps and has no executable consumer in the census. The real routing contract remains embedded in long prose.

### RECOMMENDED consumption contract

Every routing/diagnostic skill should return a small typed result:

- `status` and `evidence_refs`
- `reason_codes`
- `recommended_action` from a closed vocabulary
- `next_capability` and `next_input`
- `approval_required`
- `expires_at` or source freshness
- `consumed_by` / `consumed_at` appended by the next step

This does not mean every report auto-executes. Read-only and operator-gated skills can emit `approval_required: true`. Mechanical consumption means the approval or decline is attached to the proposal ID rather than surviving only in conversational memory.

## Parallelization contract analysis

`.planning/config.json` currently sets:

- `parallelization.enabled: true`
- `max_concurrent_agents: 3`
- `min_plans_for_parallel: 2`
- `plan_level: true`
- `task_level: false`
- `skip_checkpoints: true`

The current-source consumer search found no executable read of `config.parallelization` outside planning history. In contrast, `super-gsd/skills/sgsd-orchestrate/SKILL.md` states:

- each Codex executor dispatch is one fresh task/plan;
- no parallel Codex file writers share a workspace;
- “Parallel executor waves must serialize.”

**INFERRED:** plan-level parallelization is currently inert or stale configuration, not effective behavior. Board-member reasoning is separately configured to run in parallel, but that is read-only multi-perspective analysis and does not prove plan-level writer concurrency.

**RECOMMENDED repair:**

1. Rename the real invariant to `max_concurrent_writers: 1`.
2. Add `max_concurrent_readers` for research, review, and independent challenge work.
3. Permit multiple plan writers only in isolated worktrees with declared file ownership and a deterministic merge/revalidation barrier.
4. Remove `skip_checkpoints` from a generic parallel block; checkpoint policy belongs to mode/recovery policy.
5. Add an acceptance test that loads project config and proves the controller either enforces each key or rejects it as unknown/stale.

## Empty decisions registry as a governance gap

`super-gsd/registry/decisions.yaml` says it is the first-class source for orchestrator decision steps, expects/emits, and edge-guard transitions. Its active `decision_steps` value is an empty array; only `_example_entry` exists. A repository search found no executable consumer outside prose/history.

Consequences:

- trigger precedence cannot be inspected as data;
- stale config and skill contracts are not rejected at load time;
- edge-guard claims cannot be tied to a complete decision graph;
- changes to the 3,000-line orchestration skill can alter routing without a registry diff.

**RECOMMENDED repair:** do not hand-maintain a second truth. Extract a compact canonical control-route registry, validate it, and generate the human-facing command table from it. If SGSD is not prepared to consume the registry, remove the empty scaffold until it is; an empty “authoritative” registry is worse than an honestly prose-owned contract.

## Observed/configured/documented boundary

| Boundary | What is defensible now | What is not defensible now |
| --- | --- | --- |
| Installed skills | **OBSERVED:** exactly 28 material rows from SRC-013..SRC-040: 21 active-distribution and seven Warp read-only skills | That every skill is globally installed, discoverable in every CLI, or recently invoked |
| Autonomous wiring | **CONFIGURED:** orchestration references intent-map, context-packet, router, Codex wrappers, readiness, gates, and closure | That a recent end-to-end run exercised each wire; ledgers are absent |
| Executable substrates | **OBSERVED:** board resolver, intent compiler, dispatch router, and packet builder self-tests pass | That the prose skill engine called them in this worktree |
| Interactive behavior | **OBSERVED:** `sg`/tmux greet preserve terminal topology and launch Claude waiting for a task | That “interactive” is a persisted or registered mode with mechanical transition/evidence |
| Board roster | **OBSERVED:** registry resolver yields Architect + Contrarian + CEO | That `.planning/config.json`'s five-name board is effective; current active deliberate/CEO contracts disagree |
| Provider ownership | **CONFIGURED:** Claude orchestrates; Codex owns delivery roles and code mutation | Recent provider compliance or token split |
| Recent use | **OBSERVED absence:** `.planning/metrics/` is absent | Any “used recently,” “dormant,” frequency, cost, or outcome-effect claim |

## Preliminary repair set

These are lane-scoped amendments for later synthesis, not settled architecture decisions.

| Priority | Amendment | Current evidence | Proposed bounded fix | Falsifiable proof |
| ---: | --- | --- | --- | --- |
| 1 | Make modes and skill routes first-class | Greet-only interactive path; prose trigger table; empty decisions registry | Versioned deterministic `control_route` evaluator and typed continuation envelope | A fixture suite maps every explicit/ambiguous utterance to exactly one route and proves approved continuation consumes the same route ID |
| 2 | Repair triage's planning boundary | Triage calls generic writing-plans; SGSD write-plan declares replacement but targets the legacy phase root | Add one current-milestone phase resolver; classify before expensive planning; invoke `sgsd-write-plan` only for SGSD executable work | A Path-B fixture writes only under `.planning/milestones/{active}/phases/` and cannot write PLAN.md unless `validate.cjs --mode write` passes; Path A/C never pays plan-author cost |
| 3 | Consolidate board authority | Skill/CEO duplicate orchestration; config/registry roster mismatch | Registry owns roster; deterministic skill owns schema/rounds/vote; CEO is synthesis-only | One board fixture dispatches Architect + Contrarian once, invokes CEO once after positions, and never references disabled config entries |
| 4 | Reconcile parallelism with isolation | Config enables plan concurrency; writer hard lock serializes; no config consumer found | Explicit reader/writer concurrency policy; optional worktree-isolated plan waves | Two disjoint plan fixtures run concurrently in separate worktrees and merge/revalidate; overlapping ownership is rejected before dispatch |
| 5 | Mechanize safe handoffs | Triage/diagnostic/memo outputs return to operator prose | Common typed result with approval flag and consumed/declined audit row | Every route proposal has one terminal consumption state; no approved proposal requires retyping a command |
| 6 | Collapse operator-facing duplicates | Three status views, two token views, gate/audit overlap | One read engine per domain with compact/expanded Warp projections | Snapshot tests show the projections share identical source values and reason codes |
| 7 | Rationalize lifecycle-only skills | Transition/memory-migrate/backfill and update/overlay overlap | Backfill and update become front doors; legacy tools appear only when preflight detects need | A current SGSD project does not advertise completed one-time migrations; a legacy fixture still receives the correct migration action |

## Lane conclusions

1. **KEEP the autonomous engine and its bounded Codex execution fabric.** It has the best-defined trigger, downstream consumption, and recovery contract in this lane.
2. **STRENGTHEN the engine by moving mode and intent choice out of prose.** The router must govern interactive, one-unit, autonomous, deliberate, recovery, and diagnostic paths together.
3. **REPLACE current triage orchestration, not the goal of triage.** Early ambiguity detection is useful; mandatory brainstorm + generic plan + operator-only handoff is not a proportionate or schema-safe implementation.
4. **STRENGTHEN board reasoning after removing duplicate authority.** The current registry mechanics pass, but active instructions disagree on who dispatches, which roster is real, and what schema CEO returns.
5. **Treat plan-level parallelization as stale until a consumer and isolation proof exist.** Serial writers are the safe current truth.
6. **Turn operator-only skill outputs into typed proposals, not automatic authority.** Mechanical consumption can preserve approval requirements.
7. **Use the absent metrics boundary honestly.** This lane can identify configured leverage and structural gaps; it cannot rank skills by actual frequency or measured outcome effect.

**Highest-leverage amendment (preliminary):** a single typed control-route layer. It would simultaneously name the interactive workflow, resolve triage/board/auto precedence, select the SGSD-native planner, make approvals resumable, expose stale configuration, and give cockpit/metrics one auditable record of why each capability ran. The cross-lane synthesis should challenge whether this layer can remain small enough to reduce rather than add complexity.

## Source ledger

Primary repository evidence used in this lane:

- `AGENTS.md` — control-plane/execution ownership and repository hard rules.
- `WARP.md` — `sg` topology and operator entry points.
- `CLAUDE.md` — new-session, intent trigger, auto-mode, first-match, provider, and checkpoint contracts.
- `.planning/config.json` — board, model routing, workflow, and parallelization configuration.
- `.planning/analyses/2026-07-13-sgsd-frontier-architecture-evidence-index.md` — approved source boundary and absence findings.
- `super-gsd/scripts/Install-SgsdShortcut.ps1` — executable local `sg` entrypoint.
- `super-gsd/scripts/sgsd-remote-tmux.sh` — executable SSH/tmux greet/go topology.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — control-loop and Codex hard lock.
- `super-gsd/skills/sgsd-triage/SKILL.md` — planning detection, generic planning, classification, and non-continuation.
- `super-gsd/skills/sgsd-deliberate/SKILL.md` — pre-gates, roster, rounds, schema, synthesis, and outputs.
- `super-gsd/skills/sgsd-write-plan/SKILL.md` — canonical schema-v2 plan author.
- `super-gsd/registry/board-members.yaml` — runtime board roster and lifecycle state.
- `super-gsd/scripts/lib/board-registry.cjs` — executable roster resolver.
- `super-gsd/scripts/lib/board-registry.test.cjs` — current production roster assertion.
- `super-gsd/agents/sgsd-ceo.md` — conflicting CEO board/config orchestration contract.
- `super-gsd/registry/decisions.yaml` — empty decision-step scaffold.
- `super-gsd/tools/intent-map/build.cjs` — closed-vocabulary intent compiler.
- `super-gsd/tools/context-packet/build.cjs` — role-specific dispatch packet builder.
- `super-gsd/tools/dispatch-router/route.cjs` — structural provider router.
- `super-gsd/tools/plan-schema/validate.cjs` — SGSD plan validation consumer.
- `super-gsd/registry/gates.yaml` — canonical gate registry.
- `super-gsd/scripts/codex-executor.sh` — required code-mutating executor path.

Reasoning lenses used but not treated as runtime evidence: the approved architecture-audit design's adversarial current-versus-clean-sheet method and the eight-dimension audit rubric.

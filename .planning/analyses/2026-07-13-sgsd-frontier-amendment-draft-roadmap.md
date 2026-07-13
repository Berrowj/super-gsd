---
created: 2026-07-13
goal: Prove a typed run and authority spine in shadow, close observed authority and recovery holes, and migrate only after replay, parity, failure-injection, and human-controlled canary evidence pass.
status: draft
operator_review_required: true
state_mutation: forbidden
provisional_milestone: v3.5/vNext
phase_range: P144-P155
activation_approval:
  received: true
  received_at: 2026-07-13
  scope: execution-handoff-after-canonical-reconciliation
  authorizes_direct_state_mutation: false
---

# Draft Amendment Roadmap — Typed Run and Authority Spine

## Review-only boundary

This is a draft milestone candidate under `.planning/analyses/`. It does not activate a milestone, add a phase to an active roadmap, modify `.planning/STATE.md`, or authorize a source mutation outside a promoted SGSD plan.

Operator execution approval was received on 2026-07-13. That approval authorizes the orchestrator to perform the normal activation handoff after canonical truth is reconciled; it does not make this analysis file an active roadmap and does not waive `operator_review_required: true` or `state_mutation: forbidden`.

Canonical truth currently prevents direct activation:

- `.planning/STATE.md` records v3.4 and a P999 pointer.
- `.planning/milestones/v3.4/ROADMAP.md` is absent.
- `.planning/milestones/v3.4/INTENT.md` admits P136-P143, while P143 is absent and P999 is PLAN-only.
- `.planning/ROADMAP.md` and `.planning/MILESTONES.md` provide historical format through v3.2, not authority to infer the missing v3.4 transition.

Before P144 can dispatch, the orchestrator must reconcile or explicitly supersede the v3.4/P999/no-roadmap truth, promote this candidate through the existing SGSD milestone, phase, CONTEXT, RESEARCH, PLAN, VERIFICATION, and review artifacts, and only then dispatch P144 through the established execution fabric. This draft invents no activation command and performs no state mutation.

## Goal

SGSD already contains strong typed profiles, context packets, isolated-worktree machinery, gates, evidence writers, state resolvers, recovery helpers, operator projections, memory governance, and learning components. The highest-leverage change is not a rewrite: it is to make those mechanisms unavoidable behind one typed, replayable authority path and prove that path in shadow before any cutover.

The milestone candidate therefore:

1. repairs three observed baseline defects that would invalidate later process, projection, or remote proofs;
2. runs the highest-ranked typed authority-spine experiment in shadow with no live effect authority;
3. closes state, routing, execution, assurance, projection, and optional-context seams behind existing mechanisms; and
4. admits learning last, then uses human-controlled canaries and a fail-closed release decision for migration.

Expected benefit is not measured benefit. The audit checkout has no live `.planning/metrics/` or canonical CMB ledger, so the candidate requires new parity and outcome evidence before activation claims.

## Fixed recommendation ranks

| Rank | Amendment | Fixed boundary |
| ---: | --- | --- |
| 1 | Shadow typed authority spine | Shadow only until parity, replay, and failure-injection evidence pass; no cutover or claimed benefit. |
| 2 | Fail-closed authority holes | Provider unavailability never transfers delivery to Claude; profile overrides cannot weaken authority; unsupported closure cannot return success. |
| 3 | Transactional state/checkpoint/watchdog | One transition/checkpoint schema, exactly-once resume, and fenced watchdog takeover. |
| 4 | Chronicle host-shell repair | Correct interpreter/path/EOL/log isolation at the Windows, Git Bash, POSIX, and explicit WSL boundary. |
| 5 | Rationale semantics and incomplete-phase repair | Preserve YAML meaning, expose honest partial/empty states, and reject synthetic phase completeness. |
| 6 | Durable existing-gate decision lifecycle | Join existing finding to repair, supersession, permissible debt, and closure without duplicating a gate. |
| 7 | One semantic snapshot and honest evidence health | All operator views share scope, freshness, conflicts, omissions, and required-stream health. |
| 8 | Proved remote EOL/SSH/tmux topology | Enforce LF and prove command invocation, persistence, reconnect, tunnel, and degraded panes. |
| 9 | Optional VTP success admission | Preserve safe absence/error degradation while admitting validated successful evidence into the exact future packet. |
| 10 | Learning admission last and canary-only | Observations remain non-authoritative; one bounded evaluated candidate may affect policy only after admission and rollback proof. |

Phase order is dependency- and risk-ordered rather than rank-ordered. P144-P146 are baseline proof repairs; they precede but do not displace the Rank 1 shadow experiment at P147.

## Candidate phase crosswalk

| Phase | Candidate | Recommendation ranks | Primary findings |
| ---: | --- | --- | --- |
| P144 | Chronicle host-shell boundary | R4 | Chronicle RCA; `SAC-P116-10`, `SAC-P116-11`, `STRUCT-P116-22` |
| P145 | Rationale semantics and active-phase completeness | R5 | `SAC-P142-03`; D03, D10 |
| P146 | Remote EOL, SSH/tmux, and browser topology | R8 | D12, D13 |
| P147 | Shadow typed run and authority spine | R1 | Skills control-route findings; E03-E05, E11, E15; F1, F2, F5; D01, D04; clean-sheet §§5, 17-18 |
| P148 | Transactional state, checkpoint, and watchdog authority | R3 | D01-D07, D23; CON-001, CON-002, CON-003, CON-005, CON-007 |
| P149 | Control route, skill handoffs, and board authority | R1, R2 | Triage/planner, board/CEO, roster, parallelism, and empty-decision-registry findings |
| P150 | Execution Authority and HEAD-complete change accounting | R1, R2 | E01-E12, E14-E15; F1-F5 |
| P151 | Existing-gate repair lifecycle and generic release closure | R2, R6 | G01, G04, G06-G08, G10; D20; KEEP G02, G03, G05, G09 |
| P152 | Shared semantic projection and optional VTP admission | R7, R9 | D04, D08-D10, D14, D15, D19, D20; CON-004 |
| P153 | Governed CMB and harness learning admission | R10 | D16-D22; CON-006 |
| P154 | Staged migration and authority canary | R1-R10 | Clean-sheet migration posture and authority-activation proof |
| P155 | Final cutover proof and milestone close | R1-R10 | Full acceptance bars, G10, replay/failure/rollback obligations |

## Chunk A — Baseline proof repairs

### P144 — Chronicle Host-Shell Boundary

- **Type:** code/integration
- **Dispatch:** executor; orchestrator consumes evidence only
- **Problem evidence:** The Phase 116 self-test resolves a Windows absolute wrapper path, invokes ambiguous `bash`, and reaches the System32 WSL shim rather than Git Bash. The wrapper never starts, causing `SAC-P116-10`, `SAC-P116-11`, and `STRUCT-P116-22` to fail together. CRLF, a fixed canonical log path, and an unbounded interpreter spawn are contributors.
- **Intended outcome:** One host-aware shell boundary chooses explicit Git Bash on Windows, native Bash on POSIX, or an explicit path-converting WSL adapter; tests write only to a supplied temporary log.
- **Bounded scope:** Shared shell resolver, argv/path conversion, LF policy for the relevant wrapper, log override, classified interpreter/validator timeouts, and focused regression fixtures.
- **Non-goals:** No Chronicle validator-semantic rewrite, no test-specific pass injection, no ambient WSL fallback, and no write to canonical `.planning/metrics/` during self-test.
- **Dependencies:** None.
- **Authority owner:** Host-process boundary owns interpreter selection and invocation. Chronicle validator retains verdict authority; the host adapter cannot convert a failed verdict to pass.
- **Acceptance proof:** Run the full host matrix: System32-first PATH, Git-Bash-first PATH, Windows path with spaces, Git Bash absent, POSIX native Bash, explicit WSL with every argument converted, CRLF regression, interpreter timeout, validator timeout, and temporary logging. The good fixture returns the expected pass; the bad fixture returns its deliberate nonzero verdict; exactly one schema-valid row reaches the temporary log; canonical metrics remain untouched; `SAC-P116-10`, `SAC-P116-11`, and `STRUCT-P116-22` all pass.
- **Rollback/reversibility:** Disable the adapter and retain the prior wrapper only as a read-only diagnostic. A rollback restores the known baseline block; it cannot assert Chronicle success.
- **Linked recommendation ranks:** R4.
- **Linked findings:** Chronicle baseline RCA and proof matrix in the execution-assurance report.

### P145 — Rationale Semantics and Active-Phase Completeness

- **Type:** code/integration
- **Dispatch:** executor
- **Problem evidence:** v3.4 INTENT contains valid folded YAML, but the rationale hand parser retains literal `>-`; P999 is PLAN-only with no CONTEXT/VERIFICATION; the evidence placeholder makes a true empty state unreachable. The focused `SAC-P142-03` correctly exposes the earliest semantic loss.
- **Intended outcome:** Standards-correct rationale parsing produces useful semantic cards or an honest partial/empty state, while phase completeness is resolved before presentation.
- **Bounded scope:** Shared YAML/frontmatter parsing, typed source-health metadata, evidence-reference/card separation, active-phase completeness signal, DTO and client regression fixtures, and one stable focused test command.
- **Non-goals:** No client rule that displays YAML markers, no fabricated rationale, no renderer state mutation, and no promotion of P999 to a legitimate phase.
- **Dependencies:** Independent of P144; both must pass before P147.
- **Authority owner:** Shared parser owns YAML semantics; state resolver owns phase-completeness facts; cockpit remains a read-only projection.
- **Acceptance proof:** Parser fixtures cover `>-`, `>`, `|-`, `|`, quoted, and plain scalars with no raw markers. Actual DTO-to-render tests cover populated, partial-with-explicit-degradation, and true-empty states. A live-shaped P999 fixture is labelled incomplete before rationale rendering. `SAC-P142-03` passes through the published focused command.
- **Rollback/reversibility:** Revert parser/DTO adapters without touching state or source evidence. The prior visible defect returns rather than being hidden.
- **Linked recommendation ranks:** R5.
- **Linked findings:** D03, D10, rationale-card RCA, `SAC-P142-03`.

### P146 — Remote EOL, SSH/tmux, and Browser Topology

- **Type:** integration
- **Dispatch:** executor
- **Problem evidence:** The index/blob is LF while Windows checkout conversion produces CRLF because no EOL attribute overrides `core.autocrlf`; the remote launcher dry-run did not observe SSH; remote tmux is a distinct topology; the sidecar is loopback-only and no tunnel is configured.
- **Intended outcome:** The remote path is an explicitly supported, reproducible topology with LF-safe scripts, observed SSH/tmux persistence and reconnect, an optional secure loopback tunnel, and durable text-only degradation.
- **Bounded scope:** `.sh` EOL contract, remote doctor output, quoting and `ssh -t` invocation, fake-process tmux integration, reconnect, optional `-L` forwarding, and sidecar-down fallback panes.
- **Non-goals:** No merge into the local `sg` topology, no non-loopback cockpit bind, no remote helper writing canonical lifecycle state, and no claim that dry-run proves SSH.
- **Dependencies:** P144 host-policy conventions; P145 is an independent baseline gate.
- **Authority owner:** Remote launcher owns process topology and tunnel setup only. The control plane remains the sole lifecycle writer.
- **Acceptance proof:** In a fresh Windows checkout with `core.autocrlf=true`, shipped shell files remain `w/lf`, pass WSL `bash -n`, and pass doctor. In a fresh native-Linux checkout, Bash/shell checks pass and fake Claude/Codex tmux panes survive disconnect/reconnect. A loopback fixture observes actual `ssh -t` quoting; `/snapshot` is reachable only with explicit forwarding; sidecar failure leaves text panes usable.
- **Rollback/reversibility:** Disable forwarding and retain text-only remote operation. EOL enforcement can be reverted independently, but doing so restores the documented Windows/WSL failure and blocks later remote acceptance.
- **Linked recommendation ranks:** R8.
- **Linked findings:** D12, D13 and the remote proof ledger.

## Chunk B — Shadow and control authority

### P147 — Shadow Typed Run and Authority Spine

- **Type:** integration
- **Dispatch:** executor
- **Problem evidence:** Authority choices are duplicated across orchestration prose, routing, profiles, wrappers, state readers, and evidence writers. Current strong components are not one enforced transaction, and absent live metrics prevent a measured-benefit claim.
- **Intended outcome:** A minimal typed run/unit lifecycle, deterministic transition validator, sole physical shadow journal writer, and read-only projector reproduce current decisions beside the live path without controlling effects or state.
- **Bounded scope:** Versioned command/transition/report envelopes, run/unit aggregate identity, CAS and journal-position separation, idempotency, append receipts/rejections, replay, parity records, and a shadow projection. Reuse existing schemas and mechanisms through adapters where possible.
- **Non-goals:** No live grant, lease, effect, current-state write, route cutover, gate replacement, policy activation, or claimed outcome improvement.
- **Dependencies:** P144-P146 must be green so host, rationale, and remote proof defects cannot contaminate the pilot.
- **Authority owner:** Shadow Transition Kernel may authorize shadow lifecycle events; the shadow Durable Journal is sole physical shadow writer. Neither owns current SGSD authority. Human approval remains mandatory for later activation.
- **Acceptance proof:** Representative interactive, one-unit, autonomous, repair, pause/resume, and blocked scenarios emit shadow decisions linked to the current trace. Replay produces identical aggregate/projector results. Zero-unit, wrong aggregate/control type, stale CAS, duplicate/gapped journal position, crossed lifecycle/recovery authorizer, reused key with changed payload, and factor-provenance fixtures reject with zero mutation. The shadow path has no effect-adapter or current-state credential, and any parity divergence is visible but cannot alter live control flow.
- **Rollback/reversibility:** Disable and remove the shadow adapter/projection; the live path is unchanged. Preserve parity evidence for later analysis.
- **Linked recommendation ranks:** R1.
- **Linked findings:** Skills `Autonomous control plane` and `Planning-intent triage`; E03-E05, E11, E15; F1, F2, F5; D01, D04; clean-sheet §§5, 17-18.

### P148 — Transactional State, Checkpoint, and Watchdog Authority

- **Type:** code/integration
- **Dispatch:** executor
- **Problem evidence:** STATE, resolver, sidecar, watchdog, pause/resume, chaos tests, and checkpoint writers use conflicting authority and schemas. Resume deletes before successor evidence, while watchdog can write recovery/checkpoint artifacts and launch a second Claude process.
- **Intended outcome:** One versioned transition/checkpoint record with `open → claimed → acknowledged/closed`, one fenced control-plane owner, an explicit legacy reader/migrator, and a watchdog that reports or proposes unless takeover authority is proven.
- **Bounded scope:** Transition/checkpoint schema and writer, claim/lease fencing, successor receipt, resolver adoption, watchdog proposal/takeover path, startup/MCP/sidecar adapters, and open-checkpoint migration.
- **Non-goals:** No second state writer, no delete-on-read, no inference that P999 is admitted, and no watchdog launch while a healthy owner lease exists.
- **Dependencies:** P147 typed aggregate, replay, and shadow-journal primitives.
- **Authority owner:** Control plane is sole transition/checkpoint writer. Resolver, MCP, cockpit, and watchdog are read-only; watchdog takeover requires the same fenced authority protocol.
- **Acceptance proof:** Pause and watchdog producer fixtures round-trip through resolver, MCP recovery, startup, sidecar, and chaos validation. Kill at five points: before checkpoint commit, after commit, after claim, after dispatch start, and after successor evidence. Simultaneously trigger watchdog staleness with a healthy owner and with an expired owner. Assert exactly one owner and bounded dispatch, no lost `next_unit`, no double launch, and byte-equal scope/freshness across all consumers.
- **Rollback/reversibility:** Retain a bounded old-checkpoint reader/migrator. Disable the new writer before rollback; never restore concurrent checkpoint writers or Claude launches.
- **Linked recommendation ranks:** R3.
- **Linked findings:** D01-D07, D23; CON-001, CON-002, CON-003, CON-005, CON-007.

### P149 — Control Route, Skill Handoffs, and Board Authority

- **Type:** code/integration
- **Dispatch:** executor
- **Problem evidence:** Interactive operation is greet-and-prose; triage stops without mechanical continuation and calls the wrong planner; board skill/CEO/config/registry disagree; decision registry is empty; plan-level parallel config is not enforced.
- **Intended outcome:** One deterministic, versioned `control_route` evaluator emits a typed proposal/continuation; one current-milestone resolver controls plan location; one board registry controls roster; CEO performs synthesis only.
- **Bounded scope:** Route precedence and reason codes, consumed/declined records, current phase/path resolution, diagnostic typed results, board roster/synthesis boundary, and explicit reader/writer concurrency policy.
- **Non-goals:** No automatic operator approval, no direct source mutation, no model-selected authority, no generic planner for SGSD executable work, and no parallel shared-workspace writers.
- **Dependencies:** P147 route envelope and P148 governed mode/checkpoint state.
- **Authority owner:** Control-route policy owns deterministic selection. Board registry owns roster. CEO owns synthesis only. Operator owns approval of ambiguous or consequential routes.
- **Acceptance proof:** Every explicit, governed-continuation, planning, diagnostic, strategic, recovery, stop, direct-execution, and ambiguous utterance fixture maps to exactly one route. Approved continuation consumes the same route ID; decline is terminal and durable. Path B can write only under the active milestone after schema validation. Architect and Contrarian run once; CEO runs once afterward; disabled/config-only members never dispatch. Every concurrency config key is enforced or rejected as stale.
- **Rollback/reversibility:** Feature-gate the evaluator and preserve route records. Compatibility may explain the old prose route, but cannot synthesize approval or use an alternate roster.
- **Linked recommendation ranks:** R1, R2.
- **Linked findings:** Skills preliminary repairs 1-7; triage/planner, deliberate/CEO, roster, parallelism, status, gate-triage, and empty-decisions-registry findings.

## Chunk C — Execution, assurance, and projection

### P150 — Execution Authority and HEAD-Complete Change Accounting

- **Type:** code/integration
- **Dispatch:** executor
- **Problem evidence:** Profiles declare isolation, locks, hooks, review, and file limits, but the generic wrapper writes in the caller checkout. The stronger detached-worktree path is route-only and misses staged/untracked changes. Patch path parsing is not canonical, profile override can weaken authority, and availability routing can transfer delivery to Claude.
- **Intended outcome:** One Execution Authority is the only delivery-Codex launch/apply boundary and atomically binds trusted role/profile policy, typed context, isolated worktree, PLAN-LOCKED, hooks, limits, complete change manifest, host apply, and independent review identity.
- **Bounded scope:** All ten profiles, monotonic trusted overrides, provider-unavailable checkpointing, complete Git accounting, canonical paths, binary materialization, target-tree equivalence, review entry points, trace IDs, and cleanup.
- **Non-goals:** No gate duplication, no Claude delivery fallback, no caller-workspace execution before validated apply, no request-controlled privilege escalation, and no production `--route-only` handoff.
- **Dependencies:** P147 typed transaction, P148 fencing/checkpoints, and P149 command/role route.
- **Authority owner:** Execution Authority alone launches delivery Codex and applies accepted changes. Host Git validator owns materialization proof. Existing reviewer/gate owners remain independent.
- **Acceptance proof:** A production call-site census finds no delivery Codex/wrapper launch outside the authority. Every exact profile has positive and forbidden-root/worktree/lock/hook/review/file-limit tests; untrusted or weaker overrides reject. Staged-only, unstaged, untracked, mixed, binary, rename, copy, delete, quoted-space, traversal, and over-limit cases are represented or rejected. Accepted isolated and target trees are identical; every pre-apply failure leaves target byte-identical; post-apply/pre-evidence failure checkpoints for reconciliation; worktree cleanup is proven.
- **Rollback/reversibility:** Retain only a diagnostic legacy resolver that can emit the old explanation but cannot execute or apply. Provider failure checkpoints rather than restoring an unsafe fallback.
- **Linked recommendation ranks:** R1, R2.
- **Linked findings:** E01-E12, E14-E15; F1-F5.

### P151 — Existing-Gate Repair Lifecycle and Generic Release Closure

- **Type:** code/integration
- **Dispatch:** executor
- **Problem evidence:** Existing gate results affect in-memory branches, but evidence appends are non-transactional and no durable finding-to-repair-to-supersession lifecycle is established. Semantic assurance lacks a core-loop caller, browser UNPROVEN may continue, and milestone close can return success for unsupported/current versions without release readiness.
- **Intended outcome:** Existing gates fire at their current edges and emit durable decision IDs that reconcile repair, supersession, permissible debt, and closure; milestone-close policy is capability/schema-based and fail-closed.
- **Bounded scope:** Decision/repair relation, canonical evidence topology, semantic/browser adapters, normalized MUDA findings, generic closure-policy resolver, legacy version adapters, dry-run closure, and run-closure receipt.
- **Non-goals:** No reimplementation or bypass of ATC, verifier, MUDA, release-readiness, or edge-guard; no inference of pass from missing/unparseable evidence; no halt-level debt conversion.
- **Dependencies:** P148 authoritative state and P150 trace/execution boundary.
- **Authority owner:** Each existing gate retains its verdict owner. Repair lifecycle owns relations only. Release-closure owner consumes existing scorer/gates and may close only after durable evidence.
- **Acceptance proof:** G01, G04, G06-G08 and retained G02, G03, G05, G09 fire exactly once at applicable edges. A non-pass opens a linked repair; independent re-review supersedes it; permissible warn debt is explicit; unresolved halt remains open. Applicable semantic fixtures use real data, browser fixtures distinguish PROVEN/UNPROVEN/BLOCKED, and MUDA forms deduplicate without double firing. Legacy closure fixtures preserve behavior; supported v3.x uses the generic policy; unknown policy, missing scorer/bucket, edge miss, or open halt blocks; dry-run mutates nothing; GREEN plus reconciled evidence alone permits close.
- **Rollback/reversibility:** Dual-read legacy evidence and retain version adapters. Rollback cannot skip a gate or reinterpret a blocker as pass.
- **Linked recommendation ranks:** R2, R6.
- **Linked findings:** G01, G04, G06-G08, G10, D20; KEEP G02, G03, G05, G09.

### P152 — Shared Semantic Projection and Optional VTP Admission

- **Type:** integration
- **Dispatch:** executor
- **Problem evidence:** MCP and cockpit adapter use the shared resolver while browser sidecar, startup, and watchdog reconstruct scope independently. The cockpit-review skill checks ten sections while the adapter freezes twelve, silently omitting `staleness` and `harness_evolution`. Missing metrics can look benign, memory paths are machine-specific, and VTP absence is safe while successful transport is a test shim discarded by context-packet construction.
- **Intended outcome:** One versioned semantic snapshot supplies scope, freshness, conflicts, omissions, evidence health, and recovery refs to every view; a production VTP adapter can admit valid evidence by reference while absence/error remains a supported local-only path.
- **Bounded scope:** Snapshot DTO and adapters, an exact 12-key cockpit-review contract, required-stream manifest/receipt, workspace-relative memory/CMB discovery, MCP/browser/terminal/startup/watchdog projection parity, production VTP transport injection, provenance validation, token/elision rules, and exact packet admission.
- **Non-goals:** No projection write authority, no fabricated zero for missing streams, no machine/user literal paths, no VTP critical-path dependency, and no embedded private evidence when a reference suffices.
- **Dependencies:** P148 shared state, P149 route result, P150 trace identity, and P151 evidence-health receipt.
- **Authority owner:** Shared resolver/projector owns read semantics only. VTP transport is orchestrator-owned; bridge owns validation; context-packet owns admission. Local delivery authority never depends on VTP availability.
- **Acceptance proof:** A contradictory-state matrix produces byte-equal scope/freshness/conflict semantics through resolver, startup greeting, MCP current/recovery, cockpit adapter, browser `/snapshot`, and watchdog. The adapter self-test remains 19/19 and a cockpit-review fixture enumerates exactly the adapter's 12 keys, including `staleness` and `harness_evolution`; omission of either returns degraded/incomplete rather than complete. Missing required streams are explicitly degraded; relocation, changed user/home, and two-worktree fixtures prove path isolation. VTP cases cover absent, timeout/error, healthy-empty, healthy-valid, and invalid/oversize provenance. The first three continue locally with no private content; valid evidence appears by reference in the exact future packet; invalid evidence rejects or elides with reason.
- **Rollback/reversibility:** Retain versioned view adapters. Disable VTP transport to recover the already-supported local-only path; never fall back to invented evidence.
- **Linked recommendation ranks:** R7, R9.
- **Linked findings:** D04, D08-D10, D14, D15, D19, D20; CON-004; skills `Cockpit completeness review` and preliminary repair 6.

## Chunk D — Learning, migration, and close

### P153 — Governed CMB and Harness Learning Admission

- **Type:** integration
- **Dispatch:** executor
- **Problem evidence:** CMB role/type boundaries and individual writers are strong, but the live ledger is absent and browser lineage is static. Harness distillation is not invoked by the runner, apply is route-only, and no evidence shows that learning changed a future dispatch.
- **Intended outcome:** One role-bound evidence transaction produces live lineage and a Learning Admission Controller may evaluate one bounded candidate; no policy influence occurs without protected-surface checks, transfer/ablation evidence, approval where required, and rollback.
- **Bounded scope:** Single append/locking boundary, execution→finding→verdict→recommendation→promotion lineage, completeness status, project-relative projection, distill invocation, frozen evaluation, one-candidate sandbox/canary, attribution, revocation, and prior-policy restoration.
- **Non-goals:** No raw observation promotion, no claim treated as observation, no agent self-approval, no protected oracle/verifier/model/budget mutation, no unbounded self-modification, and no more than one live candidate.
- **Dependencies:** P150 trace/effect evidence, P151 repair/closure relation, and P152 live evidence-health projection.
- **Authority owner:** Specialized producers emit only their permitted CMB types. Evidence validator is independent. Learning controller proposes/evaluates. Policy Catalog and authenticated human mandate own admission and high-risk promotion.
- **Acceptance proof:** A synthetic run contains one valid finding, one refuted critical finding, and one production-mutation recommendation. Assert creator-role schema, parent/ancestor hashes, no claim/observation confusion, real-operator carve-out, revocation/staleness exclusion, append integrity under concurrency, and live projector nodes only. Harness proof includes actual distill invocation, frozen held-out transfer, ablation, critical-regression block, one-candidate ceiling, attribution, approved next-dispatch delta, and rollback to the prior immutable policy.
- **Rollback/reversibility:** Disable policy influence, reactivate the previous immutable policy version, and preserve all negative/inconclusive evidence and candidates.
- **Linked recommendation ranks:** R10.
- **Linked findings:** D16-D22; CON-006.

### P154 — Staged Migration and Authority Canary

- **Type:** integration
- **Dispatch:** executor
- **Problem evidence:** A correct shadow architecture is not activation evidence. Clean-sheet migration requires safety fencing, projection, factor schemas, approval consumption, parity, replay, interruption, and rollback proof before positive authority moves.
- **Intended outcome:** Human-approved stages activate route selection first, then a bounded lease/effect population, then budget/verdict consumption; each stage has an explicit prior-path rollback and never creates dual positive writers.
- **Bounded scope:** Predeclared parity thresholds, activation-prerequisite resolver, independent safety-fence store, exact human stage-approval consumption, one-active-lease enforcement, effect-key idempotency and reconciliation, atomic budget reservation/debit, limited canary population, staged feature gates, last-good revision, recovery continuation, and rollback drill.
- **Non-goals:** No all-at-once cutover, no legacy-path deletion, no learning-policy expansion beyond the P153 canary, and no activation based only on schema/unit tests.
- **Dependencies:** P147-P153 all accepted.
- **Authority owner:** Authenticated operator owns activation. Migration controller validates stage prerequisites. Transition/Execution authorities own only their admitted stage. Safety Fence Service has negative authority only and cannot clear itself unilaterally.
- **Acceptance proof:** Authority activation rejects with each prerequisite absent in turn: safety store, run/unit projector, factor schemas, approval-consumption ledger, parity/replay evidence, failure-injection evidence, or rollback procedure. Before any positive-authority stage, an authenticated human approval must bind the exact stage subject, scope, revision, risk summary, replay key, and consumption limit; model/service issuers plus expired, revoked, superseded, stale-subject, or altered approvals reject. An approval already consumed by a different scoped request rejects; an identical scoped retry returns the prior consumption and never consumes or debits twice. Lease fixtures prove at most one unexpired effect-bearing lease per unit; competing/stale leases reject, expiry or revocation denies further effects, and a new lease waits for effect inventory and reconciliation. Stable effect-key fixtures return the original receipt for an identical action, reject changed payload under the same key, and deny grants when adapter idempotency is unsupported. Budget is reserved before work and debited from signed receipts in the lifecycle commit; insufficient, stale, double-debit, or unreserved requests reject without authority change. Accepted shadow/canary samples meet predeclared parity. Each stage proves no dual writer and an immediate rollback to the recorded last-good revision. Integrity failure fences effects; only exact human-approved continuation genesis plus predecessor/epoch/adapter-acknowledgement proof permits clearance and new grants.
- **Rollback/reversibility:** Revert only the current stage to its recorded prior authority path. Preserve shadow/canary evidence and keep learning influence disabled after any rollback.
- **Linked recommendation ranks:** R1-R10 collectively; no new recommendation rank is created.
- **Linked findings:** Clean-sheet migration posture, targeted authority-activation proof, and all accepted phase findings.

### P155 — Final Cutover Proof and Milestone Close

- **Type:** integration/docs
- **Dispatch:** executor for verification/gates; orchestrator records only accepted state transitions
- **Problem evidence:** Registries and component self-tests cannot prove sustained authority, recovery, remote, evidence, or rollback behavior. Current generic closure can no-op, and measured benefit remains unavailable until the candidate itself emits joined evidence.
- **Intended outcome:** Retire only proven-obsolete authority fallbacks after the accepted canary, run the complete operational and release proof, emit a durable closure receipt, and close only through the existing fail-closed milestone process.
- **Bounded scope:** Production call-site cleanup, compatibility-reader inventory, full failure-injection/chaos matrix, remote reconnect, VTP absence, projection degradation, learning reversion, value/latency trace review, release-readiness dry run, durable close, and historical documentation.
- **Non-goals:** No close on configuration validity alone, no deletion of evidence or migration readers still needed, no unsupported benefit claim, no unresolved halt/debt, and no direct state mutation from this draft.
- **Dependencies:** P154 canary accepted for its declared window and population.
- **Authority owner:** Release-closure owner consumes existing gates/scorer. Authenticated operator approves final cutover. Orchestrator may record close only after durable closure evidence; executors cannot close themselves.
- **Acceptance proof:** End-to-end failure injection covers interruption at every transaction boundary, rollback/compensation failure, provider outage, profile downgrade attempt, evidence-writer failure, journal fence/recovery, remote disconnect/reconnect, VTP absence/error, projection staleness, and learning-policy reversion. Replay and applied-tree equivalence pass; required streams have closure receipts; value views degrade honestly. Release-readiness is GREEN, no halt item is open, edge-guard has no miss, dry-run is non-mutating, and live close writes durable closure evidence before any canonical state transition. A final call-site census shows removed fallbacks have no production consumer.
- **Rollback/reversibility:** Abort close and remain at the last accepted P154 canary stage. Do not delete the prior authority path until the durable close and human cutover decision both succeed.
- **Linked recommendation ranks:** R1-R10 collectively; no new recommendation rank is created.
- **Linked findings:** All milestone acceptance bars, G10, clean-sheet replay/recovery/rollback invariants, and P144-P154 verification evidence.

## Dependency and activation summary

```text
Baseline proof wave
  P144 ──┐
  P145 ──┼──> P147 shadow spine
  P146 ──┘          |
                     v
                  P148 state/checkpoint/watchdog
                     |
                     v
                  P149 control route/board
                     |
                     v
                  P150 Execution Authority
                     |
                     v
                  P151 assurance/closure
                     |
                     v
                  P152 projection/VTP
                     |
                     v
                  P153 learning admission
                     |
                     v
                  P154 staged canary
                     |
                     v
                  P155 cutover/close
```

P144 and P145 are causally independent; P146 consumes the host-boundary conventions from P144. P147 waits for all three because its parity and failure proofs depend on trustworthy local, projection, and remote test boundaries. From P147 onward, serialization is intentional: each phase strengthens the authority/evidence substrate consumed by the next.

## Proposed activation decision and handoff

**Decision:** Approve the candidate for execution handoff, subject to canonical reconciliation and ordinary SGSD artifact promotion. Operator execution approval was received on 2026-07-13.

**Required orchestrator handoff:**

1. Reconcile or explicitly supersede the recorded v3.4/P999 position and the absent v3.4 roadmap without guessing phase completion.
2. Record the resulting milestone/phase authority through existing SGSD planning truth and review mechanisms.
3. Promote this candidate into the standard milestone roadmap and per-phase CONTEXT/RESEARCH/PLAN/VERIFICATION/review artifacts.
4. Confirm P144 is the admitted next phase and only then dispatch its approved plan through the execution fabric.

Until those four steps are complete, this file remains a draft analytical proposal. Neither `.planning/STATE.md` nor an active `ROADMAP.md` was changed by this roadmap-planning task.

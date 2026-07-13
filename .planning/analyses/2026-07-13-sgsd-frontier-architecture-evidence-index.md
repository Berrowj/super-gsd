# SGSD Frontier Architecture Evidence Index

**Census date:** 2026-07-13

**Scope:** Current SGSD control plane, execution fabric, assurance, memory, cockpit, Warp, and recovery sources needed by the approved frontier architecture audit.

**Method:** Repository paths were enumerated with the Task 1 `rg --files` filter, then every included file was checked for existence and inspected at least through its defining contract, frontmatter, registry header, implementation header/public API, or test assertions. Git dates and short hashes below are freshness signals, not proof of runtime use.

## Authority Order

1. `.planning/` current truth and append-only ledgers.
2. Executable scripts/tools and active registries.
3. Tests.
4. Current contracts and operator documentation.
5. Historical planning artifacts.

When sources conflict, the higher authority governs the claim it is competent to establish. Freshness still matters inside an authority tier: a current position field outranks stale narrative, and an absent expected evidence stream cannot prove configured behavior.

## Claim Labels

| Label | Admission rule |
| --- | --- |
| OBSERVED | Current executable source, test, state, or ledger directly supports the claim. |
| CONFIGURED | Active configuration wires the capability, but sampled evidence does not prove use. |
| DOCUMENTED | Current prose asserts the behavior, but matching executable proof was not found. |
| INFERRED | Multiple sources support a reasoned conclusion that is not directly recorded. |
| RECOMMENDED | Proposed future behavior; never represented as present behavior. |

## Census Selection Rule

The census includes every current truth, configuration, operator entrypoint, active wiring surface, implementation boundary, and material test needed to adjudicate the approved audit domains: intent/mode selection, control-plane cognition and skills, Codex execution, assurance/evidence, state/memory/learning, and operation/recovery. A row proves only the claim admitted by its label: configuration and source wiring are not treated as runtime-use evidence.

Redundant copies, generated/session artifacts, synthetic fixture payloads, and historical candidates without a current consumer are deliberately excluded or sampled only for contradiction/provenance. The exclusions below name those boundaries so row count is not mistaken for an unrestricted repository inventory.

## Source Census

| ID | Domain | Path | Source kind | Freshness signal | Authority | Intended claim | Checked |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SRC-001 | Governance | `AGENTS.md` | Contract | Git 2026-05-22 `9ad566f` | Tier 4 | DOCUMENTED: tool-neutral topology, truth locations, gate reuse, optional VTP, and source-mutation rules; milestone wording is contradicted below. | Yes — content |
| SRC-002 | Governance | `WARP.md` | Contract | Git 2026-04-29 `4bbeb78` | Tier 4 | DOCUMENTED: Warp command surface, `sg` topology, workflow entry points, and Warp-specific authority. | Yes — content |
| SRC-003 | Governance | `CLAUDE.md` | Contract | Git 2026-05-13 `1ec54ca` | Tier 4 | DOCUMENTED: Claude-only control-plane duties, triage triggers, auto-loop dispatch ownership, model lock, checkpoint protocol, and exit conditions. | Yes — content |
| SRC-004 | State & Intent | `.planning/STATE.md` | Planning truth | Git 2026-05-30 `4bea7a9`; milestone-status says v3.4 active, status points to P999 pending | Tier 1 | OBSERVED: `STATE.md` contains a v3.4 milestone pointer and a P999-pending status pointer; P999 admission/sequencing legitimacy is unresolved by current milestone artifacts, and internal activity narrative has stale fields noted below. | Yes — content |
| SRC-005 | State & Intent | `.planning/milestones/v3.4/INTENT.md` | Planning truth | Git 2026-05-24 `6fea42f`; `closed_at: null` | Tier 1 | OBSERVED: v3.4 mission, binding cockpit invariants, entry/exit criteria, and current milestone scope. | Yes — content |
| SRC-006 | State & Intent | `.planning/milestones/v3.4/ROADMAP.md` | Absence finding | Absent in 2026-07-13 census | Tier 1 expected | OBSERVED: the canonical per-milestone roadmap named by `AGENTS.md` does not exist for the active milestone. | Yes — absence |
| SRC-007 | Governance | `.planning/ROADMAP.md` | Historical planning | Git 2026-05-22 `9ad566f`; catalog ends at v3.2 | Tier 5 | OBSERVED: top-level roadmap is a shipped-history catalog and still says v3.3 scoping is open, so it cannot establish v3.4 position. | Yes — content |
| SRC-008 | Governance | `.planning/MILESTONES.md` | Historical planning | Git 2026-05-22 `9ad566f` | Tier 5 | OBSERVED: milestone history and prior architectural provenance through v3.2. | Yes — content |
| SRC-009 | State & Intent | `.planning/ORCHESTRATOR-CHECKPOINT.md` | Absence finding | Absent in 2026-07-13 census | Tier 1 expected | OBSERVED: no checkpoint is open in this worktree; this is a valid idle/no-recovery state, not itself a defect. | Yes — absence |
| SRC-010 | Memory & Evidence | `.planning/memory/MEMORY.md` | Memory index | Git 2026-05-30 `4bea7a9`; body says generated 2026-04-22 | Tier 1 | OBSERVED: canonical memory root and indexed architecture, error, trajectory, and workflow knowledge; generation-date staleness is measurable. | Yes — content |
| SRC-011 | Memory & Evidence | `.planning/resource-registry/agents.jsonl` | Resource ledger | Git 2026-05-13 `1ec54ca` | Tier 1 | OBSERVED: generated agent inventory records active, disabled, and legacy-disabled resource states and model/tool declarations. | Yes — content |
| SRC-012 | Memory & Evidence | `.planning/metrics/` | Absence finding | Directory absent in 2026-07-13 clean-worktree census | Tier 1 expected | OBSERVED: live token, Codex, route, gate, MUDA, edge-guard, and watchdog ledgers cannot be sampled here; configured emit paths are not runtime-use proof. | Yes — absence |
| SRC-013 | Skills & Routing | `.agents/skills/sgsd-warp-operator/SKILL.md` | Skill | Git 2026-04-29 `a2141fe` | Tier 2 | CONFIGURED: read-only Warp daily-start, autonomous, recovery, and off-machine operating composition. | Yes — content |
| SRC-014 | Skills & Routing | `.agents/skills/sgsd-token-triage/SKILL.md` | Skill | Git 2026-04-29 `a2141fe` | Tier 2 | CONFIGURED: token-spend grouping and anomaly triage against budgets. | Yes — content |
| SRC-015 | Skills & Routing | `.agents/skills/sgsd-status-brief/SKILL.md` | Skill | Git 2026-04-29 `a2141fe` | Tier 2 | CONFIGURED: five-line status composition from read-only MCP queries. | Yes — content |
| SRC-016 | Skills & Routing | `.agents/skills/sgsd-roadmap-planner/SKILL.md` | Skill | Git 2026-04-29 `a2141fe` | Tier 2 | CONFIGURED: high-level goals become draft phase candidates under `.planning/analyses/` without activating state. | Yes — content |
| SRC-017 | Skills & Routing | `.agents/skills/sgsd-release-check/SKILL.md` | Skill | Git 2026-04-29 `a2141fe` | Tier 2 | CONFIGURED: read-only milestone-close dry run and blocker summary. | Yes — content |
| SRC-018 | Skills & Routing | `.agents/skills/sgsd-gate-triage/SKILL.md` | Skill | Git 2026-04-29 `a2141fe` | Tier 2 | CONFIGURED: failed-gate evidence explanation and repair routing without bypass. | Yes — content |
| SRC-019 | Skills & Routing | `.agents/skills/sgsd-cockpit-review/SKILL.md` | Skill | Git 2026-04-29 `a2141fe` | Tier 2 | CONFIGURED: cockpit snapshot completeness and degraded-section review. | Yes — content |
| SRC-020 | Skills & Routing | `super-gsd/skills/sgsd-orchestrate/SKILL.md` | Skill | Git 2026-05-13 `1ec54ca` | Tier 2 | CONFIGURED: autonomous Claude control plane hard-routes research, planning, execution, verification, and gates to Codex GPT-5.5 xhigh. | Yes — content |
| SRC-021 | Skills & Routing | `super-gsd/skills/sgsd-triage/SKILL.md` | Skill | Git 2026-05-13 `1ec54ca` | Tier 2 | CONFIGURED: planning-language detection routes through brainstorming/planning to deliberate, orchestrate, or MUDA audit. | Yes — content |
| SRC-022 | Skills & Routing | `super-gsd/skills/sgsd-deliberate/SKILL.md` | Skill | Git 2026-04-23 `66fcd5b` | Tier 2 | CONFIGURED: CEO/Board adversarial deliberation produces decision memos. | Yes — content |
| SRC-023 | Skills & Routing | `super-gsd/skills/sgsd-write-plan/SKILL.md` | Skill | Git 2026-05-13 `1ec54ca`; version 1.0.0 | Tier 2 | CONFIGURED: SGSD-native v2 plan authoring and mechanical schema validation. | Yes — content |
| SRC-024 | Skills & Routing | `super-gsd/skills/sgsd-complete-milestone/SKILL.md` | Skill | Git 2026-04-28 `25a7d7e` | Tier 2 | CONFIGURED: idempotent milestone-close audit, summary, and publication-gap workflow. | Yes — content |
| SRC-025 | Skills & Routing | `super-gsd/skills/sgsd-pause/SKILL.md` | Skill | Git 2026-05-13 `1ec54ca` | Tier 2 | CONFIGURED: checkpoint write and autonomous-loop stop. | Yes — content |
| SRC-026 | Skills & Routing | `super-gsd/skills/sgsd-resume/SKILL.md` | Skill | Git 2026-05-13 `1ec54ca` | Tier 2 | CONFIGURED: checkpoint-based context restoration and loop resume. | Yes — content |
| SRC-027 | Skills & Routing | `super-gsd/skills/sgsd-audit/SKILL.md` | Skill | Git 2026-05-20 `614ee9e` | Tier 2 | CONFIGURED: evidence-gated phase audit with semantic acceptance enforcement and remediation artifacts. | Yes — content |
| SRC-028 | Skills & Routing | `super-gsd/skills/sgsd-muda-audit/SKILL.md` | Skill | Git 2026-05-13 `1ec54ca` | Tier 2 | CONFIGURED: phase-close waste probes and anti-pattern curation when size thresholds fire. | Yes — content |
| SRC-029 | Skills & Routing | `super-gsd/skills/sgsd-token-audit/SKILL.md` | Skill | Git 2026-05-13 `1ec54ca` | Tier 2 | CONFIGURED: token inefficiency analysis, context mapping, and milestone-close spend checks. | Yes — content |
| SRC-030 | Skills & Routing | `super-gsd/skills/sgsd-readiness/SKILL.md` | Skill | Git 2026-04-12 `2af26b7` | Tier 2 | CONFIGURED: pre-flight dependency probes and GO/BLOCKED/WILL-BLOCK/DEGRADED-PATH artifact. | Yes — content |
| SRC-031 | Skills & Routing | `super-gsd/skills/sgsd-overwatcher/SKILL.md` | Skill | Git 2026-04-10 `d1e64b5` | Tier 2 | CONFIGURED: planning signal-map scan and collision/dead-end visualization. | Yes — content |
| SRC-032 | Skills & Routing | `super-gsd/skills/sgsd-update/SKILL.md` | Skill | Git 2026-04-20 `6c593ac` | Tier 2 | CONFIGURED: canonical distribution pull and installer rerun, with drift-only check mode. | Yes — content |
| SRC-033 | Skills & Routing | `super-gsd/skills/sgsd-vtp-advise/SKILL.md` | Skill | Git 2026-04-23 `27b7bcb` | Tier 2 | CONFIGURED: optional VTP-grounded service-enrichment advice through the composer boundary. | Yes — content |
| SRC-034 | Skills & Routing | `super-gsd/skills/sgsd-overlay-refresh/SKILL.md` | Skill | Git 2026-04-20 `651cad0` | Tier 2 | CONFIGURED: idempotent Claude overlay refresh with backup and dry run. | Yes — content |
| SRC-035 | Skills & Routing | `super-gsd/skills/sgsd-browser/SKILL.md` | Skill | Git 2026-04-10 `d1e64b5` | Tier 2 | CONFIGURED: browser-driven UI verification and frontend debugging. | Yes — content |
| SRC-036 | Skills & Routing | `super-gsd/skills/sgsd-transition/SKILL.md` | Skill | Git 2026-05-13 `1ec54ca` | Tier 2 | CONFIGURED: one-time GSD 2.0 planning/knowledge import. | Yes — content |
| SRC-037 | Skills & Routing | `super-gsd/skills/sgsd-sepl/SKILL.md` | Skill | Git 2026-04-23 `6bdc798` | Tier 2 | CONFIGURED: operator-gated resource-grain proposal/review loop. | Yes — content |
| SRC-038 | Skills & Routing | `super-gsd/skills/sgsd-distill/SKILL.md` | Skill | Git 2026-05-13 `1ec54ca` | Tier 2 | CONFIGURED: closed-milestone trajectory distillation with typed hallucination gates. | Yes — content |
| SRC-039 | Skills & Routing | `super-gsd/skills/sgsd-memory-migrate/SKILL.md` | Skill | Git 2026-04-20 `2aac245` | Tier 2 | CONFIGURED: one-time consolidation into the canonical `.planning/memory/` taxonomy. | Yes — content |
| SRC-040 | Skills & Routing | `super-gsd/skills/sgsd-backfill/SKILL.md` | Skill | Git 2026-05-13 `1ec54ca` | Tier 2 | CONFIGURED: existing-project planning and memory scaffold backfill. | Yes — content |
| SRC-041 | Registries & Contracts | `super-gsd/registry/agents.yaml` | Registry | Git 2026-05-13 `1ec54ca`; registry 2.0.0 | Tier 2 | CONFIGURED: executor categories, Codex defaults, pick heuristics, contracts, emits, and lifecycle states. | Yes — content |
| SRC-042 | Registries & Contracts | `super-gsd/registry/board-members.yaml` | Registry | Git 2026-05-13 `1ec54ca`; registry 2.2.0 | Tier 2 | CONFIGURED: Opus board roster has architect/contrarian active and several legacy members disabled. | Yes — content |
| SRC-043 | Registries & Contracts | `super-gsd/registry/gates.yaml` | Registry | Git 2026-05-13 `1ec54ca`; registry 2.2.1 | Tier 2 | CONFIGURED: canonical gate enforcement modes, triggers, evidence, and escalation policy. | Yes — content |
| SRC-044 | Registries & Contracts | `super-gsd/registry/decisions.yaml` | Registry | Git 2026-05-22 `503155c`; registry 2.0.0 scaffold | Tier 4 — documented scaffold | OBSERVED: `decision_steps` is empty, `_example_entry` is non-executable schema documentation, and no executable or skill consumer was found in the census. | Yes — content |
| SRC-045 | Registries & Contracts | `super-gsd/registry/handover-contract-v2.yaml` | Registry | Git 2026-05-13 `1ec54ca` | Tier 2 | CONFIGURED: bounded dispatch input/output fields, token/time budgets, evidence, and declared emits. | Yes — content |
| SRC-046 | Registries & Contracts | `super-gsd/registry/command-envelope-v1.yaml` | Registry | Git 2026-04-27 `1e8fe9a`; registry 1.0.1 | Tier 2 | CONFIGURED: shared command-event envelope, emitter migration state, reason codes, and evidence links. | Yes — content |
| SRC-047 | Registries & Contracts | `super-gsd/registry/codex-profiles.yaml` | Registry | Git 2026-05-20 `2736806` | Tier 2 | CONFIGURED: GPT-5.5 profiles bind reasoning, sandbox, worktree, plan-lock, hook, review, and change-limit policy. | Yes — content |
| SRC-048 | Registries & Contracts | `super-gsd/registry/cockpit-sources.yaml` | Registry | Git 2026-05-24 `377c342`; schema 1 | Tier 2 | CONFIGURED: cockpit sections map to state/intent/memory/metrics sources with freshness and death thresholds. | Yes — content |
| SRC-049 | Registries & Contracts | `super-gsd/registry/review-providers.yaml` | Registry | Git 2026-05-12 `34f8e81` | Tier 2 | CONFIGURED: reviewer provider selection, Codex integration, and fallback mechanics. | Yes — content |
| SRC-050 | Registries & Contracts | `super-gsd/registry/hooks.yaml` | Registry | Git 2026-05-12 `384d4e8` | Tier 2 | CONFIGURED: hook discovery and lifecycle declarations for runtime enforcement/telemetry. | Yes — content |
| SRC-051 | Registries & Contracts | `super-gsd/registry/harness-components.yaml` | Registry | Git 2026-05-22 `503155c` | Tier 2 | CONFIGURED: versioned harness components, protected classes, and evolution substrate. | Yes — content |
| SRC-052 | Execution Fabric | `super-gsd/tools/dispatch-router/route.cjs` | Implementation | Git 2026-04-28 `0bbe968` | Tier 2 | OBSERVED: deterministic structural router chooses local, Codex, Claude, or optional VTP and returns explicit fallback reasons. | Yes — content |
| SRC-053 | Execution Fabric | `super-gsd/tools/dispatch-router/routes.yaml` | Configuration | Git 2026-04-28 `e2a71b8`; schema 1 | Tier 2 | CONFIGURED: optional routing override table and selective-VTP timeout/token policy; compiled table remains authoritative. | Yes — content |
| SRC-054 | Execution Fabric | `super-gsd/tools/intent-map/build.cjs` | Implementation | Git 2026-04-27 `c07b266` | Tier 2 | OBSERVED: raw operator language compiles into a closed-vocabulary structured intent before packet construction. | Yes — content |
| SRC-055 | Execution Fabric | `super-gsd/tools/context-packet/build.cjs` | Implementation | Git 2026-04-28 `6ebfb5e` | Tier 2 | OBSERVED: six-role packets enforce role-specific context, authority ordering, critical bypass, and optional VTP enrichment. | Yes — content |
| SRC-056 | Execution Fabric | `super-gsd/scripts/codex-exec.sh` | Implementation | Git 2026-06-24 `eb07d4a` | Tier 2 | OBSERVED: read-only Codex review wrapper enforces OAuth-only use, timeout, report parsing, atomic output, and provenance logging. | Yes — content |
| SRC-057 | Execution Fabric | `super-gsd/scripts/codex-executor.sh` | Implementation | Git 2026-06-24 `eb07d4a` | Tier 2 | OBSERVED: workspace-writing Codex executor wrapper provides bounded invocation, timeout/auth handling, and executor logging. | Yes — content |
| SRC-058 | Execution Fabric | `super-gsd/scripts/codex-patch-executor.sh` | Implementation | Git 2026-05-11 `b72ae8b` | Tier 2 | OBSERVED: bounded read-pack/unified-diff fallback preserves Codex authorship when Windows file reads fail. | Yes — content |
| SRC-059 | Execution Fabric | `super-gsd/tools/codex-pro/profile-resolver.cjs` | Implementation | Git 2026-05-20 `2736806` | Tier 2 | OBSERVED: dispatch context resolves mechanically into registry-defined Codex profiles. | Yes — content |
| SRC-060 | Execution Fabric | `super-gsd/tools/codex-pro/native-review-runner.cjs` | Implementation | Git 2026-05-20 `2736806` | Tier 2 | OBSERVED: native review lane emits lineaged review-finding memory records. | Yes — content |
| SRC-061 | Execution Fabric | `super-gsd/tools/codex-pro/stoplight.cjs` | Implementation | Git 2026-05-20 `2736806` | Tier 2 | OBSERVED: GREEN/AMBER/RED classification maps dispatches to bounded, lab/goal, or board/operator escalation routes. | Yes — content |
| SRC-062 | Assurance & Memory | `super-gsd/scripts/lib/gates-registry.cjs` | Implementation | Git 2026-04-27 `6f1f567` | Tier 2 | OBSERVED: canonical gate loader caches registry rows and evaluates fire predicates/enforcement mode. | Yes — content |
| SRC-063 | Assurance & Memory | `super-gsd/scripts/lib/edge-guard.cjs` | Implementation | Git 2026-04-22 `0216e65` | Tier 2 | OBSERVED: step-transition guard detects missing declared emits and logs or halts according to registry policy. | Yes — content |
| SRC-064 | Assurance & Memory | `super-gsd/tools/phase-verifier/phase-verifier.mjs` | Implementation | Git 2026-04-11 `32c4b8a` | Tier 2 | OBSERVED: browser verifier checks repository-local screenshot/HAR/console/API evidence existence and shape, then returns PROVEN/UNPROVEN/BLOCKED; it does not mechanically verify Git tracking. | Yes — content |
| SRC-065 | Assurance & Memory | `super-gsd/scripts/lib/gate-value-log.cjs` | Implementation | Git 2026-04-27 `e760a30` | Tier 2 | OBSERVED: append-only gate-value writer normalizes phase ATC, dispatch ATC, and MUDA outcomes into envelope rows. | Yes — content |
| SRC-066 | Assurance & Memory | `super-gsd/tools/memory-governance/lifecycle.cjs` | Implementation | Git 2026-04-28 `deac02a` | Tier 2 | OBSERVED: deterministic admission, promotion, demotion, revocation, revalidation, and complaint processing govern durable memory. | Yes — content |
| SRC-067 | Assurance & Memory | `super-gsd/tools/mesh-memory/lineage.cjs` | Implementation | Git 2026-05-20 `614ee9e` | Tier 2 | OBSERVED: typed cognitive-memory records can be traversed through parent lineage with bounded depth. | Yes — content |
| SRC-068 | Assurance & Memory | `super-gsd/tools/mesh-memory/evidence-validator.cjs` | Implementation | Git 2026-05-20 `614ee9e` | Tier 2 | OBSERVED: evidence validation assigns closed critical statuses and writes lineaged CMB evidence. | Yes — content |
| SRC-069 | Observability & Recovery | `super-gsd/tools/cockpit-state/adapter.cjs` | Implementation | Git 2026-04-30 `7b47b6d` | Tier 2 | OBSERVED: read-only adapter defines and self-tests a 12-section snapshot from live events, ledgers, and `STATE.md`, with explicit degraded sections. | Yes — content |
| SRC-070 | Observability & Recovery | `super-gsd/tools/cockpit-sidecar/cockpit-sidecar.cjs` | Implementation | Git 2026-05-30 `4bea7a9` | Tier 2 | OBSERVED: sidecar composes pipeline, rationale, fog, north-star, alerts, chronicle, Codex, and token sources for cockpit rendering. | Yes — content |
| SRC-071 | Observability & Recovery | `super-gsd/tools/warp-mcp/server.cjs` | Implementation | Git 2026-05-22 `503155c`; 15 frozen tools | Tier 2 | OBSERVED: read-only JSON-RPC MCP exposes state, phase, milestone, watchdog, gates, Codex, cockpit, recovery, and related status tools with degraded envelopes. | Yes — content |
| SRC-072 | Observability & Recovery | `super-gsd/tools/warp-mcp-actions/server.cjs` | Implementation | Git 2026-04-29 `95217e5`; 3 tools | Tier 2 | OBSERVED: separate write-capable MCP uses approval tiers, default deny, denied-forever actions, and audit logging. | Yes — content |
| SRC-073 | Observability & Recovery | `super-gsd/tools/autopilot-watchdog/check.cjs` | Implementation | Git 2026-05-13 `8879557`; watchdog v1 | Tier 2 | OBSERVED: external liveness detector inspects durable progress and can write status/recovery artifacts on staleness. | Yes — content |
| SRC-074 | Observability & Recovery | `super-gsd/scripts/sgsd-boot.ps1` | Implementation | Git 2026-05-30 `4bea7a9` | Tier 2 | OBSERVED: Windows cockpit/preflight launcher exposes Claude greet/go, watchdog, and no-open switches; wrapper topology must be read with `sg` contracts. | Yes — content |
| SRC-075 | Observability & Recovery | `super-gsd/scripts/sgsd-remote-tmux.sh` | Implementation | Git 2026-05-30 `4bea7a9` | Tier 2 | OBSERVED: SSH launcher creates or reuses a named tmux session with greet/go/shell/attach/reset/doctor modes. | Yes — content |
| SRC-076 | Observability & Recovery | `super-gsd/workflows/orchestrate-loop.md` | Workflow | Git 2026-05-13 `1ec54ca` | Tier 2 | CONFIGURED: canonical auto, next, status, cold-start, checkpoint, and loop sequencing referenced by orchestrate. | Yes — content |
| SRC-077 | Observability & Recovery | `.warp/workflows/sgsd-start.yaml` | Workflow | Git 2026-05-22 `503155c` | Tier 2 | CONFIGURED: Warp start invokes `sg` so cockpit separates while Claude stays in the current tab. | Yes — content |
| SRC-078 | Observability & Recovery | `.warp/workflows/sgsd-auto.yaml` | Workflow | Git 2026-05-22 `503155c` | Tier 2 | CONFIGURED: Warp autonomous entry invokes `sg -Go`. | Yes — content |
| SRC-079 | Observability & Recovery | `.warp/workflows/sgsd-recovery-packet.yaml` | Workflow | Git 2026-05-22 `503155c` | Tier 2 | CONFIGURED: recovery prints the checkpoint when present and otherwise falls back to `STATE.md` frontmatter. | Yes — content |
| SRC-080 | Architecture Tests | `super-gsd/tools/intent-map/build.test.cjs` | Test | Git 2026-04-27 `c07b266` | Tier 3 | OBSERVED: executable tests cover valid structured intent, planner routing, and operator/source-text separation. | Yes — content |
| SRC-081 | Architecture Tests | `super-gsd/tools/context-packet/build.test.cjs` | Test | Git 2026-04-27 `fb84ec0` | Tier 3 | OBSERVED: executable tests cover six frozen role modes, reason vocabulary, and packet policy structure. | Yes — content |
| SRC-082 | Architecture Tests | `super-gsd/tools/codex-pro/run-self-test.cjs` | Test | Git 2026-05-20 `2736806` | Tier 3 | OBSERVED: integrated test harness binds profiles, stoplight, native review, registry, and their evidence paths. | Yes — content |
| SRC-083 | Architecture Tests | `super-gsd/tools/codex-hooks/run-self-test.cjs` | Test | Git 2026-05-20 `e6a297e` | Tier 3 | OBSERVED: hook tests cover secret blocking, write boundaries, allowed files, tool-event logging, and stop-contract validation. | Yes — content |
| SRC-084 | Architecture Tests | `super-gsd/tools/mesh-memory/run-self-test.cjs` | Test | Git 2026-05-20 `c4a211a` | Tier 3 | OBSERVED: mesh-memory harness covers schema, lineage, evidence, escalation, and pseudo-operator behavior. | Yes — content |
| SRC-085 | Architecture Tests | `super-gsd/tools/cockpit-sidecar/run-self-test.cjs` | Test | Git 2026-05-30 `4bea7a9` | Tier 3 | OBSERVED: cockpit test harness covers stage pipeline, rationale, copy lints, north star, alerts, and design conformance. | Yes — content |
| SRC-086 | Architecture Tests | `super-gsd/tools/warp-mcp/run-self-test.cjs` | Test | Git 2026-04-29 `49091ea` | Tier 3 | OBSERVED: thin harness executes the read-only MCP server's registered-tool and degraded-envelope suite. | Yes — content |
| SRC-087 | Architecture Tests | `super-gsd/tools/scenario-suite/run-self-test.cjs` | Test | Git 2026-04-29 `3ecdf26` | Tier 3 | OBSERVED: self-test plus ten end-to-end scenarios exercise milestone-close failure/recovery behavior. | Yes — content |
| SRC-088 | Architecture Tests | `super-gsd/tools/failure-injection/run-self-test.cjs` | Test | Git 2026-04-29 `ef95a33` | Tier 3 | OBSERVED: failure-injection bootstrap and ten scenarios test degraded/failure contracts before release close. | Yes — content |
| SRC-089 | Architecture Tests | `super-gsd/scripts/lib/sgsd-complete-milestone-self-test.cjs` | Test | Git 2026-04-29 `41382ec` | Tier 3 | OBSERVED: close-gate tests cover unresolved-debt blocking, clean pass, and backward compatibility. | Yes — content |
| SRC-090 | Architecture Tests | `super-gsd/scripts/lib/board-registry.test.cjs` | Test | Git 2026-05-13 `1ec54ca` | Tier 3 | OBSERVED: board resolution tests exclude disabled/default and escalation members according to registry state. | Yes — content |
| SRC-091 | Architecture Tests | `super-gsd/scripts/lib/codex-sdd-contract.test.cjs` | Test | Git 2026-05-13 `1ec54ca` | Tier 3 | OBSERVED: cross-file contract test asserts Codex ownership, fresh implementer/spec review, and no parallel file writers. | Yes — content |
| SRC-092 | Architecture Tests | `super-gsd/scripts/lib/gate-value-log.test.cjs` | Test | Git 2026-04-27 `e760a30` | Tier 3 | OBSERVED: production writer is exercised for pass/warn/block/skip without touching the canonical ledger. | Yes — content |
| SRC-093 | Memory & Evidence | `.planning/mesh/memory/cmbs.jsonl` | Absence finding | Absent in 2026-07-13 census | Tier 1 expected | OBSERVED: the canonical CMB ledger named by `super-gsd/docs/ARCHITECTURE.md` and `.planning/MILESTONES.md` is absent, so live typed-memory lineage and evidence cannot be sampled. | Yes — absence |
| SRC-094 | Registries & Contracts | `.planning/config.json` | Configuration | Git 2026-05-22 `503155c`; schema v1 | Tier 1 | CONFIGURED: active project configuration selects Opus orchestration and Codex research/planning/execution/review, enables browser and VTP/knowledge gates, disables review fallback, enables handoff, and sets `parallelization.enabled: true` with plan-level concurrency up to 3 and skipped checkpoints; compare with serial orchestrator contracts before claiming effective behavior. | Yes — content |
| SRC-095 | Execution Fabric | `.codex/hooks.json` | Configuration | Git 2026-05-20 `e6a297e` | Tier 2 | CONFIGURED: Codex lifecycle events are wired to five repository hook implementations; this proves declared wiring, not invocation. | Yes — content |
| SRC-096 | Execution Fabric | `super-gsd/tools/codex-hooks/block-secret-leak.cjs` | Implementation | Git 2026-05-20 `e6a297e` | Tier 2 | OBSERVED: UserPromptSubmit hook pattern-checks prompts for credential/private-key leakage, blocks invalid or matched input, and emits a decision row. | Yes — content |
| SRC-097 | Execution Fabric | `super-gsd/tools/codex-hooks/block-forbidden-write.cjs` | Implementation | Git 2026-05-20 `e6a297e` | Tier 2 | OBSERVED: PreToolUse hook rejects ambiguous write targets and baseline forbidden repository paths while allowing non-write tools. | Yes — content |
| SRC-098 | Execution Fabric | `super-gsd/tools/codex-hooks/enforce-allowed-files.cjs` | Implementation | Git 2026-05-20 `e6a297e` | Tier 2 | OBSERVED: PreToolUse hook resolves the active PLAN-LOCKED artifact and blocks write targets outside its `allowed_files` boundary. | Yes — content |
| SRC-099 | Execution Fabric | `super-gsd/tools/codex-hooks/log-tool-event.cjs` | Implementation | Git 2026-05-20 `e6a297e` | Tier 2 | OBSERVED: PostToolUse hook redacts sensitive argument keys and appends a normalized tool-event observability row. | Yes — content |
| SRC-100 | Execution Fabric | `super-gsd/tools/codex-hooks/validate-stop-contract.cjs` | Implementation | Git 2026-05-20 `e6a297e` | Tier 2 | OBSERVED: Stop hook blocks completion when the report is absent, checkpoint is not updated, or acceptance commands are not reported. | Yes — content |
| SRC-101 | Observability & Recovery | `super-gsd/scripts/Install-SgsdShortcut.ps1` | Implementation | Git 2026-05-13 `1ec54ca` | Tier 2 | OBSERVED: shortcut installer writes the real PowerShell `sg` entrypoint: cockpit boots through `sgsd`, then Claude runs in the current terminal with greet/go and `--dangerously-skip-permissions`; source existence does not prove the profile is installed. | Yes — content |
| SRC-102 | Assurance & Memory | `super-gsd/tools/context-authority/context-composer.cjs` | Implementation | Git 2026-05-21 `4fdb738` | Tier 2 | OBSERVED: composer reads six milestone context capsules and delegates each projection to the context-anchor writer. | Yes — content |
| SRC-103 | Assurance & Memory | `super-gsd/tools/context-authority/context-anchor-writer.cjs` | Implementation | Git 2026-05-21 `4fdb738` | Tier 2 | OBSERVED: writer hashes context sources, emits typed context-anchor records to the CMB ledger, and exposes staleness checking. | Yes — content |
| SRC-104 | Assurance & Memory | `super-gsd/tools/context-registry/build.cjs` | Implementation | Git 2026-04-27 `d71e5c2` | Tier 2 | OBSERVED: legal-context builder reads 13 canonical sources and atomically writes normalized, sorted, hashed legal keys. | Yes — content |
| SRC-105 | Assurance & Memory | `super-gsd/tools/context-registry/check.cjs` | Implementation | Git 2026-04-27 `962e286` | Tier 2 | OBSERVED: read-only validator checks packet/capsule references against legal keys and reports invalid, superseded, malformed, or missing-registry references. | Yes — content |
| SRC-106 | Assurance & Memory | `super-gsd/tools/harness-evolution/run.cjs` | Implementation | Git 2026-04-30 `be6932c` | Tier 2 | OBSERVED: harness runner composes catalog, evidence distillation, prediction manifest, and attribution modules across dry-run/proposal/apply/attribute modes with protected-surface checks. | Yes — content |
| SRC-107 | Assurance & Memory | `super-gsd/tools/harness-components/catalog.cjs` | Implementation | Git 2026-04-30 `bbd3aa6` | Tier 2 | OBSERVED: component catalog reads the harness registry, validates a closed class vocabulary, and identifies protected oracle/verifier/model-config surfaces. | Yes — content |
| SRC-108 | Assurance & Memory | `super-gsd/tools/harness-evidence/distill.cjs` | Implementation | Git 2026-04-30 `227531d` | Tier 2 | OBSERVED: deterministic distiller reads seven evidence-log classes plus optional benchmark artifacts and writes a layered per-run evidence corpus. | Yes — content |
| SRC-109 | Assurance & Memory | `super-gsd/tools/harness-manifest/manifest.cjs` | Implementation | Git 2026-04-30 `ff99913` | Tier 2 | OBSERVED: manifest module validates and appends falsifiable component-change predictions, regression risks, expected deltas, and rollback method. | Yes — content |
| SRC-110 | Assurance & Memory | `super-gsd/tools/harness-attribution/attribute.cjs` | Implementation | Git 2026-04-30 `082b863` | Tier 2 | OBSERVED: attribution module compares predicted fixes/regressions with next-run evidence and returns keep/revert/quarantine/pivot/inconclusive/environmental-skip verdicts. | Yes — content |

## Contradictions

| ID | Claim A | Source A | Claim B | Source B | Authority decision | Audit consequence |
| --- | --- | --- | --- | --- | --- | --- |
| CON-001 | “Current/latest milestone” is v3.2 shipped and v3.3 scoping is open. | `AGENTS.md` | `STATE.md` carries v3.4 milestone and P999-pending pointers. | `.planning/STATE.md` | Tier-1 `STATE.md` governs the recorded pointers; retain the root-contract statement as stale governance evidence without assuming P999 was legitimately admitted. | Every operator/agent entry path must be checked for stale milestone priming; amendment roadmap should include contract-state drift prevention. |
| CON-002 | The top-level roadmap ends its current list at v3.2 and says v3.3 scoping is open. | `.planning/ROADMAP.md` | Runtime position and active intent identify v3.4. | `.planning/STATE.md`; `.planning/milestones/v3.4/INTENT.md` | Current state and milestone intent outrank the historical catalog. | Do not derive v3.4 next-unit sequencing from the top-level roadmap; label any reconstruction from phase artifacts as inferred. |
| CON-003 | Active milestones have a canonical `.planning/milestones/{milestone}/ROADMAP.md`. | `AGENTS.md` | `.planning/milestones/v3.4/ROADMAP.md` is absent. | 2026-07-13 path census | The checked absence is authoritative for coverage; no substitute path is silently promoted. | Phase order, completion, and dependency claims for v3.4 have a primary-source gap that the audit must surface. |
| CON-004 | Token, Codex, route, gate, MUDA, edge-guard, and cockpit evidence is stored in `.planning/metrics/*.jsonl`. | `AGENTS.md`; registry emitter paths | `.planning/metrics/` is absent in this clean worktree. | 2026-07-13 path census | Configured emit paths prove design, not executions; no runtime-use claim is admitted without ledger rows. | Capability utilisation, cost, firing frequency, and recent-use findings must be marked CONFIGURED/DOCUMENTED or explicitly unavailable. |
| CON-005 | Current position fields identify milestone v3.4 and status P999 pending. | `.planning/STATE.md` `milestone`, `milestone_status`, `status` | `last_activity` still narrates v3.0 activation and `last_updated` is 2026-05-20. | `.planning/STATE.md` `last_activity`, `last_updated` | Position fields plus v3.4 intent govern current location; activity/freshness fields are stale evidence inside the canonical file. | Cockpit, recovery, and status consumers must be audited for which state fields they trust and how they expose internal staleness. |
| CON-006 | Mesh Memory Lite's canonical durable ledger is `.planning/mesh/memory/cmbs.jsonl`. | `super-gsd/docs/ARCHITECTURE.md`; `.planning/MILESTONES.md` | The CMB ledger path is absent in this worktree. | 2026-07-13 path census | The checked Tier-1 absence governs evidence availability; documentation and implementations establish the expected path, not live CMB rows. | Typed-memory use, lineage quality, echo detection, and evidence-validation activity cannot be labelled OBSERVED from this checkout. |
| CON-007 | `milestone_status` says the v3.4 loop is about to scaffold P142 and P143; v3.4 intent admits only P136–P143. | `.planning/STATE.md` `milestone_status`; `.planning/milestones/v3.4/INTENT.md` `phase_list` | `status` points to P999 PENDING, while the canonical v3.4 roadmap is absent. | `.planning/STATE.md` `status`; 2026-07-13 path census | `STATE.status` proves the P999 pointer exists, but same-tier admission and sequencing authority is unresolved; do not label P999 an uncomplicated current/active phase. | Audit next-unit selection, cockpit projection, and recovery consumers for invalid or synthetic phase-pointer handling and require typed admission validation. |

## Explicit Exclusions

| Path or class | Reason excluded |
| --- | --- |
| `**/node_modules/**` | Generated dependency caches are reproducible installation products, not SGSD architecture authority. |
| `**/fixtures/**` | Synthetic fixture payloads do not prove live operation; their material executable harnesses are included instead. |
| `**/*.tmp` and temporary/partial-write artifacts | Ephemeral write intermediates can be incomplete and must not be promoted into evidence. |
| `.planning/milestones/v3.4/design-pack/uploads/**` | Uploaded design duplicates and pasted assets are staging inputs; canonical active implementations/registries and root design documents take precedence. |
| `super-gsd/source/**` | Duplicate distribution/source copy was excluded to avoid double-counting; the active `super-gsd/` tree is the executable authority in this worktree. |
| `.planning/runtime/**` | Generated PIDs, rendered cockpit snapshots, and local smoke outputs are machine/session caches; they are neither durable planning truth nor sampled live ledgers. |
| Historical phase artifacts not referenced by a current consumer | Historical planning is retained for provenance but is not treated as current topology merely because it exists. Selected milestone history remains indexed through SRC-007 and SRC-008. |

## Coverage Totals

### By domain

| Domain | Rows |
| --- | ---: |
| Governance | 5 |
| State & Intent | 4 |
| Memory & Evidence | 4 |
| Skills & Routing | 28 |
| Registries & Contracts | 12 |
| Execution Fabric | 16 |
| Assurance & Memory | 16 |
| Observability & Recovery | 12 |
| Architecture Tests | 13 |
| **Total** | **110** |

### By source kind

| Source kind | Rows |
| --- | ---: |
| Contract | 3 |
| Planning truth | 2 |
| Absence finding | 4 |
| Historical planning | 2 |
| Memory index | 1 |
| Resource ledger | 1 |
| Skill | 28 |
| Registry | 11 |
| Implementation | 38 |
| Configuration | 3 |
| Workflow | 4 |
| Test | 13 |
| **Total** | **110** |

### By authority and check status

| Measure | Rows |
| --- | ---: |
| Tier 1 current/expected `.planning/` truth | 9 |
| Tier 2 executable source, active registry, skill, configuration, or workflow | 82 |
| Tier 3 tests | 13 |
| Tier 4 current contracts/operator docs and documented scaffold | 4 |
| Tier 5 historical planning | 2 |
| Existing sources checked for defining content | 106 |
| Expected sources checked and confirmed absent | 4 |
| **Total census rows** | **110** |

### Findings count

| Finding class | Count | IDs |
| --- | ---: | --- |
| Confirmed absences | 4 | SRC-006, SRC-009, SRC-012, SRC-093 |
| Registered contradictions | 7 | CON-001 through CON-007 |
| Material skill entries indexed | 28 | SRC-013 through SRC-040 |
| Material architecture test surfaces indexed | 13 | SRC-080 through SRC-092 |
| Active wiring, context, entrypoint, and harness boundary rows added | 17 | SRC-094 through SRC-110 |

The census establishes architecture coverage, not runtime utilisation. Because the live metrics directory and canonical CMB ledger are absent, later audit lanes must not convert configuration, prose, or test coverage into claims of recent execution or typed-memory activity.

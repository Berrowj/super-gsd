# VTP-grounded SGSD process audit

Date: 2026-04-24

## Scope

This audit covers the SGSD process surfaces that currently shape agent work:

- ATC gates: per-dispatch ATC and phase-level ATC
- MUDA gates: probe, audit, recurrence, and WASTE artifacts
- verifier and challenger flow
- classifier and context selector gates
- token/offload telemetry
- VTP enrichment gates planned for v1.5 Phase 21
- deliberation board and researcher extension
- curation and memory promotion
- edge-guard and process instrumentation

The review used local SGSD code and planning artifacts, plus VTP evidence from enriched research and book corpus. Key VTP sources included Shift Up, Why LLMs Aren't Scientists Yet, HCC, Experience Compression Spectrum, TACO, Thought Retriever, Think Just Enough, Sequential Edge, Skill-RAG, Diversity Collapse in Multi-Agent Systems, Security of Long-Term Memory Agents, Stateless Decision Memory, Gated Coordination, Architecture Matters More Than Scale, A Philosophy of Software Design, Fundamentals of Software Architecture, Agile Software Development, and Clean Architecture.

## Executive finding

SGSD already has the right high-level process shape: small agents, explicit gates, append-only artifacts, verifier pressure, MUDA pressure, token pressure, and phase-level governance. The main weakness is not a lack of gates. The main weakness is that several gates are not yet fully load-bearing: some signals are produced but not consumed, some critical findings are logged but allowed to pass, some telemetry misses early exits, and some planned enrichment could become expensive ritual unless it is thresholded.

The highest-value change is to make existing gates mechanically complete and measurable before adding broad new process.

## Findings

### 1. MUDA produces five probes but downstream audit consumes three

Local evidence:

- `super-gsd/scripts/sgsd-muda-probe.sh` emits `haiku_fails`, `narrative_age_sec`, `git_spawn_pct`, `extra_processing`, and `inventory`.
- `super-gsd/scripts/sgsd-muda-audit.sh` parses only `haiku_fails`, `narrative_age_sec`, and `git_spawn_pct`.
- `super-gsd/scripts/sgsd-muda-recurrence.sh` classifies only `defects`, `waiting`, and `motion`.
- `super-gsd/skills/sgsd-muda-audit/SKILL.md` still says three watchdogs are wired.
- Live probe result on this workspace: `inventory` failed with 49 stale phase files, while the other four probes passed.

Why it matters:

The process can detect inventory waste and then silently drop it before recurrence, WASTE summarisation, and phase governance. This violates the Shift Up and WLS pattern: executable guardrails only matter when their outputs are consumed by the next stage.

Recommendation:

- Treat MUDAC-01 through MUDAC-04 as a P0 fix before expanding MUDA scope.
- Parse probe rows dynamically rather than hard-coding three probe names.
- Add `extra_processing` and `inventory` to recurrence classes.
- Fix the commit-review path used by `extra_processing`; the current root-level `.planning/metrics/commit-reviews.jsonl` lookup misses nested phase commit review logs.
- Recalibrate `inventory`; the current signal is a blunt stale-file count, not a proven unreferenced-artifact count.
- Update the MUDA skill text once the five-probe contract is actually wired.

### 2. VTP enrichment telemetry misses early failure modes

Local evidence:

- `super-gsd/scripts/lib/vtp-context-composer.cjs` logs successful VTP calls and caught MCP invocation failures.
- It returns early for `query_too_short` and `no_mcp_invoke` without writing a routing log row.

Why it matters:

Phase 21 depends on knowing whether VTP enrichment was useful, empty, disabled, noisy, or broken. Missing preflight telemetry makes it impossible to distinguish "VTP found nothing" from "VTP was never called." WLS and Stateless Decision Memory both point to append-only event logs as the source of truth, not summary claims.

Recommendation:

- Log every VTP enrichment exit path.
- Use explicit statuses: `success`, `zero_hits`, `query_rejected`, `mcp_unavailable`, `mcp_error`, `disabled`, `timeout`.
- Preserve empty-hit artifacts. A well-formed zero-hit result is still evidence.

### 3. Critical ATC findings can be bypassed in auto mode

Local evidence:

- The SGSD orchestration skill records `GATE_AUTO_BYPASS` for critical ATC findings in auto mode and continues.

Why it matters:

This is useful for throughput but weak for integrity. WLS warns that final success can mask internal breakdown, and Clean Architecture frames test and quality gates as system components, not advisory notes. A critical ATC issue should change the execution path.

Recommendation:

- Allow WARN findings to continue in auto mode.
- Require CRITICAL findings to produce one of: gap-plan, replan, explicit user checkpoint, or phase block.
- If bypass is intentionally allowed, require a deviation entry with owner, reason, follow-up, and expiry.

### 4. Phase 21 VTP enrichment should be thresholded, not ritualised

Local evidence:

- The Phase 21 design correctly limits tools and queries.
- The current locked shape risks treating up to five queries as a fixed ceremony rather than a diagnostic enrichment pass.

VTP evidence:

- Think Just Enough: spend compute where uncertainty is.
- HCC: retrieval should be threshold-based, not fixed top-k.
- Skill-RAG: diagnose the failure before retrying.
- Architecture Matters More Than Scale: route by cheap structural signals before expensive model work.

Recommendation:

- Keep the five-tool priority cascade, but make continuation conditional on hit quality and task uncertainty.
- Stop early when evidence is strong enough or clearly irrelevant.
- Emit a compact `VTP-ENRICHMENT.md` artifact with query, tool, hit quality, accepted/rejected evidence, and reason.
- Classify failures as `zero_hits`, `low_relevance`, `contradictory`, `tool_error`, or `not_applicable`.

### 5. A board researcher must be decoupled from the board, not added as a fully connected fifth voice

Local evidence:

- The deliberation board currently has architect, pragmatist, contrarian, and moonshot roles.
- v1.5 proposes a researcher role backed by VTP.

VTP evidence:

- Diversity Collapse in Multi-Agent Systems: dense communication and authority-like signals can collapse independent reasoning.
- Gated Coordination: private execution and public coordination state should be separated.
- Superficial Success vs Internal Breakdown: role labels matter only if behavior actually diverges.

Recommendation:

- Add a researcher as an evidence brief generator, not as a normal persuasive board member.
- Run researcher before board debate, or blind it from other board positions.
- Require source-backed claims only; no synthesis without citation.
- Measure role distinctness by tracking repeated claims and convergence before evidence is introduced.

### 6. Memory curation needs lifecycle governance, not just accumulation

Local evidence:

- SGSD has curation and recall mechanisms, but the current process does not clearly enforce promotion, demotion, expiry, duplicate rejection, poison resistance, and usage-based pruning as one lifecycle.

VTP evidence:

- Experience Compression Spectrum: memory, skills, and rules live on a compression spectrum and need promotion/demotion governance.
- Thought Retriever: store validated thoughts and reject redundant growth.
- Security of Long-Term Memory Agents: memory writes are privileged state transitions; compression can amplify poisoned content.
- HCC: dead-end labeling and phase-boundary promotion are as important as retrieval.

Recommendation:

- Require each promoted memory to include provenance, confidence, usage count, last-used date, expiry/deprecation rule, and whether it is a dead end.
- Reject memory writes that are not novel compared with existing entries.
- Demote or archive memories that are unused or contradicted.
- Treat memory writes from failed phases as suspect until validated.

### 7. Edge-guard exists but is not yet a process fitness ledger

Local evidence:

- `super-gsd/scripts/lib/edge-guard.cjs --self-test` passes.
- v1.5 includes INSTR-01 to wire edge-guard into real runs.

VTP evidence:

- Fundamentals of Software Architecture recommends fitness functions to objectively protect architecture characteristics.
- WLS recommends evaluating raw process artifacts, not relying on final summaries.

Recommendation:

- Use edge-guard as the common ledger for gate fired/skipped decisions.
- Record: gate id, trigger condition, evidence path, verdict, override reason, and downstream action.
- Add a phase-end fitness summary that reports whether each required gate fired, passed, skipped validly, or was bypassed.

### 8. The richer output contract should become mandatory for code-changing dispatches

Local evidence:

- Current contract validation requires summary fields.
- `FINDINGS_DETAIL` is still treated as optional guidance in the prompt path.

VTP evidence:

- Shift Up: executable requirements beat prompt reminders.
- TACO: downstream recovery behavior reveals whether an output was actionable.
- WLS: raw logs and intermediate outputs expose false success.

Recommendation:

- Implement CONTRACT-01 through CONTRACT-03 as written.
- For code-changing tasks, require structured finding detail or an explicit `none` row with reason.
- Validate details mechanically rather than asking the model to comply.

### 9. Sequential and parallel work need different policies

VTP evidence:

- Sequential Edge: sequential refinement beats parallel self-consistency for correctness at matched compute.
- Diversity Collapse: parallel agents can converge when they share too much context.
- Gated Coordination: communication should be a cost-justified action.

Recommendation:

- Use parallelism for disjoint implementation slices, independent evidence gathering, and independent design options.
- Use sequential refinement for correctness work, verifier follow-up, and critical fix loops.
- Preserve blind independent drafting for creative or adversarial review; do not over-share intermediate conclusions.

### 10. SGSD should define process fitness functions per gate

VTP evidence:

- Fundamentals of Software Architecture: governance works best through objective fitness functions.
- A Philosophy of Software Design: complexity accumulates incrementally, so small design investments must be continuous.

Recommendation:

Define a one-line fitness function for each major gate:

- ATC: critical architectural risks cannot silently pass into phase completion.
- MUDA: every emitted waste probe is consumed by audit, recurrence, and WASTE summary.
- Verifier: every failed verifier result creates either a fix, a gap-plan, or a recorded deviation.
- VTP: enrichment records whether evidence was used, rejected, empty, or unavailable.
- Memory: every promoted memory has provenance, confidence, usage, and expiry.
- Board: every role contributes distinct information, or the role is removed or redesigned.
- Token/offload: context growth triggers compression before context failure.

## Prioritised backlog

### P0: make existing gates load-bearing

- Wire all five MUDA probes through audit, recurrence, and WASTE summary.
- Fix `extra_processing` commit-review path detection.
- Recalibrate the inventory probe so it measures true obsolete inventory, not just old files.
- Log all VTP composer early exits.
- Change critical ATC auto-mode bypass into block, replan, checkpoint, or expiring deviation.

### P1: implement v1.5 enrichment safely

- Keep the Phase 21 VTP tool cascade, but add thresholded continuation and explicit failure taxonomy.
- Add researcher as a blind evidence-brief producer, not a fully connected board voice.
- Wire edge-guard into live phase execution and phase-end summaries.
- Make `FINDINGS_DETAIL` mandatory for code-changing dispatches.

### P2: improve process quality without bloat

- Add lifecycle governance to memory curation.
- Add role-distinctness telemetry for the deliberation board.
- Add a process fitness dashboard sourced from append-only edge-guard and metrics logs.
- Add adaptive gate depth based on uncertainty, risk, and recent failure rate.

## Bloat guard

Do not add broad new agents, generic review ceremonies, or always-on VTP calls. The stronger pattern from the VTP corpus is: cheap structural signal first, thresholded escalation second, durable artifact third, lifecycle pruning fourth.

The next SGSD improvement pass should therefore focus on completing and measuring existing gates before adding new ones.

## Verification notes

- VTP MCP health check succeeded after restart.
- `edge-guard.cjs --self-test` passed.
- `vtp-context-composer.cjs --self-test` passed.
- `sgsd-muda-probe.sh .` exited non-zero because `inventory` failed; this is useful evidence and should not be hidden by the three-probe audit path.
- `vtp_research_gate` full pipeline hit a schema-length failure in the VTP tool response; this is a VTP tooling issue, not SGSD evidence. The audit used direct enriched research retrieval instead.

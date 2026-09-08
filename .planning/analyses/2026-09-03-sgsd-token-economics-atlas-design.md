---
type: design-spec
date: 2026-09-03
slug: sgsd-token-economics-atlas
status: draft-pending-written-review
implementation_status: not-started
target_runtime: "DEVCP Linux, /opt/clarity/project-clarity-erp"
baseline_mode: strictly-passive
approvals:
  - "2026-09-03 operator: live DEVCP observation instead of sandbox workload trials"
  - "2026-09-03 operator: strictly passive baseline; no alerts or automatic interventions"
  - "2026-09-03 operator: hybrid native-telemetry plus SGSD-ledger architecture"
  - "2026-09-03 operator: comprehensive token, output, handoff, prompt, ATC, and MUDA coverage"
  - "2026-09-03 operator: reference-first content boundary approved"
  - "2026-09-03 operator: approved consolidation of the presented design into a written spec"
activation: "Requires a dedicated SGSD phase plan before any source mutation"
---

# Design - SGSD Token Economics and Handoff Atlas

## Executive decision

Build a passive, repository-shipped observability sidecar for the real SGSD sessions running on
DEVCP. The sidecar combines Claude Code's native OpenTelemetry events, Claude status-line quota
snapshots, structured Codex events, and SGSD's existing state/gate/dispatch evidence into one
correlated, append-only event model.

The Atlas is not merely a token dashboard. It must answer four questions:

1. Where do Fable, Codex, observers, tools, reports, and gates consume tokens and time?
2. Which prompt and handoff versions lead to accepted work, rework, clarification, or failure?
3. Do ATC, MUDA, and the other gates contribute unique value or duplicate earlier checks?
4. Are detected mistakes repaired, converted into reusable guidance, injected into later relevant
   handoffs, and prevented from recurring?

The first observation period is strictly passive. It cannot change prompts, routing, models,
effort, session boundaries, gates, retries, operator messages, or the `sg`/tmux topology. It cannot
issue alerts or invoke a model. Its only runtime effects are bounded local telemetry collection and
deterministic report generation.

## Why this is needed

The existing evidence cannot reliably explain weekly Fable credit depletion:

- The current worktree has no `token-attribution.jsonl` or `agent-token-spend.jsonl`; a token gate
  can therefore report green from an empty ledger.
- The transcript collector repeats one provider usage object across multiple assistant frames.
  Recent raw totals were inflated by approximately 2.34x until deduplicated by provider request ID.
- In one recent Fable day, 146 genuine API requests represented 50.3 million provider token fields;
  approximately 98.7% were cache reads. The main marathon session's cache footprint was about
  288k at p50 and 481k at p95. These are context-accounting observations, not subscription-credit
  units.
- A Claude session launched from the SGSD worktree later operated on the Clarity repository while
  SGSD hooks continued attributing activity to phase 169. Launch cwd is not workload identity.
- `codex-executor-log.jsonl` is currently invalid JSON on Windows because preview strings do not
  escape backslashes. Other Codex ledgers contain byte estimates rather than provider usage.
- The current `gate-value-log.jsonl` contains only two rows and no observed ATC rows. Existing
  gate reports lack stable finding identity, repair links, and recurrence lineage.

The strongest current hypothesis is that long-lived Fable sessions repeatedly carry large cached
contexts through tool-heavy orchestration loops. That is a hypothesis, not a causal conclusion.
The Atlas exists to establish trustworthy denominators and locate the actual amplification paths.

## Goals

- Observe all SGSD-associated Claude, Codex, subagent, board, narrator, and observer calls on DEVCP.
- Preserve provider-reported token dimensions separately: input, cache creation, cache read, output,
  and reasoning when the provider exposes it.
- Preserve cost estimates and account quota movement as separate measures; never equate cached
  tokens, monetary cost, and subscription credits.
- Trace each information handoff from source through recipient activity, output, review, repair,
  and accepted or delayed outcome.
- Version known system prompts, skills, agent prompts, handoff templates, context packets, route
  policies, gate definitions, model configuration, and installed runtime code by digest.
- Measure prompt duplication, context carriage, report re-ingestion, tool churn, retry amplification,
  operator-facing explanation, and downstream rework.
- Measure each gate's unique findings, overlap, false positives, repair burden, feedback closure,
  recurrence, time, and token economics.
- Make data coverage and uncertainty visible before presenting savings recommendations.
- Ship through the existing guarded Git/update/install path and remain easy to disable and roll back.

## Non-goals for the passive release

- No sandbox workload trials and no synthetic claims about production economics.
- No automatic session rollover, context trimming, prompt rewriting, model routing, gate sampling,
  gate bypass, gate retirement, or feedback injection.
- No new model calls to classify content, judge prompts, summarize telemetry, or create reports.
- No capture or export of raw prompts, responses, reasoning text, source code, commands, file
  contents, account email, or account identifiers.
- No replacement for `.planning/` truth, existing gates, or append-only evidence ledgers.
- No single efficiency, prompt-quality, or gate-value leaderboard.
- No claim of causal prevention from passive correlation alone.
- No mandatory Docker, systemd user service, Grafana, Loki, MongoDB, Pyroscope, or graph database.
- No Windows-launch adapter in the first DEVCP release. The design keeps that extension possible.

## Approaches considered

### Native provider telemetry only

This gives accurate Claude request accounting with low integration effort, but cannot reliably map
requests to SGSD milestone, phase, plan, task, gate, target repository, repair, or accepted outcome.

### Existing SGSD ledgers only

This has workflow vocabulary but duplicates provider accounting and inherits missing, stale,
malformed, and inferred data. It cannot accurately separate cache, output, reasoning, or quota.

### Hybrid flight recorder - selected

Native provider events supply request truth. SGSD supplies delivery semantics and evidence. A local
normalizer joins them through stable identities and writes a content-free canonical observation
stream. Prometheus is a bounded projection; it is never the request ledger.

### Clarity Atlas prompt influence

The operator-supplied Clarity Atlas prompt is design input, not a runtime dependency. Retain its
separation of metrics, traces, logs, static evidence, and catalogue evidence; its
declared/observed/inferred/unknown discipline; its coverage-first reporting; and its reversible
experiment posture. Do not transplant its broader service census, data-platform stack, or large
orchestrator prompt into Fable. The SGSD design substitutes delivery handoff lineage and keeps
`.planning/metrics` as canonical evidence.

## System architecture

```text
origin/master
     |
     v
guarded sgsd-update + explicit telemetry install/enable on DEVCP
     |
     v
sgsd-remote-tmux.sh
|-- starts/reuses the passive localhost sidecar
`-- launches Fable unchanged in the existing operator pane
          |
          |-- Claude native OTLP metrics/events
          |-- SGSD status-line quota/context snapshots
          |-- SGSD hooks, dispatches, gates, artifacts, and state
          |-- structured Codex execution/review events
          `-- explicitly tagged narrator/observer invocations
                    |
                    v
        OpenTelemetry Collector + SGSD normalizer
        |-- disposable bounded local spool
        |-- .planning/metrics/sgsd-atlas-events-<quota-reset-id>.jsonl
        `-- bounded aggregate endpoint
                    |
                    v
               Prometheus
                    |
                    v
     deterministic Markdown/JSON/self-contained HTML Atlas
```

### Attachment boundary

The DEVCP attachment point is `super-gsd/scripts/sgsd-remote-tmux.sh`, immediately before it builds
the Claude command for the existing operator pane. The launcher creates one immutable
`sgsd_run_id`, starts or reuses the sidecar, verifies its localhost health, and adds process-scoped
telemetry environment variables only when healthy. Claude remains the direct process in the same
tmux pane.

If the sidecar is missing or unhealthy, the launcher executes the original Claude command with no
telemetry environment. Telemetry must never become a precondition for SGSD.

Dynamic milestone, phase, plan, task, and gate values are not launch-time resource attributes;
they would become stale during a long session. The launcher supplies stable run, host alias,
cost-center, and launcher-repository identity. Dynamic scope comes from correlated hook, dispatch,
state, and gate events.

### Sidecar components

1. **Lifecycle manager** - explicit install, enable, start, health, status, stop, and disable
   operations; PID and `/proc` command-line identity checks; no implicit download from `sg`.
2. **OpenTelemetry Collector** - pinned, checksum-verified user-level binary; OTLP/HTTP receiver,
   memory limiter, batch processor, bounded persistent queue, content/identity filters, file output,
   and Prometheus exporter.
3. **Quota sampler** - a fail-open addition to the existing SGSD status-line hook. It records only
   changes to five-hour/seven-day usage percentages and reset timestamps, plus a bounded heartbeat.
   It must preserve the existing displayed status line byte-for-byte.
4. **SGSD normalizer** - joins provider events, status samples, local transcripts/artifact metadata,
   and selected SGSD ledgers; deduplicates; applies provenance; and appends canonical events.
5. **Codex event adapter** - consumes the structured `codex exec --json` stream while preserving the
   current prompt, model, effort, sandbox, timeout, report contract, exit semantics, and final report.
   Adding `--json` is an explicitly permitted instrumentation-only argv change, subject to a
   behavior-equivalence fixture. If equivalence cannot be proven, Codex provider usage remains
   unavailable in the passive release rather than changing execution behavior.
6. **Prometheus** - pinned, checksum-verified user-level binary; loopback scrape and bounded TSDB.
7. **Atlas builder** - deterministic offline report generator. It invokes no model and mutates no
   runtime state.

Beta Claude traces remain disabled in the first release. Native events already expose correlation
IDs, while beta tracing can propagate trace context into commands and outbound requests. It may be
added only after a separate soak if event-based lineage coverage is inadequate.

The launch-scoped Claude configuration explicitly enables native telemetry, exports metrics and
content-free events to OTLP/HTTP, leaves the trace exporter disabled, and uses the provider's
documented default export intervals. It never sets telemetry globally in Claude settings. Local
ports are fixed to `127.0.0.1:4318` (OTLP/HTTP), `127.0.0.1:13133` (collector health),
`127.0.0.1:9464` (Prometheus scrape), and `127.0.0.1:9090` (Prometheus UI), with startup refusing
to reuse an occupied endpoint unless process identity matches the installed sidecar.

### Observer coverage

Narrator, watcher, board, and other Claude subprocesses do not automatically inherit or participate
in the main session's attribution. Every SGSD-owned external model invocation must explicitly set a
cost center such as `orchestrator`, `observer`, `narrator`, `board`, or `recovery` and point to the
same local collector. This changes only telemetry environment, never its prompt or behavior.

## Sources and measurement truth

### Claude Code

Provider request events are the canonical Claude accounting source. Where exposed, retain input,
output, cache-read, cache-creation, request/client IDs, model, effort, query source, main/subagent/
auxiliary classification, duration, retries, stop reason, tool identity, and cost estimate.

The status-line feed supplies context occupancy, latest request usage, session cost estimate, cache
statistics, and five-hour/seven-day usage percentages with reset times. DEVCP must be version-
checked before capture; missing fields are `unavailable`, never zero. Installation never upgrades
Claude implicitly. Quota capture requires Claude Code 2.1.251 or newer; an older DEVCP version may
still emit other telemetry but cannot begin a complete quota baseline.

Standard Claude telemetry does not expose an exact split of total output tokens into visible prose,
tool-call arguments, and thinking. Record visible response characters and structural block sizes,
estimate local token allocation with its method/version, and keep the residual explicit. Record
thinking enabled and configured effort. Set `reasoning_tokens: null` when Claude does not expose it.
Never infer reasoning quality or reconstruct private reasoning content.

### Codex

The current wrapper's prompt/report byte estimate is not provider usage. Structured Codex execution
events should supply input, cached input, output, reasoning output, thread/turn IDs, tool events,
file changes, and final messages. Preserve the provider's numeric output-token and reasoning-token
fields until the installed CLI's relationship between them is fixture-verified; do not assume they
are additive. Raw reasoning or response content never enters telemetry.

### SGSD

Use canonical state frontmatter at event time and existing prompt/report artifacts, route decisions,
gate evidence, commit/review records, context packets, phase capsules, checkpoints, and acceptance
evidence. Do not treat declared-but-absent ledgers as observed. Do not search arbitrary prose for
scope when an explicit identity is unavailable.

### Subscription quota

Five-hour and seven-day percentages are account-wide samples. Other Claude sessions or machines may
move the same quota between snapshots. Reports separate the
`sgsd_attributed_usage_lower_bound` from `credit_unexplained`; they never allocate the unexplained
remainder to SGSD. No delta crosses a change in `resets_at`, and the first sample in a window has no
implied zero baseline.

## Identity and correlation spine

Reuse provider and SGSD identifiers where reliable and add the missing causal spine:

- `sgsd_run_id` - one launcher invocation.
- `session_id` - provider session.
- `request_id` and `client_request_id` - provider response and no-response attempt identities.
- `trace_id`, `span_id`, and `parent_span_id` when available without beta traces.
- `message_id`, `prompt_id`, and `tool_use_id`.
- `handoff_id` and `parent_handoff_id` - sender/recipient transfer lineage.
- `attempt_id` and `retry_group_id` - revision versus duplicate emission.
- `dispatch_id`, `packet_id`, `finding_id`, `repair_id`, and gate invocation ID.
- `milestone`, opaque `phase`, `plan_id`, plan task ID, gate, and evidence path.
- `launcher_repo_id`, event cwd repository, target repository alias/hash, and attribution method.
- pre/post commit SHA, prompt/template digest, known system-prompt digest, registry/config digest,
  installed source SHA, and tool/model/CLI versions.

Hook payload `session_id` joins Claude events to SGSD events exactly. `tool_use_id` pairs tool
boundaries. Target repository comes from explicit wrapper metadata or normalized paths actually
touched; cwd alone is only weak evidence. Timestamp/order matching is permitted only as
`inferred`, with confidence recorded.

### Deduplication identities

- Successful provider request: `(provider, session_id, request_id)`.
- Failed/no-response request: `(provider, session_id, client_request_id, attempt_number)`.
- Hook event: `(session_id, tool_use_id, hook_event_name)`.
- Session lifecycle: `(sgsd_run_id, session_id, event_type)`.
- Finding observation: `(finding_fingerprint, gate_invocation_id, attempt_id)`.

Exporter retries may duplicate deliveries. Prometheus counter resets and transcript frames are never
used as request identity.

`event_id` is deterministic: SHA-256 over schema version, source kind, source instance, and stable
source-event ID. A source without its own event ID derives one from the applicable deduplication tuple;
timestamps alone are forbidden. Replaying an identical `event_id` and payload digest is a no-op. A
replayed ID with a different payload appends an `integrity_conflict` event and never overwrites the
first observation. `occurred_at` records source time, `ingested_at` records collector time, and
`event_sequence` preserves provider or per-source order.

## Canonical observation schema

Append one JSON object per line to the active
`.planning/metrics/sgsd-atlas-events-<quota-reset-id>.jsonl` partition. Nulls are explicit; missing
values are not synthesized. The envelope is extensible and versioned:

```json
{
  "schema_version": 1,
  "event_id": "opaque",
  "source_event_id": "opaque",
  "occurred_at": "RFC3339 UTC",
  "ingested_at": "RFC3339 UTC",
  "event_sequence": null,
  "event_type": "api_request|handoff|tool|artifact|gate|finding|repair|quota|outcome|coverage|integrity_conflict",
  "source": {
    "kind": "claude_otel|claude_statusline|codex_json|sgsd_hook|sgsd_ledger|derived",
    "instance": "opaque local source identifier",
    "version": "exact source version",
    "provenance": "provider_reported|client_observed|derived_exact|estimated|declared|inferred|unavailable",
    "confidence": "exact|high|medium|low|unknown",
    "completeness_reason": null
  },
  "identity": {
    "sgsd_run_id": null,
    "session_id": null,
    "request_id": null,
    "client_request_id": null,
    "trace_id": null,
    "span_id": null,
    "parent_span_id": null,
    "message_id": null,
    "prompt_id": null,
    "agent_id": null,
    "parent_agent_id": null,
    "workflow_id": null,
    "handoff_id": null,
    "parent_handoff_id": null,
    "dispatch_id": null,
    "packet_id": null,
    "gate_invocation_id": null,
    "attempt_id": null,
    "retry_group_id": null,
    "tool_use_id": null,
    "finding_id": null,
    "repair_id": null
  },
  "scope": {
    "launcher_repo_id": null,
    "event_cwd_repo_id": null,
    "target_repo_id": null,
    "target_repo_source": null,
    "target_repo_confidence": "exact|high|medium|low|unknown",
    "milestone": null,
    "phase": null,
    "plan": null,
    "task": null,
    "gate": null,
    "role": null,
    "cost_center": null,
    "attribution_method": "exact|interval|inferred|unknown"
  },
  "runtime": {
    "provider": null,
    "model": null,
    "effort": null,
    "service_tier": null,
    "speed": null,
    "query_source": null,
    "active_agent": null,
    "active_skill": null,
    "active_plugin": null,
    "active_mcp_server": null,
    "source_sha": null,
    "pre_commit_sha": null,
    "post_commit_sha": null,
    "claude_version": null,
    "codex_version": null,
    "collector_version": null,
    "prometheus_version": null,
    "prompt_template_digest": null,
    "system_prompt_digest": null,
    "config_digest": null,
    "gate_registry_digest": null,
    "route_registry_digest": null,
    "pricing_table_version": null,
    "classifier_rules_version": null,
    "fingerprint_version": null
  },
  "usage": {
    "input_tokens": null,
    "cache_creation_tokens": null,
    "cache_read_tokens": null,
    "output_tokens": null,
    "reasoning_tokens": null,
    "total_provider_tokens": null,
    "visible_response_chars": null,
    "visible_response_tokens_estimated": null,
    "report_bytes": null,
    "tool_input_bytes": null,
    "tool_result_bytes": null,
    "context_window_tokens": null,
    "context_occupancy_percentage": null,
    "unattributed_residual_tokens": null,
    "cost_usd_estimated": null,
    "duration_ms": null
  },
  "execution": {
    "success": null,
    "status": null,
    "stop_reason": null,
    "retry_count": null,
    "iteration_count": null,
    "time_to_first_token_ms": null,
    "compaction_event": null,
    "fallback": null
  },
  "tool": {
    "name": null,
    "family": null,
    "success": null,
    "duration_ms": null,
    "argument_digest": null,
    "result_digest": null
  },
  "quota": {
    "window": null,
    "used_percentage": null,
    "resets_at": null,
    "gateway_spend_limit_percentage": null,
    "scope": "account|gateway|unknown",
    "attribution": null
  },
  "payload": {
    "purpose": null,
    "artifact_ref": null,
    "content_digest": null,
    "component_manifest_ref": null,
    "raw_content_recorded": false
  },
  "gate": {
    "eligible": null,
    "fired": null,
    "verdict": null,
    "finding_fingerprint": null,
    "finding_disposition": null,
    "duplicate_of": null
  },
  "outcome": {
    "accepted": null,
    "tests_passed": null,
    "gate_outcome": null,
    "operator_corrected": null,
    "status": null,
    "evidence_ref": null
  }
}
```

High-cardinality identities belong only in this event stream. Prometheus labels are restricted to
bounded dimensions such as provider, model family, query-source class, cost center, token type,
handoff class, gate type, verdict, and outcome. Session, request, run, phase, plan, task, path, error
text, and account identifiers are forbidden as labels.

## Handoff taxonomy

Treat a handoff as any boundary where intent, evidence, work, judgment, or state moves between roles.

| Boundary | Examples | Primary questions |
|---|---|---|
| Operator to Fable | request, correction, approval | Clarification and correction burden; calls to first useful action |
| Fable to operator | explanation, update, question, recap | Visible-output cost, duplication, accuracy against canonical state |
| Boot to orchestrator | AGENTS/WARP/CLAUDE, skill/tool/MCP stack | Fixed boot tax, stale context, time to first dispatch |
| Milestone to phase | intent, roadmap, prior summary, context | Goal retention, inherited-context size, later drift |
| Context selection to role | capsule, memory, VTP, source refs | Selected-context use, irrelevant carriage, missing prerequisites |
| Fable to researcher/planner | research and plan prompts | Findings adopted, citation quality, plan churn |
| Plan to executor | task, constraints, acceptance, report contract | First-pass completion, scope, tool churn, missing inputs |
| Executor to Fable | report, patch, evidence, blocker | Parseability, rereading, duplicated summary, correct state advance |
| Result to spec review/ATC | diff, prompt, report, raw evidence | Unique catches, overlap, false positives, repair cost |
| Verifier/challenger to gap work | requirement mapping, adversarial findings | Escapes found, disagreement value, replan burden |
| Phase to close/next phase | verification, ATC, MUDA, capsule, summary | Information retained/lost, repeated reads, close cost |
| Blocker to board/challenge | brief, member responses, decision memo | Trigger validity, calls/rounds, adoption, repeat blocker rate |
| Session to checkpoint/resume | checkpoint and recovery prompt | Resume fidelity, duplicate work, time back to productive action |
| Runtime to observer/cockpit | narrator, watcher, reports | Observer cost, freshness, duplication, operator use |

## Prompt component and output allocation

Known prompt composition emits or derives a content-free component manifest. Each component records
category, source reference, digest, byte count, token-estimation method/version, and whether the
recipient later read, cited, verified, or propagated it.

Component categories include:

- system/project/skill instructions and tool/MCP schemas;
- accumulated conversation history and compaction/resume material;
- operator input;
- milestone, phase, plan, task, intent, constraints, and acceptance criteria;
- selected context packet, source excerpts, memory, and VTP evidence;
- report/output contract and guardrails;
- tool results and prior reports carried into the next request;
- retry, repair, fallback, and gate findings.

Provider totals remain authoritative. Component token counts are locally estimated unless explicitly
reported, and any difference remains `unattributed_residual`.

Output is classified structurally, without a model, as visible operator explanation, intermediate
status, operator question, tool-call argument, artifact/report write, code/patch, review finding,
gate evidence, state/checkpoint/summary, observer narration, or unknown. Generation and later
carriage are separate events so a report summarized to the operator is not double-counted as two
independent outputs.

Every deterministic classification has a versioned rule, validation fixtures, and an `unknown`
fallback. Initially, operator correction requires an explicit structured rejection/reversal signal;
confirmation or refutation requires an explicit finding disposition; adoption requires a linked
state/artifact transition; and relevant recurrence opportunity requires the same rule/requirement ID
or target file/symbol. Text similarity alone cannot assert any of these. `prevention_supported`
requires an observed reinjection, a mechanically eligible later exposure, and no matching recurrence;
it remains inferential rather than causal.

Reference-first means the Atlas may read existing local transcripts and artifacts to calculate
structure, hashes, sizes, duplication, and local estimates. It stores only metrics, hashes, and local
references. It never copies raw content into telemetry, Prometheus, Git, or the canonical event row.

## Handoff quality and economics

Do not initially collapse the following into one score:

- Measurement coverage: percent of requests matched to run, handoff, target repo, phase, task,
  prompt version, and outcome; provider/local reconciliation error; missing/malformed counts.
- Context supplied: bytes/tokens by component and unattributed residual.
- Duplication: exact-line and normalized n-gram overlap within the prompt, with the recipient's known
  instructions, with the prior handoff, and across retry attempts.
- Observed downstream use: supplied paths later read, cited, mapped to verification, or propagated.
  This is a lower bound; unobserved does not mean useless.
- Missing prerequisites: absent references, first-attempt blockers, follow-up context additions,
  out-of-packet discovery, file-not-found, and unknown-command failures.
- Tool churn: calls before first productive action, repeated reads, duplicate argument digests,
  failed calls, unchanged test reruns, and discovery-tool share.
- Retry/rework: attempts, repeated prompt tokens, fallback, repair passes, superseded artifacts,
  changes after first declared completion, and acceptance regressions.
- Contract quality: schema validity, required report sections, allowed-file compliance, acceptance
  execution, evidence references, and parse success.
- Outcome: first-attempt/eventual acceptance, gates, time to acceptance, phase reopening, rollback,
  operator correction, and delayed defect discovery.
- Economics: total descendant tokens, quota movement, wall time, and repair tax per accepted task,
  adopted decision, or unique resolved finding.

"Productive action" is mechanical: first write/edit/patch for implementation, or first acceptance/
evidence command for review and research work.

Passive comparisons are associative. Prompt/model cohorts must control or stratify by task kind,
risk, ambiguity, novelty, diff size, dependency depth, acceptance type, session age, context size,
cache state, CLI/model version, tool/MCP set, provider health, and retry state.

## Gate economics and feedback closure

Every registered gate, including spec review, per-dispatch ATC, verifier, phase ATC, mechanical MUDA,
qualitative MUDA, browser/evidence gates, and plan-final challenges, follows this event lifecycle:

```text
eligible -> fired/skipped/missed -> findings -> disposition
         -> repair -> recheck -> curated rule -> later relevant injection
         -> compliant outcome, recurrence, or outcome pending
```

### Finding identity

Use a versioned deterministic fingerprint:

```text
sha256(
  fingerprint_version +
  rule_or_requirement_id +
  canonical_repo_relative_location +
  stable_symbol_or_section +
  normalized_assertion_or_reproducer
)
```

Exact fingerprints establish duplicates. Deterministic similarity may flag `possible_match` but must
not merge findings automatically. Each observation records severity, gate, evidence, first-seen
stage, duplicate/confirmation/refutation status, repair link, resolving commit, recheck evidence,
curation rule, later injection, eligible recurrence opportunity, and recurrence outcome.

Finding feedback states are `detected`, `accepted`, `refuted`, `duplicate`, `repair_dispatched`,
`resolved`, `curated`, `eligible_for_reuse`, `reinjected`, `recurrence_observed`, and
`prevention_supported`. "Curated" alone is not prevention.

### ATC

Measure per-dispatch ATC and phase-level ATC separately. A 2026-09-03 exploratory census found many
historical review rows but only a small structured-detail subset. Exact counts are intentionally not
made canonical here because no versioned census artifact/command yet reproduces them. Verdict
vocabulary and contracts drift, repair identity is absent, current v4 work is not represented, and
the gate-value ledger has no ATC rows. Existing counts cannot be treated as unique defects.

ATC reporting includes marginal findings beyond spec review/tests, overlap between per-dispatch and
phase ATC, finding acceptance/refutation, repair/recheck cost, downstream escape, and recurrence.

### MUDA

Separate deterministic probes from qualitative Codex review. A 2026-09-03 exploratory census found
dozens of WASTE artifacts across scripted and custom formats, while the current canonical MUDA ledger
contains only two rows and several strong custom findings are invisible to it. The implementation
must ship a versioned census command before any historical count is reported as canonical.

The existing MUDA contract is write-path-only: findings may be curated into anti-pattern memory,
but deterministic pre-dispatch consultation is deferred. Generic recall can retrieve one by chance,
which is not feedback closure. During the passive window, report which later handoffs were relevant
to a prior finding but do not inject anything.

Probe coverage is mandatory. "Zero defects from zero eligible rows" is `no_coverage`, not PASS.
Record trigger eligibility, numeric values, thresholds, evidence hashes, WASTE/report hashes,
qualitative call usage, repair linkage, rerun results, recurrence opportunity, and estimated avoided
or incurred work.

### Gate views and recommendations

For each gate report eligible/fired/missed counts, tokens, duration, raw/unique/actionable findings,
confirmation, duplication, refutation, repair, escapes, recurrence, and feedback closure. Include a
directed overlap matrix showing what each later gate added after all earlier gates.

Recommendations may be `keep`, `narrow`, `move_earlier`, `merge_overlap`,
`convert_to_deterministic`, `add_feed_forward`, `sample_candidate`, `retirement_candidate`, or
`measurement_gap`. They are advisory. Any gate change requires its own plan and existing SGSD gate
governance; the Atlas never bypasses a gate.

Atlas logic consumes and extends the evidence emitted by SGSD's registered gates and existing
gate-value/keep-kill/savings tools. It must not duplicate the gates or create a parallel enforcement
decision.

## Atlas outputs

The builder emits machine-readable JSON, a concise Markdown report, and a self-contained local HTML
Atlas with no remote assets. It includes:

1. Measurement coverage, data freshness, malformed/dropped events, and attribution confidence.
2. Five-hour/seven-day quota movement, `credit_unexplained`, and token/cost reconciliation.
3. Token allocation waterfall by provider, model, role, source, handoff, output purpose, and cache.
4. Session-age/context growth curves and compaction/resume events.
5. Handoff graph and edge table with descendant amplification and outcomes.
6. Context duplication/use table and missing-prerequisite/tool-churn analysis.
7. Retry, fallback, repair, and acceptance funnel.
8. Prompt/system/template version cohort comparisons.
9. Operator-output and interruption/correction burden.
10. Gate yield, overlap, repair, escape, recurrence, and feedback-closure views.
11. Prioritized evidence-backed improvement candidates with confidence and trade-offs.

Every chart/table shows its denominator and exact/estimated/inferred/unknown coverage. Reports cannot
make a savings claim when the relevant coverage threshold is not met.

## Privacy and security

Force content logging off even where provider defaults already redact it:

- user prompts and assistant responses off;
- tool details and tool content off;
- raw API bodies absent;
- console/debug exporters off;
- email and account identifiers removed before disk;
- local directories mode `0700` and files mode `0600`;
- OTLP, health, scrape, and Prometheus UI bound only to `127.0.0.1`;
- no remote write or external telemetry destination;
- remote viewing only through operator-controlled SSH forwarding.

The launcher/collector configuration must explicitly set `OTEL_LOG_USER_PROMPTS=0`,
`OTEL_LOG_ASSISTANT_RESPONSES=0`, `OTEL_LOG_TOOL_DETAILS=0`, and
`OTEL_LOG_TOOL_CONTENT=0`; `OTEL_LOG_RAW_API_BODIES` must remain unset. Metric export must disable
session-ID, account-ID, and resource-attribute inclusion. Equivalent renamed controls introduced by
a future provider version remain disabled until their privacy behavior is reviewed.

Collector filters use an allowlist rather than assuming unknown future attributes are safe. A
provider upgrade with additive fields preserves only the content-free allowed subset and emits a
compatibility gap for review.

## Storage and retention

- Collector persistent queue/WAL: 24 hours, capped at 256 MiB.
- Raw content-free OTLP spool: disposable under `~/.local/state/sgsd/telemetry`, retained for seven
  days or 512 MiB, whichever limit occurs first.
- Canonical detailed events: one append-only
  `.planning/metrics/sgsd-atlas-events-<quota-reset-id>.jsonl` partition per seven-day quota window,
  plus an append-only partition manifest containing hashes and coverage. Closed partitions are
  immutable. The sidecar never truncates or deletes them.
- Canonical partition soft cap: 1 GiB total. At the cap, detailed canonical ingestion stops and a
  detectable storage gap is recorded in the independent append-only
  `.planning/metrics/sgsd-atlas-gaps.jsonl`. Archival/deletion requires an explicit operator action
  and is outside the passive sidecar.
- Prometheus TSDB: 35 days or 2 GiB, whichever occurs first; WAL compression and compaction
  headroom required.
- Operational logs: 14 days.
- Content-free weekly and milestone aggregate reports: retained indefinitely.

If free disk falls below 10%, stop telemetry ingestion, append a storage-gap marker if safe, and let
SGSD continue. The telemetry process must never delete project evidence or source files.

## Failure isolation

- Sidecar unavailable or unhealthy: the launcher appends a minimal launch-gap record independently,
  then launches Claude without telemetry variables.
- Collector dies mid-session: Claude and Codex continue; exporter timeouts/queues remain bounded.
  Launcher start/exit records, collector heartbeats, and Prometheus `up` samples bound detectable
  outages; missingness remains unknown where all observers fail together.
- Port occupied or PID reused: refuse to kill/reuse an unverified process; launch SGSD unchanged.
- Malformed or unknown event: preserve the permitted content-free envelope, mark compatibility
  unverified, and continue.
- Status-line capture fails: swallow the recorder error and render the original line.
- Prometheus unavailable: canonical event capture continues; derived time series show a gap.
- Quota fields unavailable: record `unavailable` with the detected Claude version.
- Disk pressure: stop collection before it threatens SGSD; never block delivery.
- Optional VTP absent or unavailable: record the VTP field as unavailable and continue, preserving
  SGSD's selective-bridge degradation contract.

Fail-open missingness is biased toward crashes and provider failures. Reports therefore include
expected versus observed events and never silently exclude incomplete runs.

## Delivery and operational lifecycle

### Repository delivery

The implementation is developed and gated on a planned branch, then must land on `origin/master`.
DEVCP's `sgsd-update.sh` fetches only `origin/master`; pushing the current feature branch alone does
not deploy it.

The repository ships lifecycle scripts, collector/Prometheus configuration, schemas, normalizer,
report builder, tests, and an installer manifest. Large third-party binaries are not committed.
Explicit install downloads architecture-appropriate pinned releases with committed checksums.
`sgsd-update` itself does not silently download, enable, disable, or restart telemetry.

### DEVCP activation

1. Fast-forward and reinstall through the existing guarded updater from
   `/opt/clarity/project-clarity-erp`.
2. Run the explicit one-time telemetry install and enable operation.
3. Verify versions, checksums, permissions, loopback binds, and sidecar health.
4. Reset `clarity-sgsd` through the existing tmux launcher so a new Claude process inherits the
   telemetry environment. The updater never terminates a live session.
5. Confirm a content-free request event, quota availability status, and Prometheus scrape without
   invoking an extra model solely for telemetry.

The existing update invocation remains:

```bash
cd /opt/clarity/project-clarity-erp
bash ~/.claude/super-gsd/scripts/sgsd-update.sh \
  --source ~/.claude/super-gsd/source
```

### Rollback

Operational rollback is disable/stop after PID and command-line identity validation, followed by a
normal tmux reset. Existing raw data and inert binaries may remain; no destructive cleanup is
required. Source rollback is a forward revert on `master` followed by the normal updater because the
updater intentionally refuses downgrade, divergence, and local-only history.

## Verification strategy

Deterministic fixtures and fake provider events verify the recorder; they are implementation tests,
not workload experiments and cannot be cited as token-economics evidence.

Required verification:

- Schema validation, JSONL atomic append, deduplication, and crash-tail recovery.
- Prompt/report/component hashing and reference-first content canary tests.
- Claude event, status-line, and Codex structured-event fixture parsing.
- Provider/local token reconciliation and explicit residual/unknown behavior.
- Stable run/session/handoff/tool/finding/repair correlation.
- Target-repository tests covering absolute paths, cross-repo work, and unknown attribution.
- Gate eligibility, finding fingerprint, duplicate/confirmation/refutation, repair, and recurrence
  fixtures.
- Fake OTLP end-to-end path through collector, canonical event output, Prometheus scrape, and Atlas
  report.
- Launcher test with a fake Claude binary proving identical argv/topology and process-scoped env.
- Failure injection for absent binaries, port collision, malformed config/event, collector crash,
  PID reuse, permission failure, storage pressure, and unavailable quota fields.
- Loopback-only socket, file permission, high-cardinality label, and raw-content leak checks.
- Linux clean-room update/install/enable/disable/rollback tests.
- Status-line output equivalence and added-latency measurement.
- Unknown future attribute/schema compatibility fixture.
- Static inventory of every repository-owned Claude/Codex invocation site, with cost-center coverage
  and a guard that reports newly added unclassified invocation sites.

## Acceptance criteria

1. Telemetry generates zero additional model calls.
2. Claude prompts/argv and Claude/Codex prompts, model, effort, sandbox, gates, routing, retries,
   session behavior, and tmux pane topology are unchanged except for process-scoped telemetry
   environment. Codex may add only the instrumentation `--json` flag after its behavior-equivalence
   fixture passes; otherwise Codex structured capture stays disabled.
3. When telemetry is absent or unhealthy, the attachment adds no more than one second before the
   unchanged Claude launch proceeds.
4. Status-line output is byte-equivalent and capture adds less than 10 ms at p95.
5. During a 24-hour calibration soak, post-dedup provider-request coverage is at least 99% against
   the union of native request events and content-free transcript request IDs for telemetry-enabled
   sessions; launcher-created run/session mapping is 100%; duplicate normalized request rows remain
   below 0.1%. Unsupported provider fields are excluded from their field-specific denominator and
   reported separately.
6. Canonical JSONL has zero invalid rows, collector drops are zero, and raw-content/identity canary
   leaks are zero.
7. During the 24-hour soak, detectable sidecar downtime is below 0.5% of active instrumented SGSD
   time. Active time is bounded by launcher session-start/session-exit records; a gap longer than two
   configured heartbeat intervals is downtime. Each detectable outage creates a coverage-gap row.
8. During the 24-hour soak, collector CPU is at most 2% of one core over rolling five-minute windows
   and RSS at most 256 MiB; Prometheus RSS is at most 512 MiB; disk limits are enforced without
   touching SGSD evidence.
9. Each report exposes coverage denominators and separates observed, inferred, estimated, unknown,
   outcome-pending, and `credit_unexplained` values.
10. Killing, restarting, disabling, or corrupting the sidecar never interrupts or changes a Claude
    or Codex turn.
11. DEVCP update provenance proves source `master` SHA, installed scripts/config hashes, sidecar
    versions, and project pin agree.

## Baseline and decision policy

Collection begins immediately after activation. Data before the first complete quota reset is marked
partial. Publish deterministic interim reports after each five-hour and seven-day window, but require
at least two complete seven-day windows before reporting an average or recommending a prompt,
routing, model, or gate change.

Recommendations require:

- the relevant coverage threshold to pass;
- comparable cohorts or explicit stratification for task/session/model confounders;
- no degradation in acceptance, escaped defects, rework, or operator-correction burden;
- a clear distinction between association and causal evidence;
- a separate approved SGSD plan before any runtime change.

The passive Atlas may identify candidates such as session rollover, smaller context capsules,
prompt deduplication, narrower reports, deterministic checks, gate consolidation, or targeted
feed-forward. It cannot enact them.

## Delivery decomposition

The implementation should be planned as three dependent, independently verifiable increments:

1. **Capture foundation** - DEVCP lifecycle, Claude events, quota samples, observer cost centers,
   secure local collector, canonical schema, Prometheus, coverage and health. Exit: install/disable/
   rollback and fail-open tests pass; a live calibration session produces content-free Claude request
   and quota-availability evidence with no extra model call. This increment may be deployed early for
   calibration, but it does not start the comparison baseline.
2. **Correlation spine** - handoff IDs, Codex structured events, component manifests, target-repo
   identity, gate/finding/repair lineage, existing-ledger normalization, and invocation-site census.
   Exit: the 24-hour soak meets the acceptance denominators; Codex behavior equivalence passes or is
   explicitly unavailable; cross-repo and gate-repair fixtures pass. The two-window baseline clock
   begins only after this increment is installed and its capture configuration is frozen.
3. **Atlas reporting** - deterministic JSON/Markdown/HTML outputs, cohort analysis, handoff graph,
   gate overlap/feedback closure, and two-window baseline protocol. Exit: each required view renders
   from fixtures and live content-free events, displays its denominator/provenance, and refuses
   unsupported savings claims. This increment may ship during the frozen collection window if it
   does not change capture schema or configuration.

Prompt, routing, session, or gate optimization is a fourth future workstream informed by the Atlas,
not part of this passive implementation.

## Evidence references

- Claude Code monitoring: <https://code.claude.com/docs/en/monitoring-usage>
- Claude Code status line: <https://code.claude.com/docs/en/statusline>
- OpenTelemetry Collector: <https://opentelemetry.io/docs/collector/>
- Prometheus instrumentation labels: <https://prometheus.io/docs/practices/instrumentation/>
- Prometheus storage: <https://prometheus.io/docs/prometheus/latest/storage/>
- SGSD gates: `super-gsd/registry/gates.yaml`
- SGSD handover contract: `super-gsd/registry/handover-contract-v2.yaml`
- SGSD orchestration loop: `super-gsd/skills/sgsd-orchestrate/SKILL.md`
- DEVCP launcher: `super-gsd/scripts/sgsd-remote-tmux.sh`
- Guarded updater: `super-gsd/scripts/sgsd-update.sh`
- Status-line hook: `super-gsd/hooks/sgsd-statusline.js`
- Codex wrapper: `super-gsd/scripts/codex-exec.sh`
- MUDA contract: `super-gsd/skills/sgsd-muda-audit/SKILL.md`

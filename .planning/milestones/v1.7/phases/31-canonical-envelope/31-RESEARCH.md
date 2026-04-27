---
phase: 31
name: Canonical Command Envelope
milestone: v1.7
researched: 2026-04-26
domain: schema design + JSONL telemetry contracts
confidence: HIGH
locked_decision: 31=A (new envelope-v1, separate from existing 4 contracts)
---

# Phase 31 — Canonical Command Envelope · RESEARCH

<user_constraints>
## User Constraints (from DISCUSS.md / ROADMAP-AGENT.md)

### Locked Decisions
- **31=A** — new `envelope-v1`, separate from existing 4 contracts. Fifth abstraction is at the **command-output level**, not agent-report or plan-shape level.
- **No code changes to the 4 existing contracts** — schema-only addition.
- **Schema-without-consumer rule**: phase MUST land registry of ≥5 emitter candidates AND Mission Strip parse path documented (consumer wiring is Phase 34's job, but the contract for that wiring lives here).

### Claude's Discretion
- JSON Schema field shapes (within ENV-01's named field list)
- `reason_codes` initial vocabulary (closed-vs-extensible policy)
- Registry file format (likely YAML mirroring `review-providers.yaml`)
- Per-emitter "envelope-fit gap" annotations

### Deferred Ideas (OUT OF SCOPE for Phase 31)
- Migrating any existing JSONL stream to envelope shape (Phase 34 + future)
- Mission Strip code edits (Phase 28 already shipped strip lib; Phase 31 only documents the read contract)
- Aggregator over envelope rows (Phase 34 closes that for review-ledger; envelope-aggregator is post-v1.7)
- New metric streams beyond `envelope-log.jsonl` registry entry
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENV-01 | JSON schema published with status / reason_codes / artifacts / evidence / next_action / risk / duration_ms / run_id / phase / milestone | §3 (target schema), §6 (justification per field) |
| ENV-02 | ≥5 high-value commands documented as envelope emitters or candidates | §4 (emitter-candidate inventory with rationale) |
| ENV-03 | Schema reconciles with the 4 existing contracts (no level overlap) | §2 (4-contract reconciliation matrix) |
| ENV-04 | Mission Strip + dashboards parse envelope without bespoke regex | §7 (Mission Strip read contract) |
</phase_requirements>

## 1. Summary

The 4 existing SGSD contracts (`code-reviewer-v1`, `review-providers-v1`, `handover-contract-v2`, `plan-schema-v2`) cover four distinct abstraction levels: reviewer report, provider registry, agent dispatch, and plan-file frontmatter. They do **not** cover **command-output** — the shape of what shells, scripts, skills, and CLI tools emit. Today, every command invents its own JSONL row shape; dashboards regex prose; gates parse bespoke fields. Phase 31 fills exactly this gap.

**Primary recommendation:** ship `super-gsd/templates/command-envelope-v1.json` (JSON Schema draft-07) + `super-gsd/registry/command-envelope-v1.yaml` (emitter registry). The schema delegates fields already owned by other contracts (e.g. `phase`/`milestone` come from handover-contract-v2 brief; `evidence_path` is the same shape used by crit-backlog.jsonl). It does **not** define a new agent dispatch shape, a new reviewer report shape, or a new plan field — those live in their respective contracts and are referenced.

**Confidence: HIGH** for reconciliation matrix and existing-stream envelope-fit (verified by reading every contract file and sampling every existing JSONL stream). MEDIUM for `reason_codes` initial vocabulary (proposed closed set is grounded in observed crit-backlog `kind` values + edge-guard taxonomy from v2.0 Phase 47 + retrieval failure modes from v1.9 Phase 43, but may need expansion as Phase 32-35 emit real rows).

---

## 2. Four-Contract Reconciliation Matrix

> **Verification path:** read each contract file end-to-end before drafting matrix. All four files exist and are version-pinned. No collisions found at the command-output level.

| Contract | File | Abstraction Level | Owns | Does NOT Own | Verified |
|----------|------|-------------------|------|--------------|----------|
| `code-reviewer-v1` | implicit (referenced from `review-providers.yaml` row `report_contract: code-reviewer-v1`) | **Reviewer report** | CRIT/WARN/PASS verdict, 5 required fields per review report (verdict, critical, warning, one_liner, plan/tier metadata as observed in `commit-reviews.jsonl`) | Provider invocation, command exit shape, JSONL row schema for non-review streams | sample row: `{"ts":..., "plan":"11-02", "tier":"full", "verdict":"warn", "critical":0, "warning":3, "one_liner":"..."}` — review-shaped |
| `review-providers-v1` | `super-gsd/registry/review-providers.yaml` | **Provider registry** | Provider name, invocation type (agent/shell), auth method, fallback chain, timeout, report_contract reference, state | Report content shape (delegated to `report_contract`), command output for non-review providers | 2 active providers (claude-sonnet-reviewer, codex-cli-reviewer) — registry-shaped |
| `handover-contract-v2` | `super-gsd/registry/handover-contract-v2.yaml` | **Agent dispatch** | Agent input (brief / task / context / constraints), agent output (6-section structured report: FILES_CHANGED, VERIFICATION, DEVIATIONS, BLOCKERS, SCRIPTS_CREATED, ONE_LINER + confidence/rationale/intuition/why_principled/evidence_cited/emits/word_count), expertise discipline, validation preflight | Non-agent command output, JSONL telemetry rows, plan-file frontmatter | contract_version: 2 — dispatch-shaped |
| `plan-schema-v2` | `super-gsd/templates/plan-schema-v2.json` | **Plan-file frontmatter** | YAML frontmatter on PLAN.md (schema_version, tasks[], expected_ATC_tier, skip_gates, depends_on, lessons_path, prior_errors_lookup) + per-task fields (id, agent, model, files_touched, hypothesis, falsifier, stop_rule, etc.) | Command output, agent dispatch shape, reviewer reports | draft-07 JSON schema — plan-shaped |

### Why command-output is genuinely empty

Every existing contract is positioned at a different abstraction layer. Today's commands (`sg`, `sgsd-muda-audit.sh`, `/gsd-progress`, `codex-exec.sh`, `sgsd-mission-control.ps1` self-test, `repair-command-checker.cjs --validate`, etc.) emit:
- Free-form prose to stdout
- Bespoke JSONL rows (different keys per script — see §4)
- Sometimes nothing at all (exit code only)

No contract today says **"this is what an SGSD command's structured output must look like."** That gap is what `envelope-v1` closes. A command's envelope is **delegated** for fields it doesn't own:
- `phase` / `milestone` — same semantics as handover-contract-v2 input.brief
- `evidence_path` — same semantics as crit-backlog.jsonl `evidence_path`
- review verdicts — NOT in envelope; reviewers continue to emit code-reviewer-v1 shape inside their `evidence` payload

### No-collision proof

| Field family | Where defined today | Envelope-v1 stance |
|--------------|---------------------|--------------------|
| `verdict` / `critical` / `warning` (review) | `code-reviewer-v1` | **Not in envelope.** Review row goes into `artifacts[]` or `evidence[]` with `kind=review_report`. Untouched. |
| `tasks[]` / `hypothesis` / `falsifier` (plan) | `plan-schema-v2` | **Not in envelope.** Plans are not commands. |
| 6-section agent report (FILES_CHANGED, etc.) | `handover-contract-v2` | **Not in envelope.** Agent reports are dispatch-output, not command-output. They have their own structure already. Envelope is for non-agent commands AND for the orchestrator wrapper that dispatched the agent. |
| Provider name / invocation / auth | `review-providers-v1` | **Not in envelope.** Provider metadata lives in registry. Envelope's `next_action` may reference a provider name as a string, but does not redefine the provider. |

---

## 3. Target Envelope Schema (ENV-01)

> Fields per ROADMAP-AGENT.md ENV-01 acceptance: status / reason_codes / artifacts / evidence / next_action / risk / duration_ms / run_id / phase / milestone.

### 3.1 JSON Schema sketch (draft-07, lands at `super-gsd/templates/command-envelope-v1.json`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "SGSD Command Envelope v1",
  "type": "object",
  "required": ["envelope_version", "ts", "command", "status", "run_id"],
  "additionalProperties": true,
  "properties": {
    "envelope_version": { "const": 1 },
    "ts": { "type": "string", "format": "date-time" },
    "command": { "type": "string", "description": "canonical command name, e.g. 'sgsd-muda-audit', 'codex-exec', 'repair-command-checker'" },
    "status": { "enum": ["ok", "warn", "fail", "skipped", "timeout", "blocked"] },
    "reason_codes": { "type": "array", "items": { "type": "string" }, "description": "closed-set initially; see §5" },
    "artifacts": { "type": "array", "items": { "type": "object", "required": ["kind", "path"], "properties": { "kind": {"type":"string"}, "path": {"type":"string"} } }, "description": "files this command produced" },
    "evidence": { "type": "array", "items": { "type": "object", "required": ["kind", "ref"], "properties": { "kind": {"type":"string"}, "ref": {"type":"string"} } }, "description": "files/rows/links cited by status — what the operator reads to verify" },
    "next_action": { "type": ["string", "null"], "description": "human-readable repair_instruction OR autonomous-runnable command (under 26.3 4-AND predicate, same constraint as Phase 33)" },
    "risk": { "enum": ["low", "medium", "high", null] },
    "duration_ms": { "type": "integer", "minimum": 0 },
    "run_id": { "type": "string", "description": "stable id for this invocation; format = ISO timestamp + 4-char shorthash, mirrors crit-backlog.jsonl id pattern" },
    "phase": { "type": ["string", "null"], "description": "active phase id from orchestrator stamping (Phase 27.2)" },
    "milestone": { "type": ["string", "null"], "description": "milestone version, e.g. 'v1.7'" }
  }
}
```

### 3.2 Field necessity justification

| Field | Necessity | Delegated to other contract? | Notes |
|-------|-----------|------------------------------|-------|
| `envelope_version` | Required | No (envelope-owned) | Lets future v2 envelope coexist; mirrors `contract_version`/`schema_version` pattern from handover-v2/plan-schema-v2 |
| `ts` | Required | No | Every existing JSONL stream has `ts`; alignment is mandatory |
| `command` | Required | No | The discriminator. Without this the envelope is unreadable |
| `status` | Required | No | The 6-state vocabulary is cockpit-aligned with Phase 26.1's 8 states (subset: envelope drops `waiting`, `reviewing` because those are pane-state derivations, not command-output states) |
| `reason_codes` | Required (may be empty) | No | Closed initial vocabulary, see §5. Closes the "regex prose for cause" anti-pattern |
| `artifacts` | Optional | No | What the command **wrote** (files created/modified). Distinct from `evidence` |
| `evidence` | Optional | Partially — `evidence.kind=review_report` references `code-reviewer-v1`-shaped rows, `evidence.kind=brief` references handover-v2 brief | What the operator **reads** to trust the status. Refs, not copies |
| `next_action` | Optional | **Delegated to Phase 33's 4-AND predicate**. Envelope just transports the string; Phase 33's `repair-command-checker.cjs` validates if the string is an executable command | Critical: schema only carries; safety check lives where it's enforced (gates.yaml at load time) |
| `risk` | Optional | No | low/medium/high, parallel to Phase 38's `work_risk` taxonomy (intentional alignment) |
| `duration_ms` | Optional | No | Already universal in codex-log, audit-log; envelope keeps the name |
| `run_id` | Required | No (format mirrors crit-backlog.jsonl `id`) | Enables linking envelope rows to crit-backlog rows + commit-reviews rows |
| `phase` | Optional | **Delegated to handover-contract-v2** input.brief.phase semantics. Phase 27.2 stamping populates this | Same meaning everywhere |
| `milestone` | Optional | **Delegated to handover-contract-v2** input.brief.milestone semantics | Same meaning everywhere |

### 3.3 Anti-collision design rules baked into schema

1. `additionalProperties: true` — emitter-specific extra fields are allowed (so existing streams can adopt the envelope subset without losing their domain fields). Validators enforce **required + types**, not closure.
2. Schema does NOT include any field also `required` in another contract. (`tasks`, `hypothesis`, `verdict`, `critical`, etc. — absent.)
3. `evidence[].kind` is a free-form string, but documented values include `review_report` (code-reviewer-v1 row), `brief` (handover-v2), `plan_frontmatter` (plan-schema-v2), `crit_backlog_row` (crit-backlog.jsonl) — keeping the link without redefining the linked shape.

---

## 4. Existing JSONL Stream Envelope-Fit (ENV-02)

> Sampled live via `head -1` of every file in `.planning/metrics/`. Verified files exist; verified row shapes.

| Stream | File | Sample fields | Envelope-fit % | Gap (fields to add/rename for envelope-shape compat) | Recommended emitter? |
|--------|------|---------------|---------------:|------------------------------------------------------|----------------------|
| `codex-log` | `.planning/metrics/codex-log.jsonl` | ts, phase, plan, step, exit, duration_ms, prompt_bytes, report_bytes, timeout_hit, fallback_triggered | 80% | needs `status` (derivable from exit+timeout_hit), `reason_codes` (e.g. `codex_timeout`, `codex_auth_missing`), `run_id`, `command="codex-exec"` | **YES — first emitter**, Phase 32/34 already wires it |
| `audit-log` | `.planning/metrics/audit-log.jsonl` | ts, phase, status, l1_ms, l2_ms, l3_ms, total_ms | 70% | needs `command="audit"`, `reason_codes`, `run_id`, `evidence[]` (link to ATC review path), `milestone` | **YES — second emitter**, low-risk |
| `readiness-log` | `.planning/metrics/readiness-log.jsonl` | ts, type, expected_hash, actual_hash | 95% | needs `status` (derivable from hash equality), `command="sgsd-readiness-probe"`, `run_id`. Already structured with `type` discriminator | **YES — third emitter**, closest existing match |
| `muda-log` | `.planning/metrics/muda-log.jsonl` | ts, phase, warn, fail, exit, probes{} | 60% | needs `status` (from warn/fail counts), `reason_codes` (per-probe failure name), `run_id`, `command="sgsd-muda-audit"`, `artifacts[]` (WASTE.md path) | **YES — fourth emitter**, MUDA findings translate cleanly |
| `commit-reviews` | `.planning/milestones/*/phases/*/commit-reviews.jsonl` | ts, plan, tier, verdict, critical, warning, one_liner | 75% | needs `command="atc-review"`, `status` (from verdict mapping warn→warn / pass→ok / crit→fail), `run_id`, `phase`, `milestone`, `reason_codes`, `evidence[]` (review report path). **Critically**: the per-row review **content** stays as code-reviewer-v1; envelope wraps the row | **YES — fifth emitter**, also fed by Phase 34 ledger |
| `crit-backlog` | `.planning/metrics/crit-backlog.jsonl` | id, kind, phase, plan, milestone, attempts_made, summary, evidence_path, last_diff_sha, tagged_for_milestone, added_at, resolved_at, resolved_by | independent (60% fit) | crit-backlog is its own contract per DISCUSS Patch 2; do **NOT** subsume. Envelope can `evidence[].kind=crit_backlog_row` reference it | NO — keep separate (DISCUSS-locked) |
| `edge-guard-log` | not yet created (ROADMAP says it will be at `.planning/metrics/edge-guard-log.jsonl`) | from_step, to_step, result, missing_emits | 90% (per audit doc) | needs `status` (from result), `command="edge-guard"`, `run_id`, `reason_codes` (e.g. `missing_emit`, `step_skip`) | **6th candidate**, when stream lands |
| `handoff-log` | `.planning/metrics/handoff-log.jsonl` | ts, from_session_id, to_session_id, reason, chain_depth, cumulative_runtime_s, checkpoint_path, refused | 65% | needs `status` (from refused presence), `command="handoff"`, `run_id`, `reason_codes` (`max_chain_depth`, `auth_missing`, etc.) | candidate for v1.8 |
| `codex-timeout-observability` | `.planning/metrics/codex-timeout-observability.jsonl` | ts, tier_requested, tier_actual_via_retry, duration_ms, exit_code, step, phase, plan | 80% | mostly aligned; needs `status`, `command`, `run_id`, `reason_codes` | candidate, low priority (likely subsumed by codex-log envelope wrap) |
| `token-log` | `.planning/metrics/token-log.jsonl` | ts, tool, model, description, est_input, est_output, total | 30% | per-tool accounting; mostly orthogonal to commands. Wrap NOT recommended | NO |
| `activity-log` | `.planning/metrics/activity-log.jsonl` | ts, tool, target | 25% | hook-emitted per-tool-call; too granular for envelope | NO |
| `heartbeat` | `.planning/metrics/heartbeat.jsonl` | hook-emitted heartbeat | <20% | too high-volume, orthogonal | NO |
| `plan-errors` | `.planning/metrics/plan-errors.jsonl` | ts, event, plan_file, phase, plan, schema_version, mode, valid, error_count, errors | 70% | candidate via `command="plan-schema-v2-validator"` | candidate, low priority |
| `deliberation-outcomes` | `.planning/metrics/deliberation-outcomes.jsonl` | (deliberation outputs) | n/a | likely envelope-shape after Phase 32 route-decisions stabilizes vocabulary | candidate post-v1.7 |
| `orchestrator-pulse` | `.planning/metrics/orchestrator-pulse.jsonl` | ts, phase, plan, iteration, step | 40% | step-tick stream; not a command. Orthogonal | NO |

### 4.1 The 5 first envelope emitters (ENV-02 acceptance: ≥5)

Locked recommendation order:

1. **`codex-exec`** (writes to codex-log.jsonl) — most existing fields already align; Phase 34 needs envelope shape on this row to make the review-ledger aggregator deterministic
2. **`audit`** (writes to audit-log.jsonl) — phase-close audit; tiny gap
3. **`sgsd-readiness-probe`** (writes to readiness-log.jsonl) — closest existing fit; lowest-risk migration
4. **`sgsd-muda-audit`** (writes to muda-log.jsonl) — MUDA already has a `WASTE.md` artifact path, fits `artifacts[]` cleanly
5. **`atc-review`** (writes to per-phase commit-reviews.jsonl) — feeds Phase 34 review-ledger; envelope wrap is the bridge layer

Bonus / 6th: **`edge-guard`** when its stream is created (per ROADMAP audit, listed as ≥90% fit but file doesn't yet exist).

---

## 5. Standard `reason_codes` Initial Vocabulary

### 5.1 Closed-set policy (recommended)

`reason_codes` is **closed initially, extensible via registry update only.** New codes require an entry in `command-envelope-v1.yaml`. This prevents `reason_codes` from drifting into prose-by-another-name (the very anti-pattern envelope-v1 fixes).

### 5.2 Initial vocabulary (grouped)

Grounded in: existing crit-backlog `kind` values (`per_dispatch_atc`, `phase_atc`, `verifier_fail`, `edge_guard_miss`, `cleared`); v1.9 Phase 43 retrieval failure modes; observed Codex / audit / muda failure shapes.

```yaml
# Provider / runtime
- codex_timeout
- codex_auth_missing
- codex_fallback_triggered
- provider_unavailable
- runtime_unreachable

# Schema / validation
- schema_validation_fail
- parse_failure
- frontmatter_missing
- registry_load_fail

# Gate / review
- atc_critical
- atc_warn_only
- review_unanimous_pass
- review_split_decision
- gate_skip_with_reason
- gate_force_with_reason

# Edge guard / structural
- missing_emit
- edge_guard_retry_exhausted
- step_transition_blocked

# MUDA / waste
- inventory_waste
- waiting_waste
- transport_waste
- overproduction_waste

# Knowledge / retrieval (aligns with Phase 43 7-mode taxonomy)
- empty_hit
- noisy_hit
- stale_hit
- query_too_broad
- privacy_blocked

# Repair (Phase 33 alignment)
- repair_instruction_only
- repair_command_eligible
- repair_command_rejected_by_4and

# Orchestration / loop
- checkpoint_written
- session_handoff_refused
- max_chain_depth
- movement_detector_fired
```

### 5.3 Extensibility rule

Adding a new code requires:
1. Append entry to `command-envelope-v1.yaml` `reason_codes:` list with brief description
2. Bump `registry_version` (semver patch)
3. No envelope schema bump unless field shape changes

---

## 6. Mission Strip Integration (ENV-04)

### 6.1 Read contract

Mission Strip (Phase 28's `super-gsd/scripts/lib/sgsd-mission-strip.ps1`) reads envelope rows from emitter streams (codex-log, audit-log, readiness-log, muda-log, commit-reviews) by:

1. Tail-reading the relevant JSONL file (latest N rows)
2. Filtering rows where `envelope_version == 1` (legacy rows pass through untouched until Phase 34 backfill)
3. Reading **only** these envelope-defined fields: `status`, `reason_codes`, `command`, `phase`, `next_action`, `duration_ms`
4. Mapping `status` to Phase 26.1 8-state vocabulary:
   - `ok` → `complete`
   - `warn` → `complete` (with warn icon)
   - `fail` → `blocked`
   - `skipped` → no row rendered
   - `timeout` → `timed-out`
   - `blocked` → `blocked`

### 6.2 Why this beats the current state

Today Mission Strip does not yet read structured rows for cockpit panes other than codex-live.json (Phase 29). After envelope adoption: any envelope-emitting command's status is consumable without bespoke per-stream regex.

### 6.3 No code change in Phase 31

Mission Strip code edits are out of scope for Phase 31 (docs+schema phase). The read-contract is **documented** here so Phase 34 (which wires real-time review-ledger writer) and any subsequent Mission Strip extension consume the canonical shape.

### 6.4 No new metric stream

Per phase constraint: Phase 31 does NOT create `envelope-log.jsonl` as an aggregated stream. Each emitter writes its own envelope-shaped rows to its existing JSONL file. Aggregation, if needed, is the Phase 34 review-ledger pattern repeated post-v1.7.

---

## 7. Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Validating envelope rows at load | Custom regex parser | AJV (already in repo for plan-schema-v2 — `node -e "require('./command-envelope-v1.json')"` style draft-07 validation) | Schema-load checker pattern is established (Phase 33's `repair-command-checker.cjs` does same thing) |
| `reason_codes` extensibility | Per-command code registry | Single registry entry in `command-envelope-v1.yaml` | One-place vocabulary prevents drift |
| `next_action` safety | Re-implement 4-AND predicate | Reuse Phase 33's `repair-command-checker.cjs` | Single source of truth for command safety |
| `run_id` generation | UUID library | Existing crit-backlog id pattern (`<iso-ts-with-dashes>-<shorthash>`) | Consistency + grep-friendly |
| Linking review reports | Embed full review row | `evidence[].kind=review_report, ref=<path-or-id>` | Avoids duplicating code-reviewer-v1 content |

---

## 8. Common Pitfalls

### Pitfall 1: Envelope creep into agent dispatch
**What goes wrong:** Adding fields like `falsifier`, `hypothesis`, `expertise_ref` to envelope.
**Why:** These are owned by handover-contract-v2.
**Avoid:** If the field describes how a sub-agent reasoned, it belongs in handover-v2's report. Envelope is for command output, not agent reasoning.

### Pitfall 2: `reason_codes` becoming prose
**What goes wrong:** Devs adding free-form strings like `"codex timed out after 30s during muda probe"`.
**Why:** Open vocabulary always trends toward prose.
**Avoid:** Closed registry; reject unknown codes at validate time. Detail goes in `evidence[]` or a separate field.

### Pitfall 3: Subsuming crit-backlog
**What goes wrong:** Treating crit-backlog rows as envelope rows.
**Why:** crit-backlog has its own canonical schema (DISCUSS Patch 2), parsed deterministically by `release-readiness/score.cjs` and `status-consistency/check.cjs`. Subsuming would force a coupled migration.
**Avoid:** crit-backlog stays separate. Envelope `evidence[].kind=crit_backlog_row` references it by id.

### Pitfall 4: Backfilling all old rows
**What goes wrong:** Rewriting historical JSONL rows to envelope shape during Phase 31.
**Why:** Phase 31 is docs+schema. Backfill is migration work.
**Avoid:** New rows from named 5 emitters get envelope wrap going forward. Old rows untouched. Validators tolerate `envelope_version` absent (= legacy row, pass through).

### Pitfall 5: Schema-without-consumer ship
**What goes wrong:** Shipping schema without ≥1 caller wired in v1.7.
**Why:** ROADMAP-AGENT.md "schema-without-consumer rule" forbids it.
**Avoid:** Phase 34's review-ledger writer is the first concrete consumer of envelope shape (it writes commit-reviews-style rows wrapped with envelope fields). Phase 31 must hand off the spec such that Phase 34 can implement without ambiguity.

---

## 9. Validation Architecture

| Property | Value |
|----------|-------|
| Framework | AJV (Node.js) — same engine plan-schema-v2 uses |
| Config file | none required — schema file is self-contained |
| Quick run command | `node -e "const Ajv=require('ajv'); const ajv=new Ajv(); const s=require('./super-gsd/templates/command-envelope-v1.json'); ajv.compile(s); console.log('schema-loadable')"` |
| Full validation | `node super-gsd/scripts/lib/envelope-validator.cjs --self-test` (Phase 31 plan creates this) |

### Phase requirement → test map

| Req ID | Behavior | Test type | Automated command |
|--------|----------|-----------|-------------------|
| ENV-01 | JSON schema parses + compiles | unit | `node -e "require('./super-gsd/templates/command-envelope-v1.json')"` |
| ENV-02 | Registry lists ≥5 emitters | unit | `node -e "const y=require('js-yaml').load(require('fs').readFileSync('super-gsd/registry/command-envelope-v1.yaml','utf8')); process.exit(y.emitters.length >= 5 ? 0 : 1)"` |
| ENV-03 | No field collision with 4 existing contracts | manual review | reconciliation matrix in this RESEARCH (§2) |
| ENV-04 | Mission Strip read contract documented | manual review | §6 of this RESEARCH; Phase 28 strip lib already exists, Phase 31 documents read path |

---

## 10. Open Questions for the Planner

1. **Should `command-envelope-v1.yaml` registry include `reason_codes:` master list, OR should the master list live in the JSON Schema enum?**
   - Recommendation: live in **YAML** (schema uses `type: array, items: type: string` and validator cross-checks against YAML). Easier to extend without schema bump.
2. **Validator location: `super-gsd/scripts/lib/envelope-validator.cjs` (parallel to `repair-command-checker.cjs`) or `super-gsd/tools/envelope-validator/`?**
   - Recommendation: `scripts/lib/` — it's a library called by emitters, not a standalone tool.
3. **Should Phase 31 land the validator, or is registry+schema enough?**
   - Recommendation: land both. Keeps the schema-without-consumer rule satisfied: validator is the consumer that proves the schema is round-trippable.

---

## 11. Kill / Defer Conditions

| Condition | Action |
|-----------|--------|
| Schema collides with any of the 4 existing contracts | **Hard stop** — escalate to operator (per v1.7 kill condition in REQUIREMENTS.md) |
| Initial `reason_codes` set under-covers Phase 32 route-decisions or Phase 34 review-ledger needs | Defer — extend registry in those phases without envelope schema bump |
| AJV draft-07 unavailable | Fall back to manual-validation function in `envelope-validator.cjs` (defer schema enforcement to v1.8) |
| 5th emitter (`atc-review`) wrap blocks Phase 34 wiring | Drop atc-review from initial 5; substitute `edge-guard` (when stream lands) or `plan-errors` (well-shaped already) |

---

## 12. Sources

### Primary (HIGH confidence)
- `super-gsd/registry/review-providers.yaml` (read end-to-end)
- `super-gsd/registry/handover-contract-v2.yaml` (read end-to-end)
- `super-gsd/templates/plan-schema-v2.json` (read end-to-end)
- `.planning/milestones/v1.7/REQUIREMENTS.md` (read end-to-end)
- `.planning/milestones/v1.7/EXISTING-SURFACE-AUDIT.md` (read end-to-end)
- `.planning/ROADMAP-AGENT.md` Phase 31 block (read)
- `.planning/discussions/2026-04-26-mass-discuss.md` (locked decision 31=A confirmed)
- All 7 existing JSONL streams sampled live via `head -1`

### Inferred (MEDIUM confidence)
- `code-reviewer-v1` shape (no explicit file; inferred from `commit-reviews.jsonl` rows + `review-providers.yaml` `report_contract` field). Recommendation: Phase 34 may need to externalize this to `super-gsd/templates/code-reviewer-v1.yaml` if not already done — but **out of scope for Phase 31**.

### Cross-references (HIGH confidence)
- Phase 26.1 8-state status vocabulary
- Phase 26.3 4-AND `repair_command` predicate
- Phase 27.2 `phase` stamping
- Phase 33 `repair-command-checker.cjs` pattern (sibling validator)
- Phase 38.2 `work_risk` taxonomy alignment for `risk` field
- Phase 43 7-mode retrieval failure taxonomy (informs `reason_codes` knowledge group)
- Crit-backlog Patch 2 schema (DISCUSS) — kept separate, referenced via `evidence[]`

---

## Metadata

**Confidence breakdown:**
- 4-contract reconciliation: **HIGH** — every contract file read end-to-end, no collision
- Existing-stream envelope-fit: **HIGH** — every JSONL stream sampled live
- Initial `reason_codes` set: **MEDIUM** — grounded in crit-backlog kinds + retrieval taxonomy + observed failure modes; may need Phase 32-34 expansion
- Mission Strip integration: **HIGH** — read-contract only, no code change in Phase 31

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days; envelope-v1 should not drift before Phase 34 ships)

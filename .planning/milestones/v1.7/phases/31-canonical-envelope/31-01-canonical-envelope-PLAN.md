---
schema_version: 2
phase: 31
plan: 01
milestone: v1.7
title: Canonical Command Envelope (docs+schema)
type: execute
wave: 1
depends_on: []
autonomous: true
expected_ATC_tier: LITE
files_modified:
  - super-gsd/templates/command-envelope-v1.json
  - super-gsd/registry/command-envelope-v1.yaml
requirements: [ENV-01, ENV-02, ENV-03, ENV-04]
locked_decisions: [31=A]
must_haves:
  truths:
    - "JSON schema file parses as valid JSON Schema draft-07 via Node require()"
    - "Registry YAML enumerates >=5 commands as envelope emitters or candidates"
    - "Reason codes vocabulary lists >=10 codes with descriptions, grouped by domain"
    - "Reconciliation note explicitly cites all 4 existing contracts by name and asserts no overlap"
    - "Mission Strip read contract documents the field map and status->state translation"
  artifacts:
    - path: "super-gsd/templates/command-envelope-v1.json"
      provides: "JSON Schema draft-07 for envelope-v1"
      contains: '"$schema": "http://json-schema.org/draft-07/schema#"'
    - path: "super-gsd/registry/command-envelope-v1.yaml"
      provides: "Emitter registry + reason_codes master vocabulary"
      contains: "registry_version:"
  key_links:
    - from: "super-gsd/templates/command-envelope-v1.json"
      to: "super-gsd/registry/command-envelope-v1.yaml"
      via: "registry_version coupling + reason_codes cross-check"
      pattern: "envelope_version.*1"
    - from: "super-gsd/registry/command-envelope-v1.yaml"
      to: ".planning/metrics/{codex-log,audit-log,readiness-log,muda-log,commit-reviews}.jsonl"
      via: "emitters[].writes_to references existing JSONL streams"
      pattern: "writes_to:"
tags: [contracts, schema, envelope, jsonl, telemetry]
---

<objective>
Land the FIFTH SGSD contract level — command-output envelope — as docs+schema only.

Purpose: Close the gap where every command invents its own JSONL row shape. The 4 existing
contracts (`code-reviewer-v1`, `review-providers-v1`, `handover-contract-v2`, `plan-schema-v2`)
cover reviewer reports, provider registry, agent dispatch, and plan frontmatter — but
NOT command output. Phase 31 ships the schema + registry that Phases 32-35 consume.

Output:
- `super-gsd/templates/command-envelope-v1.json` — JSON Schema draft-07
- `super-gsd/registry/command-envelope-v1.yaml` — emitter registry + reason_codes vocabulary

Locked decision: 31=A — new envelope-v1, separate file from existing 4 contracts. Different
abstraction level (command-output, not agent-report or plan-shape).

NO code changes to the 4 existing contracts. NO migration of existing JSONL streams (Phase 34+).
NO Mission Strip code edits (read-contract is documented here, wired in Phase 34).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v1.7/phases/31-canonical-envelope/31-CONTEXT.md
@.planning/milestones/v1.7/phases/31-canonical-envelope/31-RESEARCH.md
@.planning/milestones/v1.7/EXISTING-SURFACE-AUDIT.md
@.planning/discussions/2026-04-26-mass-discuss.md

<interfaces>
<!-- The 4 existing contracts. The executor MUST NOT modify these files. -->
<!-- Envelope-v1 references their semantics via evidence[].kind values; it does not redefine them. -->

The 4 existing contracts (untouched):

1. `super-gsd/registry/review-providers.yaml` — provider registry (review-providers-v1).
   Owns: provider name, invocation type, auth method, fallback chain, timeout, report_contract reference.

2. `super-gsd/registry/handover-contract-v2.yaml` — agent dispatch (handover-contract-v2).
   Owns: agent input (brief/task/context/constraints) + 6-section structured output
   (FILES_CHANGED, VERIFICATION, DEVIATIONS, BLOCKERS, SCRIPTS_CREATED, ONE_LINER + confidence/rationale/etc.)

3. `super-gsd/templates/plan-schema-v2.json` — plan-file frontmatter (plan-schema-v2).
   Owns: schema_version, tasks[], expected_ATC_tier, skip_gates, depends_on, lessons_path,
   per-task hypothesis/falsifier/stop_rule/files_touched/etc.

4. `code-reviewer-v1` — implicit, referenced by review-providers.yaml `report_contract:`.
   Owns: review verdict (CRIT/WARN/PASS), 5 required fields per review report
   (verdict, critical, warning, one_liner, plan/tier metadata).

Envelope-v1 abstraction level: command-output (5th level). Does NOT collide.

Pattern reference (sibling validator pattern, do not modify):
- `super-gsd/scripts/lib/repair-command-checker.cjs` (Phase 33's 4-AND predicate validator)

Existing JSONL streams (envelope-fit summary from RESEARCH §4 — for registry population only):
- `.planning/metrics/codex-log.jsonl` (~80% fit) → emitter `codex-exec`
- `.planning/metrics/audit-log.jsonl` (~70% fit) → emitter `audit`
- `.planning/metrics/readiness-log.jsonl` (~95% fit) → emitter `sgsd-readiness-probe`
- `.planning/metrics/muda-log.jsonl` (~60% fit) → emitter `sgsd-muda-audit`
- `.planning/milestones/*/phases/*/commit-reviews.jsonl` (~75% fit) → emitter `atc-review`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task T1: Author envelope-v1 schema + registry</name>
  <agent>sgsd-exec-docs</agent>
  <model>sonnet</model>
  <files>super-gsd/templates/command-envelope-v1.json, super-gsd/registry/command-envelope-v1.yaml</files>
  <hypothesis>Envelope at command-output level reconciles cleanly with the 4 existing contracts; the 5 first emitters identified by RESEARCH (codex-exec, audit, sgsd-readiness-probe, sgsd-muda-audit, atc-review) have 60-95% existing fit and require zero changes to the 4 existing contracts.</hypothesis>
  <falsifier>If any envelope field would require modifying an existing contract OR if a 6th abstraction level emerges, the locked decision 31=A is wrong and the phase must hard-stop.</falsifier>
  <stop_rule>If any envelope field's purpose is already owned by an existing contract (e.g. `verdict` lives in code-reviewer-v1), stop and document the overlap as a deviation. Do not redefine.</stop_rule>
  <minimal_test>node -e "require('./super-gsd/templates/command-envelope-v1.json')" exits 0 AND grep -c '^  - name:' super-gsd/registry/command-envelope-v1.yaml >= 5</minimal_test>
  <known_deadends>
    - Do NOT modify any of the 4 existing contracts (code-reviewer-v1, review-providers-v1, handover-contract-v2, plan-schema-v2)
    - Do NOT invent a 6th abstraction level
    - Do NOT create `.planning/metrics/envelope-log.jsonl` (per RESEARCH §6.4 — each emitter writes its own envelope-shaped rows to its existing JSONL)
    - Do NOT migrate existing rows (Phase 34+ migration work)
    - Do NOT re-implement the 4-AND predicate for `next_action` safety (delegated to Phase 33's `repair-command-checker.cjs`)
  </known_deadends>
  <action>
    Create both files exactly as specified below. Use ASCII-only YAML (no smart quotes, no em-dashes, no unicode). Schema must be JSON Schema draft-07 compatible; registry must be valid YAML 1.2.

    ===========================================================
    FILE 1: super-gsd/templates/command-envelope-v1.json
    ===========================================================

    Write this exact content (preserve key order; required = ["envelope_version", "ts", "command", "status", "run_id"]):

    ```json
    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "$id": "https://super-gsd.local/schemas/command-envelope-v1.json",
      "title": "SGSD Command Envelope v1",
      "description": "Canonical output shape for SGSD commands, scripts, and skills. Fifth contract level (command-output), separate from code-reviewer-v1, review-providers-v1, handover-contract-v2, plan-schema-v2. Each existing contract owns a different abstraction layer; this schema does not duplicate any field they own.",
      "type": "object",
      "required": ["envelope_version", "ts", "command", "status", "run_id"],
      "additionalProperties": true,
      "properties": {
        "envelope_version": {
          "const": 1,
          "description": "Lets future v2 envelope coexist; mirrors contract_version / schema_version pattern from handover-contract-v2 / plan-schema-v2."
        },
        "ts": {
          "type": "string",
          "format": "date-time",
          "description": "ISO-8601 timestamp. Aligns with all existing JSONL streams which already carry ts."
        },
        "command": {
          "type": "string",
          "minLength": 1,
          "description": "Canonical command name, e.g. 'sgsd-muda-audit', 'codex-exec', 'audit', 'sgsd-readiness-probe', 'atc-review'. Discriminator field — without it the envelope is unreadable."
        },
        "status": {
          "enum": ["ok", "warn", "fail", "skipped", "timeout", "blocked"],
          "description": "Six-state command-output vocabulary. Subset of Phase 26.1's 8-state cockpit vocabulary (drops 'waiting' and 'reviewing' which are pane-state derivations, not command-output states)."
        },
        "reason_codes": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 },
          "description": "Closed initial vocabulary; cross-checked against command-envelope-v1.yaml `reason_codes` master list at validate time. Closes the 'regex prose for cause' anti-pattern. May be empty array."
        },
        "artifacts": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["kind", "path"],
            "properties": {
              "kind": { "type": "string", "minLength": 1 },
              "path": { "type": "string", "minLength": 1 }
            },
            "additionalProperties": true
          },
          "description": "Files this command WROTE (created or modified). Distinct from `evidence` which is what the operator READS."
        },
        "evidence": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["kind", "ref"],
            "properties": {
              "kind": {
                "type": "string",
                "description": "Documented values: 'review_report' (code-reviewer-v1 row), 'brief' (handover-contract-v2 input.brief), 'plan_frontmatter' (plan-schema-v2), 'crit_backlog_row' (crit-backlog.jsonl row id). Free-form string — does NOT redefine the linked contract."
              },
              "ref": { "type": "string", "minLength": 1 }
            },
            "additionalProperties": true
          },
          "description": "Files / rows / links cited by status. References, not copies. Bridges to the 4 existing contracts without redefining them."
        },
        "next_action": {
          "type": ["string", "null"],
          "description": "Human-readable repair_instruction OR autonomous-runnable command. Schema only TRANSPORTS the string; safety check (Phase 26.3 4-AND predicate) lives in `repair-command-checker.cjs` at gates.yaml load time."
        },
        "risk": {
          "enum": ["low", "medium", "high", null],
          "description": "Aligns with Phase 38.2 work_risk taxonomy (intentional)."
        },
        "duration_ms": {
          "type": "integer",
          "minimum": 0,
          "description": "Already universal in codex-log, audit-log, muda-log; envelope keeps the established name."
        },
        "run_id": {
          "type": "string",
          "minLength": 1,
          "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\\.[0-9]+)?Z-[a-f0-9]{4}$",
          "description": "ISO timestamp + 4-char hex shorthash, e.g. '2026-04-27T07:30:00Z-a1b2'. Mirrors crit-backlog.jsonl id pattern. Enables linking envelope rows to crit-backlog rows + commit-reviews rows."
        },
        "phase": {
          "type": ["string", "null"],
          "description": "Active phase id from Phase 27.2 orchestrator stamping. Same semantics as handover-contract-v2 input.brief.phase. Delegated — not redefined."
        },
        "milestone": {
          "type": ["string", "null"],
          "description": "Milestone version, e.g. 'v1.7'. Same semantics as handover-contract-v2 input.brief.milestone. Delegated — not redefined."
        }
      },
      "examples": [
        {
          "envelope_version": 1,
          "ts": "2026-04-27T07:30:00Z",
          "command": "sgsd-muda-audit",
          "status": "warn",
          "reason_codes": ["inventory_waste"],
          "artifacts": [{"kind": "waste_report", "path": ".planning/milestones/v1.7/phases/21-foo/WASTE.md"}],
          "evidence": [{"kind": "muda_log_row", "ref": ".planning/metrics/muda-log.jsonl#L142"}],
          "next_action": "review WASTE.md and clear or accept inventory waste",
          "risk": "low",
          "duration_ms": 1240,
          "run_id": "2026-04-27T07:30:00Z-a1b2",
          "phase": "21",
          "milestone": "v1.7"
        },
        {
          "envelope_version": 1,
          "ts": "2026-04-27T07:31:15Z",
          "command": "codex-exec",
          "status": "fail",
          "reason_codes": ["codex_timeout", "codex_fallback_triggered"],
          "artifacts": [],
          "evidence": [{"kind": "codex_log_row", "ref": ".planning/metrics/codex-log.jsonl#L88"}],
          "next_action": null,
          "risk": "medium",
          "duration_ms": 30000,
          "run_id": "2026-04-27T07:31:15Z-c3d4",
          "phase": "31",
          "milestone": "v1.7"
        }
      ]
    }
    ```

    ===========================================================
    FILE 2: super-gsd/registry/command-envelope-v1.yaml
    ===========================================================

    Write this exact content. ASCII-only. The `emitters` list MUST contain at least 5 entries.
    The `reason_codes` master list MUST contain at least 10 entries with descriptions.

    ```yaml
    # super-gsd/registry/command-envelope-v1.yaml
    # Canonical Command Envelope v1 — emitter registry + reason_codes vocabulary.
    # Fifth contract level (command-output). Reconciles with but does NOT modify:
    #   - code-reviewer-v1     (reviewer report level)
    #   - review-providers-v1  (provider registry level)
    #   - handover-contract-v2 (agent dispatch level)
    #   - plan-schema-v2       (plan-file frontmatter level)
    # See super-gsd/templates/command-envelope-v1.json for the JSON Schema.

    registry_version: 1.0.0
    envelope_version: 1
    schema_ref: super-gsd/templates/command-envelope-v1.json
    locked_decision: "31=A (mass-discuss 2026-04-26): new envelope-v1, separate file"

    # ---------------------------------------------------------------
    # Emitters — commands that write envelope-shaped rows.
    # `emits_envelope` values:
    #   true       -> command currently writes envelope-shaped rows
    #   candidate  -> command does not yet emit envelope, but is a named first-wave migration target
    #   false      -> command will not be migrated (kept here for explicit rejection)
    # ---------------------------------------------------------------
    emitters:
      - name: codex-exec
        emits_envelope: candidate
        writes_to: .planning/metrics/codex-log.jsonl
        existing_fit_pct: 80
        gap: "needs status (derivable from exit+timeout_hit), reason_codes, run_id, command field"
        first_wave: true
        rationale: "Phase 34 review-ledger requires envelope shape on this row to make aggregation deterministic"

      - name: audit
        emits_envelope: candidate
        writes_to: .planning/metrics/audit-log.jsonl
        existing_fit_pct: 70
        gap: "needs command='audit', reason_codes, run_id, evidence[] (link to ATC review path), milestone"
        first_wave: true
        rationale: "Phase-close audit; tiny gap; low-risk migration"

      - name: sgsd-readiness-probe
        emits_envelope: candidate
        writes_to: .planning/metrics/readiness-log.jsonl
        existing_fit_pct: 95
        gap: "needs status (derivable from hash equality), command, run_id"
        first_wave: true
        rationale: "Closest existing structural match (already discriminated by `type`)"

      - name: sgsd-muda-audit
        emits_envelope: candidate
        writes_to: .planning/metrics/muda-log.jsonl
        existing_fit_pct: 60
        gap: "needs status (from warn/fail counts), reason_codes (per-probe failure name), run_id, artifacts[] (WASTE.md path)"
        first_wave: true
        rationale: "MUDA findings translate cleanly; WASTE.md fits artifacts[] naturally"

      - name: atc-review
        emits_envelope: candidate
        writes_to: ".planning/milestones/*/phases/*/commit-reviews.jsonl"
        existing_fit_pct: 75
        gap: "needs command, status (from verdict mapping warn->warn / pass->ok / crit->fail), run_id, phase, milestone, reason_codes, evidence[] (review report path). Per-row review CONTENT remains code-reviewer-v1; envelope wraps the row."
        first_wave: true
        rationale: "Feeds Phase 34 review-ledger; envelope wrap is the bridge layer; preserves code-reviewer-v1 inside evidence."

      - name: edge-guard
        emits_envelope: candidate
        writes_to: .planning/metrics/edge-guard-log.jsonl
        existing_fit_pct: 90
        gap: "needs status (from result), command='edge-guard', run_id, reason_codes (missing_emit, step_skip)"
        first_wave: false
        rationale: "Sixth-candidate per RESEARCH; activate when stream lands"

      - name: handoff
        emits_envelope: candidate
        writes_to: .planning/metrics/handoff-log.jsonl
        existing_fit_pct: 65
        gap: "needs status (from refused presence), command='handoff', run_id, reason_codes (max_chain_depth, auth_missing)"
        first_wave: false
        rationale: "v1.8 candidate"

      # Explicit non-emitters (do NOT migrate):
      - name: crit-backlog
        emits_envelope: false
        writes_to: .planning/metrics/crit-backlog.jsonl
        rationale: "Independent contract per DISCUSS Patch 2. Parsed deterministically by release-readiness/score.cjs and status-consistency/check.cjs. Envelope references it via evidence[].kind=crit_backlog_row."

      - name: token-log
        emits_envelope: false
        writes_to: .planning/metrics/token-log.jsonl
        rationale: "Per-tool accounting; orthogonal to commands; ~30% fit."

      - name: heartbeat
        emits_envelope: false
        writes_to: .planning/metrics/heartbeat.jsonl
        rationale: "Hook-emitted, high-volume, orthogonal; <20% fit."

    # ---------------------------------------------------------------
    # Reason codes — closed initial vocabulary.
    # Extension protocol: append entry here, bump registry_version (semver patch).
    # No envelope schema bump unless field shape changes.
    # ---------------------------------------------------------------
    reason_codes:
      # Provider / runtime
      - code: codex_timeout
        group: provider_runtime
        description: "Codex CLI exceeded its timeout budget for the current tier."
      - code: codex_auth_missing
        group: provider_runtime
        description: "Codex CLI invoked without valid auth (CODEX_API_KEY absent or rejected)."
      - code: codex_fallback_triggered
        group: provider_runtime
        description: "Codex provider failed; review-providers fallback chain advanced to next provider."
      - code: provider_unavailable
        group: provider_runtime
        description: "Configured provider is unreachable, disabled, or returned non-recoverable error."
      - code: runtime_unreachable
        group: provider_runtime
        description: "Required runtime (Node, PowerShell, WSL) not found or non-functional."

      # Schema / validation
      - code: schema_validation_fail
        group: schema_validation
        description: "Input did not validate against its declared schema (envelope-v1, plan-schema-v2, etc.)."
      - code: parse_failure
        group: schema_validation
        description: "Could not parse input file (malformed JSON / YAML / frontmatter)."
      - code: frontmatter_missing
        group: schema_validation
        description: "Required frontmatter block absent from a markdown artifact."
      - code: registry_load_fail
        group: schema_validation
        description: "A registry yaml (review-providers, handover-contract-v2, command-envelope-v1, gates) failed to load."

      # Gate / review
      - code: atc_critical
        group: gate_review
        description: "ATC reviewer returned CRIT verdict — block."
      - code: atc_warn_only
        group: gate_review
        description: "ATC reviewer returned WARN(s) but no CRIT — proceed with surfaced warnings."
      - code: review_unanimous_pass
        group: gate_review
        description: "All configured reviewers returned PASS."
      - code: review_split_decision
        group: gate_review
        description: "Reviewers disagreed (one PASS / one WARN, or one PASS / one CRIT)."
      - code: gate_skip_with_reason
        group: gate_review
        description: "Gate intentionally skipped via gates.yaml skip_gates with documented reason."
      - code: gate_force_with_reason
        group: gate_review
        description: "Gate force-passed via documented override; rationale captured in evidence[]."

      # Edge guard / structural
      - code: missing_emit
        group: edge_guard
        description: "Step did not emit a required artifact before transitioning."
      - code: edge_guard_retry_exhausted
        group: edge_guard
        description: "Edge-guard retry budget exhausted; transition still blocked."
      - code: step_transition_blocked
        group: edge_guard
        description: "Step-to-step transition refused by guard rules."

      # MUDA / waste
      - code: inventory_waste
        group: muda
        description: "Phase carrying unexecuted inventory beyond threshold."
      - code: waiting_waste
        group: muda
        description: "Phase narrative or pulse stale beyond freshness threshold."
      - code: transport_waste
        group: muda
        description: "Artifact crossed handoff without read in destination context."
      - code: overproduction_waste
        group: muda
        description: "Output produced without downstream consumer."

      # Knowledge / retrieval (aligns with v1.9 Phase 43 7-mode taxonomy)
      - code: empty_hit
        group: retrieval
        description: "Retrieval query returned zero results when results were expected."
      - code: noisy_hit
        group: retrieval
        description: "Retrieval returned many results, none of acceptable relevance."
      - code: stale_hit
        group: retrieval
        description: "Retrieval returned a result whose source is older than freshness window."
      - code: query_too_broad
        group: retrieval
        description: "Query terms matched too many documents; refinement required."
      - code: privacy_blocked
        group: retrieval
        description: "Retrieval blocked by privacy / scope rule."

      # Repair (Phase 33 alignment)
      - code: repair_instruction_only
        group: repair
        description: "Failure has a human-readable repair_instruction; no autonomous repair_command available."
      - code: repair_command_eligible
        group: repair
        description: "Failure has a repair_command that passes the Phase 26.3 4-AND safety predicate."
      - code: repair_command_rejected_by_4and
        group: repair
        description: "Proposed repair_command failed 4-AND predicate (idempotent / scoped / observable / reversible). Falls back to repair_instruction_only."

      # Orchestration / loop
      - code: checkpoint_written
        group: orchestration
        description: "Orchestrator checkpoint written; loop paused intentionally."
      - code: session_handoff_refused
        group: orchestration
        description: "Handoff to next session refused (auth missing, chain depth exceeded, etc.)."
      - code: max_chain_depth
        group: orchestration
        description: "Auto-handover chain depth budget reached."
      - code: movement_detector_fired
        group: orchestration
        description: "No-movement detector observed loop without progress beyond threshold."

    # ---------------------------------------------------------------
    # Mission Strip read contract (Phase 28's super-gsd/scripts/lib/sgsd-mission-strip.ps1)
    # Phase 31 documents this; Phase 34+ wires it. NO code edits in Phase 31.
    # ---------------------------------------------------------------
    mission_strip_read_contract:
      tail_strategy: "Tail-read latest N rows from each emitter's writes_to file."
      filter_rule: "Pass through rows where envelope_version == 1; legacy rows untouched until Phase 34 backfill."
      consumed_fields: [status, reason_codes, command, phase, next_action, duration_ms]
      status_to_pane_state:
        ok: complete
        warn: complete_with_warn_icon
        fail: blocked
        skipped: not_rendered
        timeout: timed_out
        blocked: blocked
      no_aggregator_in_v17: true
      notes: "Each emitter writes envelope-shaped rows to its OWN existing JSONL. Phase 31 does NOT create envelope-log.jsonl. Aggregation is post-v1.7."

    # ---------------------------------------------------------------
    # Reconciliation note — explicit non-collision with the 4 existing contracts.
    # ---------------------------------------------------------------
    reconciliation:
      level: command-output
      collides_with: []
      delegates_semantics_to:
        phase: handover-contract-v2 (input.brief.phase)
        milestone: handover-contract-v2 (input.brief.milestone)
        evidence_kind_review_report: code-reviewer-v1
        evidence_kind_brief: handover-contract-v2
        evidence_kind_plan_frontmatter: plan-schema-v2
        evidence_kind_crit_backlog_row: crit-backlog (independent contract)
      does_not_touch:
        - code-reviewer-v1
        - review-providers-v1
        - handover-contract-v2
        - plan-schema-v2
      hard_stop_condition: "If any envelope field would require modifying any of the 4 contracts above, STOP and escalate. Locked decision 31=A is then wrong."
    ```

    Per D-31=A: emit BOTH files. Keep filenames exactly as specified.
    Per D-31=A and CONTEXT §"Open derivation calls": run_id format = ISO timestamp + 4-char hex,
    `emits_envelope: true | candidate | false` field, `reason_codes` closed-initial with extension protocol — all locked above.

    After writing, run the verification commands from `<verify>` from the repo root.
    Do NOT touch any file outside `super-gsd/templates/command-envelope-v1.json` and
    `super-gsd/registry/command-envelope-v1.yaml`.
  </action>
  <verify>
    <automated>node -e "require('./super-gsd/templates/command-envelope-v1.json'); console.log('schema-loadable')" && node -e "const fs=require('fs');const c=fs.readFileSync('super-gsd/registry/command-envelope-v1.yaml','utf8');const emitters=(c.match(/^      - name: /gm)||[]).length;const codes=(c.match(/^      - code: /gm)||[]).length;const cites=['code-reviewer-v1','review-providers-v1','handover-contract-v2','plan-schema-v2'].every(n=>c.includes(n));if(emitters<5)throw new Error('emitters '+emitters+' < 5');if(codes<10)throw new Error('reason_codes '+codes+' < 10');if(!cites)throw new Error('reconciliation note missing one of the 4 contract names');console.log('registry ok: emitters='+emitters+' reason_codes='+codes+' cites_all_4=true')"</automated>
  </verify>
  <done>
    - `super-gsd/templates/command-envelope-v1.json` exists and parses via Node `require()`
    - File declares `"$schema": "http://json-schema.org/draft-07/schema#"` and `"envelope_version": { "const": 1 }`
    - File contains `required: ["envelope_version", "ts", "command", "status", "run_id"]`
    - File contains 2 examples in `examples` array
    - `super-gsd/registry/command-envelope-v1.yaml` exists, is valid YAML
    - Registry `emitters:` list has >=5 entries with `name:` keys
    - Registry `reason_codes:` master list has >=10 entries with `code:` and `description:`
    - Registry contains `reconciliation:` block citing all 4 existing contracts by name
    - Registry contains `mission_strip_read_contract:` block with status->pane_state mapping
    - Verification command exits 0
  </done>
</task>

</tasks>

<verification>
Phase-level checks (run from repo root):

1. Schema loadable:
   `node -e "require('./super-gsd/templates/command-envelope-v1.json')"` → exit 0

2. Registry emitter count:
   `node -e "const c=require('fs').readFileSync('super-gsd/registry/command-envelope-v1.yaml','utf8');process.exit((c.match(/^      - name: /gm)||[]).length>=5?0:1)"` → exit 0

3. Reason codes count:
   `node -e "const c=require('fs').readFileSync('super-gsd/registry/command-envelope-v1.yaml','utf8');process.exit((c.match(/^      - code: /gm)||[]).length>=10?0:1)"` → exit 0

4. Reconciliation cites all 4 existing contracts:
   `grep -E 'code-reviewer-v1|review-providers-v1|handover-contract-v2|plan-schema-v2' super-gsd/registry/command-envelope-v1.yaml | wc -l` → >= 4

5. None of the 4 existing contracts modified:
   `git diff --name-only HEAD -- super-gsd/registry/review-providers.yaml super-gsd/registry/handover-contract-v2.yaml super-gsd/templates/plan-schema-v2.json` → empty
</verification>

<success_criteria>
Phase 31 ships when:

- ENV-01: `super-gsd/templates/command-envelope-v1.json` parses as JSON Schema draft-07 with all 12 fields present (envelope_version, ts, command, status, reason_codes, artifacts, evidence, next_action, risk, duration_ms, run_id, phase, milestone) and 2 examples.
- ENV-02: `super-gsd/registry/command-envelope-v1.yaml` enumerates >=5 emitters in the `emitters:` list with first_wave: true on the named 5 (codex-exec, audit, sgsd-readiness-probe, sgsd-muda-audit, atc-review).
- ENV-03: Registry `reconciliation:` block cites all 4 existing contracts by name and asserts `collides_with: []`. None of the 4 existing files modified (verified via `git diff`).
- ENV-04: Registry `mission_strip_read_contract:` block documents tail strategy, filter rule, consumed fields, and status -> pane_state mapping.
- Reason codes: `reason_codes:` master list has >=10 entries with `code:`, `group:`, `description:` keys.
- All verification commands exit 0.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.7/phases/31-canonical-envelope/31-01-SUMMARY.md`
following the standard SUMMARY template. Include:
- which 5 first-wave emitters are listed
- the reason_codes total count
- the reconciliation note location (line range in the YAML)
- explicit confirmation that none of the 4 existing contracts were touched (paste git diff output)
</output>

---
name: sgsd-complete-milestone
description: "Idempotent milestone-close workflow for SGSD v2. Audits governance, summarizes the milestone, and records the VTP publication gap when classification support is missing."
argument-hint: "<version>"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
  - mcp__vtp-kb__vtp_search
  - mcp__vtp-kb__vtp_list_research
  - mcp__vtp-kb__vtp_ingest_research
---

<objective>
Close milestone {{version}} exactly once. This skill is idempotent: if
`.planning/milestones/{{version}}/SUMMARY.md` already exists, exit PASS and do nothing.

This skill is normally auto-triggered by `sgsd-orchestrate` Step 6.7 after the final phase in a
milestone is marked complete.
</objective>

<step_0_precondition>
## Step 0: Precondition + Idempotency

1. Read `.planning/STATE.md` frontmatter and confirm `milestone: {{version}}`.
2. Read `.planning/ROADMAP.md` and verify all milestone phases show `[x]`.
3. Reject if any plan in `.planning/phases/` lacks `schema_version: 2` unless it explicitly
   declares `v1_legacy: true`.
4. If `.planning/milestones/{{version}}/SUMMARY.md` already exists, exit PASS immediately.
5. **Provider health + status-consistency precondition gate.** Run, in order:
   - `bash super-gsd/scripts/codex-exec.sh --self-test` (must exit 0; logs probe metadata)
   - `node super-gsd/tools/provider-health/check.cjs --provider codex --behavioral` (real canary; exit 0 = AVAILABLE, exit 1 = UNAVAILABLE)
   - `node super-gsd/tools/status-consistency/check.cjs --milestone {{version}}` (exit 0 = OK)
   - `node super-gsd/tools/backlog-schema/check.cjs` (exit 0 = no schema violations)
   - `node super-gsd/scripts/lib/crit-backlog.cjs --self-test` (exit 0 = lib healthy)
6. **If provider canary returns UNAVAILABLE (exit 1):** auto mode CONTINUES, but:
   - Append a `verifier_fail` row to `.planning/metrics/crit-backlog.jsonl` via the lib (NOT manual write — the lib's `_guardCodexUnavailableClaim` requires `provider_health_check: { behavioral: true, available: false }` proof which the canary just produced)
   - Carry the row forward to the milestone's `next-debt-milestone` tag
   - Set milestone status accordingly (SHIPPED-WITH-DEBT-N, not SHIPPED clean)
7. **If status-consistency or backlog-schema return non-zero:** STOP — never close a milestone with status that doesn't match backlog reality. Surface the failure in the close report, fix in-loop OR halt for operator.
8. Append milestone-close metadata row to `.planning/metrics/codex-log.jsonl` keyed `step="milestone-close-precondition"` with the canary result + status-consistency exit + backlog-schema exit.
</step_0_precondition>

<step_1_governance_audit>
## Step 1: GOV-05 Deliberation Scoring Audit

1. Read all `.planning/decisions/DLB-*.md` files fired during {{version}}.
2. For each DLB, append one JSON line to
   `.planning/metrics/deliberation-outcomes.jsonl` with:
   `ts`, `milestone`, `dlb_id`, `q1_impl_hours_actual`, `rework_fired`, `falsifier_fired`,
   `revisions_needed`, `confidence_weighted_sum`, `raw_vote`, `reflection_captured`.
3. Also write the milestone-local copy at:
   `.planning/milestones/{{version}}/deliberation-outcomes.jsonl`.
</step_1_governance_audit>

<step_2_muda_recurrence>
## Step 2: MUDA Recurrence Audit

Run:

```bash
bash super-gsd/scripts/sgsd-muda-recurrence.sh --milestone {{version}} --window-ms 2 > .planning/milestones/{{version}}/muda-recurrence.md
```

Record any kill-condition trigger but do not block milestone close.
</step_2_muda_recurrence>

<step_3_codex_kill_check>
## Step 3: Codex Kill-Condition Check (Phase 15+ CODEX-12)

Invoke: `sgsd-token-audit --milestone-close-check`

Read `.planning/config.json` to check if `review_providers.codex_enabled === true`
before running. If `codex_enabled === false`, skip this step (Codex already retired).

Placement rationale (CONTEXT D-23a): Step 3 runs BEFORE cross-phase check (Step 5)
and BEFORE summary generation (Step 6), so the SUMMARY.md reflects the final
Codex-enabled/retired state. If placed after summary gen, the summary would be stale.

In auto mode: log DEVIATION if kill fires, continue to Step 4.
In interactive mode: pause if kill fires, require confirmation before Step 4.
</step_3_codex_kill_check>

<step_4_gate_drift>
## Step 4: Gate Drift Audit

1. Read `.planning/metrics/edge-guard-log.jsonl`.
2. Group missed emits by `gateName`.
3. Write `.planning/milestones/{{version}}/gate-drift-audit.md`.
4. Flag any gate that skip-drifted more than 3 times during the milestone.
</step_4_gate_drift>

<step_5_cross_phase_check>
## Step 5: Cross-Phase Integration Check

Dispatch `gsd-integration-checker` or run the equivalent integration sweep across the archived
phase outputs for {{version}}. If the check finds a blocking regression, halt milestone close.
</step_5_cross_phase_check>

<step_6_summary>
## Step 6: Generate SUMMARY.md

Write `.planning/milestones/{{version}}/SUMMARY.md` with:

- frontmatter including `milestone`, `status`, `vtp_classification_used`, `vtp_research_id`
- shipped phases
- evidence produced this milestone
- rules learned this session
- governance findings
- next-milestone seed
- **Unresolved Repairs** (REPAIR-04, Phase 33): enumerate any gates with
  unresolved `repair_instruction:` text whose CRIT-BACKLOG rows are
  tagged for `{{version}}` and not yet `kind: cleared`.

### Unresolved Repairs section template

Generate this section by calling
`super-gsd/scripts/lib/repair-command-checker.cjs::unresolvedRepairsForMilestone(planningDir, '{{version}}', gatesYamlPath)`
and rendering the returned rows as a markdown table:

```markdown
## Unresolved Repairs (milestone {{version}})

| backlog id | milestone | gate | summary | repair_instruction |
|---|---|---|---|---|
| <id> | <milestone tag from row> | <gate name> | <truncated summary> | <repair_instruction> |
```

**Verification**: every `<milestone tag from row>` MUST equal `{{version}}`.
The helper now retains the milestone field on each row so the SUMMARY
author can sanity-check the filter and reject any leak from a different
milestone version (Phase 33 ATC Codex CRIT 2 fix).

If the helper returns an empty array, write the literal line:
`(no unresolved repairs for this milestone)`.

This converts open repair contracts into explicit accountable backlog
visible at milestone close, instead of silent debt that leaks into the
next milestone.
</step_6_summary>

<step_7_vtp_bidirectional>
## Step 7: VTP Bidirectional Integration

### Read-side enrichment

1. Query `mcp__vtp-kb__vtp_search` for prior milestone-like artifacts and adjacent governance research.
2. Query `mcp__vtp-kb__vtp_list_research` for related research already present in VTP.
3. Fold any relevant findings into the current `SUMMARY.md` Connections section.

### Connections (library-backed) — write-side extension (VTPE-03)

Only runs when `config.vtp_enrichment.enabled === true` (D-07 backward-compat guard).

Using the results already retrieved by the read-side queries above (no new VTP calls):

1. For each hit returned by `mcp__vtp-kb__vtp_search` and `mcp__vtp-kb__vtp_list_research`,
   extract: `pattern_name`, `title` (book/paper), `section`, `confidence`, `notes`.

2. Append a `### Connections (library-backed)` subsection to the `## Connections` section of
   `.planning/milestones/{{version}}/SUMMARY.md` with the following table:

```
### Connections (library-backed)

| Pattern | Book / Paper | Section | Confidence | Notes |
|---|---|---|---|---|
| <pattern_name> | <title> | <section> | <0-1> | <notes> |
```

3. If the read-side returned zero hits, append:
   `### Connections (library-backed)\n\n(no library hits for this milestone — VTP returned empty)`.

4. Set `vtp_connections_library_backed: true` in SUMMARY.md frontmatter when hits > 0;
   set `vtp_connections_library_backed: false` when empty.

This write-side extension reuses Step 7 read-side results — it does NOT fire a new VTP query.

### Publish-side fallback

Current probe verdict from `13-05-01-vtp-probe.md`: tier-3.

- tier-1 would publish with `classification: Milestone`
- tier-2 would publish with `classification: "Milestone (SGSD v2)"`
- tier-3 is the current live path: VTP does not expose milestone classification or metadata fields

For tier-3:

1. Write `.planning/milestones/{{version}}/VTP-CLASSIFICATION-GAP.md` describing the missing API
   fields and the desired `Milestone` taxonomy.
2. Set `vtp_classification_used: gap-tier-3` in `SUMMARY.md` frontmatter.
3. Reserve `.planning/milestones/{{version}}/vtp-research-id.txt` for future write support.
4. If a milestone summary is later mirrored into `wiki/research/{{version}}-milestone.md`,
   run `mcp__vtp-kb__vtp_ingest_research` with that slug as a best-effort enrichment step.
</step_7_vtp_bidirectional>

<step_8_archive>
## Step 8: Archive Phase Artifacts

1. Move milestone phase directories into `.planning/milestones/{{version}}/phases/`.
2. Invalidate per-plan classifier-cache sidecars when archiving.
3. Preserve milestone-local evidence files beside the archive.
</step_8_archive>

<step_9_state_bump>
## Step 9: State Bump

1. Update `.planning/STATE.md` to the next milestone, or set `milestone_status: complete` if
   no next milestone exists.
2. Commit the close-out atomically.
3. Return PASS with a one-line summary.
</step_9_state_bump>

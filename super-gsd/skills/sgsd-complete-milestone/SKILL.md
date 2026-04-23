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

<step_3_gate_drift>
## Step 3: Gate Drift Audit

1. Read `.planning/metrics/edge-guard-log.jsonl`.
2. Group missed emits by `gateName`.
3. Write `.planning/milestones/{{version}}/gate-drift-audit.md`.
4. Flag any gate that skip-drifted more than 3 times during the milestone.
</step_3_gate_drift>

<step_4_cross_phase_check>
## Step 4: Cross-Phase Integration Check

Dispatch `gsd-integration-checker` or run the equivalent integration sweep across the archived
phase outputs for {{version}}. If the check finds a blocking regression, halt milestone close.
</step_4_cross_phase_check>

<step_5_summary>
## Step 5: Generate SUMMARY.md

Write `.planning/milestones/{{version}}/SUMMARY.md` with:

- frontmatter including `milestone`, `status`, `vtp_classification_used`, `vtp_research_id`
- shipped phases
- evidence produced this milestone
- rules learned this session
- governance findings
- next-milestone seed
</step_5_summary>

<step_6_vtp_bidirectional>
## Step 6: VTP Bidirectional Integration

### Read-side enrichment

1. Query `mcp__vtp-kb__vtp_search` for prior milestone-like artifacts and adjacent governance research.
2. Query `mcp__vtp-kb__vtp_list_research` for related research already present in VTP.
3. Fold any relevant findings into the current `SUMMARY.md` Connections section.

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
</step_6_vtp_bidirectional>

<step_7_archive>
## Step 7: Archive Phase Artifacts

1. Move milestone phase directories into `.planning/milestones/{{version}}/phases/`.
2. Invalidate per-plan classifier-cache sidecars when archiving.
3. Preserve milestone-local evidence files beside the archive.
</step_7_archive>

<step_8_state_bump>
## Step 8: State Bump

1. Update `.planning/STATE.md` to the next milestone, or set `milestone_status: complete` if
   no next milestone exists.
2. Commit the close-out atomically.
3. Return PASS with a one-line summary.
</step_8_state_bump>

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
   - Append a `verifier_fail` row to `.planning/metrics/crit-backlog.jsonl` via the lib (NOT manual write -- the lib's `_guardCodexUnavailableClaim` requires `provider_health_check: { behavioral: true, available: false }` proof which the canary just produced)
   - Carry the row forward to the milestone's `next-debt-milestone` tag
   - Set milestone status accordingly (SHIPPED-WITH-DEBT-N, not SHIPPED clean)
7. **If status-consistency or backlog-schema return non-zero:** STOP -- never close a milestone with status that doesn't match backlog reality. Surface the failure in the close report, fix in-loop OR halt for operator.
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

<step_4_5_gate_keep_kill_rubric>
## Step 4.5: Gate Keep/Kill Rubric (Phase 39 -- RUBRIC-01..04)

Run the mechanical rubric over the milestone's gate telemetry. The
rubric reads `.planning/metrics/gate-value-log.jsonl` (Phase 36),
`.planning/metrics/review-ledger.jsonl` (Phase 34),
`.planning/metrics/edge-guard-log.jsonl` (defensive: may be absent),
and `super-gsd/registry/gates.yaml` (read-only).

```javascript
// Phase 39 ATC W3 fix: anchor planningDir to process.cwd() at the
// orchestrator-skill boundary explicitly (not bare relative '.planning'
// string which would resolve relative to wherever node was invoked from).
// Phase 36 W2 lesson: cwd-fallback regression class.
const path = require('path');
const fs   = require('fs');
const { runRubric, renderTable } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'gate-keep-kill', 'rubric.cjs')
);
const planningDir = path.join(process.cwd(), '.planning');
const rows = runRubric(planningDir, { milestone: '{{version}}' });
const md   = renderTable(rows);
fs.writeFileSync(
  path.join(planningDir, 'milestones', '{{version}}', 'gate-keep-kill.md'),
  '# Gate Keep/Kill Rubric (milestone {{version}})\n\n' +
  '> Mechanical recommendation. Manual override at operator judgment.\n' +
  '> Locked decision 39=B: auto-execute kills are deferred to operator.\n\n' +
  md + '\n', 'utf8');
```

Per lock 39=B: this step ONLY produces the recommendation table. The
operator (or future automation explicitly added in v1.9+) decides
whether to act on `kill` rows. The script does NOT mutate
`super-gsd/registry/gates.yaml` or any registry file.

Defer-on-empty (RUBRIC-03): gates with zero fires in
`gate-value-log.jsonl` MUST classify as `defer`, not `kill`. The first
v1.8 close will produce a table where most gates are `defer` with reason
`no_fires_yet` -- correct cold-start state.
</step_4_5_gate_keep_kill_rubric>

<step_4_6_phase_folder_audit>
## Step 4.6: Phase Folder Audit (Phase 40 -- AUDIT-01..05)

Walk every phase folder for milestone {{version}} and emit a soft-warn-only
audit recording required + recommended file presence. Per lock 40=B:
records the verdict table; operator decides whether to backfill missing
files. Read-only -- the auditor NEVER mutates any phase folder.

```javascript
// Phase 40 wire-in: anchor planningDir to process.cwd() at the
// orchestrator-skill boundary (mirrors Step 4.5 Phase 39 ATC W3 fix;
// Phase 36 W2 + Phase 39 W2 lessons: NEVER bare relative '.planning').
const path = require('path');
const fs   = require('fs');
const { auditAllPhases, renderTable } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'phase-folder-audit', 'audit.cjs')
);
const planningDir = path.join(process.cwd(), '.planning');
const audits = auditAllPhases(planningDir, { milestone: '{{version}}' });
const md     = renderTable(audits);
fs.writeFileSync(
  path.join(planningDir, 'milestones', '{{version}}', 'phase-folder-audit.md'),
  '# Phase Folder Audit (milestone {{version}})\n\n' +
  '> Soft-warn only. Locked decision 40=B: required + recommended\n' +
  '> file checks; no content schema; no folder modification.\n\n' +
  md + '\n', 'utf8');
```

Per lock 40=B: this step ONLY produces the verdict table. The script
NEVER mutates any phase folder. Self-test fingerprint guard
(audit.cjs assertion 13) binds the read-only invariant.

Defer-on-empty: if `auditAllPhases` returns `[]`, the rendered table reads
`(no phase folders found for this milestone)` and Step 6 references that
file as-is. Soft-warn semantics never block close.
</step_4_6_phase_folder_audit>

<step_4_7_token_waste_check>
## Step 4.7: Token Waste Admission Check (Phase 42 -- BUDGET-01..05)

Run the read-only token-waste check over the milestone's
`.planning/metrics/agent-token-spend.jsonl` ledger (Phase 41).
The check emits one envelope-v1 row to
`.planning/metrics/token-waste-status.jsonl` and renders a verdict
table to `.planning/milestones/{{version}}/token-waste.md`.

Per design lock 13 (REQUIREMENTS.md:67-68): a degraded verdict
continues autonomy. The check NEVER halts close. Halt remains
reserved for the four hard-stop conditions in
`SGSD-HANDOVER.md:79-86`.

```javascript
// Phase 42 wire-in: anchor planningDir to process.cwd() at the
// orchestrator-skill boundary (mirrors Step 4.5 Phase 39 ATC W3 +
// Step 4.6 Phase 40 W3 fixes). NEVER bare relative '.planning'.
const path = require('path');
const fs   = require('fs');
const { runCheck, renderTable, appendCheckRun } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'token-waste', 'check.cjs')
);
const planningDir = path.join(process.cwd(), '.planning');
const result = runCheck(planningDir, { milestone: '{{version}}' });
const md     = renderTable(result);
fs.writeFileSync(
  path.join(planningDir, 'milestones', '{{version}}', 'token-waste.md'),
  '# Token Waste (milestone {{version}})\n\n' +
  '> Soft-warn / degraded only. Per design lock 13:\n' +
  '> "Autonomy continues; evidence tells the truth."\n' +
  '> Halt remains reserved for SGSD-HANDOVER.md:79-86 hard stops.\n\n' +
  md + '\n', 'utf8');
// Append envelope-v1 row to token-waste-status.jsonl. NEVER throws
// upward; on failure, returns false and Step 5 continues.
appendCheckRun(planningDir, result);
```

Per lock 13: this step ONLY produces verdict + envelope row + table.
The script NEVER mutates `super-gsd/registry/gates.yaml` or any
canonical token stream (5 streams + budgets.yaml byte-identical
pre/post). `degraded` verdict in the table maps to envelope
status='warn' (NOT 'blocked'); cockpit consumers must read
`verdict` (Phase 42 ext field) for the 4-state ladder, not
`status`.

Defer-on-empty: if `agent-token-spend.jsonl` is absent or empty
(no Phase 41 backfill yet), `runCheck` returns
`{verdict:'ok', totals:{rows_evaluated:0}}` and the rendered table
reads `(no rows evaluated; agent-token-spend.jsonl absent or empty)`.
Soft-warn semantics never block close.

Token-waste-status JSONL row: `appendCheckRun` appends ONE
envelope-v1 row per close run (run_id unique). Cockpit (Phase 50)
reads "latest by scope" via `ts` ordering; no dedup needed.
</step_4_7_token_waste_check>

<step_4_7b_phase_capsule_backfill>
## Step 4.7-bis: Phase Capsule Backfill Safety-Net (Phase 43 -- CAP-04)

Run the read-only phase-capsule backfill across all phases of the closing
milestone. Forward-flow Step 6.6.i.X writes capsules per-phase as they
close; this step is the safety-net for phases that:

  (a) closed BEFORE Phase 43 shipped (the 17 historical capsules),
  (b) had Step 6.6.i.X fail at phase-close time (git unavailable,
      crit-backlog unreadable, etc. -- writeCapsule returns ok:false but
      orchestrator continues per Lock 13).

Per design lock 13 (REQUIREMENTS.md:67-68): backfill failures NEVER halt
milestone close. writeAllCapsulesForMilestone wraps internals in
try/catch and returns { written:N, skipped:M, errors:[...] }; errors
log to .planning/metrics/context-complaints.jsonl; Step 5 continues.

Idempotent: capsules with matching content_hash are skipped (mtime
preserved); A3 acceptance binds.

```javascript
// Phase 43 wire-in: anchor planningDir to process.cwd() at the
// orchestrator-skill boundary (mirrors Step 4.5 Phase 39 ATC W3 +
// Step 4.6 Phase 40 W3 + Step 4.7 Phase 42 BUDGET fixes).
// NEVER bare relative '.planning'.
const path = require('path');
const { writeAllCapsulesForMilestone } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'phase-capsule', 'write.cjs')
);
const planningDir = path.join(process.cwd(), '.planning');
const result = writeAllCapsulesForMilestone(planningDir, '{{version}}');
// result: { written:N, skipped:M, errors:[...] }
// NEVER throws. On non-empty errors: rows appended to
// .planning/metrics/context-complaints.jsonl already (writeCapsule does
// this internally). Step 5 cross-phase check runs regardless.
```

Per lock 5: phase capsule is a PROJECTION of canonical .planning + git;
canonical state is not touched. Per lock 13: backfill failures continue
autonomy. Per lock 6: bypass entries copied verbatim, never summarized.

Defer-on-empty: if `.planning/milestones/{{version}}/phases/` is absent
(empty milestone), `writeAllCapsulesForMilestone` returns
`{written:0, skipped:0, errors:[...]}` with reason
`phase_capsule_backfill_milestone_missing` and Step 5 continues.

PHASE-INDEX.jsonl: writeAllCapsulesForMilestone updates
`.planning/milestones/{{version}}/PHASE-INDEX.jsonl` per call. Cockpit
(Phase 50) reads this index for fast scan; the per-phase
PHASE-CAPSULE.json holds detail. Capsule = projection. Canonical =
.planning + git.
</step_4_7b_phase_capsule_backfill>

<step_4_7c2_memory_governance_revalidate>
## Step 4.7-quater: Memory Governance Revalidation Sweep (Phase 49 -- GOV-08, A6)

After Step 4.7-bis Phase Capsule Backfill completes, sweep all
PHASE-CAPSULE.json under the closing milestone and call Phase 49 revalidate
per capsule. revalidate() re-hashes each capsule's source_refs[] against
current canonical files; mismatches OR existsSync===false set
revalidation_due=true on the capsule AND append a row to
.planning/metrics/memory-revalidations.jsonl (envelope-v1).

Per design lock 13 (REQUIREMENTS.md:67-68): revalidate NEVER auto-revokes.
Drift surfaces as a flag for downstream consumers (Phase 49 loadIndexSnippets,
Phase 50 cockpit). Revocation is mechanical-but-explicit -- triggered by
operator decision or by Phase 49 processComplaints classification, never
by revalidate() itself.

Per RESEARCH sec Q6 (Phase 49 49-RESEARCH.md L1014-1023): read-pulled
revalidation; lazy on access. The milestone-close sweep is a one-shot
batch for audit; ongoing drift detection happens at consumption time
inside loadIndexSnippets.

```javascript
// Phase 49 wire-in: anchor planningDir to process.cwd() at the
// orchestrator-skill boundary (mirrors Step 4.7-bis writeAllCapsulesForMilestone
// pattern).
const path = require('path');
const fs = require('fs');
const { revalidate, _capsuleArtifactId } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'memory-governance', 'lifecycle.cjs')
);
const { readCapsule } = require(
  path.join(process.cwd(), 'super-gsd', 'tools', 'phase-capsule', 'write.cjs')
);
const planningDir = path.join(process.cwd(), '.planning');
const milestoneDir = path.join(planningDir, 'milestones', '{{version}}', 'phases');

let totalChecked = 0;
let driftDetected = 0;
let errors = 0;

try {
  if (fs.existsSync(milestoneDir)) {
    const phases = fs.readdirSync(milestoneDir);
    for (const ph of phases) {
      try {
        const capPath = path.join(milestoneDir, ph, 'PHASE-CAPSULE.json');
        if (!fs.existsSync(capPath)) continue;
        const phaseNum = (ph.match(/^(\d+(?:\.\d+)?)-/) || [])[1];
        if (!phaseNum) continue;
        const cap = readCapsule(planningDir, '{{version}}', phaseNum);
        if (!cap) continue;
        const artifactId = _capsuleArtifactId(cap);
        const result = revalidate(artifactId, { planningDir: planningDir });
        totalChecked++;
        if (result && result.drift_detected) driftDetected++;
      } catch (_e) {
        errors++;
      }
    }
  }
} catch (_e) {
  // Lock 13: milestone close NEVER halts on Phase 49 failure.
}
// result aggregated: log to context-complaints.jsonl if errors > 0.
// Step 4.7-ter (intent-map close) continues regardless.
```

Per lock 5: phase capsule is a PROJECTION; revalidate edits ONLY lifecycle
fields on the existing PHASE-CAPSULE.json (additive; routed through Phase 43
schema validation). Per lock 13: revalidate failures continue milestone
close. Per lock 6: bypass entries are not revalidated (Lock 6 carve-out --
bypass refs were never promoted past phase_capsule, so their source_refs[]
are not stored on the capsule for revalidation).

Defer-on-empty: if .planning/milestones/{{version}}/phases/ is absent
(empty milestone), the walk is a no-op and Step 4.7-ter continues.

memory-revalidations.jsonl: revalidate appends one envelope-v1 row per
drift-detected capsule. Cockpit (Phase 50) reads this stream for "recently
revalidated" panel; Phase 51 BENCH-08 reads for evidence_retention metric.

</step_4_7c2_memory_governance_revalidate>

<step_4_7c_intent_packet_close>
## Step 4.7-ter: Intent-Map + Packet-Log Close (Phase 45 -- PACKET-00, PACKET-05, Lock 13)

Bindings:
- PACKET-00: read-only tail of `.planning/metrics/intent-map.jsonl` (intent map ledger).
- PACKET-05: read-only tail of `.planning/metrics/context-packet-log.jsonl` (packet log ledger).

Read-only summary across the closing milestone's intent-map +
context-packet + context-complaints ledger tails. NEVER rewrites or
compacts; NEVER halts milestone close (Lock 13).

```javascript
const path = require('path');
const planningDir = path.join(process.cwd(), '.planning');

function safeReadJsonlTail(p, sinceTs) {
  try {
    const fs = require('fs');
    if (!fs.existsSync(p)) return [];
    return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch (_) { return null; } })
      .filter(r => r && (!sinceTs || r.ts >= sinceTs));
  } catch (_) { return []; }
}
const since24h = new Date(Date.now() - 86400000).toISOString();
const intentRows  = safeReadJsonlTail(path.join(planningDir, 'metrics', 'intent-map.jsonl'), since24h);
const packetRows  = safeReadJsonlTail(path.join(planningDir, 'metrics', 'context-packet-log.jsonl'), since24h);
const complaints  = safeReadJsonlTail(path.join(planningDir, 'metrics', 'context-complaints.jsonl'), since24h);
// Emit summary counts to milestone-close artifacts:
//   intent_maps_compiled, packets_built_clean, packets_with_omitted_material,
//   packets_p41_bloat_avoided, prompt_injection_filtered_count,
//   semantic_only_demoted_count, total_omitted_tokens, total_bypass_preserved.
// Read-only; never throws upward (Lock 13). Step 5 continues regardless.
```
</step_4_7c_intent_packet_close>

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

### Gate Keep/Kill Rubric subsection (Phase 39 -- RUBRIC-04)

Append to SUMMARY.md a new subsection AFTER `## Unresolved Repairs` and
BEFORE the existing `## Connections` section. Source: read the file
`.planning/milestones/{{version}}/gate-keep-kill.md` produced by Step 4.5;
embed its contents inline:

```markdown
## Gate Keep/Kill Rubric (milestone {{version}})

> Mechanical recommendation. Operator judgment for any `kill` row.

{{contents of .planning/milestones/{{version}}/gate-keep-kill.md}}
```

If `.planning/milestones/{{version}}/gate-keep-kill.md` does not exist
(Step 4.5 failed), write the literal line:
`(rubric output unavailable -- see provider_unavailable log)`.

### Phase Folder Audit subsection (Phase 40 -- AUDIT-05)

Append to SUMMARY.md a new subsection AFTER `## Gate Keep/Kill Rubric` and
BEFORE the existing `## Connections` section. Source: read the file
`.planning/milestones/{{version}}/phase-folder-audit.md` produced by
Step 4.6; embed its contents inline:

```markdown
## Phase Folder Audit (milestone {{version}})

> Soft-warn only. Per lock 40=B.

{{contents of .planning/milestones/{{version}}/phase-folder-audit.md}}
```

If `.planning/milestones/{{version}}/phase-folder-audit.md` does not exist
(Step 4.6 failed), write the literal line:
`(phase-folder audit unavailable -- see audit-skipped log)`.

### Token Waste subsection (Phase 42 -- BUDGET-05)

Append to SUMMARY.md a new subsection AFTER `## Phase Folder Audit` and
BEFORE the existing `## Connections` section. Source: read the file
`.planning/milestones/{{version}}/token-waste.md` produced by Step 4.7;
embed its contents inline:

```markdown
## Token Waste (milestone {{version}})

> Per design lock 13: degraded continues autonomy. Operator may
> consider provider substitution per emitted route_hints; the check
> itself never halts.

{{contents of .planning/milestones/{{version}}/token-waste.md}}
```

If `.planning/milestones/{{version}}/token-waste.md` does not exist
(Step 4.7 failed), write the literal line:
`(token-waste output unavailable -- see token-waste-status.jsonl)`.
</step_6_summary>

<step_7_vtp_bidirectional>
## Step 7: VTP Bidirectional Integration

### Read-side enrichment

1. Query `mcp__vtp-kb__vtp_search` for prior milestone-like artifacts and adjacent governance research.
2. Query `mcp__vtp-kb__vtp_list_research` for related research already present in VTP.
3. Fold any relevant findings into the current `SUMMARY.md` Connections section.

### Connections (library-backed) -- write-side extension (VTPE-03)

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
   `### Connections (library-backed)\n\n(no library hits for this milestone -- VTP returned empty)`.

4. Set `vtp_connections_library_backed: true` in SUMMARY.md frontmatter when hits > 0;
   set `vtp_connections_library_backed: false` when empty.

This write-side extension reuses Step 7 read-side results -- it does NOT fire a new VTP query.

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

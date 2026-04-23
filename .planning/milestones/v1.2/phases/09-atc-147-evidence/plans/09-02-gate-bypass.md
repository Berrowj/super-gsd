---
phase: 09-atc-147-evidence
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/09-atc-147-evidence/09-gate-bypass.yaml
autonomous: true
requirements:
  - ATC-147-03

# v2 schema self-referential frontmatter
schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: t1-bypass-audit
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/09-atc-147-evidence/09-gate-bypass.yaml
    input_contract: |
      09-RESEARCH.md §Per-Gate Token Budget (the 9-row verified table) and §Worked Denominator Math
      (upper-bound total = 18,940 tokens; lower-bound = 9,340 tokens).
      CONTEXT.md D-03, D-03a, D-03b (row shape, 16 T-commit denominator, per-phase vs per-dispatch partition).
      sgsd-orchestrate/SKILL.md (authoritative token-budget source cited by the research table).
    output_contract: |
      YAML at .planning/phases/09-atc-147-evidence/09-gate-bypass.yaml with keys:
      dispatches_denominator (int = 16), phase_close_events (int = 1),
      audit (list of exactly 9 rows with: gate, step, class, per_dispatch_tokens,
      dispatches_bypassed, total_bypass_cost, fired_retroactively, verdict_pointer_to_phase_10),
      totals (map with upper_bound and lower_bound totals in tokens).
    hypothesis: |
      Mechanical arithmetic over SKILL.md-declared per-gate token budgets multiplied by 16 T-commit
      dispatches (or by 1 for per-phase gates 6 and 7) produces a reproducible, spec-anchored bypass
      cost table that Phase 10 can keep/kill against without re-simulating the phase.
    falsifier: |
      audit.length ≠ 9, OR any row's multiplier is wrong (per-phase gate multiplied by 16), OR
      total_bypass_cost row-value ≠ per_dispatch_tokens × dispatches_bypassed, OR gate 6 row lacks
      fired_retroactively: true, OR gate names don't match the canonical 9 from CONTEXT.md D-03.
    stop_rule: |
      09-gate-bypass.yaml exists, parses as YAML, all 9 canonical gate names present,
      gates 6+7 have dispatches_bypassed=1 and class=per-phase, others have dispatches_bypassed=16
      and class=per-dispatch, gate 6 row has fired_retroactively: true.
    verification_cmd: |
      node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const d=y.load(fs.readFileSync('.planning/phases/09-atc-147-evidence/09-gate-bypass.yaml','utf8'));if(d.audit.length!==9)process.exit(1);const perPhase=d.audit.filter(r=>r.class==='per-phase').map(r=>r.step).sort();if(JSON.stringify(perPhase)!==JSON.stringify([6,7]))process.exit(2);const g6=d.audit.find(r=>r.step===6);if(!g6||g6.fired_retroactively!==true)process.exit(3);for(const r of d.audit){if(r.total_bypass_cost!==r.per_dispatch_tokens*r.dispatches_bypassed&&typeof r.per_dispatch_tokens==='number')process.exit(4);}console.log('PASS');"

must_haves:
  truths:
    - "All 9 canonical bypassed gates from 09-CONTEXT.md D-03 have audit rows"
    - "Per-dispatch gates (1, 2, 3, 4, 5, 8, 9) multiply by 16 T-commits"
    - "Per-phase gates (6, 7) multiply by 1 phase-close event — NOT by 16"
    - "Gate 6 (phase-level ATC) is flagged fired_retroactively: true"
    - "Each row has a verdict_pointer_to_phase_10 field with a one-line keep/kill question"
    - "Totals block reports both upper and lower bounds (per 09-RESEARCH.md)"
  artifacts:
    - path: ".planning/phases/09-atc-147-evidence/09-gate-bypass.yaml"
      provides: "9-row gate-bypass token-cost audit with per-dispatch vs per-phase partition"
      contains: "audit (9 rows), totals.upper_bound, totals.lower_bound, dispatches_denominator"
  key_links:
    - from: ".planning/phases/09-atc-147-evidence/09-gate-bypass.yaml"
      to: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      via: "per_dispatch_tokens values sourced from SKILL.md line citations in 09-RESEARCH.md §Per-Gate Token Budget"
      pattern: "per_dispatch_tokens:"
---

<objective>
Produce the 9-row gate-bypass token-cost audit as a YAML artefact Phase 10 can consume.

Purpose: Satisfies ATC-147-03. Enumerates the 9 CLAUDE-OVERLAY gates Phase 147 bypassed and multiplies each gate's per-dispatch (or per-phase) token budget by the correct denominator (16 T-commits for per-dispatch, 1 for per-phase) to produce a keep/kill-input cost table.

Output: `.planning/phases/09-atc-147-evidence/09-gate-bypass.yaml` — YAML with 9 rows, per-class multipliers, per-row total, upper+lower bound totals, retroactive-fire flag on gate 6.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-atc-147-evidence/09-CONTEXT.md
@.planning/phases/09-atc-147-evidence/09-RESEARCH.md
@.planning/REQUIREMENTS.md
</context>

<interfaces>
<!-- Required YAML shape — copy this skeleton and fill in values from 09-RESEARCH.md §Per-Gate Token Budget. -->

```yaml
# .planning/phases/09-atc-147-evidence/09-gate-bypass.yaml
generated_at: 2026-04-22
source_review: ../../../../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md
budget_source: super-gsd/skills/sgsd-orchestrate/SKILL.md
dispatches_denominator: 16       # T-commits in Phase 147 per SUMMARY.md T1→T16
phase_close_events: 1            # for per-phase gates 6, 7
audit:
  - gate: "Haiku classifier"
    step: 2
    class: per-dispatch
    per_dispatch_tokens: 50
    dispatches_bypassed: 16
    total_bypass_cost: 800
    fired_retroactively: false
    verdict_pointer_to_phase_10: "<one-line question Phase 10 must resolve>"
  - gate: "Haiku context-selector"
    step: 4
    class: per-dispatch
    per_dispatch_tokens: 100
    dispatches_bypassed: 16
    total_bypass_cost: 1600
    fired_retroactively: false
    verdict_pointer_to_phase_10: "..."
  - gate: "ByteRover query injection"
    step: 5
    class: per-dispatch
    per_dispatch_tokens: 600   # bounded: 3 queries × 200 cap per config.json
    dispatches_bypassed: 16
    total_bypass_cost: 9600
    fired_retroactively: false
    verdict_pointer_to_phase_10: "..."
  - gate: "INTENT injection"
    step: 5.5
    class: per-dispatch
    per_dispatch_tokens: 30
    dispatches_bypassed: 16
    total_bypass_cost: 480
    fired_retroactively: false
    verdict_pointer_to_phase_10: "..."
  - gate: "Per-dispatch ATC (Step 9.5)"
    step: 9.5
    class: per-dispatch
    per_dispatch_tokens: 300   # FULL tier; LITE/SKIP pay 0 (hence lower bound)
    dispatches_bypassed: 16
    total_bypass_cost: 4800
    fired_retroactively: false
    verdict_pointer_to_phase_10: "..."
  - gate: "Phase-level ATC (Step 6.5)"
    step: 6
    class: per-phase
    per_dispatch_tokens: 600
    dispatches_bypassed: 1
    total_bypass_cost: 600
    fired_retroactively: true   # deferred, not skipped — review we're classifying IS this gate
    verdict_pointer_to_phase_10: "Keep/kill is about SCHEDULING (inline vs deferred), not existence."
  - gate: "MUDA waste audit (Step 6.55)"
    step: 7
    class: per-phase
    per_dispatch_tokens: 100
    dispatches_bypassed: 1
    total_bypass_cost: 100
    fired_retroactively: false
    verdict_pointer_to_phase_10: "..."
  - gate: "sgsd-curate learnings (Step 10)"
    step: 10
    class: per-dispatch
    per_dispatch_tokens: 50
    dispatches_bypassed: 16
    total_bypass_cost: 800
    fired_retroactively: false
    verdict_pointer_to_phase_10: "..."
  - gate: "Token-log JSONL (Step 11)"
    step: 11
    class: per-dispatch
    per_dispatch_tokens: 10   # ASSUMPTION A1 — conservative; SKILL.md doesn't declare
    dispatches_bypassed: 16
    total_bypass_cost: 160
    fired_retroactively: false
    verdict_pointer_to_phase_10: "..."
totals:
  upper_bound_tokens: 18940    # all gates firing at declared budgets, ATC at FULL tier
  lower_bound_tokens: 9340     # per-dispatch ATC firing at LITE/SKIP on most dispatches
  note: "Upper assumes all 16 dispatches would have hit per-dispatch ATC at FULL tier; lower assumes LITE/SKIP."
assumptions:
  - id: A1
    claim: "Token-log Step 11 costs ~10 tokens per dispatch"
    source: "09-RESEARCH.md §Assumptions Log A1 — SKILL.md does not declare an explicit number"
  - id: A2
    claim: "Phase 147's 1 dispatch = 1 T-task = 1 commit pattern held uniformly, giving 16-dispatch denominator"
    source: "09-RESEARCH.md §Dispatch Counting Semantics, verified against external SUMMARY.md T1→T16 table"
```

**Gate name canonical list (from CONTEXT.md D-03 — must match exactly):**
1. Haiku classifier (Step 2)
2. Haiku context-selector (Step 4)
3. ByteRover query injection (Step 5)
4. INTENT injection (Step 5.5)
5. Per-dispatch ATC (Step 9.5)
6. Phase-level ATC (Step 6.5)
7. MUDA waste audit (Step 6.55)
8. sgsd-curate learnings (Step 10)
9. Token-log JSONL (Step 11)

**Critical partition (Pitfall 1 from 09-RESEARCH.md):**
- per-dispatch × 16: gates 1, 2, 3, 4, 5, 8, 9 (seven gates)
- per-phase × 1: gates 6, 7 (two gates)
- Multiplying gate 6 or 7 by 16 inflates the audit 16× — verifier catches this.

**Critical retroactive flag (Pitfall 2):** Gate 6 (step: 6) row MUST carry `fired_retroactively: true`. The retroactive ATC review we're classifying IS this gate output, fired 1 day late.
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Author 09-gate-bypass.yaml from researcher's verified cost table</name>
  <files>.planning/phases/09-atc-147-evidence/09-gate-bypass.yaml</files>

  <read_first>
    - .planning/phases/09-atc-147-evidence/09-CONTEXT.md (D-03, D-03a, D-03b — canonical 9 gates list, 16-T-commit denominator lock, per-phase vs per-dispatch partition, row shape, retroactive flag on gate 6)
    - .planning/phases/09-atc-147-evidence/09-RESEARCH.md (§Per-Gate Token Budget — the 9-row verified SKILL.md line citations; §Worked Denominator Math — the exact arithmetic this plan must reproduce; §Pitfalls 1 + 2 — the two failure modes verifier checks)
    - super-gsd/skills/sgsd-orchestrate/SKILL.md lines 36-44, 246-247, 424-425, 466, 594, 615-632, 731 (only if verifying a budget value looks off — 09-RESEARCH.md already cites these)
  </read_first>

  <action>
Step 1 — This is a MECHANICAL authoring task. No sub-agent dispatch needed. Copy the skeleton from the <interfaces> block above and fill in every value from 09-RESEARCH.md §Per-Gate Token Budget + §Worked Denominator Math. The budget values and multipliers are already verified; do NOT re-derive.

Step 2 — Write `verdict_pointer_to_phase_10` for each of the 9 rows. One-line questions Phase 10's keep/kill deliberation will need to resolve. Examples (you may paraphrase but keep them concrete):
- Gate 1 (classifier): "Was the bypass defensible because all 16 T-commits were same-type linear TDD tasks? Phase 10 to decide the skip-rule predicate."
- Gate 2 (context-selector): "Does context-selection add signal on homogeneous-task phases, or only on mixed-concern phases?"
- Gate 3 (ByteRover): "Does ByteRover query injection warrant 600 tokens/dispatch on a fresh-codebase phase with no prior similar patterns to recall?"
- Gate 4 (INTENT): "30 tokens × 16 = 480 is tiny. Argument for kill is 'friction', not cost. Phase 10 weighs friction."
- Gate 5 (per-dispatch ATC): "The review's own §5 says per-dispatch ATC would NOT have caught W1/W2 (cross-task integration gaps). Phase 10 decides if per-dispatch ATC keeps value for intra-task issues only."
- Gate 6 (phase ATC): "Cost was PAID, just at phase+1 boundary. Phase 10 decides inline-vs-deferred scheduling, not keep-vs-kill."
- Gate 7 (MUDA): "100 tokens is nearly free. Argument for kill is redundancy with ATC, not cost."
- Gate 8 (sgsd-curate): "50 tokens × 16 = 800. On a phase with low novelty (TDD repeated pattern), curate may produce zero new patterns — Phase 10 decides entropy-gating."
- Gate 9 (token-log): "Near-zero cost. Keep by default; kill only if logging itself causes issues."

Step 3 — Fill the `totals` block with upper_bound: 18940 and lower_bound: 9340 per 09-RESEARCH.md §Worked Denominator Math. Add the `note` explaining the bound semantics verbatim from research.

Step 4 — Fill the `assumptions` list with A1 and A2 from 09-RESEARCH.md §Assumptions Log (both are hot-spots flagged by the researcher).

Step 5 — Run the verification_cmd script (see frontmatter). All assertions must pass:
  1. audit.length === 9
  2. per-phase gates are exactly steps 6 and 7
  3. gate at step: 6 has fired_retroactively: true
  4. For every row: total_bypass_cost === per_dispatch_tokens × dispatches_bypassed (skip rows with non-numeric per_dispatch_tokens)
  </action>

  <acceptance_criteria>
- File exists: `test -f .planning/phases/09-atc-147-evidence/09-gate-bypass.yaml`
- YAML parses + structural assertions pass (verification_cmd exits 0)
- Exactly 9 audit rows: the verifier script covers this (process.exit(1) if !== 9)
- Per-phase partition correct: the verifier script covers this (process.exit(2) if steps !== [6,7])
- Gate 6 retroactive flag set: the verifier script covers this (process.exit(3) if !fired_retroactively)
- Arithmetic correct on every row: the verifier script covers this (process.exit(4) if any row's total ≠ per_dispatch × dispatches_bypassed)
- All 9 canonical gate names present: `grep -cE "^\s+- gate:" .planning/phases/09-atc-147-evidence/09-gate-bypass.yaml` returns exactly 9
- Gate 6 row exists at step: 6: `grep -q "step: 6$" .planning/phases/09-atc-147-evidence/09-gate-bypass.yaml`
- Totals block has both bounds: `grep -q "upper_bound_tokens: 18940" .planning/phases/09-atc-147-evidence/09-gate-bypass.yaml && grep -q "lower_bound_tokens: 9340" .planning/phases/09-atc-147-evidence/09-gate-bypass.yaml`
- 16-T-commit denominator declared: `grep -q "dispatches_denominator: 16" .planning/phases/09-atc-147-evidence/09-gate-bypass.yaml`
  </acceptance_criteria>

  <verify>
    <automated>node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const d=y.load(fs.readFileSync('.planning/phases/09-atc-147-evidence/09-gate-bypass.yaml','utf8'));if(d.audit.length!==9)process.exit(1);const perPhase=d.audit.filter(r=>r.class==='per-phase').map(r=>r.step).sort((a,b)=>a-b);if(JSON.stringify(perPhase)!==JSON.stringify([6,7]))process.exit(2);const g6=d.audit.find(r=>r.step===6);if(!g6||g6.fired_retroactively!==true)process.exit(3);for(const r of d.audit){if(typeof r.per_dispatch_tokens==='number'&&r.total_bypass_cost!==r.per_dispatch_tokens*r.dispatches_bypassed)process.exit(4);}console.log('PASS');"</automated>
  </verify>

  <done>
- 09-gate-bypass.yaml committed with `feat(09-02): 9-gate bypass cost audit with retroactive flag on gate 6`
- Verification command exits 0
- All 9 acceptance criteria grep assertions pass
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Research table → YAML artefact | The 9-row cost table in 09-RESEARCH.md is transcribed to machine-readable YAML. Transcription errors would propagate to Phase 10. |
| SKILL.md budget → audit row | Per-gate per_dispatch_tokens values are sourced from SKILL.md line citations. SKILL.md drift (future edit) would stale the audit. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-02-01 | Tampering | audit row arithmetic | mitigate | Verifier asserts `total_bypass_cost === per_dispatch_tokens × dispatches_bypassed` on every numeric row. Transcription error fails the commit. |
| T-09-02-02 | Information-disclosure | per-phase × 16 inflation (Pitfall 1) | mitigate | Verifier asserts exactly steps [6, 7] are class=per-phase. Any other row marked per-phase fails; any of 6/7 marked per-dispatch would also fail the partition check. |
| T-09-02-03 | Repudiation | Gate 6 claimed bypassed when actually deferred (Pitfall 2) | mitigate | Verifier asserts step:6 row has `fired_retroactively: true`. The retroactive nuance is load-bearing for Phase 10's inline-vs-deferred deliberation. |
| T-09-02-04 | Information-disclosure | SKILL.md budget drift | accept | Audit cites SKILL.md line numbers via 09-RESEARCH.md. Any future SKILL.md edit that changes a per-step budget requires re-running this plan; revert clause in the registry doc (plan 03) flags this. |
</threat_model>

<verification>
Post-authoring gate (run before commit):
1. Verification script exits 0 (the 4 structural + arithmetic assertions)
2. 9 canonical gate names all appear via grep
3. Totals block declares both 18940 upper / 9340 lower bounds
4. dispatches_denominator: 16 appears verbatim
</verification>

<success_criteria>
- ATC-147-03 satisfied: 9 skipped gates have token-cost estimates.
- Per-dispatch vs per-phase partition is mechanically enforced (not just commented) — the class field is load-bearing and verifier-checked.
- Gate 6's retroactive-fire nuance is preserved (flag + verdict_pointer both explain "deferred, not skipped").
- Assumption hotspots (A1 token-log, A2 dispatch-commit 1:1) are documented in the YAML itself, not only in research.
</success_criteria>

<output>
After completion, create `.planning/phases/09-atc-147-evidence/plans/09-02-SUMMARY.md` summarising:
- The 9-gate audit's upper and lower bound totals (18940 / 9340 tokens)
- Any values that deviated from 09-RESEARCH.md §Per-Gate Token Budget (none expected)
- Confirmation that gate 6 carries fired_retroactively: true
- The single commit SHA
</output>

---
milestone: v1.8
name: Gate Fitness And MUDA Pruning
status: active
created: 2026-04-27
---

# v1.8 Requirements

## Mission

Move from blanket gate-firing toward evidence-based gate fitness and
MUDA pruning. Each gate carries telemetry (Phase 36); MUDA emits deletion
candidates with rollback paths (Phase 37); risk-tiered sampling intersects
gates × work-risk classification (Phase 38); a mechanical keep/kill rubric
reviews gates at milestone close (Phase 39); a phase-folder-audit catches
incomplete deliverables (Phase 40, soft-warn).

## TELEMETRY lane (Phase 36)

- [ ] **GVAL-01** `gate-value-log.jsonl` writer module with `--self-test`
- [ ] **GVAL-02** Wire into orchestrator phase-level-ATC + per-dispatch-ATC fires (>=1 production caller)
- [ ] **GVAL-03** Each row: `gate, outcome in {pass,warn,block,skip}, phase, milestone, ts, run_id, retroactive_fields`
- [ ] **GVAL-04** `--summary` aggregates by gate

## MUDA lane (Phase 37)

- [ ] **MUDA-01** WASTE.md template extension with `## Deletion Candidates` section
- [ ] **MUDA-02** 3 heuristics: low_value, recurring, skip_drift
- [ ] **MUDA-03** Each candidate row: `kind, target, evidence, risk, rollback`
- [ ] **MUDA-04** Wired into `super-gsd/scripts/sgsd-muda-audit.sh` (or post-hook) to invoke after WASTE.md write

## SAMPLING lane (Phase 38)

- [ ] **SAMPLE-01** Every gate in `gates.yaml` has `gate_sampling_tier:` field
- [ ] **SAMPLE-02** Classifier emits `work_risk in {low, medium, high}` (4 primary + 1 secondary inputs per locked decision 38.1-38.5)
- [ ] **SAMPLE-03** Orchestrator applies intersection matrix at gate-fire decision
- [ ] **SAMPLE-04** `--force-gates X --override-reason "..."` logs to route-decisions.jsonl with `boundary=gate_override`
- [ ] **SAMPLE-05** `--force-gates X` without `--override-reason` returns exit 1

## RUBRIC lane (Phase 39)

- [ ] **RUBRIC-01** Mechanical rubric script reading review-ledger + gate-value-log + edge-guard-log
- [ ] **RUBRIC-02** Output table with all 13 gates classified `keep | kill | defer`
- [ ] **RUBRIC-03** `defer-on-empty` explicit (NOT default-kill on missing data)
- [ ] **RUBRIC-04** Wired into `sgsd-complete-milestone/SKILL.md` at close

## AUDIT lane (Phase 40)

- [ ] **AUDIT-01** Phase-folder-audit walks all phase folders
- [ ] **AUDIT-02** Categorizes each as compliant / partial / non-compliant
- [ ] **AUDIT-03** Soft-warn (does NOT block); per-phase missing-file list in output
- [ ] **AUDIT-04** Does NOT modify any phase folder
- [ ] **AUDIT-05** Wired into `sgsd-complete-milestone/SKILL.md` at close

## Phase Map

| Phase | Reqs | Type |
|------:|------|------|
| 36 | GVAL-01..04 | code (lib + orchestrator wire) |
| 37 | MUDA-01..04 | code (lib + sgsd-muda-audit.sh wire) |
| 38 | SAMPLE-01..05 | code (lib + gates.yaml edits + classifier edit + orchestrator wire) |
| 39 | RUBRIC-01..04 | code (rubric tool + milestone-close wire) |
| 40 | AUDIT-01..05 | code (audit tool + milestone-close wire) |

## Phase Dependencies

```
36 -> {37 || 38 || 39} -> 40
```

36 first (telemetry feeds 38's intersection matrix + 39's keep/kill rubric).
37/38/39 independent of each other.
40 last (audits all phase folders, including those produced this milestone).

## Kill / Defer Conditions

- Defer if gate-value-log shows no signal after 10 rows (revisit thresholds)
- Defer MUDA deletion-candidates if review surfaces false positives at >50%
- Defer sampling matrix if force/skip overrides exceed normal-fire rate
- Hard stop if rubric `kill` recommendation conflicts with gates.yaml lock
- Hard stop if phase-folder-audit modifies any folder (must be soft-warn only)

## Locked decisions (mass-discuss 2026-04-26)

- 36=B (outcome + retroactive fields, no cost)
- 37=A (3 heuristics, deletion candidates)
- 38.1-38.5 (3 work-risk tiers; 4 primary + 1 secondary classifier inputs; force/skip with reason)
- 39=B (mechanical rubric + manual override at milestone close)
- 40=B (soft-warn auditor, no folder modification)

## Cross-milestone integration

- Phase 36 emits to `gate-value-log.jsonl` -- consumed by Phase 39 rubric AND by v1.7 review-ledger consumers (no duplication; gate-value-log is gate-FITNESS data, review-ledger is gate-OUTPUT data; orthogonal).
- Phase 38 sampling-decider wires into Phase 32 route-ledger via `boundary=gate_override` rows.
- Phase 39 rubric defer-on-empty handles cold-start state (v1.7's --kill-check empty_baseline fix scoped to review-ledger; Phase 39 needs analogous defer-on-empty for gate-value-log).
- Phase 40 audit checks for v1.7 phase-folder template compliance retroactively (RESEARCH/CONTEXT/PLAN/VERIFICATION/ATC-REVIEW/SUMMARY presence).

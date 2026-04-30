---
phase: 101
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 101 -- Research

## Sources
- VTP-AHE-EVIDENCE.md AHE-P-03 (falsifiable contracts) + AHE-P-10 (regression first-class)
- REQUIREMENTS.md AHE-DEC-03..04 + AHE-GOV-01..04
- Phase 100 manifest.cjs (input source)
- Phase 99 distill.cjs ROOT_CAUSES (label vocab)
- Phase 86/87 sgsd-complete-milestone.cjs v2.6 branch pattern (template for v2.9 gate)

## Key decisions

### D1 -- Verdict closed vocab (6 values)
- keep                 -- all predicted fixes observed; no surprise regressions
- revert               -- predicted fixes missed AND new regressions appeared
- quarantine           -- mixed signal; needs another run before keep/revert
- pivot_component      -- 2nd consecutive failure on same component_class
- inconclusive         -- benchmark didn't run or signal too weak
- environmental_skip   -- provider unavailable; not the edit's fault

### D2 -- Evidence shape (input contract)
The attributor takes evidence as label sets, not raw JSONL. This keeps the
scorer testable with synthetic inputs and lets Phase 99 distill output be
consumed at the label layer:
```javascript
prevEvidence = { labels: ['gate_false_negative', 'token_budget_breach'], env: 'ok' }
nextEvidence = { labels: ['unknown', 'state_projection_drift'], env: 'ok' }
```

### D3 -- Fix metric semantics
- TP = predicted_fix appears in prevEvidence.labels AND is absent from nextEvidence.labels
- FN = predicted_fix appears in prev AND still appears in next (miss)
- FP = predicted_fix label appears in NEITHER (placebo claim)
- precision = TP / (TP + FP); recall = TP / (TP + FN)

### D4 -- Regression metric semantics
- TP = predicted_regression appears in nextEvidence.labels AND is absent from prevEvidence (correctly anticipated)
- FN = surprise label in next that wasn't predicted (missed regression risk; this is the most dangerous bucket)
- FP = predicted_regression that didn't actually appear (over-cautious)
- precision/recall computed on regression set independently from fixes

### D5 -- Verdict decision tree (deterministic)
```
if env != 'ok': return 'environmental_skip'
if fix.recall == 0 AND surprise_regressions > 0: return 'revert'
if same component_class failed previous attribution: return 'pivot_component'
if fix.recall == 1 AND surprise_regressions == 0: return 'keep'
if fix.recall < 1 AND surprise_regressions == 0: return 'quarantine'
default: return 'inconclusive'
```

### D6 -- Rollback recommendation -- exact, not prose
On verdict=revert, output:
```javascript
rollback_recommendation: {
  action: 'git-revert',
  commit_ref: <last-commit-touching-manifest-files>,
  files: manifest.files,
  manual_command: 'git revert <commit_ref>'
}
```
Phase MUST NOT execute the revert. Just emit the command.

### D7 -- Milestone gate stub
Add v2.9 branch to sgsd-complete-milestone.cjs:
1. Read .planning/metrics/harness-change-manifest.jsonl rows (status: candidate).
2. Read .planning/metrics/harness-attribution.jsonl rows.
3. For each candidate row, check whether attribution exists for its change_id.
4. Block close if any candidate has no attribution OR has attribution with verdict=revert and revert not yet applied.

Lock 13: try/catch around all reads. Emit clear blocker reason. Independent return path (no fallthrough).

### D8 -- Self-test fixtures (12+ assertions)
- TP fix (predicted_fix observed in prev, absent in next)
- FN fix (still in next)
- TP regression (predicted regression appears in next)
- FN regression (surprise label in next, not predicted)
- All 6 verdicts reachable
- Lock-13 no-throw on bad input
- Rollback command emitted only on revert
- ASCII-only source

## Risks
- R1: Label noise. If distill labels everything as 'unknown', metrics are meaningless. Mitigation: scorer reports n_labels per run; Phase 102+ runner declines to attribute when label diversity below threshold.
- R2: Pivot detection requires history. Fresh runs return inconclusive on the pivot path. Acceptable; pivot is for repeated same-class failure.

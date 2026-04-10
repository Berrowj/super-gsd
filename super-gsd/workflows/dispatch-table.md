# Super GSD Dispatch Table — Quick Reference

The orchestrator applies these rules in ORDER. First match wins.

## Pre-Dispatch Checks

Before dispatching any agent:
1. Read STATE.md frontmatter → extract phase, plan, status
2. Check exit conditions (all done? context >70%? blocker?)
3. Classify via Haiku → get model, atc_tier, deliberate flag
4. Select context via Haiku → get brv_queries, file_reads

## Dispatch Rules

| # | Condition | Check | Action | Agent | Model |
|---|-----------|-------|--------|-------|-------|
| 0 | Checkpoint exists | `.planning/ORCHESTRATOR-CHECKPOINT.md` exists | Resume from checkpoint | — | — |
| 1 | Deliberation needed | classifier.deliberate == true | Suggest /sgsd-deliberate | sgsd-ceo | opus |
| 2 | Phase not discussed | No `{NN}-CONTEXT.md` AND skip_discuss != true | /gsd-discuss-phase --auto | — | — |
| 3 | Phase needs research | No `{NN}-RESEARCH.md` AND research == true | Dispatch researcher | gsd-phase-researcher | sonnet |
| 4 | Phase needs plans | No `{NN}-*-PLAN.md` files | Dispatch planner | gsd-planner | sonnet |
| 5 | Plans need checking | PLAN.md exists, no checker result, plan_check == true | Dispatch checker | gsd-plan-checker | sonnet |
| 6 | Plans need executing | PLAN.md exists, no matching SUMMARY.md | Dispatch executor | gsd-executor | sonnet |
| 7 | All plans executed | All plans have SUMMARY.md | Dispatch verifier | gsd-verifier | sonnet |
| 8 | Verification passed | VERIFICATION.md status == "passed" | Mark complete, advance | orchestrator | — |
| 9 | Verification failed | VERIFICATION.md status == "gaps_found" | Dispatch planner --gaps | gsd-planner | sonnet |
| 10 | Phase complete | All checks pass | Advance to next phase | orchestrator | — |
| 11 | All phases done | No incomplete phases in ROADMAP.md | EXIT: all complete | — | — |

## How to Check Each Condition

```bash
GSD_TOOLS="$HOME/.claude/get-shit-done/bin/gsd-tools.cjs"
PHASE="03"  # replace with active phase number at runtime

# Rule 0: Checkpoint exists
[ -f .planning/ORCHESTRATOR-CHECKPOINT.md ]

# Rule 2: CONTEXT.md exists
PHASE_INFO=$(node "$GSD_TOOLS" find-phase "$PHASE" 2>/dev/null)
if [[ "$PHASE_INFO" == @file:* ]]; then PHASE_INFO=$(cat "${PHASE_INFO#@file:}"); fi
PHASE_DIR=$(echo "$PHASE_INFO" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(d.directory||'')")
[ -f "$PHASE_DIR/${PHASE}-CONTEXT.md" ]

# Rule 3: RESEARCH.md exists
[ -f "$PHASE_DIR/${PHASE}-RESEARCH.md" ]

# Rule 4: PLAN.md files exist
ls "$PHASE_DIR/${PHASE}-"*"-PLAN.md" 2>/dev/null

# Rule 5: Any PLAN.md missing a matching SUMMARY.md (plan_check sentinel)
PLAN_CHECK_DONE=$(ls "$PHASE_DIR/${PHASE}-"*"-PLAN-CHECKER.md" 2>/dev/null | wc -l)
PLAN_COUNT=$(ls "$PHASE_DIR/${PHASE}-"*"-PLAN.md" 2>/dev/null | wc -l)
[ "$PLAN_CHECK_DONE" -lt "$PLAN_COUNT" ]

# Rule 6: PLAN.md exists with no matching SUMMARY.md
PENDING=""
for plan in "$PHASE_DIR/${PHASE}-"*"-PLAN.md"; do
  summary="${plan/PLAN.md/SUMMARY.md}"
  [ ! -f "$summary" ] && PENDING="$PENDING $plan"
done
[ -n "$PENDING" ] && echo "PENDING:$PENDING"

# Rule 7: All plans have SUMMARY.md — check VERIFICATION.md exists
ls "$PHASE_DIR/${PHASE}-VERIFICATION.md" 2>/dev/null

# Rule 8: Verification status
grep "^status:" "$PHASE_DIR/${PHASE}-VERIFICATION.md" 2>/dev/null
```

## Phase Advancement

When a phase is complete:
1. Mark phase `[x]` in ROADMAP.md
2. Update STATE.md: increment current phase
3. Update progress counters
4. Git commit: `docs({phase}): phase {N} complete`
5. Read STATE.md → determines next phase → loop continues

## Config Flags That Affect Dispatch

From `.planning/config.json`:
- `workflow.skip_discuss`: skip rule 2
- `workflow.research`: enable/disable rule 3
- `workflow.plan_check`: enable/disable rule 5
- `workflow.verifier`: enable/disable rule 7
- `deliberation.enabled`: enable/disable rule 1
- `deliberation.auto_gate`: auto-classify deliberation need

## Model Routing from config.json

```bash
# Read model_routing from config.json
CONFIG=$(cat .planning/config.json)
MODEL_EXECUTOR=$(echo "$CONFIG" | node -e "const c=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(c.model_routing?.executor||'sonnet')")
MODEL_CLASSIFIER=$(echo "$CONFIG" | node -e "const c=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(c.model_routing?.classifier||'haiku')")
MODEL_ORCHESTRATOR=$(echo "$CONFIG" | node -e "const c=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(c.model_routing?.orchestrator||'opus')")
```

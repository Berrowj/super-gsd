# Super GSD Orchestrate Loop — Workflow Definition

Referenced by `/gsd-orchestrate` skill. This is the engine.

## Entry Points

### Auto Mode (`go` / `auto` / `continue`)
```
1. Cold start or checkpoint resume
2. Enter loop
3. Run until exit condition
```

### Single Step (`next`)
```
1. Cold start or checkpoint resume
2. Execute ONE dispatch
3. Report result and stop
```

### Status (`status`)
```
1. Read STATE.md frontmatter
2. Read ROADMAP.md (first 30 lines)
3. Report: milestone, phase, progress, next action
4. Stop (no loop)
```

---

## Cold Start Sequence

```bash
# Step 1: Check checkpoint
CHECKPOINT=$(cat .planning/ORCHESTRATOR-CHECKPOINT.md 2>/dev/null)
if [ -n "$CHECKPOINT" ]; then
  # Warm resume: parse checkpoint, enter loop at next_unit
  # Delete checkpoint after reading (it's consumed)
  RESUME_MODE=true
fi

# Step 2: Read state (frontmatter only)
head -30 .planning/STATE.md

# Step 3: Read config
cat .planning/config.json

# Step 4: Determine position
# Parse: milestone version, current phase, plan progress
```

If RESUME_MODE: skip to dispatch at `next_unit` from checkpoint.
If cold start: run full dispatch table to determine first action.

### Warm Resume (checkpoint exists)

1. Read `.planning/ORCHESTRATOR-CHECKPOINT.md` (offset 0, limit 40)
2. Extract: active_phase, last_completed, next_unit, phase_state
3. Delete the checkpoint file:
   ```bash
   rm .planning/ORCHESTRATOR-CHECKPOINT.md
   git add .planning/ORCHESTRATOR-CHECKPOINT.md
   git commit -m "chore(checkpoint): consumed, resuming at {next_unit}"
   ```
4. Enter loop at next_unit — no cold start, no user re-briefing
   DO NOT ask the user where you left off. The checkpoint says.

---

## Session State (initialized once on loop entry, persisted across iterations)

```bash
# Initialize once (before first loop iteration)
REPORT_COUNT=0          # number of full reports currently in active context
REPORT_LOG=()           # array of one-liners from completed reports
UNITS_THIS_SESSION=0    # total dispatches this session
```

---

## The Loop

### Step 1: Read State

```
Read .planning/STATE.md (offset: 0, limit: 30)
→ Extract: milestone, phase, plan, status, progress
```

Check exit conditions:
- All phases `[x]` in ROADMAP? → EXIT: all complete
- Context >70%? → write checkpoint, EXIT

### Context Cap Check (run EVERY iteration — before dispatch)

```bash
# Read threshold from config (default 70 if not set)
THRESHOLD=$(cat .planning/config.json | node -e "
  const c=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  process.stdout.write(String(c.token_efficiency?.checkpoint_threshold_percent||70));
")

# Estimate current context usage (word count of all reports in active context)
# REPORT_COUNT tracks how many reports are in active context this session
# This is updated at Step 10 (Update State) each iteration

if [ "$CONTEXT_PERCENT" -gt "$THRESHOLD" ]; then
  # → Write checkpoint, then EXIT (text-only stop)
  # See Checkpoint Write section below
fi
```

### Step 2: Classify (Haiku)

```
Agent(
  description: "Classify phase {N}",
  model: "haiku",
  prompt: "Classify: goal='{goal}', files={N}, lines~{N}, type={type}
           Return JSON: {complexity, model, atc_tier, deliberate, reason}"
)
```

If `deliberate: true` and not in auto mode → suggest `/gsd-deliberate`
If `deliberate: true` and in auto mode → log warning, skip deliberation

### Step 3: Select Context (Haiku)

```
Agent(
  description: "Select context for phase {N}",
  model: "haiku",
  prompt: "Select context: goal='{task_goal}', files=[{list}], type={type}
           Return JSON: {brv_queries, file_reads, error_rules, scripts_to_check}"
)
```

### Step 4: Query ByteRover

```bash
# Step 4: Query ByteRover (brv-query-local.js — no API key required)
BRV_BIN="$(find super-gsd/overwatcher ~/.claude/hooks -name brv-query-local.js 2>/dev/null | head -1)"

# Run up to 3 queries from context_selector output (brv_queries array)
BRV_RESULTS=""
for Q in "${BRV_QUERIES[@]}"; do
  RESULT=$(node "$BRV_BIN" "$Q" --max 3 --format json 2>/dev/null)
  BRV_RESULTS+="$RESULT"
done

# Script registry check — for each scripts_to_check entry
EXISTING_SCRIPTS=""
for S in "${SCRIPTS_TO_CHECK[@]}"; do
  HITS=$(node "$BRV_BIN" "scripts $S" --domain scripts --max 2 --format json 2>/dev/null)
  # If results returned, format as "EXISTING: {path} — {snippet}"
  if [ -n "$HITS" ] && [ "$HITS" != "[]" ]; then
    EXISTING_SCRIPTS+=$(node -e "
      const r=JSON.parse('$HITS');
      r.forEach(h=>console.log('EXISTING: '+h.path+' — '+h.snippet.substring(0,80)));
    ")
  fi
done
# BRV_RESULTS and EXISTING_SCRIPTS passed to Step 6 (prompt composition)
```

### Step 5: Determine Dispatch

Apply dispatch table (first match wins):

```
Check phase directory: .planning/phases/{NN}-*/

IF no CONTEXT.md AND config.skip_discuss != true:
  → ACTION: suggest /gsd-discuss-phase {N}
  → In auto mode: /gsd-discuss-phase {N} --auto

IF no RESEARCH.md AND config.research == true:
  → DISPATCH: gsd-phase-researcher (Sonnet)
  → PROMPT: phase goal + requirements + brv results

IF no PLAN.md files:
  → DISPATCH: gsd-planner (Sonnet)
  → PROMPT: phase goal + CONTEXT.md key sections + requirements + brv results

IF PLAN.md exists but no PLAN-CHECKER results AND config.plan_check == true:
  → DISPATCH: gsd-plan-checker (Sonnet)
  → PROMPT: plan files + phase goal

IF PLAN.md files exist with unchecked tasks (no SUMMARY.md):
  → DISPATCH: gsd-executor (Sonnet)
  → PROMPT: compressed plan XML + executor overlay + brv results

IF all plans have SUMMARY.md but no VERIFICATION.md AND config.verifier == true:
  → DISPATCH: gsd-verifier (Sonnet)
  → PROMPT: phase goal + must-haves + verifier overlay

IF VERIFICATION.md exists AND status == "passed":
  → ACTION: mark phase complete in ROADMAP.md
  → ACTION: advance STATE.md to next phase
  → CONTINUE loop

IF VERIFICATION.md exists AND status == "gaps_found":
  → DISPATCH: gsd-planner --gaps (Sonnet)
  → PROMPT: verification gaps + phase goal

IF no more phases:
  → EXIT: "All phases complete"
```

### Step 6: Compose Prompt

Build the sub-agent prompt from template:

```
{task_plan_or_phase_goal}

{appropriate overlay (executor/planner/verifier)}
  EXISTING_SCRIPTS = {brv script query results}
  RELEVANT_DECISIONS = {brv decision query results}
  RELEVANT_PATTERNS = {brv pattern query results}
  ERROR_RULES = {brv error rule query results}

<files_to_read>
{file_reads from context selector, max 5 files}
</files_to_read>
```

Token budget check:
- Count words in composed prompt * 1.3
- If >1,500 tokens: trim file_reads first, then brv results
- Never trim the plan itself

### Step 7: Dispatch

```bash
# Resolve model: classifier output takes precedence, fallback to config.json model_routing
CONFIG_MODEL=$(cat .planning/config.json | node -e "
  const c=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const role=process.env.AGENT_ROLE||'executor';
  process.stdout.write(c.model_routing?.[role]||'sonnet');
")
DISPATCH_MODEL="${CLASSIFIER_MODEL:-$CONFIG_MODEL}"

# Apply @file: IPC guard on all gsd-tools output
RESULT=$(node "$GSD_TOOLS" state advance-plan)
if [[ "$RESULT" == @file:* ]]; then RESULT=$(cat "${RESULT#@file:}"); fi
```

```
Agent(
  description: "{role}: phase {N}",
  model: "${DISPATCH_MODEL}",
  prompt: "{composed prompt}"
)
```

Wait for structured report.

### Step 8: Process Result

Parse the report:
```
FILES_CHANGED → list for git add
VERIFICATION → check all passed; if any failed, log
DEVIATIONS → collect for phase summary
BLOCKERS → if any: EXIT with blocker description
SCRIPTS_CREATED → prepare for brv-curate
ONE_LINER → use in commit message and state update
```

### Step 9: Curate Learnings

```bash
# Step 9: Curate Learnings (brv-curate-local.js)
BRV_CURATE="$(find super-gsd/overwatcher ~/.claude/hooks -name brv-curate-local.js 2>/dev/null | head -1)"

# Curate each new script from agent report SCRIPTS_CREATED section
# SCRIPTS_CREATED format: "path | purpose: what | interface: signature"
for SCRIPT_LINE in "${SCRIPTS_CREATED[@]}"; do
  SPATH=$(echo "$SCRIPT_LINE" | cut -d'|' -f1 | xargs)
  PURPOSE=$(echo "$SCRIPT_LINE" | cut -d'|' -f2 | sed 's/purpose: //' | xargs)
  IFACE=$(echo "$SCRIPT_LINE" | cut -d'|' -f3 | sed 's/interface: //' | xargs)
  SLUG=$(basename "$SPATH" .js)
  node "$BRV_CURATE" "$PURPOSE. Interface: $IFACE" \
    --domain "scripts/nodejs" \
    --title "$SLUG" \
    --importance 60 \
    --maturity draft \
    --tags "script,utility,nodejs" \
    --keywords "$SLUG,script"
done

# Curate new patterns from DEVIATIONS (if any contain "new pattern:" prefix)
for DEV in "${DEVIATIONS[@]}"; do
  if [[ "$DEV" == *"new pattern:"* ]]; then
    PATTERN_TEXT="${DEV#*new pattern:}"
    node "$BRV_CURATE" "$PATTERN_TEXT" \
      --domain "patterns/orchestrator" \
      --title "Pattern: $(echo $PATTERN_TEXT | cut -c1-40)" \
      --importance 55 \
      --maturity draft \
      --tags "pattern,orchestrator" \
      --keywords "pattern,orchestrator"
  fi
done

# Curate verifier CURATE_* entries
for CURATE_ENTRY in "${CURATE_ENTRIES[@]}"; do
  node "$BRV_CURATE" "$CURATE_ENTRY" \
    --domain "patterns/verified" \
    --title "$(echo $CURATE_ENTRY | cut -c1-50)" \
    --importance 65 \
    --maturity validated \
    --tags "verified,pattern" \
    --keywords "verified,pattern"
done
```

### Step 10: Update State

```bash
# Update STATE.md
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state advance-plan
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" state update-progress

# Update ROADMAP.md
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap update-plan-progress {PHASE}
```

### Step 11: Log Tokens

Append to `.planning/metrics/token-log.jsonl`:
```json
{
  "ts": "{ISO}",
  "phase": {N},
  "plan": {N},
  "model": "{model}",
  "role": "{agent_type}",
  "est_input": {N},
  "est_output": {N},
  "total": {N},
  "classifier_model": "haiku",
  "context_tokens": {N},
  "scripts_reused": {N},
  "scripts_created": {N}
}
```

### Step 12: Git Commit

```bash
git add {specific files from FILES_CHANGED}
git add .planning/STATE.md .planning/ROADMAP.md
git commit -m "feat({phase}-{plan}): {ONE_LINER}"
```

Atomic. Per unit. Never batch. Never skip.

### Step 13: Loop

Read `.planning/STATE.md` → this is a tool call → loop continues.

---

## Checkpoint Write

Triggered by: context >70% OR user says stop/pause.

```markdown
---
created_at: "{ISO}"
active_milestone: "{version}"
active_phase: {NN}
last_completed: "plan {NN-PP}"
next_unit: "{next dispatch description}"
phase_state: "{researching|planning|executing|verifying}"
units_this_session: {N}
estimated_tokens_used: {N}
model_breakdown:
  opus: {orchestrator_tokens}
  sonnet: {agent_tokens}
  haiku: {classifier_tokens}
---

## Completed This Session
{list of completed units with ONE_LINERs}

## Next Action
{exact next dispatch — what agent, what prompt}

## Remaining Work
{remaining plans in phase, remaining phases in milestone}

## Learnings Curated
{what was added to ByteRover this session}
```

Commit checkpoint, then STOP (text-only response).

## Checkpoint Write — Exact Sequence

1. Collect session state:
   - active_milestone from STATE.md frontmatter
   - active_phase, last_completed from current loop position
   - next_unit: the plan that would have been dispatched next
   - units_this_session: count of dispatches this session
   - estimated_tokens_used: sum from token-log.jsonl (this session)
   - model_breakdown: aggregate from token-log.jsonl (this session)

2. Write `.planning/ORCHESTRATOR-CHECKPOINT.md` using checkpoint.md template

3. Commit checkpoint:
   ```bash
   git add .planning/ORCHESTRATOR-CHECKPOINT.md
   git commit -m "chore(checkpoint): session end at phase {N} plan {P}"
   ```

4. STOP — emit text-only response: "Checkpoint written. Resume with /gsd-orchestrate go"
   DO NOT dispatch another agent. DO NOT read STATE.md again. Just stop.

---

## Error Handling

| Error | Response |
|-------|----------|
| Sub-agent report missing sections | Log warning, extract what's available |
| Verification all failed | Dispatch planner --gaps, don't EXIT |
| brv-query fails/unavailable | Fall back to reading .planning/ files directly |
| git commit fails | Check status, resolve, retry once |
| Classifier returns unexpected format | Default: model=sonnet, atc_tier=lite |
| Context fills before checkpoint written | Write emergency checkpoint with last known state |

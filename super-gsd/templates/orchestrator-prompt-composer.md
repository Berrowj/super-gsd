# Orchestrator Prompt Composition Guide

How the orchestrator builds sub-agent prompts with ByteRover context injection.

## Composition Steps

### 1. Get Classification (Haiku)

```
Agent(model: "haiku", prompt: "
Classify: goal='{phase_goal}', files={file_count}, lines={est_lines}, type={phase_type}
Return JSON: {complexity, model, atc_tier, deliberate, reason}")
```

### 2. Get Context Selection (Haiku)

```
Agent(model: "haiku", prompt: "
Select context for: goal='{task_goal}', files=[{file_list}], type={task_type}
Return JSON: {brv_queries, file_reads, error_rules, scripts_to_check}")
```

### 3. Execute ByteRover Queries

For each brv_query from step 2:
```
brv-query "{query_string}"
→ Collect results, ~200 tokens each, max 3 queries = ~600 tokens
```

For each scripts_to_check entry from context selector:
```bash
BRV_BIN="$(find super-gsd/overwatcher ~/.claude/hooks -name brv-query-local.js 2>/dev/null | head -1)"
HITS=$(node "$BRV_BIN" "scripts $PURPOSE" --domain scripts --max 2 --format json 2>/dev/null)
# Format each hit as EXISTING: line for injection
EXISTING_LINES=$(node -e "
  const r=JSON.parse(process.argv[1]||'[]');
  r.forEach(h=>console.log('EXISTING: '+h.path+' — '+h.snippet.substring(0,80)));
" "$HITS")
# Accumulate into EXISTING_SCRIPTS variable for Step 5
EXISTING_SCRIPTS+="$EXISTING_LINES\n"
```
If HITS is empty or "[]", skip — do not inject empty EXISTING lines.

### 4. Read Minimal Files

For each file_read from step 2:
```
Read(file_path, offset=0, limit=50)  // Only what's needed, not full file
```

### 5. Compose Final Prompt

Template (for executor):
```
{compressed_plan_xml}

{executor_brv_overlay with placeholders filled:
  EXISTING_SCRIPTS = one "EXISTING: {path} — {80-char description}" per match, or "none"
  RELEVANT_DECISIONS = brv-query decision results
  RELEVANT_PATTERNS = brv-query pattern results
  ERROR_RULES = brv-query error rule results
}

<files_to_read>
{file_reads from context selector}
</files_to_read>
```

Template (for planner):
```
Phase {N}: {goal}
Requirements: {requirement IDs}
Success criteria: {from ROADMAP}

{planner_brv_overlay with placeholders filled}

{CONTEXT.md key sections if they exist}
```

Template (for verifier):
```
Phase {N}: {goal}
Plans executed: {list}
Must-haves: {from ROADMAP success criteria}

{verifier_brv_overlay}
```

### 6. Dispatch

```
Agent(
  description: "{role}: phase {N}",
  model: "{from classifier}",
  prompt: "{composed prompt}"
)
```

### 7. Process Report

Parse structured report:
- FILES_CHANGED → track for commit
- VERIFICATION → validate all passed
- DEVIATIONS → log for phase summary
- BLOCKERS → EXIT if any
- SCRIPTS_CREATED → curate to ByteRover scripts/
- ONE_LINER → commit message
- CURATE_* → curate discoveries to ByteRover

### Token Budget Check

After composition, estimate total tokens:
- Plan XML: count words * 1.3
- Overlay: ~80 tokens (fixed)
- brv-query results: ~200 per query * N queries
- file_reads: sum of lines * ~2 tokens/line
- TOTAL should be under 1,500 tokens for the prompt

If over 1,500: trim file_reads first, then brv-query results, never trim the plan.

---
name: sgsd-token-audit
description: "Analyze token usage, detect inefficiencies, suggest optimizations. Reads token-log.jsonl and context files."
argument-hint: "[--full | --quick | --context-map]"
allowed-tools:
  - Read
  - Write
  - Glob
  - Grep
  - Bash
---

<objective>
Token efficiency auditor. Reads usage logs, analyzes context file sizes, detects waste,
suggests optimizations.

Modes:
- `--quick` (default): Last session summary, top cost items, quick recommendations
- `--full`: Full analysis across all sessions, trend detection, detailed recommendations
- `--context-map`: Generate context_map.md showing all .md files, sizes, token estimates
</objective>

<quick_audit>
## Quick Audit (default)

1. Read `.planning/metrics/token-log.jsonl` — last 20 entries
2. Calculate:
   - Total estimated tokens this session
   - Most expensive agent type (by avg tokens/unit)
   - Most expensive phase
   - Orchestrator overhead ratio (orchestrator tokens / total)
3. Flag:
   - Any agent report >300 words → "Agent {X} exceeded report budget"
   - Orchestrator >20% of total → "Orchestrator too heavy — check context loading"
   - Same phase dispatched 3+ times → "Phase {N} may be stuck"
4. **Conformance drift surface (DLB-05 Wave B + Architect's reserved-objection mitigation):**
   If `.planning/metrics/conformance-log.jsonl` exists, read last N entries and surface:
   - Top-3 phases by `drift_pct` (highest first)
   - Any phase with `drift_pct >= 30%` → flag as "PHASE DRIFT: {name} at {N}% — planned {P} tasks, evidenced {E}"
   - Count of phases `skipped: true` (planned_tasks < 5)
   - If all recent entries are skipped, emit one-line note: "Conformance signal empty — plans aren't using `- [ ]` checkbox format. DLB-05 Q2b metric needs structured task lists to produce data."
5. **Deliberation budget surface (DLB-05 Wave A):**
   If `.planning/metrics/deliberation-budget.jsonl` exists, surface:
   - Most recent DLB: tokens_spent / max_tokens, elapsed_sec / max_minutes
   - Any `warn_fired: true` events in last 4 DLBs → flag as "DELIBERATION BUDGET WARN: {dlb} exceeded {field}"
   - If zero warns across last 4 DLBs → note "Budget warn has not fired across 4 deliberations — kill-condition candidate per DLB-05 (retire warn mechanism)"
6. Write summary to stdout (not file)
</quick_audit>

<full_audit>
## Full Audit

1. Read entire `.planning/metrics/token-log.jsonl`
2. Analyze:
   - Total tokens across all sessions
   - Trend: increasing or decreasing per unit?
   - Model distribution: % opus vs sonnet vs haiku
   - Top 5 most expensive phases (by total tokens)
   - Average tokens per agent type
   - Context injection efficiency (sgsd-recall tokens vs total)
3. Recommendations:
   - Phases where Sonnet could be downgraded to Haiku
   - Agent types consistently under budget (could use smaller model)
   - Patterns in stuck/retry phases
   - Context files that should be compressed or archived
4. Write `.planning/metrics/TOKEN-AUDIT.md`
</full_audit>

<context_map>
## Context Map

1. Find all .md files:
   ```bash
   find .planning/ -name "*.md" -type f
   find .brv/context-tree/ -name "*.md" -type f 2>/dev/null
   ```
2. For each file:
   - Size in bytes
   - Estimated tokens (bytes / 4)
   - Last modified date
   - Category (state/roadmap/plan/summary/verification/context/decision/knowledge)
3. Sort by token cost descending
4. Flag:
   - Files >5000 tokens that load every session
   - Files not modified in >14 days (stale)
   - Files with >50% overlap with another file (duplicate)
5. Write `.planning/metrics/context-map.md`

Format:
```markdown
# Context Map

| File | Tokens | Category | Last Modified | Loaded When | Flag |
|------|--------|----------|---------------|-------------|------|
| STATE.md | 200 | state | today | every loop | OK |
| ROADMAP.md | 800 | roadmap | today | cold start | OK |
| 27-CONTEXT.md | 3200 | context | 3 days | phase 27 | LARGE |
```
</context_map>

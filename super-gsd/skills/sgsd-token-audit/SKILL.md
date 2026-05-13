---
name: sgsd-token-audit
description: "Analyze token usage, detect inefficiencies, suggest optimizations. Reads token-log.jsonl and context files."
argument-hint: "[--full | --quick | --context-map | --milestone-close-check]"
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
- `--milestone-close-check`: Compute kill metrics + fire kill condition if both thresholds missed (CODEX-12)
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
6. **Multimodal offload tile (CODEX-10):**
   Read `.planning/metrics/token-log.jsonl`. Apply backfill-on-read defaults:
   - `row.provider || 'claude'` (pre-Phase-15 rows default to 'claude')
   - `row.role || 'unknown'` (pre-Phase-15 rows default to 'unknown')

   Scope to active milestone: read `.planning/STATE.md` frontmatter `milestone:` field.
   If milestone ID found, filter rows by `ts >= milestoneStartDate` (use directory mtime of
   `.planning/milestones/{id}/` as milestone start). If unavailable, aggregate all rows.

   Compute:
   ```javascript
   // Codex review rows for this milestone
   const codexReviewRows = tokenLog
     .filter(r => (r.provider || 'claude') === 'openai-codex')
     .filter(r => ['code_reviewer', 'adversarial_verifier'].includes(r.role || 'unknown'))
     .filter(r => /* milestone date range: r.ts >= milestoneStartDate */);

   const claude_tokens_saved_by_codex = codexReviewRows
     .reduce((sum, r) => sum + (r.est_input || 0) + (r.est_output || 0), 0);

   const total_codex_dispatches = tokenLog
     .filter(r => (r.provider || 'claude') === 'openai-codex').length;

   const fallback_count = tokenLog
     .filter(r => (r.provider || 'claude') === 'claude-via-fallback').length;

   const provider_fallback_rate = total_codex_dispatches > 0
     ? Math.round((fallback_count / total_codex_dispatches) * 100)
     : 0;
   ```

   Output tile:

   ```markdown
   ## Multimodal Review Offload (v1.3)

   > Note: Token counts are estimated offload values — not a billing audit (CONTEXT D-13a).

   - Codex reviews this milestone: {N reviews where provider == "openai-codex"}
   - Claude tokens saved by Codex: ~{claude_tokens_saved_by_codex} tokens (estimated)
   - Provider fallback rate: {provider_fallback_rate}% ({fallback_count} of {total_codex_dispatches} Codex dispatches fell back to Claude)
   - Per-phase provider breakdown:

   | Phase | Codex reviews | Claude reviews | Fallback reviews |
   |-------|--------------|----------------|------------------|
   | {N}   | {n}          | {n}            | {n}              |
   ```

7. Write summary to stdout (not file)
</quick_audit>

<full_audit>
## Full Audit

1. Read entire `.planning/metrics/token-log.jsonl`
2. Analyze:
   - Total tokens across all sessions
   - Trend: increasing or decreasing per unit?
   - Model distribution: % opus vs codex vs legacy-disabled routes
   - Top 5 most expensive phases (by total tokens)
   - Average tokens per agent type
   - Context injection efficiency (sgsd-recall tokens vs total)
3. Recommendations:
   - Phases where stale Claude-agent routes should be converted to Codex/local
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
   find .planning/memory/ -name "*.md" -type f 2>/dev/null
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

<milestone_close_check>
## --milestone-close-check Mode

Computes the two kill metrics and fires the kill condition if both thresholds are missed.
Reads: `.planning/metrics/token-log.jsonl` + `.planning/phases/*/commit-reviews.jsonl`
       + `.planning/phases/*/{NN}-ATC-REVIEW.md`

### Step 1: Codex history guard (empty-milestone edge case)

Before computing metrics, check whether any Codex rows exist in `.planning/metrics/token-log.jsonl`
and `.planning/phases/*/commit-reviews.jsonl` for the active milestone:

```javascript
const codexRows = tokenLog.filter(r => (r.provider || 'claude') === 'openai-codex');
const codexReviews = reviewRows.filter(r => r.provider === 'openai-codex');

if (codexRows.length === 0 && codexReviews.length === 0) {
  // Codex was never exercised this milestone — treat as "never evaluated", not "failed threshold"
  // Do NOT fire the kill condition on a no-op milestone
  console.log('MILESTONE_CLOSE_CHECK: ' + milestone);
  console.log('VERDICT: KEEP');
  console.log('KILL_FIRED: false');
  console.log('REASON: Codex never exercised this milestone — kill condition requires at least one Codex dispatch');
  process.exit(0);
}
```

### Step 2: Compute metrics

**Quality metric — `critical_count_delta`:**
```javascript
const reviewRows = [
  // from .planning/phases/*/commit-reviews.jsonl (all rows across milestone)
  // from .planning/phases/*/{NN}-ATC-REVIEW.md frontmatter critical_count field
];

const codexCrits = reviewRows
  .filter(r => r.provider === 'openai-codex')
  .reduce((sum, r) => sum + (r.critical_count || 0), 0);

const claudeCrits = reviewRows
  .filter(r => ['claude-opus', 'claude-via-legacy'].includes(r.provider))
  .reduce((sum, r) => sum + (r.critical_count || 0), 0);

const critical_count_delta = codexCrits - claudeCrits;
// Higher = Codex finding more issues Claude missed
```

**Quota metric — `claude_tokens_saved`:**
Same calculation as `--quick` multimodal tile, scoped to active milestone:
```javascript
const claude_tokens_saved = tokenLog
  .filter(r => (r.provider || 'claude') === 'openai-codex')
  .filter(r => ['code_reviewer', 'adversarial_verifier'].includes(r.role || 'unknown'))
  .filter(r => /* milestone date range */)
  .reduce((sum, r) => sum + (r.est_input || 0) + (r.est_output || 0), 0);
```

### Step 3: Kill threshold evaluation

Read thresholds from `.planning/config.json`:
- `config.review_providers.kill_critical_count_delta` (default: 5)
- `config.review_providers.kill_claude_tokens_saved` (default: 50000)

Kill condition fires if AND ONLY IF BOTH:
- `critical_count_delta < kill_critical_count_delta`
- `claude_tokens_saved < kill_claude_tokens_saved`

Per CONTEXT D-20a: either condition passing alone keeps Codex active.

### Step 4: Dry-run mode (--dry-run flag)

If `--dry-run` is set, compute metrics and return verdict JSON without executing
any kill actions. Output:
```json
{"kill": false, "critical_count_delta": N, "claude_tokens_saved": K, "reason": "..."}
```
or
```json
{"kill": true, "critical_count_delta": N, "claude_tokens_saved": K, "reason": "both thresholds missed"}
```
Exit 0 always in dry-run mode.

### Step 5: Kill actions (only if kill fires AND NOT --dry-run)

Per CONTEXT D-21, in this order:
1. **config flip:** Set `config.review_providers.codex_enabled: false` in `.planning/config.json`
   using Node-in-bash (never read-then-print the file contents).
2. **Anti-pattern curation:** shell to `sgsd-curate.sh` to write:
   `.planning/memory/architecture/anti-patterns/multimodal-codex-retired-{milestone}.md`
   with content: metrics that fired the kill, thresholds, milestone ID.
3. **MILESTONES.md append:** Add one-line summary:
   "{milestone} Codex Multimodal: RETIRED per kill condition (delta={N}, saved={K})."
4. **Do NOT delete** `codex-exec.sh` or registry entries.
   Retirement = disable + document. Future milestones can re-enable via config flip.

### Step 6: Auto-mode advisory (CONTEXT D-22)

In auto mode: log the kill action as a DEVIATION, proceed. Do NOT block the run.
In interactive mode: print the verdict JSON and prompt:
"Kill condition fired. Type 'confirm' to retire Codex, 'skip' to keep active."

### Output format (always)

```
MILESTONE_CLOSE_CHECK: {milestone}
critical_count_delta: {N} (threshold: {kill_critical_count_delta})
claude_tokens_saved: {K} (threshold: {kill_claude_tokens_saved})
VERDICT: KEEP | RETIRE
KILL_FIRED: true | false
```

Default thresholds (from `config.review_providers`):
- `kill_critical_count_delta: 5`
- `kill_claude_tokens_saved: 50000`

Use `-1` as a sentinel value for either threshold to disable that kill condition dimension.
</milestone_close_check>

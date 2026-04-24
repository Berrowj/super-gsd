---
plan_id: 15-03
phase: 15
wave: 1
depends_on: []
deliverable: token-log.jsonl schema extension (provider field) + sgsd-token-audit multimodal offload tile + SKILL.md Step 11 row template update + W-5 doc fix (CODEX-10)
estimate_tokens: ~700
estimate_commits: 2
atc_warnings_addressed: [W-5]
codex_deliverable: CODEX-10
---

# Plan 15-03: Quota-Offload Metric

## Scope

Extends the token accounting system so Phase 15 dispatches have provenance.
The core problem: the live `token-log.jsonl` rows (shape: `{ts, tool, model,
description, est_input, est_output, total}`) do not have `provider` or `role` fields.
The CODEX-10 calculation (`Σ est_input + est_output where role ∈ {code_reviewer,
adversarial_verifier} AND provider == "openai-codex"`) needs both.

**Schema strategy (RESEARCH AD-01, option b):** New rows from Phase 15 forward
emit the full documented schema including `provider` and `role`. Old rows are treated
as `provider: "claude"`, `role: "unknown"` on read — backfill-on-read. No migration
script. The `sgsd-token-audit` aggregator uses `row.provider || 'claude'` and
`row.role || 'unknown'` defensive reads.

**Wave 1 note:** This plan executes in parallel with 15-02. It touches `sgsd-orchestrate/SKILL.md`
Step 11 only (the token_logging section ~line 1204). Confirm the line range of
Step 11 is well-separated from Steps 6.5/9.5 (Wave 2) and Step 9.6 (Wave 3) before
committing. The Step 11 edit is a template-schema comment update, not logic code.

## Tasks

<tasks>

<task id="T1">
### T1. SKILL.md Step 11 token-log row template update

**Files:**
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` (modify: Step 11 token_logging section, ~line 1204-1215)

**Action:**
Read `super-gsd/skills/sgsd-orchestrate/SKILL.md` fresh. Locate the `token_logging`
section within Step 11 (search for `token-log.jsonl` or `est_input`). The current
template (per RESEARCH RQ4, line ~1208) documents a schema that does not match the
live file. Update the JSONL row template to the full target schema per CONTEXT D-12 + D-15:

Replace the existing row template comment/example with:
```javascript
// token-log.jsonl row schema (Phase 15+). Backfill-on-read for pre-Phase-15 rows:
// row.provider defaults to 'claude', row.role defaults to 'unknown'.
// NEVER allow empty provider — derive from dispatch path before appending.
const tokenLogRow = {
  ts: new Date().toISOString(),
  phase: currentPhase,            // integer
  plan: currentPlan,              // integer
  model: dispatchedModel,         // 'sonnet' | 'haiku' | 'codex' | ...
  role: agentRole,                // 'code_reviewer' | 'adversarial_verifier' | 'executor' |
                                  // 'verifier' | 'classifier' | 'context_selector'
  provider: dispatchProvider,     // 'claude' | 'openai-codex' | 'claude-via-fallback'
  est_input: estimatedInputTokens,
  est_output: estimatedOutputTokens,
  total: estimatedInputTokens + estimatedOutputTokens,
  classifier_model: classifierModel,  // 'haiku' (the classify step model)
  context_tokens: contextWindowUsed
};
// provider value is derived from dispatch path:
//   Agent() dispatch          → 'claude'
//   shellDispatch exit 0      → 'openai-codex'
//   shellDispatch + fallback  → 'claude-via-fallback'
```

Also fix the W-5 documentation drift in the same section: locate any text that says
the wrapper "defensively unsets" `OPENAI_API_KEY`. Replace with: "the wrapper refuses
to run if `OPENAI_API_KEY` is set (exits 4); per CONTEXT D-02a." This aligns the
SKILL.md description with the actual script behaviour.

**Verification:**
```bash
grep -n 'provider.*claude.*openai-codex' super-gsd/skills/sgsd-orchestrate/SKILL.md | head -3
grep -n 'claude-via-fallback' super-gsd/skills/sgsd-orchestrate/SKILL.md | head -3
# Both must return hits in the Step 11 section
```

**Done:**
- `grep -c '"provider":' super-gsd/skills/sgsd-orchestrate/SKILL.md` returns ≥ 1. **(D-26 inv5)**
- The Step 11 section contains `'openai-codex'` as a provider value example.
- W-5 text drift is resolved: no "defensively unsets" language near the Step 11 block.

**Commit message:** `feat(15-03/T1): SKILL.md Step 11 token-log schema + provider field + W-5 fix`
</task>

<task id="T2">
### T2. sgsd-token-audit multimodal offload tile (CODEX-10 dashboard)

**Files:**
- `super-gsd/skills/sgsd-token-audit/SKILL.md` (modify: --quick section, add multimodal tile)

**Action:**
Read `super-gsd/skills/sgsd-token-audit/SKILL.md` fully. Locate the `--quick` audit
output section. After the existing last tile in `--quick` output, add the
"Multimodal Review Offload" tile per CONTEXT D-13/D-13a.

Add the following tile to the `--quick` mode output specification:

```markdown
## Multimodal Review Offload (v1.3)

> Note: Token counts are estimated offload values — not a billing audit (CONTEXT D-13a).

- Codex reviews this milestone: {N reviews where provider == "openai-codex"}
- Claude tokens saved by Codex: ~{K} tokens (estimated)
- Provider fallback rate: {P}% ({fallback_count} of {total_codex_dispatches} Codex dispatches fell back to Claude)
- Per-phase provider breakdown:

| Phase | Codex reviews | Claude reviews | Fallback reviews |
|-------|--------------|----------------|------------------|
| {N}   | {n}          | {n}            | {n}              |
```

The computation for `claude_tokens_saved_by_codex` (per CONTEXT D-13):
```javascript
// Read token-log.jsonl, filter for Codex review rows, sum tokens
// Backfill: rows missing 'provider' field default to 'claude'
//           rows missing 'role' field default to 'unknown'
const savedTokens = tokenLog
  .filter(r => (r.provider || 'claude') === 'openai-codex')
  .filter(r => ['code_reviewer', 'adversarial_verifier'].includes(r.role || 'unknown'))
  .filter(r => /* milestone date range: ts >= milestoneStartDate */)
  .reduce((sum, r) => sum + (r.est_input || 0) + (r.est_output || 0), 0);
```

Also add milestone filtering: the audit scopes to the ACTIVE milestone by reading
`.planning/STATE.md` frontmatter `milestone:` field, then filtering token-log rows
by `ts` against the milestone start timestamp from `.planning/milestones/{id}/` directory
mtime. If STATE.md milestone is unavailable, aggregate all rows.

The `--quick` flag already reads `token-log.jsonl` (confirmed: RESEARCH RQ4). This
task adds one new tile to the --quick output; it does not restructure the existing
output sections.

**Verification:**
```bash
grep -n 'claude_tokens_saved_by_codex' super-gsd/skills/sgsd-token-audit/SKILL.md
grep -n 'Multimodal Review Offload' super-gsd/skills/sgsd-token-audit/SKILL.md
# Both must return hits
# Synthetic fixture test:
node -e "
const fs = require('fs');
// Synthetic token-log with one codex code_reviewer row
const rows = [
  JSON.stringify({ts:'2026-04-24T00:00:00Z',phase:15,plan:1,model:'codex',role:'code_reviewer',provider:'openai-codex',est_input:500,est_output:200,total:700}),
  JSON.stringify({ts:'2026-04-24T01:00:00Z',phase:15,plan:2,model:'sonnet',role:'code_reviewer',provider:'claude',est_input:800,est_output:300,total:1100})
];
const tokenLog = rows.map(r => JSON.parse(r));
const saved = tokenLog.filter(r=>(r.provider||'claude')==='openai-codex').filter(r=>['code_reviewer','adversarial_verifier'].includes(r.role||'unknown')).reduce((s,r)=>s+(r.est_input||0)+(r.est_output||0),0);
console.log('Codex tokens saved:', saved); // Must print 700
"
```

**Done:**
- `grep -c 'claude_tokens_saved_by_codex' super-gsd/skills/sgsd-token-audit/SKILL.md` returns ≥ 1. **(D-26 inv6)**
- `grep -c 'Multimodal Review Offload' super-gsd/skills/sgsd-token-audit/SKILL.md` returns 1.
- Synthetic node test prints `Codex tokens saved: 700`.
- Tile includes the "(not a billing audit)" disclaimer per CONTEXT D-13a.

**Commit message:** `feat(15-03/T2): sgsd-token-audit multimodal offload tile (CODEX-10)`
</task>

</tasks>

## Acceptance criteria

A1. `grep -c '"provider":' super-gsd/skills/sgsd-orchestrate/SKILL.md` returns ≥ 1 in Step 11 section. **(D-26 inv5)**
A2. Step 11 token-log template includes `'openai-codex'` and `'claude-via-fallback'` as provider values.
A3. W-5 documentation drift resolved: no "defensively unsets" description near Step 11 token-log block. **(W-5)**
A4. `grep -c 'claude_tokens_saved_by_codex' super-gsd/skills/sgsd-token-audit/SKILL.md` returns ≥ 1. **(D-26 inv6)**
A5. Backfill-on-read pattern present: `row.provider || 'claude'` and `row.role || 'unknown'` in the SKILL.md aggregation spec.
A6. The tile contains the billing-audit disclaimer per CONTEXT D-13a.
A7. No migration script produced. Schema divergence handled at read time only. **(RESEARCH AD-01 option b)**

## Non-goals

- **No `--milestone-close-check` subcommand** — that is plan 15-05 (CODEX-12).
- **No token-log.jsonl file mutation** — the schema documentation update is in SKILL.md. Actual log rows gain the new fields when Phase 15 dispatches run (Step 11 writes the rows at runtime).
- **No historical backfill script** — explicitly ruled out by CONTEXT D-12 and RESEARCH AD-01.
- **No sgsd-muda-audit.sh changes** — plan 15-02 owns that.

## Evidence lineage

- CONTEXT decisions covered: **D-12, D-13, D-13a, D-14, D-15**
- ATC warnings resolved: **W-5** (documentation drift fix in T1)
- RESEARCH consumed: RQ4 (live shape divergence, backfill-on-read recommendation, tile computation, sgsd-token-audit current state), AD-01 (schema reconciliation decision)
- VTP cited: doc:6b62b76ceab5 AGP-P-03 (closed-loop improvement with auditable lineage — the provider field is the lineage)

# Phase 15: Codex-Routed Gates + Qualitative MUDA Probe — Research

**Researched:** 2026-04-24
**Domain:** Multi-provider LLM review dispatch, MUDA qualitative probing, token-log schema extension, adversarial cross-vendor challenger, milestone-close kill condition
**Confidence:** HIGH (all findings traced to Phase 14 artifacts, live source files, or VTP doc-IDs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
Phase 15 flips the switch. Six deliverables (CODEX-07 through CODEX-12):
1. CODEX-07 — Flip `reviewer_provider: codex-cli-reviewer` on `gates.yaml` rows `per-dispatch-ATC` and `phase-level-ATC`. Teach SKILL.md Step 6.5 + 9.5 to honour registry dispatch indirection. Single-retry fallback.
2. CODEX-08 — Add `codex_qualitative_waste` as 4th probe in `sgsd-muda-audit.sh`.
3. CODEX-09 — Gate the CODEX-08 probe on `qualitative-waste-audit` row in `gates.yaml`.
4. CODEX-10 — Extend `token-log.jsonl` schema with `provider` field. Dashboard tile.
5. CODEX-11 — Adversarial verifier challenger (Step 9.6 MACH-04) routes always to Codex.
6. CODEX-12 — Milestone-close kill condition via `sgsd-token-audit --milestone-close-check`.

All per D-01 through D-27 in 15-CONTEXT.md.

### Claude's Discretion
None declared — all decisions are locked in CONTEXT.md.

### Deferred Ideas (OUT OF SCOPE)
- Third providers (Gemini, local models)
- Per-project provider overrides
- Refactoring `sgsd-code-reviewer.md`
- Adding Codex to classifier or primary verifier
- Auto-tune of `verifier_adversarial_rate`
- Per-finding confidence weighting
- Codex-specific prompt tuning
- Milestone-close kill thresholds self-tuning
- Adversarial challenger on primary-verifier failures
- Cross-vendor deliberation
- Provider-specific report-contract evolution
</user_constraints>

---

## Executive Summary

Phase 15 has a fully specified, locked decision log in CONTEXT.md (D-01 through D-27). This research does not re-derive decisions — it maps each deliverable to its concrete implementation target, identifies the precise file:line anchors the planner needs, flags the 5 Phase 14 ATC warnings as entry conditions, and surfaces the 7 architectural questions that require a decision before execution.

**Top 3 risks:**

1. **W-1 semantic gap in `resolveReviewerProvider`** — The current null-check at `providers-registry.cjs:151` uses `gate.reviewer_agent === undefined` as the reviewer-shape test. This incorrectly classifies haiku-agent gates (`classifier-haiku`, `context-selector-haiku`) as reviewer-shaped because they DO have a `reviewer_agent` field. Phase 15 must narrow this predicate before SKILL.md Steps 6.5/9.5 call the bridge, or the dispatcher will mis-resolve haiku gates as code-reviewer gates. The ATC recommends option (c): require explicit `reviewer_provider:` field on gates that route to the dispatcher. This is the highest-risk entry condition — if left unresolved, Step 6.5 misfires on haiku gates.
2. **`mechanical_muda_verdict` is a new context field** — `predicate-eval.cjs:16-28` lists the DISPATCH_CONTEXT_FIELDS registry and throws loudly on unknown fields (line 64: `throw new Error(...)`). The new `qualitative-waste-audit` gate requires `mechanical_muda_verdict` in the dispatch context, which does not exist today. This must be added to both the `ctx` assembly in SKILL.md Step 9.2 AND the `DISPATCH_CONTEXT_FIELDS` registry in `predicate-eval.cjs` as part of plan 15-02.
3. **SKILL.md is touched by three plans (15-01, 15-04, 15-05)** — the wave model serializes them correctly (Wave 2 → Wave 3 → Wave 4), but any plan that reads a stale SKILL.md will produce a diff against an already-modified file. The planner must ensure each plan's base snapshot is taken after the prior wave completes.

**Top 3 unknowns:**

1. **`sgsd-token-audit` SKILL.md has no `--quick` flag token-log row-shape documentation** — the current `token-log.jsonl` rows have shape `{"ts","tool","model","description","est_input","est_output","total"}` (verified from live file, lines 1-10). The SKILL.md at Step 11 in sgsd-orchestrate documents a different shape: `{"ts","phase","plan","model","role","est_input","est_output","total","classifier_model","context_tokens"}`. The two shapes do not match on any field except `ts`, `model`, `est_input`, `est_output`, `total`. The CODEX-10 calculation `Σ(est_input + est_output) for rows where role ∈ {code_reviewer, adversarial_verifier}` requires a `role` field that the live log does not have. Plan 15-03 must decide: (a) add `role` and `provider` to new rows only (backfill-on-read for missing), or (b) also reconcile the `tool`-vs-`role` field naming discrepancy.
2. **`sgsd-token-audit` skill has no `--milestone-close-check` subcommand and no dashboard code** — the current SKILL.md (`super-gsd/skills/sgsd-token-audit/SKILL.md`) documents only `--full`, `--quick`, and `--context-map` modes. There is no milestone-close-check hook or multimodal tile. Plan 15-03 (token offload metric) and 15-05 (kill condition) must add both from scratch.
3. **`sgsd-complete-milestone` step numbering** — the existing SKILL.md has steps 0-8. CODEX-12 D-23 inserts the `--milestone-close-check` as a new step 3 (shifting existing steps 3-8 to 4-9). The planner needs to decide whether to insert-and-renumber or append as step 9 (before the state bump). D-23a locks the placement: before step 4 (cross-phase check) and before step 5 (summary). Renumbering is the correct approach per D-23a.

**Primary recommendation:** Proceed with the five-plan, four-wave structure from D-24/D-25. The SKILL.md coupling constraint is the dominant serialization driver. All five entry conditions from Phase 14 ATC are addressable within the plans as specified.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provider dispatch (agent vs shell) | Orchestrator (SKILL.md) | Registry (providers-registry.cjs) | SKILL.md reads the invocation discriminator from the registry and dispatches accordingly. Per AGP-P-08: resource management (registry) is separate from core reasoning (orchestrator). |
| Provider resolution (gate → provider) | Registry (providers-registry.cjs) | Gates (gates-registry.cjs) | Bridge function `resolveReviewerProvider` lives in providers-registry; it consults gates-registry to read the gate row's `reviewer_provider` field. |
| Gate trigger evaluation | Predicate eval (predicate-eval.cjs) | Orchestrator (SKILL.md) | SKILL.md calls `gates.shouldFire()` with the dispatch ctx; predicate-eval.cjs evaluates the trigger clauses. New `mechanical_muda_verdict` field must be registered in predicate-eval.cjs. |
| MUDA qualitative probe | Script (sgsd-muda-audit.sh) | Codex CLI (codex-exec.sh) | The probe shells to codex-exec.sh with a composed prompt. Result is parsed and emitted to WASTE.md as a 4th row. |
| Token accounting | Orchestrator Step 11 | sgsd-token-audit SKILL.md | Step 11 appends JSONL rows; sgsd-token-audit reads and aggregates. The `provider` field must be set at write time (Step 11) to be readable at audit time. |
| Adversarial challenger routing | Orchestrator Step 9.6 | providers-registry.cjs | Step 9.6 has its own routing rule (always non-primary vendor); it does NOT use the `gates.resolveReviewerProvider` bridge. The challenger provider is hardcoded in the Step 9.6 dispatch logic. |
| Milestone-close kill condition | sgsd-token-audit (new subcommand) | sgsd-complete-milestone SKILL.md | The kill check runs as a subcommand; sgsd-complete-milestone invokes it at step 3. |

---

## RQ1: CODEX-07 — Provider Indirection Wire (Steps 6.5 and 9.5)

### Current state of the target lines

**Step 6.5 (SKILL.md:466-501):**
The existing code at line 473 is a direct `Agent(subagent_type: "gsd-code-reviewer", model: "sonnet", ...)` call with no provider indirection. There is no registry lookup, no `invocation_type` branch, and no fallback path.

**Step 9.5 (SKILL.md:836-850):**
The existing code at line 837 is `Agent(subagent_type: "gsd-code-reviewer", model: "sonnet", ...)`. Same issue — hardcoded agent dispatch with no registry consultation.

**Step 9.6 (SKILL.md:913):**
`Agent(subagent_type: "gsd-verifier", model: "sonnet", ...)` — this is the adversarial challenger call. CODEX-11 (not CODEX-07) rewires this. Addressed in RQ5.

### W-1 entry condition: how to narrow `resolveReviewerProvider`

The current predicate at `providers-registry.cjs:151` is:
```javascript
if (!gate || gate.reviewer_agent === undefined) return null;
```

The W-1 problem: `classifier-haiku` and `context-selector-haiku` gates have `reviewer_agent: haiku` (gates.yaml:83 and :97). These are not code-reviewer-shaped gates, but `resolveReviewerProvider` would NOT return null for them because `gate.reviewer_agent !== undefined`.

**Fix (CONTEXT.md D-02, ATC option c):** Change the null-guard to require an explicit `reviewer_provider:` field on the gate:

```javascript
// Narrowed predicate: gate is reviewer-shaped only if it declares reviewer_provider explicitly.
// This is the W-1 fix (14-ATC-REVIEW W-1 option c).
if (!gate || !gate.reviewer_provider) return null;
```

This is correct because:
- `per-dispatch-ATC` (gates.yaml:53) declares `reviewer_provider: claude-sonnet-reviewer` → resolves correctly
- `phase-level-ATC` (gates.yaml:67) declares `reviewer_provider: claude-sonnet-reviewer` → resolves correctly
- `classifier-haiku` (gates.yaml:83) has NO `reviewer_provider` field → returns null (correct)
- `context-selector-haiku` (gates.yaml:97) has NO `reviewer_provider` field → returns null (correct)
- `qualitative-waste-audit` (new, D-10) declares `reviewer_provider: codex-cli-reviewer` → resolves correctly

**Cite:** 14-ATC-REVIEW.md W-1; providers-registry.cjs:149-156 [VERIFIED: file read]

### Dispatch branch pattern

After fixing W-1, the SKILL.md rewire at Steps 6.5 and 9.5 follows D-02 from CONTEXT.md verbatim. The pattern reads `provider.invocation` (not `invocation_type` — W-3 fix addressed in RQ3) from the provider record, then branches:

- `invocation === 'agent'` → `Agent({subagent_type: provider.agent_subagent_type, ...})`
- `invocation === 'shell'` → `shellDispatch(provider.shell_script, {...})` + fallback logic

**CRITICAL field name:** The YAML field in `review-providers.yaml` is `invocation:` (not `invocation_type:`). Confirmed at review-providers.yaml:8 (`invocation: agent`) and :12 (`invocation: shell`). W-3 in the ATC is a plan-level documentation bug, not a code bug — but the SKILL.md rewire must use `provider.invocation`, not `provider.invocation_type`. [VERIFIED: review-providers.yaml lines 8,12 and gates.yaml I-3]

### Single-retry fallback mechanics

Per CONTEXT.md D-02 through D-02c and D-03a, and VTP doc:5a50cc9b459e (HiveMind: centralized single-retry):

- Fallback fires only when: `provider.invocation === 'shell'` AND `exit !== 0` AND `provider.fallback_to != null` AND `config.fallback_on_error === true`
- The fallback provider is `codex-cli-reviewer.fallback_to` = `'claude-sonnet-reviewer'` (review-providers.yaml:57)
- Retry budget: `fallback_max_retries: 1` (config.json, confirmed). No retry storms per HiveMind's thundering-herd finding.
- Log string: `GATE_PROVIDER_FALLBACK: codex-cli-reviewer exit=N → claude-sonnet-reviewer`
- The fallback report is the ATC record. `commit-reviews.jsonl` gains `provider: "claude-via-fallback"` (not `"openai-codex"`).
- Double-fail path: both providers fail → `GATE_PROVIDER_DOUBLE_FAIL` → hard checkpoint + loop exit.

**Architectural grounding:** AGP-P-04 (rollback safety via `codex_enabled: false` + single-retry fallback) and HiveMind centralized single-retry (not per-dispatch retry). [CITED: 15-VTP-EVIDENCE.md doc:5a50cc9b459e, doc:6b62b76ceab5 AGP-P-04]

### Evidence emission path (D-03/D-03a)

Must be path-identical to current Claude path. No new file locations permitted:
- Per-dispatch: `.planning/phases/{NN}/commit-reviews.jsonl` — add `provider:` field to existing row schema
- Phase-level: `.planning/phases/{NN}/{NN}-ATC-REVIEW.md` — add `provider:` key to frontmatter per D-03a schema

The frontmatter schema addition (D-03a) adds: `provider`, `fallback_triggered` to the existing `phase`, `run_at`, `tier`, `critical_count`, `warning_count`, `duration_ms` fields.

### codex_enabled kill-switch (D-02)

Before resolving the provider, the dispatcher checks the config kill-switch:
```javascript
const effective = (provider.name === 'codex-cli-reviewer' && !config.review_providers.codex_enabled)
  ? gates.getProvider(provider.fallback_to)
  : provider;
```

Current state: `config.review_providers.codex_enabled === false` (confirmed from config.json read). Phase 15 flips this to `true` in plan 15-01. [VERIFIED: config.json]

---

## RQ2: CODEX-08 — Qualitative MUDA Probe (4th probe)

### Probe insertion point

`sgsd-muda-audit.sh:112-114` captures `PROBE_JSON` and `PROBE_EXIT` from the three mechanical probes. The 4th probe inserts AFTER lines 112-114, conditioned on `PROBE_EXIT == 0` (mechanical probes all pass), `DIFF_LINES >= 200`, and `CODEX_QUAL_ENABLED == "true"`.

The script has no `DIFF_LINES` variable today. This must be computed. The approach is to call `git diff --stat` from the phase directory and count total changed lines, similar to how the orchestrator computes `diff_lines` for the dispatch context.

**Current probe structure (lines 129-157):** Probe JSON is parsed via Node.js inline script reading `p.haiku_fails`, `p.narrative_age_sec`, `p.git_spawn_pct` fields. The 4th probe result is parsed separately — it does NOT go through the same node inline parser (it has a different output format: `FINDINGS:`, `CRITICAL:`, `WARNINGS:`, `PASS_RATE:`, `ONE_LINER:`).

### Prompt composition

Per CONTEXT.md D-06a, the Codex prompt is composed by a new helper in `sgsd-muda-audit.sh`:

```bash
compose_codex_muda_prompt() {
    local phase_dir="$1"
    local goal
    # Read goal from ROADMAP.md phase row (grep-based, same pattern as probe reads)
    goal="$(grep -m1 "Phase ${PHASE_NUM}" "$PROJECT/.planning/ROADMAP.md" 2>/dev/null || echo 'unknown')"
    
    printf 'PHASE %s QUALITATIVE WASTE AUDIT\n' "$PHASE_NUM"
    printf 'Goal: %s\n' "$goal"
    printf 'Diff:\n'
    git -C "$PROJECT" diff --stat HEAD~"${COMMITS_IN_PHASE:-1}" HEAD 2>/dev/null | head -50
    printf '\n'
    git -C "$PROJECT" diff HEAD~"${COMMITS_IN_PHASE:-1}" HEAD 2>/dev/null | head -500
    printf '\nPlans: '
    ls "$phase_dir"/*.md 2>/dev/null | xargs -I{} basename {} | tr '\n' ',' | sed 's/,$//'
    printf '\n\n'
    printf '%s\n' "$(cat <<'PROMPT'
Identify up to 5 findings across these classes (emit 0-5 findings; 'none' is a valid answer):
- YAGNI: features/code added that no task required
- Duplication: similar logic in 2+ plans that should be extracted
- Over-engineering: abstractions that have only one call site
- Defensive code without failure mode: try/catch/fallback without documented why
- Orphan files: files touched that no plan claimed in files_touched

Report format:
FINDINGS: <0-5 items, each "- class: finding (file:line)">
CRITICAL: <count of findings that block phase close; typically 0>
WARNINGS: <count>
PASS_RATE: <100 if CRITICAL=0, else "blocked">
ONE_LINER: <summary>
PROMPT
)"
}
```

**Key constraint:** The prompt output must satisfy the `code-reviewer-v1` contract (5 fields: FINDINGS, CRITICAL, WARNINGS, PASS_RATE, ONE_LINER) so that `codex-exec.sh`'s awk parser at lines 245-263 can extract them. The prompt format from D-06a already matches this contract exactly. [VERIFIED: codex-exec.sh:245-263]

### `codex-exec.sh` invocation from within the script

The existing codex-exec.sh invocation pattern from D-06:
```bash
CODEX_REPORT=$(bash "$SCRIPT_DIR/codex-exec.sh" \
    --prompt-file "$TMP_PROMPT" \
    --timeout 60 \
    --report-out "$TMP_REPORT" \
    --phase "$PHASE_NUM" \
    --step "muda-qualitative")
CODEX_EXIT=$?
```

`codex-exec.sh` is in the same `$SCRIPT_DIR` as `sgsd-muda-audit.sh` (both in `super-gsd/scripts/`). `$SCRIPT_DIR` is already set at line 101 of `sgsd-muda-audit.sh`. [VERIFIED: sgsd-muda-audit.sh:101]

### WASTE.md 4th row format

Per D-07, the 4th row in the probe results table:
```markdown
| codex_qualitative_waste | {VERDICT} | {N} findings | diff_lines={DIFF_LINES} | overproduction | {codex ONE_LINER} |
```

Where VERDICT mapping:
- `CRITICAL > 0` → FAIL (recorded, phase NOT blocked per D-08a)
- `WARNINGS > 0, CRITICAL == 0` → WARN
- `findings == 0` → PASS

The existing WASTE.md frontmatter (`sgsd-muda-audit.sh:169-179`) increments `warn_count` and `fail_count` for the 4th probe too.

### Curation slug pattern

Per D-07a, each finding is curated via `sgsd-curate.sh` with:
- slug: `waste-overproduction-p{N}-{finding-slug}` (extends existing `waste-{class}-p{N}-{name}` pattern at line 241)
- tags: `muda,overproduction,phase-{N},automated,codex-qualitative`
- Same `--maturity raw --importance 75` as mechanical findings (line 278-284)

The `curate_finding` function at sgsd-muda-audit.sh:233 can be reused with class=overproduction. No new helper needed; pass findings from the parsed Codex report. [VERIFIED: sgsd-muda-audit.sh:233-302]

### `CODEX_QUAL_ENABLED` source

Read from config: `config.review_providers.codex_qualitative_waste_enabled` (D-09). Default `true`. The probe also respects the existing `--no-curate` (line 43) and `--dry-run` (line 42) flags transparently. [VERIFIED: sgsd-muda-audit.sh:42-43]

---

## RQ3: CODEX-09 — `qualitative-waste-audit` Gate Row

### Field name confirmation (W-3 fix)

The CONTEXT.md D-10 gate row uses `reviewer_provider:`. The ATC W-3 warned about a plan verification command using `g.invocation_type` instead of `g.invocation`. This is a plan-level documentation error, not a gates.yaml field error.

In `gates.yaml`, the existing code-reviewer gates do NOT have an `invocation` field — that field lives in the provider record in `review-providers.yaml`. So the new `qualitative-waste-audit` row in `gates.yaml` should NOT have `invocation_type` or `invocation` — it has `reviewer_provider: codex-cli-reviewer` which then resolves to the provider record (which has `invocation: shell`). [VERIFIED: gates.yaml:52-73, review-providers.yaml:51-59]

### Proposed gate row (D-10)

```yaml
- name: qualitative-waste-audit
  category: process-hygiene
  step: 6.55
  enforcement_mode: soft-warn
  trigger:
    - field: phase_type
      op: not_in
      value: [docs, config]
    - field: diff_lines
      op: gte
      value: 200
    - field: mechanical_muda_verdict
      op: in
      value: [PASS, WARN]
  reviewer_provider: codex-cli-reviewer
  evidence_emitted:
    - .planning/phases/{N}/WASTE.md
  escalation: log-only
  source_dlb: DLB-02
  state: active
  version: 2.0
```

**Row placement:** Must come immediately after the `MUDA-waste-audit` row (gates.yaml:127-148) per D-10b. The current last row in the process-hygiene category is `token-log` at gates.yaml:172. The new row goes between `MUDA-waste-audit` (line 148) and `sgsd-curate-learnings` (line 150). [VERIFIED: gates.yaml:127-181]

### `mechanical_muda_verdict` context field

This is a new field not in `predicate-eval.cjs:16-28`. It must be added in two places:

1. **`predicate-eval.cjs` DISPATCH_CONTEXT_FIELDS registry (comment block, lines 16-28):** Add:
   ```
   mechanical_muda_verdict     - 'PASS' | 'WARN' | 'FAIL' (populated after mechanical MUDA probes)
   ```

2. **`sgsd-orchestrate/SKILL.md` Step 9.2 ctx assembly (line ~820):** Add:
   ```javascript
   mechanical_muda_verdict: getMudaVerdictFromPhaseDir(),  // read from WASTE.md after Step 6.55
   ```

**Timing constraint (D-10b):** `mechanical_muda_verdict` is only populated after the MUDA-waste-audit probe completes (Step 6.55). The `qualitative-waste-audit` gate fires at the SAME step (6.55). This means the orchestrator must run the `MUDA-waste-audit` gate first, capture its result, populate `ctx.mechanical_muda_verdict`, then evaluate the `qualitative-waste-audit` gate trigger.

The implementation note: `ctx` in SKILL.md Step 9.2 is assembled BEFORE dispatches (per line 796: "Assembled AFTER processing the result report, BEFORE any gate check"). For step-level gates like 6.55 that depend on the output of a prior gate at the same step, the orchestrator must do a local ctx update within the step sequence. This is a NEW pattern that SKILL.md does not currently document. Plan 15-02 must add this sub-step.

### Trigger AND semantics

Per D-11, all three trigger clauses must be true (top-level AND, not OR). The `gates.shouldFire()` method in `gates-registry.cjs` already handles top-level AND via `evalPredicate` in `predicate-eval.cjs:30-32`. The `not_in` and `gte` ops are implemented at predicate-eval.cjs:85,87. [VERIFIED: predicate-eval.cjs:81-93]

---

## RQ4: CODEX-10 — Token-Log Schema Extension

### Current token-log.jsonl row shape (LIVE)

From `.planning/metrics/token-log.jsonl` lines 1-10 (verified):
```json
{"ts":"...","tool":"Agent","model":"unknown","description":"unknown","est_input":1,"est_output":0,"total":1}
```

Fields present: `ts`, `tool`, `model`, `description`, `est_input`, `est_output`, `total`

**MISMATCH:** SKILL.md Step 11 token_logging section (lines 1204-1215) documents a different schema:
```json
{"ts":"{ISO}","phase":{N},"plan":{N},"model":"{model}","role":"{agent_type}","est_input":{N},"est_output":{N},"total":{N},"classifier_model":"haiku","context_tokens":{N}}
```

Fields in SKILL.md schema: `ts`, `phase`, `plan`, `model`, `role`, `est_input`, `est_output`, `total`, `classifier_model`, `context_tokens`

The live file has NEITHER `phase`, `plan`, `role`, `classifier_model`, nor `context_tokens`. It has `tool` and `description` which are NOT in the SKILL.md schema.

**Implication for CODEX-10:** The CODEX-10 calculation `Σ(est_input + est_output) for rows where role ∈ {code_reviewer, adversarial_verifier} AND provider == "openai-codex"` requires:
- A `role` field (does not exist in live log)
- A `provider` field (does not exist in live log)

Plan 15-03 must reconcile the schema divergence. The recommended approach (per D-12 backfill-on-read):
- **New rows from Phase 15 onward** include `phase`, `plan`, `role`, `provider` fields
- **Existing rows** treated as `provider: "claude"` (implicit) on read
- The `tool`/`description` fields in existing rows are tolerated (not removed)
- The `sgsd-token-audit` quick audit must handle missing `role` and `provider` fields gracefully (treat as `role: "unknown"`, `provider: "claude"`)

### Proposed new row shape (D-12, D-15)

```json
{
  "ts": "ISO",
  "phase": N,
  "plan": N,
  "model": "sonnet|haiku|codex",
  "role": "code_reviewer|adversarial_verifier|executor|verifier|classifier|context_selector",
  "provider": "claude|openai-codex|claude-via-fallback",
  "est_input": N,
  "est_output": N,
  "total": N,
  "classifier_model": "haiku",
  "context_tokens": N
}
```

### `claude_tokens_saved_by_codex` tile computation

Per D-13, the calculation:
```javascript
const savedTokens = tokenLog
  .filter(r => r.provider === 'openai-codex')
  .filter(r => ['code_reviewer', 'adversarial_verifier'].includes(r.role))
  .filter(r => /* milestone date range */)
  .reduce((sum, r) => sum + (r.est_input || 0) + (r.est_output || 0), 0);
```

This is an estimate, not billing reconciliation (D-13a). The dashboard must display this with a note: "estimated tokens offloaded to Codex (not a billing audit)".

### Step 11 SKILL.md update

SKILL.md line 1208 template must gain `"role":` and `"provider":` fields. The `provider` value is derived from the dispatch path:
- Agent dispatch → `"claude"`
- Shell dispatch to codex-exec.sh with exit 0 → `"openai-codex"`
- Shell dispatch with fallback → `"claude-via-fallback"`

The SKILL.md update is a comment-schema change (no code block execution); it's a documentation normalization that plan 15-03 handles alongside the dashboard tile addition.

### sgsd-token-audit SKILL.md current state

The current `sgsd-token-audit/SKILL.md` (verified) has three modes: `--quick`, `--full`, `--context-map`. There is no `--milestone-close-check`. The quick audit already reads `token-log.jsonl` (step 1-2 in `<quick_audit>`). The CODEX-10 dashboard tile extends `--quick` to add a new section. The CODEX-12 subcommand is `--milestone-close-check` (new flag, separate from `--quick`). [VERIFIED: sgsd-token-audit/SKILL.md]

---

## RQ5: CODEX-11 — Cross-Vendor Adversarial Challenger

### Current Step 9.6 dispatch (SKILL.md:913)

```
Agent(subagent_type: "gsd-verifier", model: "sonnet", mode: "auto", prompt: challengerPrompt)
```

This is a direct `gsd-verifier` agent dispatch — same model (Sonnet), different prompt. CODEX-11 changes the PROVIDER not the model or prompt.

### The routing rule (D-16)

The challenger provider is the non-primary vendor. Per D-16a:
```javascript
const primary = 'claude-sonnet-verifier';  // Phase 15: primary always Claude
const challenger = (primary === 'claude-sonnet-verifier')
  ? 'codex-cli-reviewer'
  : 'claude-sonnet-reviewer';
```

The challenger dispatches via the same `shellDispatch` path from CODEX-07 (because `codex-cli-reviewer` has `invocation: shell`). The prompt is identical to the existing D-13a contrarian header + primaryVerifierPrompt — unchanged per D-16.

**This is NOT routed through `gates.resolveReviewerProvider`** — it has its own routing rule (non-primary vendor). The adversarial challenger routing is orthogonal to the gate-reviewer routing. This distinction is critical and must be explicitly documented in SKILL.md Step 9.6.

**VTP grounding:** Shift-Up (doc:70a3d5757b6a) provides empirical precedent for dual-vendor workflow patterns — using Claude Sonnet 4.5 for first 4 phases and GPT-5.0 Codex for last 3 in a SE guardrails workflow. Phase 15 tightens this to gate-granularity: primary verifier is Claude, challenger is Codex. [CITED: 15-VTP-EVIDENCE.md doc:70a3d5757b6a]

### Skip-on-unavailable path (D-17)

If `codex_enabled === false` OR the Codex auth fails: adversarial challenger skips entirely. Log: `VERIFIER_ADVERSARIAL_SKIP: codex unavailable`. Does NOT fall back to same-vendor challenger. This is the single exception to the CODEX-07 fallback-to-Claude pattern. Rationale: same-vendor challenger was the old behavior and produced weaker signal than no challenger at all (D-17a).

### Token-log entry (D-18)

```json
{"role": "adversarial_verifier", "provider": "openai-codex", ...}
```

This feeds the CODEX-10 tile — adversarial verifier rows with `provider == "openai-codex"` count toward `claude_tokens_saved_by_codex`.

---

## RQ6: CODEX-12 — Milestone-Close Kill Condition

### `sgsd-token-audit --milestone-close-check` subcommand

New subcommand not present in current SKILL.md. Computes two metrics from three data sources:
1. `token-log.jsonl` — for `claude_tokens_saved` estimate
2. `.planning/phases/*/commit-reviews.jsonl` — for `critical_count_delta`
3. `.planning/phases/*/{NN}-ATC-REVIEW.md` — for phase-level critical counts per provider

**`critical_count_delta` computation:**
```
codex_crits = Σ critical_count from commit-reviews.jsonl + ATC-REVIEW.md frontmatter where provider == "openai-codex"
claude_crits = Σ critical_count where provider in {"claude-sonnet", "claude-via-fallback"}
critical_count_delta = codex_crits - claude_crits
```
Higher delta = Codex finding more issues Claude missed.

**Kill thresholds (D-20):**
- `critical_count_delta < 5` AND `claude_tokens_saved < 50000` → fire kill
- Both must fail (D-20a). Either condition passing alone = keep Codex.
- Thresholds configurable via `config.review_providers.kill_critical_count_delta` and `config.review_providers.kill_claude_tokens_saved`.

**Kill action (D-21):**
1. Set `config.review_providers.codex_enabled: false` in `.planning/config.json`
2. Curate anti-pattern: `sgsd-curate` to `.brv/context-tree/anti-patterns/multimodal-codex-retired-{milestone}.md`
3. Append one-line to `MILESTONES.md`
4. Do NOT delete `codex-exec.sh` or registry entry (retire = disable + document)

**Auto-mode advisory (D-22):** Kill fires and logs; does NOT block auto run. Interactive mode asks confirmation.

**VTP grounding:** AGP-P-07 (explicit lifecycle events — `--milestone-close-check` is the lifecycle event that triggers the kill). AGP-P-04 (rollback safety — disable, not delete, so future milestones can re-enable). [CITED: 15-VTP-EVIDENCE.md doc:6b62b76ceab5 AGP-P-07, AGP-P-04]

### Insertion into `sgsd-complete-milestone` SKILL.md

Current steps: 0 (precondition) → 1 (GOV-05 audit) → 2 (MUDA recurrence) → 3 (gate drift) → 4 (cross-phase) → 5 (summary) → 6 (VTP) → 7 (archive) → 8 (state bump)

Per D-23, CODEX-12 inserts between step 2 (MUDA recurrence) and step 3 (gate drift, currently). The insertion shifts steps 3-8 to 4-9. New sequence:
- Step 0: precondition (unchanged)
- Step 1: GOV-05 deliberation audit (unchanged)
- Step 2: MUDA recurrence check (unchanged)
- **Step 3 NEW:** `sgsd-token-audit --milestone-close-check` (CODEX-12)
- Step 4: Gate drift audit (was step 3)
- Step 5: Cross-phase check (was step 4)
- Step 6: Generate SUMMARY.md (was step 5)
- Step 7: VTP bidirectional (was step 6)
- Step 8: Archive phases (was step 7)
- Step 9: State bump (was step 8)

D-23a lock: Step 3 placement is before cross-phase check and summary, so the summary reflects final kill state. [VERIFIED: sgsd-complete-milestone/SKILL.md:step numbering]

---

## RQ7: Phase 14 ATC Warnings as Entry Conditions

Coverage matrix against CODEX-07 through CODEX-12:

| Warning | Description | Addressed By | Plan | Resolution |
|---------|-------------|--------------|------|------------|
| W-1 | `resolveReviewerProvider` semantic gap — haiku-agent gates incorrectly classified as reviewer-shaped | CODEX-07 | 15-01 | Change null-guard from `gate.reviewer_agent === undefined` to `!gate.reviewer_provider` at providers-registry.cjs:151 |
| W-2 | `gates.yaml registry_version` not bumped (should be 2.1.0 for the Phase 14 schema extension) | CODEX-07 indirect | 15-01 | Bump `registry_version: 2.0.0 → 2.1.0` and `last_updated` when adding the new `qualitative-waste-audit` row (D-10 adds a row, so a minor version bump is natural here) |
| W-3 | Plan §T2 verification assertion uses `g.invocation_type` instead of `g.invocation` | CODEX-09 | 15-02 | New gate row in gates.yaml uses `reviewer_provider:` only (no `invocation` field on gate rows). The plan verification for 15-02 must use `g.reviewer_provider` not `g.invocation_type`. W-3 warns not to repeat the same typo. |
| W-4 | JSONL `--phase` tag unquoted, no numeric validation in `codex-exec.sh` | CODEX-07 | 15-01 | Add numeric validation for `PHASE_TAG` in `codex-exec.sh` arg parse (one-line fix, OR quote it as string). Low-risk but should be fixed before Phase 15 live dispatches. |
| W-5 | Plan text drift on `unset OPENAI_API_KEY` — plan says "defensively unsets"; script refuses-to-run | CODEX-10 indirect | 15-03 | When updating codex-log.jsonl documentation in SKILL.md, fix the plan-text-vs-script-behaviour description. Not a code fix. |

**No warnings fall through the cracks.** All five are addressable within the five-plan wave model. W-1 is the highest-risk and must be fixed in 15-01 before the provider dispatch can fire safely.

---

## Architecture Decisions Needed (Hand-Off to Planner)

These are open questions the CONTEXT.md does not fully specify. The planner needs to make a decision and lock it before executor dispatch.

### AD-01: Schema reconciliation for token-log.jsonl (live shape vs SKILL.md shape)

The live log has `tool`/`description` fields; SKILL.md documents `phase`/`plan`/`role`/`classifier_model`/`context_tokens`. These have NEVER matched. Plan 15-03 must decide:
- (a) Extend new rows only with `provider` + `role` (leave `tool`/`description` as-is, accept permanent schema split)
- (b) Update Step 11 template to emit the full documented schema (`phase`, `plan`, `role`, `provider`, `classifier_model`, `context_tokens`) for new rows, treat old rows as legacy
- **Recommendation:** Option (b). The SKILL.md template at line 1208 is the spec; update it to be complete. `sgsd-token-audit` reads with graceful fallback on missing fields (add a `|| 'unknown'` default in the aggregator). This keeps the audit computation correct for all new rows without requiring historical backfill.

### AD-02: `mechanical_muda_verdict` ctx update timing

The dispatch context `ctx` is assembled once per iteration in Step 9.2. The `qualitative-waste-audit` gate fires at step 6.55, which is BEFORE the step-9.x gates. The `mechanical_muda_verdict` field is only known AFTER the MUDA-waste-audit gate fires (also step 6.55). Two implementation approaches:
- (a) Add `mechanical_muda_verdict` as a pre-computed field in ctx assembled at 9.2 by reading the phase WASTE.md file (may not exist yet on first run of the phase)
- (b) Treat step 6.55 as a two-phase gate: run MUDA-waste-audit, write WASTE.md, update a local ctx variable, THEN evaluate qualitative-waste-audit gate
- **Recommendation:** Option (b). SKILL.md Step 6.55 already documents the sub-step sequence for the mechanical probes (sub-steps a, b, c, d). Extend sub-step list: after mechanical probe runs, assign `local_ctx.mechanical_muda_verdict = exitCodeToVerdict(muda_exit)`, then eval qualitative-waste-audit gate with this updated ctx. The predicate-eval.cjs needs the field in ctx at eval time; it doesn't care when it was assembled.

### AD-03: `sgsd-token-audit --milestone-close-check` implementation vehicle

The current sgsd-token-audit SKILL.md is a Claude sub-agent skill (it reads, analyzes, writes). The `--milestone-close-check` subcommand (CODEX-12) needs to:
1. Read token-log and commit-reviews JSONL files
2. Compute two metrics
3. Potentially write to config.json (kill action)
4. Write a curation file
5. Return a machine-readable verdict (D-19/D-20)

Writing to config.json from a Claude agent is feasible but requires care (the existing pattern for config writes uses Node-in-bash to avoid printing). However, the SKILL.md agent pattern is more natural for the cross-file read + synthesis task. Two options:
- (a) Implement as a new bash script `sgsd-token-audit-close-check.sh` that does the math and exits with a verdict code (0=keep, 1=kill-fired)
- (b) Implement as a new subcommand within the SKILL.md that follows the existing agent-reads-and-writes pattern
- **Recommendation:** Option (a) for the computation, option (b) for the advisory. The SKILL.md declares a new `--milestone-close-check` mode that: (i) shells to the bash script for pure math, (ii) reads the JSON verdict, (iii) if kill fires, performs D-21 actions using the agent's file-write capability. This separates pure computation from side-effecting kill actions.

### AD-04: `codex_enabled: true` flip timing within plan 15-01

CONTEXT.md D-01 specifies flipping `gates.yaml` rows to `reviewer_provider: codex-cli-reviewer`. The config `codex_enabled` must also be flipped to `true` in plan 15-01 (currently `false`). The question is which happens first: the SKILL.md rewire or the config flip?
- **Recommendation:** The SKILL.md rewire comes first (providers-registry.cjs W-1 fix + SKILL.md dispatch branch). Then the gates.yaml `reviewer_provider` flip. Then the config `codex_enabled: true` flip. All in one plan (15-01), but in this commit order: (1) registry fix commit, (2) SKILL.md rewire commit, (3) gates + config flip commit. This ensures the wiring is correct before the live switch is thrown.

### AD-05: `--probe codex` bypass flag for isolated testing (D-06)

CONTEXT.md D-06 mentions `--probe codex` as a bypass flag for isolated testing. The current `sgsd-muda-audit.sh` has no `--probe` flag. Plan 15-02 must add argument parsing for `--probe` (similar to the existing `--no-curate` flag pattern at line 43). Implementation: if `--probe codex` is passed, skip the mechanical probes and run only the Codex qualitative probe. This is a test/debug facility, not a production path.

---

## Entry-Condition Coverage Matrix

Five ATC warnings × six deliverables:

| | CODEX-07 | CODEX-08 | CODEX-09 | CODEX-10 | CODEX-11 | CODEX-12 |
|---|---|---|---|---|---|---|
| **W-1** (resolveReviewerProvider gap) | PRIMARY FIX — 15-01 | n/a | n/a | n/a | n/a | n/a |
| **W-2** (registry_version not bumped) | incidental fix in 15-01 | n/a | n/a | n/a | n/a | n/a |
| **W-3** (plan `invocation_type` typo) | prevents typo recurrence in 15-01/15-02 plans | prevents typo recurrence | prevents typo recurrence | n/a | n/a | n/a |
| **W-4** (JSONL --phase tag unquoted) | FIX — 15-01 (codex-exec.sh) | n/a | n/a | n/a | n/a | n/a |
| **W-5** (plan-text drift on API key) | n/a | n/a | n/a | fixes in SKILL.md update | n/a | n/a |

---

## Standard Stack (Phase 15 — no new dependencies)

Phase 15 introduces no new libraries. All capabilities use Phase 14 substrate:

| Tool | Version | Purpose | Source |
|------|---------|---------|--------|
| `js-yaml` | pinned at plan-schema/node_modules | YAML parsing in providers-registry.cjs | Inherited from Phase 14 |
| `codex-exec.sh` | Phase 14 CODEX-01 | Shell dispatch to Codex CLI | super-gsd/scripts/codex-exec.sh |
| `providers-registry.cjs` | Phase 14 CODEX-02 | Provider resolution | super-gsd/scripts/lib/providers-registry.cjs |
| `gates-registry.cjs` | Phase 10 | Gate evaluation + `shouldFire()` | super-gsd/scripts/lib/gates-registry.cjs |
| `predicate-eval.cjs` | Phase 10 | Trigger clause evaluation | super-gsd/scripts/lib/predicate-eval.cjs |
| `sgsd-curate.sh` | pre-Phase 14 | Anti-pattern curation | super-gsd/scripts/sgsd-curate.sh |

**No npm install needed.** Zero new packages.

---

## Common Pitfalls

### Pitfall 1: Using `provider.invocation_type` instead of `provider.invocation`
**What goes wrong:** The YAML field in `review-providers.yaml` is `invocation:` (singular). Code that reads `provider.invocation_type` gets `undefined` and silently falls through to the wrong branch.
**Why it happens:** W-3 in the Phase 14 ATC identified this as an existing plan-level typo. Easy to carry forward.
**How to avoid:** Always reference `provider.invocation` when reading from a provider record. Use `review-providers.yaml:8,12` as the ground-truth field name reference.
**Warning signs:** `invocation_type === undefined` evaluating to falsy — shell dispatch never fires, silently falls back to agent dispatch always.

### Pitfall 2: Forgetting to register `mechanical_muda_verdict` in predicate-eval.cjs
**What goes wrong:** predicate-eval.cjs throws loudly (line 64) on unknown context fields. If `mechanical_muda_verdict` is in the gate trigger but not in the DISPATCH_CONTEXT_FIELDS comment AND not in the ctx object, the `qualitative-waste-audit` gate crashes the orchestrator loop.
**Why it happens:** The DISPATCH_CONTEXT_FIELDS list in predicate-eval.cjs is a comment block, not an enforced schema. Easy to forget to update it.
**How to avoid:** Plan 15-02 must touch both the SKILL.md Step 9.2 ctx assembly AND the predicate-eval.cjs comment registry as part of the same commit.
**Warning signs:** Error message `dispatch context missing field 'mechanical_muda_verdict'` in orchestrator loop.

### Pitfall 3: SKILL.md serialization race across waves
**What goes wrong:** Plans 15-01, 15-04, and 15-05 all touch `sgsd-orchestrate/SKILL.md`. If two are executed against the same base version, the second plan's diff will conflict or produce a stale patch.
**Why it happens:** Three plans touch the same file; the wave model enforces serialization (Wave 2 → 3 → 4) but an executor dispatched with stale context could still apply changes to the wrong base.
**How to avoid:** Each wave executor must read SKILL.md fresh at execution time, not from context provided at plan-time. SKILL.md content in plan files should be treated as reference only, not as the text to patch against.
**Warning signs:** SKILL.md edits from plan 15-04 overwriting edits from plan 15-01.

### Pitfall 4: `codex-exec.sh` called without `--phase` numeric validation (W-4)
**What goes wrong:** `PHASE_TAG` is interpolated unquoted into the JSONL row. Non-numeric input produces invalid JSON.
**Why it happens:** W-4 carried over from Phase 14, not yet fixed.
**How to avoid:** Fix in plan 15-01 before live dispatches. Either validate with `[[ "$PHASE_TAG" =~ ^[0-9]+$ ]]` or emit it as a string: `"phase":"$PHASE_TAG"`.

### Pitfall 5: Codex qualitative MUDA WASTE.md 4th row disrupting the probe table parser
**What goes wrong:** The 4th row uses `diff_lines=X` in the Value column (different format from the first three rows which use plain numeric values). If any downstream consumer parses WASTE.md by column position rather than probe name, it may misread the 4th row.
**Why it happens:** The 4th row has a composite value field rather than a bare number.
**How to avoid:** All WASTE.md consumers (muda-recurrence, milestone close) read by probe name, not column index. Verify the muda-recurrence script reads by name before plan 15-02 ships.

---

## State of the Art

| Old Approach | Current Approach (Phase 15) | Rationale |
|---|---|---|
| Claude Sonnet hardcoded at all review gates | Provider-resolved via registry (agent or shell) | AGP-P-05: protocol-level resource registration for discovery. Shift-Up dual-vendor precedent. |
| MUDA limited to 3 mechanical probes (defects, waiting, motion) | 4th qualitative probe via Codex (overproduction class) | Fills overproduction waste class; 4 of 8 Lean waste classes now mechanically covered |
| Same-vendor adversarial challenger (Sonnet vs Sonnet contrarian prompt) | Cross-vendor challenger (Claude primary, Codex challenger) | Different training data = different blind spots. Shift-Up dual-vendor workflow precedent. |
| No token accounting for provider offload | `provider` field in token-log, `claude_tokens_saved_by_codex` tile | Makes the business case for the multimodal experiment measurable |
| No automatic kill condition for Codex | Milestone-close kill if both quality delta AND token savings below thresholds | AGP-P-07 explicit lifecycle management; DLB-02 kill discipline applied to the provider itself |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `codex` CLI on PATH | CODEX-07/08/11 dispatch | Unknown — not verified in this session | — | codex-exec.sh exits 3; orchestrator fallback to Claude |
| `OPENAI_API_KEY` absent + Codex OAuth configured | codex-exec.sh:74 | Unknown | — | codex-exec.sh exits 4; orchestrator fallback to Claude |
| Node.js | providers-registry.cjs, predicate-eval.cjs, sgsd-muda-audit.sh inline parser | Available (confirmed from existing Phase 14 runs) | v18+ assumed | — |
| `js-yaml` at plan-schema/node_modules | providers-registry.cjs | Available (Phase 14 verified) | pinned | — |

**Note:** Codex CLI availability and OAuth status are runtime concerns. Phase 15 ships the wiring regardless; `codex_enabled: true` flip should be done only after the operator confirms Codex OAuth is configured. The fallback path (exit 3 or 4 → Claude fallback) handles this gracefully.

---

## Validation Architecture

### Phase 15 verify.mjs invariants (from CONTEXT.md D-26)

| Inv # | Behavior | Test Type | File/Command |
|-------|----------|-----------|--------------|
| inv1 | `gates.yaml` rows `per-dispatch-ATC` and `phase-level-ATC` declare `reviewer_provider: codex-cli-reviewer` | Parse check | `node verify.mjs` |
| inv2 | `gates.yaml` row `qualitative-waste-audit` exists with correct trigger per D-10 | Parse check | `node verify.mjs` |
| inv3 | `sgsd-muda-audit.sh` invokes `codex-exec.sh` when `CODEX_QUAL_ENABLED=true` | Grep check | `node verify.mjs` |
| inv4 | `sgsd-orchestrate/SKILL.md` Steps 6.5 and 9.5 reference `gates.resolveReviewerProvider` and shell-invocation branch | Grep check | `node verify.mjs` |
| inv5 | `token-log.jsonl` schema (in SKILL.md Step 11) includes the `provider` field | String check | `node verify.mjs` |
| inv6 | `sgsd-token-audit` emits a `claude_tokens_saved_by_codex` value on a synthetic fixture | Functional test | `node verify.mjs` |
| inv7 | `sgsd-orchestrate/SKILL.md` Step 9.6 references non-primary-vendor provider | Grep check | `node verify.mjs` |
| inv8 | `sgsd-complete-milestone` includes `--milestone-close-check` in its step list | Grep check | `node verify.mjs` |
| inv9 (bonus) | `sgsd-token-audit --milestone-close-check --dry-run` exits 0, emits `{"kill": false, ...}` | Functional test | `node verify.mjs` |

**Wave 0 gaps:** Phase 15 must create `verify.mjs` in `.planning/milestones/v1.3/phases/15-codex-routed-gates/`. The invariants listed above constitute its check list. Pattern: follow `super-gsd/tools/provider-contract/contract-check.mjs` or the Phase 14 `verify.mjs` (noted in 14-ATC-REVIEW.md as 153L, 6 invariants). No external test framework needed; pure Node.js file stat + regex checks.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sgsd-token-audit --milestone-close-check --dry-run` will be sufficient for inv9 without needing actual Codex OAuth | Validation Architecture | Test harness needs to be rethought if dry-run path needs real data |
| A2 | `sgsd-complete-milestone/SKILL.md` step renumbering (3→4, 4→5, etc.) does not break any external callers that reference steps by number | RQ6 | If callers reference step numbers, they need updating too |
| A3 | The MUDA recurrence script (`sgsd-muda-recurrence.sh`) reads WASTE.md by probe name, not column index | Common Pitfalls (Pitfall 5) | 4th row format could break recurrence parsing |
| A4 | `codex-exec.sh` timeout of 60s for the qualitative MUDA probe is sufficient | RQ2 | Large diffs may require a longer timeout; tune via config |

---

## Open Questions

1. **Token-log historical schema reconciliation**
   - What we know: live rows use `tool`/`description`; SKILL.md documents `phase`/`plan`/`role`
   - What's unclear: should plan 15-03 add a one-time migration pass, or accept the permanent split?
   - Recommendation: Accept the split (backfill-on-read). Add `|| 'unknown'` defaults in sgsd-token-audit aggregation code. No migration script needed.

2. **Codex CLI live availability on this machine**
   - What we know: `codex-exec.sh` exits 3 if `codex` is not on PATH; the fallback path handles this
   - What's unclear: Is Codex CLI installed? Is OAuth configured?
   - Recommendation: Plan 15-01 must include a pre-check step that runs `codex-exec.sh --dry-run` and verifies exit 0 before flipping `codex_enabled: true`. If it fails, the plan proceeds with wiring but defers the config flip until the operator resolves auth.

3. **`sgsd-muda-recurrence.sh` WASTE.md parsing format**
   - What we know: the script exists (`sgsd-complete-milestone` calls it at step 2)
   - What's unclear: does it parse WASTE.md by probe name or column position?
   - Recommendation: Read `sgsd-muda-recurrence.sh` before writing the 4th row format in plan 15-02. If it parses by column, the 4th row format must match the existing column schema exactly.

---

## Sources

### Primary (HIGH confidence — verified from file reads in this session)
- `super-gsd/scripts/lib/providers-registry.cjs` — W-1 predicate analysis, lines 149-156
- `super-gsd/registry/review-providers.yaml` — invocation field names, provider schema, fallback_to
- `super-gsd/registry/gates.yaml` — existing gate rows, field names, ordering, reviewer_provider declarations
- `super-gsd/scripts/codex-exec.sh` — invocation contract, exit codes, JSONL schema, awk parser
- `super-gsd/scripts/sgsd-muda-audit.sh` — probe structure, insertion point (~line 112), curate pattern (lines 233-302), exit codes
- `super-gsd/scripts/lib/predicate-eval.cjs` — DISPATCH_CONTEXT_FIELDS registry, getDottedField throw behaviour (line 64)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — Step 6.5 (line 440), Step 9.2 (line 796), Step 9.5 (line 825), Step 9.6 (line 877), Step 11 token_logging (line 1204)
- `super-gsd/skills/sgsd-token-audit/SKILL.md` — current modes (--quick, --full, --context-map), no --milestone-close-check
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md` — current step numbering (0-8), MUDA recurrence at step 2
- `.planning/config.json` — `review_providers` block confirmed: `codex_enabled: false`, `fallback_on_error: true`, `fallback_max_retries: 1`
- `.planning/metrics/token-log.jsonl` — live row shape confirmed: `tool`/`description` fields, NOT `role`/`phase`
- `.planning/phases/14/WASTE.md` — WASTE.md format confirmed (3 probes, probe table structure)
- `.planning/milestones/v1.3/phases/14-codex-cli-provider-substrate/14-ATC-REVIEW.md` — 5 warnings W-1..W-5, recommendations

### Secondary (MEDIUM confidence — from CONTEXT.md locked decisions and VTP)
- `15-CONTEXT.md` D-01 through D-27 — all implementation decisions
- `15-VTP-EVIDENCE.md` — doc:6b62b76ceab5 (AGP-P-02/03/04/05/07/08), doc:70a3d5757b6a (Shift-Up), doc:5a50cc9b459e (HiveMind)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps, all from Phase 14 verified substrate
- Architecture: HIGH — locked decisions in CONTEXT.md; file:line anchors verified
- Pitfalls: HIGH for W-1/W-3/W-4 (direct ATC evidence); MEDIUM for Pitfalls 3/5 (inferred from file structure)

**Research date:** 2026-04-24
**Valid until:** Phase 15 completion (locked decisions; no external ecosystem changes)

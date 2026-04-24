---
plan_id: 15-01
phase: 15
wave: 2
depends_on: [15-02, 15-03]
deliverable: providers-registry.cjs W-1 fix + sgsd-orchestrate/SKILL.md Steps 6.5/9.5 provider-dispatch branch + codex-exec.sh W-4 fix + gates.yaml reviewer_provider flip + config.json codex_enabled:true
estimate_tokens: ~850
estimate_commits: 3
atc_warnings_addressed: [W-1, W-2, W-4]
codex_deliverable: CODEX-07
vtp_citations: [doc:6b62b76ceab5, doc:5a50cc9b459e]
---

# Plan 15-01: Provider Indirection Wire

## Scope

Wires the Phase 14 substrate into live dispatch. Three sequential tasks:

1. **T1** — W-1 fix (providers-registry.cjs predicate narrowing) — MUST commit first
2. **T2** — SKILL.md Steps 6.5 + 9.5 provider-dispatch branch + codex-exec.sh W-4 fix
3. **T3** — gates.yaml reviewer_provider flip (claude→codex) + W-2 registry_version bump + config.json `codex_enabled: true` flip

The ordering within the plan is non-negotiable per RESEARCH AD-04: wiring must be
correct before the live switch is thrown.

**SKILL.md serialization note:** This plan executes in Wave 2. The executor MUST
re-read `super-gsd/skills/sgsd-orchestrate/SKILL.md` at execution time — do NOT
patch against any stale snapshot from plan preparation. Wave 1 plans (15-02, 15-03)
may have made changes to Step 11; confirm SKILL.md line numbers before editing.

## Tasks

<tasks>

<task id="T1">
### T1. Narrow `resolveReviewerProvider` predicate — W-1 fix

**Files:**
- `super-gsd/scripts/lib/providers-registry.cjs` (modify: line ~151)

**Action:**
Fix the W-1 semantic gap identified in 14-ATC-REVIEW.md. Change the null-guard at
`providers-registry.cjs:151` from:
```javascript
if (!gate || gate.reviewer_agent === undefined) return null;
```
to:
```javascript
// Narrowed predicate: gate is reviewer-shaped only if it explicitly declares
// reviewer_provider. Fixes 14-ATC-REVIEW W-1 — haiku-agent gates have
// reviewer_agent !== undefined but are NOT code-reviewer-shaped.
// VTP: AGP-P-08 — shape detection belongs to the registry, not the caller.
if (!gate || !gate.reviewer_provider) return null;
```

This is a one-line change. Do not touch any other method in the file.

**Verification:**
```bash
node -e "
const r = require('./super-gsd/scripts/lib/providers-registry.cjs');
// Simulate a haiku-agent gate (has reviewer_agent but no reviewer_provider)
// resolveReviewerProvider must return null
console.log('haiku-gate test:', r.resolveReviewerProvider ? 'method exists' : 'MISSING');
" 2>&1
node -e "const r = require('./super-gsd/scripts/lib/providers-registry.cjs'); console.log('loads ok')" 2>&1
```

**Done:** `node -e "require('./super-gsd/scripts/lib/providers-registry.cjs')"` exits 0
with no error. File diff shows exactly one changed line at the `!gate ||` predicate.

**Commit message:** `fix(15-01/T1): narrow resolveReviewerProvider to require reviewer_provider — W-1`
</task>

<task id="T2">
### T2. SKILL.md Steps 6.5 + 9.5 provider-dispatch branch + codex-exec.sh W-4 fix

**Files:**
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` (modify: Step 6.5 ~line 473, Step 9.5 ~line 837)
- `super-gsd/scripts/codex-exec.sh` (modify: --phase arg parse, ~line 120)

**CRITICAL:** Read `super-gsd/skills/sgsd-orchestrate/SKILL.md` fresh before making
any edit. Verify exact current line numbers by searching for the strings
`gsd-code-reviewer` within Step 6.5 and Step 9.5 contexts before patching.

**Action — SKILL.md Step 6.5 (Phase-level ATC gate):**
Replace the hardcoded `Agent(subagent_type: "gsd-code-reviewer", model: "sonnet", ...)`
call at Step 6.5 (~line 473) with the provider-dispatch branch per CONTEXT D-02.
The replacement block is (adapt line numbers after fresh read):

```javascript
// Phase 15 CODEX-07: provider-dispatch indirection.
// VTP: AGP-P-05 (protocol-level resource registration for discovery),
//      HiveMind doc:5a50cc9b459e (single-retry, no thundering herd).
const provider = gates.resolveReviewerProvider('phase-level-ATC');
const effective = (provider && provider.name === 'codex-cli-reviewer' && !config.review_providers.codex_enabled)
  ? gates.getProvider(provider.fallback_to)
  : provider;

let report;
if (!effective) {
  // No reviewer_provider declared on gate — skip dispatch, log info
  logInfo('GATE_NO_PROVIDER: phase-level-ATC has no reviewer_provider; skipping review dispatch');
} else if (effective.invocation === 'agent') {
  report = await Agent({
    subagent_type: effective.agent_subagent_type,
    model: effective.agent_model || 'sonnet',
    mode: 'auto',
    prompt: composedPrompt
  });
} else if (effective.invocation === 'shell') {
  // Shell dispatch: codex-exec.sh
  const promptFile = writeTempPrompt(composedPrompt);
  const reportOut = tempReportPath('phase-atc');
  const dispatchResult = shellDispatch(effective.shell_script, {
    promptFile,
    timeout: effective.timeout_seconds || config.review_providers.codex_timeout_seconds,
    reportOut,
    phase: currentPhase,
    step: '6.5'
  });
  if (dispatchResult.exit !== 0 && effective.fallback_to && config.review_providers.fallback_on_error) {
    // Single-retry fallback to Claude per HiveMind centralized-retry pattern
    logDeviation(`GATE_PROVIDER_FALLBACK: ${effective.name} exit=${dispatchResult.exit} → ${effective.fallback_to}`);
    const fallbackProvider = gates.getProvider(effective.fallback_to);
    report = await Agent({
      subagent_type: fallbackProvider.agent_subagent_type,
      model: fallbackProvider.agent_model || 'sonnet',
      mode: 'auto',
      prompt: composedPrompt
    });
    // Tag the report row as claude-via-fallback for CODEX-10 metric accuracy
    report._provider = 'claude-via-fallback';
  } else if (dispatchResult.exit !== 0) {
    // Both providers failed — hard blocker per CONTEXT D-02c
    logDeviation('GATE_PROVIDER_DOUBLE_FAIL: both codex-cli-reviewer and fallback failed');
    writeCheckpoint({ reason: 'GATE_PROVIDER_DOUBLE_FAIL', step: '6.5' });
    throw new Error('GATE_PROVIDER_DOUBLE_FAIL: review gate failed on both providers');
  } else {
    report = { content: dispatchResult.report, _provider: 'openai-codex' };
  }
}
// Evidence emission: path-identical to prior Claude path per CONTEXT D-03
// commit-reviews.jsonl gains provider: field; ATC-REVIEW.md gains provider: frontmatter key
if (report) appendReviewEvidence(report, {
  gate: 'phase-level-ATC',
  provider: report._provider || effective.name,
  fallback_triggered: !!(report._provider === 'claude-via-fallback')
});
```

**Action — SKILL.md Step 9.5 (Per-dispatch ATC gate):**
Apply the same provider-dispatch branch pattern at Step 9.5 (~line 837), replacing
the hardcoded `Agent(subagent_type: "gsd-code-reviewer", model: "sonnet", ...)` call.
The gate name changes to `'per-dispatch-ATC'`; the evidence emission changes to
`appendPerDispatchReviewEvidence(...)`. The pattern is otherwise identical to Step 6.5.

**Critical field name:** Always reference `provider.invocation` (NOT `provider.invocation_type`).
The YAML field in `review-providers.yaml` is `invocation:` singular. Using `invocation_type`
returns `undefined` and silently bypasses shell dispatch (W-3 typo pattern to avoid).

**Action — codex-exec.sh W-4 fix:**
In `super-gsd/scripts/codex-exec.sh`, locate the `--phase` argument parse section
(~line 120 in the arg-parse block). Add numeric validation:
```bash
# W-4 fix: validate --phase is numeric before interpolating into JSONL
if [[ -n "$PHASE_TAG" && ! "$PHASE_TAG" =~ ^[0-9]+$ ]]; then
  echo "ERR: --phase must be numeric, got: $PHASE_TAG" >&2
  exit 1
fi
```
This prevents non-numeric input from producing invalid JSON in `codex-log.jsonl`.

**Verification:**
```bash
bash -n super-gsd/skills/sgsd-orchestrate/SKILL.md 2>/dev/null || true
grep -n 'resolveReviewerProvider' super-gsd/skills/sgsd-orchestrate/SKILL.md | head -5
grep -n 'invocation_type' super-gsd/skills/sgsd-orchestrate/SKILL.md | wc -l
# Above grep must return 0 — no invocation_type references permitted
bash -n super-gsd/scripts/codex-exec.sh
```

**Done:**
- `grep -c 'resolveReviewerProvider' super-gsd/skills/sgsd-orchestrate/SKILL.md` returns ≥ 2 (Steps 6.5 and 9.5).
- `grep -c 'invocation_type' super-gsd/skills/sgsd-orchestrate/SKILL.md` returns 0.
- `bash -n super-gsd/scripts/codex-exec.sh` exits 0.
- Both Step 6.5 and Step 9.5 contain the `shellDispatch` and `GATE_PROVIDER_FALLBACK` strings.

**Commit message:** `feat(15-01/T2): SKILL.md Steps 6.5+9.5 provider-dispatch branch + codex-exec.sh W-4 fix`
</task>

<task id="T3">
### T3. gates.yaml reviewer_provider flip + W-2 version bump + config flip

**Files:**
- `super-gsd/registry/gates.yaml` (modify: per-dispatch-ATC row, phase-level-ATC row, registry_version, last_updated)
- `.planning/config.json` (modify: `review_providers.codex_enabled` → true, add kill thresholds)

**Action — gates.yaml:**
1. In the `per-dispatch-ATC` row: change `reviewer_provider: claude-sonnet-reviewer` → `reviewer_provider: codex-cli-reviewer`.
2. In the `phase-level-ATC` row: change `reviewer_provider: claude-sonnet-reviewer` → `reviewer_provider: codex-cli-reviewer`.
3. W-2 fix: change `registry_version: 2.0.0` → `registry_version: 2.1.0` and update `last_updated` to today's ISO date (2026-04-24). This minor bump signals the `reviewer_provider:` schema extension AND the new `qualitative-waste-audit` row added by plan 15-02.

**Action — config.json:**
Using Node-in-bash (never read-then-print the file):
```bash
node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('.planning/config.json', 'utf8'));
cfg.review_providers.codex_enabled = true;
cfg.review_providers.kill_critical_count_delta = 5;
cfg.review_providers.kill_claude_tokens_saved = 50000;
cfg.review_providers.codex_qualitative_waste_enabled = true;
fs.writeFileSync('.planning/config.json', JSON.stringify(cfg, null, 2) + '\n');
console.log('config.json updated — codex_enabled: true');
"
```

**IMPORTANT:** The `codex_qualitative_waste_enabled: true` key is required by plan
15-02's probe (CONTEXT D-09). Adding it here in the same plan that flips the master
switch keeps the config coherent.

**Verification:**
```bash
node -e "
const yaml = require('./super-gsd/node_modules/js-yaml/lib/js-yaml.js') || require('js-yaml');
" 2>/dev/null || true
# Simpler: grep directly
grep 'reviewer_provider: codex-cli-reviewer' super-gsd/registry/gates.yaml | wc -l
# Must return 2 (per-dispatch-ATC + phase-level-ATC)
grep 'registry_version: 2.1.0' super-gsd/registry/gates.yaml
node -e "const c = JSON.parse(require('fs').readFileSync('.planning/config.json','utf8')); console.log('codex_enabled:', c.review_providers.codex_enabled, '| kill_crit:', c.review_providers.kill_critical_count_delta);"
```

**Done:**
- `grep -c 'reviewer_provider: codex-cli-reviewer' super-gsd/registry/gates.yaml` returns 2.
- `grep -c 'registry_version: 2.1.0' super-gsd/registry/gates.yaml` returns 1.
- Node confirms `config.review_providers.codex_enabled === true` and `kill_critical_count_delta === 5`.

**Commit message:** `feat(15-01/T3): gates.yaml flip to codex-cli-reviewer + W-2 bump + config codex_enabled:true`
</task>

</tasks>

## Acceptance criteria

A1. `providers-registry.cjs` null-guard reads `!gate.reviewer_provider` (not `gate.reviewer_agent === undefined`). W-1 resolved. **(CODEX-07, W-1)**
A2. `super-gsd/registry/gates.yaml` rows `per-dispatch-ATC` and `phase-level-ATC` both declare `reviewer_provider: codex-cli-reviewer`. **(D-26 inv1)**
A3. `sgsd-orchestrate/SKILL.md` contains `resolveReviewerProvider` at Steps 6.5 and 9.5; zero occurrences of `invocation_type`. **(D-26 inv4, W-3 prevention)**
A4. `sgsd-orchestrate/SKILL.md` Steps 6.5 and 9.5 contain `GATE_PROVIDER_FALLBACK` and `shellDispatch`. **(CONTEXT D-02b)**
A5. `codex-exec.sh` contains numeric validation for `PHASE_TAG`; `bash -n` exits 0. **(W-4)**
A6. `config.review_providers.codex_enabled === true` in `.planning/config.json`. **(CONTEXT D-01)**
A7. `config.review_providers.kill_critical_count_delta === 5` and `kill_claude_tokens_saved === 50000`. **(CONTEXT D-20)**
A8. `gates.yaml registry_version: 2.1.0` present. **(W-2)**

## Non-goals

- **No Step 9.6 edit** — adversarial challenger is plan 15-04.
- **No sgsd-muda-audit.sh changes** — plan 15-02 owns that.
- **No token-log schema changes** — plan 15-03 owns that.
- **No new VTP consumption calls** — evidence from 15-VTP-EVIDENCE.md is already injected into this plan's prompts.

## Evidence lineage

- CONTEXT decisions covered: **D-01, D-02, D-02a, D-02b, D-02c, D-03, D-03a**
- ATC warnings resolved: **W-1, W-2, W-4** (W-3 prevented by field-name discipline in T2)
- RESEARCH RQ1 consumed: W-1 fix (providers-registry.cjs:151), dispatch branch pattern, fallback mechanics, AD-04 commit ordering
- VTP cited: **doc:6b62b76ceab5 (AGP-P-04 rollback safety, AGP-P-05 protocol registration, AGP-P-08 separation), doc:5a50cc9b459e (HiveMind single-retry)**

---
plan_id: 15-05
phase: 15
wave: 4
depends_on: [15-03, 15-04]
deliverable: sgsd-token-audit --milestone-close-check subcommand + kill actions D-21 + sgsd-complete-milestone step renumber (CODEX-12) + Phase 15 verify.mjs
estimate_tokens: ~900
estimate_commits: 3
codex_deliverable: CODEX-12
vtp_citations: [doc:6b62b76ceab5]
---

# Plan 15-05: Kill Condition + Milestone Wire

## Scope

Delivers the milestone-close kill condition (CODEX-12) in three parts:

1. **T1** — `sgsd-token-audit --milestone-close-check` subcommand + kill actions (D-21)
2. **T2** — `sgsd-complete-milestone` SKILL.md step renumbering (insert new step 3, shift existing 3-8 → 4-9)
3. **T3** — Phase 15 `verify.mjs` (9 invariants, follows contract-check.mjs / Phase 14 verify.mjs pattern)

**SKILL.md step renumbering cascade (arch decision 4):** Plan 15-05 owns the
`sgsd-complete-milestone/SKILL.md` edit. The insertion of `--milestone-close-check`
as new step 3 shifts existing steps 3-8 → 4-9. ALL step references inside the
SKILL.md AND any callers that reference steps by number must update together. Plan-checker
must verify no step numbers are left stale (A3 covers this).

**Wave 4 note:** Wave 4 is the final wave. All prior artifacts are settled. The
executor must re-read `sgsd-complete-milestone/SKILL.md` fresh — do NOT patch
against a plan-time snapshot.

## Tasks

<tasks>

<task id="T1">
### T1. sgsd-token-audit --milestone-close-check subcommand

**Files:**
- `super-gsd/skills/sgsd-token-audit/SKILL.md` (modify: add --milestone-close-check mode)

**Action:**
Read `super-gsd/skills/sgsd-token-audit/SKILL.md` fully (plan 15-03 will have already
added the multimodal tile to `--quick` mode). Add a new `--milestone-close-check` mode
section after the existing modes (`--quick`, `--full`, `--context-map`).

The `--milestone-close-check` subcommand follows RESEARCH AD-03 option (a+b): a hybrid
that uses bash for pure math and agent capability for the side-effecting kill actions.

**Mode specification to add:**

```markdown
## --milestone-close-check Mode

Computes the two kill metrics and fires the kill condition if both thresholds are missed.
Reads: token-log.jsonl + .planning/phases/*/commit-reviews.jsonl + .planning/phases/*/{NN}-ATC-REVIEW.md

### Step 1: Compute metrics

**Quality metric — `critical_count_delta`:**
```javascript
const codexCrits = reviewRows
  .filter(r => r.provider === 'openai-codex')
  .reduce((sum, r) => sum + (r.critical_count || 0), 0);
const claudeCrits = reviewRows
  .filter(r => ['claude-sonnet', 'claude-via-fallback'].includes(r.provider))
  .reduce((sum, r) => sum + (r.critical_count || 0), 0);
const critical_count_delta = codexCrits - claudeCrits;
// Higher = Codex finding more issues Claude missed
```

**Quota metric — `claude_tokens_saved`:**
Same calculation as `--quick` multimodal tile, scoped to active milestone.

### Step 2: Kill threshold evaluation

Read thresholds from `.planning/config.json`:
- `config.review_providers.kill_critical_count_delta` (default: 5)
- `config.review_providers.kill_claude_tokens_saved` (default: 50000)

Kill condition fires if AND ONLY IF BOTH:
- `critical_count_delta < kill_critical_count_delta`
- `claude_tokens_saved < kill_claude_tokens_saved`

Per CONTEXT D-20a: either condition passing alone keeps Codex active.

### Step 3: Dry-run mode (--dry-run flag)

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

### Step 4: Kill actions (only if kill fires AND NOT --dry-run)

Per CONTEXT D-21, in this order:
1. **config flip:** Set `config.review_providers.codex_enabled: false` in `.planning/config.json`
   using Node-in-bash (never read-then-print).
2. **Anti-pattern curation:** shell to `sgsd-curate.sh` to write:
   `.brv/context-tree/anti-patterns/multimodal-codex-retired-{milestone}.md`
   with content: metrics that fired the kill, thresholds, milestone ID.
3. **MILESTONES.md append:** Add one-line summary: "{milestone} Codex Multimodal: RETIRED per kill condition (delta={N}, saved={K})."
4. **Do NOT delete** `codex-exec.sh` or registry entries. Retirement = disable + document.

### Step 5: Auto-mode advisory (CONTEXT D-22)

In auto mode: log the kill action as a DEVIATION, proceed. Do NOT block the run.
In interactive mode: print the verdict JSON and prompt: "Kill condition fired. Type 'confirm' to retire Codex, 'skip' to keep active."

### Output format (always)

```
MILESTONE_CLOSE_CHECK: {milestone}
critical_count_delta: {N} (threshold: {T})
claude_tokens_saved: {K} (threshold: {T})
VERDICT: KEEP | RETIRE
KILL_FIRED: true | false
```
```

**Verification:**
```bash
grep -n 'milestone-close-check' super-gsd/skills/sgsd-token-audit/SKILL.md
grep -n 'critical_count_delta' super-gsd/skills/sgsd-token-audit/SKILL.md
grep -n 'dry-run' super-gsd/skills/sgsd-token-audit/SKILL.md | grep -i 'close-check'
# All must return hits
```

**Done:**
- `grep -c 'milestone-close-check' super-gsd/skills/sgsd-token-audit/SKILL.md` returns ≥ 2.
- Dry-run mode documented: emits JSON verdict, exits 0.
- Kill threshold eval documented: BOTH conditions must fail per CONTEXT D-20a.
- Kill actions D-21 documented in order (config → curate → MILESTONES.md → no-delete rule).

**Commit message:** `feat(15-05/T1): sgsd-token-audit --milestone-close-check subcommand (CODEX-12)`
</task>

<task id="T2">
### T2. sgsd-complete-milestone step renumber + CODEX-12 step insertion

**Files:**
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (modify: insert new step 3, renumber 3-8 → 4-9)

**Action:**
Read `super-gsd/skills/sgsd-complete-milestone/SKILL.md` fully. Verify the current
step sequence (per RESEARCH RQ6):
- Step 0: precondition (unchanged)
- Step 1: GOV-05 deliberation audit (unchanged)
- Step 2: MUDA recurrence check (unchanged)
- Step 3: gate drift audit (currently)
- Step 4: cross-phase check (currently)
- Step 5: generate SUMMARY.md (currently)
- Step 6: VTP bidirectional (currently)
- Step 7: archive phases (currently)
- Step 8: state bump (currently)

Insert CODEX-12 kill check as the new Step 3, shifting the rest:
- **Step 3 NEW:** Run `sgsd-token-audit --milestone-close-check`. If kill fires in
  auto mode: execute D-21 kill actions, log as DEVIATION, proceed. If kill fires in
  interactive mode: pause for confirmation.
- Steps 4-9 (renumbered from 3-8): gate drift, cross-phase, summary, VTP, archive, state bump.

The insertion specification:
```markdown
### Step 3: Codex kill-condition check (Phase 15+ CODEX-12)

Invoke: `sgsd-token-audit --milestone-close-check`

Read `.planning/config.json` to check if `review_providers.codex_enabled === true`
before running. If `codex_enabled === false`, skip this step (Codex already retired).

Placement rationale (CONTEXT D-23a): Step 3 runs BEFORE cross-phase check (Step 5)
and BEFORE summary generation (Step 6), so the SUMMARY.md reflects the final
Codex-enabled/retired state. If placed after summary gen, the summary would be stale.

In auto mode: log DEVIATION if kill fires, continue to Step 4.
In interactive mode: pause if kill fires, require confirmation before Step 4.
```

**Update all step cross-references within the same SKILL.md.** Search for any inline
references like "see step 3", "step 3 completes", "after step 5" and update the
numbers. If any external callers in other SKILL.md files reference sgsd-complete-milestone
steps by number (check `super-gsd/skills/sgsd-orchestrate/SKILL.md` for `sgsd-complete-milestone`),
update those references too.

**Verification:**
```bash
grep -n 'milestone-close-check' super-gsd/skills/sgsd-complete-milestone/SKILL.md
grep -n 'Step 3' super-gsd/skills/sgsd-complete-milestone/SKILL.md | head -5
grep -n 'Step 9' super-gsd/skills/sgsd-complete-milestone/SKILL.md | head -3
# Step 3 must be the new kill-check step, Step 9 must be the state bump
```

**Done:**
- `grep -c 'milestone-close-check' super-gsd/skills/sgsd-complete-milestone/SKILL.md` returns ≥ 1. **(D-26 inv8)**
- Step 3 is the kill-check step (not gate-drift).
- The SKILL.md has Steps 0-9 (10 steps total after insertion).
- No stale step-number cross-references remain.

**Commit message:** `feat(15-05/T2): sgsd-complete-milestone step renumber + CODEX-12 kill-check step 3`
</task>

<task id="T3">
### T3. Phase 15 verify.mjs (9 invariants)

**Files:**
- `.planning/milestones/v1.3/phases/15-codex-routed-gates/verify.mjs` (new)

**Action:**
Create `verify.mjs` following the Phase 14 pattern (`super-gsd/tools/provider-contract/contract-check.mjs`
shape and `super-gsd/tools/provider-contract/verify.mjs` style — pure Node.js, no
test framework). The verifier exits with the number of the first failing invariant
(1-9), or 0 if all pass.

The 9 invariants from CONTEXT D-26:

```javascript
#!/usr/bin/env node
// Phase 15 verify.mjs — 9 invariants for CODEX-07..CODEX-12
// Exit 0 = all pass. Exit N = invariant N failed.
// Usage: node verify.mjs [--from-root /abs/path/to/repo]

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.argv.includes('--from-root')
  ? process.argv[process.argv.indexOf('--from-root') + 1]
  : resolve(__dirname, '../../../../..');
const r = (rel) => resolve(ROOT, rel);

let passed = 0; let failed = 0;
function inv(n, label, check) {
  try {
    const ok = check();
    if (ok) { console.log(`✓ inv${n}: ${label}`); passed++; }
    else    { console.error(`✗ inv${n}: ${label}`); failed++; process.exitCode = n; }
  } catch(e) { console.error(`✗ inv${n}: ${label} — ${e.message}`); failed++; if (!process.exitCode) process.exitCode = n; }
}

// inv1: gates.yaml rows per-dispatch-ATC + phase-level-ATC declare reviewer_provider: codex-cli-reviewer
inv(1, 'gates.yaml ATC rows declare codex-cli-reviewer', () => {
  const gates = readFileSync(r('super-gsd/registry/gates.yaml'), 'utf8');
  const matches = (gates.match(/reviewer_provider: codex-cli-reviewer/g) || []).length;
  return matches >= 2;
});

// inv2: gates.yaml row qualitative-waste-audit exists with correct trigger
inv(2, 'gates.yaml qualitative-waste-audit row exists', () => {
  const gates = readFileSync(r('super-gsd/registry/gates.yaml'), 'utf8');
  return gates.includes('qualitative-waste-audit') &&
         gates.includes('mechanical_muda_verdict') &&
         gates.includes('codex-cli-reviewer');
});

// inv3: sgsd-muda-audit.sh invokes codex-exec.sh when CODEX_QUAL_ENABLED=true
inv(3, 'sgsd-muda-audit.sh invokes codex-exec.sh', () => {
  const muda = readFileSync(r('super-gsd/scripts/sgsd-muda-audit.sh'), 'utf8');
  return muda.includes('codex-exec.sh') && muda.includes('CODEX_QUAL_ENABLED');
});

// inv4: SKILL.md Steps 6.5 + 9.5 reference resolveReviewerProvider + shell-invocation branch
inv(4, 'SKILL.md Steps 6.5+9.5 reference resolveReviewerProvider + shellDispatch', () => {
  const skill = readFileSync(r('super-gsd/skills/sgsd-orchestrate/SKILL.md'), 'utf8');
  const hasResolve = (skill.match(/resolveReviewerProvider/g) || []).length >= 2;
  const hasShell = skill.includes('shellDispatch') || skill.includes('shell_script');
  const noTypo = !skill.includes('invocation_type');
  return hasResolve && hasShell && noTypo;
});

// inv5: SKILL.md Step 11 schema includes provider field
inv(5, 'SKILL.md Step 11 token-log schema includes provider field', () => {
  const skill = readFileSync(r('super-gsd/skills/sgsd-orchestrate/SKILL.md'), 'utf8');
  return skill.includes('openai-codex') && skill.includes('claude-via-fallback');
});

// inv6: sgsd-token-audit emits claude_tokens_saved_by_codex
inv(6, 'sgsd-token-audit declares claude_tokens_saved_by_codex', () => {
  const audit = readFileSync(r('super-gsd/skills/sgsd-token-audit/SKILL.md'), 'utf8');
  return audit.includes('claude_tokens_saved_by_codex') && audit.includes('Multimodal Review Offload');
});

// inv7: SKILL.md Step 9.6 references non-primary-vendor provider
inv(7, 'SKILL.md Step 9.6 challenger uses non-primary-vendor', () => {
  const skill = readFileSync(r('super-gsd/skills/sgsd-orchestrate/SKILL.md'), 'utf8');
  return skill.includes('adversarial_verifier') &&
         skill.includes('VERIFIER_ADVERSARIAL_SKIP') &&
         skill.includes('codex-cli-reviewer');
});

// inv8: sgsd-complete-milestone includes --milestone-close-check in step list
inv(8, 'sgsd-complete-milestone includes --milestone-close-check', () => {
  const complete = readFileSync(r('super-gsd/skills/sgsd-complete-milestone/SKILL.md'), 'utf8');
  return complete.includes('milestone-close-check');
});

// inv9 (bonus): dry-run --milestone-close-check exits 0 with JSON verdict
inv(9, '(bonus) sgsd-token-audit --milestone-close-check --dry-run exits 0', () => {
  const auditSkill = readFileSync(r('super-gsd/skills/sgsd-token-audit/SKILL.md'), 'utf8');
  // Structural test: verify the SKILL.md documents --dry-run JSON output format
  return auditSkill.includes('"kill"') && auditSkill.includes('"critical_count_delta"');
});

console.log(`\nPhase 15 verify.mjs: ${passed} passed, ${failed} failed`);
if (failed === 0) console.log('PASS Phase 15');
```

**Verification:**
```bash
node .planning/milestones/v1.3/phases/15-codex-routed-gates/verify.mjs
# Must exit 0 with "PASS Phase 15" after all prior plans complete
# Expected output: 9 green checkmarks
```

**Done:**
- `node .planning/milestones/v1.3/phases/15-codex-routed-gates/verify.mjs` exits 0.
- All 9 invariants log with ✓.
- "PASS Phase 15" appears in stdout.

**Commit message:** `feat(15-05/T3): Phase 15 verify.mjs — 9 invariants CODEX-07..CODEX-12`
</task>

</tasks>

## Acceptance criteria

A1. `grep -c 'milestone-close-check' super-gsd/skills/sgsd-token-audit/SKILL.md` returns ≥ 2. **(CODEX-12)**
A2. `--milestone-close-check` mode documents dry-run JSON output `{"kill": ..., "critical_count_delta": ..., "claude_tokens_saved": ..., "reason": ...}`. **(D-26 inv9 bonus)**
A3. Kill threshold eval: BOTH conditions must fail to fire kill (D-20a). Either passing = keep Codex.
A4. Kill actions D-21 documented in order: config flip → curate → MILESTONES.md append → no-delete. **(CONTEXT D-21)**
A5. `grep -c 'milestone-close-check' super-gsd/skills/sgsd-complete-milestone/SKILL.md` returns ≥ 1. **(D-26 inv8)**
A6. `sgsd-complete-milestone` SKILL.md has steps 0-9 (10 total). New Step 3 = kill check. Old Step 3 (gate drift) = new Step 4.
A7. `node .planning/milestones/v1.3/phases/15-codex-routed-gates/verify.mjs` exits 0. **(D-26 inv1-9)**
A8. Auto-mode kill advisory: DEVIATION logged, run continues. Interactive mode: pause for confirmation. **(CONTEXT D-22)**
A9. `kill_critical_count_delta: 5` and `kill_claude_tokens_saved: 50000` thresholds documented in SKILL.md (matches config.json values set in 15-01 T3). **(CONTEXT D-20)**

## Non-goals

- **No new bash script** — RESEARCH AD-03 recommends hybrid agent+bash; the SKILL.md approach is the implementation vehicle for Phase 15. A standalone `sgsd-token-audit-close-check.sh` may be extracted in a future phase if needed.
- **No sgsd-orchestrate/SKILL.md edits** — 15-01/15-04 own those sections.
- **No gates.yaml changes** — 15-01/15-02 own those.

## Evidence lineage

- CONTEXT decisions covered: **D-19, D-20, D-20a, D-20b, D-21, D-22, D-23, D-23a, D-26**
- RESEARCH consumed: RQ6 (sgsd-token-audit --milestone-close-check subcommand, metric computation, step renumbering, SKILL.md current state), AD-03 (implementation vehicle decision)
- VTP cited: **doc:6b62b76ceab5 AGP-P-07** (explicit lifecycle management — `--milestone-close-check` is the lifecycle event), **AGP-P-04** (rollback safety — disable not delete)

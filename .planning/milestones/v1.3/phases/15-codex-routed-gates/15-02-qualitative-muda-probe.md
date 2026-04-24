---
plan_id: 15-02
phase: 15
wave: 1
depends_on: []
deliverable: sgsd-muda-audit.sh 4th probe (CODEX-08) + qualitative-waste-audit gate row + mechanical_muda_verdict ctx field in predicate-eval.cjs + SKILL.md Step 9.2 (CODEX-09)
estimate_tokens: ~800
estimate_commits: 2
atc_warnings_addressed: [W-3]
codex_deliverables: [CODEX-08, CODEX-09]
---

# Plan 15-02: Qualitative MUDA Probe

## Scope

Extends the 3-probe MUDA audit to a 4-probe system by adding the `codex_qualitative_waste`
probe (overproduction class). Adds the `qualitative-waste-audit` gate row that fires only
when mechanical probes PASS/WARN AND diff_lines ≥ 200 AND phase_type not docs/config.

**CRITICAL two-file constraint (RESEARCH pitfall 2):** The new `mechanical_muda_verdict`
context field MUST be added to BOTH:
1. `predicate-eval.cjs` DISPATCH_CONTEXT_FIELDS comment registry
2. `sgsd-orchestrate/SKILL.md` Step 9.2 ctx assembly

Neither may ship without the other. Both must be in the SAME commit. If either is
missing, the `qualitative-waste-audit` gate trigger crashes the orchestrator loop
with `dispatch context missing field 'mechanical_muda_verdict'`.

**Wave 1 note:** This plan executes in parallel with 15-03. It does NOT touch
`sgsd-orchestrate/SKILL.md` Steps 6.5/9.5/9.6 (those are Wave 2/3). The Step 9.2
ctx assembly edit is in a different section of SKILL.md from the Step 6.5/9.5
edits — confirm line separation before committing.

## Tasks

<tasks>

<task id="T1">
### T1. sgsd-muda-audit.sh 4th probe (CODEX-08)

**Files:**
- `super-gsd/scripts/sgsd-muda-audit.sh` (modify: after line 112-114, add probe block)

**Action:**

Read `super-gsd/scripts/sgsd-muda-audit.sh` fully before editing. Identify:
- The exact line where `PROBE_JSON` and `PROBE_EXIT` are last assigned from mechanical probes.
- The `curate_finding` function (lines ~233-302) that handles per-finding curation.
- The WASTE.md row append pattern (lines ~169-179).

Insert the 4th probe immediately after the mechanical probe block (after the `PROBE_EXIT` capture). The insertion reads config for `CODEX_QUAL_ENABLED` and is guarded by three conditions per CONTEXT D-06:

```bash
# CODEX-08: 4th qualitative MUDA probe (overproduction class)
# Per CONTEXT D-06: fires only when mechanical probes pass, diff_lines >= 200, and enabled
CODEX_QUAL_ENABLED="${CODEX_QUAL_ENABLED:-false}"
if [[ -z "$CODEX_QUAL_ENABLED" ]]; then
  # Read from config.json if available
  CODEX_QUAL_ENABLED=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('$PROJECT/.planning/config.json','utf8'));console.log(c.review_providers.codex_qualitative_waste_enabled?'true':'false')}catch(e){console.log('false')}" 2>/dev/null || echo 'false')
fi

# Compute DIFF_LINES from phase git history
DIFF_LINES=$(git -C "$PROJECT" diff --stat HEAD~"${COMMITS_IN_PHASE:-1}" HEAD 2>/dev/null | awk '/changed/{sum+=$1+$3}END{print sum+0}')

if [[ "$PROBE_EXIT" == "0" && "${DIFF_LINES:-0}" -ge 200 && "$CODEX_QUAL_ENABLED" == "true" && "$DRY_RUN" != "true" ]]; then
  TMP_CODEX_PROMPT=$(mktemp /tmp/muda-codex-prompt.XXXXXX)
  TMP_CODEX_REPORT=$(mktemp /tmp/muda-codex-report.XXXXXX)

  # Compose qualitative MUDA prompt per CONTEXT D-06a
  {
    printf 'PHASE %s QUALITATIVE WASTE AUDIT\n' "$PHASE_NUM"
    printf 'Goal: %s\n' "$(grep -m1 "Phase ${PHASE_NUM}" "$PROJECT/.planning/ROADMAP.md" 2>/dev/null || echo 'unknown')"
    printf 'Diff:\n'
    git -C "$PROJECT" diff --stat HEAD~"${COMMITS_IN_PHASE:-1}" HEAD 2>/dev/null | head -50
    printf '\n'
    git -C "$PROJECT" diff HEAD~"${COMMITS_IN_PHASE:-1}" HEAD 2>/dev/null | head -500
    printf '\nPlans: '
    ls "$PHASE_DIR"/*.md 2>/dev/null | xargs -I{} basename {} | tr '\n' ',' | sed 's/,$//'
    printf '\n\n'
    cat <<'PROMPT'
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
  } > "$TMP_CODEX_PROMPT"

  bash "$SCRIPT_DIR/codex-exec.sh" \
    --prompt-file "$TMP_CODEX_PROMPT" \
    --timeout 60 \
    --report-out "$TMP_CODEX_REPORT" \
    --phase "$PHASE_NUM" \
    --step "muda-qualitative" 2>/dev/null
  CODEX_QUAL_EXIT=$?
  rm -f "$TMP_CODEX_PROMPT"

  if [[ "$CODEX_QUAL_EXIT" -eq 0 && -f "$TMP_CODEX_REPORT" ]]; then
    # Parse the code-reviewer-v1 contract fields
    QUAL_FINDINGS=$(grep '^FINDINGS:' "$TMP_CODEX_REPORT" | sed 's/^FINDINGS: //')
    QUAL_CRITICAL=$(grep '^CRITICAL:' "$TMP_CODEX_REPORT" | awk '{print $2+0}')
    QUAL_WARNINGS=$(grep '^WARNINGS:' "$TMP_CODEX_REPORT" | awk '{print $2+0}')
    QUAL_ONE_LINER=$(grep '^ONE_LINER:' "$TMP_CODEX_REPORT" | sed 's/^ONE_LINER: //')

    # Verdict mapping per CONTEXT D-07, D-08a (MUDA is NEVER a phase blocker — DLB-02)
    if [[ "${QUAL_CRITICAL:-0}" -gt 0 ]]; then
      QUAL_VERDICT="FAIL"
    elif [[ "${QUAL_WARNINGS:-0}" -gt 0 ]]; then
      QUAL_VERDICT="WARN"
    else
      QUAL_VERDICT="PASS"
    fi

    # Emit 4th WASTE.md row per CONTEXT D-07
    printf '| codex_qualitative_waste | %s | %s findings | diff_lines=%s | overproduction | %s |\n' \
      "$QUAL_VERDICT" "${QUAL_CRITICAL:-0}" "$DIFF_LINES" "${QUAL_ONE_LINER:-no findings}" \
      >> "$WASTE_FILE"

    # Update counters
    [[ "$QUAL_VERDICT" == "FAIL" ]] && FAIL_COUNT=$((FAIL_COUNT+1))
    [[ "$QUAL_VERDICT" == "WARN" ]] && WARN_COUNT=$((WARN_COUNT+1))

    # Curate per-finding to anti-patterns/ per CONTEXT D-07a
    # Reuses curate_finding function (lines ~233-302) with class=overproduction
    if [[ "$NO_CURATE" != "true" ]] && [[ -n "$QUAL_FINDINGS" ]] && [[ "$QUAL_FINDINGS" != "none" ]]; then
      FINDING_NUM=0
      while IFS= read -r finding_line; do
        [[ -z "$finding_line" || "$finding_line" == "none" ]] && continue
        FINDING_NUM=$((FINDING_NUM+1))
        FINDING_SLUG=$(echo "$finding_line" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | cut -c1-40)
        curate_finding \
          "waste-overproduction-p${PHASE_NUM}-${FINDING_SLUG}" \
          "overproduction" \
          "$finding_line" \
          "muda,overproduction,phase-${PHASE_NUM},automated,codex-qualitative"
      done <<< "$QUAL_FINDINGS"
    fi
  else
    # Codex unavailable or parse failed — log, do not block (codex-exec.sh has its own fallback path)
    printf '| codex_qualitative_waste | SKIP | codex-exec exit=%s | diff_lines=%s | overproduction | probe skipped |\n' \
      "$CODEX_QUAL_EXIT" "$DIFF_LINES" >> "$WASTE_FILE"
  fi
  rm -f "$TMP_CODEX_REPORT"
fi
```

Also add `--probe codex` bypass flag per CONTEXT D-06 / RESEARCH AD-05. In the
existing argument-parse block (near lines 42-57 where `--no-curate` and `--dry-run`
are handled):
```bash
--probe)
  PROBE_FILTER="$2"
  shift 2
  ;;
```
And modify the mechanical-probe execution to skip when `PROBE_FILTER=codex` (run only
the qualitative probe, skip the three mechanical ones). This is a test/debug facility.

**Verification:**
```bash
bash -n super-gsd/scripts/sgsd-muda-audit.sh
grep -n 'codex-exec.sh' super-gsd/scripts/sgsd-muda-audit.sh
grep -n 'codex_qualitative_waste' super-gsd/scripts/sgsd-muda-audit.sh
# Both must return hits
```

**Done:**
- `bash -n super-gsd/scripts/sgsd-muda-audit.sh` exits 0.
- `grep -c 'CODEX_QUAL_ENABLED' super-gsd/scripts/sgsd-muda-audit.sh` returns ≥ 2.
- `grep -c 'codex-exec.sh' super-gsd/scripts/sgsd-muda-audit.sh` returns ≥ 1. **(D-26 inv3)**
- `grep -c 'waste-overproduction' super-gsd/scripts/sgsd-muda-audit.sh` returns ≥ 1.

**Commit message:** `feat(15-02/T1): sgsd-muda-audit.sh 4th qualitative probe (CODEX-08) + --probe codex flag`
</task>

<task id="T2">
### T2. qualitative-waste-audit gate row + predicate-eval ctx field + SKILL.md Step 9.2 (CODEX-09)

**Files:**
- `super-gsd/registry/gates.yaml` (modify: insert new row after MUDA-waste-audit row)
- `super-gsd/scripts/lib/predicate-eval.cjs` (modify: DISPATCH_CONTEXT_FIELDS comment, lines 16-28)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` (modify: Step 9.2 ctx assembly, line ~820)

**CRITICAL:** Both `predicate-eval.cjs` AND `sgsd-orchestrate/SKILL.md` Step 9.2 MUST
be in the same commit. If either is missing, the `qualitative-waste-audit` gate trigger
throws loudly at runtime (predicate-eval.cjs:64 unknown-field guard).

**Action — gates.yaml:**
Locate the `MUDA-waste-audit` row (gates.yaml:127-148). Insert the new
`qualitative-waste-audit` row IMMEDIATELY AFTER it (before `sgsd-curate-learnings`).
Row per CONTEXT D-10 exactly:

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

**Important — no `invocation` or `invocation_type` field on this gate row.** Those
fields live in the PROVIDER record (`review-providers.yaml`), not in the gate row.
Using `reviewer_provider: codex-cli-reviewer` resolves to the provider which declares
`invocation: shell`. This is how the W-3 typo pattern is avoided (W-3 prevention).

**Action — predicate-eval.cjs DISPATCH_CONTEXT_FIELDS (two-file constraint part 1):**
Locate the comment block at lines 16-28 listing DISPATCH_CONTEXT_FIELDS. Add:
```javascript
 * mechanical_muda_verdict  - 'PASS' | 'WARN' | 'FAIL' (populated after MUDA-waste-audit gate fires at step 6.55)
```
This is a comment-only change; no runtime code changes in predicate-eval.cjs.

**Action — SKILL.md Step 9.2 ctx assembly (two-file constraint part 2):**
Read SKILL.md fresh. Locate Step 9.2 ctx object assembly (~line 820, the block
that builds the dispatch context before gate evaluations). Add:
```javascript
mechanical_muda_verdict: getMudaVerdictFromPhaseDir(currentPhaseDir),
// Populated after MUDA-waste-audit probe completes at step 6.55.
// The qualitative-waste-audit gate (also step 6.55) reads this field.
// Per RESEARCH AD-02: step 6.55 is a two-phase gate — run MUDA-waste-audit,
// capture result, update local_ctx.mechanical_muda_verdict, THEN evaluate qualitative gate.
```

Where `getMudaVerdictFromPhaseDir` is a helper that reads the 3rd column of the
first non-header row of WASTE.md (the `verdict` column), returning `'PASS' | 'WARN' | 'FAIL'`.
If WASTE.md doesn't exist yet (first run): return `'PASS'` (no failures recorded yet,
safe default that allows qualitative probe to fire if conditions met).

**Verification:**
```bash
grep -n 'qualitative-waste-audit' super-gsd/registry/gates.yaml
grep -n 'mechanical_muda_verdict' super-gsd/scripts/lib/predicate-eval.cjs
grep -n 'mechanical_muda_verdict' super-gsd/skills/sgsd-orchestrate/SKILL.md
# All three must return hits
node -e "require('./super-gsd/scripts/lib/predicate-eval.cjs'); console.log('predicate-eval loads ok')" 2>&1
```

**Done:**
- `grep -c 'qualitative-waste-audit' super-gsd/registry/gates.yaml` returns 1. **(D-26 inv2)**
- `grep -c 'mechanical_muda_verdict' super-gsd/scripts/lib/predicate-eval.cjs` returns ≥ 1.
- `grep -c 'mechanical_muda_verdict' super-gsd/skills/sgsd-orchestrate/SKILL.md` returns ≥ 1.
- `node -e "require('./super-gsd/scripts/lib/predicate-eval.cjs')"` exits 0.
- The new gate row uses `reviewer_provider: codex-cli-reviewer` with NO `invocation` or `invocation_type` field.

**Commit message:** `feat(15-02/T2): qualitative-waste-audit gate row + predicate-eval ctx + SKILL.md Step 9.2 (CODEX-09)`
</task>

</tasks>

## Acceptance criteria

A1. `bash -n super-gsd/scripts/sgsd-muda-audit.sh` exits 0. **(CODEX-08)**
A2. `grep -c 'codex-exec.sh' super-gsd/scripts/sgsd-muda-audit.sh` returns ≥ 1. **(D-26 inv3)**
A3. `grep -c 'CODEX_QUAL_ENABLED' super-gsd/scripts/sgsd-muda-audit.sh` returns ≥ 2.
A4. `grep -c 'qualitative-waste-audit' super-gsd/registry/gates.yaml` returns 1. **(D-26 inv2)**
A5. The `qualitative-waste-audit` gate row has `reviewer_provider: codex-cli-reviewer` and NO `invocation_type` field. **(W-3 prevention)**
A6. `grep -c 'mechanical_muda_verdict' super-gsd/scripts/lib/predicate-eval.cjs` returns ≥ 1. **(two-file constraint)**
A7. `grep -c 'mechanical_muda_verdict' super-gsd/skills/sgsd-orchestrate/SKILL.md` returns ≥ 1. **(two-file constraint)**
A8. `node -e "require('./super-gsd/scripts/lib/predicate-eval.cjs')"` exits 0.
A9. The 4th probe in `sgsd-muda-audit.sh` emits `waste-overproduction-p{N}-*` curation slugs. **(CONTEXT D-07a)**

## Non-goals

- **No SKILL.md Steps 6.5/9.5/9.6 edits** — those are Wave 2/3 (15-01, 15-04).
- **No token-log changes** — plan 15-03 owns that.
- **No verify.mjs authoring** — plan 15-05 owns that.

## Evidence lineage

- CONTEXT decisions covered: **D-06, D-06a, D-07, D-07a, D-07b, D-07c, D-08, D-08a, D-09, D-10, D-10a, D-10b, D-11**
- ATC warnings: **W-3 prevented** (no `invocation_type` fields introduced)
- RESEARCH consumed: RQ2 (probe insertion point, prompt contract, WASTE.md row format, curate slug), RQ3 (gate row, field-name confirmation, timing constraint AD-02), pitfall 2 (two-file constraint)
- VTP: doc:6b62b76ceab5 AGP-P-08 (shape detection in registry not caller) informs `reviewer_provider` field approach

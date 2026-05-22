---
schema_version: 2
phase: 18
plan: "18-02"
wave: 2
model: "sonnet"
expected_ATC_tier: "LITE"
depends_on: ["18-01"]
goal: "Produce DOGFOOD-AUDIT.md formally recognising CXOPS-03/04 retroactive evidence from Phase 17 + any 18-01 runtime evidence; tick CXOPS-03/04 complete in REQUIREMENTS.md"
tasks:
  - id: "T1"
    req: "CXOPS-03 + CXOPS-04"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - ".planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md"
      - ".planning/REQUIREMENTS.md"
    input_contract: |
      RESEARCH validated: commit-reviews.jsonl has 5 rows all with "provider":"openai-codex".
      Rows 1-4: per-dispatch ATC (plans 17-01 ×2, 17-03 ×2) — CXOPS-03 evidence.
      Row 5: phase-level ATC (plan 17-phase) — CXOPS-04 evidence.
      17-ATC-REVIEW.md frontmatter: gate:"phase-level-ATC", provider:"openai-codex" — CXOPS-04 evidence.
      18-01 live-fire: FULL-tier changes to codex-exec.sh + SKILL.md will likely trigger per-dispatch ATC via Codex (1 new row).
      REQUIREMENTS.md CXOPS-03 and CXOPS-04 lines currently show "- [ ]"; must be changed to "- [x]".
    output_contract: |
      18-DOGFOOD-AUDIT.md created with CXOPS-03 section (count + list per-dispatch rows) + CXOPS-04 section (phase-level row + 17-ATC-REVIEW.md citation).
      grep -c 'CXOPS-0[34]' 18-DOGFOOD-AUDIT.md returns ≥2.
      REQUIREMENTS.md CXOPS-03 and CXOPS-04 lines show "- [x]".
    hypothesis: "Phase 17 commit-reviews.jsonl provides sufficient row-level evidence to formally satisfy CXOPS-03 and CXOPS-04 without any additional Codex invocation."
    falsifier: "18-DOGFOOD-AUDIT.md is missing, OR REQUIREMENTS.md still shows - [ ] for CXOPS-03/04, OR grep -c 'CXOPS-0[34]' 18-DOGFOOD-AUDIT.md returns <2."
    stop_rule: "If commit-reviews.jsonl has fewer than 5 rows with provider:openai-codex on manual grep, report the actual count — do not fabricate. Still create the AUDIT.md with whatever rows exist."
    verification_cmd: "test -f .planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md && grep -c 'CXOPS-0[34]' .planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md"
    known_deadends:
      - "Do not move or modify commit-reviews.jsonl — reference it by path only."
      - "LITE tier skips per-dispatch ATC per Step 9.5 filter — no Codex invocation from this plan."
---

<objective>
Produce the Phase 18 dogfood compliance artifact: 18-DOGFOOD-AUDIT.md cites row-by-row Phase 17 Codex evidence satisfying CXOPS-03 and CXOPS-04, then ticks both REQ-IDs complete in REQUIREMENTS.md.

Purpose: Formal close of the CXOPS-03/04 acceptance criteria. Operator needs a single artifact to confirm Codex was used end-to-end in a v1.4 phase.
Output: 18-DOGFOOD-AUDIT.md (created) + REQUIREMENTS.md (CXOPS-03/04 ticked).
</objective>

<execution_context>
@C:/Users/user/GSDedits/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@C:/Users/user/GSDedits/.planning/REQUIREMENTS.md
@C:/Users/user/GSDedits/.planning/milestones/v1.4/phases/18-codex-hardening/18-CONTEXT.md
@C:/Users/user/GSDedits/.planning/milestones/v1.4/phases/18-codex-hardening/18-RESEARCH.md
@C:/Users/user/GSDedits/.planning/milestones/v1.4/phases/18-codex-hardening/18-01-SUMMARY.md

<interfaces>
<!-- Evidence sources. Executor reads these to populate DOGFOOD-AUDIT.md. -->

CXOPS-03 source: .planning/milestones/v1.4/phases/17-debt-sweep/commit-reviews.jsonl
  — 4 per-dispatch rows (rows 1-4) with "provider":"openai-codex"
  — plans 17-01 (2 rows) and 17-03 (2 rows)

CXOPS-04 source (two items):
  — commit-reviews.jsonl row 5: phase-level row with "provider":"openai-codex"
  — .planning/milestones/v1.4/phases/17-debt-sweep/17-ATC-REVIEW.md frontmatter:
      gate: "phase-level-ATC"
      provider: "openai-codex"

18-01 bonus evidence (check 18-01-SUMMARY.md for any new Codex rows generated during T1/T2 execution).

REQUIREMENTS.md target lines (change [ ] to [x]):
  "- [ ] **CXOPS-03**:"
  "- [ ] **CXOPS-04**:"
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>T1: CXOPS-03 + CXOPS-04 — Create 18-DOGFOOD-AUDIT.md and tick REQUIREMENTS.md</name>
  <files>.planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md, .planning/REQUIREMENTS.md</files>
  <action>
1. Read `.planning/milestones/v1.4/phases/17-debt-sweep/commit-reviews.jsonl` and count all rows where `"provider":"openai-codex"`. Extract: plan tag, step, exit code, duration_ms, and whether fallback_triggered for each row.

2. Read `.planning/milestones/v1.4/phases/17-debt-sweep/17-ATC-REVIEW.md` frontmatter (first 20 lines) to confirm gate and provider fields.

3. Check 18-01-SUMMARY.md for any new commit-reviews.jsonl rows written during 18-01 execution (likely 1 FULL-tier CXOPS-01+02 row).

4. Create `.planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md` with the following structure (use D-04 guidance — reference 17-ATC-REVIEW.md shape):

```
---
gate: "dogfood-evidence-audit"
phase: 18
milestone: v1.4
audited: <ISO timestamp>
cxops_03_status: satisfied
cxops_04_status: satisfied
---

# Phase 18: Codex Dogfood Evidence Audit

## CXOPS-03 — Per-dispatch ATC via Codex

Acceptance criterion: at least one v1.4 phase commit-reviews.jsonl contains a Step 9.5 row
with provider:openai-codex and valid FINDINGS contract.

### Evidence (Phase 17)

Source: .planning/milestones/v1.4/phases/17-debt-sweep/commit-reviews.jsonl

| Row | Plan | Step | Exit | Duration | Provider |
|-----|------|------|------|----------|----------|
| ... (enumerate rows 1-4 from jsonl) ... |

Row count with provider:openai-codex: N
CXOPS-03: ☑ SATISFIED (N per-dispatch rows across Phase 17)

### Additional Evidence (Phase 18-01, if present)

<list any new rows from 18-01 execution, or "None — 18-01 did not generate Codex review rows during planning window">

---

## CXOPS-04 — Phase-level ATC via Codex

Acceptance criterion: same phase's Step 6.5 produces an ATC-REVIEW.md with provider:openai-codex.

### Evidence (Phase 17)

Source 1: commit-reviews.jsonl row 5 — phase-level row
  provider: openai-codex
  gate: phase-level-ATC

Source 2: .planning/milestones/v1.4/phases/17-debt-sweep/17-ATC-REVIEW.md
  Frontmatter: gate:"phase-level-ATC", provider:"openai-codex"

CXOPS-04: ☑ SATISFIED (Phase 17 phase-level ATC authored by Codex)

---

## Summary

| REQ-ID | Status | Evidence source |
|--------|--------|-----------------|
| CXOPS-03 | ☑ satisfied | Phase 17 commit-reviews.jsonl rows 1-4 |
| CXOPS-04 | ☑ satisfied | Phase 17 commit-reviews.jsonl row 5 + 17-ATC-REVIEW.md |
```

5. In REQUIREMENTS.md, change the two lines:
   - `- [ ] **CXOPS-03**:` → `- [x] **CXOPS-03**:`
   - `- [ ] **CXOPS-04**:` → `- [x] **CXOPS-04**:`

   Use Node read-mutate-write pattern (never cat/sed per feedback_never_head_settings rule):
   ```javascript
   const fs = require('fs');
   const path = '.planning/REQUIREMENTS.md';
   let content = fs.readFileSync(path, 'utf8');
   content = content.replace(/- \[ \] \*\*CXOPS-03\*\*/, '- [x] **CXOPS-03**');
   content = content.replace(/- \[ \] \*\*CXOPS-04\*\*/, '- [x] **CXOPS-04**');
   fs.writeFileSync(path, content, 'utf8');
   ```

6. Commit: `audit(18-02/T1): CXOPS-03/04 retroactive dogfood evidence — 5+ Codex rows across Phase 17 + 18-01`
  </action>
  <verify>
    <automated>test -f .planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md && grep -c 'CXOPS-0[34]' .planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md</automated>
  </verify>
  <done>18-DOGFOOD-AUDIT.md exists. grep -c 'CXOPS-0[34]' returns ≥2. REQUIREMENTS.md shows [x] for both CXOPS-03 and CXOPS-04. Traceability table in REQUIREMENTS.md reflects "Phase 18" and "satisfied" for both rows.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| commit-reviews.jsonl read → AUDIT.md | JSONL content is internal provenance; treated as read-only reference |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-18-05 | Tampering | REQUIREMENTS.md Node write | mitigate | Read-mutate-write with regex replace; no eval on file content |
| T-18-06 | Repudiation | DOGFOOD-AUDIT.md claims without row citation | mitigate | Audit enumerates each row with plan/step/exit/duration from jsonl |
</threat_model>

<verification>
1. `test -f .planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md` — file exists
2. `grep -c 'CXOPS-0[34]' .planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md` — returns ≥2
3. `grep 'CXOPS-03\|CXOPS-04' .planning/REQUIREMENTS.md` — both lines show [x]
</verification>

<success_criteria>
- 18-DOGFOOD-AUDIT.md created with CXOPS-03 section (per-dispatch rows enumerated) and CXOPS-04 section (phase-level row + 17-ATC-REVIEW.md citation)
- Both sections conclude with ☑ SATISFIED verdict
- REQUIREMENTS.md CXOPS-03 and CXOPS-04 show [x] complete
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4/phases/18-codex-hardening/18-02-SUMMARY.md` per the standard summary template.
</output>

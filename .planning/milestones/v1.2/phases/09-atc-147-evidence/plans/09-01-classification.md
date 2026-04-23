---
phase: 09-atc-147-evidence
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/09-atc-147-evidence/09-classification.yaml
autonomous: true
requirements:
  - ATC-147-01

# v2 schema self-referential frontmatter
schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: t1-classify
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/09-atc-147-evidence/09-classification.yaml
    input_contract: |
      External ATC review at ../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md.
      Locked decisions D-01, D-01a, D-01b, D-02, D-02a from 09-CONTEXT.md.
      Recommended bucket mapping from 09-RESEARCH.md §Q7 (not a hard override — classifier is agent-driven).
    output_contract: |
      Valid YAML at .planning/phases/09-atc-147-evidence/09-classification.yaml with top-level keys:
      headline_finding_count (int), findings_by_bucket (map of 4 bucket names + info → int),
      findings_detail (list of exactly 10 rows, each with id/bucket/title/justification),
      generated_at (ISO date), source_review (relative path string).
    hypothesis: |
      A narrow Sonnet sub-agent dispatch (not gsd-code-reviewer) can classify all 10 external
      findings unambiguously into the 4 buckets because the source review's own follow-up §5
      already resolves the only ambiguous case (W1/W2 as integration, not bloat).
    falsifier: |
      Classifier returns <10 or >10 findings_detail rows, or the bucket sum ≠ 10, or headline_finding_count
      ≠ real_bloat + integration_gap, or YAML fails js-yaml parse.
    stop_rule: |
      09-classification.yaml exists, js-yaml parses without error, findings_detail.length === 10,
      bucket sum === 10, headline === real_bloat + integration_gap.
    verification_cmd: |
      node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const d=y.load(fs.readFileSync('.planning/phases/09-atc-147-evidence/09-classification.yaml','utf8'));if(d.findings_detail.length!==10)process.exit(1);const b=d.findings_by_bucket;const s=b.real_bloat+b.integration_gap+b.nit+b.false_positive+(b.info||0);if(s!==10)process.exit(2);if(d.headline_finding_count!==b.real_bloat+b.integration_gap)process.exit(3);console.log('OK');"

must_haves:
  truths:
    - "All 10 findings (W1-W4, I1-I6) from the external review appear in findings_detail"
    - "Each finding is assigned exactly one bucket from: real-bloat, nit, false-positive, integration-gap"
    - "Headline finding count equals sum of real_bloat + integration_gap buckets only"
    - "Bucket counts sum to exactly 10 (including any info-bucket if present)"
  artifacts:
    - path: ".planning/phases/09-atc-147-evidence/09-classification.yaml"
      provides: "Canonical 4-bucket classification of Phase 147's 10 findings with headline integer"
      contains: "headline_finding_count, findings_by_bucket, findings_detail (10 rows)"
  key_links:
    - from: ".planning/phases/09-atc-147-evidence/09-classification.yaml"
      to: "../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md"
      via: "source_review relative-path pointer in YAML + per-finding id mapping (W1-W4, I1-I6)"
      pattern: "source_review:.*147-ATC-REVIEW\\.md"
---

<objective>
Produce the canonical 4-bucket classification of Phase 147's 10 ATC findings as a YAML artefact Phase 10 can consume directly.

Purpose: Satisfies ATC-147-01. Turns the raw external ATC review (10 unclassified findings: W1-W4, I1-I6) into a structured headline integer + per-finding provenance that Phase 10's keep/kill matrix can threshold against (≥3 / 1-2 / 0 brackets per the parent brief Q2 proposal).

Output: `.planning/phases/09-atc-147-evidence/09-classification.yaml` — YAML with headline int, per-bucket counts, and 10 fully-justified finding rows.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-atc-147-evidence/09-CONTEXT.md
@.planning/phases/09-atc-147-evidence/09-RESEARCH.md
@.planning/REQUIREMENTS.md
</context>

<interfaces>
<!-- Required YAML shape — executor must emit this exact top-level structure. -->

```yaml
# .planning/phases/09-atc-147-evidence/09-classification.yaml
generated_at: 2026-04-22
source_review: ../../../../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md
external_repo_pin:
  repo: project-clarity-erp
  commits: ca5be16b..c41634c4
  reviewed_at: 2026-04-20
headline_finding_count: <int, = real_bloat + integration_gap>
findings_by_bucket:
  real_bloat: <int>
  integration_gap: <int>
  nit: <int>
  false_positive: <int>
  info: 0
findings_detail:
  - id: W1
    bucket: <one of: real-bloat | integration-gap | nit | false-positive>
    title: "<≤80 char summary of the finding from the external review>"
    justification: "<≤20 word rationale for bucket choice>"
  # ... 9 more rows for W2, W3, W4, I1, I2, I3, I4, I5, I6
```

Bucket definitions (from 09-CONTEXT.md D-01):
- **real-bloat**: unnecessary code/abstractions (unused imports, duplicated logic, YAGNI)
- **integration-gap**: correct-in-isolation code orphaned from production data path
- **nit**: style/formatting/deprecation, no functional impact
- **false-positive**: not a real issue on inspection (spec-required stubs, Phase-2 hooks)

Research-recommended mapping (09-RESEARCH.md §Q7 — classifier-agent-driven, may diverge by up to 2 rows):
W1→integration-gap, W2→integration-gap, W3→real-bloat, W4→real-bloat,
I1→false-positive, I2→false-positive, I3→nit, I4→nit, I5→nit, I6→nit.
Expected headline: 4 (W1+W2 integration-gap + W3+W4 real-bloat).
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Dispatch narrow Sonnet classifier + write 09-classification.yaml</name>
  <files>.planning/phases/09-atc-147-evidence/09-classification.yaml</files>

  <read_first>
    - .planning/phases/09-atc-147-evidence/09-CONTEXT.md (D-01, D-01a, D-01b, D-02, D-02a — bucket taxonomy + headline formula + YAML format lock)
    - .planning/phases/09-atc-147-evidence/09-RESEARCH.md (§Q6 classifier prompt shape, §Q7 full 10-row recommended mapping with rationale per row)
    - ../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md (the 10 findings W1-W4 + I1-I6; the one file the classifier must quote from)
  </read_first>

  <action>
Step 1 — Read the external ATC review:
```bash
cat ../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md
```
Copy the finding narratives for W1-W4 and I1-I6 inline into the classifier prompt (do NOT let the agent fetch; inline ensures reproducibility).

Step 2 — Dispatch a narrow Sonnet sub-agent via the Agent tool. Use `subagent_type: "gsd-executor"`, `model: "sonnet"`, `mode: "auto"`. Prompt shape (per D-01a + 09-RESEARCH §Q6):

```
You are a finding classifier. You receive 10 ATC findings from a retroactive phase-level
review of project-clarity-erp Phase 147. Assign each finding to EXACTLY ONE of these
four buckets:

- real-bloat: unnecessary code/abstractions a senior engineer would delete
  (unused imports, duplicated functions, "just in case" code, YAGNI violations).
- integration-gap: code correct in isolation but orphaned from the production data path
  (built-but-not-wired, schema-but-not-called).
- nit: style, formatting, or deprecation warnings that don't affect correctness or cost.
- false-positive: not a real issue on inspection (Phase-2-gated stubs, spec-required
  schema fields, framework-deferred work).

Return ONLY a YAML document (no prose, no code fences) with this exact shape:

  generated_at: 2026-04-22
  source_review: ../../../../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md
  external_repo_pin:
    repo: project-clarity-erp
    commits: ca5be16b..c41634c4
    reviewed_at: 2026-04-20
  headline_finding_count: <int — set to real_bloat + integration_gap>
  findings_by_bucket:
    real_bloat: <int>
    integration_gap: <int>
    nit: <int>
    false_positive: <int>
    info: 0
  findings_detail:
    - id: W1
      bucket: <your choice>
      title: "<≤80 char title>"
      justification: "<≤20 words>"
    # ... one row each for W2, W3, W4, I1, I2, I3, I4, I5, I6

FINDINGS:
<paste W1-W4 + I1-I6 narratives verbatim here>
```

Step 3 — Write the agent's returned YAML verbatim to `.planning/phases/09-atc-147-evidence/09-classification.yaml`. Do NOT hand-edit the agent's bucket choices; the classification is agent-driven per D-01a. Only format-normalize if the agent returned code fences or trailing prose.

Step 4 — Run verification (see verification_cmd in frontmatter).

Step 5 — If the agent's mapping diverges by more than 2 rows from the 09-RESEARCH.md §Q7 recommended mapping, log the divergence in the DEVIATIONS line of your report (not a blocker — D-01a makes classification agent-driven).
  </action>

  <acceptance_criteria>
- File exists: `test -f .planning/phases/09-atc-147-evidence/09-classification.yaml` returns exit 0
- Parses as YAML: the verification_cmd script exits 0 (asserts length=10, bucket sum=10, headline math)
- Required top-level keys present (grep all of):
  - `grep -q "^generated_at:" .planning/phases/09-atc-147-evidence/09-classification.yaml`
  - `grep -q "^source_review:" .planning/phases/09-atc-147-evidence/09-classification.yaml`
  - `grep -q "^external_repo_pin:" .planning/phases/09-atc-147-evidence/09-classification.yaml`
  - `grep -q "^headline_finding_count:" .planning/phases/09-atc-147-evidence/09-classification.yaml`
  - `grep -q "^findings_by_bucket:" .planning/phases/09-atc-147-evidence/09-classification.yaml`
  - `grep -q "^findings_detail:" .planning/phases/09-atc-147-evidence/09-classification.yaml`
- External SHA pin correct: `grep -q "ca5be16b..c41634c4" .planning/phases/09-atc-147-evidence/09-classification.yaml`
- All 10 finding IDs present: `grep -cE "^\s+- id: (W[1-4]|I[1-6])$" .planning/phases/09-atc-147-evidence/09-classification.yaml` returns exactly 10
- Every bucket value is one of the 4 allowed literals: `grep -E "^\s+bucket:" .planning/phases/09-atc-147-evidence/09-classification.yaml | grep -cvE "(real-bloat|integration-gap|nit|false-positive)"` returns 0
  </acceptance_criteria>

  <verify>
    <automated>node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const d=y.load(fs.readFileSync('.planning/phases/09-atc-147-evidence/09-classification.yaml','utf8'));const b=d.findings_by_bucket;const s=b.real_bloat+b.integration_gap+b.nit+b.false_positive+(b.info||0);if(d.findings_detail.length!==10)process.exit(1);if(s!==10)process.exit(2);if(d.headline_finding_count!==b.real_bloat+b.integration_gap)process.exit(3);console.log('PASS');"</automated>
  </verify>

  <done>
- 09-classification.yaml committed with `feat(09-01): classify Phase 147 findings into 4 buckets`
- Verification command exits 0
- All 6 acceptance criteria grep assertions pass
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Sub-agent output → YAML file | Classifier's YAML output is written to disk unchecked before verifier runs. Malformed YAML would poison Phase 10 if unvalidated. |
| External repo → local evidence | The external ATC review is the only authoritative source for finding narratives; if it drifts (Wave 2 lands), our classification becomes stale. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-01-01 | Tampering | 09-classification.yaml | mitigate | Verifier (`verification_cmd`) re-parses with js-yaml and asserts: findings_detail.length===10, bucket-sum===10, headline===real_bloat+integration_gap. Corrupted YAML fails at the verifier gate, not in Phase 10. |
| T-09-01-02 | Information-disclosure | external_repo_pin SHA drift | mitigate | SHA range `ca5be16b..c41634c4` is hard-pinned in YAML frontmatter. Any future re-review must update SHA AND re-classify; verifier asserts the literal string presence (grep check). |
| T-09-01-03 | Denial-of-service | Malformed YAML crashes js-yaml | accept | js-yaml v4 throws on parse error → verifier exits non-zero with clear message. No prod runtime consumes this file; impact is limited to blocking the commit. |
</threat_model>

<verification>
Post-dispatch gate (run before commit):
1. `node -e "..."` script (verification_cmd in frontmatter) exits 0
2. All 6 grep acceptance criteria pass
3. `headline_finding_count` value is an integer in range [0, 10]

Cross-check against research mapping (advisory, not blocking): compare bucket assignments to 09-RESEARCH.md §Q7 recommended mapping. Expected divergence: 0-2 rows. >2 row divergence → flag DEVIATION in report, do not block.
</verification>

<success_criteria>
- ATC-147-01 satisfied: finding count is published with per-finding bucket classifications.
- 09-classification.yaml parses as valid YAML with exactly 10 findings_detail rows.
- Headline integer semantic (real-bloat + integration-gap only) is documented in the file itself via the `headline_finding_count` key positioned next to `findings_by_bucket` (so Phase 10 cannot accidentally re-compute with nits).
- External SHA pin `ca5be16b..c41634c4` is present verbatim in the YAML.
</success_criteria>

<output>
After completion, create `.planning/phases/09-atc-147-evidence/plans/09-01-SUMMARY.md` summarising:
- The bucket counts (e.g., real_bloat=2, integration_gap=2, nit=4, false_positive=2, info=0)
- The headline integer
- Any divergence from the 09-RESEARCH.md §Q7 recommended mapping (per-row list if any)
- The single commit SHA
</output>

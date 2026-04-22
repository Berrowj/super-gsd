---
phase: 09-atc-147-evidence
plan: 03
type: execute
wave: 2
depends_on:
  - 09-01
  - 09-02
files_modified:
  - .planning/milestones/v1.2/INTENT.md
  - .planning/milestones/v1.2/evidence/147-review.md
  - .planning/phases/09-atc-147-evidence/verify.mjs
autonomous: true
requirements:
  - ATC-147-02

# v2 schema self-referential frontmatter
schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: t1-bootstrap-milestone-dir
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/milestones/v1.2/INTENT.md
    input_contract: |
      super-gsd/templates/milestone-intent.md (template shape + required frontmatter fields).
      CONTEXT.md D-04c (v1.2 milestone INTENT.md creation closes the INTENT_MISSING deviation from the checkpoint).
      ROADMAP.md v1.2 Evidence-First Sharpening section (source of the `why` and `outcome_delivered` content).
    output_contract: |
      .planning/milestones/v1.2/INTENT.md with required frontmatter keys:
      milestone, why, outcome_delivered (≤120 chars), parent_project, created_at, closed_at: null.
      Milestone dir .planning/milestones/v1.2/ exists.
      Evidence subdir .planning/milestones/v1.2/evidence/ exists.
    hypothesis: |
      Authoring v1.2 INTENT.md using the milestone-intent.md template closes the INTENT_MISSING
      deviation logged in the orchestrator checkpoint and establishes the milestone directory
      tree that this plan's other tasks depend on.
    falsifier: |
      INTENT.md missing any of: milestone, why, outcome_delivered, parent_project, created_at.
      OR outcome_delivered > 120 chars (breaks injection contract).
      OR evidence/ subdir not created.
    stop_rule: |
      INTENT.md exists with all 5 required frontmatter fields, outcome_delivered ≤120 chars,
      evidence/ subdirectory exists.
    verification_cmd: |
      test -d .planning/milestones/v1.2 && test -d .planning/milestones/v1.2/evidence && test -f .planning/milestones/v1.2/INTENT.md && grep -q "^milestone:" .planning/milestones/v1.2/INTENT.md && grep -q "^outcome_delivered:" .planning/milestones/v1.2/INTENT.md && grep -q "^why:" .planning/milestones/v1.2/INTENT.md && grep -q "^parent_project:" .planning/milestones/v1.2/INTENT.md && grep -q "^created_at:" .planning/milestones/v1.2/INTENT.md
  - id: t2-registry-pointer
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/milestones/v1.2/evidence/147-review.md
    depends_on: [t1-bootstrap-milestone-dir]
    input_contract: |
      09-classification.yaml (from plan 01) — source for inline Classification table.
      09-gate-bypass.yaml (from plan 02) — source for inline Gate-Bypass Audit table.
      CONTEXT.md D-04, D-04a, D-04b (TWO output locations, SHA pin requirement ca5be16b..c41634c4, no symlink).
      09-RESEARCH.md §Q5 — registry pointer doc shape (D013 `YYYY-MM-DD-slug.md` format with frontmatter + sections + revert clause).
    output_contract: |
      .planning/milestones/v1.2/evidence/147-review.md with:
      - YAML frontmatter: type, milestone, external_repo_pin (repo, commits, reviewed_at, review_path),
        phase_source, created_at.
      - Body sections: ## Summary, ## Classification (inline markdown table copied from
        09-classification.yaml findings_detail), ## Gate-Bypass Audit (inline markdown table
        copied from 09-gate-bypass.yaml audit), ## Revert Clause.
    hypothesis: |
      Inlining the classification + bypass tables into a stable registry pointer doc at
      .planning/milestones/v1.2/evidence/147-review.md gives Phase 10 and later phases a
      single discoverable evidence location with SHA-pinned traceability back to the external
      project-clarity-erp review.
    falsifier: |
      Registry doc missing any required frontmatter key, OR SHA pin not present verbatim as
      ca5be16b..c41634c4, OR classification table missing any of W1-W4/I1-I6, OR gate-bypass
      table missing any of the 9 canonical gates.
    stop_rule: |
      147-review.md exists with all required frontmatter keys, SHA pin verbatim, all 10 finding
      IDs in the classification table, all 9 gate names in the bypass table, revert clause present.
    verification_cmd: |
      test -f .planning/milestones/v1.2/evidence/147-review.md && grep -q "external_repo_pin:" .planning/milestones/v1.2/evidence/147-review.md && grep -q "ca5be16b..c41634c4" .planning/milestones/v1.2/evidence/147-review.md && grep -q "## Classification" .planning/milestones/v1.2/evidence/147-review.md && grep -q "## Gate-Bypass Audit" .planning/milestones/v1.2/evidence/147-review.md && grep -q "## Revert Clause" .planning/milestones/v1.2/evidence/147-review.md
  - id: t3-verifier
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/phases/09-atc-147-evidence/verify.mjs
    depends_on: [t2-registry-pointer]
    input_contract: |
      09-classification.yaml + 09-gate-bypass.yaml + 147-review.md — the three artefacts to re-assert.
      09-RESEARCH.md §Validation Architecture — list of 7 invariants the verifier enforces.
      super-gsd/tools/plan-schema/validate.cjs lines 160-190 — reference pattern for loading js-yaml
      from .../plan-schema/node_modules/ (not an npm-install).
    output_contract: |
      Executable Node ES-module script at .planning/phases/09-atc-147-evidence/verify.mjs that:
      - loads js-yaml from super-gsd/tools/plan-schema/node_modules/ (same pattern as validate.cjs)
      - reads 09-classification.yaml + 09-gate-bypass.yaml + 147-review.md
      - asserts all 7 invariants (listed in action)
      - exits 0 on PASS, non-zero with clear error message on FAIL
      - is <=80 LOC total (research estimates ~30-60 LOC; allow headroom)
    hypothesis: |
      A single ~50 LOC Node script re-parsing both YAMLs and grep-checking the registry doc can
      mechanically verify all downstream consumers' invariants without additional sub-agent
      dispatches, making the phase verifiable in under 2 seconds.
    falsifier: |
      Verifier missing any of the 7 invariant assertions, OR verifier exits 0 on known-bad input
      (e.g. if findings_detail.length is 9 not 10), OR verifier requires an npm install.
    stop_rule: |
      verify.mjs exists, runs via `node .planning/phases/09-atc-147-evidence/verify.mjs`, exits 0
      when all three artefacts are valid, exits non-zero with clear message when any invariant fails.
    verification_cmd: |
      node .planning/phases/09-atc-147-evidence/verify.mjs

must_haves:
  truths:
    - ".planning/milestones/v1.2/INTENT.md exists with all required frontmatter (milestone, why, outcome_delivered, parent_project, created_at) — closes INTENT_MISSING checkpoint deviation"
    - ".planning/milestones/v1.2/evidence/147-review.md is the stable Phase 10+ consumption point for Phase 9's evidence"
    - "Registry pointer doc carries external_repo_pin with commits: ca5be16b..c41634c4 verbatim"
    - "Classification YAML from plan 01 is inlined as a markdown table (all 10 W1-W4/I1-I6 ids present)"
    - "Gate-bypass YAML from plan 02 is inlined as a markdown table (all 9 canonical gate names present)"
    - "Revert clause explains what forces re-opening the audit (external repo Wave 2 lands / SHA drifts)"
    - "verify.mjs asserts all 7 invariants (4 on classification YAML, 3 on gate-bypass YAML, plus registry doc presence)"
  artifacts:
    - path: ".planning/milestones/v1.2/INTENT.md"
      provides: "v1.2 milestone intent — closes INTENT_MISSING checkpoint deviation per D-04c"
      contains: "milestone: v1.2, why, outcome_delivered (≤120 chars), parent_project, created_at, closed_at: null"
    - path: ".planning/milestones/v1.2/evidence/147-review.md"
      provides: "Stable registry pointer doc Phase 10+ reads for Phase 147 evidence"
      contains: "external_repo_pin frontmatter with SHA range, inline Classification + Gate-Bypass tables, ## Revert Clause"
    - path: ".planning/phases/09-atc-147-evidence/verify.mjs"
      provides: "Mechanical verifier asserting all 7 Phase-9 artefact invariants"
      contains: "js-yaml load, findings_detail.length===10, bucket sum===10, headline===real_bloat+integration_gap, audit.length===9, per-phase partition===[6,7], gate-6 fired_retroactively===true, registry-doc SHA pin present"
  key_links:
    - from: ".planning/milestones/v1.2/evidence/147-review.md"
      to: ".planning/phases/09-atc-147-evidence/09-classification.yaml"
      via: "inline markdown table copy of findings_detail + `phase_source: 09-atc-147-evidence` frontmatter"
      pattern: "phase_source: 09-atc-147-evidence"
    - from: ".planning/milestones/v1.2/evidence/147-review.md"
      to: "../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md"
      via: "external_repo_pin.review_path relative reference + SHA range"
      pattern: "ca5be16b\\.\\.c41634c4"
    - from: ".planning/phases/09-atc-147-evidence/verify.mjs"
      to: "super-gsd/tools/plan-schema/node_modules/js-yaml"
      via: "require() with absolute path resolve (same pattern as validate.cjs:166)"
      pattern: "plan-schema/node_modules/js-yaml"
---

<objective>
Materialise the two YAML artefacts from plans 01 and 02 into the stable milestone evidence registry, author the v1.2 milestone INTENT.md (closes the checkpoint's INTENT_MISSING deviation), and ship the mechanical verifier script.

Purpose: Satisfies ATC-147-02 (registry pointer with cross-link). Also closes D-04c (v1.2 INTENT.md missing from checkpoint) and the Nyquist verifier dependency declared in 09-VALIDATION.md Wave 0. The registry pointer is the stable location Phase 10+ reads — the phase-dir YAMLs are working drafts; the evidence registry is canonical.

Output: `.planning/milestones/v1.2/INTENT.md` + `.planning/milestones/v1.2/evidence/147-review.md` + `.planning/phases/09-atc-147-evidence/verify.mjs`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-atc-147-evidence/09-CONTEXT.md
@.planning/phases/09-atc-147-evidence/09-RESEARCH.md
@.planning/phases/09-atc-147-evidence/09-VALIDATION.md
@super-gsd/templates/milestone-intent.md
@.planning/phases/09-atc-147-evidence/09-classification.yaml
@.planning/phases/09-atc-147-evidence/09-gate-bypass.yaml
</context>

<interfaces>
<!-- Required frontmatter shapes. Executor must emit these exact key sets. -->

### INTENT.md frontmatter (from milestone-intent.md template):
```yaml
---
milestone: v1.2
why: >-
  <1-3 sentences; the v1.2 Evidence-First Sharpening rationale from ROADMAP.md —
  Phase 147 ran autonomously overnight and skipped ~9 gates; v1.2 measures first,
  keeps/kills each gate, then sharpens the plan-schema → orchestrator → deliberate
  contract around that evidence.>
outcome_delivered: >-
  <≤120 chars, JOBS-TO-BE-DONE — e.g. "Operators can run autonomous phases with
  empirically-gated ATC/MUDA/curate gates and v2-schema plans.">
parent_project: Super GSD Framework
created_at: 2026-04-22
closed_at: null
entry_criteria:
  - Phase 11 Plan Schema v2 shipped (done 2026-04-21)
  - External project-clarity-erp Phase 147 retroactive ATC landed (commits ca5be16b..c41634c4)
exit_criteria:
  - All 5 phases (9, 10, 11, 12, 13) closed with green verifiers
  - gates.yaml + board-members.yaml registries populated
open_questions:
  - Will Phase 10 adopt the 4-bucket threshold bracket Phase 9 produced (≥3 keep/kill pivot)?
---
```

### Registry pointer doc frontmatter (from 09-RESEARCH.md §Q5):
```yaml
---
type: milestone-evidence
milestone: v1.2
external_repo_pin:
  repo: project-clarity-erp
  commits: ca5be16b..c41634c4
  reviewed_at: 2026-04-20
  review_path: ../../../../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md
phase_source: 09-atc-147-evidence
created_at: 2026-04-22
---
```

### Registry pointer doc body sections (required):
- `## Summary` — 1 paragraph, cite the headline_finding_count from 09-classification.yaml and total_bypass_cost bounds from 09-gate-bypass.yaml.
- `## Classification` — inline markdown table. Columns: ID | Bucket | Title | Justification. 10 rows, one per W1-W4 + I1-I6. Source: 09-classification.yaml findings_detail.
- `## Gate-Bypass Audit` — inline markdown table. Columns: Step | Gate | Class | Per-Unit (tokens) | Multiplier | Total | Fired Retroactively | Verdict Pointer to Phase 10. 9 rows. Source: 09-gate-bypass.yaml audit.
- `## Revert Clause` — under what conditions does this evidence become stale: external repo Wave 2 lands with new SHA range / SKILL.md per-gate budgets edited / Phase 147 code paths change such that W1/W2 integration gaps are wired (forces re-classification).

### verify.mjs contract (the 7 invariants):
1. classification YAML parses; findings_detail.length === 10
2. classification YAML: bucket sum === 10 (real_bloat + integration_gap + nit + false_positive + info)
3. classification YAML: headline_finding_count === real_bloat + integration_gap
4. gate-bypass YAML parses; audit.length === 9
5. gate-bypass YAML: per-phase rows are exactly steps [6, 7]
6. gate-bypass YAML: step-6 row has fired_retroactively === true
7. 147-review.md exists and contains literal string "ca5be16b..c41634c4"

Non-zero exit codes must correspond to the failing invariant number (exit 1 on inv-1 fail, exit 2 on inv-2, etc.) so the error message locates the failure.
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Bootstrap .planning/milestones/v1.2/ + author INTENT.md</name>
  <files>.planning/milestones/v1.2/INTENT.md</files>

  <read_first>
    - super-gsd/templates/milestone-intent.md (full template — required frontmatter + body sections)
    - .planning/phases/09-atc-147-evidence/09-CONTEXT.md §Decisions D-04c (why INTENT.md must be authored in this phase)
    - .planning/ROADMAP.md §v1.2 Evidence-First Sharpening (source text for `why` and `outcome_delivered` fields)
    - .planning/STATE.md frontmatter (line 4 milestone_name = "Evidence-First Sharpening")
  </read_first>

  <action>
Step 1 — Create the milestone directory tree (it does NOT exist yet per 09-RESEARCH.md §Environment Availability):
```bash
mkdir -p .planning/milestones/v1.2/evidence
```
This creates BOTH the milestone dir AND the evidence subdir in one call (evidence/ is needed by task 2 but cheapest to make here).

Step 2 — Author `.planning/milestones/v1.2/INTENT.md` using `super-gsd/templates/milestone-intent.md` as the skeleton. Frontmatter MUST include all 5 required keys from the template: milestone, why, outcome_delivered, parent_project, created_at. Also include closed_at: null (explicitly null per template).

Exact values to use:
- `milestone: v1.2`
- `why:` 1-3 sentences derived from ROADMAP.md v1.2 section — something like: "Phase 147 ran autonomously overnight and silently skipped ~9 CLAUDE-OVERLAY gates without audit. v1.2 Evidence-First Sharpening closes that gap — measure first (Phase 9), keep/kill each gate (Phase 10), then sharpen the plan-schema → orchestrator → deliberate contract (Phases 11-13) around that evidence."
- `outcome_delivered:` ≤120 chars. Example: "Operators run autonomous phases with empirically-gated gates and v2-schema plans that skip the classifier." (MUST count as ≤120 chars — run `echo -n "<string>" | wc -c` before committing.)
- `parent_project: Super GSD Framework`
- `created_at: 2026-04-22`
- `closed_at: null`

Include optional `entry_criteria` and `exit_criteria` per the <interfaces> block above — inherited from ROADMAP's dependency chain.

Step 3 — Body sections per template: `## Why`, `## Outcome`, `## How we'll know`, `## Open questions`. Keep narrative tight; the frontmatter is the injection contract, the body is the expansion.

Step 4 — Verify char-length of outcome_delivered:
```bash
node -e "const m=require('./super-gsd/tools/plan-schema/node_modules/gray-matter');const fs=require('fs');const f=m(fs.readFileSync('.planning/milestones/v1.2/INTENT.md','utf8'));const od=f.data.outcome_delivered||'';if(od.length>120){console.error('outcome_delivered > 120 chars:',od.length);process.exit(1);}console.log('outcome_delivered length OK:',od.length);"
```
  </action>

  <acceptance_criteria>
- `test -d .planning/milestones/v1.2` returns exit 0
- `test -d .planning/milestones/v1.2/evidence` returns exit 0
- `test -f .planning/milestones/v1.2/INTENT.md` returns exit 0
- All 5 required frontmatter keys present: `grep -q "^milestone:" .planning/milestones/v1.2/INTENT.md && grep -q "^why:" .planning/milestones/v1.2/INTENT.md && grep -q "^outcome_delivered:" .planning/milestones/v1.2/INTENT.md && grep -q "^parent_project:" .planning/milestones/v1.2/INTENT.md && grep -q "^created_at:" .planning/milestones/v1.2/INTENT.md`
- `closed_at` explicitly set: `grep -q "^closed_at: null" .planning/milestones/v1.2/INTENT.md`
- outcome_delivered ≤120 chars: the Node one-liner above exits 0
- parent_project value matches: `grep -q "^parent_project: Super GSD Framework" .planning/milestones/v1.2/INTENT.md`
  </acceptance_criteria>

  <verify>
    <automated>test -d .planning/milestones/v1.2 && test -d .planning/milestones/v1.2/evidence && test -f .planning/milestones/v1.2/INTENT.md && grep -q "^milestone: v1.2" .planning/milestones/v1.2/INTENT.md && grep -q "^outcome_delivered:" .planning/milestones/v1.2/INTENT.md && grep -q "^parent_project: Super GSD Framework" .planning/milestones/v1.2/INTENT.md && grep -q "^closed_at: null" .planning/milestones/v1.2/INTENT.md</automated>
  </verify>

  <done>
- Directory tree + INTENT.md committed with `feat(09-03): bootstrap v1.2 milestone dir + INTENT.md (closes INTENT_MISSING)`
- All 7 acceptance criteria pass
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Author .planning/milestones/v1.2/evidence/147-review.md registry pointer</name>
  <files>.planning/milestones/v1.2/evidence/147-review.md</files>

  <read_first>
    - .planning/phases/09-atc-147-evidence/09-classification.yaml (from plan 01 — MUST be parsed in this task to build the inline Classification table)
    - .planning/phases/09-atc-147-evidence/09-gate-bypass.yaml (from plan 02 — MUST be parsed to build the inline Gate-Bypass Audit table)
    - .planning/phases/09-atc-147-evidence/09-CONTEXT.md §Decisions D-04, D-04a, D-04b, D-04c (TWO locations, SHA pin, no symlink)
    - .planning/phases/09-atc-147-evidence/09-RESEARCH.md §Q5 (registry doc shape + revert clause requirement)
    - .planning/decisions/2026-04-21-sgsd-v2-retro.md (D013 YYYY-MM-DD-slug format precedent — the decision-note shape being mirrored)
  </read_first>

  <action>
Step 1 — Read both YAMLs produced by plans 01 and 02 using js-yaml (same pattern as `super-gsd/tools/plan-schema/validate.cjs`):
```bash
node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const cls=y.load(fs.readFileSync('.planning/phases/09-atc-147-evidence/09-classification.yaml','utf8'));const gbp=y.load(fs.readFileSync('.planning/phases/09-atc-147-evidence/09-gate-bypass.yaml','utf8'));console.log(JSON.stringify({cls,gbp},null,2));"
```
This dumps the parsed objects; use the output to construct the inline markdown tables (do NOT hand-transcribe — error-prone).

Step 2 — Author `.planning/milestones/v1.2/evidence/147-review.md` with the frontmatter from the <interfaces> block above. The SHA range `ca5be16b..c41634c4` MUST appear verbatim in `external_repo_pin.commits`.

Step 3 — Build the `## Summary` section as one paragraph. Must cite:
- `headline_finding_count` from 09-classification.yaml (e.g., "Headline finding count: 4 (real-bloat + integration-gap only).")
- upper_bound + lower_bound from 09-gate-bypass.yaml totals block (e.g., "Total gate-bypass cost: 9,340-18,940 tokens across 16 T-commit dispatches.")
- phase_source pointer (`phase_source: 09-atc-147-evidence`)

Step 4 — Build `## Classification` as a markdown table. Columns verbatim: `| ID | Bucket | Title | Justification |`. One row per item in 09-classification.yaml findings_detail (10 rows total: W1, W2, W3, W4, I1, I2, I3, I4, I5, I6).

Step 5 — Build `## Gate-Bypass Audit` as a markdown table. Columns verbatim: `| Step | Gate | Class | Per-Unit (tokens) | × | Total | Retro | Verdict Pointer |`. One row per item in 09-gate-bypass.yaml audit (9 rows). The `Retro` column shows ✓ for gate 6 (step 6 fired_retroactively: true) and blank otherwise.

Step 6 — Append `## Revert Clause`. Verbatim text:
```
This evidence becomes STALE and must be re-opened if ANY of:
- External project-clarity-erp lands Wave 2 or later commits outside the pinned SHA range ca5be16b..c41634c4.
- super-gsd/skills/sgsd-orchestrate/SKILL.md changes the per-gate token budget for any of the 9 audited gates.
- Phase 147 code paths change such that W1 (OwnerLookup orphaning) or W2 (resolve_target_seconds orphaning) are wired to the production data path, reducing the integration-gap count.
Re-opening requires: (a) updating the external_repo_pin.commits SHA range to the new range, (b) re-running plan 09-01 classification against the new review, (c) re-running plan 09-02 bypass audit if SKILL.md budgets changed, (d) updating this registry pointer.
```

Step 7 — Verify all required strings present.
  </action>

  <acceptance_criteria>
- `test -f .planning/milestones/v1.2/evidence/147-review.md` returns exit 0
- Frontmatter keys present: `grep -q "^type: milestone-evidence" .planning/milestones/v1.2/evidence/147-review.md && grep -q "^milestone: v1.2" .planning/milestones/v1.2/evidence/147-review.md && grep -q "^external_repo_pin:" .planning/milestones/v1.2/evidence/147-review.md && grep -q "^phase_source: 09-atc-147-evidence" .planning/milestones/v1.2/evidence/147-review.md`
- SHA pin verbatim: `grep -q "ca5be16b..c41634c4" .planning/milestones/v1.2/evidence/147-review.md`
- All 4 body sections present: `grep -q "^## Summary$" .planning/milestones/v1.2/evidence/147-review.md && grep -q "^## Classification$" .planning/milestones/v1.2/evidence/147-review.md && grep -q "^## Gate-Bypass Audit$" .planning/milestones/v1.2/evidence/147-review.md && grep -q "^## Revert Clause$" .planning/milestones/v1.2/evidence/147-review.md`
- All 10 finding IDs in Classification table: `grep -cE "^\| (W[1-4]|I[1-6]) \|" .planning/milestones/v1.2/evidence/147-review.md` returns 10
- All 9 gate rows in Gate-Bypass table: count rows with `| <int|6.5|9.5> |` leading — use `grep -cE "^\|[[:space:]]*(2|4|5|5\.5|6|6\.55|9\.5|10|11)[[:space:]]*\|" .planning/milestones/v1.2/evidence/147-review.md` returns 9 (one per gate step)
- No symlink (D-04b): `test ! -L .planning/milestones/v1.2/evidence/147-review.md` returns exit 0
  </acceptance_criteria>

  <verify>
    <automated>test -f .planning/milestones/v1.2/evidence/147-review.md && grep -q "external_repo_pin:" .planning/milestones/v1.2/evidence/147-review.md && grep -q "ca5be16b..c41634c4" .planning/milestones/v1.2/evidence/147-review.md && grep -q "^## Summary$" .planning/milestones/v1.2/evidence/147-review.md && grep -q "^## Classification$" .planning/milestones/v1.2/evidence/147-review.md && grep -q "^## Gate-Bypass Audit$" .planning/milestones/v1.2/evidence/147-review.md && grep -q "^## Revert Clause$" .planning/milestones/v1.2/evidence/147-review.md && test ! -L .planning/milestones/v1.2/evidence/147-review.md</automated>
  </verify>

  <done>
- 147-review.md committed with `feat(09-03): v1.2 evidence registry pointer for Phase 147 ATC (ATC-147-02)`
- All 7 acceptance criteria pass
- SHA pin present verbatim
- Both inline tables are populated from the parsed YAMLs, not hand-written
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Author verify.mjs (7 invariants, ~50 LOC, exit codes match failing invariant)</name>
  <files>.planning/phases/09-atc-147-evidence/verify.mjs</files>

  <read_first>
    - .planning/phases/09-atc-147-evidence/09-VALIDATION.md (sampling rate, per-task verification map, Wave 0 requirements list)
    - .planning/phases/09-atc-147-evidence/09-RESEARCH.md §Existing YAML Parsing Capacity + §Validation Architecture (the 7 invariants this verifier must assert)
    - super-gsd/tools/plan-schema/validate.cjs lines 160-190 (reference pattern for loading js-yaml via require(path.resolve(...)) without an npm install)
  </read_first>

  <action>
Step 1 — Author `.planning/phases/09-atc-147-evidence/verify.mjs` as a Node ES-module. Use this skeleton (~50 LOC):

```javascript
#!/usr/bin/env node
// Phase 9 mechanical verifier — asserts 7 invariants on classification + gate-bypass YAMLs + registry doc.
// Exit code matches the failing invariant number (1-7). Exit 0 = all PASS.
// Load js-yaml from super-gsd/tools/plan-schema/node_modules (already pinned in repo; no npm install needed).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = process.cwd();
const yamlPath = path.resolve(repoRoot, 'super-gsd/tools/plan-schema/node_modules/js-yaml');
const yaml = require(yamlPath);

const CLS_PATH = '.planning/phases/09-atc-147-evidence/09-classification.yaml';
const GBP_PATH = '.planning/phases/09-atc-147-evidence/09-gate-bypass.yaml';
const REG_PATH = '.planning/milestones/v1.2/evidence/147-review.md';

function fail(n, msg) { console.error(`FAIL invariant ${n}: ${msg}`); process.exit(n); }

// Load
let cls, gbp, reg;
try { cls = yaml.load(fs.readFileSync(CLS_PATH, 'utf8')); }
catch (e) { fail(1, `classification YAML parse error: ${e.message}`); }
try { gbp = yaml.load(fs.readFileSync(GBP_PATH, 'utf8')); }
catch (e) { fail(4, `gate-bypass YAML parse error: ${e.message}`); }
try { reg = fs.readFileSync(REG_PATH, 'utf8'); }
catch (e) { fail(7, `registry doc not readable: ${e.message}`); }

// Invariant 1: classification findings_detail.length === 10
if (!Array.isArray(cls.findings_detail) || cls.findings_detail.length !== 10)
  fail(1, `findings_detail.length is ${cls.findings_detail?.length}, expected 10`);

// Invariant 2: bucket sum === 10
const b = cls.findings_by_bucket || {};
const sum = (b.real_bloat || 0) + (b.integration_gap || 0) + (b.nit || 0) + (b.false_positive || 0) + (b.info || 0);
if (sum !== 10) fail(2, `bucket sum is ${sum}, expected 10`);

// Invariant 3: headline === real_bloat + integration_gap
const expectedHeadline = (b.real_bloat || 0) + (b.integration_gap || 0);
if (cls.headline_finding_count !== expectedHeadline)
  fail(3, `headline_finding_count is ${cls.headline_finding_count}, expected ${expectedHeadline}`);

// Invariant 4: gate-bypass audit.length === 9
if (!Array.isArray(gbp.audit) || gbp.audit.length !== 9)
  fail(4, `audit.length is ${gbp.audit?.length}, expected 9`);

// Invariant 5: per-phase rows are exactly steps [6, 7]
const perPhaseSteps = gbp.audit.filter(r => r.class === 'per-phase').map(r => r.step).sort((a, b) => a - b);
if (JSON.stringify(perPhaseSteps) !== JSON.stringify([6, 7]))
  fail(5, `per-phase rows are steps ${JSON.stringify(perPhaseSteps)}, expected [6, 7]`);

// Invariant 6: step-6 row has fired_retroactively === true
const g6 = gbp.audit.find(r => r.step === 6);
if (!g6 || g6.fired_retroactively !== true)
  fail(6, `step-6 row missing or fired_retroactively !== true`);

// Invariant 7: registry doc contains "ca5be16b..c41634c4" verbatim
if (!reg.includes('ca5be16b..c41634c4'))
  fail(7, `registry doc missing SHA pin ca5be16b..c41634c4`);

console.log('PASS: all 7 invariants hold');
process.exit(0);
```

Step 2 — Test by running:
```bash
node .planning/phases/09-atc-147-evidence/verify.mjs
```
Must exit 0 with output `PASS: all 7 invariants hold`.

Step 3 — Negative test (optional sanity check — do NOT commit the broken state): temporarily hand-edit 09-classification.yaml to make findings_detail have 9 rows, re-run verify.mjs, confirm it exits 1 with a clear message. Then revert.
  </action>

  <acceptance_criteria>
- `test -f .planning/phases/09-atc-147-evidence/verify.mjs` returns exit 0
- File imports js-yaml via the `super-gsd/tools/plan-schema/node_modules/js-yaml` path (matches validate.cjs pattern): `grep -q "plan-schema/node_modules/js-yaml" .planning/phases/09-atc-147-evidence/verify.mjs`
- Script runs + exits 0 when all artefacts valid: `node .planning/phases/09-atc-147-evidence/verify.mjs` exits 0
- File size reasonable: `wc -l .planning/phases/09-atc-147-evidence/verify.mjs | awk '{print $1}'` returns ≤80 (research estimated ~30-60; 80 is generous)
- All 7 invariants have distinct exit codes: `grep -cE "process\.exit\([1-7]\)|fail\([1-7]," .planning/phases/09-atc-147-evidence/verify.mjs` returns ≥7 (one fail call or process.exit for each invariant; `fail()` helper counts)
- No npm install required: `grep -v "^\/\/" .planning/phases/09-atc-147-evidence/verify.mjs | grep -qE "^import.*from ['\"]js-yaml['\"]"` returns exit 1 (we do NOT use a bare `from 'js-yaml'` — instead we use createRequire with a resolved path)
  </acceptance_criteria>

  <verify>
    <automated>node .planning/phases/09-atc-147-evidence/verify.mjs</automated>
  </verify>

  <done>
- verify.mjs committed with `feat(09-03): mechanical verifier asserting 7 Phase-9 invariants`
- Running the script on committed artefacts exits 0 with "PASS: all 7 invariants hold"
- All 6 acceptance criteria pass
- File is ≤80 LOC and uses the validate.cjs require-path pattern (no npm install)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Plan 01 + 02 YAMLs → registry doc | The registry is a consolidation point. If plans 01/02's YAMLs are malformed, they propagate into the inline tables here. |
| Phase dir → milestone registry | Milestone registry is Phase 10+'s consumption point. Phase dir drafts can evolve; registry is the stable SHA-pinned copy. |
| Verifier script → downstream consumers | Verifier exits 0 is the signal that Phase 10 can safely read the artefacts. A lax verifier poisons downstream. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-03-01 | Tampering | Inline tables in 147-review.md drift from YAML source | mitigate | Task 2 mandates parsing YAMLs with js-yaml (not hand-transcription). Verifier invariants 1-7 assert YAML-level correctness independently; if the markdown tables diverge, they're cosmetic (readers can fall back to the YAMLs via phase_source pointer). |
| T-09-03-02 | Information-disclosure | external_repo_pin SHA drifts without re-classification | mitigate | Revert Clause explicitly enumerates the three conditions that trigger re-opening; verifier invariant 7 asserts SHA presence; future re-review must update pin AND re-run plans 01/02. |
| T-09-03-03 | Denial-of-service | Verifier crashes on malformed YAML instead of exit-non-zero-cleanly | mitigate | `yaml.load` wrapped in try/catch; parse errors call `fail(n, msg)` with the invariant number and message, exit non-zero. |
| T-09-03-04 | Tampering | INTENT.md outcome_delivered > 120 chars breaks prompt-injection contract | mitigate | Task 1 runs a gray-matter length check before commit; >120 chars exits non-zero. |
| T-09-03-05 | Elevation-of-privilege | Verifier with incorrect invariant N exits 0 on bad input | accept | Low risk: the script is ~50 LOC and every invariant has a clear assertion. Negative-test step in Task 3 is optional but recommended. Additional defence: `/gsd-verify-work` runs as a separate phase-close gate. |
</threat_model>

<verification>
Full-phase gate (run after all 3 tasks green):
1. `node .planning/phases/09-atc-147-evidence/verify.mjs` exits 0 with PASS
2. All Task 1, 2, 3 acceptance criteria grep assertions pass (one unified bash `&&` chain can run them all)
3. `.planning/milestones/v1.2/INTENT.md` exists and is <=120 chars on outcome_delivered
4. No symlink at `.planning/milestones/v1.2/evidence/147-review.md` (D-04b)
</verification>

<success_criteria>
- ATC-147-02 satisfied: registry pointer doc exists at `.planning/milestones/v1.2/evidence/147-review.md`, cross-links via relative path to external review, SHA-pinned to `ca5be16b..c41634c4`.
- D-04c satisfied: `.planning/milestones/v1.2/INTENT.md` exists with all 5 required frontmatter fields (closes INTENT_MISSING checkpoint deviation).
- Nyquist Wave 0 satisfied: `verify.mjs` exists and asserts all 7 invariants the 09-VALIDATION.md strategy mandates.
- Milestone dir tree (`.planning/milestones/v1.2/` + `.planning/milestones/v1.2/evidence/`) exists and is the canonical pattern v1.3+ milestones inherit.
- Verifier uses the existing `super-gsd/tools/plan-schema/node_modules/js-yaml` install (no npm install, matches validate.cjs pattern).
</success_criteria>

<output>
After completion, create `.planning/phases/09-atc-147-evidence/plans/09-03-SUMMARY.md` summarising:
- All 3 files created (paths + one-liner purpose)
- outcome_delivered text (for quick audit of the injection contract)
- Final verifier output (`node .../verify.mjs` → "PASS: all 7 invariants hold")
- The 3 commit SHAs (one per task)
</output>

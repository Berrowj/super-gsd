---
schema_version: 2
expected_ATC_tier: FULL
depends_on: ["21-01"]
tasks:
  - id: "21-02-T1"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/vtp-enrichment-gate.cjs
    input_contract: >
      super-gsd/scripts/lib/vtp-enrichment-gate.cjs (vtpCrossRef stub from 21-01-T1);
      21-CONTEXT.md D-05 (tier-batching: CRITICAL=per-finding, WARN=batched, PASS=skip);
      21-RESEARCH.md §Pattern 3 (vtpCrossRef(text, tier, opts) signature, DRY rationale);
      21-RESEARCH.md §Pitfall 4 (token-explosion prevention via batching at helper level).
    output_contract: >
      vtpCrossRef(text, tier, opts) fully implemented in vtp-enrichment-gate.cjs:
      tier='CRITICAL' -> calls callVtp per-finding with finding text + file:line context as seed;
      tier='WARN' -> accumulates findings, single batched callVtp call at flush();
      tier='PASS' -> no-op, returns [];
      Returns array of citation objects {source, title, section, relevance, citation}.
      D-05 batching enforced at helper level (callers cannot bypass by passing wrong tier).
      --self-test exits 0 after this change.
    hypothesis: >
      Implementing D-05 tier-batching inside vtpCrossRef rather than at each caller site
      prevents copy-paste drift across 3 audit skill files and enforces the token-explosion
      guard (D-05 CRITICAL=per-finding max 0-2, WARN=single batched call).
    falsifier: >
      node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test exits non-zero after T1 edit, OR
      vtpCrossRef called with tier='PASS' triggers a VTP call (token waste regression), OR
      vtpCrossRef called with tier='WARN' emits more than 1 VTP call per flush().
    stop_rule: >
      node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test exits 0;
      grep -q 'vtpCrossRef' super-gsd/scripts/lib/vtp-enrichment-gate.cjs exits 0.
    verification_cmd: "node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test"

  - id: "21-02-T2"
    agent: gsd-executor
    model: sonnet
    depends_on: ["21-02-T1"]
    files_touched:
      - super-gsd/agents/sgsd-workflow-auditor.md
      - super-gsd/skills/sgsd-muda-audit/SKILL.md
    input_contract: >
      super-gsd/agents/sgsd-workflow-auditor.md (role, inputs, process sections);
      super-gsd/skills/sgsd-muda-audit/SKILL.md (process steps, output artifact);
      super-gsd/scripts/lib/vtp-enrichment-gate.cjs vtpCrossRef export (from 21-02-T1);
      21-REQUIREMENTS.md VTPE-02 AC (Library Cross-Reference section, per-finding citations with
      book/paper title + section ref + confidence rating);
      21-CONTEXT.md D-07 (disabled-by-default: gate only fires if config.vtp_enrichment.enabled).
      NOTE: gsd-audit-milestone does not exist as standalone agent; milestone audit surface is
      sgsd-complete-milestone/SKILL.md addressed in 21-02-T3.
    output_contract: >
      sgsd-workflow-auditor.md: new trailing step added to <process> — after writing WORKFLOW-AUDIT.md,
      if config.vtp_enrichment.enabled, call vtpCrossRef on each CRITICAL finding (per-finding)
      and all WARN findings (batched), write "## Library Cross-Reference" section to WORKFLOW-AUDIT.md
      with citations table (source|title|section|relevance|citation per VTPE-02 AC).
      sgsd-muda-audit/SKILL.md: identical trailing step added after WASTE.md write —
      vtpCrossRef on FAIL findings (CRITICAL tier), WARN findings (WARN tier), append
      "## Library Cross-Reference" to WASTE.md with same citation table format.
    hypothesis: >
      Adding a config-gated trailing vtpCrossRef step to both audit skill files (workflow-auditor
      and muda-audit) delivers VTPE-02 cross-reference on both audit surfaces without duplicating
      VTP call logic (shared helper in vtp-enrichment-gate.cjs).
    falsifier: >
      grep -q 'vtpCrossRef' super-gsd/agents/sgsd-workflow-auditor.md exits non-zero, OR
      grep -q 'vtpCrossRef' super-gsd/skills/sgsd-muda-audit/SKILL.md exits non-zero, OR
      either file's process section is structurally broken after edit (lost existing steps).
    stop_rule: >
      grep -q 'vtpCrossRef' super-gsd/agents/sgsd-workflow-auditor.md exits 0 AND
      grep -q 'vtpCrossRef' super-gsd/skills/sgsd-muda-audit/SKILL.md exits 0.
    verification_cmd: "grep -q 'vtpCrossRef' super-gsd/agents/sgsd-workflow-auditor.md && grep -q 'vtpCrossRef' super-gsd/skills/sgsd-muda-audit/SKILL.md && echo PASS"

  - id: "21-02-T3"
    agent: gsd-executor
    model: sonnet
    depends_on: ["21-02-T1"]
    files_touched:
      - super-gsd/skills/sgsd-complete-milestone/SKILL.md
    input_contract: >
      super-gsd/skills/sgsd-complete-milestone/SKILL.md Step 7 (VTP read-side already present —
      extend write-side only per 21-RESEARCH.md §Pattern 4);
      super-gsd/scripts/lib/vtp-enrichment-gate.cjs vtpCrossRef export (from 21-02-T1);
      21-REQUIREMENTS.md VTPE-03 AC (Connections subsection with library-backed citations,
      book/paper title + section ref + confidence);
      21-RESEARCH.md §Pattern 4 (extend Step 7 write-side only — zero new queries, zero new steps).
    output_contract: >
      sgsd-complete-milestone/SKILL.md Step 7 extended write-side:
      Existing Step 7 VTP query results now also written into SUMMARY.md Connections section
      as a "Connections (library-backed)" subsection with table rows:
      pattern_name | book/paper title | section | confidence | notes.
      vtpCrossRef NOT called here (Step 7 already queries VTP); only the write-side is extended
      to include citation detail per VTPE-03.
      config.vtp_enrichment.enabled guard wraps the new Connections subsection write.
    hypothesis: >
      Extending Step 7 write-side only (no new queries) delivers VTPE-03 milestone-close library
      cross-reference without duplicating VTP calls or adding a new step — reusing the result
      already present from the existing Step 7 read-side query.
    falsifier: >
      grep -q 'library-backed' super-gsd/skills/sgsd-complete-milestone/SKILL.md exits non-zero, OR
      Step 7 in the file is missing after edit (broken by insertion), OR
      a new Step 8 was added that fires a fresh VTP query (duplicating Step 7 calls).
    stop_rule: >
      grep -q 'library-backed' super-gsd/skills/sgsd-complete-milestone/SKILL.md exits 0;
      Step 7 keyword still present after edit.
    verification_cmd: "grep -q 'library-backed' super-gsd/skills/sgsd-complete-milestone/SKILL.md && grep -q 'Step 7' super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo PASS"
---

# Plan 21-02: Audit Cross-Reference + Milestone-Close Xref

## Objective

Complete vtpCrossRef implementation in the sibling module, then wire it into both audit
skill surfaces (workflow-auditor + muda-audit) and extend sgsd-complete-milestone Step 7
write-side for the milestone-close library cross-reference. Delivers VTPE-02 + VTPE-03.

## Context

@.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-CONTEXT.md
@.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-RESEARCH.md
@.planning/REQUIREMENTS.md
@.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-01-SUMMARY.md

Key files to read before executing:
- super-gsd/scripts/lib/vtp-enrichment-gate.cjs (vtpCrossRef stub from 21-01)
- super-gsd/agents/sgsd-workflow-auditor.md (process section structure)
- super-gsd/skills/sgsd-muda-audit/SKILL.md (process steps and output)
- super-gsd/skills/sgsd-complete-milestone/SKILL.md (Steps 6+7 structure)

## Audit Surface Resolution (MEDIUM-confidence resolved)

Glob confirmed: `gsd-audit-milestone` does NOT exist as standalone agent.
VTPE-02 three surfaces map to:
1. `super-gsd/agents/sgsd-workflow-auditor.md` — workflow audit (sgsd-audit equivalent)
2. `super-gsd/skills/sgsd-muda-audit/SKILL.md` — MUDA audit (sgsd-muda-audit)
3. `super-gsd/skills/sgsd-complete-milestone/SKILL.md` — milestone close (VTPE-03, T3 in this plan)

## Execution Notes

- T1: D-05 batching is enforced at helper level — callers must not be able to bypass by passing
  wrong tier. Add an assertion or guard inside vtpCrossRef.
- T2: config.vtp_enrichment.enabled check wraps the vtpCrossRef trailing step in both skill files
  (D-07 backward-compat)
- T3: MUST NOT add a new VTP query — extend write-side of existing Step 7 result only
- ASCII-only strings; Node read-mutate-write for config (not cat/echo)
- Commit per task: feat(21-02/T1): VTPE-02 implement vtpCrossRef tier-batching

## Verification

```
node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test
grep -q 'vtpCrossRef' super-gsd/agents/sgsd-workflow-auditor.md
grep -q 'vtpCrossRef' super-gsd/skills/sgsd-muda-audit/SKILL.md
grep -q 'library-backed' super-gsd/skills/sgsd-complete-milestone/SKILL.md
node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-02-audit-xref-PLAN.md --mode load
```

## Output

After completion write `.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-02-SUMMARY.md`

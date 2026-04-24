---
schema_version: 2
expected_ATC_tier: FULL
depends_on: []
tasks:
  - id: "21-01-T1"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/vtp-enrichment-gate.cjs
    input_contract: >
      super-gsd/scripts/lib/vtp-context-composer.cjs (callVtp export + routing-log contract,
      commit 81b66e9 status field: zero_hits vs failure);
      21-CONTEXT.md D-01 (5-tool cascade), D-02 (seed construction), D-03 (max 5 queries),
      D-04 (VTP-ENRICHMENT.md shape), D-05 (tier-batching), D-07 (disabled default);
      21-RESEARCH.md §Pattern 2 (sibling module rationale).
    output_contract: >
      super-gsd/scripts/lib/vtp-enrichment-gate.cjs created with exports:
      { run(opts) -> {status, artifact_path}, vtpCrossRef(text, tier, opts) -> {citations[]} }.
      run() builds 800-token seed (CONTEXT domain + REQ-IDs AC + RESEARCH.md per D-02),
      calls tools 1+2 always, tools 3+4+5 only if hits>0 (D-01), caps at 5 queries (D-03),
      writes VTP-ENRICHMENT.md with D-04 shape always (empty_hit or enriched),
      maps callVtp ok:false -> status:'api_error', ok:true with hits==0 -> status:'empty_hit'.
      vtpCrossRef stub: tier-based batching per D-05 (CRITICAL per-finding, WARN batched, PASS no-op).
      --self-test CLI flag runs smoke test (no MCP calls, stub mode).
    hypothesis: >
      A standalone sibling CJS module wrapping callVtp with the D-01 cascade and D-04 artifact
      write will provide gate() and vtpCrossRef() to all callers without modifying
      vtp-context-composer.cjs's stable 6-export contract.
    falsifier: >
      node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test exits non-zero, OR
      require('./vtp-enrichment-gate.cjs').run is not a function, OR
      require('./vtp-enrichment-gate.cjs').vtpCrossRef is not a function.
    stop_rule: >
      node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test exits 0;
      module exports { run, vtpCrossRef }; file exists at stated path.
    verification_cmd: "node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test"

  - id: "21-01-T2"
    agent: gsd-executor
    model: sonnet
    depends_on: ["21-01-T1"]
    files_touched:
      - super-gsd/registry/gates.yaml
    input_contract: >
      super-gsd/registry/gates.yaml (existing schema_version 2.1.0 row shape);
      21-RESEARCH.md §Code Examples gates.yaml new row (verbatim YAML snippet);
      21-CONTEXT.md D-07 (disabled-by-default, trigger: vtp_enrichment_enabled).
    output_contract: >
      New gate row appended to super-gsd/registry/gates.yaml:
      name: vtp-enrichment, category: process-hygiene, step: 6.15,
      enforcement_mode: soft-warn, trigger fields: research_phase_complete=true AND
      vtp_enrichment_enabled=true, evidence_emitted pattern per RESEARCH.md §Code Examples,
      escalation: block_on_api_error, source_dlb: VTPE-01, state: active, version: 2.1.
    hypothesis: >
      Adding the vtp-enrichment gate row to gates.yaml with the correct trigger predicate
      allows gates-registry.cjs shouldFire() to activate the gate only when both
      research_phase_complete AND vtp_enrichment_enabled are true.
    falsifier: >
      grep -q 'vtp-enrichment' super-gsd/registry/gates.yaml exits non-zero, OR
      the new row's trigger fields differ from the D-07 opt-in requirement,
      OR gates.yaml YAML is malformed (node -e "require('js-yaml').load(fs.readFileSync(...))" throws).
    stop_rule: >
      grep -q 'vtp-enrichment' super-gsd/registry/gates.yaml exits 0;
      YAML remains valid after edit.
    verification_cmd: "grep -q 'vtp-enrichment' super-gsd/registry/gates.yaml && echo PASS"

  - id: "21-01-T3"
    agent: gsd-executor
    model: sonnet
    depends_on: ["21-01-T1", "21-01-T2"]
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - custom-gsd-extract/claude-agents/gsd-planner.md
    input_contract: >
      super-gsd/skills/sgsd-orchestrate/SKILL.md Step 6.b (research dispatch) and Step 6.c
      (planner dispatch) — insertion point for Step 6.b.5 confirmed (21-RESEARCH.md §Primary Sources);
      21-RESEARCH.md §Pattern 1 (verbatim Step 6.b.5 pseudocode block);
      custom-gsd-extract/claude-agents/gsd-planner.md (planner prompt composition, files_to_read block);
      21-CONTEXT.md D-07 (config.vtp_enrichment absent = skip silently);
      21-RESEARCH.md §Pitfall 1 (artifact-theater prevention — both changes required together).
    output_contract: >
      sgsd-orchestrate/SKILL.md: new Step 6.b.5 inserted between Steps 6.b and 6.c.
      Step 6.b.5 checks config.vtp_enrichment.enabled; if true dispatches sgsd-vtp-enrichment
      sub-agent (model: sonnet) with seed+phaseDir+phase+config; on api_error emits BLOCKER
      and exits loop; on empty_hit or success continues to Step 6.c.
      gsd-planner.md: planner prompt composition updated so VTP-ENRICHMENT.md appears in
      files_to_read block alongside RESEARCH.md (artifact-theater prevention per D-04 + VTPE-01).
      Verification: grep -q 'VTP-ENRICHMENT' custom-gsd-extract/claude-agents/gsd-planner.md exits 0.
    hypothesis: >
      Inserting Step 6.b.5 in the orchestrate SKILL.md and patching planner prompt composition
      to include VTP-ENRICHMENT.md closes the artifact-theater gap: the gate writes the artifact
      AND the planner consumes it — both required for VTPE-01 to be non-theater.
    falsifier: >
      grep -q '6.b.5' super-gsd/skills/sgsd-orchestrate/SKILL.md exits non-zero, OR
      grep -q 'VTP-ENRICHMENT' custom-gsd-extract/claude-agents/gsd-planner.md exits non-zero, OR
      sgsd-orchestrate SKILL.md no longer contains Step 6.c after the edit (broken by insertion).
    stop_rule: >
      grep -q '6.b.5' super-gsd/skills/sgsd-orchestrate/SKILL.md exits 0 AND
      grep -q 'VTP-ENRICHMENT' custom-gsd-extract/claude-agents/gsd-planner.md exits 0.
    verification_cmd: "grep -q '6.b.5' super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q 'VTP-ENRICHMENT' custom-gsd-extract/claude-agents/gsd-planner.md && echo PASS"
---

# Plan 21-01: Research→Planning Gate + Orchestrator Integration

## Objective

Create `vtp-enrichment-gate.cjs` sibling module, register the gate in gates.yaml, and wire
Step 6.b.5 into the orchestrator SKILL.md with artifact-theater prevention in gsd-planner prompt.
Delivers VTPE-01 end-to-end: gate fires after research, writes VTP-ENRICHMENT.md, planner consumes it.

## Context

@.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-CONTEXT.md
@.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-RESEARCH.md
@.planning/REQUIREMENTS.md

Key files to read before executing:
- super-gsd/scripts/lib/vtp-context-composer.cjs (callVtp contract, status field, exports)
- super-gsd/registry/gates.yaml (existing row shape)
- super-gsd/skills/sgsd-orchestrate/SKILL.md (Steps 6.b and 6.c insertion point)
- custom-gsd-extract/claude-agents/gsd-planner.md (files_to_read block location)
- super-gsd/skills/sgsd-vtp-advise/SKILL.md (sub-agent dispatch pattern precedent)

## Execution Notes

- T1 MUST NOT modify vtp-context-composer.cjs — sibling only (per D-07 stable-contract rationale)
- T1: require('./vtp-context-composer.cjs') to access callVtp — do not duplicate the MCP call logic
- T3: ASCII-only strings in SKILL.md edits (Phase 17 lesson)
- T3: Node read-mutate-write for any config mutation (feedback_never_head_settings)
- Commit per task: feat(21-01/T1): VTPE-01 create vtp-enrichment-gate.cjs sibling

## Verification

```
node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test
grep -q 'vtp-enrichment' super-gsd/registry/gates.yaml
grep -q '6.b.5' super-gsd/skills/sgsd-orchestrate/SKILL.md
grep -q 'VTP-ENRICHMENT' custom-gsd-extract/claude-agents/gsd-planner.md
node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-01-gate-orchestrator-PLAN.md --mode load
```

## Output

After completion write `.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-01-SUMMARY.md`

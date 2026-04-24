---
schema_version: 2
expected_ATC_tier: FULL
depends_on: ["21-01"]
tasks:
  - id: "21-03-T1"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/config.json
    input_contract: >
      .planning/config.json (current contents — vtp_enrichment key ABSENT per 21-RESEARCH.md
      §Primary Sources; deliberation.board currently ["architect","pragmatist","contrarian","moonshot"]);
      21-CONTEXT.md D-07 (verbatim opt-in block: enabled:false, challenger_mode:false,
      granularity:tier-based, empty_hit_policy:continue, max_queries_per_gate:5,
      query_seed_max_tokens:800, audit_tier_batching:{critical:per-finding,warn:batched,pass:skip});
      feedback_never_head_settings: use Node read-mutate-write (never cat/head/echo).
    output_contract: >
      .planning/config.json updated with additive vtp_enrichment block exactly matching D-07 shape.
      deliberation.board remains ["architect","pragmatist","contrarian","moonshot"] — "researcher"
      NOT appended yet (that is 21-04-T2 per plan split).
      All existing config keys preserved unchanged.
      Node read-mutate-write script used (not shell echo/cat).
    hypothesis: >
      Adding the vtp_enrichment block with enabled:false default means all existing projects
      get zero behavioral drift (D-07 backward-compat) while new opt-in projects can set
      enabled:true to activate gates.
    falsifier: >
      node -e "const c=require('.planning/config.json'); if(!c.vtp_enrichment) throw new Error('missing')"
      exits non-zero, OR c.vtp_enrichment.enabled !== false, OR any previously-existing config
      key is missing after write (config corrupted by write).
    stop_rule: >
      node -e "const c=require('./.planning/config.json'); console.log(c.vtp_enrichment.enabled)"
      prints 'false'; all prior keys present.
    verification_cmd: "node -e \"const c=require('./.planning/config.json'); if(c.vtp_enrichment && c.vtp_enrichment.enabled===false) console.log('PASS'); else process.exit(1)\""

  - id: "21-03-T2"
    agent: gsd-executor
    model: sonnet
    depends_on: ["21-03-T1"]
    files_touched:
      - super-gsd/scripts/lib/vtp-enrichment-gate.cjs
    input_contract: >
      super-gsd/scripts/lib/vtp-enrichment-gate.cjs run() from 21-01-T1;
      21-CONTEXT.md D-04 (VTP-ENRICHMENT.md shape — YAML frontmatter: phase, query_count,
      total_hits, duration_ms, empty_hit, vtp_status, generated_at, seed_summary);
      21-RESEARCH.md §VTP-ENRICHMENT.md minimum schema (verbatim D-04 + VTPE-05 example);
      21-RESEARCH.md §Pitfall 2 (api_error vs empty_hit distinction — callVtp ok:false = api_error,
      ok:true with evidence_hit_count==0 = empty_hit);
      VTPE-05 AC: artifact written even on zero hits; api_error = BLOCKER, empty_hit = continue.
    output_contract: >
      vtp-enrichment-gate.cjs run() hardened:
      (a) VTP-ENRICHMENT.md written on EVERY call — success, empty_hit, AND api_error paths all
      write the file (even api_error writes a stub so artifact existence check always passes);
      (b) empty_hit:true path writes D-04 shape with Empty-Hit Rationale section;
      (c) vtp_status frontmatter field set to 'success'|'empty_hit'|'api_error';
      (d) api_error -> run() returns {status:'api_error'} (orchestrator halts via Pitfall 2 contract);
      (e) --self-test exits 0 with stub callVtp simulating all three paths.
    hypothesis: >
      Always writing VTP-ENRICHMENT.md (even on api_error) ensures the artifact existence check
      is a reliable gate — downstream orchestrator can check file existence to confirm gate ran
      without needing to parse content for error state.
    falsifier: >
      node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test exits non-zero, OR
      stub api_error path does NOT write a VTP-ENRICHMENT.md file, OR
      stub empty_hit path writes a file without the 'Empty-Hit Rationale' section.
    stop_rule: >
      node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test exits 0;
      self-test output confirms all three paths (api_error, empty_hit, success) each write artifact.
    verification_cmd: "node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test"

  - id: "21-03-T3"
    agent: gsd-executor
    model: sonnet
    depends_on: ["21-03-T2"]
    files_touched:
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
    input_contract: >
      super-gsd/skills/sgsd-orchestrate/SKILL.md (Step 3 cold-start section — from 21-01-T3 edit);
      21-CONTEXT.md D-08 (VTP-aware degraded mode: orchestrator cold-start pings vtp_health,
      caches result, downgrades to continue-without-artifact if health fails);
      super-gsd/skills/sgsd-vtp-advise/SKILL.md (MCP health check pattern precedent).
    output_contract: >
      sgsd-orchestrate/SKILL.md Step 3 (cold-start) extended:
      After existing cold-start reads, add vtp_health probe block:
      ping mcp__vtp-kb__vtp_search with minimal seed ("health check", 1 result);
      if probe succeeds -> cache vtp_available=true in session context;
      if probe fails (timeout/error) -> cache vtp_available=false, log warning
      "VTP health check failed — enrichment gates will run continue-without-artifact mode";
      Step 6.b.5 reads cached vtp_available before dispatching sgsd-vtp-enrichment sub-agent:
      if vtp_available=false -> skip gate silently (D-08 degraded mode), continue to Step 6.c.
    hypothesis: >
      Caching VTP health at cold-start (Step 3) and checking it in Step 6.b.5 prevents
      enrichment gate dispatches from failing mid-run on VTP outage — the run degrades gracefully
      instead of blocking at a gate that can never succeed.
    falsifier: >
      grep -q 'vtp_health' super-gsd/skills/sgsd-orchestrate/SKILL.md exits non-zero, OR
      the degraded mode path in Step 6.b.5 is absent (not checking vtp_available cache before
      dispatching sub-agent), OR Step 3 existing cold-start reads are missing after edit.
    stop_rule: >
      grep -q 'vtp_health' super-gsd/skills/sgsd-orchestrate/SKILL.md exits 0;
      grep -q 'vtp_available' super-gsd/skills/sgsd-orchestrate/SKILL.md exits 0.
    verification_cmd: "grep -q 'vtp_health' super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q 'vtp_available' super-gsd/skills/sgsd-orchestrate/SKILL.md && echo PASS"
---

# Plan 21-03: Design-Policy Config + Empty-Hit Artifact Discipline

## Objective

Add vtp_enrichment config block to config.json (D-07 opt-in default), harden the empty-hit
artifact path in vtp-enrichment-gate.cjs so VTP-ENRICHMENT.md is always written (VTPE-05),
and add D-08 VTP-aware degraded mode (vtp_health cold-start probe + vtp_available cache).
Delivers VTPE-04 + VTPE-05 + D-08.

## Context

@.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-CONTEXT.md
@.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-RESEARCH.md
@.planning/REQUIREMENTS.md
@.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-01-SUMMARY.md

Key files to read before executing:
- .planning/config.json (current state — must use Node read-mutate-write)
- super-gsd/scripts/lib/vtp-enrichment-gate.cjs (run() from 21-01 to harden)
- super-gsd/skills/sgsd-orchestrate/SKILL.md (Step 3 cold-start + Step 6.b.5 from 21-01)
- super-gsd/skills/sgsd-vtp-advise/SKILL.md (MCP health probe pattern)

## Execution Notes

- T1: MUST use Node read-mutate-write for config.json per feedback_never_head_settings.
  Pattern: const cfg = JSON.parse(fs.readFileSync('.planning/config.json')); cfg.vtp_enrichment = {...};
  fs.writeFileSync('.planning/config.json', JSON.stringify(cfg, null, 2))
- T2: All three status paths (api_error, empty_hit, success) must produce a written artifact
  in self-test stub mode
- T3: D-08 is a scoping-session addition — it was NOT in D-01..D-07 but is confirmed in scope
  per operator "recent scoping" note in planner prompt
- ASCII-only strings in SKILL.md edits
- Commit per task: feat(21-03/T1): VTPE-04 add vtp_enrichment config block

## Verification

```
node -e "const c=require('./.planning/config.json'); if(c.vtp_enrichment && c.vtp_enrichment.enabled===false) console.log('PASS'); else process.exit(1)"
node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test
grep -q 'vtp_health' super-gsd/skills/sgsd-orchestrate/SKILL.md
node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-03-config-empty-hit-PLAN.md --mode load
```

## Output

After completion write `.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-03-SUMMARY.md`

---
schema_version: 2
expected_ATC_tier: FULL
depends_on: ["21-03"]
tasks:
  - id: "21-04-T1"
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/agents/sgsd-board-researcher.md
    input_contract: >
      super-gsd/agents/sgsd-board-architect.md (5-section scaffold: role/temperament/reasoning/
      heuristics/output_format — direct copy basis per 21-RESEARCH.md §Pattern 5);
      super-gsd/agents/sgsd-board-contrarian.md (adversarial voice pattern closest to researcher
      "propose alternative framings" spirit);
      21-RESEARCH.md §sgsd-board-researcher.md key differentiators (verbatim frontmatter +
      YAML output block additions: library_coverage + citations fields);
      21-CONTEXT.md D-06 (model: sonnet);
      VTPE-06 AC: tools include mcp__vtp-kb__vtp_search, vtp_search_substrate, vtp_search_research,
      vtp_route_and_retrieve; role queries VTP + proposes/confirms with book/paper precedent.
    output_contract: >
      super-gsd/agents/sgsd-board-researcher.md created with:
      YAML frontmatter: name:sgsd-board-researcher, model:sonnet, tools include Read/Grep/Glob
      and all 4 VTP MCP tools from VTPE-06 AC.
      5-section body matching architect scaffold structure, with researcher-specific:
      role: "Library Researcher — queries VTP during deliberation to confirm or challenge
      proposals with book/paper precedent. Evidence-first, citation-driven temperament."
      output_format: standard board YAML + library_coverage:confirmed|adjacent|absent +
      citations[] array with doc_id/title/section/relevance fields.
      D-01 tool cascade honored: vtp_search + vtp_search_substrate always; others if hits>0.
    hypothesis: >
      Copying sgsd-board-architect.md scaffold and substituting researcher role, VTP tools,
      and citation output block will produce a valid 5th board member that sgsd-ceo can
      dispatch identically to existing 4 members via the round-robin loop.
    falsifier: >
      sgsd-board-researcher.md does not exist after T1, OR frontmatter model is not 'sonnet',
      OR mcp__vtp-kb__vtp_search not listed in tools, OR output_format section missing
      library_coverage and citations[] fields.
    stop_rule: >
      super-gsd/agents/sgsd-board-researcher.md exists;
      grep -q 'mcp__vtp-kb__vtp_search' super-gsd/agents/sgsd-board-researcher.md exits 0;
      grep -q 'library_coverage' super-gsd/agents/sgsd-board-researcher.md exits 0.
    verification_cmd: "grep -q 'mcp__vtp-kb__vtp_search' super-gsd/agents/sgsd-board-researcher.md && grep -q 'library_coverage' super-gsd/agents/sgsd-board-researcher.md && echo PASS"

  - id: "21-04-T2"
    agent: gsd-executor
    model: sonnet
    depends_on: ["21-04-T1"]
    files_touched:
      - .planning/config.json
    input_contract: >
      .planning/config.json (from 21-03-T1 — vtp_enrichment block added, deliberation.board
      confirmed as ["architect","pragmatist","contrarian","moonshot"]);
      21-RESEARCH.md §Pattern 5 (config.deliberation.board append "researcher" — single toggle
      activates 5th voice);
      feedback_never_head_settings: Node read-mutate-write (never cat/head/echo).
    output_contract: >
      .planning/config.json deliberation.board updated to
      ["architect","pragmatist","contrarian","moonshot","researcher"].
      vtp_enrichment block and all other config keys preserved unchanged.
      Node read-mutate-write script used.
    hypothesis: >
      Appending "researcher" to config.deliberation.board is the single config change that
      activates the 5th board voice — sgsd-ceo's defensive board.includes('researcher') guard
      (from 21-04-T3) will then dispatch sgsd-board-researcher in round-robin.
    falsifier: >
      node -e "const c=require('.planning/config.json'); if(!c.deliberation.board.includes('researcher')) process.exit(1)"
      exits non-zero, OR deliberation.board length is not 5, OR vtp_enrichment block removed.
    stop_rule: >
      node -e "const c=require('./.planning/config.json'); console.log(c.deliberation.board)"
      prints array containing 'researcher' with length 5.
    verification_cmd: "node -e \"const c=require('./.planning/config.json'); if(c.deliberation&&c.deliberation.board&&c.deliberation.board.includes('researcher')) console.log('PASS'); else process.exit(1)\""

  - id: "21-04-T3"
    agent: gsd-executor
    model: sonnet
    depends_on: ["21-04-T1", "21-04-T2"]
    files_touched:
      - super-gsd/agents/sgsd-ceo.md
    input_contract: >
      super-gsd/agents/sgsd-ceo.md (Step 4 board spawn, synthesis_rules, token_budget sections —
      confirmed as prose-only per 21-RESEARCH.md §Assumptions A2);
      21-RESEARCH.md §Pattern 5 (verbatim changes: Step 4 "Spawn 4" -> config-driven,
      defensive guard board.includes('researcher'), synthesis_rules Weight Researcher line,
      token_budget x4->x5 update);
      21-RESEARCH.md §Pitfall 3 (vote-math breaks at N=5 — majority=ceil(N/2)+1,
      "3+ agree"/"All 4" patterns must become N-based prose).
    output_contract: >
      sgsd-ceo.md Step 4 updated:
      "Spawn 4 board members" -> "Spawn board members from config.deliberation.board"
      with defensive: if board.includes('researcher') -> also dispatch sgsd-board-researcher.
      synthesis_rules: add "Weight Researcher on library precedent: when library_coverage=confirmed,
      Researcher citation counts as supporting evidence for majority calculation."
      token_budget: update x4 reference to x5 (or "x board.length") and total accordingly.
      vote-math prose updated: "3+ agree" -> "majority (>N/2) agree", "All 4" -> "All members",
      "Split 2-2" -> "Split vote" — no hardcoded N=4 patterns remain.
    hypothesis: >
      Updating sgsd-ceo Step 4 to config-driven dispatch with a defensive researcher guard,
      fixing vote-math prose to use N-relative language, and adding Researcher weight to
      synthesis_rules ensures deliberation works correctly at N=5 without breaking N=4 fallback.
    falsifier: >
      grep -q 'Spawn 4' super-gsd/agents/sgsd-ceo.md exits 0 (hardcode still present), OR
      grep -q 'board.includes' super-gsd/agents/sgsd-ceo.md exits non-zero (guard missing), OR
      grep -q 'All 4 agree' super-gsd/agents/sgsd-ceo.md exits 0 (N=4 hardcode still present).
    stop_rule: >
      grep -q 'board.includes' super-gsd/agents/sgsd-ceo.md exits 0;
      grep -q 'Spawn 4' super-gsd/agents/sgsd-ceo.md exits non-zero;
      grep -q 'Weight Researcher' super-gsd/agents/sgsd-ceo.md exits 0.
    verification_cmd: "grep -q 'board.includes' super-gsd/agents/sgsd-ceo.md && grep -vq 'Spawn 4' super-gsd/agents/sgsd-ceo.md && grep -q 'Weight Researcher' super-gsd/agents/sgsd-ceo.md && echo PASS"
---

# Plan 21-04: sgsd-board-researcher Deliberation Voice

## Objective

Create sgsd-board-researcher.md from the board-architect scaffold, append "researcher" to
config.deliberation.board, and update sgsd-ceo Step 4 to config-driven dispatch with N-relative
vote-math and Researcher synthesis weight. Delivers VTPE-06.

## Context

@.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-CONTEXT.md
@.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-RESEARCH.md
@.planning/REQUIREMENTS.md
@.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-03-SUMMARY.md

Key files to read before executing:
- super-gsd/agents/sgsd-board-architect.md (copy scaffold)
- super-gsd/agents/sgsd-board-contrarian.md (adversarial voice pattern reference)
- super-gsd/agents/sgsd-ceo.md (Step 4 + synthesis_rules + token_budget full read)
- .planning/config.json (deliberation.board current state — Node read-mutate-write only)

## Execution Notes

- T1: Copy sgsd-board-architect.md verbatim then substitute: role paragraph, tools list
  (add 4 VTP MCP tools), temperament section (evidence-first/citation-driven), output_format
  (add library_coverage + citations[] fields). Do NOT change section headings or structure.
- T2: Node read-mutate-write only for config.json — no shell cat/echo/head
- T3: Read sgsd-ceo.md fully before editing. A2 assumption confirmed (prose-only vote-math)
  so string replace of "Spawn 4", "3+ agree", "All 4 agree", "Split 2-2" patterns is safe.
- D-06: researcher model = sonnet (consistency with other 4 board agents)
- Commit per task: feat(21-04/T1): VTPE-06 create sgsd-board-researcher agent

## Verification

```
grep -q 'mcp__vtp-kb__vtp_search' super-gsd/agents/sgsd-board-researcher.md
node -e "const c=require('./.planning/config.json'); if(c.deliberation&&c.deliberation.board&&c.deliberation.board.includes('researcher')) console.log('PASS'); else process.exit(1)"
grep -q 'board.includes' super-gsd/agents/sgsd-ceo.md
grep -q 'Weight Researcher' super-gsd/agents/sgsd-ceo.md
node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-04-board-researcher-PLAN.md --mode load
```

## Output

After completion write `.planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-04-SUMMARY.md`

---
phase: 13-governance
plan: 01
type: execute
wave: 2
depends_on: []
files_modified:
  - super-gsd/scripts/lib/vote-predicate.cjs
  - super-gsd/scripts/lib/board-registry.cjs
  - super-gsd/registry/board-members.yaml
  - super-gsd/skills/sgsd-deliberate/SKILL.md
  - .planning/phases/13-governance/plans/13-01-SUMMARY.md
autonomous: true
requirements:
  - GOV-01
  - GOV-04

schema_version: 2
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: 13-01-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/board-registry.cjs
    input_contract: |
      13-CONTEXT.md D-07 (board-registry.cjs exposes {loadBoard, getMember, resolveRoster}
      — cached singleton, ~50 LOC, mirror gates-registry.cjs).
      13-RESEARCH.md §Q1 shape — clone of `super-gsd/scripts/lib/gates-registry.cjs:38-95`:
        Process singleton (`let _cache = null`); `loadBoard(yamlPath)` parses via js-yaml
        loaded from `super-gsd/tools/plan-schema/node_modules/js-yaml` (Phase 10 pattern);
        returns `{members, byName, escalation_policy, default_minimal, always_present}`;
        `getMember(name, yamlPath)` throws on missing; `resolveRoster(brief, firstRoundResults)`
        with optional `firstRoundResults` — pre-round 1 returns minimal_2 + always_present;
        post-round 1 iterates `escalation_policy.escalate_add[]`, calls evalVotePredicate on
        each clause with {members, board} ctx, adds member when predicate returns true;
        `resetCache()` for test isolation.
      Depends on vote-predicate.cjs (13-01-02) via require — task ordered so 13-01-02 ships
      FIRST but this task (13-01-01) writes the require() line deferring to that module.
      DEFAULT_BOARD_PATH constant pointing at `super-gsd/registry/board-members.yaml`
      (path.resolve(__dirname, '..', '..', 'registry', 'board-members.yaml')).
      Invariant 4 from 13-RESEARCH.md §Q9: module exports {loadBoard, getMember, resolveRoster,
      resetCache} — all functions.
      Invariant 5: `resolveRoster(brief)` with no round-1 results returns exactly
      `default_minimal + always_present` (order-insensitive — verify as Set equality).
    output_contract: |
      `super-gsd/scripts/lib/board-registry.cjs` exists as a CJS module (~60 LOC with JSDoc),
      exports exactly `{loadBoard, getMember, resolveRoster, resetCache}`. Zero runtime deps
      beyond `fs`, `path`, the pinned js-yaml via createRequire, and `./vote-predicate.cjs`.
      `loadBoard` caches on first call (invariant 2 of the cache pattern — subsequent calls
      return `_cache` without re-parse).
      `getMember('sgsd-board-architect', ...)` returns the architect row; `getMember('nope', ...)`
      throws with "not in registry" in the message (D-10c loud-fail pattern).
      `resolveRoster(brief)` with no second arg returns Set equal to
      `[...reg.default_minimal, ...reg.always_present]` (order-insensitive).
      `resolveRoster(brief, firstRoundResults)` calls `evalVotePredicate(clause.trigger, {members: firstRoundResults, board: [...augmented]})`
      for each clause in `escalation_policy.escalate_add`; adds `clause.add` to augmented set
      when predicate returns true.
      DEFAULT_BOARD_PATH resolved at module load via path.resolve (NOT process.cwd()).
    hypothesis: |
      Direct pattern mirror of gates-registry.cjs (Phase 10 established, working in production)
      gives the lowest-risk implementation path. Cached singleton means O(1) reads from
      sgsd-deliberate SKILL.md iteration (critical for two-round escalation flow).
      resolveRoster's two-mode shape (no results = minimal; with results = augmented) cleanly
      separates first-round dispatch from escalation dispatch without duplicating loadBoard logic.
    falsifier: |
      (a) Module imports js-yaml via bare `require('js-yaml')` (package not at repo root —
      must use the resolved-path form per Phase 10 pattern).
      (b) `loadBoard` re-parses on every call (cache-once broken; observable: mock yaml.load
      and call loadBoard twice — counter should be 1).
      (c) `getMember('nonexistent-member', path)` returns undefined instead of throwing
      (D-10c violation).
      (d) `resolveRoster(brief)` with no firstRoundResults returns the FULL roster instead
      of minimal-2 + always-present (violates escalate-not-spawn semantics).
      (e) DEFAULT_BOARD_PATH uses process.cwd() — breaks when skill is invoked from a
      different working directory.
      (f) Module doesn't require './vote-predicate.cjs' (won't work when 13-01-02 ships).
    stop_rule: |
      File exists; with a temp fixture board-members.yaml containing both minimal board and
      escalate_add clauses, `loadBoard(tmpPath)` populates cache (second call counts 1 yaml.load),
      `getMember('sgsd-board-architect', tmpPath)` returns the row,
      `resolveRoster({some: 'brief'}, null)` returns a Set matching
      `new Set([...minimal, ...always_present])` (order-insensitive).
    verification_cmd: |
      node -e "const fs=require('fs');const path=require('path');const tmp='/tmp/btest.yaml';fs.writeFileSync(tmp,'schema_version: 2\\nboard_members:\\n  - name: sgsd-board-architect\\n    role: Architect\\n    state: active\\n  - name: sgsd-board-contrarian\\n    role: Contrarian\\n    state: active\\n  - name: sgsd-board-pragmatist\\n    role: Pragmatist\\n    state: active\\n  - name: sgsd-ceo\\n    role: CEO\\n    state: active\\nescalation_policy:\\n  default_minimal_board: [sgsd-board-architect, sgsd-board-contrarian]\\n  escalate_add: []\\n  always_present: [sgsd-ceo]\\n');const r=require('./super-gsd/scripts/lib/board-registry.cjs');r.resetCache();const reg=r.loadBoard(tmp);if(!reg.byName['sgsd-board-architect']){console.error('FAIL load');process.exit(1);}const m=r.getMember('sgsd-board-architect',tmp);if(m.name!=='sgsd-board-architect'){console.error('FAIL get');process.exit(2);}try{r.getMember('nope',tmp);console.error('FAIL throw');process.exit(3);}catch(e){}const roster=r.resolveRoster({},null);const set=new Set(roster);if(!set.has('sgsd-board-architect')||!set.has('sgsd-board-contrarian')||!set.has('sgsd-ceo')||set.size!==3){console.error('FAIL roster',[...set]);process.exit(4);}console.log('PASS');"
    verification_gates:
      - "loadBoard caches fixture → exit 0"
      - "getMember on existing member returns row → exit 0"
      - "getMember on missing throws (D-10c) → exit 0"
      - "resolveRoster returns minimal_2 + always_present set of 3 → exit 0"

  - id: 13-01-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/vote-predicate.cjs
    input_contract: |
      <policy_guard> resolution #2: NEW module `super-gsd/scripts/lib/vote-predicate.cjs`
      (do NOT extend Phase 10's predicate-eval.cjs — array iteration + per-member field access
      is a DIFFERENT semantic class; keeping them separate prevents Phase 10 contract drift).
      13-RESEARCH.md §Q2 recommended structured-clause form (chosen over string-parse per D-01
      preview reconciliation):
        ```yaml
        escalate_add:
          - add: sgsd-board-pragmatist
            when:
              any:
                - { over: members, where: { role: Contrarian, position: OPPOSE, confidence: { gte: 4 } } }
          - add: sgsd-board-moonshot
            when:
              all:
                - { count_unique: { over: members, field: position, eq: 1 } }
                - { size: { over: members, gte: 2 } }
        ```
      <policy_guard> resolution #1: structured clauses parsed by this module. The CONTEXT D-01
      string-expression form is a HUMAN-READABLE gloss (`trigger_prose:` optional) — the
      `trigger:` (or `when:`) field that the module actually parses is structured.
      API: `evalVotePredicate(clause, ctx) → bool` where ctx = `{members: BoardMemberResult[],
      board: string[]}`. Throws on unknown op / missing field (D-10c loud-fail).
      Supported ops:
        `any: [clause...]` — OR
        `all: [clause...]` — AND
        `over: <arrayName>, where: {field: value|op-obj}` — iterate members/board, test match
        `any-match` shorthand when used inside `any:`
        `count_unique: {over, field, eq}` — count distinct values
        `size: {over, gte|gt|lte|lt|eq}` — array length predicate
      Per-member field access via `where:` object — scalar values mean equality, `{gte: 4}` etc.
      for operators.
      Invariant 3 from 13-RESEARCH.md §Q9: every `escalate_add[].trigger` (or `when:`)
      structured-clause parses via this module without throwing, given sample ctx.
    output_contract: |
      `super-gsd/scripts/lib/vote-predicate.cjs` exists as a CJS module (~80 LOC with JSDoc).
      Exports exactly `{ evalVotePredicate }`. Zero runtime deps.
      Signature: `evalVotePredicate(clause, ctx) → bool`.
      Supports: `any`, `all`, `over`+`where`, `count_unique`, `size`.
      Within `where:`, scalar values mean equality; object values like `{gte: 4}`, `{lt: 3}`,
      `{in: [x,y]}` select operator. Ops: `eq, neq, gt, gte, lt, lte, in, not_in`.
      Unknown op OR missing ctx field → throws Error with "unknown op" or "missing" in message.
      Handles nested `any`/`all` recursively.
      Module does NOT require any other super-gsd module (pure).
    hypothesis: |
      Separating this from Phase 10's predicate-eval.cjs (scalar-ctx-only) per research
      §Q2 option-B avoids breaking gates.yaml triggers, while the ~80 LOC structured-clause
      evaluator is direct pattern-work with no architectural novelty. Choice of structured
      form (over string tokenizer) means verify.mjs can assert shape via YAML parse rather
      than tokenizer fragility.
    falsifier: |
      (a) File modifies `predicate-eval.cjs` directly instead of creating NEW module
      (<policy_guard> #2 violation).
      (b) `evalVotePredicate({any: [{over: 'members', where: {role: 'Contrarian',
      position: 'OPPOSE', confidence: {gte: 4}}}]}, {members: [{role: 'Contrarian',
      position: 'OPPOSE', confidence: 5}], board: []})` returns false (should be true —
      any-match found).
      (c) Unknown op (e.g., `weird_op: 5`) returns false/undefined silently — must throw.
      (d) Missing ctx array (e.g., `over: 'missing_array'`) returns false silently — must throw.
      (e) Module imports `./predicate-eval.cjs` — must stay independent per <policy_guard>
      resolution #2.
    stop_rule: |
      File exists; sample trigger from D-01 preview —
      `{any: [{over: 'members', where: {role: 'Contrarian', position: 'OPPOSE', confidence: {gte: 4}}}]}`
      — evaluates to true on a matching member and false on non-matching; unknown-op throws with
      "unknown op" in the error message.
    verification_cmd: |
      node -e "const p=require('./super-gsd/scripts/lib/vote-predicate.cjs');const c1={any:[{over:'members',where:{role:'Contrarian',position:'OPPOSE',confidence:{gte:4}}}]};const r1=p.evalVotePredicate(c1,{members:[{role:'Contrarian',position:'OPPOSE',confidence:5}],board:[]});if(r1!==true){console.error('FAIL match');process.exit(1);}const r2=p.evalVotePredicate(c1,{members:[{role:'Architect',position:'SUPPORT',confidence:5}],board:[]});if(r2!==false){console.error('FAIL nomatch');process.exit(2);}try{p.evalVotePredicate({weird_op:5},{members:[],board:[]});console.error('FAIL throw');process.exit(3);}catch(e){if(!/unknown|op/i.test(e.message)){console.error('FAIL msg',e.message);process.exit(4);}}const c3={all:[{count_unique:{over:'members',field:'position',eq:1}},{size:{over:'members',gte:2}}]};const r3=p.evalVotePredicate(c3,{members:[{position:'SUPPORT'},{position:'SUPPORT'}],board:[]});if(r3!==true){console.error('FAIL count_unique',r3);process.exit(5);}console.log('PASS');"
    verification_gates:
      - "any-with-match returns true → exit 0"
      - "any-without-match returns false → exit 0"
      - "unknown op throws (D-10c) → exit 0"
      - "count_unique + size composite returns true → exit 0"

  - id: 13-01-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/registry/board-members.yaml
    input_contract: |
      13-CONTEXT.md D-08a (board_version: v1-static → v2-runtime-resolved; members' state: draft
      → state: active, applies to all 5 rows: architect, contrarian, moonshot, pragmatist, ceo).
      D-01 escalation_policy activation — remove `state: proposed` scaffold line; replace
      English-prose `when:` strings with STRUCTURED clauses per 13-01-02's vote-predicate DSL.
      Example structured escalate_add:
        ```yaml
        escalate_add:
          - add: sgsd-board-pragmatist
            when:
              any:
                - over: members
                  where:
                    role: Contrarian
                    position: OPPOSE
                    confidence: {gte: 4}
            reason: execution-feasibility dissent
          - add: sgsd-board-moonshot
            when:
              all:
                - count_unique: {over: members, field: position, eq: 1}
                - size: {over: members, gte: 2}
            reason: consensus-risk (groupthink)
        ```
      Preserve existing comment blocks at top of file and custom_board_slots scaffolding.
      Invariants 1-3 from 13-RESEARCH.md §Q9: yaml parses valid; board_version ==
      v2-runtime-resolved; all board_members[].state == active; default_minimal_board list >=2;
      escalate_add list >=1; each escalate_add[].when parses via vote-predicate without throwing.
    output_contract: |
      `super-gsd/registry/board-members.yaml` updated:
      - `board_version: v2-runtime-resolved` (was v1-static)
      - Every `board_members[].state: active` (was draft × 5)
      - `escalation_policy.default_minimal_board` preserved as [sgsd-board-architect,
        sgsd-board-contrarian]
      - `escalation_policy.escalate_add` rewritten to structured form: 2 clauses
        (pragmatist on execution-feasibility dissent, moonshot on consensus-risk), each
        with `add:`, `when:` (structured), `reason:` prose gloss
      - `escalation_policy.always_present` preserved as [sgsd-ceo]
      - `escalation_policy.state: proposed` line REMOVED (the registry is now active,
        not proposed)
      - Optional `trigger_prose:` field on each escalate_add clause carrying the D-01
        original string expression as a human-readable gloss (does NOT need to parse)
      - `last_updated: 2026-04-22` (or current ISO date)
      Comments at top of file unchanged; schema_version: 2 unchanged; registry_version
      bumped to 2.1.0 (minor version — runtime activation).
    hypothesis: |
      Flipping state flags and rewriting the escalation DSL to the 13-01-02 structured form
      is a mechanical YAML edit. Keeping the CONTEXT D-01 string form as a `trigger_prose:`
      comment preserves operator readability while the `when:` field is the actual evaluated
      contract. Removing `state: proposed` on escalation_policy is safe because 13-01-02's
      module ships in this plan and board-registry will load this file directly from 13-01-01.
    falsifier: |
      (a) `board_version` still reads `v1-static`.
      (b) Any `state: draft` remains on a board_members entry.
      (c) escalate_add clauses are English strings (per CONTEXT D-01 preview) instead of
      structured — 13-01-02 vote-predicate cannot parse them, invariant 3 fails.
      (d) `default_minimal_board` has <2 entries (invariant 3 fails).
      (e) `escalate_add` has 0 entries (invariant 3 fails).
      (f) yaml.load fails (invariant 1 fails) due to indentation errors.
    stop_rule: |
      `node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');
      const fs=require('fs');const d=y.load(fs.readFileSync('super-gsd/registry/board-members.yaml','utf8'));
      console.log(d.board_version, d.board_members.every(m=>m.state==='active'));"`
      prints `v2-runtime-resolved true`. And every escalate_add clause's `when:` field parses
      via vote-predicate.cjs without throwing.
    verification_cmd: |
      node -e "const y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const fs=require('fs');const d=y.load(fs.readFileSync('super-gsd/registry/board-members.yaml','utf8'));if(d.board_version!=='v2-runtime-resolved'){console.error('FAIL version',d.board_version);process.exit(1);}if(!d.board_members.every(m=>m.state==='active')){console.error('FAIL state');process.exit(2);}if(!Array.isArray(d.escalation_policy.default_minimal_board)||d.escalation_policy.default_minimal_board.length<2){console.error('FAIL minimal');process.exit(3);}if(!Array.isArray(d.escalation_policy.escalate_add)||d.escalation_policy.escalate_add.length<1){console.error('FAIL escalate');process.exit(4);}const p=require('./super-gsd/scripts/lib/vote-predicate.cjs');for(const c of d.escalation_policy.escalate_add){try{p.evalVotePredicate(c.when||c.trigger,{members:[{role:'Contrarian',position:'OPPOSE',confidence:5}],board:[]});}catch(e){console.error('FAIL parse',c.add,e.message);process.exit(5);}}console.log('PASS');"
    verification_gates:
      - "board_version == v2-runtime-resolved → exit 0"
      - "all board_members state == active → exit 0"
      - "default_minimal_board >= 2 entries → exit 0"
      - "escalate_add >= 1 entries → exit 0"
      - "every escalate_add.when parses via vote-predicate without throw → exit 0"
    depends_on: [13-01-02]

  - id: 13-01-04
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-deliberate/SKILL.md
    input_contract: |
      13-CONTEXT.md D-08 (SKILL.md lines 103-112 — hardcoded Architect/Pragmatist/Contrarian/
      Moonshot Agent() dispatches — rewrite to iterate over `boardRegistry.resolveRoster(brief)`).
      13-RESEARCH.md §Q1 integration: insert new `<step_2_5_roster>` block between current
      Step 2 (Load Context, ends ~line 90) and Step 3 (Spawn Round 1, starts line 92).
      Step 3 rewrites the hardcoded 4 Agent() calls to a `for (const memberName of roster)
      Agent(...)` loop.
      Step 4 (Round 2 evaluation) adds `resolveRoster(brief, round1Results)` call before
      re-dispatch — escalation predicates now apply after round 1.
      Board members in roster come from the registry; prompt for each derived from
      `expertise_ref` field in board-members.yaml (referenced by name, loaded per-member
      at dispatch time).
      Invariant 15 from 13-RESEARCH.md §Q9: sgsd-deliberate/SKILL.md references
      `board-registry` (require or import line).
    output_contract: |
      `super-gsd/skills/sgsd-deliberate/SKILL.md` updated:
      - NEW `<step_2_5_roster>` block inserted between `</step_2_context>` and `<step_3_round1>`
        containing: header `## Step 2.5: Resolve Board Roster (GOV-04)`, a code example
        `const boardReg = require('super-gsd/scripts/lib/board-registry.cjs');
         const roster = boardReg.resolveRoster(brief);  // minimal_2 + always_present`,
        and explanatory text noting that Step 3 now iterates over `roster`.
      - `<step_3_round1>` block: existing 4 hardcoded `Agent(description: "...", ...)` calls
        REPLACED with a single `for (const memberName of roster) Agent(description: `${memberName} analysis`, ...)` loop
        pattern. Per-member prompt template still shows what fields each agent receives
        (BRIEF, PROJECT CONTEXT, etc.) but the agent count is no longer fixed.
      - `<step_4_round2>` block: BEFORE the "Round 2 (if needed)" re-spawn, insert
        `const augmentedRoster = boardReg.resolveRoster(brief, round1Results);`
        and rewrite the re-dispatch loop to iterate `augmentedRoster` instead of the hardcoded
        `Re-spawn all 4 with:`.
      Line 103-112 hardcoded block is REMOVED (replaced by the for-loop).
      Other steps (0, 0b, 1, 2, 5, 6) unchanged.
      Add anchor comment near top of <step_2_5_roster>: `<!-- board-registry GOV-04 D-08 -->`
      so invariant 15 has a deterministic grep target.
    hypothesis: |
      Three targeted edits (Step 2.5 insertion + Step 3 loop rewrite + Step 4 escalation call)
      is the minimal SKILL.md surface to activate GOV-01/GOV-04. Keeping all other steps
      untouched preserves Phase 10 gate-call sites and Phase 12 checkpoint behaviour.
      Board-registry `require()` in the skill is a conceptual reference (skills are prose; no
      literal Node execution from SKILL.md) but the invariant 15 grep passes because the
      require line appears as a CODE EXAMPLE within the Step 2.5 block.
    falsifier: |
      (a) Hardcoded 4 Agent() block at lines 103-112 still present after edit.
      (b) Step 2.5 XML tag missing or misspelled (`<step_2_5_roster>` expected).
      (c) Step 3 still lists 4 explicit per-archetype Agent() calls instead of a loop.
      (d) Step 4 doesn't call `resolveRoster(brief, round1Results)` (escalation dead).
      (e) SKILL.md missing the string `board-registry` (invariant 15 fails).
      (f) Existing <step_*> ordering broken (e.g., <step_3_round1> before <step_2_5_roster>).
    stop_rule: |
      `<step_2_5_roster>` XML tag present; literal string `board-registry` appears in file;
      `resolveRoster(brief, round1Results)` literal string appears; the substring
      "Agent(description: \"Architect analysis\"" (from the hardcoded block) is ABSENT
      (replaced by the loop form).
    verification_cmd: |
      grep -q "<step_2_5_roster>" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "board-registry" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "resolveRoster(brief, round1Results)" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      ! grep -q 'Agent(description: "Architect analysis"' super-gsd/skills/sgsd-deliberate/SKILL.md
    verification_gates:
      - "<step_2_5_roster> XML tag present → exit 0"
      - "'board-registry' referenced (invariant 15) → exit 0"
      - "resolveRoster(brief, round1Results) 2-arg call present → exit 0"
      - "hardcoded Architect Agent() string removed → exit 0"
    depends_on: [13-01-01, 13-01-03]

must_haves:
  truths:
    - "`vote-predicate.cjs` exports `evalVotePredicate(clause, ctx) → bool` with any/all/over/where/count_unique/size ops + loud unknown-op/missing-field throw"
    - "`board-registry.cjs` exports `{loadBoard, getMember, resolveRoster, resetCache}` — mirror of gates-registry.cjs cached-singleton pattern"
    - "`board-registry.resolveRoster(brief)` with no round-1 results returns default_minimal + always_present as a Set"
    - "`board-registry.resolveRoster(brief, round1Results)` evaluates each escalate_add.when via evalVotePredicate and augments the roster"
    - "`board-members.yaml` board_version = `v2-runtime-resolved`; all 5 members state = active"
    - "`board-members.yaml` escalation_policy.escalate_add has >=1 structured `when:` clauses that parse via vote-predicate.cjs"
    - "`sgsd-deliberate/SKILL.md` contains <step_2_5_roster> block before Step 3"
    - "`sgsd-deliberate/SKILL.md` Step 3 iterates over resolveRoster output instead of hardcoded 4 agents"
    - "`sgsd-deliberate/SKILL.md` Step 4 calls resolveRoster(brief, round1Results) before Round 2 re-dispatch"
    - "`sgsd-deliberate/SKILL.md` contains substring `board-registry` (invariant 15 anchor)"
  artifacts:
    - path: "super-gsd/scripts/lib/vote-predicate.cjs"
      provides: "Structured-clause array-predicate evaluator (NEW — separate from predicate-eval.cjs per <policy_guard>)"
      contains: "evalVotePredicate; any/all/over+where/count_unique/size ops; throws on unknown op or missing ctx field"
      min_lines: 60
    - path: "super-gsd/scripts/lib/board-registry.cjs"
      provides: "Cached YAML-load singleton for board members + resolveRoster"
      contains: "loadBoard, getMember, resolveRoster, resetCache; yaml via createRequire; requires ./vote-predicate.cjs"
      min_lines: 50
    - path: "super-gsd/registry/board-members.yaml"
      provides: "Activated board registry with structured escalation policy"
      contains: "board_version: v2-runtime-resolved; state: active × 5 members; escalation_policy.escalate_add structured when-clauses"
    - path: "super-gsd/skills/sgsd-deliberate/SKILL.md"
      provides: "Runtime-roster deliberation skill"
      contains: "<step_2_5_roster>; resolveRoster; resolveRoster(brief, round1Results); board-registry require reference"
  key_links:
    - from: "super-gsd/scripts/lib/board-registry.cjs"
      to: "super-gsd/scripts/lib/vote-predicate.cjs"
      via: "require('./vote-predicate.cjs')"
      pattern: "require\\(['\"]\\./vote-predicate\\.cjs['\"]\\)"
    - from: "super-gsd/scripts/lib/board-registry.cjs"
      to: "super-gsd/tools/plan-schema/node_modules/js-yaml"
      via: "path.resolve(__dirname,'..','..','tools','plan-schema','node_modules','js-yaml')"
      pattern: "plan-schema/node_modules/js-yaml"
    - from: "super-gsd/scripts/lib/board-registry.cjs"
      to: "super-gsd/registry/board-members.yaml"
      via: "DEFAULT_BOARD_PATH constant"
      pattern: "registry/board-members\\.yaml"
    - from: "super-gsd/skills/sgsd-deliberate/SKILL.md"
      to: "super-gsd/scripts/lib/board-registry.cjs"
      via: "<step_2_5_roster> code example: require('super-gsd/scripts/lib/board-registry.cjs')"
      pattern: "board-registry"
---

# Plan 13-01: Board Registry + Vote Predicate + Runtime Roster Resolution

## Objective

Ship the three lib modules + yaml activation + SKILL.md integration that turn the deliberate
skill's board from a hardcoded 4-agent block into a runtime-resolved roster with structured
escalation predicates. Adds the NEW `vote-predicate.cjs` module (separate from Phase 10's
`predicate-eval.cjs` per <policy_guard> resolution #2 — array iteration + per-member field
access is a different semantic class and must not contaminate Phase 10's gates.yaml evaluator).

Purpose: Satisfies **GOV-01** (escalate-not-spawn board with structured `board-members.yaml#escalation_policy`
predicates evaluated at runtime) and **GOV-04** (runtime roster resolution via board-registry
instead of hardcoded Agent() calls at SKILL.md lines 103-112).

Output: 4 files — 2 new lib modules (~140 LOC total), board-members.yaml activation (state
flips + structured escalate_add clauses), and sgsd-deliberate SKILL.md 3-edit integration
(Step 2.5 insertion, Step 3 loop, Step 4 escalation call).

Wave 2 — serial after Wave 1 {13-04, 13-05}. Blocks all downstream waves (13-02 needs
board-registry in-place before integrating vote-synthesis at SKILL.md Step 5; 13-03 needs
the roster iteration before adjusting per-agent response format; 13-06 retro rescore fans
out via roster).

## Tasks

Task breakdown follows 13-VALIDATION.md tasks 13-01-01 through 13-01-04. All contracts,
hypotheses, falsifiers, stop rules live in the frontmatter above — canonical executor contract.

### 13-01-01 — `board-registry.cjs`

Mirror of gates-registry.cjs. Process singleton, `loadBoard(yamlPath)` caches on first call,
exports `{loadBoard, getMember, resolveRoster, resetCache}`. `resolveRoster` has two modes:
pre-round 1 returns `default_minimal + always_present`; post-round 1 iterates
`escalation_policy.escalate_add[]` and calls `evalVotePredicate` on each clause's `when:`
field. DEFAULT_BOARD_PATH computed via path.resolve (NOT process.cwd). Requires
`./vote-predicate.cjs` (shipped in 13-01-02 — executor must order tasks so 13-01-02's module
is present before this task's verification_cmd).

Note: tasks 13-01-01 and 13-01-02 have no mutual depends_on in frontmatter because they
touch different files. Executor may run them in either order; the verification_cmd for
13-01-01 doesn't exercise the escalation path (only minimal-roster mode) so it passes even
without vote-predicate present. The full integration verification (invariant 3 + invariant 5)
lives in plan 13-07's verify.mjs.

### 13-01-02 — `vote-predicate.cjs` (NEW, separate from predicate-eval.cjs)

Structured-clause evaluator for the board-members.yaml escalation DSL. ~80 LOC. Ops:
`any`, `all`, `over`+`where`, `count_unique`, `size`. Within `where:`, scalar values mean
equality; object values like `{gte: 4}` select operator. Throws on unknown op or missing
ctx field. Pure — no requires of other super-gsd modules. Chosen structured form over
CONTEXT D-01's string-expression form per research §Q2 option-B (validator-friendly,
no tokenizer fragility); the CONTEXT string form survives as optional `trigger_prose:`
gloss per <policy_guard> resolution #1.

### 13-01-03 — Activate `board-members.yaml`

Flip `board_version: v1-static` → `v2-runtime-resolved`. Flip every board_members[].state
from `draft` to `active`. Rewrite `escalation_policy.escalate_add` from English-prose
`when:` strings to structured clauses per 13-01-02's DSL (2 clauses: pragmatist on
execution-feasibility dissent, moonshot on consensus-risk). Preserve D-01 string form
as `trigger_prose:` comment per <policy_guard> #1. Remove `state: proposed` from the
policy (registry is now live). Bump `registry_version: 2.1.0`. Top-of-file comments and
`custom_board_slots: []` preserved.

### 13-01-04 — SKILL.md Runtime Roster Integration

Insert new `<step_2_5_roster>` block between `</step_2_context>` and `<step_3_round1>`
showing the board-registry require + resolveRoster pre-round 1 call. Replace Step 3's
hardcoded 4 Agent() calls with a `for (const memberName of roster) Agent(...)` loop form.
In Step 4, add `resolveRoster(brief, round1Results)` before the Round 2 re-dispatch so
escalation predicates apply. Anchor comment `<!-- board-registry GOV-04 D-08 -->` inside
Step 2.5 for invariant 15's grep target.

## Verification Gates (Wave close)

Run in sequence:

1. `node -e "..."` board-registry sanity (fixture load + getMember + resolveRoster minimal) → PASS
2. `node -e "..."` vote-predicate sanity (any-match, non-match, throw on unknown op, count_unique) → PASS
3. `node -e "..."` board-members.yaml shape (v2-runtime-resolved, state active, escalate_add parses) → PASS
4. `<step_2_5_roster>` + `board-registry` + 2-arg resolveRoster references in sgsd-deliberate SKILL.md → all grep exit 0
5. Hardcoded "Architect analysis" Agent() string absent from SKILL.md → `! grep -q` exit 0

## Success Criteria

- All 4 files exist at declared paths.
- All 4 task verification_cmds exit 0.
- Invariants 1, 2, 3, 4, 5, 15 in Phase 13 verify.mjs go GREEN after this plan's commits land.
- Phase 10 gates.yaml and predicate-eval.cjs are UNTOUCHED (<policy_guard> #2 preservation).

## Output

After completion, create `.planning/phases/13-governance/plans/13-01-SUMMARY.md` summarising:
- 4 files created/modified (LOC counts: vote-predicate ~80, board-registry ~60, board-members.yaml +15 lines, SKILL.md ~+40 lines)
- Which invariants (1-5, 15) turn green
- 4 commit SHAs (one per task)
- Confirmation that predicate-eval.cjs was NOT modified (<policy_guard> #2 compliance)

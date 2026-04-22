---
phase: 13-governance
plan: 03
type: execute
wave: 4
depends_on:
  - 13-02
files_modified:
  - super-gsd/agents/sgsd-board-architect.md
  - super-gsd/agents/sgsd-board-contrarian.md
  - super-gsd/agents/sgsd-board-moonshot.md
  - super-gsd/agents/sgsd-board-pragmatist.md
  - super-gsd/scripts/lib/deliberation-schema.cjs
  - super-gsd/skills/sgsd-deliberate/SKILL.md
  - .planning/phases/13-governance/plans/13-03-SUMMARY.md
autonomous: true
requirements:
  - GOV-03
  - GOV-06
  - GOV-07

schema_version: 2
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: 13-03-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/agents/sgsd-board-architect.md
      - super-gsd/agents/sgsd-board-contrarian.md
      - super-gsd/agents/sgsd-board-moonshot.md
      - super-gsd/agents/sgsd-board-pragmatist.md
    input_contract: |
      13-CONTEXT.md D-12 (10-field YAML schema for board member responses):
        position: SUPPORT | OPPOSE | ABSTAIN
        confidence: 1 | 2 | 3 | 4 | 5
        risks_raised: [list]
        evidence_cited: [list]
        falsifier: "what would prove my position wrong"
        implementation_concerns: [list]
        known_deadends: [list]
        intuition: "gut read, even without formal evidence"
        why_principled: "the core principle anchoring my position"
        rationale: "prose — why I vote this way, in context"
      D-12a: Each of the 4 board agent files (super-gsd/agents/sgsd-board-*.md) updates its
      output-format section to require this YAML schema. Archetype-specific content hints
      preserved (e.g., Architect emphasises technical risk in `risks_raised`, Contrarian
      emphasises blind-spot discovery in `known_deadends`) — but the SCHEMA is identical
      across all 4.
      Response must be a single YAML block (no markdown fences, no prose wrapper) so the
      CEO parser (deliberation-schema.cjs validate()) can load it directly.
      Invariant 9 from 13-RESEARCH.md §Q9: each of 4 agent files contains all 10 required
      YAML field names.
    output_contract: |
      All 4 files `super-gsd/agents/sgsd-board-{architect,contrarian,moonshot,pragmatist}.md`
      updated:
      - Each file has an `## Output Format` or `## Response Format` section (or renamed if
        existing section differs) containing an EXAMPLE YAML block listing all 10 required
        fields with archetype-appropriate placeholder content.
      - Each file has a prose line: "Emit EXACTLY one YAML block. No markdown fences.
        No prose wrapper. Malformed output will be rejected by deliberation-schema.cjs."
      - Archetype-specific prompt guidance preserved (Architect: feasibility/risk/cost;
        Contrarian: blind-spots/stress-tests; Moonshot: 10x/scope-challenge;
        Pragmatist: execution/resource/timeline).
      Each file MUST contain literally all 10 field names as grep targets:
      `position`, `confidence`, `risks_raised`, `evidence_cited`, `falsifier`,
      `implementation_concerns`, `known_deadends`, `intuition`, `why_principled`, `rationale`.
    hypothesis: |
      Updating 4 agent files in lockstep (same schema, archetype-specific hints) is a
      mechanical paste-and-customize. Single-task scope because the 4 files are independent
      of each other and only share the schema — keeping them in one task ensures they ship
      together (invariant 9 requires ALL 4 to match).
    falsifier: |
      (a) Any of the 4 files missing any of the 10 required field names (grep fails → invariant 9
      fails per-file).
      (b) Files include markdown-fenced YAML (```yaml) — the parser in 13-03-02 strips single
      blocks; fences cause fragility. Prose line must explicitly forbid fences.
      (c) Archetype-specific guidance lost (e.g., Architect file reads identically to Contrarian —
      archetype distinctiveness is why we have 4 agents).
      (d) Fewer than 4 files updated.
    stop_rule: |
      All 4 files grep-pass all 10 field names; all 4 files contain the string "No markdown fences"
      or equivalent fence-forbidding instruction; each file contains its archetype role name
      (Architect/Contrarian/Moonshot/Pragmatist) at least once (sanity check that customization
      was preserved).
    verification_cmd: |
      for f in super-gsd/agents/sgsd-board-architect.md super-gsd/agents/sgsd-board-contrarian.md super-gsd/agents/sgsd-board-moonshot.md super-gsd/agents/sgsd-board-pragmatist.md; do for field in position confidence risks_raised evidence_cited falsifier implementation_concerns known_deadends intuition why_principled rationale; do grep -q "$field" "$f" || { echo "FAIL $f missing $field"; exit 1; }; done; grep -qi "no markdown fences\|no fences\|no code fences" "$f" || { echo "FAIL $f missing fence prohibition"; exit 2; }; done; echo PASS
    verification_gates:
      - "all 4 board agent files contain all 10 required YAML field names → exit 0"
      - "all 4 files explicitly forbid markdown fences → exit 0"

  - id: 13-03-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/deliberation-schema.cjs
    input_contract: |
      13-CONTEXT.md D-13 (deliberation-schema.cjs validates parsed YAML; malformed fails
      loudly per Phase 10 D-10c; CEO halts and requests re-emit).
      13-RESEARCH.md §Q4 reference implementation — clone ~50 LOC:
        - require js-yaml via path.resolve to super-gsd/tools/plan-schema/node_modules/js-yaml
        - REQUIRED_FIELDS const list of all 10 per D-12
        - POSITION_VALUES = ['SUPPORT', 'OPPOSE', 'ABSTAIN']
        - validate(yamlBody) → {valid, errors: [strings], parsed}
          * parse error → {valid: false, errors: [`YAML parse error: ...`]}
          * non-object root → {valid: false, errors: ['root must be a map']}
          * for each required field missing → push error
          * position not in POSITION_VALUES → error
          * confidence not integer 1-5 → error
          * any list-typed field not Array → error
        - module.exports = { validate, REQUIRED_FIELDS }
      Invariant 8 from 13-RESEARCH.md §Q9: validate() on 10-field fixture → valid:true;
      on missing-falsifier fixture → valid:false with specific error string including "falsifier".
    output_contract: |
      `super-gsd/scripts/lib/deliberation-schema.cjs` exists as a CJS module (~50-60 LOC
      with JSDoc). Exports exactly `{ validate, REQUIRED_FIELDS }`.
      `REQUIRED_FIELDS` is a frozen array with exactly the 10 field names from D-12 in
      stable order.
      `validate(yamlBody: string)` returns `{valid: boolean, errors: string[], parsed?: object}`.
      - Returns `{valid: true, errors: [], parsed: <obj>}` on a fully-compliant YAML body.
      - Returns `{valid: false, errors: [...], parsed?: <obj>}` when any field missing / wrong type.
      - YAML parse errors → `{valid: false, errors: ['YAML parse error: ...']}` with no parsed.
      - Uses js-yaml via the Phase 10 createRequire pattern (NOT bare `require('js-yaml')`).
      - Each error string begins with the field name or "YAML" so tests can grep.
    hypothesis: |
      Direct transcription of research §Q4 reference. Mirrors gates-registry.cjs's js-yaml
      loading pattern. The fail-loud-with-specific-errors design gives CEO retry prompts
      actionable feedback per D-13 retry-once-then-escalate loop.
    falsifier: |
      (a) Module uses bare `require('js-yaml')` (package not at repo root; would fail).
      (b) REQUIRED_FIELDS has fewer or more than 10 entries.
      (c) Malformed-YAML fixture returns `{valid: true}` (silent parse swallow).
      (d) Missing `falsifier` field doesn't produce an error containing "falsifier" (CEO
      retry prompt can't cite the specific missing field).
      (e) `confidence: 6` passes validation (range check broken).
      (f) `position: 'MAYBE'` passes validation (enum check broken).
    stop_rule: |
      validate on 10-field valid YAML returns `valid: true`; validate on YAML missing
      `falsifier` returns `valid: false` with an error string containing "falsifier";
      validate on `confidence: 9` returns `valid: false`; validate on
      `position: WEIRD` returns `valid: false`.
    verification_cmd: |
      node -e "const v=require('./super-gsd/scripts/lib/deliberation-schema.cjs');const good='position: SUPPORT\\nconfidence: 3\\nrisks_raised: [risk1]\\nevidence_cited: [ev1]\\nfalsifier: would prove wrong\\nimplementation_concerns: [conc1]\\nknown_deadends: [dead1]\\nintuition: gut\\nwhy_principled: principle\\nrationale: because';const g=v.validate(good);if(!g.valid){console.error('FAIL valid',g.errors);process.exit(1);}const bad='position: SUPPORT\\nconfidence: 3\\nrisks_raised: [r]\\nevidence_cited: [e]\\nimplementation_concerns: [c]\\nknown_deadends: [d]\\nintuition: i\\nwhy_principled: w\\nrationale: r';const b=v.validate(bad);if(b.valid){console.error('FAIL missing');process.exit(2);}if(!b.errors.some(e=>/falsifier/.test(e))){console.error('FAIL no falsifier err',b.errors);process.exit(3);}if(!Array.isArray(v.REQUIRED_FIELDS)||v.REQUIRED_FIELDS.length!==10){console.error('FAIL fields',v.REQUIRED_FIELDS);process.exit(4);}console.log('PASS');"
    verification_gates:
      - "valid 10-field YAML → valid:true → exit 0"
      - "missing-falsifier → valid:false with 'falsifier' in errors → exit 0"
      - "REQUIRED_FIELDS has exactly 10 entries → exit 0"

  - id: 13-03-03
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/deliberation-schema.cjs
    input_contract: |
      13-CONTEXT.md D-13 + 13-RESEARCH.md §Q4 (additional malformed reject cases beyond 13-03-02's
      missing-field test — exhaustive enum/range/type coverage).
      Reject cases to prove:
      - position value outside SUPPORT|OPPOSE|ABSTAIN (e.g., 'MAYBE')
      - confidence outside 1-5 (0, 6, -1, 3.5, 'three')
      - risks_raised passed as string instead of array
      - evidence_cited passed as object instead of array
      - YAML parse error (malformed indentation)
      All above → `valid: false` with a specific error string citing the offending field/reason.
      This task EXTENDS 13-03-02's module with additional validation branches IF any reject case
      is not already handled; otherwise the module is correct from 13-03-02 and this task is a
      verification-only commit (similar to 13-02-02 pattern).
    output_contract: |
      `super-gsd/scripts/lib/deliberation-schema.cjs` handles all enumerated reject cases
      above. Either (a) module unchanged from 13-03-02 because all branches already handled,
      with this task committing a JSDoc tweak acknowledging the test coverage, OR (b) module
      gains branches (e.g., confidence non-integer check, list-type enforcement) that it
      was missing.
      Module LOC stays <70 total. No runtime deps beyond js-yaml.
    hypothesis: |
      Splitting the reject path from the accept path keeps each task's verification narrowly
      focused — 13-03-02 proved the happy-path + single missing-field; this task proves all
      other malformation classes. If 13-03-02 already exhaustively handles them, this is a
      verification-only task (still commits to keep atomicity).
    falsifier: |
      (a) Any reject fixture returns `valid: true`.
      (b) Error messages for invalid position/confidence don't cite the specific field name
      (CEO retry prompt lacks actionable feedback).
      (c) YAML parse error returns valid:true with parsed being undefined (silent swallow).
    stop_rule: |
      All 5 reject fixtures (bad position, bad confidence, wrong-type risks, wrong-type
      evidence, malformed YAML) return `valid: false`, each with an error string containing
      the offending field name or "YAML".
    verification_cmd: |
      node -e "const v=require('./super-gsd/scripts/lib/deliberation-schema.cjs');const base='position: SUPPORT\\nconfidence: 3\\nrisks_raised: [r]\\nevidence_cited: [e]\\nfalsifier: f\\nimplementation_concerns: [c]\\nknown_deadends: [d]\\nintuition: i\\nwhy_principled: w\\nrationale: r';const badpos=v.validate(base.replace('SUPPORT','MAYBE'));if(badpos.valid){console.error('FAIL pos');process.exit(1);}if(!badpos.errors.some(e=>/position/.test(e))){console.error('FAIL pos err');process.exit(2);}const badconf=v.validate(base.replace('confidence: 3','confidence: 9'));if(badconf.valid){console.error('FAIL conf');process.exit(3);}if(!badconf.errors.some(e=>/confidence/.test(e))){console.error('FAIL conf err');process.exit(4);}const badtype=v.validate(base.replace('risks_raised: [r]','risks_raised: justastring'));if(badtype.valid){console.error('FAIL type');process.exit(5);}const parseErr=v.validate('this: is\\n  not: valid\\nyaml:\\n-\\nbad:indent');/* malformed — either parses permissively or throws */if(parseErr.valid&&(!parseErr.parsed||typeof parseErr.parsed!=='object')){console.error('FAIL parse');process.exit(6);}console.log('PASS');"
    verification_gates:
      - "invalid position → valid:false with 'position' in errors → exit 0"
      - "confidence out of range → valid:false with 'confidence' in errors → exit 0"
      - "wrong-type list field → valid:false → exit 0"
    depends_on: [13-03-02]

  - id: 13-03-04
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-deliberate/SKILL.md
    input_contract: |
      13-CONTEXT.md D-13 (CEO synthesis halts on malformed; retry-once-then-escalate per
      research §Q4).
      13-RESEARCH.md §Q4 retry flow — insert into sgsd-deliberate SKILL.md Step 3 (first-round
      collection) and Step 4 (second-round re-collection) right after the Agent() dispatch
      returns each response:
        ```
        const deliberationSchema = require('super-gsd/scripts/lib/deliberation-schema.cjs');
        const { valid, errors, parsed } = deliberationSchema.validate(agentResponse);
        if (!valid) {
          // Retry once with explicit schema reminder
          const retry = Agent(memberName, { prefix: `Previous response failed schema: ${errors.join('; ')}. Re-emit as valid YAML matching ALL 10 required fields. NO prose wrapper, NO markdown fences.` });
          const retryResult = deliberationSchema.validate(retry);
          if (!retryResult.valid) throw new Error(`Board member '${memberName}' malformed after retry: ${retryResult.errors.join('; ')}`);
          return retryResult.parsed;
        }
        return parsed;
        ```
      Plus: BEFORE CEO proceeds to synthesize (<step_5_synthesize>), all collected responses
      must be parsed objects from validate() — prose/string responses are no longer acceptable.
      This also means the existing Step 4 "Round 2 evaluation" prose that reads "3+ agree"
      etc. now references `member.position` field access on the parsed objects, not
      prose-pattern matching.
      Invariant 15 from 13-RESEARCH.md §Q9: sgsd-deliberate/SKILL.md references
      `deliberation-schema`.
    output_contract: |
      `super-gsd/skills/sgsd-deliberate/SKILL.md` updated:
      - `<step_3_round1>` (for-loop body from 13-01-04) extended with a code example showing
        validate() + retry-once pattern after each Agent() return.
      - `<step_4_round2>` "Evaluate Need for Round 2" prose updated to reference
        `member.position === 'OPPOSE'` style field access instead of prose-pattern matching
        for the 3+ agree / split 2-2 / all 4 agree heuristics.
      - `<step_4_round2>` re-dispatch loop includes the same validate + retry pattern.
      - `<step_5_synthesize>` opens with: "All `round1Results` and `round2Results` are
        parsed-objects already (validated in Steps 3 and 4). The synthesize call below
        takes these objects directly."
      - Rubric-driven synthesis instruction added to Step 5 (D-12a): CEO aggregates each
        of the 10 fields across members into the memo rather than paraphrasing prose. E.g.,
        "Collect all `risks_raised` across members into memo's `## Risks Acknowledged`;
         collect all `known_deadends` into memo's `## Dead Ends / Paths Ruled Out` section;
         the UNION of each member's `falsifier` seeds memo's `## Falsifier` section."
      - Literal string `deliberation-schema` appears in the file (invariant 15 anchor).
      All prior-plan edits preserved: <step_2_5_roster> (13-01), vote-synthesis + Tiebreak
      Rationale (13-02), the for-loop roster iteration (13-01).
    hypothesis: |
      Rubric-driven synthesis is the payoff of the 10-field schema — the CEO stops
      paraphrasing and starts aggregating typed fields into typed memo sections. The retry-once
      pattern keeps the failure mode bounded (one re-emit attempt, then hard fail with
      BLOCKER) per Phase 10 D-10c loud-fail discipline.
      This task ALSO absorbs the ex-13-04-03 CEO-rubric integration (per the 6-wave
      split-13-04 wave decision documented in the Phase 13 planning log).
    falsifier: |
      (a) File missing `deliberation-schema` string (invariant 15 fails).
      (b) Step 3 or Step 4 doesn't call validate() on Agent returns (malformed responses flow
      through silently).
      (c) Step 5 still reads responses as prose — rubric-driven synthesis not wired.
      (d) Step 5 doesn't instruct "collect falsifier across members into memo ## Falsifier"
      (GOV-03/GOV-06 payoff missing — the template extensions from 13-04 have no population path).
      (e) Any 13-01 or 13-02 edit removed (<step_2_5_roster>, vote-synthesis require,
      signed_sum, Tiebreak Rationale).
    stop_rule: |
      All 3 anchors present: `deliberation-schema`, `member.position` field access,
      rubric-aggregation instruction (grep `Collect all` or `union of` or
      `aggregate`). All 13-01/13-02 preservation anchors still present.
    verification_cmd: |
      grep -q "deliberation-schema" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "member.position" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -qE "Collect all|aggregate|union of" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "<step_2_5_roster>" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "vote-synthesis" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "signed_sum" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "Tiebreak Rationale" super-gsd/skills/sgsd-deliberate/SKILL.md
    verification_gates:
      - "'deliberation-schema' anchor (invariant 15) → exit 0"
      - "member.position field access → exit 0"
      - "rubric-aggregation instruction → exit 0"
      - "13-01 <step_2_5_roster> preserved → exit 0"
      - "13-02 vote-synthesis + signed_sum + Tiebreak Rationale preserved → exit 0"
    depends_on: [13-03-01, 13-03-02]

  - id: 13-03-05
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/skills/sgsd-deliberate/SKILL.md
    input_contract: |
      13-CONTEXT.md D-06a + D-14/D-14a — CEO memo-gen rubric MUST produce:
      - `## Falsifier` section (populated from aggregated member `falsifier` fields)
      - `## Dead Ends / Paths Ruled Out` section (aggregated from member `known_deadends`)
      - `## Post-Synthesis Reflection` section (CEO reflection pass, in-context, no new Agent())
      The template `super-gsd/templates/decision-memo.md` already has these section headers
      from plan 13-04. This task wires the POPULATION path — the rubric that tells CEO
      how to fill them from the 10-field member responses + the reflection prompt.
      This task ABSORBS the ex-13-04-03 "SKILL.md rubric update" item per the 6-wave
      split-13-04 wave decision. Without this, plan 13-04's template sections exist but stay
      empty in every future DLB memo.
      D-14 reflection prompt verbatim: "Review your synthesis. What blind spots did this
      deliberation have? What archetype voices might we have missed? What did the rubric
      force to the foreground that might NOT matter?"
      D-14a: reflection is SAME CEO context, NOT a new Agent() dispatch.
    output_contract: |
      `super-gsd/skills/sgsd-deliberate/SKILL.md` `<step_5_synthesize>` block extended with
      explicit rubric instructions for populating the three new memo sections:
      - Falsifier section: "Synthesize each member's `falsifier` field into one 2-3 sentence
        paragraph. If members' falsifiers conflict, list both and note the conflict."
      - Dead Ends section: "List each unique entry from member `known_deadends` fields as a
        bullet with attribution (e.g., '- {deadend} (raised by {role})')."
      - Post-Synthesis Reflection section: After writing all other memo sections, CEO runs
        an in-context reflection pass using the D-14 prompt verbatim. Output goes into
        `## Post-Synthesis Reflection` footer section. NOT a new Agent() dispatch.
      - Rubric also instructs CEO: if `tiebreaker_applied === true`, the `## Tiebreak
        Rationale` section (from 13-02) sits between Board Stances and Unresolved Tensions.
      All prior anchors preserved. File final LOC should be around +30 lines over 13-03-04.
    hypothesis: |
      Without this task, plan 13-04's template sections exist but stay empty in future DLB
      memos. The rubric is the ONLY population path from structured member responses to
      structured memo sections. Keeping the reflection pass in-context (D-14a — same CEO,
      no Agent() dispatch) costs ~200 tokens and eliminates a retry surface.
    falsifier: |
      (a) Step 5 rubric doesn't instruct filling `## Falsifier` from member.falsifier fields.
      (b) Step 5 rubric doesn't instruct filling `## Dead Ends` from member.known_deadends.
      (c) Step 5 rubric doesn't include the D-14 reflection prompt verbatim or equivalent
      (must mention "blind spots" phrase per 13-04-02 placeholder invariant).
      (d) Reflection is suggested as a new Agent() dispatch (violates D-14a in-context rule).
      (e) Any prior anchor removed.
    stop_rule: |
      Step 5 block contains the substrings: `## Falsifier`, `## Dead Ends`,
      `## Post-Synthesis Reflection`, `blind spots`, `member.falsifier` or
      `member.known_deadends`. All prior 13-01/13-02/13-03-04 anchors present.
    verification_cmd: |
      grep -q "## Falsifier" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "## Dead Ends" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "## Post-Synthesis Reflection" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "blind spots" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -qE "member\.falsifier|member\.known_deadends|members.*falsifier" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "deliberation-schema" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "vote-synthesis" super-gsd/skills/sgsd-deliberate/SKILL.md && \
      grep -q "<step_2_5_roster>" super-gsd/skills/sgsd-deliberate/SKILL.md
    verification_gates:
      - "Step 5 rubric instructs ## Falsifier population → exit 0"
      - "Step 5 rubric instructs ## Dead Ends population → exit 0"
      - "Step 5 rubric includes ## Post-Synthesis Reflection + 'blind spots' D-14 prompt → exit 0"
      - "member.falsifier OR member.known_deadends field-access reference → exit 0"
      - "all prior plan anchors preserved → exit 0"
    depends_on: [13-03-04]

must_haves:
  truths:
    - "All 4 super-gsd/agents/sgsd-board-*.md files contain all 10 D-12 YAML field names"
    - "All 4 agent files explicitly forbid markdown fences in response output"
    - "Archetype-specific guidance preserved in each agent file (Architect/Contrarian/Moonshot/Pragmatist distinct)"
    - "`deliberation-schema.cjs` exports `{validate, REQUIRED_FIELDS}`; REQUIRED_FIELDS has exactly 10 entries"
    - "`validate(goodYaml)` returns `{valid:true, errors:[], parsed:<obj>}`"
    - "`validate(yaml missing falsifier)` returns `{valid:false, errors:[...'falsifier'...]}`"
    - "`validate()` rejects invalid position, confidence out-of-range, wrong-typed list fields, YAML parse errors"
    - "sgsd-deliberate SKILL.md Step 3 + Step 4 call validate() + retry-once on each Agent return"
    - "sgsd-deliberate SKILL.md Step 5 is rubric-driven: aggregates member fields into memo sections"
    - "sgsd-deliberate SKILL.md Step 5 instructs CEO to populate ## Falsifier from member.falsifier fields"
    - "sgsd-deliberate SKILL.md Step 5 instructs CEO to populate ## Dead Ends from member.known_deadends fields"
    - "sgsd-deliberate SKILL.md Step 5 includes ## Post-Synthesis Reflection instruction with D-14 'blind spots' prompt (in-context, no new Agent)"
    - "sgsd-deliberate SKILL.md references `deliberation-schema` (invariant 15 anchor)"
    - "All prior plan anchors preserved: <step_2_5_roster>, board-registry, vote-synthesis, signed_sum, Tiebreak Rationale"
  artifacts:
    - path: "super-gsd/agents/sgsd-board-architect.md"
      provides: "Architect response schema with 10-field YAML + archetype-specific focus"
      contains: "position, confidence, risks_raised, evidence_cited, falsifier, implementation_concerns, known_deadends, intuition, why_principled, rationale; no-fences instruction"
    - path: "super-gsd/agents/sgsd-board-contrarian.md"
      provides: "Contrarian response schema with 10-field YAML"
      contains: "all 10 field names; no-fences instruction; blind-spot focus preserved"
    - path: "super-gsd/agents/sgsd-board-moonshot.md"
      provides: "Moonshot response schema with 10-field YAML"
      contains: "all 10 field names; no-fences instruction; 10x/scope-challenge focus preserved"
    - path: "super-gsd/agents/sgsd-board-pragmatist.md"
      provides: "Pragmatist response schema with 10-field YAML"
      contains: "all 10 field names; no-fences instruction; execution/timeline focus preserved"
    - path: "super-gsd/scripts/lib/deliberation-schema.cjs"
      provides: "10-field YAML validator with fail-loud specific error strings"
      contains: "validate, REQUIRED_FIELDS; js-yaml via createRequire; position/confidence/list-type/YAML-parse checks"
      min_lines: 50
    - path: "super-gsd/skills/sgsd-deliberate/SKILL.md"
      provides: "Schema-validated + rubric-driven + reflection-capable deliberate skill"
      contains: "deliberation-schema require; validate+retry in Steps 3/4; rubric-driven Step 5 aggregating member fields into ## Falsifier + ## Dead Ends + ## Post-Synthesis Reflection"
  key_links:
    - from: "super-gsd/scripts/lib/deliberation-schema.cjs"
      to: "super-gsd/tools/plan-schema/node_modules/js-yaml"
      via: "path.resolve(__dirname,'..','..','tools','plan-schema','node_modules','js-yaml')"
      pattern: "plan-schema/node_modules/js-yaml"
    - from: "super-gsd/skills/sgsd-deliberate/SKILL.md"
      to: "super-gsd/scripts/lib/deliberation-schema.cjs"
      via: "Step 3/4 code example: require('super-gsd/scripts/lib/deliberation-schema.cjs')"
      pattern: "deliberation-schema"
    - from: "super-gsd/skills/sgsd-deliberate/SKILL.md"
      to: "super-gsd/templates/decision-memo.md"
      via: "Step 5 rubric references template section headers populated by CEO"
      pattern: "## Falsifier|## Dead Ends|## Post-Synthesis Reflection"
---

# Plan 13-03: Structured YAML Responses + Validator + Rubric-Driven Synthesis

## Objective

Migrate the 4 board agent response formats to the D-12 10-field YAML schema, ship the
`deliberation-schema.cjs` validator with retry-once-on-malformed semantics, and rewrite
`sgsd-deliberate/SKILL.md` Step 5 as a rubric-driven synthesis that aggregates typed member
fields into typed memo sections — including population of the three new memo sections
(`## Falsifier`, `## Dead Ends / Paths Ruled Out`, `## Post-Synthesis Reflection`) that plan
13-04 added to the template.

Purpose: Satisfies **GOV-06** (structured 10-field YAML responses + rubric-driven synthesis
per D-12/D-12a/D-13), and completes the **GOV-03** (Falsifier population path) and **GOV-07**
(Post-Synthesis Reflection population path) deliveries by wiring member fields into memo
sections. Absorbs the ex-13-04-03 CEO-rubric integration task per the 6-wave split-13-04
wave decision.

Output: 6 files — 4 board agent response-format rewrites, 1 new validator module
(`deliberation-schema.cjs` ~50-60 LOC), and `sgsd-deliberate/SKILL.md` Steps 3/4/5 edits
(validate+retry wrap + rubric-driven aggregation + reflection prompt).

Wave 4 — serial after Wave 3 {13-02}. SKILL.md overlap: 13-02 edited Step 5 (vote-synthesis
+ Tiebreak Rationale); 13-03 ALSO edits Step 5 (rubric + reflection) plus Steps 3/4 (validate
wrap). Must preserve all 13-01/13-02 edits.

## Tasks

Task breakdown follows 13-VALIDATION.md tasks 13-03-01 through 13-03-04, PLUS 13-03-05 which
absorbs the ex-13-04-03 CEO-rubric integration per the 6-wave split-13-04 decision. All
contracts, hypotheses, falsifiers, stop rules live in the frontmatter above — canonical
executor contract.

### 13-03-01 — 4 Board Agent Response-Format Rewrites

Update all 4 `super-gsd/agents/sgsd-board-{architect,contrarian,moonshot,pragmatist}.md`
files. Each gets an `## Output Format` section with an EXAMPLE YAML block listing all 10
D-12 fields + explicit "No markdown fences" instruction. Archetype-specific content
preserved (Architect: feasibility/risk/cost; Contrarian: blind-spots; Moonshot: 10x;
Pragmatist: timeline/resource).

### 13-03-02 — `deliberation-schema.cjs` (happy path)

Pure validator module. ~50-60 LOC. Exports `{validate, REQUIRED_FIELDS}`. Uses js-yaml
via createRequire. Validates: missing fields → error with field name, position enum,
confidence range, list-type fields, YAML parse errors. Returns
`{valid, errors: [strings], parsed?}`.

### 13-03-03 — `deliberation-schema.cjs` (reject cases)

Prove all 5 reject paths (bad position, bad confidence, wrong-type list, YAML parse error)
return `valid: false` with field-citing error strings. Extends module from 13-03-02 if
any branch is missing; verification-only commit otherwise.

### 13-03-04 — SKILL.md validate + retry wrap

Wrap each Agent() return in Steps 3 and 4 with `validate()` + retry-once-with-schema-reminder
+ hard-fail-on-second-malformed per D-13. Update Step 4 "Round 2 evaluation" heuristics
to use `member.position` field access instead of prose pattern-matching. Step 5 opens
with "responses are parsed objects already (validated in Steps 3 and 4)."

### 13-03-05 — SKILL.md rubric-driven Step 5 (absorbs ex-13-04-03)

Extend Step 5 with explicit rubric: `## Falsifier` populated from member `falsifier` fields,
`## Dead Ends` from member `known_deadends` fields, `## Post-Synthesis Reflection` via
in-context CEO reflection pass using D-14 "blind spots" prompt verbatim. Without this, plan
13-04's template sections stay empty in future DLB memos — this is the population path.

## Verification Gates (Wave close)

Run in sequence:

1. `for f in agents/sgsd-board-*.md; do grep-all-10-fields && grep-no-fences; done` → PASS
2. `node -e "..."` deliberation-schema happy path + missing-falsifier + REQUIRED_FIELDS count → PASS
3. `node -e "..."` deliberation-schema reject paths (position/confidence/wrong-type/parse) → PASS
4. SKILL.md anchors: `deliberation-schema`, `member.position`, rubric-aggregation → all exit 0
5. SKILL.md rubric: `## Falsifier`, `## Dead Ends`, `## Post-Synthesis Reflection`, `blind spots`,
   member.falsifier or member.known_deadends field-access → all exit 0
6. All 13-01/13-02 anchors preserved: `<step_2_5_roster>`, `vote-synthesis`, `signed_sum`,
   `Tiebreak Rationale` → all exit 0

## Success Criteria

- All 6 files at declared paths.
- All 5 task verification_cmds exit 0.
- Invariants 8, 9, 10 (template check from 13-04), 15 in Phase 13 verify.mjs go GREEN after
  this plan's commits land.
- Plans 13-01 and 13-02 SKILL.md edits preserved byte-for-byte.
- Plan 13-04's template sections (from its own plan) now have a population path wired.

## Output

After completion, create `.planning/phases/13-governance/plans/13-03-SUMMARY.md` summarising:
- 6 files modified (4 agent rewrites, deliberation-schema.cjs ~55 LOC, SKILL.md ~+60 lines at Steps 3/4/5)
- Confirmation of 13-01/13-02 edit preservation
- Which invariants (8, 9, 10, 15) turn green
- Note that 13-03-05 absorbed the ex-13-04-03 CEO-rubric integration
- 5 commit SHAs

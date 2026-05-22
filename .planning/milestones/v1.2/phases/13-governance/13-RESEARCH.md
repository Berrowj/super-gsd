# Phase 13: Governance — Research

**Researched:** 2026-04-22
**Domain:** Runtime board resolution + signed-sum synthesis + structured YAML + milestone-close skill with bidirectional VTP MCP
**Confidence:** HIGH for lib modules (clean mirror of Phase 10/12 patterns), MEDIUM for VTP classification resilience (schema gap — D-18b explicit fallback ladder handles it), HIGH for skill structure (triage + orchestrate give clear templates)

## RESEARCH COMPLETE

### Key Findings (executive summary)

1. **Every new lib module mirrors an existing Phase 10/12 pattern verbatim.** `board-registry.cjs` clones `gates-registry.cjs` (process singleton + js-yaml via createRequire). `vote-synthesis.cjs` is a pure function identical in shape to `context-gauge.cjs` (40 LOC, zero deps). `deliberation-schema.cjs` reuses the same js-yaml path. No architectural novelty — just faithful replication.

2. **Escalation predicate extension is real work, not a trivial addition.** Phase 10's `predicate-eval.cjs` operates on flat `ctx` fields only. Escalation predicates operate on `board[]` array members with per-member `.role/.position/.confidence` field access. The clean split is a **separate** `vote-predicate.cjs` module — do NOT pollute `predicate-eval.cjs` and risk Phase 10 contract drift.

3. **VTP classification gap is real and documented.** No prior `vtp_ingest_research` call exists in the activity log — only searches. The D-18b three-tier fallback (Milestone exists / arbitrary string accepted / fixed-enum only) is the correct resilience design; plan 13-05 must confirm the API shape in 60s via MCP tool schema probe OR ship the gap memo up front.

4. **Auto-trigger insertion point is Rule 6.g line 336 / Step 6.6.i line 677.** The orchestrator marks phase complete at line 677 `i. Mark phase complete, advance to next phase.` — insert D-18a auto-trigger check AFTER step i. Clean, minimal SKILL.md edit.

5. **Retro rescore (D-05) uses real, substantial briefs.** `.planning/briefs/2026-04-19-*.md` files are 50-100 lines each with full Situation/Stakes/Constraints/Key Questions. The rescore brief is NOT the DLB memo — it's the original `.planning/briefs/<date>-<slug>.md` referenced from the DLB frontmatter `brief:` field. All 6 DLBs have these. 24 Sonnet dispatches: 6 tasks × 4 parallel (not 6 parallel × 4 fan-out — see Q8 for the batching rationale).

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**22 decisions D-01..D-22 + 2 sub-decisions D-18a/b locked.** Research answers "how to implement," not "whether."

| ID | Lock |
|----|------|
| **D-01** | Escalation policy is structured vote-pattern rules in `board-members.yaml#escalation_policy` (machine-readable predicates, not CEO prose). |
| **D-02** | Predicates parse via Phase 10's `predicate-eval.cjs` pattern; extensions are additive (don't break Phase 10 gates.yaml triggers). |
| **D-03** | Signed-sum: SUPPORT=+conf, OPPOSE=-conf, ABSTAIN=0; sum>0 SUPPORT, sum<0 OPPOSE, sum==0 CEO breaks tie with explicit rationale. |
| **D-03a** | Ties noted as `VOTE_TIE` in memo header; CEO tiebreak logged separately from member tally. |
| **D-04** | `super-gsd/scripts/lib/vote-synthesis.cjs` exposes `synthesize(members) → { decision, sum, tiebreaker_applied, raw_votes }`. ~40 LOC. |
| **D-05** | Re-dispatch each board agent on ORIGINAL brief of DLB-01..06 with new rubric. 6×4=24 dispatches, ~50k tokens. |
| **D-05a** | Rescore YAML schema locked (original_vote, rescored.members[], signed_sum, new_decision, diverges_from_original, notes). |
| **D-05b** | ≥2 divergences flags "formula calibration concern" for operator review. |
| **D-06** | `decision-memo.md` gains `## Falsifier` + `## Dead Ends / Paths Ruled Out` between Unresolved Tensions and implementation plan. |
| **D-06a** | CEO synthesis rubric explicitly produces these sections. |
| **D-07** | `super-gsd/scripts/lib/board-registry.cjs` exposes `{ loadBoard, getMember, resolveRoster(brief) }`. Cached singleton mirroring `gates-registry.cjs`. ~50 LOC. |
| **D-08** | sgsd-deliberate SKILL.md lines 103-112 rewrite to iterate over `boardRegistry.resolveRoster(brief)`. Minimal-2 first round, escalation predicates after, optional second round. |
| **D-08a** | `board_version: v1-static` → `v2-runtime-resolved`; members' `state: draft` → `active`. |
| **D-09** | Milestone-close scoring audit writes one row per DLB to `.planning/metrics/deliberation-outcomes.jsonl` with 8 fields (locked). |
| **D-10** | rework_fired = scan commits for `fix(`/`refactor(` citing DLB; falsifier_fired = check `## Falsifier` vs phase artifacts; revisions_needed = count DLB-NN-REVISION-* files. |
| **D-11** | q1_impl_hours_actual = git log time delta between first and last DLB-scoped commit. Calibration signal only, not contract. |
| **D-12** | Board responses become structured 10-field YAML (position, confidence 1-5, risks_raised[], evidence_cited[], falsifier, implementation_concerns[], known_deadends[], intuition, why_principled, rationale). |
| **D-12a** | 4 board agent files update output-format sections to this schema. CEO synthesis becomes rubric-driven (aggregate per field, not paraphrase prose). |
| **D-13** | `super-gsd/scripts/lib/deliberation-schema.cjs` validates parsed YAML. Malformed = fail loudly per Phase 10 D-10c; CEO halts and requests re-emit. |
| **D-14** | CEO runs reflection pass after Falsifier + Dead Ends. Prompt: "blind spots? archetype voices missed? rubric forced-to-foreground that doesn't matter?" |
| **D-14a** | Reflection is `## Post-Synthesis Reflection` section in memo footer. NOT a separate Agent() — same CEO context. ~200 tokens. |
| **D-15** | GOV-05 scoring audit logs `reflection_captured: true/false` (>50 chars prose content). Absence = GOV-07 adherence fail. |
| **D-16** | **New skill `.claude/skills/sgsd-complete-milestone/SKILL.md`.** 8-step workflow: precondition check → GOV-05 audit → MUDA recurrence → cross-phase check → summary gen → VTP bidirectional → archive → STATE bump. |
| **D-17** | Integrates v2 plan schema (P11), gates.yaml (P10), classifier-cache invalidation (P12), checkpoint template (P12), edge-guard log (P10). |
| **D-18** | Skill output contract: SUMMARY.md, deliberation-outcomes.jsonl, muda-recurrence.md, gate-drift-audit.md, phases/, vtp-research-id.txt. |
| **D-18a** | **Auto-trigger from orchestrator loop** — after Rule 6.g marks last phase, check "all milestone phases [x] in ROADMAP.md?" If yes, auto-dispatch sgsd-complete-milestone. Idempotent. |
| **D-18b** | **VTP classification resilience** — three-tier fallback ladder (Milestone type / arbitrary string / fixed-enum + metadata tag). Always ship `VTP-CLASSIFICATION-GAP.md` when not tier-1. |
| **D-19** | Seven plans: 13-01 (board-registry+escalation), 13-02 (vote-synthesis), 13-03 (YAML responses+validator), 13-04 (memo template), 13-05 (new skill+VTP), 13-06 (retro rescore), 13-07 (verify.mjs). |
| **D-20** | 5 waves: W1 parallel {13-01, 13-04, 13-05}, W2 serial {13-02}, W3 serial {13-03}, W4 serial {13-06}, W5 serial {13-07}. |
| **D-21** | Phase 13 verify.mjs with ≥10 invariants covering GOV-01..07 + new skill file + VTP call signature + retro rescore output. |
| **D-22** | Out of scope: new archetypes, CEO agent redesign, retro running on v1.0/v1.1, VTP schema changes, confidence auto-tuning, alternative formulas, IN-03. |

### Claude's Discretion

None explicit — D-01..D-22 cover every policy decision. Implementation-surface choices (which js-yaml pattern, which retro batching shape, test fixture design) are researcher discretion within locked contracts.

### Deferred Ideas (OUT OF SCOPE)

- New board archetypes (Visionary, Skeptic)
- Per-project `board-members.yaml`
- Confidence auto-calibration
- VTP intra-phase research brief integration
- Board visualization dashboard

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **GOV-01** | Escalate-not-spawn board with `board-members.yaml#escalation_policy` | Q1 (board-registry.cjs) + Q2 (predicate extension) |
| **GOV-02** | Confidence-weighted signed-sum + retro DLB-01..06 rescore | Q3 (vote-synthesis.cjs) + Q8 (retro batching) |
| **GOV-03** | Decision memos require `## Falsifier` + `## Dead Ends` | Q4 indirectly; plan 13-04 is pure template edit |
| **GOV-04** | Board roster resolved at runtime from board-members.yaml | Q1 (resolveRoster) + Q8 of CONTEXT (SKILL.md line 103-112 target) |
| **GOV-05** | Post-deliberation scoring audit → `deliberation-outcomes.jsonl` | Q7 (sgsd-complete-milestone skill integration) |
| **GOV-06** | Structured 10-field YAML responses + rubric-driven synthesis | Q4 (deliberation-schema.cjs) + response-format updates |
| **GOV-07** | CEO post-synthesis reflection section in memo footer | Q4 indirectly; plan 13-04 + sgsd-deliberate synthesis edit |

---

## Summary

Phase 13 has heavy implementation surface but low architectural risk because every new component mirrors an existing Phase 10/12 pattern. Five new small lib modules (~200 LOC total), one new skill (~300 lines), template extensions, 4 agent response-format rewrites, and a substantial retro rescore (24 Sonnet dispatches). The VTP classification question is the only genuine unknown — D-18b pre-empts it with a documented fallback ladder.

**Primary recommendation:** Plan 13-01 ships first (largest surface, unblocks everything downstream). Wave 1 parallelism is legitimately 3-way independent (different files, different concerns). Waves 2-3 serialize because they share `sgsd-deliberate/SKILL.md`. Verify.mjs (13-07) owns ≥13 invariants (not 10 — escalation parsing + retro rescore output + VTP resilience all need coverage).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Board registry loading | `scripts/lib` (Node CommonJS) | SKILL.md consumer | Mirror `gates-registry.cjs` — cached singleton, O(1) reads |
| Vote synthesis math | `scripts/lib` (pure function) | SKILL.md Step 5 | No state, no I/O — directly testable via verify.mjs fixtures |
| YAML response validation | `scripts/lib` | Board agents + CEO | Schema enforcement at parse boundary; fail-loud pattern (Phase 10 D-10c) |
| Escalation predicate eval | `scripts/lib` (new `vote-predicate.cjs`) | board-registry.resolveRoster | Separate from Phase 10's `predicate-eval.cjs` to avoid contract drift |
| Deliberation memo structure | `templates/decision-memo.md` | CEO synthesis prompt | Template is source of truth; CEO rubric references it |
| Board agent response format | `agents/sgsd-board-*.md` | CEO parser | 4 agent files updated in lockstep; CEO expects uniform YAML |
| Milestone-close orchestration | `.claude/skills/sgsd-complete-milestone/SKILL.md` | sgsd-orchestrate auto-trigger | User-local install (per D-16) — Claude Code reads from both global and project skills |
| VTP bidirectional integration | sgsd-complete-milestone skill | VTP MCP server | Skill owns the fallback ladder; gap memo lives in milestone dir |
| Auto-trigger logic | `sgsd-orchestrate/SKILL.md` Step 6.6.i+ | n/a | Single insertion point after phase-complete mark |
| Retro rescore runner | Plan 13-06 task actions | board agent Agent() calls | Serial per-DLB (cheap orchestrator context), parallel 4-agent fan-out |

---

## Per-Question Findings

### Q1: board-registry.cjs shape + integration point

**Module shape (clean mirror of `gates-registry.cjs` lines 38-95):**

```javascript
// super-gsd/scripts/lib/board-registry.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const { evalVotePredicate } = require('./vote-predicate.cjs'); // NEW — see Q2

let _cache = null; // PROCESS SINGLETON (see gates-registry.cjs:24-28 warning)

function loadBoard(boardYamlPath) {
  if (_cache) return _cache;
  const yamlLibPath = path.resolve(
    __dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml'
  );
  const yaml = require(yamlLibPath);
  const raw = fs.readFileSync(boardYamlPath, 'utf8');
  const parsed = yaml.load(raw);
  const members = Array.isArray(parsed?.board_members) ? parsed.board_members : [];
  const byName = Object.fromEntries(members.map(m => [m.name, m]));
  _cache = {
    members,
    byName,
    escalation_policy: parsed?.escalation_policy || {},
    default_minimal: parsed?.escalation_policy?.default_minimal_board || [],
    always_present:  parsed?.escalation_policy?.always_present || [],
  };
  return _cache;
}

function getMember(name, boardYamlPath) {
  const reg = loadBoard(boardYamlPath);
  const m = reg.byName[name];
  if (!m) throw new Error(`board member '${name}' not in registry`);
  return m;
}

// resolveRoster has TWO modes:
//   - Pre-round 1: returns minimal-2 (plus always_present CEO)
//   - Post-round 1: takes first-round results, checks escalation predicates,
//                   returns augmented roster for round 2
function resolveRoster(brief, firstRoundResults) {
  const reg = loadBoard(DEFAULT_BOARD_PATH);
  if (!firstRoundResults) {
    return [...reg.default_minimal, ...reg.always_present];
  }
  const augmented = new Set(reg.default_minimal);
  for (const clause of reg.escalation_policy?.escalate_add || []) {
    if (evalVotePredicate(clause.trigger, { members: firstRoundResults, board: [...augmented] })) {
      augmented.add(clause.add);
    }
  }
  return [...augmented, ...reg.always_present];
}

function resetCache() { _cache = null; }

module.exports = { loadBoard, getMember, resolveRoster, resetCache };
```

**Integration point in `sgsd-deliberate/SKILL.md`:**

The current SKILL.md has NO pre-dispatch "build board" step — lines 103-112 hardcode 4 Agent() calls directly. The plan must insert a new **Step 2.5 (Resolve Roster)** between Step 2 (Load Context) and Step 3 (Spawn Round 1):

```
<step_2_5_roster>
## Step 2.5: Resolve Board Roster (GOV-04)

const boardReg = require('super-gsd/scripts/lib/board-registry.cjs');
const roster = boardReg.resolveRoster(brief);  // returns minimal-2 + CEO
// Proceed to Step 3 iterating over `roster`, not hardcoded 4
</step_2_5_roster>
```

Step 3 then becomes a `for (const memberName of roster) Agent(...)` loop. Step 4 (Round 2 evaluation) calls `resolveRoster(brief, round1Results)` again — escalation triggers now apply.

**Citation:** `super-gsd/skills/sgsd-deliberate/SKILL.md:92-114` (current hardcoded block); `super-gsd/scripts/lib/gates-registry.cjs:38-95` (pattern to mirror).

**Confidence: HIGH.** Direct mirror, no research novelty.

---

### Q2: Escalation predicate evaluator extension strategy

**Phase 10 `predicate-eval.cjs` reality check:**
- Ops: `eq, neq, in, not_in, gt, gte, lt, lte, contains` (simple scalar)
- Special form: `{ any: [Clause, ...] }` for OR
- Ctx is flat with dotted-path access (`classifier.atc_tier`)
- NO array iteration, NO aggregate functions (count/size/unique)
- `getDottedField` throws on unknown field (D-10c loud-fail)

**Escalation predicate reality:**
```yaml
add_pragmatist:
  trigger: "any(m.role=='Contrarian' AND m.position=='OPPOSE' AND m.confidence>=4)"
add_moonshot:
  trigger: "count(unique(m.position))==1 AND size(board)>=2"
```

These need: `any(list, predicate)`, `count(list)`, `unique(list)`, `size(list)`, and **iteration variable `m`** with per-member field access. None of this fits `predicate-eval.cjs`'s shape.

**Three options scored:**

| Option | Complexity | Phase 10 risk | Verdict |
|--------|-----------|---------------|---------|
| Extend `predicate-eval.cjs` with array ops + iteration | HIGH — rewrite `evalClause` for `{iter, list, op, value}` forms; confuses gates.yaml authors with unused ops | HIGH — every change risks Phase 10 gate regressions | REJECTED |
| New helper `vote-predicate.cjs` with its own mini-DSL | MEDIUM — ~80 LOC; clean separation | ZERO — Phase 10 untouched | **ADOPTED** |
| String-eval via `new Function()` | LOW (10 LOC) | HIGH — security footgun, no validation, no verify.mjs-able error messages | REJECTED |

**Recommended shape for `vote-predicate.cjs`:**

The YAML trigger in CONTEXT.md is a **natural-language-looking string**, but for parser simplicity it should be a **structured clause** (like predicate-eval.cjs clauses):

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

Or — preserve the CONTEXT.md string form and parse it with a tiny tokenizer. **Recommend structured form** because:
1. Validates via verify.mjs (no string-parse fragility)
2. Matches Phase 10 gate trigger shape (operators recognize it)
3. Easier to extend with new ops without re-tokenizing

**If the operator prefers the string form from CONTEXT.md D-01 verbatim:** ship both — yaml provides `trigger_structured:` (primary) and `trigger_prose:` (comment/documentation). Verify.mjs checks the structured form; string is a human-readable gloss.

**API:**
```javascript
// super-gsd/scripts/lib/vote-predicate.cjs
function evalVotePredicate(clause, ctx) {
  // ctx: { members: BoardMemberResult[], board: string[] }
  // returns boolean; throws on unknown op or field (D-10c loud-fail)
}
module.exports = { evalVotePredicate };
```

**Citation:** `super-gsd/scripts/lib/predicate-eval.cjs:29-93` (pattern to diverge from cleanly).

**Confidence: HIGH on strategy (separate module). MEDIUM on concrete YAML shape — if operator prefers the string form, plan 13-01 should include a 30-min spike to settle.**

---

### Q3: vote-synthesis.cjs integration point

**Module (pure function, ~40 LOC):**

```javascript
// super-gsd/scripts/lib/vote-synthesis.cjs
'use strict';
function synthesize(members) {
  // members: [{ role, position: 'SUPPORT'|'OPPOSE'|'ABSTAIN', confidence: 1-5, ... }]
  const raw_votes = members.map(m => ({ role: m.role, position: m.position, confidence: m.confidence }));
  let sum = 0;
  for (const m of members) {
    if (m.position === 'SUPPORT') sum += m.confidence;
    else if (m.position === 'OPPOSE') sum -= m.confidence;
    // ABSTAIN contributes 0
  }
  let decision, tiebreaker_applied = false;
  if (sum > 0) decision = 'SUPPORT';
  else if (sum < 0) decision = 'OPPOSE';
  else { decision = 'TIE'; tiebreaker_applied = true; }
  return { decision, sum, tiebreaker_applied, raw_votes };
}
module.exports = { synthesize };
```

**Integration in `sgsd-deliberate/SKILL.md`:**

Current Step 5 (line 157-189) writes the memo with prose-summarized vote: `vote: "3-1 SUPPORT, Contrarian OPPOSED"`. No code path does vote math today — CEO paraphrases the 4 positions into a prose summary.

**Plan 13-02 changes:** At the top of Step 5, before writing the memo frontmatter, add:

```
const voteSynth = require('super-gsd/scripts/lib/vote-synthesis.cjs');
const { decision, sum, tiebreaker_applied, raw_votes } = voteSynth.synthesize(round2Results);

// Write memo frontmatter with:
//   vote: "{sum:+}/{maxPossible} — {decision}"   # e.g. "+7/20 — SUPPORT"
//   signed_sum: {sum}
//   tiebreaker_applied: {bool}     # if true, CEO MUST fill "Tiebreak Rationale" memo section
//   raw_votes: {raw_votes}
```

**Where synthesis "currently happens":** In prose, inline in the CEO's drafting of Step 5. It is NOT separated out. The mechanical edit is straightforward — inject a code-block call at the top of Step 5.

**Citation:** `super-gsd/skills/sgsd-deliberate/SKILL.md:160-172` (current frontmatter block); `super-gsd/scripts/lib/context-gauge.cjs:1-52` (pure-function pattern to mirror).

**Confidence: HIGH.**

---

### Q4: deliberation-schema.cjs validator + malformed recovery

**Use js-yaml via createRequire (Phase 10 pattern — already pinned):**

```javascript
// super-gsd/scripts/lib/deliberation-schema.cjs
'use strict';
const path = require('path');
const yamlLibPath = path.resolve(
  __dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml'
);
const yaml = require(yamlLibPath);

const REQUIRED_FIELDS = [
  'position', 'confidence', 'risks_raised', 'evidence_cited',
  'falsifier', 'implementation_concerns', 'known_deadends',
  'intuition', 'why_principled', 'rationale',
];
const POSITION_VALUES = ['SUPPORT', 'OPPOSE', 'ABSTAIN'];

function validate(yamlBody) {
  let parsed;
  try { parsed = yaml.load(yamlBody); }
  catch (e) { return { valid: false, errors: [`YAML parse error: ${e.message}`] }; }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, errors: ['root must be a map'] };
  }
  const errors = [];
  for (const f of REQUIRED_FIELDS) {
    if (!(f in parsed)) errors.push(`missing required field '${f}'`);
  }
  if (parsed.position && !POSITION_VALUES.includes(parsed.position)) {
    errors.push(`position must be one of ${POSITION_VALUES.join('|')}, got '${parsed.position}'`);
  }
  if (parsed.confidence != null) {
    const c = Number(parsed.confidence);
    if (!Number.isInteger(c) || c < 1 || c > 5) {
      errors.push(`confidence must be integer 1-5, got ${parsed.confidence}`);
    }
  }
  for (const arrField of ['risks_raised', 'evidence_cited', 'implementation_concerns', 'known_deadends']) {
    if (arrField in parsed && !Array.isArray(parsed[arrField])) {
      errors.push(`'${arrField}' must be a list`);
    }
  }
  return { valid: errors.length === 0, errors, parsed };
}

module.exports = { validate, REQUIRED_FIELDS };
```

**Malformed-response recovery in CEO synthesis:**

Phase 10 D-10c established the **loud-fail** pattern: unknown field → throw. Apply same discipline here with ONE retry:

```
For each board member response:
  const { valid, errors, parsed } = deliberationSchema.validate(response);
  if (!valid) {
    // Retry once with explicit schema reminder
    const retryPrompt = {
      ...originalPrompt,
      prefix: `Your previous response failed schema validation: ${errors.join('; ')}. \
               Re-emit as valid YAML matching ALL 10 required fields. NO prose wrapper, NO markdown fences.`
    };
    const retry = Agent(memberName, model: 'sonnet', prompt: retryPrompt);
    const retryResult = deliberationSchema.validate(retry);
    if (!retryResult.valid) {
      // Escalate: log to deliberation-outcomes.jsonl, fail the deliberation, emit BLOCKER
      throw new Error(`Board member '${memberName}' emitted malformed response after retry: ${retryResult.errors.join('; ')}`);
    }
    return retryResult.parsed;
  }
  return parsed;
```

**Citation:** `super-gsd/scripts/lib/gates-registry.cjs:40-45` (createRequire js-yaml); `super-gsd/scripts/lib/predicate-eval.cjs:62-69` (loud-fail on missing field).

**Confidence: HIGH on module shape. HIGH on retry-once-then-escalate — matches Phase 10's established pattern.**

---

### Q5: VTP MCP classification API — the critical unknown

**What activity-log tells us:** Searches were performed (`select:mcp__vtp-kb__vtp_ingest_research` max_results:1 at 2026-04-21T12:18:42) but no ingest call ever fired. The tool exists but the call shape is unknown from the log alone.

**What SGSD-2.0-architecture.html tells us (line 400-420):** VTP-KB holds research papers, projects, meetings, speakers, claims, commitments. Tools enumerated: `vtp_research_gate`, `vtp_idea_gate`, `wiki_*`, `vtp_search`, `vtp_get_*`. `vtp_research_gate` is a 7-stage adversarial pipeline (retrieve · relevance · translate · challenger · defender · judge · grounding).

**What the activity log shows has been USED:** `vtp_idea_gate` (simple idea pitch with `{idea: "..."}` param), `vtp_search` (query), `wiki_search`, `wiki_list_analyses`. `vtp_ingest_research` and `vtp_research_brief` appear only in ToolSearch probes — never actually called.

**Inference:** `vtp_ingest_research` almost certainly exists (tool search resolved it) but its parameter schema is not exposed to this researcher without actually running the tool (which the researcher cannot safely do from inside a research phase). The tool is likely shaped like `{title, body, classification?, tags?, source?}` — matching typical MCP research-ingest shapes — but this is UNVERIFIED.

**Recommendation for plan 13-05:**

1. **First task of plan 13-05 (60-second spike):** Call `ToolSearch({ query: "select:mcp__vtp-kb__vtp_ingest_research", max_results: 1 })` to retrieve the tool's parameter schema. This IS safe — ToolSearch is read-only discovery.

2. **Branch on schema result:**
   - If schema has a `classification` or `type` or `category` parameter that accepts arbitrary strings → tier-2 (arbitrary string) path per D-18b.
   - If schema has a `classification` enum with 'milestone' or similar → tier-1 (native) path.
   - If schema has a fixed enum without milestone → tier-3 (best-fit + metadata tag) path.

3. **Ship `VTP-CLASSIFICATION-GAP.md` unconditionally if tier-2 or tier-3 fires** — documents for VTP owners exactly what schema change would move SGSD to tier-1.

4. **Never let the publish path fail the skill.** All 3 tiers produce a successful ingest; the difference is frontmatter `vtp_classification_used:` value and gap-memo presence.

**What the researcher can confirm right now:** The tool search probe is itself evidence that the tool exists. The gap memo template belongs in plan 13-05 as a Task action regardless of which tier fires — ship it in tier-1 too with `status: NONE — tier-1 path used`.

**Confidence: MEDIUM.** The D-18b three-tier ladder is robust to any answer. But the researcher cannot pre-answer the question without making the actual MCP call.

---

### Q6: Orchestrator auto-trigger insertion point

**Current Rule 6.g path:**

| Location | Line | What happens |
|----------|------|--------------|
| `<loop>` block | SKILL.md:336 | `g. Verification passed → PHASE ATC GATE (Step 6.5) → FRONTEND VERIFY GATE (Step 6.6) → mark complete` |
| Step 6.5 | :440-506 | Phase ATC review (phase-level), writes ATC-REVIEW.md |
| Step 6.55 | :508-552 | MUDA waste audit (conditional) |
| Step 6.6 | :554-693 | Browser verify (if frontend files touched) |
| Step 6.6.h | :675 | TaskUpdate completed |
| Step 6.6.i | :677 | **`i. Mark phase complete, advance to next phase.`** |

**Insertion point: AFTER line 677.** Add Step 6.6.j (or a new Step 6.7):

```
6.7. MILESTONE COMPLETE AUTO-TRIGGER (GOV / D-18a)

After Step 6.6.i marks a phase complete:

  a. Read .planning/ROADMAP.md (full — milestone-close is a rare event)
  b. Extract phase list for active milestone (STATE.md frontmatter milestone field)
  c. Check: do all milestone phases have [x] prefix?
     NO  → Continue to next iteration of <loop> (Rule 6 → Step 1 READ STATE)
     YES → Auto-dispatch:
       TaskCreate({
         content: "Close milestone {version}",
         activeForm: "sgsd-complete-milestone — auto-trigger",
         status: "in_progress"
       })
       Agent(
         subagent_type: "sgsd-complete-milestone",
         mode: "bypassPermissions",
         prompt: { milestone: "{version from STATE.md}", auto_trigger: true }
       )
       → Skill is idempotent (PASS if already archived)
       TaskUpdate(taskId, status: "completed")

       // Report parsed as normal — if BLOCKER, halt loop with that message.
       // On success, exit loop per Rule 6.9 "all phases complete".
```

**Does orchestrator have milestone-completeness detection anywhere today?** 

YES — indirectly: `<loop>` block line 160 checks `If all phases [x] → EXIT: "All phases complete"`. But this fires at top-of-loop only, using STATE.md frontmatter, NOT ROADMAP.md. It exits the loop rather than dispatching a milestone-close handler. Plan 13-05 must choose: **extend line 160** (simpler) OR **add Step 6.7 at line 677** (more explicit, clearer commit boundary).

**Recommend Step 6.7 insertion:** explicit and locally readable at the site where a phase is actually marked complete. Line 160's check remains intact as a cold-start safety net for resume scenarios.

**Citation:** `super-gsd/skills/sgsd-orchestrate/SKILL.md:160` (top-of-loop check), `:336` (rule 6.g), `:677` (phase-complete mark), `:1213-1215` (rule notes block).

**Confidence: HIGH.**

---

### Q7: sgsd-complete-milestone skill structure

**Install location decision:**

Environment facts:
- Global `C:/Users/user/.claude/skills/` contains 40+ skills including existing `gsd-complete-milestone` (126 lines, legacy v1).
- Project-local `C:/Users/user/GSDedits/.claude/skills/` does NOT exist.
- Project-repo `super-gsd/skills/` contains 19 SGSD-native skills (sgsd-* prefix).
- Phase 12 patched `core.cjs` for cross-repo reachability.

**D-16 says:** `.claude/skills/sgsd-complete-milestone/SKILL.md` — this is the **user-local install** path (`~/.claude/skills/`). Matching global install of `gsd-complete-milestone`.

**However:** the CONTEXT.md line 39 also says *"Existing `/sgsd-complete-milestone` skill (if any) in `~/.claude/skills/` or `.claude/skills/`"*. Both paths are acceptable. The ACTUAL best choice:

- **User-local (`~/.claude/skills/sgsd-complete-milestone/`)** — matches D-16 verbatim, matches existing `gsd-complete-milestone` install pattern, works across all user's projects.
- **Repo-tracked (`super-gsd/skills/sgsd-complete-milestone/`)** — version-controlled, matches SGSD 2.0 `sgsd-*` repo convention, ships via SGSD installer.

**Recommendation:** Ship in BOTH — **repo-tracked primary** (`super-gsd/skills/sgsd-complete-milestone/SKILL.md` — version controlled, testable, CI-scannable) with the SGSD installer copying it to `~/.claude/skills/sgsd-complete-milestone/` on install. This matches the pattern already used for sgsd-orchestrate (repo-tracked) vs gsd-* globals (user-copied). 

**For Phase 13 execution:** plan 13-05 writes to `super-gsd/skills/sgsd-complete-milestone/SKILL.md`. The global copy is done at install time (or manually by operator) — NOT a phase 13 task. This follows Phase 12's MACH-01..04 pattern where the repo is source of truth, user-local is derived.

**Skill structure (8-step, modeled on sgsd-orchestrate + sgsd-triage):**

```markdown
---
name: sgsd-complete-milestone
description: "Close a milestone with GOV-05 audit, MUDA recurrence, cross-phase check, VTP bidirectional, and archive. Idempotent — safe to re-run. Auto-triggered by sgsd-orchestrate when all milestone phases [x]."
argument-hint: "<version>"
allowed-tools: [Read, Write, Bash, Glob, Grep, Agent, mcp__vtp-kb__vtp_search, mcp__vtp-kb__vtp_list_research, mcp__vtp-kb__vtp_ingest_research]
---

<objective>
Close milestone {{version}}. Idempotent: PASS exit if already closed.
Auto-triggered by sgsd-orchestrate Step 6.7 when all milestone phases [x] in ROADMAP.md.
</objective>

<step_0_precondition>
## Step 0: Precondition Check (D-16 item 1)
Read ROADMAP.md, verify all milestone phases show [x]. If ANY phase lacks [x], emit BLOCKER.
Verify v2 schema precondition (D-17): all milestone PLAN.md files have schema_version: 2 OR v1_legacy: true.
Check .planning/milestones/{version}/SUMMARY.md — if exists, exit 0 PASS ("already closed").
</step_0_precondition>

<step_1_scoring_audit>
## Step 1: GOV-05 Scoring Audit (D-09..D-11)
For every DLB-NN.md authored since prior milestone close:
  Read memo frontmatter. Extract date, brief path.
  Compute: q1_impl_hours_actual (git log delta), rework_fired (grep fix|refactor citing DLB),
           falsifier_fired (check ## Falsifier section vs phase artifacts), revisions_needed (count REVISION-* siblings),
           signed_sum (from frontmatter or compute), raw_vote, reflection_captured (>50 chars in ## Post-Synthesis Reflection).
  Append row to .planning/metrics/deliberation-outcomes.jsonl.
</step_1_scoring_audit>

<step_2_muda_recurrence>
## Step 2: MUDA Recurrence Check (D-16 item 3)
bash super-gsd/scripts/sgsd-muda-recurrence.sh --milestone {{version}} --kill-check
Parse exit code. 1 = kill-condition fired → flag sgsd-muda-audit for retirement in SUMMARY.md.
Write .planning/milestones/{{version}}/muda-recurrence.md (script stdout).
</step_2_muda_recurrence>

<step_3_edge_guard_audit>
## Step 3: Edge-Guard Drift Audit (D-17 Phase 10 integration)
Read .planning/metrics/edge-guard-log.jsonl. Group by gate name; any gate skipped >3 times = governance concern.
Write .planning/milestones/{{version}}/gate-drift-audit.md.
</step_3_edge_guard_audit>

<step_4_cross_phase_check>
## Step 4: Cross-Phase Integration Check (D-16 item 4)
Dispatch gsd-integration-checker on the milestone's phase list.
If any regression: append to SUMMARY.md ## Known Regressions section.
</step_4_cross_phase_check>

<step_5_summary_generation>
## Step 5: Summary Generation (D-18)
Read all phase SUMMARY.md files, INTENT.md, deliberation-outcomes.jsonl.
Write .planning/milestones/{{version}}/SUMMARY.md with sections:
  ## Shipped (phase list with one-liner each)
  ## Evidence (deliberation outcomes table, MUDA findings, gate drift)
  ## Rules Learned This Session (from checkpoint template field)
  ## Frontmatter: vtp_research_id (filled Step 6), vtp_classification_used (filled Step 6)
</step_5_summary_generation>

<step_6_vtp_bidirectional>
## Step 6: VTP Bidirectional (D-16 item 6, D-18b three-tier fallback)

### 6a. INGEST (enrichment pull — before SUMMARY is finalized)
mcp__vtp-kb__vtp_search({ query: "milestone {{version}} SGSD" })
mcp__vtp-kb__vtp_list_research({ type: "Milestone" })   # best-effort; tolerate filter unsupported
Prepend 2-3 most-relevant results as ## Context Pulled From VTP in SUMMARY.md footer.

### 6b. PUBLISH (three-tier resilience per D-18b)
Attempt tier-1: mcp__vtp-kb__vtp_ingest_research({ title, body: SUMMARY.md, classification: "Milestone", tags: ["sgsd", "milestone_{{version}}"] })
  On schema error → tier-2: classification: "Milestone (SGSD v2)", write VTP-CLASSIFICATION-GAP.md
  On schema error again → tier-3: classification: {best-fit existing type}, metadata.sgsd_type: "milestone", write VTP-CLASSIFICATION-GAP.md urgency HIGH
Write returned ID to .planning/milestones/{{version}}/vtp-research-id.txt.
Update SUMMARY.md frontmatter: vtp_classification_used, vtp_research_id.
</step_6_vtp_bidirectional>

<step_7_archive>
## Step 7: Archive (D-18)
mv .planning/phases/*-*/ → .planning/milestones/{{version}}/phases/
Move REQUIREMENTS.md → .planning/milestones/{{version}}/v{{version}}-REQUIREMENTS.md
Collapse ROADMAP.md milestone section to one-line summary.
Invalidate Phase 12 classifier-cache: rm .planning/phases/**/*.classifier.json (those that moved are gone).
</step_7_archive>

<step_8_state_bump>
## Step 8: STATE.md Bump
Update STATE.md frontmatter: milestone → next or set milestone_status: complete.
Seed next milestone checkpoint with rules_learned_this_session from this SUMMARY.
Commit: `chore(milestone): close {{version}} — {phase-count} phases, {dlb-count} DLBs audited`
</step_8_state_bump>
```

**Shape similar to:** sgsd-orchestrate (step_0 through step_N structure with XML tags, mode: "auto" dispatches). sgsd-triage provides the Path-A/B/C routing pattern that's not needed here (skill is linear).

**Citation:** `super-gsd/skills/sgsd-orchestrate/SKILL.md:24-54` (step tag pattern); `super-gsd/skills/sgsd-triage/SKILL.md:1-80` (frontmatter + allowed-tools); `super-gsd/scripts/sgsd-muda-recurrence.sh:1-40` (existing kill-check wrapper); legacy `~/.claude/skills/gsd-complete-milestone/SKILL.md:38-113` (8-step structure precedent).

**Confidence: HIGH on structure. MEDIUM on exact VTP call shape (resolved by Step 6 three-tier ladder).**

---

### Q8: Retro DLB-01..06 rescore batching

**Raw cost:** 6 DLBs × 4 board agents × 1 round = 24 Sonnet dispatches, ~50k tokens per D-05.

**Per-DLB "original brief" source:** DLB frontmatter has `brief:` field pointing to `.planning/briefs/<date>-<slug>.md`. Verified:

| DLB | Brief Path | Size |
|-----|-----------|------|
| DLB-01 | `.planning/briefs/2026-04-19-memory-topology.md` | 50+ lines |
| DLB-02 | `.planning/briefs/2026-04-19-muda-learning-loop.md` | substantial |
| DLB-03 | `.planning/briefs/2026-04-19-intent-continuity.md` | substantial |
| DLB-04 | `.planning/briefs/2026-04-19-self-evolving-resource-substrate.md` | substantial |
| DLB-05 | `.planning/briefs/2026-04-20-vtp-audit-sharpening.md` | substantial |
| DLB-06 | `.planning/briefs/2026-04-20-central-distribution.md` | substantial |

All briefs exist and have full Situation/Stakes/Constraints/Key Questions sections — rescore input is real, not degraded.

**Batching options scored:**

| Option | Shape | Orchestrator context cost | Total wall time | Verdict |
|--------|-------|---------------------------|-----------------|---------|
| A. Single task, 24 parallel | 24× fan-out at once, orchestrator awaits all | HIGH — 24 report payloads in one loop iteration | LOW | REJECTED — blows context budget, loop checkpoint risks trigger |
| B. 6 serial tasks × 4 parallel | One task per DLB, 4-agent fan-out inside each | LOW — per-task ~4 reports × ~400 tokens = 1600 tokens back | MEDIUM | **ADOPTED** |
| C. 24 serial dispatches | One agent per task, fully sequential | LOW per task | HIGH — 24× orchestrator overhead | REJECTED |
| D. 6 serial tasks × 4 serial within task | One task per DLB, 4 serial agents inside | MEDIUM | HIGH — no parallelism | REJECTED |

**Recommended Option B structure (plan 13-06):**

Plan 13-06 has 6 tasks (one per DLB). Each task body:
```
For DLB-NN:
  1. Read .planning/briefs/<brief-path-from-DLB-frontmatter>
  2. Fan out 4 Agent() calls with run_in_background: true (leverage Phase 12 PARALLEL_CONFIRMED):
     - Agent(subagent_type: sgsd-board-architect, prompt: brief + new 10-field rubric)
     - Agent(subagent_type: sgsd-board-contrarian, prompt: ...)
     - Agent(subagent_type: sgsd-board-pragmatist, prompt: ...)
     - Agent(subagent_type: sgsd-board-moonshot, prompt: ...)
  3. await Promise.all — collect 4 structured YAML responses
  4. Call voteSynth.synthesize(parsedResponses) → decision, sum, tiebreaker_applied
  5. Write .planning/decisions/DLB-NN-RESCORE.md per D-05a schema:
       original_vote: "{from DLB-NN frontmatter.vote}"
       original_decision: "{SUPPORT|OPPOSE from frontmatter.decision}"
       rescored:
         members: [{role, position, confidence, rationale_summary}]
         signed_sum: {N}
         new_decision: "{SUPPORT|OPPOSE|TIE}"
         diverges_from_original: {bool}
         notes: "{CEO one-liner explaining convergence/divergence}"
  6. Commit: `docs(13-06): rescore DLB-NN — {SUPPORT|OPPOSE} sum={N} {diverges|converges}`
```

**After all 6 tasks:** a final task runs divergence-count check per D-05b. If ≥2 of 6 diverge, append to `.planning/phases/13-governance/13-05b-calibration-concern.md` with summary table.

**Wave placement:** W4 after 13-02 (vote-synthesis.cjs needed) and 13-03 (structured YAML schema + agent response format updated). Cannot parallelize with W1-3 — hard dependency.

**Parallelism within wave:** N/A — only one plan in W4.

**Token budget:** ~50k (4 agents × 6 DLBs × ~2k tokens per response + orchestrator overhead). Within single loop iteration context budget if per-task commit + report parse discipline is maintained.

**Confidence: HIGH.**

---

### Q9: Phase 13 verify.mjs invariants (≥13 — expanding on D-21's ≥10 floor)

Following Phase 10/12 pattern: numbered, exit-code-returning, append-only per plan. Invariants expected-red until their plan ships.

| # | Invariant | Plan | GOV | Confidence |
|---|-----------|------|-----|-----------|
| 1 | `board-members.yaml` parses as valid YAML | 13-01 | GOV-04 | HIGH |
| 2 | `board-members.yaml` has `board_version: v2-runtime-resolved` AND all `board_members[].state == active` | 13-01 | GOV-04 (D-08a) | HIGH |
| 3 | `board-members.yaml` has non-empty `escalation_policy.default_minimal_board` (list ≥2) AND `escalation_policy.escalate_add` (list ≥1) AND every `escalate_add[].trigger` structured-clause parses via `vote-predicate.cjs` with a sample `{members, board}` ctx | 13-01 | GOV-01 | HIGH |
| 4 | `super-gsd/scripts/lib/board-registry.cjs` exports `{loadBoard, getMember, resolveRoster, resetCache}` — all functions | 13-01 | GOV-04 | HIGH |
| 5 | `board-registry.resolveRoster(brief)` with no round-1 results returns exactly `default_minimal + always_present` (order-insensitive) | 13-01 | GOV-04 | HIGH |
| 6 | `super-gsd/scripts/lib/vote-synthesis.cjs` `synthesize(members)` on fixture `[{role,position:SUPPORT,confidence:3},{pos:OPPOSE,conf:2},{pos:OPPOSE,conf:3},{pos:SUPPORT,conf:4}]` returns `{decision:'SUPPORT', sum:+2, tiebreaker_applied:false}` | 13-02 | GOV-02 | HIGH |
| 7 | `synthesize` on tie fixture (sum==0) returns `{decision:'TIE', tiebreaker_applied:true}` | 13-02 | GOV-02 D-03/D-03a | HIGH |
| 8 | `super-gsd/scripts/lib/deliberation-schema.cjs` `validate()` on fixture with all 10 fields returns `{valid:true, errors:[]}`; on fixture missing `falsifier` returns `{valid:false}` with specific error string | 13-03 | GOV-06 | HIGH |
| 9 | Each of `super-gsd/agents/sgsd-board-{architect,contrarian,moonshot,pragmatist}.md` contains the 10 required YAML field names (position, confidence, risks_raised, evidence_cited, falsifier, implementation_concerns, known_deadends, intuition, why_principled, rationale) | 13-03 | GOV-06 | HIGH |
| 10 | `super-gsd/templates/decision-memo.md` contains the header strings `## Falsifier`, `## Dead Ends`, and `## Post-Synthesis Reflection` | 13-04 | GOV-03, GOV-07 | HIGH |
| 11 | Skill file exists at `super-gsd/skills/sgsd-complete-milestone/SKILL.md` with frontmatter `name: sgsd-complete-milestone` and `allowed-tools` including `mcp__vtp-kb__vtp_ingest_research` | 13-05 | D-16 | HIGH |
| 12 | `sgsd-orchestrate/SKILL.md` contains the substring `all milestone phases` or equivalent auto-trigger marker (e.g., `Step 6.7` header) | 13-05 | D-18a | HIGH |
| 13 | sgsd-complete-milestone SKILL.md contains explicit tier-1/tier-2/tier-3 branches for VTP classification (grep: `tier-1`, `tier-2`, `tier-3` OR `classification: "Milestone"` AND `classification: "Milestone (SGSD v2)"`); or contains all three phrases: `vtp_classification_used: Milestone`, `VTP-CLASSIFICATION-GAP.md`, `sgsd_type: milestone` | 13-05 | D-18b | HIGH |
| 14 | All 6 `.planning/decisions/DLB-0{1..6}-RESCORE.md` files exist AND parse as YAML AND contain frontmatter fields: `original_vote`, `original_decision`, `rescored.signed_sum`, `rescored.new_decision`, `diverges_from_original` | 13-06 | GOV-02 D-05a | HIGH |
| 15 | `sgsd-deliberate/SKILL.md` references `board-registry` (require or import line) AND references `vote-synthesis` AND references `deliberation-schema` | 13-02, 13-03 | GOV-02, GOV-04, GOV-06 | HIGH |
| 16 | `sgsd-complete-milestone/SKILL.md` includes all 8 step tags (`step_0_precondition` through `step_8_state_bump`) OR equivalent numbered sections | 13-05 | D-16 | HIGH |

**GOV-07 mechanical check:** invariant 10 only verifies the TEMPLATE has the `## Post-Synthesis Reflection` header. Actual reflection content presence is a per-DLB runtime check (GOV-05 logs `reflection_captured: true/false` per D-15). Runtime behavior is not a verify.mjs invariant — it's checked by the sgsd-complete-milestone skill at milestone close, logged to `deliberation-outcomes.jsonl`.

**Citation:** `super-gsd/tools/plan-schema/node_modules/js-yaml` (dependency); `.planning/phases/10-gate-policy/verify.mjs:21-44` (fail(n, msg) pattern); `.planning/phases/12-machinery/verify.mjs:30-69` (function-export + fixture-roundtrip pattern).

**Confidence: HIGH.**

---

### Q10: Validation Strategy (Nyquist Dimension 8)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node built-in `assert` + js-yaml via createRequire (identical to Phase 9/10/12) |
| Config file | none — `.planning/phases/13-governance/verify.mjs` is standalone (ESM) |
| Quick run command | `node .planning/phases/13-governance/verify.mjs` |
| Full suite command | `for p in 09-atc-147-evidence 10-gate-policy 12-machinery 13-governance; do node .planning/phases/$p/verify.mjs \|\| exit $?; done` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Invariant(s) | File Exists Pre-Wave-0? |
|--------|----------|-----------|-------------------|--------------|-------------------------|
| GOV-01 | Escalation policy loads + predicates parse | unit | `node verify.mjs` | 3 | ❌ Wave 0 (plan 13-01) |
| GOV-02 formula | signed-sum math correct on fixtures | unit | `node verify.mjs` | 6, 7 | ❌ Wave 0 (plan 13-02) |
| GOV-02 retro | 6 RESCORE files exist + parse + have required fields | unit | `node verify.mjs` | 14 | ❌ Wave 0 (plan 13-06) |
| GOV-03 | decision-memo.md has Falsifier + Dead Ends | unit | `node verify.mjs` | 10 | ❌ Wave 0 (plan 13-04) |
| GOV-04 | board-members.yaml activated + board-registry.cjs functional | unit | `node verify.mjs` | 1, 2, 4, 5 | ❌ Wave 0 (plan 13-01) |
| GOV-05 | deliberation-outcomes.jsonl schema present in skill code | semi-unit (grep check in SKILL.md) | `node verify.mjs` | 11 (indirectly — skill must reference the output path + all 8 fields) | ❌ Wave 0 (plan 13-05) |
| GOV-06 | 10-field YAML response format in 4 agent files + validator module | unit | `node verify.mjs` | 8, 9 | ❌ Wave 0 (plan 13-03) |
| GOV-07 | Post-Synthesis Reflection in template + runtime capture in audit | unit (template) + manual-only (runtime content quality) | `node verify.mjs` + manual SUMMARY inspection | 10 | ❌ Wave 0 (plan 13-04) |
| D-18a | Orchestrator auto-trigger present | unit | `node verify.mjs` | 12 | ❌ Wave 0 (plan 13-05) |
| D-18b | VTP 3-tier resilience in skill code | unit (grep) | `node verify.mjs` | 13 | ❌ Wave 0 (plan 13-05) |

### Sampling Rate
- **Per task commit:** `node .planning/phases/13-governance/verify.mjs` (only that plan's invariants should go green — others remain expected-red)
- **Per wave merge:** same — re-run full verify.mjs to confirm prior waves' invariants still green
- **Phase gate:** full-suite command above (4 phase verifiers) must all exit 0 before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `.planning/phases/13-governance/verify.mjs` — created in plan 13-07, grows invariant-by-invariant as each plan ships
- [ ] No other test infrastructure needed — js-yaml already pinned via Phase 10, node built-in `assert` sufficient
- [ ] No framework install needed — reuses Phase 10/12 pattern verbatim

### Manual-Only Checks (flagged explicitly)
- **GOV-07 "blind spots identified" content quality.** Invariant 10 verifies the template has the section header. Runtime reflection content quality (is it substantive, or just decorative) is checked per D-15 by the GOV-05 audit's `reflection_captured` flag (>50 chars prose), logged to `deliberation-outcomes.jsonl`. This is "mechanically testable" (length threshold) but **semantic quality is NOT** — a 51-character "I can't think of any blind spots" passes the length check but fails the intent. Operator review at milestone close is the only real quality gate. Accept this.
- **D-18b runtime VTP call success.** verify.mjs can grep for the 3-tier code paths in SKILL.md (invariant 13) but cannot confirm the actual MCP call succeeds without calling it. The first real milestone close is the live integration test. Accept this.

### Total Task Count Estimate

| Plan | Tasks | Rationale |
|------|-------|-----------|
| 13-01 (board-registry + escalation) | 4 | vote-predicate.cjs, board-registry.cjs, board-members.yaml activation, SKILL.md Step 2.5 insertion |
| 13-02 (vote-synthesis) | 2 | vote-synthesis.cjs, SKILL.md Step 5 integration |
| 13-03 (YAML responses + validator) | 5 | deliberation-schema.cjs + 4 agent file rewrites; CEO synthesis rubric edit counts as part of agent work |
| 13-04 (memo template extension) | 2 | decision-memo.md edit, sgsd-deliberate Step 5 rubric reference |
| 13-05 (sgsd-complete-milestone + VTP + auto-trigger) | 5 | skill scaffolding, 8 step bodies, orchestrator Step 6.7 insertion, VTP 3-tier logic, gap memo template |
| 13-06 (retro rescore) | 7 | 6 per-DLB tasks + 1 divergence-count summary task |
| 13-07 (verify.mjs + full-suite close) | 2 | verify.mjs authoring with 13-16 invariants, phase 13 SUMMARY.md |
| **Total** | **27 tasks** | |

This is toward the high end of CONTEXT.md's "~20-25" estimate — rescore (7) and VTP (5) inflate the count. Acceptable: each task is small and mechanical.

**Confidence: HIGH.**

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| js-yaml | (pinned in `super-gsd/tools/plan-schema/node_modules/`) | YAML load/parse | Already used by gates-registry.cjs, validate.cjs, verify.mjs across Phase 9/10/12 — zero new dependency cost |
| Node `fs`, `path`, `crypto` | built-in | File I/O, hashing | Standard library only; no new deps |
| Node `assert` | built-in | verify.mjs invariants | Standard library |

**No npm install required.** js-yaml is loaded via `createRequire` + absolute path to the pinned location — pattern from `gates-registry.cjs:40-45` and `09/verify.mjs:12` and `12/verify.mjs:13`. Keep it identical.

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None needed | — | — | — |

---

## Architecture Patterns

### System Architecture (conceptual flow)

```
/sgsd-deliberate <brief>
        │
        ▼
[Step 0 gates] ──────► [Step 2.5: Resolve Roster (NEW)]
                                │
                                ▼
                       board-registry.cjs::loadBoard()
                                │                 ◄── board-members.yaml
                                ▼
                       minimal-2 + always-present → roster[]
                                │
                                ▼
              [Step 3: Round 1 — parallel Agent() per roster member]
                                │
                                ▼
                       Each agent emits 10-field YAML response
                                │
                                ▼
                       deliberation-schema.cjs::validate(yaml)
                                │                 ◄── (retry once on malformed)
                                ▼
                       round1Results[]
                                │
                                ▼
              [Step 4: board-registry.resolveRoster(brief, round1Results)]
                                │                 ◄── vote-predicate.cjs::evalVotePredicate
                                ▼
                       Maybe Round 2 with augmented roster
                                │
                                ▼
              [Step 5: Synthesize]
                  │
                  ├─► vote-synthesis.cjs::synthesize(members) → { decision, sum, tiebreaker_applied }
                  ├─► Write DLB-NN.md with ## Falsifier + ## Dead Ends + ## Post-Synthesis Reflection
                  └─► CEO writes reflection inline (same context, no new Agent())
                                │
                                ▼
                       .planning/decisions/DLB-NN.md (memo)

—————————————————————————————————————————————————————————————————————

/sgsd-orchestrate ... (milestone running)
        │
        ▼
[Step 6.6.i marks phase complete]
        │
        ▼
[Step 6.7: Auto-trigger check (NEW)]
        │
        ▼ (if all milestone phases [x] in ROADMAP.md)
        │
Agent(sgsd-complete-milestone, mode: "bypassPermissions")
        │
        ▼
[Steps 0-8 of sgsd-complete-milestone]
        │
        ├─► GOV-05 audit → deliberation-outcomes.jsonl
        ├─► MUDA recurrence (sgsd-muda-recurrence.sh)
        ├─► Edge-guard drift audit
        ├─► Cross-phase integration check
        ├─► SUMMARY.md generation
        │
        ├─► VTP INGEST (pull enrichment) ─── mcp__vtp-kb__vtp_search, vtp_list_research
        │
        ├─► VTP PUBLISH (3-tier ladder) ──── mcp__vtp-kb__vtp_ingest_research
        │         │
        │         ├── tier-1: classification: "Milestone"  (if schema accepts)
        │         ├── tier-2: classification: "Milestone (SGSD v2)" + VTP-CLASSIFICATION-GAP.md
        │         └── tier-3: best-fit + sgsd_type metadata + VTP-CLASSIFICATION-GAP.md urgency HIGH
        │
        ├─► Archive phases/ → .planning/milestones/{version}/phases/
        └─► STATE.md bump to next milestone
```

### Recommended Project Structure (additions only)

```
super-gsd/
├── registry/
│   └── board-members.yaml                    (activate: state draft → active, board_version v1→v2)
├── scripts/lib/
│   ├── board-registry.cjs                    (NEW — 50 LOC, mirrors gates-registry.cjs)
│   ├── vote-synthesis.cjs                    (NEW — 40 LOC pure function)
│   ├── vote-predicate.cjs                    (NEW — 80 LOC escalation predicate eval)
│   └── deliberation-schema.cjs               (NEW — 50 LOC YAML validator)
├── agents/
│   ├── sgsd-board-architect.md               (response format update to 10-field YAML)
│   ├── sgsd-board-contrarian.md              (same)
│   ├── sgsd-board-moonshot.md                (same)
│   └── sgsd-board-pragmatist.md              (same)
├── skills/
│   ├── sgsd-deliberate/SKILL.md              (insert Step 2.5 roster resolution; rewrite lines 103-112; Step 5 add synth call)
│   ├── sgsd-orchestrate/SKILL.md             (insert Step 6.7 auto-trigger after line 677)
│   └── sgsd-complete-milestone/              (NEW SKILL — ~300 lines)
│       └── SKILL.md
├── templates/
│   └── decision-memo.md                      (add ## Falsifier, ## Dead Ends, ## Post-Synthesis Reflection)

.planning/
├── decisions/
│   ├── DLB-01-RESCORE.md                     (NEW)
│   ├── DLB-02-RESCORE.md                     (NEW)
│   ├── DLB-03-RESCORE.md                     (NEW)
│   ├── DLB-04-RESCORE.md                     (NEW)
│   ├── DLB-05-RESCORE.md                     (NEW)
│   └── DLB-06-RESCORE.md                     (NEW)
├── metrics/
│   └── deliberation-outcomes.jsonl           (NEW — populated at first milestone close post-13)
└── phases/13-governance/
    └── verify.mjs                             (NEW — 13-16 invariants)
```

### Pattern: Process Singleton with createRequire
```javascript
// Mirror of gates-registry.cjs:40-45 (Phase 10 established)
const yamlLibPath = path.resolve(
  __dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml'
);
const yaml = require(yamlLibPath);
```
Warning block: `PROCESS SINGLETON` JSDoc per `gates-registry.cjs:24-28` — tests must `resetCache()` in afterEach.

### Pattern: Fail-Loud on Unknown Field (D-10c)
```javascript
// Mirror of predicate-eval.cjs:62-69
if (cur == null || !(p in cur)) {
  throw new Error(`deliberation response missing field '${dotPath}' (unknown at '${p}')`);
}
```

### Anti-Patterns to Avoid
- **Do NOT extend `predicate-eval.cjs` with array/iteration ops.** Phase 10 contract drift. New module `vote-predicate.cjs`.
- **Do NOT make CEO reflection a separate Agent() dispatch.** D-14a is explicit: reflection is prompt-append in same context. ~200 tokens, not a second round-trip.
- **Do NOT hardcode `Milestone` as VTP classification.** D-18b three-tier ladder is the contract.
- **Do NOT silently continue on malformed YAML board response.** Phase 10 D-10c pattern: loud-fail, retry once, then escalate.
- **Do NOT let sgsd-complete-milestone crash on VTP call failure.** Skill must be idempotent — VTP-CLASSIFICATION-GAP.md is the fallback, never an unhandled exception.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML parsing | custom parser | `yaml.load()` via createRequire | js-yaml already pinned for Phase 10/12 |
| Predicate evaluation (scalar ctx) | string eval | `predicate-eval.cjs` | Phase 10 pattern, already verified |
| Cached registry loading | custom memoization | `gates-registry.cjs` clone | ~40 LOC pattern with known correctness |
| Vote math | inline in SKILL.md prose | `vote-synthesis.cjs` | Testable in verify.mjs; pure function |
| MUDA recurrence counting | from-scratch | `sgsd-muda-recurrence.sh --kill-check` | Already shipped; called via Bash from the new skill |
| Milestone phase iteration | custom globbing | `Read ROADMAP.md` + `[x]` grep | STATE.md frontmatter tells you which milestone |
| VTP classification robustness | assume the API works | D-18b three-tier ladder | VTP schema unknown; ladder handles all three outcomes |
| Schema drift detection | custom hashing | reuse Phase 11 `schema_v2_hash` pattern from config.json | Already established at orchestrator cold-start |

---

## Common Pitfalls

### Pitfall 1: Module cache pollution across verify.mjs invariants
**What goes wrong:** verify.mjs invariants 5 and 6 both call `boardReg.loadBoard()` on different fixtures; the process singleton cache returns the first load for both.
**Why it happens:** `_cache` is module-level state; `require(...)` returns the same module instance per process.
**How to avoid:** Every invariant that exercises the cache must call `boardReg.resetCache()` first. Mirror Phase 10 test discipline in `gates-registry.cjs:24-28` warning.

### Pitfall 2: Escalation predicate on empty first-round results
**What goes wrong:** Before Round 1 runs, `firstRoundResults` is undefined; predicate evaluators on `m.position` throw.
**Why it happens:** `resolveRoster` has two modes but the predicate module doesn't know which.
**How to avoid:** `resolveRoster(brief)` with one arg returns minimal roster WITHOUT consulting predicates (plain default). Predicates only fire in `resolveRoster(brief, firstRoundResults)` with results present.

### Pitfall 3: CEO reflection "decoration" — passing GOV-07 mechanically but missing the intent
**What goes wrong:** CEO writes a 60-char filler ("No blind spots noticed.") to satisfy verify.mjs invariant 10 + GOV-05's `reflection_captured: true` threshold.
**Why it happens:** Length thresholds are mechanical; intent is semantic.
**How to avoid:** Accept it. Verify.mjs cannot prevent semantic-quality drift. Operator review at milestone close is the gate. Document this honestly in SUMMARY.md ("reflection content quality not machine-verifiable — manual check at close").

### Pitfall 4: VTP classification gap cascade
**What goes wrong:** D-18b tier-3 (fixed-enum + metadata tag) publishes as `type: "research"`, and future `vtp_list_research({type: "research"})` queries pull back SGSD milestones alongside actual research papers — noise.
**Why it happens:** tier-3 compromises discoverability for round-trippability.
**How to avoid:** tier-3 VTP-CLASSIFICATION-GAP.md is marked **urgency HIGH** per D-18b spec. Operator must lobby VTP maintainers to add `Milestone` type before >1 milestone closes this way. Tracked as a non-negotiable v1.3 dependency.

### Pitfall 5: Retro rescore token-budget blowout
**What goes wrong:** Single task fires 24 Agent()s, all 24 reports return in one orchestrator turn, context hits 70% mid-rescore, checkpoint fires, rescore state is mid-flight.
**Why it happens:** Option A (24 parallel) saves wall time but breaks the loop's checkpoint discipline.
**How to avoid:** Option B — 6 serial tasks, 4-parallel within each task, per-task commit. Each task's orchestrator return is bounded.

### Pitfall 6: sgsd-complete-milestone first-run re-entry on a half-closed milestone
**What goes wrong:** Skill starts, writes deliberation-outcomes.jsonl, crashes at VTP call. Operator re-runs — writes duplicate rows.
**Why it happens:** Idempotency claim requires each side-effect to be check-then-act.
**How to avoid:** Every write in the skill is idempotent: GOV-05 audit reads existing jsonl, skips already-logged DLBs. SUMMARY.md check at Step 0 catches "already closed" case. Archive move is safe because source dirs no longer exist after first run.

---

## Runtime State Inventory

Not a rename/refactor phase. **Skipping.** (Skill is additive + extending existing files, no renames or migrations of existing stored data.)

One near-miss to call out: **classifier-cache sidecars.** When Phase 13 archives phase dirs to `.planning/milestones/v1.2/phases/`, the `.classifier.json` sidecars move with them. Phase 12 D-03 staleness check is mtime-based, so moved sidecars remain valid — no action needed. But confirm in plan 13-05 Step 7 that `mv` preserves mtimes (default on POSIX; on Windows confirm `Move-Item -Force`).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | verify.mjs, all lib modules | ✓ (Phase 10/12 used it) | ≥18 (for ESM) | — |
| js-yaml (pinned) | registry loading, validator | ✓ `super-gsd/tools/plan-schema/node_modules/js-yaml` | (pinned by Phase 10) | — |
| `mcp__vtp-kb__vtp_ingest_research` | 13-05 Step 6b | **unknown schema** | — | D-18b 3-tier ladder |
| `mcp__vtp-kb__vtp_search`, `vtp_list_research` | 13-05 Step 6a | ✓ (used in activity log) | — | skip enrichment pull, log in SUMMARY |
| bash | sgsd-muda-recurrence.sh | ✓ (WSL + macOS + Linux) | — | PowerShell wrapper exists for Windows |
| git | D-10 rework/falsifier detection | ✓ | — | — |

**Missing dependencies with no fallback:** None. VTP classification is handled by D-18b three-tier resilience.

**Missing dependencies with fallback:** VTP ingest schema is the one unknown; 3-tier ladder covers all paths.

---

## Code Examples

### Load board-members.yaml and resolve minimal roster
```javascript
// Source: mirrors super-gsd/scripts/lib/gates-registry.cjs:38-55
const boardReg = require('super-gsd/scripts/lib/board-registry.cjs');
const BOARD_YAML = 'super-gsd/registry/board-members.yaml';
const roster = boardReg.resolveRoster(brief); // [architect, contrarian, ceo] by default
```

### Round-2 escalation check
```javascript
// After round 1 collects 4 structured YAML responses:
const round1 = [
  { role: 'Technical Architect',   position: 'SUPPORT', confidence: 3, ... },
  { role: 'Contrarian Challenger', position: 'OPPOSE',  confidence: 5, ... },
];
const round2Roster = boardReg.resolveRoster(brief, round1);
// Escalation policy sees Contrarian OPPOSE with confidence 5 → adds Pragmatist for round 2.
```

### Vote synthesis
```javascript
// Source: Phase 13 new module vote-synthesis.cjs
const { synthesize } = require('super-gsd/scripts/lib/vote-synthesis.cjs');
const { decision, sum, tiebreaker_applied, raw_votes } = synthesize(round2Results);
// decision: 'SUPPORT' | 'OPPOSE' | 'TIE'
// sum: signed integer (+confidence for SUPPORT, -confidence for OPPOSE, 0 for ABSTAIN)
```

### Deliberation-schema validation with retry
```javascript
const deliberationSchema = require('super-gsd/scripts/lib/deliberation-schema.cjs');
async function parseBoardResponse(memberName, rawResponse, retries = 1) {
  const { valid, errors, parsed } = deliberationSchema.validate(rawResponse);
  if (valid) return parsed;
  if (retries === 0) throw new Error(`board '${memberName}' malformed after retry: ${errors.join('; ')}`);
  // Retry with schema reminder
  const retry = await Agent({ subagent_type: memberName, prompt: originalPrompt + `\nSCHEMA ERRORS: ${errors.join('; ')}. Re-emit valid YAML with ALL 10 required fields.` });
  return parseBoardResponse(memberName, retry, retries - 1);
}
```

### VTP 3-tier publish ladder (pseudocode from plan 13-05)
```
try {
  const result = mcp__vtp-kb__vtp_ingest_research({
    title: `SGSD Milestone ${version}`,
    body: summaryMd,
    classification: "Milestone",
    tags: ["sgsd", `milestone_${version}`]
  });
  vtp_classification_used = "Milestone";
} catch (tier1Err) {
  try {
    const result = mcp__vtp-kb__vtp_ingest_research({
      title, body: summaryMd,
      classification: "Milestone (SGSD v2)",
      tags: [...]
    });
    vtp_classification_used = "Milestone (string)";
    writeVtpGapMemo({ tier: 2, urgency: "MEDIUM", detail: tier1Err.message });
  } catch (tier2Err) {
    const result = mcp__vtp-kb__vtp_ingest_research({
      title, body: summaryMd,
      classification: "research",              // or whatever fixed enum accepts
      metadata: { sgsd_type: "milestone", sgsd_version: version },
      tags: [...]
    });
    vtp_classification_used = "research (sgsd_type: milestone)";
    writeVtpGapMemo({ tier: 3, urgency: "HIGH", detail: tier2Err.message });
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded 4-agent dispatches in sgsd-deliberate SKILL.md | Runtime roster from `board-members.yaml` via board-registry.cjs | This phase (GOV-04) | Adding archetypes = edit YAML, not SKILL.md |
| Prose vote synthesis ("3-1 SUPPORT") | Signed-sum math with confidence weighting | This phase (GOV-02) | Decision formula is testable, tiebreak is explicit |
| Prose board responses | 10-field structured YAML per agent | This phase (GOV-06) | Rubric-driven aggregation, machine-parseable |
| Manual milestone close via `/gsd-complete-milestone <version>` | Auto-triggered `sgsd-complete-milestone` at all-phases-[x] | This phase (D-18a) | Zero operator prompt on happy path |
| One-way milestone artifacts | Bidirectional VTP (ingest enrichment + publish) | This phase (D-16 item 6) | Milestone summaries are queryable across projects |

**Deprecated/outdated:**
- Legacy `~/.claude/skills/gsd-complete-milestone/SKILL.md` (126 lines) — replaced by new `super-gsd/skills/sgsd-complete-milestone/SKILL.md`. Global install becomes a symlink or copy of the new skill.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `mcp__vtp-kb__vtp_ingest_research` accepts a `classification` parameter (string or enum) | Q5, VTP ladder | Skill publish fails tier-1; falls to tier-2/3 gracefully — **no blocker** |
| A2 | `mcp__vtp-kb__vtp_list_research` supports a `type` filter or degrades silently | Q5, Step 6a enrichment | Ingest step returns untyped results; enrichment still works with filter post-processing |
| A3 | js-yaml version pinned at `super-gsd/tools/plan-schema/node_modules/js-yaml` is compatible with Phase 13 usage patterns | Standard stack | Very low — Phase 10/12 already use it identically |
| A4 | Phase 12 PARALLEL_CONFIRMED spike result generalizes to 4-way fan-out for board agents | Q8 retro rescore | If false, W4 runs 4× slower (~200k tokens seq vs ~50k parallel); still completes |
| A5 | DLB-NN frontmatter `brief:` field points to a readable file for all 6 DLBs | Q8 retro rescore | Verified by listing `.planning/briefs/` — all 6 briefs present |
| A6 | `sgsd-orchestrate/SKILL.md:677` is a stable insertion point (won't move before Phase 13 ships) | Q6 auto-trigger | Phase 13 W1 13-05 is authoritative — if another phase shifts lines, Phase 13 plan rebaselines |
| A7 | Escalation predicates are best expressed as structured YAML clauses, not the CONTEXT.md prose form | Q2 | If operator prefers verbatim prose form from D-01: spike at plan 13-01 start converts to string tokenizer; cost ~30 min |
| A8 | Global `~/.claude/skills/` + repo-tracked `super-gsd/skills/` is the correct dual-install strategy | Q7 | If operator prefers single-location: rebaseline plan 13-05 to write only to `~/.claude/skills/` — minor |

**A1 + A2 are the only non-trivial assumptions.** D-18b three-tier ladder makes A1 tolerant of any outcome; A2 is best-effort. All others are low-risk mechanical mirrors of verified patterns.

---

## Open Questions

1. **Should `escalate_add` triggers use structured clauses (like Phase 10 gates.yaml) or verbatim prose strings (like D-01 CONTEXT.md shows)?**
   - What we know: structured clauses verify.mjs-parseable; prose form matches CONTEXT.md exactly
   - What's unclear: operator preference
   - Recommendation: **ship structured clauses** in `board-members.yaml`, and include the prose form as a `trigger_prose:` comment field per clause. If operator objects at plan-check, pivot to string tokenizer (30-min spike, well-defined).

2. **Should sgsd-complete-milestone ship in `super-gsd/skills/` (repo-tracked) or `~/.claude/skills/` (user-local) or both?**
   - What we know: D-16 says `.claude/skills/` (ambiguous — could be either). Existing `gsd-complete-milestone` is user-local. SGSD 2.0 native skills like sgsd-orchestrate are repo-tracked.
   - Recommendation: **repo-tracked primary** — ship in `super-gsd/skills/sgsd-complete-milestone/SKILL.md`, installer copies to user-local on install.

3. **Does the Phase 11 `v2_legacy: true` flag apply to pre-Phase-11 plans at milestone close?**
   - What we know: D-17 says "all milestone plans must have `schema_version: 2` frontmatter OR a documented `v1_legacy: true` flag". Current v1.2 plans are mixed (Phase 9 v1, Phase 10+ v2).
   - What's unclear: whether Phase 9 plans retroactively need `v1_legacy: true` before v1.2 close
   - Recommendation: plan 13-05 Step 0 precondition check is LENIENT — accepts absence of `schema_version` as implicit v1. Strict check (require either) is a v1.3 enhancement.

4. **Retro rescore timing vs. milestone close trigger.** Plan 13-06 runs DURING phase 13 (before milestone close). If auto-trigger fires at phase 13 complete, the rescore outputs are already present and GOV-05 audit re-logs them. Is double-log acceptable? 
   - Recommendation: rescore outputs are DLB-NN-RESCORE.md files, NOT deliberation-outcomes.jsonl rows. Different artifacts. GOV-05 reads DLB-NN frontmatter (original votes), not RESCORE files. No double-log risk.

---

## Implementation Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | VTP schema probe in plan 13-05 reveals no `classification` field at all (pure fixed-enum API) | LOW-MED | HIGH — forces tier-3, high-urgency gap memo, noisy VTP queries cross-milestone | D-18b ladder handles it; SUMMARY.md frontmatter flags `vtp_classification_used` honestly |
| R2 | Phase 10 `predicate-eval.cjs` gets accidentally imported by `vote-predicate.cjs` and one module's change breaks the other | MED | HIGH — regresses both Phase 10 and Phase 13 | Zero-import rule: `vote-predicate.cjs` has no `require('./predicate-eval.cjs')`. Verify.mjs invariant inspects vote-predicate.cjs imports. |
| R3 | 4 board agent files drift out of sync during plan 13-03 — one has 10 fields, others have 9 | MED | MED — CEO synthesis sees inconsistent shapes | Invariant 9 checks all 4 files for all 10 field names; verify.mjs fails if any diverge |
| R4 | Retro rescore fires 24 Agent dispatches mid-phase-13, hits context 70% threshold, checkpoint fires mid-rescore | MED | HIGH — re-entry must resume partial rescore | Option B batching (6 serial tasks) + each task commits its DLB-NN-RESCORE.md; resume picks up from next uncommitted DLB |
| R5 | Auto-trigger Step 6.7 loops infinitely if sgsd-complete-milestone doesn't mark STATE.md `milestone_status: complete` or bump to next milestone | LOW | HIGH — orchestrator never exits | Invariant: Step 8 STATE.md bump is mandatory; sgsd-complete-milestone's idempotency check at Step 0 returns PASS if already complete, preventing re-fire |
| R6 | GOV-05 audit's `falsifier_fired` heuristic is unreliable (hard to match "evidence that proves DLB wrong" in free-form phase artifacts) | MED | LOW — metric is calibration-only, not a gate | D-11: "rough — good enough for calibration, not a contract". Operator accepts noise; v1.3 can sharpen. |
| R7 | sgsd-complete-milestone's archive step collides with ongoing git operations in other terminals | LOW | MED | Skill commits before archive; `git status` check at Step 7 entry; emit BLOCKER if dirty |
| R8 | Legacy `~/.claude/skills/gsd-complete-milestone/` still auto-invoked by shortcut despite new sgsd-* skill | LOW | LOW — confusion, not correctness | Legacy skill unchanged; operator invokes `sgsd-complete-milestone` explicitly; auto-trigger always uses the new one |

---

## Recommended Plan Decomposition (validates D-19..D-21)

### Seven plans (per D-19 — no change)

| Plan | Title | Files Touched | Tasks | Validates GOV |
|------|-------|---------------|-------|---------------|
| **13-01** | Board registry + escalation policy + `vote-predicate.cjs` | `board-members.yaml`, `board-registry.cjs` (NEW), `vote-predicate.cjs` (NEW), `sgsd-deliberate/SKILL.md` Step 2.5 | 4 | GOV-01, GOV-04 |
| **13-02** | `vote-synthesis.cjs` signed-sum | `vote-synthesis.cjs` (NEW), `sgsd-deliberate/SKILL.md` Step 5 | 2 | GOV-02 (formula) |
| **13-03** | Structured YAML responses + `deliberation-schema.cjs` validator + rubric-driven CEO synthesis | `deliberation-schema.cjs` (NEW), 4× `agents/sgsd-board-*.md`, `sgsd-deliberate/SKILL.md` Step 3 + Step 5 rubric | 5 | GOV-06 |
| **13-04** | Decision memo template extension | `templates/decision-memo.md`, `sgsd-deliberate/SKILL.md` Step 5 section list | 2 | GOV-03, GOV-07 |
| **13-05** | New `sgsd-complete-milestone` skill + bidirectional VTP + orchestrator auto-trigger + gap memo template | `super-gsd/skills/sgsd-complete-milestone/SKILL.md` (NEW), `super-gsd/templates/vtp-classification-gap.md` (NEW), `sgsd-orchestrate/SKILL.md` Step 6.7 | 5 | D-16, D-17, D-18, D-18a, D-18b, GOV-05 scoring audit |
| **13-06** | Retro DLB-01..06 rescore | 6× `decisions/DLB-0N-RESCORE.md` (NEW); 1× divergence-summary file | 7 | GOV-02 (validation) |
| **13-07** | Phase 13 verify.mjs + full-suite close + Phase 13 SUMMARY | `.planning/phases/13-governance/verify.mjs` (NEW), `.planning/phases/13-governance/13-SUMMARY.md` | 2 | D-21 (all invariants green) |

**Total: 27 tasks across 7 plans.** Matches CONTEXT.md high-end estimate with expected overhead from retro (7) and skill (5) tasks.

### Five waves (per D-20 — validated)

| Wave | Plans | Parallelism Evidence | Serial Reason |
|------|-------|----------------------|---------------|
| **W1 parallel** | {13-01, 13-04, 13-05} | **files disjoint**: 13-01 touches board-*.yaml + lib/*.cjs + sgsd-deliberate (Step 2.5 insertion point); 13-04 touches decision-memo.md template + sgsd-deliberate Step 5 section list; 13-05 touches NEW skill dir + sgsd-orchestrate (Step 6.7 insertion) + NEW template. sgsd-deliberate edits are at DIFFERENT steps (Step 2.5 vs Step 5) — concurrent edits risk merge conflict. | **CLARIFICATION:** 13-01 and 13-04 both touch sgsd-deliberate/SKILL.md at different sections. Phase 12 PARALLEL_CONFIRMED shows dispatch-planner detects file overlap and serializes. This wave as defined would SERIALIZE 13-01 and 13-04 due to shared file. See revision below. |
| **W2 serial** | {13-02} | — | Shared file: `sgsd-deliberate/SKILL.md` (Step 5 edit; depends on 13-04's new section layout if 13-04 reordered). |
| **W3 serial** | {13-03} | — | Shared file: `sgsd-deliberate/SKILL.md` (Step 3 + rubric edits); also 4 agent files. Must follow 13-02. |
| **W4 serial** | {13-06} | — | Needs 13-02 (synth module) + 13-03 (YAML schema for board agents). |
| **W5 serial** | {13-07} | — | verify.mjs depends on everything; final commit. |

### **CRITICAL REVISION to D-20 Wave 1 parallelism**

D-20 asserts W1 {13-01, 13-04, 13-05} can run in parallel because "files disjoint." **Audit finds this is FALSE for 13-01 and 13-04** — both touch `super-gsd/skills/sgsd-deliberate/SKILL.md`:
- 13-01 inserts Step 2.5 (roster resolution) — between current Step 2 and Step 3
- 13-04 edits Step 5 synthesis section list + Step 5 rubric mention of Falsifier/Dead Ends

dispatch-planner.cjs will detect the file overlap and **serialize** them automatically (per `hasInternalConflict` logic at lines 34-47).

**Recommended revised wave model:**

| Wave | Plans | Rationale |
|------|-------|-----------|
| W1 parallel | {13-04, 13-05} | truly disjoint (decision-memo.md + new skill dir; sgsd-orchestrate Step 6.7 vs sgsd-deliberate Step 5 — different SKILL files) |
| W2 serial | {13-01} | edits sgsd-deliberate/SKILL.md Step 2.5 — follows 13-04's Step 5 edit to avoid overlap |
| W3 serial | {13-02} | edits sgsd-deliberate/SKILL.md Step 5 — follows 13-01 |
| W4 serial | {13-03} | edits sgsd-deliberate/SKILL.md Step 3 + 4 agent files — follows 13-02 |
| W5 serial | {13-06} | retro rescore — depends on 13-02 + 13-03 |
| W6 serial | {13-07} | verify.mjs — final |

**Net effect of revision:** 5 waves → 6 waves; W1 stays 2-parallel (was 3). Wall time change: minimal (Phase 12 parallelism benefit on 2 vs 3 is negligible; serialization saves a merge-conflict hour).

**Alternative:** Keep D-20 5-wave structure but have 13-01 and 13-04 coordinate via `super-gsd/skills/sgsd-deliberate/SKILL.md` carefully — 13-01 inserts Step 2.5 as a wholly new block (no collision with Step 5 edits by 13-04). If dispatch-planner's file-level conflict detection is too coarse, operator can override by declaring both plans NON-conflicting via sibling-task depends_on. 

**Recommendation: revise to 6-wave (safer) unless operator opts into manual override.**

---

## Sources

### Primary (HIGH confidence)
- `super-gsd/skills/sgsd-deliberate/SKILL.md:1-211` — current deliberate flow, hardcoded dispatch at lines 92-114, Step 5 synthesis at 157-189
- `super-gsd/skills/sgsd-orchestrate/SKILL.md:160, 336, 440-506, 554-693, 677` — loop exit check, rule 6.g, phase ATC, browser verify, phase-complete mark
- `super-gsd/registry/board-members.yaml:1-138` — current 4 members + scaffold escalation_policy (state: proposed)
- `super-gsd/scripts/lib/gates-registry.cjs:1-97` — process-singleton + createRequire js-yaml pattern
- `super-gsd/scripts/lib/predicate-eval.cjs:1-96` — scalar predicate evaluator (pattern to diverge from for array ops)
- `super-gsd/scripts/lib/vote-synthesis.cjs` — does NOT exist yet; shape derived from `context-gauge.cjs:1-52` (pure function pattern)
- `super-gsd/scripts/lib/dispatch-planner.cjs:34-47` — file-conflict detection logic (bears on D-20 revision)
- `super-gsd/agents/sgsd-board-{architect,contrarian,moonshot,pragmatist}.md:1-39 each` — current response formats (Position|Risk|Key Argument|... 4-5 fields, prose-y)
- `super-gsd/templates/decision-memo.md:1-50` — current 7-section template
- `.planning/decisions/DLB-01..06.md` — all 6 exist, all frontmatter `brief:` fields point to existing briefs
- `.planning/briefs/2026-04-{19,20,21}-*.md` — all 6 retro briefs exist, 50-150 lines each with full Situation/Stakes/Constraints/Key Questions
- `.planning/phases/{09,10,12}/verify.mjs` — three verifier patterns to mirror; exit-code-per-invariant, fail(n, msg) helper
- `~/.claude/skills/gsd-complete-milestone/SKILL.md:1-126` — legacy skill structure (8-step precedent)
- `super-gsd/scripts/sgsd-muda-recurrence.sh:1-40` — existing kill-check invocation shape for Step 2 of new skill

### Secondary (MEDIUM confidence)
- VTP MCP tool enumeration in `SGSD-2.0-architecture.html:400-420` — confirms tool names exist; parameter schemas unverified
- VTP activity log in `.planning/metrics/activity-log.jsonl:1867-1879, 2651-2652` — confirms tool search resolved `vtp_ingest_research`; never called in production
- Phase 12 PARALLEL_CONFIRMED spike verdict at `super-gsd/skills/sgsd-orchestrate/SKILL.md:308-334` — parallelism works for disjoint-file waves

### Tertiary (LOW confidence — flagged for operator validation)
- D-01 trigger string form vs structured-clause YAML form — operator preference, not researched
- VTP `classification` parameter shape — inferred from tool-name semantics; needs plan 13-05 Step 1 probe
- Repo-tracked vs user-local skill install preference — convention inferred from prior skill pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reuses Phase 10/12 js-yaml + createRequire verbatim
- Architecture (module shapes): HIGH — mirror of gates-registry.cjs, context-gauge.cjs, predicate-eval.cjs
- Escalation predicate strategy: HIGH on separate-module recommendation; MEDIUM on exact YAML shape
- Retro rescore batching: HIGH — Phase 12 PARALLEL_CONFIRMED gives the fan-out pattern
- VTP classification: MEDIUM — D-18b fallback is robust; exact API unconfirmed
- Orchestrator auto-trigger: HIGH — line 677 insertion point verified
- Skill structure: HIGH on 8-step flow; MEDIUM on exact install location
- Verify.mjs invariants: HIGH — 16 invariants enumerated with fixture shapes

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — mature stack; VTP API shape may shift if VTP maintainers ship schema changes before plan 13-05 runs)

---

## Project Constraints (from CLAUDE.md)

Key directives applicable to Phase 13 planning:

| Directive | Source | How Phase 13 Complies |
|-----------|--------|-----------------------|
| Never expose secrets via Read/cat | Global CLAUDE.md | Phase 13 does not read secrets; no risk |
| Use bg_shell (not bash tool) on Windows | Global CLAUDE.md | Plans use `bash ... ` command strings for bg_shell execution; operator runs via persistent shell |
| Claude Opus orchestrates, Sonnet executes, Haiku classifies | Project CLAUDE.md | All 27 Phase 13 tasks dispatch Sonnet executors; verify.mjs is node (no model); retro rescore dispatches Sonnet board agents |
| Compressed XML plans (~800 tokens) | Project CLAUDE.md | All 7 plans must use v2 schema + compressed XML per Phase 11 |
| Structured 300-word agent reports | Project CLAUDE.md | All Agent() dispatches mandate report_format with FILES_CHANGED/VERIFICATION/DEVIATIONS/BLOCKERS/SCRIPTS_CREATED/ONE_LINER |
| Commit after every unit; never batch | Project CLAUDE.md | Each task's report triggers commit; retro rescore has 6 commits (one per DLB) |
| sgsd-* prefix = actively upgraded | Global memory feedback | sgsd-complete-milestone is genuinely new (no v1 predecessor at this name) — sgsd-* prefix correct per D-16 |
| Never blanket-rename gsd-* → sgsd-* | Global memory feedback | Legacy `gsd-complete-milestone` is NOT renamed; new skill coexists |
| Mission Control reads STATE.md, git, file changes | Global CLAUDE.md | sgsd-complete-milestone Step 8 updates STATE.md, commits archive — dashboard reflects automatically |

---

End of RESEARCH.md. Ready for plan 13-01..13-07 authoring.

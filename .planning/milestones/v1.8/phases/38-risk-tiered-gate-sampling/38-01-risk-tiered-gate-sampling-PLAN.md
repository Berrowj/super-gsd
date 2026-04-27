---
plan_id: 38-01
phase: 38
title: Risk-Tiered Gate Sampling
schema_version: 2
model: sonnet
expected_ATC_tier: FULL
requirements: [SAMPLE-01, SAMPLE-02, SAMPLE-03, SAMPLE-04, SAMPLE-05]
locked_decisions: [38.1, 38.2, 38.3, 38.4, 38.5]
depends_on: [32, 36]
created: 2026-04-27
tasks:
  - id: T1
    type: code
    files_touched:
      - super-gsd/scripts/lib/sampling-decider.cjs
      - super-gsd/registry/gates.yaml
      - super-gsd/scripts/lib/gates-registry.cjs
      - super-gsd/agents/sgsd-classifier.md
      - super-gsd/skills/sgsd-orchestrate/SKILL.md
      - super-gsd/scripts/lib/route-ledger.cjs
      - super-gsd/registry/command-envelope-v1.yaml
      - super-gsd/scripts/lib/sampling-decider.test.cjs
    hypothesis: "3x3 work_risk x gate_sampling_tier MATRIX reduces unnecessary gate fires on low-risk work without losing CRIT signal on high-risk work."
    falsifier: "MATRIX produces >50% skip rate on production workloads (signal thresholds wrong)."
    stop_rule: "self-test 17/17 PASS; --force-gates X without reason exits 1; with reason logs route-decisions.jsonl row with boundary=gate_override."
    minimal_test: "node super-gsd/scripts/lib/sampling-decider.cjs --self-test -> exit 0; node super-gsd/scripts/lib/sampling-decider.test.cjs -> exit 0; route-ledger.cjs --self-test -> exit 0 (BOUNDARIES extended to 7)."
must_haves:
  truths:
    - "MATRIX is Object.freeze 3x3 mapping {work_risk x gate_sampling_tier} -> {fire/skip/maybe}"
    - "WORK_RISKS = Object.freeze(['low','medium','high'])"
    - "SAMPLING_TIERS = Object.freeze(['always','sampled-rate-50','low-risk-skip'])"
    - "Public APIs never throw upward (mirrors Phase 32-37 locked design)"
    - "--force-gates X requires --override-reason or exits 1"
    - "BOUNDARIES extended 6 -> 7 (added 'gate_override') in route-ledger.cjs; self-test assertion #6 updated"
    - "Phase 31 envelope-v1 contract preserved: only reason_codes appended (extension protocol); registry_version semver patch bump"
  artifacts:
    - super-gsd/scripts/lib/sampling-decider.cjs (NEW ~280 LOC)
    - super-gsd/registry/gates.yaml (modified, +13 lines)
    - super-gsd/scripts/lib/gates-registry.cjs (modified, +11 lines)
    - super-gsd/agents/sgsd-classifier.md (modified, output schema)
    - super-gsd/skills/sgsd-orchestrate/SKILL.md (modified, 3 wire-ins + CLI)
    - super-gsd/scripts/lib/route-ledger.cjs (modified, BOUNDARIES + self-test)
    - super-gsd/registry/command-envelope-v1.yaml (modified, +2 reason_codes + version bump)
    - super-gsd/scripts/lib/sampling-decider.test.cjs (NEW ~100 LOC)
  key_links:
    - 38-CONTEXT.md
    - 38-RESEARCH.md (sec 2, 3, 4, 5, 6, 11 for matrix, mapping, classifier, wire-in, --force-gates, locks)
    - command-envelope-v1.yaml extension protocol (Phase 31 documented; semver patch bump only)
---

<objective>
Land the gate x work-risk intersection sampling matrix. New library
`super-gsd/scripts/lib/sampling-decider.cjs` maps
`(work_risk, gate_sampling_tier) -> {fire | skip | maybe}` against a 3x3
frozen matrix. Four call sites consume it: gates.yaml validation
(SAMPLE-01), classifier work_risk emission (SAMPLE-02), orchestrator
gate-fire intersection at three sites (SAMPLE-03), and a CLI
`--force-gates` / `--skip-gates` parser with mandatory `--override-reason`
(SAMPLE-04 + SAMPLE-05). Override reasons land in
`route-decisions.jsonl` via the Phase 32 route-ledger; this requires
extending the previously-frozen `BOUNDARIES` enum from 6 to 7 entries
(adding `gate_override`, named verbatim in mass-discuss line 187).

Purpose: replace blanket gate-firing with evidence-based sampling so
high-risk work still hits CRIT gates while low-risk work skips
expensive ones. Phase 39 rubric will then read the new
`sampled_skip` reason_code to differentiate trigger-skipped from
sampled-skipped fires.

Output: 3 new files, 5 edited files, atomic commits in dependency
order. Lib is filesystem-only + pure-function; live verification
cannot be blocked by `provider_unavailable`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP-AGENT.md
@.planning/milestones/v1.8/REQUIREMENTS.md
@.planning/milestones/v1.8/phases/38-risk-tiered-gate-sampling/38-CONTEXT.md
@.planning/milestones/v1.8/phases/38-risk-tiered-gate-sampling/38-RESEARCH.md
@super-gsd/registry/gates.yaml
@super-gsd/registry/command-envelope-v1.yaml
@super-gsd/scripts/lib/gates-registry.cjs
@super-gsd/scripts/lib/route-ledger.cjs
@super-gsd/scripts/lib/gate-value-log.cjs
@super-gsd/agents/sgsd-classifier.md
@super-gsd/skills/sgsd-orchestrate/SKILL.md

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->
<!-- Executor should use these directly -- no codebase exploration needed. -->

From super-gsd/scripts/lib/route-ledger.cjs (lines 56-64):
```js
// ROUTE-02: closed enum of 6 boundary types. Frozen.
const BOUNDARIES = Object.freeze([
  'milestone_promotion',
  'phase_dispatch_first',
  'executor_choice',
  'gate_skip',
  'codex_route',
  'handoff_decision',
]);
```
Phase 38 extension target: append `'gate_override'` (line 64 -> line 65).
Self-test assertion #1 currently reads `BOUNDARIES.length === 6`
(route-ledger.cjs:308-309); Phase 38 updates to `=== 7`.

From super-gsd/scripts/lib/route-ledger.cjs (line 200-208):
```js
function logRouteDecision(planningDir, args) {
  try {
    appendRow(planningDir, args || {});
    return true;
  } catch (e) {
    console.warn('[SGSD] route-ledger logRouteDecision failed:', e.message);
    return false;
  }
}
```
Public-API never-throws contract. sampling-decider.cjs follows the
same pattern: `shouldSample` wraps `decide` in try/catch and returns
`true` (safe default fire) on any internal error.

From super-gsd/scripts/lib/gates-registry.cjs (lines 38-76):
```js
function loadGates(gatesYamlPath) {
  if (_cache) return _cache;
  // ... yaml load ...
  // REPAIR-01 (Phase 33): instruction-presence soft-warn FIRST
  const repairChecker = require('./repair-command-checker.cjs');
  const presence = repairChecker.assertEveryBlockingGateHasInstruction({ gates: all });
  if (!presence.ok) {
    console.warn(`[SGSD] gates.yaml: missing repair_instruction on blocking gate(s): ${presence.missing.join(', ')}`);
  }
  // REPAIR-03 (Phase 33): validate every repair_command at LOAD time.
  const result = repairChecker.validateRepairCommands({ gates: all });
  if (!result.ok) {
    const detail = result.violations.map((v) => v.message).join('; ');
    _cache = null;
    throw new Error(`gates.yaml repair_command 4-AND violations: ${detail}`);
  }
  return _cache;
}
```
Phase 38 inserts the sampling-decider validation hook AFTER
`validateRepairCommands` and BEFORE `return _cache`, mirroring the
Phase 33 invalid-config-throw pattern. Soft-warn for missing field
(default 'always' applies); throw for invalid enum value.

From super-gsd/registry/command-envelope-v1.yaml (lines 132-150):
```yaml
      # Gate / review
      - code: atc_critical
      - code: atc_warn_only
      - code: review_unanimous_pass
      - code: review_split_decision
      - code: gate_skip_with_reason
      - code: gate_force_with_reason
```
Phase 38 appends two NEW codes to this group:
`gate_force_override_with_reason` and `gate_sampled_skip`. Bumps
`registry_version: 1.0.0` -> `1.0.1` (semver patch). NO schema
field-shape changes per Phase 31 contract (collides_with: []).

From super-gsd/agents/sgsd-classifier.md (lines 20-32):
```json
{
  "complexity": "light|standard|heavy",
  "model": "haiku|sonnet|opus",
  "atc_tier": "skip|lite|full|gate",
  "deliberate": false,
  "reason": "one sentence max"
}
```
Phase 38 inserts ONE field BEFORE `reason`:
`"work_risk": "low|medium|high"`. The agent prompt embeds the
scoreWorkRisk algorithm so Haiku returns the right answer; v2 plan
path imports `scoreWorkRisk` directly from sampling-decider.cjs.

From super-gsd/skills/sgsd-orchestrate/SKILL.md (line 595-597, 847, 1230-1231):
```js
// Site 1 (phase-level-ATC, line 595):
const phaseAtcFired = config.atc.enabled
  && gates.shouldFire('phase-level-ATC', ctx, GATES_YAML_PATH)
  && verification.status == "passed";

// Site 2 (MUDA-waste-audit, line 847):
const mudaFired = gates.shouldFire('MUDA-waste-audit', ctx, GATES_YAML_PATH);

// Site 3 (per-dispatch-ATC, line 1230-1231):
const perDispatchAtcFired = config.atc.enabled
  && gates.shouldFire('per-dispatch-ATC', ctx, GATES_YAML_PATH);
```
Phase 38 extends each with `&& samplingDecider.shouldSample({...})`
in-line (4 extra lines per site). NO touch to the 7 cheap
process-hygiene gates (their `gate_sampling_tier: always` makes the
matrix a no-op there per RESEARCH Q10 lock).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create sampling-decider.cjs library + 17-assertion self-test</name>
  <files>
    super-gsd/scripts/lib/sampling-decider.cjs (NEW)
  </files>
  <behavior>
    - decide({work_risk:'low', gate_sampling_tier:'always'}) -> 'fire'
    - decide({work_risk:'high', gate_sampling_tier:'low-risk-skip'}) -> 'fire'
    - decide({work_risk:'medium', gate_sampling_tier:'sampled-rate-50'}) -> 'maybe'
    - decide({work_risk:'low', gate_sampling_tier:'low-risk-skip'}) -> 'skip'
    - decide({work_risk:'banana', ...}) -> throw "work_risk must be one of low, medium, high"
    - decide({work_risk:'low', gate_sampling_tier:undefined}) -> 'fire' (default tier 'always')
    - scoreWorkRisk({diff_lines:10, files_touched_count:1, phase_type:'docs', phase_includes_security_review:false}) -> 'low'
    - scoreWorkRisk({diff_lines:200, files_touched_count:6, phase_type:'feature', phase_includes_security_review:true}) -> 'high'
    - scoreWorkRisk({diff_lines:50, files_touched_count:2, phase_type:'feature', phase_includes_security_review:false}) -> 'medium'
    - scoreWorkRisk with empty/null gate_fitness_history does NOT throw; secondary contributes 0
    - scoreWorkRisk secondary bias <=50% per primary (lock 38.2)
    - shouldSample({gate, work_risk, gates, gatesYamlPath, overrides:{force:Set([gate])}}) -> true
    - shouldSample({gate, work_risk, gates, gatesYamlPath, overrides:{skip:Set([gate])}}) -> false
    - validateGatesYaml accepts missing field as soft-warn ({ok:true, violations:[{severity:'soft-warn'}]})
    - validateGatesYaml rejects invalid enum as throw ({ok:false})
    - parseGateOverrides exits 1 (via child_process spawn) when --force-gates given without --override-reason
    - --self-test runs all 17 assertions in tmpdir; canonical gates.yaml + route-decisions.jsonl mtime/size unchanged after run
  </behavior>
  <action>
Create `super-gsd/scripts/lib/sampling-decider.cjs` (~280 LOC) mirroring
the Phase 36 `gate-value-log.cjs` architecture 1:1: frozen const enums,
public APIs never throw upward, `__dirname`-anchored fingerprint guard
in self-test, manual schema check (no ajv dep), defensive read.

REQUIRED file structure (in order):

1. Block comment header (lines 1-50; mirror gate-value-log.cjs:1-56
   format with phase-specific text):
   - Title `SGSD - SAMPLING-DECIDER 3x3 work-risk x gate-tier matrix`
   - Source-of-truth note (pure data + pure function; no JSONL writer)
   - Reference: 38-RESEARCH.md sec 2 (MATRIX), sec 3 (gates.yaml mapping),
     sec 4 (scoreWorkRisk), sec 6 (CLI parser), sec 7 (API), sec 9
     (self-test scaffold), sec 11 (LOCKED Q1-Q14)
   - Failure contract: NEVER throws upward at orchestrator boundary
   - Wire-in note: 4 in-phase consumers (gates-registry validation,
     classifier emission, 3 orchestrator wire-in sites, --force-gates CLI)

2. Requires (lines 52-58):
```js
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
```

3. Frozen constants (per RESEARCH sec 2 + sec 7):
```js
// Lock 38.1: 3 work-risk tiers
const WORK_RISKS = Object.freeze(['low', 'medium', 'high']);

// Lock 38.4 + sec 3: 3 gate-sampling tiers
const SAMPLING_TIERS = Object.freeze(['always', 'sampled-rate-50', 'low-risk-skip']);

// Sec 2: 3 verdicts
const VERDICTS = Object.freeze(['fire', 'skip', 'maybe']);

// Lock 38.4: default for unspecified gates
const DEFAULT_TIER = 'always';

// Sec 2 verbatim: 3x3 = 9 cells
const MATRIX = Object.freeze({
  'always':          Object.freeze({ low: 'fire', medium: 'fire', high: 'fire' }),
  'sampled-rate-50': Object.freeze({ low: 'skip', medium: 'maybe', high: 'fire' }),
  'low-risk-skip':   Object.freeze({ low: 'skip', medium: 'fire', high: 'fire' }),
});
```

4. Public API #1 - `decide({work_risk, gate_sampling_tier})` per RESEARCH sec 7.1:
```js
function decide({ work_risk, gate_sampling_tier }) {
  if (!WORK_RISKS.includes(work_risk)) {
    throw new Error(
      `sampling-decider: work_risk must be one of ${WORK_RISKS.join(', ')}; got '${work_risk}'`
    );
  }
  const tier = gate_sampling_tier || DEFAULT_TIER;
  if (!SAMPLING_TIERS.includes(tier)) {
    throw new Error(
      `sampling-decider: gate_sampling_tier must be one of ${SAMPLING_TIERS.join(', ')}; got '${tier}'`
    );
  }
  return MATRIX[tier][work_risk];
}
```

5. Public API #2 - `scoreWorkRisk(inputs)` per RESEARCH sec 4.2 verbatim:
```js
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function scoreWorkRisk({
  diff_lines,
  files_touched_count,
  phase_type,
  phase_includes_security_review,
  gate_fitness_history,
}) {
  const w_primary = 0.25;
  const w_secondary = 0.10;  // <= 0.5 * w_primary (lock 38.2)

  const s_diff = clamp01((diff_lines || 0) / 200);          // 200 lines = 1.0
  const s_files = clamp01((files_touched_count || 0) / 6);  // 6 files  = 1.0
  const s_type = ['docs', 'config'].includes(phase_type) ? 0
               : phase_type === 'refactor' ? 0.3
               : ['feature', 'bugfix'].includes(phase_type) ? 0.7
               : 0.5;
  const s_security = phase_includes_security_review ? 1.0 : 0;

  let total = w_primary * (s_diff + s_files + s_type + s_security);

  if (Array.isArray(gate_fitness_history) && gate_fitness_history.length) {
    const avg_block = gate_fitness_history
      .filter((g) => g.fires > 0)
      .reduce((s, g) => s + (g.block / g.fires), 0)
      / gate_fitness_history.length;
    total += w_secondary * clamp01(avg_block);
  }
  total = Math.min(1.0, total);

  if (total >= 0.6) return 'high';
  if (total >= 0.3) return 'medium';
  return 'low';
}
```

6. Public API #3 - `shouldSample(ctx)` per RESEARCH sec 7.2:
```js
function shouldSample({ gate, work_risk, gates, gatesYamlPath, overrides }) {
  try {
    if (overrides && overrides.force && overrides.force.has(gate)) return true;
    if (overrides && overrides.skip && overrides.skip.has(gate)) return false;
    const row = gates.getGate(gate, gatesYamlPath);
    const tier = (row && row.gate_sampling_tier) || DEFAULT_TIER;
    const verdict = decide({ work_risk, gate_sampling_tier: tier });
    if (verdict === 'fire') return true;
    if (verdict === 'skip') return false;
    return Math.random() < 0.5;  // 'maybe' arm; not seeded (lock Q4)
  } catch (e) {
    console.warn('[SGSD] sampling-decider shouldSample failed (firing as safe default):', e.message);
    return true;
  }
}
```

7. Public API #4 - `validateGatesYaml({gates})` per RESEARCH sec 7.4:
```js
function validateGatesYaml({ gates }) {
  const violations = [];
  for (const g of gates) {
    if (g.gate_sampling_tier === undefined) {
      violations.push({
        kind: 'missing', gate: g.name, severity: 'soft-warn',
        message: `gate '${g.name}' missing gate_sampling_tier (default '${DEFAULT_TIER}')`
      });
    } else if (!SAMPLING_TIERS.includes(g.gate_sampling_tier)) {
      violations.push({
        kind: 'invalid', gate: g.name, severity: 'throw',
        message: `gate '${g.name}' gate_sampling_tier='${g.gate_sampling_tier}' not in ${SAMPLING_TIERS.join(', ')}`
      });
    }
  }
  return { ok: violations.every((v) => v.severity !== 'throw'), violations };
}
```

8. Public API #5 - `parseGateOverrides(argv)` per RESEARCH sec 6.1
   verbatim. INCLUDES the unknown-gate validation per sec 6.1 last
   block (LOCKED Q14: exit 1 on typo'd gate name). NOTE the gate-name
   validation requires a gates loader; in `parseGateOverrides` itself
   we accept an injected validator function so tests can stub it:

```js
function parseGateOverrides(argv, validateGate /* optional fn(name) -> bool */) {
  const force = new Set();
  const skip = new Set();
  let reason = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force-gates' && argv[i + 1]) {
      argv[i + 1].split(',').map((g) => force.add(g.trim())); i++;
    } else if (a === '--skip-gates' && argv[i + 1]) {
      argv[i + 1].split(',').map((g) => skip.add(g.trim())); i++;
    } else if (a === '--override-reason' && argv[i + 1]) {
      reason = String(argv[i + 1]).trim(); i++;
    } else if (a.startsWith('--force-gates=')) {
      a.slice(15).split(',').map((g) => force.add(g.trim()));
    } else if (a.startsWith('--skip-gates=')) {
      a.slice(14).split(',').map((g) => skip.add(g.trim()));
    } else if (a.startsWith('--override-reason=')) {
      reason = a.slice(18).trim();
    }
  }

  // SAMPLE-05 hard rejection.
  if ((force.size > 0 || skip.size > 0) && (!reason || reason.length === 0)) {
    console.error('[SGSD] error: --force-gates/--skip-gates require --override-reason="..."');
    process.exit(1);
  }
  // LOCKED Q14: validate gate names; symmetric-set check.
  if (typeof validateGate === 'function') {
    for (const g of [...force, ...skip]) {
      if (!validateGate(g)) {
        console.error(`[SGSD] error: --force/skip-gates references unknown gate '${g}'`);
        process.exit(1);
      }
    }
  }
  for (const g of force) {
    if (skip.has(g)) {
      console.error(`[SGSD] error: gate '${g}' in both --force-gates and --skip-gates`);
      process.exit(1);
    }
  }
  return { force, skip, reason };
}
```

9. Self-test (`selfTest()`): 17 assertions per RESEARCH sec 9 verbatim.
   Setup: capture mtime/size of canonical
   `super-gsd/registry/gates.yaml` AND
   `.planning/metrics/route-decisions.jsonl` BEFORE any work; anchor
   paths to `__dirname` (NOT `process.cwd()`). Use
   `fs.mkdtempSync(path.join(os.tmpdir(), 'sd-'))` for fixture dir.

   The 17 assertions per RESEARCH sec 9:
   1. WORK_RISKS frozen + length 3 + low/medium/high present
   2. SAMPLING_TIERS frozen + length 3 + all three tiers present
   3. VERDICTS frozen + length 3 + fire/skip/maybe present
   4. MATRIX frozen at top + every nested level frozen (Object.isFrozen)
   5. decide() all 9 cells correct (iterate WORK_RISKS x SAMPLING_TIERS;
      verdicts match sec 2 table)
   6. decide() throws on bad work_risk ('banana' -> /work_risk must be one of/)
   7. decide() throws on bad gate_sampling_tier
   8. decide() default tier (gate_sampling_tier:undefined -> 'always' -> 'fire')
   9. scoreWorkRisk thresholds (5 fixture cases producing each of {low,medium,high})
   10. scoreWorkRisk secondary bias <=50% per primary (empty vs fully-blocked
       history must NOT cross a tier boundary at primary midpoint)
   11. scoreWorkRisk cold-start (gate_fitness_history undefined or [] does
       NOT throw; secondary contributes 0)
   12. validateGatesYaml accepts missing as soft-warn
   13. validateGatesYaml rejects invalid as throw
   14. validateGatesYaml accepts all 3 valid tiers ({ok:true, violations:[]})
   15. shouldSample respects force override
   16. shouldSample respects skip override
   17. parseGateOverrides exits 1 without --override-reason (via
       `spawnSync(process.execPath, [__filename, '--parse-test', '--force-gates', 'per-dispatch-ATC'])`;
       assert exit code 1 and stderr contains "require --override-reason")

   Bonus fingerprint guard (after all 17 + before pass/fail print):
   - canonical `super-gsd/registry/gates.yaml` mtime + size unchanged
   - canonical `.planning/metrics/route-decisions.jsonl` mtime + size unchanged

10. Main block (mirrors route-ledger.cjs:422-430):
```js
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === '--self-test') process.exit(selfTest());
  if (cmd === '--parse-test') {
    // Internal: assertion 17 invokes this with parseGateOverrides
    parseGateOverrides(process.argv.slice(2));
    process.exit(0);
  }
  console.log('Usage: node sampling-decider.cjs --self-test');
  console.log('  Or require() and call decide / shouldSample / scoreWorkRisk / validateGatesYaml / parseGateOverrides');
  console.log('  WORK_RISKS =', JSON.stringify(WORK_RISKS));
  console.log('  SAMPLING_TIERS =', JSON.stringify(SAMPLING_TIERS));
  process.exit(0);
}
```

11. Module exports (5 public APIs + 5 frozen constants):
```js
module.exports = {
  decide,
  shouldSample,
  scoreWorkRisk,
  validateGatesYaml,
  parseGateOverrides,
  MATRIX,
  WORK_RISKS,
  SAMPLING_TIERS,
  VERDICTS,
  DEFAULT_TIER,
};
```

ASCII-only. LF line endings. No new dependencies (Node stdlib only).

Commit: `feat(38-01): sampling-decider.cjs lib + 17-assertion self-test`
Stage: `super-gsd/scripts/lib/sampling-decider.cjs` only.
  </action>
  <verify>
    <automated>node super-gsd/scripts/lib/sampling-decider.cjs --self-test</automated>
  </verify>
  <done>
    File exists at super-gsd/scripts/lib/sampling-decider.cjs (~280 LOC).
    `node super-gsd/scripts/lib/sampling-decider.cjs --self-test` exits 0
    with stdout `sampling-decider self-test: 17 pass, 0 fail`.
    Module exports `decide`, `shouldSample`, `scoreWorkRisk`,
    `validateGatesYaml`, `parseGateOverrides`, `MATRIX`, `WORK_RISKS`,
    `SAMPLING_TIERS`, `VERDICTS`, `DEFAULT_TIER`. Canonical
    `super-gsd/registry/gates.yaml` and
    `.planning/metrics/route-decisions.jsonl` mtime/size unchanged.
    ASCII-only file. Atomic commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add gate_sampling_tier to all 13 gates + gates-registry validation</name>
  <files>
    super-gsd/registry/gates.yaml,
    super-gsd/scripts/lib/gates-registry.cjs
  </files>
  <behavior>
    - All 13 gates in gates.yaml have a `gate_sampling_tier:` line
    - Per-gate mapping matches RESEARCH sec 3 table verbatim
    - gates-registry.cjs::loadGates throws on invalid enum value at load time
    - gates-registry.cjs::loadGates soft-warns on missing field (none after this commit)
    - `grep -c '^[[:space:]]*gate_sampling_tier:' super-gsd/registry/gates.yaml` >= 13
    - Existing Phase 33 4-AND check still runs unchanged
  </behavior>
  <action>
**A2 - super-gsd/registry/gates.yaml (+13 lines)**

Per RESEARCH sec 3 mapping table, insert ONE `gate_sampling_tier:`
line per gate row. Position: directly after `enforcement_mode:` (or
after `enforcement_mode: ... # comment` where present).

The 13 edits, file:line pre-edit (use `Read` tool to confirm context
lines, then `Edit` tool with old_string/new_string for each):

1. **per-dispatch-ATC** (gates.yaml:41 enforcement_mode: hard-halt)
   Add line after: `    gate_sampling_tier: low-risk-skip`

2. **phase-level-ATC** (gates.yaml:66 enforcement_mode: amortized)
   Add line after: `    gate_sampling_tier: low-risk-skip`

3. **classifier-haiku** (gates.yaml:83 enforcement_mode: soft-warn)
   Add line after: `    gate_sampling_tier: always`

4. **context-selector-haiku** (gates.yaml:96 enforcement_mode: soft-warn)
   Add line after: `    gate_sampling_tier: always`

5. **sgsd-recall-queries** (gates.yaml:109 enforcement_mode: soft-warn)
   Add line after: `    gate_sampling_tier: sampled-rate-50`

6. **intent-injection** (gates.yaml:125 enforcement_mode: soft-warn)
   Add line after: `    gate_sampling_tier: always`

7. **MUDA-waste-audit** (gates.yaml:138 enforcement_mode: soft-warn)
   Add line after: `    gate_sampling_tier: low-risk-skip`

8. **qualitative-waste-audit** (gates.yaml:162 enforcement_mode: soft-warn)
   Add line after: `    gate_sampling_tier: sampled-rate-50`

9. **sgsd-curate-learnings** (gates.yaml:185 enforcement_mode: soft-warn)
   Add line after: `    gate_sampling_tier: sampled-rate-50`

10. **token-log** (gates.yaml:209 enforcement_mode: soft-warn)
    Add line after: `    gate_sampling_tier: always`

11. **vtp-enrichment** (gates.yaml:223 enforcement_mode: soft-warn  # api_error...)
    Add line after: `    gate_sampling_tier: low-risk-skip`

12. **verifier-row-arithmetic** (gates.yaml:244 enforcement_mode: soft-warn)
    Add line after: `    gate_sampling_tier: always`

13. **verifier-detail-vs-summary** (gates.yaml:259 enforcement_mode: soft-warn)
    Add line after: `    gate_sampling_tier: always`

ALSO bump `registry_version` (line 15): `2.1.0` -> `2.2.0` (semver minor;
new field added to all rows).

**A3 - super-gsd/scripts/lib/gates-registry.cjs (+11 LOC)**

Insert the validation hook AFTER the existing
`validateRepairCommands` block (currently at lines 65-73) and BEFORE
`return _cache` (line 75). The insertion point is line 74 (immediately
before `return _cache;`).

Edit (the new block):
```js
  // Phase 38 SAMPLE-01: validate gate_sampling_tier on every row.
  // Missing -> soft-warn (DEFAULT_TIER='always' applies per lock 38.4).
  // Invalid enum -> throw (poisoned config; orchestrator must NEVER
  // start with an unknown sampling tier).
  const samplingDecider = require('./sampling-decider.cjs');
  const samplingResult = samplingDecider.validateGatesYaml({ gates: all });
  if (!samplingResult.ok) {
    const detail = samplingResult.violations
      .filter((v) => v.severity === 'throw')
      .map((v) => v.message)
      .join('; ');
    _cache = null;
    throw new Error(`gates.yaml gate_sampling_tier violations: ${detail}`);
  }
  for (const v of samplingResult.violations.filter((s) => s.severity === 'soft-warn')) {
    console.warn('[SGSD] gates.yaml: ' + v.message);
  }
```

NO touch to existing repair-command-checker logic. NO touch to public
API (still exports `loadGates`, `getGate`, `shouldFire`, `resetCache`).

ASCII-only. LF.

Commit: `feat(38-01): gates.yaml +13 gate_sampling_tier; gates-registry validation`
Stage: `super-gsd/registry/gates.yaml super-gsd/scripts/lib/gates-registry.cjs`.
  </action>
  <verify>
    <automated>c=$(grep -c '^[[:space:]]*gate_sampling_tier:' super-gsd/registry/gates.yaml); [ "$c" -ge 13 ] || (echo "FAIL: expected >=13 got $c"; exit 1); node -e "delete require.cache[require.resolve('./super-gsd/scripts/lib/gates-registry.cjs')]; const g=require('./super-gsd/scripts/lib/gates-registry.cjs'); g.resetCache(); g.loadGates('super-gsd/registry/gates.yaml'); console.log('loaded ok');"</automated>
  </verify>
  <done>
    `grep -c '^[[:space:]]*gate_sampling_tier:' super-gsd/registry/gates.yaml`
    returns 13 (exactly one line per gate). Each tier value is one of
    `always | sampled-rate-50 | low-risk-skip` per RESEARCH sec 3 table.
    `gates-registry.cjs::loadGates('super-gsd/registry/gates.yaml')`
    completes without throw and emits NO soft-warn for missing
    gate_sampling_tier (all 13 present). `registry_version: 2.2.0`.
    Atomic commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Extend sgsd-classifier output schema with work_risk emission</name>
  <files>
    super-gsd/agents/sgsd-classifier.md
  </files>
  <behavior>
    - Classifier output JSON includes `work_risk: low|medium|high` between `deliberate` and `reason`
    - <rules> block documents the 4-primary + 1-secondary scoring algorithm
    - Tier prompts (lite/full/gate) unchanged (work_risk is dispatch-context, not ATC-tier-context)
  </behavior>
  <action>
**A4 - super-gsd/agents/sgsd-classifier.md (+8 lines, -2 lines)**

Edit the `<output>` block (lines 20-32):

OLD:
```json
{
  "complexity": "light|standard|heavy",
  "model": "haiku|sonnet|opus",
  "atc_tier": "skip|lite|full|gate",
  "deliberate": false,
  "reason": "one sentence max"
}
```

NEW:
```json
{
  "complexity": "light|standard|heavy",
  "model": "haiku|sonnet|opus",
  "atc_tier": "skip|lite|full|gate",
  "deliberate": false,
  "work_risk": "low|medium|high",
  "reason": "one sentence max"
}
```

ALSO append to the `<rules>` block (after the existing "Deliberation
trigger" section, before `</rules>`):

```
Work-risk scoring (Phase 38 SAMPLE-02; locked decisions 38.1-38.2):
- 4 primary inputs (each contributes weight 0.25):
  * diff_lines (clamp01(diff_lines / 200))
  * files_touched_count (clamp01(files_touched_count / 6))
  * phase_type (docs/config=0; refactor=0.3; feature/bugfix=0.7; else=0.5)
  * phase_includes_security_review (true=1.0; false=0)
- 1 secondary input (weight 0.10; <=50% of any primary per lock 38.2):
  * gate_fitness_history (avg block-rate from Phase 36 summarize();
    optional; cold-start contributes 0)
- Total clamped to 1.0; thresholds: total>=0.6 -> high; >=0.3 -> medium; else low.
- See super-gsd/scripts/lib/sampling-decider.cjs::scoreWorkRisk for the
  canonical implementation (single source of truth).
```

NO touch to `<tier_prompts>` block (work_risk is dispatch-context,
emitted alongside complexity/model/atc_tier; not consumed by lite/full/gate
prompt templates).

ASCII-only. LF.

Commit: `feat(38-01): sgsd-classifier emits work_risk (4 primary + 1 secondary)`
Stage: `super-gsd/agents/sgsd-classifier.md`.
  </action>
  <verify>
    <automated>grep -q '"work_risk": "low|medium|high"' super-gsd/agents/sgsd-classifier.md && grep -q 'Work-risk scoring (Phase 38 SAMPLE-02' super-gsd/agents/sgsd-classifier.md && echo PASS</automated>
  </verify>
  <done>
    Classifier output JSON includes `work_risk` between `deliberate`
    and `reason`. `<rules>` block documents the 4-primary + 1-secondary
    scoring algorithm with explicit weight values (0.25 / 0.10) and
    threshold cutoffs (0.3 / 0.6). Cites
    `sampling-decider.cjs::scoreWorkRisk` as canonical implementation.
    Atomic commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Wire decide() at 3 sites + --force-gates CLI in SKILL.md</name>
  <files>
    super-gsd/skills/sgsd-orchestrate/SKILL.md
  </files>
  <behavior>
    - SKILL.md grep for `samplingDecider.decide(` returns >= 3 (SAMPLE-03)
    - 3 wire-in sites updated (phase-level-ATC at ~595, MUDA-waste-audit at ~847, per-dispatch-ATC at ~1230-1231)
    - New cold_start step 3.65 PARSE OPERATOR OVERRIDES inserted between 3.6 and 3.7
    - --force-gates X without --override-reason: orchestrator exits 1
    - --force-gates X --override-reason "...": logs route-decisions.jsonl row with boundary='gate_override'
    - Existing 7 process-hygiene gates unchanged (their `gate_sampling_tier: always` makes matrix a no-op)
  </behavior>
  <action>
**A5 - super-gsd/skills/sgsd-orchestrate/SKILL.md (+88 lines, -3 lines)**

This task makes FOUR distinct edits. Read each surrounding 30-line
context window before editing to ensure exact-match strings.

**Edit 1: Insert cold_start step 3.65 PARSE OPERATOR OVERRIDES**

Locate the block between current step "3.6 LOAD GATES REGISTRY" and
"3.7 VTP HEALTH PROBE" (use `Grep` for `3.6 LOAD GATES REGISTRY` and
`3.7 VTP HEALTH PROBE` with `-n` flag to find exact line numbers).

Insert a new block AFTER 3.6 closes and BEFORE 3.7 opens:

```
  3.65. PARSE OPERATOR OVERRIDES (Phase 38 SAMPLE-04 + SAMPLE-05)
     // Locked decision 38.5: --force-gates and --skip-gates both require
     // --override-reason="..."; logged to route-decisions.jsonl with
     // boundary='gate_override'. Reason-less override exits 1.

     // Cache the parsed overrides on the dispatch context so all 3 wire-in
     // sites read the same Set; symmetric-set check rejects gate-in-both.
     const samplingDecider = require(path.join(process.cwd(),
       'super-gsd', 'scripts', 'lib', 'sampling-decider.cjs'));
     const cliOverrides = samplingDecider.parseGateOverrides(
       process.argv,
       (name) => { try { gates.getGate(name, GATES_YAML_PATH); return true; }
                   catch { return false; } }
     );

     // Log one route-decisions.jsonl row per override (locked Q6).
     // boundary='gate_override' was added to BOUNDARIES in Phase 38; the
     // route-ledger writer accepts the new entry.
     if (cliOverrides.force.size > 0 || cliOverrides.skip.size > 0) {
       try {
         const rl = require(path.join(process.cwd(),
           'super-gsd', 'scripts', 'lib', 'route-ledger.cjs'));
         for (const g of cliOverrides.force) {
           rl.logRouteDecision(path.join(process.cwd(), '.planning'), {
             boundary: 'gate_override', status: 'ok',
             phase: currentPhase, milestone: currentMilestone,
             reason_codes: ['gate_force_override_with_reason'],
             decision: { gate: g, action: 'force', reason: cliOverrides.reason },
           });
         }
         for (const g of cliOverrides.skip) {
           rl.logRouteDecision(path.join(process.cwd(), '.planning'), {
             boundary: 'gate_override', status: 'ok',
             phase: currentPhase, milestone: currentMilestone,
             reason_codes: ['gate_force_override_with_reason'],
             decision: { gate: g, action: 'skip', reason: cliOverrides.reason },
           });
         }
       } catch (e) {
         console.warn('[SGSD] route-ledger gate_override emit failed (continuing):', e && e.message);
       }
     }
```

**Edit 2: Wire phase-level-ATC site (around line 595)**

Locate this exact existing block (gates.yaml grep for `phaseAtcFired = config.atc.enabled`):

OLD:
```js
     const phaseAtcFired = config.atc.enabled
       && gates.shouldFire('phase-level-ATC', ctx, GATES_YAML_PATH)
       && verification.status == "passed";
```

NEW:
```js
     // Phase 38 wire-in (SAMPLE-03 site 1 of 3): apply 3x3 sampling
     // matrix AFTER gates.shouldFire returns true; --force-gates /
     // --skip-gates take precedence (parsed at cold_start step 3.65).
     const phaseAtcSampled = samplingDecider.shouldSample({
       gate: 'phase-level-ATC',
       work_risk: classifier_result.work_risk,
       gates,
       gatesYamlPath: GATES_YAML_PATH,
       overrides: cliOverrides,
     });
     const phaseAtcFired = config.atc.enabled
       && gates.shouldFire('phase-level-ATC', ctx, GATES_YAML_PATH)
       && verification.status == "passed"
       && phaseAtcSampled;
```

**Edit 3: Wire MUDA-waste-audit site (around line 847)**

Locate this exact existing block (Grep `mudaFired = gates.shouldFire`):

OLD:
```js
     const mudaFired = gates.shouldFire('MUDA-waste-audit', ctx, GATES_YAML_PATH);
```

NEW:
```js
     // Phase 38 wire-in (SAMPLE-03 site 2 of 3).
     const mudaSampled = samplingDecider.shouldSample({
       gate: 'MUDA-waste-audit',
       work_risk: classifier_result.work_risk,
       gates,
       gatesYamlPath: GATES_YAML_PATH,
       overrides: cliOverrides,
     });
     const mudaFired = gates.shouldFire('MUDA-waste-audit', ctx, GATES_YAML_PATH)
       && mudaSampled;
```

**Edit 4: Wire per-dispatch-ATC site (around lines 1230-1231)**

Locate this exact existing block (Grep `perDispatchAtcFired = config.atc.enabled`):

OLD:
```js
      const perDispatchAtcFired = config.atc.enabled
        && gates.shouldFire('per-dispatch-ATC', ctx, GATES_YAML_PATH);
```

NEW:
```js
      // Phase 38 wire-in (SAMPLE-03 site 3 of 3).
      const perDispatchAtcSampled = samplingDecider.shouldSample({
        gate: 'per-dispatch-ATC',
        work_risk: classifier_result.work_risk,
        gates,
        gatesYamlPath: GATES_YAML_PATH,
        overrides: cliOverrides,
      });
      const perDispatchAtcFired = config.atc.enabled
        && gates.shouldFire('per-dispatch-ATC', ctx, GATES_YAML_PATH)
        && perDispatchAtcSampled;
```

**Edit 5: Append `'sampled_skip'` reason_code to existing 3 SKIP arms**

For each of the 3 existing gate-value-log SKIP-arm calls (in
SKILL.md around lines 599-612, 849-862, 1233-1246), the existing
`logGateValue({...})` call passes `outcome: 'skip'`. Phase 38 LOCKED
Q13: when sampling caused the skip, append `'sampled_skip'` to
reason_codes.

This requires distinguishing "trigger-skipped" (gates.shouldFire
returned false) from "sampled-skipped" (gates.shouldFire returned
true but samplingDecider returned false). The existing code reads:

```js
     if (!phaseAtcFired) {
       try {
         require(...).logGateValue(... { outcome: 'skip', ... });
```

After Phase 38 wire-in, `!phaseAtcFired` can be true for either reason.
Distinguish by adding a local check BEFORE the `if (!phaseAtcFired)`:

For phase-level-ATC SKIP arm, change:
```js
     if (!phaseAtcFired) {
       try {
         require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'))
           .logGateValue(path.join(process.cwd(), '.planning'), {
             gate:        'phase-level-ATC',
             outcome:     'skip',
             phase:       currentPhase,
             milestone:   currentMilestone,
             retroactive: gates.getGate('phase-level-ATC', GATES_YAML_PATH),
           });
```

To:
```js
     if (!phaseAtcFired) {
       try {
         // Phase 38 LOCKED Q13: differentiate trigger-skip from sampled-skip
         // for Phase 39 rubric consumer. reason_codes is extensible per
         // gate-value-log.cjs Q14 lock.
         const triggerFired = config.atc.enabled
           && gates.shouldFire('phase-level-ATC', ctx, GATES_YAML_PATH)
           && verification.status == "passed";
         const reasonCodes = (triggerFired && !phaseAtcSampled)
           ? ['gate_skip_with_reason', 'gate_sampled_skip']
           : ['gate_skip_with_reason'];
         require(path.join(process.cwd(), 'super-gsd', 'scripts', 'lib', 'gate-value-log.cjs'))
           .logGateValue(path.join(process.cwd(), '.planning'), {
             gate:        'phase-level-ATC',
             outcome:     'skip',
             phase:       currentPhase,
             milestone:   currentMilestone,
             reason_codes: reasonCodes,
             retroactive: gates.getGate('phase-level-ATC', GATES_YAML_PATH),
           });
```

Apply identical pattern to MUDA-waste-audit SKIP arm (use `mudaSampled`
+ recompute `triggerFired = gates.shouldFire('MUDA-waste-audit', ...)`)
and per-dispatch-ATC SKIP arm (use `perDispatchAtcSampled` + recompute
`triggerFired = config.atc.enabled && gates.shouldFire('per-dispatch-ATC', ...)`).

NO touch to FIRE arms. NO touch to the 7 cheap process-hygiene gates
(their `gate_sampling_tier: always` per gates.yaml means
`shouldSample` always returns true; matrix is a no-op).

**Edit 6: Hoist samplingDecider require**

The `samplingDecider` const in step 3.65 must be hoisted to a scope
visible at all 3 wire-in sites. Place the require at the TOP of the
orchestrator's main async function (search Grep `async function orchestrate`
or similar entry point; if SKILL.md is a markdown file embedding js,
add the require near the existing `gates` require). If
SKILL.md uses an inline `<setup>` or `<imports>` section near the top
(within the first 100 lines), add the require there. Otherwise, the
require in step 3.65 lives outside any block-scope and `cliOverrides`
+ `samplingDecider` are accessible at all subsequent step bodies
(SKILL.md is a markdown spec, not real source; the executor must
ensure scope is preserved per existing convention -- search for
how `gates` itself is hoisted).

ASCII-only. LF.

Commit: `feat(38-01): wire decide() + --force-gates into sgsd-orchestrate SKILL.md`
Stage: `super-gsd/skills/sgsd-orchestrate/SKILL.md`.
  </action>
  <verify>
    <automated>c=$(grep -cE 'samplingDecider\.decide|samplingDecider\.shouldSample' super-gsd/skills/sgsd-orchestrate/SKILL.md); [ "$c" -ge 3 ] || (echo "FAIL: expected >=3 wire-ins got $c"; exit 1); grep -q "PARSE OPERATOR OVERRIDES" super-gsd/skills/sgsd-orchestrate/SKILL.md && grep -q "gate_override" super-gsd/skills/sgsd-orchestrate/SKILL.md && echo PASS</automated>
  </verify>
  <done>
    SKILL.md has 3 wire-in sites with `samplingDecider.shouldSample(...)`
    appended to `phaseAtcFired`, `mudaFired`, `perDispatchAtcFired`.
    Cold_start step 3.65 PARSE OPERATOR OVERRIDES inserted between 3.6
    and 3.7. Each override gate logs one route-decisions.jsonl row with
    `boundary: 'gate_override'`, `reason_codes:
    ['gate_force_override_with_reason']`. SKIP arms at all 3 sites
    distinguish trigger-skip from sampled-skip via `'gate_sampled_skip'`
    reason_code. The 7 process-hygiene gates remain untouched. Atomic
    commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: Extend BOUNDARIES (6 -> 7) in route-ledger + add 2 reason_codes to envelope</name>
  <files>
    super-gsd/scripts/lib/route-ledger.cjs,
    super-gsd/registry/command-envelope-v1.yaml
  </files>
  <behavior>
    - route-ledger.cjs BOUNDARIES has 7 entries (added 'gate_override' as 7th)
    - route-ledger.cjs --self-test assertion #1 reads `BOUNDARIES.length === 7` (was 6)
    - All other route-ledger self-test assertions (2-12) unchanged and PASS
    - command-envelope-v1.yaml gains 2 new reason_codes in `gate_review` group
    - command-envelope-v1.yaml registry_version bumped 1.0.0 -> 1.0.1 (semver patch)
    - Phase 31 envelope-v1 contract preserved: only reason_codes appended (extension protocol); NO schema field shape changes
  </behavior>
  <action>
**A6 - super-gsd/scripts/lib/route-ledger.cjs (+1 line in BOUNDARIES, +1 line self-test fix)**

Edit 1: BOUNDARIES extension at lines 56-64.

OLD (lines 56-64):
```js
// ROUTE-02: closed enum of 6 boundary types. Frozen.
const BOUNDARIES = Object.freeze([
  'milestone_promotion',
  'phase_dispatch_first',
  'executor_choice',
  'gate_skip',
  'codex_route',
  'handoff_decision',
]);
```

NEW:
```js
// ROUTE-02: closed enum of 7 boundary types. Frozen.
// Phase 38 (SAMPLE-04): added 'gate_override' for --force-gates /
// --skip-gates with --override-reason. Mass-discuss line 187 names
// this boundary verbatim. Extension preserves the closed-enum
// contract (no schema field shape change; envelope-v1 still ships
// additionalProperties: true so envelope contract holds).
const BOUNDARIES = Object.freeze([
  'milestone_promotion',
  'phase_dispatch_first',
  'executor_choice',
  'gate_skip',
  'codex_route',
  'handoff_decision',
  'gate_override',
]);
```

Edit 2: Self-test assertion #1 at line 308-309.

OLD:
```js
    // 1. Module exports + frozen constants.
    assert('1. BOUNDARIES is array of 6',
      Array.isArray(BOUNDARIES) && BOUNDARIES.length === 6);
```

NEW:
```js
    // 1. Module exports + frozen constants. Phase 38: 7 entries.
    assert('1. BOUNDARIES is array of 7',
      Array.isArray(BOUNDARIES) && BOUNDARIES.length === 7);
```

ALSO, add ONE NEW self-test assertion immediately after assertion 12
(at the end of the try block, before the `finally` cleanup):

```js
    // 13. Phase 38: gate_override boundary accepts envelope-shaped row.
    const r13 = appendRow(tmp, {
      boundary: 'gate_override', status: 'ok',
      phase: '38', milestone: 'v1.8',
      reason_codes: ['gate_force_override_with_reason'],
      decision: { gate: 'per-dispatch-ATC', action: 'force', reason: 'self-test' },
    });
    const rows13 = readRows(tmp);
    const lastRow = rows13[rows13.length - 1];
    assert('13. gate_override boundary accepted; decision payload preserved',
      lastRow.boundary === 'gate_override' &&
      lastRow.decision &&
      lastRow.decision.gate === 'per-dispatch-ATC' &&
      lastRow.decision.action === 'force' &&
      lastRow.decision.reason === 'self-test' &&
      Array.isArray(lastRow.reason_codes) &&
      lastRow.reason_codes.includes('gate_force_override_with_reason'));
    void r13;
```

NO other touches to route-ledger.cjs. Existing assertions 2-12 unchanged.

**A7 - super-gsd/registry/command-envelope-v1.yaml (+2 reason_codes + version bump)**

Edit 1: Bump registry_version on line 10.

OLD:
```yaml
registry_version: 1.0.0
```

NEW:
```yaml
registry_version: 1.0.1
```

Edit 2: Append 2 new entries to the `Gate / review` group.
Locate the existing block (lines 132-150, ending with
`gate_force_with_reason`):

OLD (lines 148-150):
```yaml
      - code: gate_force_with_reason
        group: gate_review
        description: "Gate force-passed via documented override; rationale captured in evidence[]."
```

NEW:
```yaml
      - code: gate_force_with_reason
        group: gate_review
        description: "Gate force-passed via documented override; rationale captured in evidence[]."
      - code: gate_force_override_with_reason
        group: gate_review
        description: "Operator-issued --force-gates / --skip-gates with --override-reason; logged to route-decisions.jsonl boundary=gate_override (Phase 38 SAMPLE-04)."
      - code: gate_sampled_skip
        group: gate_review
        description: "Gate trigger fired but 3x3 work_risk x gate_sampling_tier matrix returned skip; gate-value-log row carries this reason_code so Phase 39 rubric distinguishes trigger-skip from sampled-skip (Phase 38 LOCKED Q13)."
```

NO touches to other reason_codes. NO touches to the `emitters` block.
NO touches to `mission_strip_read_contract` or `reconciliation`. Phase
31 contract preserved: 4 collides_with: [] contracts untouched.

ASCII-only. LF.

Commit: `feat(38-01): route-ledger BOUNDARIES extension (6->7); reason_codes +2`
Stage: `super-gsd/scripts/lib/route-ledger.cjs super-gsd/registry/command-envelope-v1.yaml`.
  </action>
  <verify>
    <automated>node super-gsd/scripts/lib/route-ledger.cjs --self-test && grep -q "gate_force_override_with_reason" super-gsd/registry/command-envelope-v1.yaml && grep -q "gate_sampled_skip" super-gsd/registry/command-envelope-v1.yaml && grep -q "registry_version: 1.0.1" super-gsd/registry/command-envelope-v1.yaml && echo PASS</automated>
  </verify>
  <done>
    `node super-gsd/scripts/lib/route-ledger.cjs --self-test` exits 0
    with `13 pass, 0 fail` (was 12). BOUNDARIES has 7 entries; new
    entry `gate_override` appended last. command-envelope-v1.yaml has
    `registry_version: 1.0.1` and 2 new reason_codes
    (`gate_force_override_with_reason`, `gate_sampled_skip`) in
    `gate_review` group. NO touches to envelope-v1 schema fields. NO
    touches to `code-reviewer-v1`, `review-providers-v1`,
    `handover-contract-v2`, `plan-schema-v2`. Atomic commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 6: Local-fallback test for sampling-decider (9-cell matrix coverage)</name>
  <files>
    super-gsd/scripts/lib/sampling-decider.test.cjs (NEW)
  </files>
  <behavior>
    - Test exercises decide() across all 9 matrix cells (asserts lock 38.3 verbatim)
    - Test exercises scoreWorkRisk() with trivial/security/cold-start fixtures
    - Test simulates --force-gates with --override-reason via spawnSync; asserts route-decisions.jsonl row appended in tmpdir with boundary='gate_override'
    - Test simulates --force-gates without --override-reason; asserts exit 1 + stderr message
    - Provider-faking NOT required (lib is pure-function + filesystem read)
    - All test assertions deterministic (Math.random() not invoked at file level; only inside shouldSample's 'maybe' arm which test bypasses)
  </behavior>
  <action>
**A8 - super-gsd/scripts/lib/sampling-decider.test.cjs (~100 LOC, NEW)**

Create `super-gsd/scripts/lib/sampling-decider.test.cjs` mirroring
the route-ledger.test.cjs / gate-value-log.test.cjs precedent.
Self-contained; no test framework dependency (mirrors the in-tree
self-test pattern: pass/fail counter + assert helper).

REQUIRED structure:

1. Header comment (lines 1-15):
```js
'use strict';
/**
 * Local fallback test for sampling-decider.cjs (Phase 38 SAMPLE-01..05).
 * Exercises the SAME exported helpers SKILL.md calls, against fixtures.
 *
 * 5 fixture cases per RESEARCH sec 10:
 *   1. All 9 matrix cells (lock 38.3 verbatim)
 *   2. Trivial phase work_risk -> 'low'
 *   3. Security phase work_risk -> 'high'
 *   4. --force-gates wires to route-ledger (boundary='gate_override')
 *   5. --force-gates without --override-reason -> exit 1
 *
 * Lib has zero external deps; live verification cannot be blocked by
 * provider_unavailable. Local fallback covers all SAMPLE-XX requirements
 * deterministically.
 */
```

2. Requires (lines 17-22):
```js
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const sd = require('./sampling-decider.cjs');
```

3. Assert helper (mirror route-ledger.cjs:289-292):
```js
let pass = 0, fail = 0;
const failures = [];
function assert(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ name, detail: detail || '' }); }
}
```

4. Fixture 1 - all 9 matrix cells:
```js
// Fixture 1: all 9 cells per RESEARCH sec 2 table
const expected9 = [
  ['always',          'low',    'fire'],
  ['always',          'medium', 'fire'],
  ['always',          'high',   'fire'],
  ['sampled-rate-50', 'low',    'skip'],
  ['sampled-rate-50', 'medium', 'maybe'],
  ['sampled-rate-50', 'high',   'fire'],
  ['low-risk-skip',   'low',    'skip'],
  ['low-risk-skip',   'medium', 'fire'],
  ['low-risk-skip',   'high',   'fire'],
];
let allCellsCorrect = true;
const wrongCells = [];
for (const [tier, risk, expected] of expected9) {
  const got = sd.decide({ work_risk: risk, gate_sampling_tier: tier });
  if (got !== expected) { allCellsCorrect = false; wrongCells.push(`${tier}/${risk}: expected ${expected} got ${got}`); }
}
assert('1. all 9 matrix cells match lock 38.3', allCellsCorrect, wrongCells.join('; '));
```

5. Fixture 2 - trivial work_risk:
```js
// Fixture 2: docs phase, 10 lines, 1 file -> 'low'
const trivial = sd.scoreWorkRisk({
  diff_lines: 10, files_touched_count: 1,
  phase_type: 'docs', phase_includes_security_review: false,
});
assert('2. trivial phase scoreWorkRisk = low', trivial === 'low', `got ${trivial}`);
```

6. Fixture 3 - security work_risk:
```js
// Fixture 3: feature with security review -> dominates -> 'high'
const security = sd.scoreWorkRisk({
  diff_lines: 50, files_touched_count: 2,
  phase_type: 'feature', phase_includes_security_review: true,
});
assert('3. security-review phase scoreWorkRisk = high', security === 'high', `got ${security}`);
```

7. Fixture 4 - --force-gates with --override-reason logs gate_override:
```js
// Fixture 4: --force-gates wires to route-ledger
// Spawn a tiny bootstrap helper that mimics the SKILL.md step 3.65 wiring:
// loads sampling-decider, calls parseGateOverrides with stub validator,
// then calls route-ledger logRouteDecision in a tmpdir.

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-test-'));
const bootstrapPath = path.join(tmp, 'bootstrap.cjs');
const libPath = path.resolve(__dirname, 'sampling-decider.cjs');
const rlPath = path.resolve(__dirname, 'route-ledger.cjs');
fs.writeFileSync(bootstrapPath, `
'use strict';
const sd = require(${JSON.stringify(libPath)});
const rl = require(${JSON.stringify(rlPath)});
const overrides = sd.parseGateOverrides(process.argv.slice(2), () => true);
const planningDir = process.argv[process.argv.length - 1]; // last arg = tmp planning dir
for (const g of overrides.force) {
  rl.logRouteDecision(planningDir, {
    boundary: 'gate_override', status: 'ok',
    phase: '38', milestone: 'v1.8',
    reason_codes: ['gate_force_override_with_reason'],
    decision: { gate: g, action: 'force', reason: overrides.reason },
  });
}
process.exit(0);
`, 'utf8');

const planningDir = path.join(tmp, '.planning');
fs.mkdirSync(path.join(planningDir, 'metrics'), { recursive: true });

const r = spawnSync(process.execPath, [
  bootstrapPath,
  '--force-gates', 'per-dispatch-ATC',
  '--override-reason', 'test-fixture',
  planningDir,
], { encoding: 'utf8' });

const ledger = path.join(planningDir, 'metrics', 'route-decisions.jsonl');
let row4 = null;
if (fs.existsSync(ledger)) {
  const lines = fs.readFileSync(ledger, 'utf8').split(/\r?\n/).filter(Boolean);
  if (lines.length === 1) { try { row4 = JSON.parse(lines[0]); } catch {} }
}
assert('4. --force-gates appends route-decisions.jsonl row with boundary=gate_override',
  r.status === 0 &&
  row4 &&
  row4.boundary === 'gate_override' &&
  row4.decision && row4.decision.gate === 'per-dispatch-ATC' &&
  row4.decision.action === 'force' &&
  row4.decision.reason === 'test-fixture' &&
  Array.isArray(row4.reason_codes) &&
  row4.reason_codes.includes('gate_force_override_with_reason'),
  `exit=${r.status}, stderr=${r.stderr}, row=${JSON.stringify(row4)}`
);
```

8. Fixture 5 - --force-gates without --override-reason exits 1:
```js
// Fixture 5: --force-gates without --override-reason -> exit 1
const r5 = spawnSync(process.execPath, [
  bootstrapPath,
  '--force-gates', 'per-dispatch-ATC',
  planningDir,
], { encoding: 'utf8' });
assert('5. --force-gates without --override-reason exits 1',
  r5.status === 1 && /require --override-reason/.test(r5.stderr || ''),
  `exit=${r5.status}, stderr=${r5.stderr}`
);
```

9. Cleanup + result print:
```js
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`sampling-decider.test: ${pass} pass, ${fail} fail`);
if (fail > 0) {
  for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
  process.exit(1);
}
process.exit(0);
```

ASCII-only. LF. Total ~110 LOC.

Commit: `test(38-01): deterministic local fallback for sampling-decider (9-cell)`
Stage: `super-gsd/scripts/lib/sampling-decider.test.cjs`.
  </action>
  <verify>
    <automated>node super-gsd/scripts/lib/sampling-decider.test.cjs</automated>
  </verify>
  <done>
    File exists at super-gsd/scripts/lib/sampling-decider.test.cjs
    (~110 LOC). `node super-gsd/scripts/lib/sampling-decider.test.cjs`
    exits 0 with stdout `sampling-decider.test: 5 pass, 0 fail`. All
    9 matrix cells exercised; --force-gates with reason logs
    boundary=gate_override; --force-gates without reason exits 1.
    Atomic commit.
  </done>
</task>

</tasks>

<known_dead_ends>
The following changes are EXPLICITLY out of scope for Phase 38. The
executor MUST NOT introduce them. If the executor encounters pressure
to add any of these (from a verifier finding, an ATC review, or a
local hunch), STOP and surface as a BLOCKER -- do NOT silently expand
scope.

1. **Do NOT modify command-envelope-v1.json (the schema file).**
   Only `command-envelope-v1.yaml` is touched (reason_codes vocabulary
   extension only). Phase 31 lock 31=A: schema field shape is frozen;
   YAML extension is the documented protocol per
   command-envelope-v1.yaml:97-98 ("Extension protocol: append entry
   here, bump registry_version (semver patch). No envelope schema
   bump unless field shape changes.").

2. **Do NOT change envelope-v1 schema fields.** No new top-level
   fields in the JSON schema. No type changes to existing fields. No
   `required: []` additions. The 13 envelope-v1 required fields plus
   the Phase 32 + 36 extension fields (`boundary`, `decision`, `gate`,
   `outcome`, `retroactive`) ride along via `additionalProperties:
   true`. Any field-shape touch -> Phase 31 contract violation ->
   STOP.

3. **Do NOT modify the 4 existing contracts** (`code-reviewer-v1`,
   `review-providers-v1`, `handover-contract-v2`, `plan-schema-v2`).
   command-envelope-v1.yaml:268-272 declares
   `does_not_touch: [...4 contracts...]`. Phase 38 honors this.

4. **Do NOT introduce new dependencies.** sampling-decider.cjs uses
   ONLY Node stdlib (`fs`, `path`, `os`, `child_process`, `crypto`
   only if needed). NO ajv, NO js-yaml, NO lodash, NO test framework.
   Mirrors Phase 32 + 36 + 37 zero-dep precedent. The js-yaml
   dependency in gates-registry.cjs (line 41-44) is already in place
   from Phase 10; sampling-decider.cjs does NOT touch YAML.

5. **Do NOT change Phase 32 wire-in.** The existing `codex_route`
   wire at SKILL.md:1236 is preserved unchanged. BOUNDARIES extension
   is ADDITIVE (entries 1-6 unchanged; entry 7 = `gate_override`).
   The Phase 32 self-test assertion #4 still passes (still asserts
   `codex_route` boundary works); Phase 38 adds assertion #13 for
   `gate_override`. No regression.

6. **Do NOT skip the registry_version semver patch bump on
   command-envelope-v1.yaml.** Phase 31 protocol explicitly requires
   it: "Extension protocol: append entry here, bump registry_version
   (semver patch)." `1.0.0 -> 1.0.1` is mandatory.

7. **Do NOT seed Math.random() in shouldSample.** RESEARCH LOCKED Q4:
   `Math.random() < 0.5` per-decision; not seeded. Reproducibility
   across runs is OUT OF SCOPE for v1.8. Self-test asserts the matrix
   cell value (`maybe`), not the post-flip outcome.

8. **Do NOT wire matrix at the 7 cheap process-hygiene gates.**
   RESEARCH LOCKED Q10: only 3 sites (phase-level-ATC,
   per-dispatch-ATC, MUDA-waste-audit). The other 7 have
   `gate_sampling_tier: always` per RESEARCH sec 3 table, making
   `shouldSample` always return `true` -- a no-op. Saves ~28 lines of
   SKILL.md boilerplate. Wiring all 13 sites is a known
   anti-pattern (over-instrumentation; orphan call paths).

9. **Do NOT wire matrix at sgsd-recall-queries.** RESEARCH LOCKED Q11:
   v1.7 trigger `classifier.complexity != trivial` is the v1.7 bar;
   double-gating with the matrix is unnecessary. Operator can
   override per-call via --skip-gates. v1.9 cleanup task.

10. **Do NOT add cost telemetry to gate-value-log.** Locked 36=B
    "no cost"; Phase 36 RESEARCH sec 11. Cost is a v2.0+ ops concern.
    `duration_ms` is the standard envelope-v1 field, NOT cost.

11. **Do NOT modify route-ledger.cjs assertions 2-12.** Only
    assertion #1 (BOUNDARIES.length) and ONE NEW assertion #13
    (gate_override accepts row) are touched. All other assertions
    remain unchanged; existing Phase 32 contract preserved.

12. **Do NOT default-kill on missing gate_sampling_tier.** Lock 38.4:
    missing field -> default `always` (soft-warn at load). Throw
    applies ONLY to invalid-enum values (poisoned config).
</known_dead_ends>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| operator -> CLI | Untrusted argv crosses into orchestrator at cold_start step 3.65 |
| gates.yaml -> gates-registry | Untrusted file contents (could be edited by operator) crosses validation hook |
| classifier output -> shouldSample | Trusted (Haiku-emitted JSON; closed-enum work_risk validated by `decide`) |
| route-ledger.appendRow -> jsonl file | Trusted within process; envelope-v1 schema check at boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-38-01 | Tampering | gates.yaml `gate_sampling_tier` field | mitigate | validateGatesYaml throws on invalid enum; loadGates clears _cache so a fix + reload is not blocked by stale cache (mirrors Phase 33 pattern at gates-registry.cjs:71) |
| T-38-02 | Spoofing | --force-gates / --skip-gates argv | mitigate | parseGateOverrides validates gate names against loaded registry (LOCKED Q14); typo'd gate name exits 1 with stderr message naming the unknown gate |
| T-38-03 | Repudiation | gate_override action without audit trail | mitigate | Every override logs to route-decisions.jsonl with boundary='gate_override', reason_codes=['gate_force_override_with_reason'], decision={gate, action, reason}; reason is mandatory (SAMPLE-05 hard rejection) |
| T-38-04 | Information Disclosure | sampling-decider.cjs leaks file contents | accept | Lib is pure-function + read-only; no file writes outside route-ledger (which has its own envelope-v1 schema check); no PII in matrix or work_risk inputs |
| T-38-05 | Denial of Service | Math.random() in 'maybe' arm causes non-determinism | accept | LOCKED Q4: per-decision Math.random() is intentional; reproducibility OUT OF SCOPE for v1.8; self-test asserts matrix cell value not post-flip outcome |
| T-38-06 | Elevation of Privilege | --force-gates bypasses CRIT gate | mitigate | Override is logged with mandatory reason; auditor (Phase 39 rubric) can detect operator-issued overrides via reason_codes=['gate_force_override_with_reason']; route-decisions.jsonl is append-only |
| T-38-07 | Tampering | BOUNDARIES extension breaks Phase 32 contract | mitigate | Extension is additive (entries 1-6 unchanged; entry 7 added); existing self-test assertions 2-12 unchanged; new assertion #13 covers the new boundary; route-ledger.cjs --self-test exits 0 post-edit |
| T-38-08 | Schema Violation | command-envelope-v1.yaml extension regresses Phase 31 | mitigate | Only reason_codes appended (documented extension protocol); registry_version semver patch bump; collides_with: [] preserved; envelope-v1 schema fields untouched; 4 existing contracts (code-reviewer-v1, review-providers-v1, handover-contract-v2, plan-schema-v2) untouched |
</threat_model>

<verification>
**Phase 38 acceptance gate** (mirrors RESEARCH sec 12, derives from
ROADMAP-AGENT.md:421-425 + REQUIREMENTS.md SAMPLE-01..05).

Run after all 6 commits land. All checks must PASS.

```bash
# SAMPLE-01: 13 gate_sampling_tier lines in gates.yaml
c=$(grep -c '^[[:space:]]*gate_sampling_tier:' super-gsd/registry/gates.yaml)
[ "$c" -ge 13 ] && echo "PASS SAMPLE-01" || (echo "FAIL SAMPLE-01: got $c"; exit 1)

# SAMPLE-02 (matrix correctness): self-test exercises 17 assertions
node super-gsd/scripts/lib/sampling-decider.cjs --self-test  # expect exit 0

# SAMPLE-02 (classifier output): grep work_risk emission spec
grep -q '"work_risk": "low|medium|high"' super-gsd/agents/sgsd-classifier.md \
  && echo "PASS SAMPLE-02 schema" || (echo "FAIL"; exit 1)

# SAMPLE-03: 3 wire-ins at gate-fire decision points
c=$(grep -cE 'samplingDecider\.shouldSample' super-gsd/skills/sgsd-orchestrate/SKILL.md)
[ "$c" -ge 3 ] && echo "PASS SAMPLE-03" || (echo "FAIL SAMPLE-03: got $c"; exit 1)

# SAMPLE-04 + SAMPLE-05: simulated via local-fallback test
node super-gsd/scripts/lib/sampling-decider.test.cjs  # expect exit 0

# BOUNDARIES extension preserved Phase 32 contract
node super-gsd/scripts/lib/route-ledger.cjs --self-test  # expect exit 0 (13 pass)

# command-envelope-v1.yaml extension respects Phase 31 protocol
grep -q "registry_version: 1.0.1" super-gsd/registry/command-envelope-v1.yaml \
  && grep -q "gate_force_override_with_reason" super-gsd/registry/command-envelope-v1.yaml \
  && grep -q "gate_sampled_skip" super-gsd/registry/command-envelope-v1.yaml \
  && echo "PASS envelope extension" || (echo "FAIL"; exit 1)

# Phase 31 contract preserved: 4 contracts untouched
git diff --stat 38-01-START..HEAD -- \
  super-gsd/templates/code-reviewer-v1.json \
  super-gsd/registry/review-providers-v1.yaml \
  super-gsd/registry/handover-contract-v2.yaml \
  super-gsd/templates/plan-schema-v2.json \
  | grep -q '0 files changed' \
  || (echo "FAIL: 4 contracts must be untouched"; exit 1)
```

**Live-or-local fallback contract:**
- Live: next phase enters cold_start with no overrides; gates.yaml
  load runs validateGatesYaml -> ok; classifier emits work_risk;
  orchestrator hits per-dispatch-ATC at Step 9.5 -> shouldSample runs
  against `low-risk-skip` x emitted work_risk; verdict resolved;
  gate-value-log row appended (Phase 36 wire). Production proof.
- Local: `node super-gsd/scripts/lib/sampling-decider.test.cjs`
  exercises the SAME exported helpers SKILL.md calls, against
  fixtures. Provider-faking NOT required (lib is pure-function +
  filesystem-read).

**Provider-unavailable degraded path:** sampling-decider has zero
external deps. If a future Phase 38 follow-up adds a provider call,
shouldSample's catch-and-fire-as-safe-default contract (line 487
implementation) ensures `provider_unavailable` always returns `true`
(safe default: fire). Autonomy continues; evidence tells the truth.
</verification>

<success_criteria>
Phase 38 complete when ALL of the following hold:

1. **SAMPLE-01**: Every gate in `super-gsd/registry/gates.yaml` has a
   `gate_sampling_tier:` field. `grep -c
   '^[[:space:]]*gate_sampling_tier:' super-gsd/registry/gates.yaml`
   returns >= 13.

2. **SAMPLE-02**: `super-gsd/agents/sgsd-classifier.md` output JSON
   spec includes `"work_risk": "low|medium|high"` between
   `deliberate` and `reason`. The `<rules>` block documents the 4
   primary + 1 secondary scoring algorithm citing
   `sampling-decider.cjs::scoreWorkRisk`.

3. **SAMPLE-03**: `super-gsd/skills/sgsd-orchestrate/SKILL.md` has 3
   wire-in sites with `samplingDecider.shouldSample(...)` extending
   `phaseAtcFired`, `mudaFired`, `perDispatchAtcFired` boolean
   conjunctions. `grep -cE 'samplingDecider\.shouldSample'
   super-gsd/skills/sgsd-orchestrate/SKILL.md` returns >= 3.

4. **SAMPLE-04**: `--force-gates X --override-reason "..."` causes
   the orchestrator to log a row to
   `.planning/metrics/route-decisions.jsonl` with
   `boundary=gate_override`,
   `reason_codes=['gate_force_override_with_reason']`,
   `decision={gate, action, reason}`. Verified by
   `sampling-decider.test.cjs` Fixture 4 (deterministic local
   fallback).

5. **SAMPLE-05**: `--force-gates X` without `--override-reason`
   causes the orchestrator to exit 1 with stderr matching `/require
   --override-reason/`. Verified by `sampling-decider.test.cjs`
   Fixture 5.

6. **`sampling-decider.cjs` self-test**: 17/17 assertions PASS.
   Canonical `super-gsd/registry/gates.yaml` and
   `.planning/metrics/route-decisions.jsonl` mtime/size unchanged.

7. **`route-ledger.cjs` self-test**: 13/13 assertions PASS (was 12;
   added gate_override boundary assertion). BOUNDARIES has 7
   entries. Existing `codex_route` (Phase 32) still works.

8. **Phase 31 contract preserved**:
   `super-gsd/registry/command-envelope-v1.yaml` has
   `registry_version: 1.0.1` (semver patch from 1.0.0); 2 new
   reason_codes (`gate_force_override_with_reason`,
   `gate_sampled_skip`); NO touches to envelope-v1 schema fields; NO
   touches to the 4 existing contracts (`code-reviewer-v1`,
   `review-providers-v1`, `handover-contract-v2`, `plan-schema-v2`).

9. **6 atomic commits** land in dependency order:
   - `feat(38-01): sampling-decider.cjs lib + 17-assertion self-test`
   - `feat(38-01): gates.yaml +13 gate_sampling_tier; gates-registry validation`
   - `feat(38-01): sgsd-classifier emits work_risk (4 primary + 1 secondary)`
   - `feat(38-01): wire decide() + --force-gates into sgsd-orchestrate SKILL.md`
   - `feat(38-01): route-ledger BOUNDARIES extension (6->7); reason_codes +2`
   - `test(38-01): deterministic local fallback for sampling-decider (9-cell)`

10. **No new dependencies**, ASCII-only files, LF line endings,
    mirror Phase 32 + 36 architecture.
</success_criteria>

<output>
After completion, create
`.planning/milestones/v1.8/phases/38-risk-tiered-gate-sampling/38-01-SUMMARY.md`
following the standard summary template. Include:

- FILES_CREATED: super-gsd/scripts/lib/sampling-decider.cjs (~280 LOC),
  super-gsd/scripts/lib/sampling-decider.test.cjs (~110 LOC),
  .planning/metrics/route-decisions.jsonl (auto-created on first
  --force-gates emit; MILESTONE-READINESS.md:117 anticipates this).
- FILES_MODIFIED: super-gsd/registry/gates.yaml (+13),
  super-gsd/scripts/lib/gates-registry.cjs (+11),
  super-gsd/agents/sgsd-classifier.md (+8/-2),
  super-gsd/skills/sgsd-orchestrate/SKILL.md (+88/-3),
  super-gsd/scripts/lib/route-ledger.cjs (+1 BOUNDARIES, +1 self-test
  count, +12 new assertion #13),
  super-gsd/registry/command-envelope-v1.yaml (+8/-0; 2 reason_codes +
  registry_version bump).
- VERIFICATION: 5 acceptance commands per <verification> block.
- DEVIATIONS: none expected (all 14 derivation calls locked in
  RESEARCH sec 11).
- BLOCKERS: none expected.
- ONE_LINER: "Risk-tiered gate sampling: 3x3 work_risk x
  gate_sampling_tier matrix; 17-assertion self-test; --force-gates
  CLI; BOUNDARIES extended 6->7; +2 reason_codes (semver patch)."
</output>

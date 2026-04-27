---
phase: 38
name: Risk-Tiered Gate Sampling
milestone: v1.8
status: research_complete
researched: 2026-04-27
confidence: HIGH
controlling_principle: "Autonomy continues; evidence tells the truth."
locked_decisions: [38.1, 38.2, 38.3, 38.4, 38.5]
---

# Phase 38: Risk-Tiered Gate Sampling - Research

## Summary

Phase 38 lands the gate x work intersection sampling matrix. The controlling
artifact is a new library `super-gsd/scripts/lib/sampling-decider.cjs` that
maps `(work_risk, gate_sampling_tier) -> {fire | skip | maybe}` against a
3 x 3 frozen matrix. Four call sites consume it: gates.yaml validation
(SAMPLE-01), classifier work_risk emission (SAMPLE-02), orchestrator gate
intersection at every gate-fire decision (SAMPLE-03), and a new CLI flag
parser at orchestrator startup that handles `--force-gates` and
`--skip-gates` overrides with mandatory `--override-reason` (SAMPLE-04 +
SAMPLE-05). Override reasons land in `route-decisions.jsonl` via the Phase
32 route-ledger.

Architecture mirrors Phase 32, 36, 37 1:1: frozen const enums, public API
never throws upward, `__dirname`-anchored fingerprint guard, defensive
read, manual schema check, single-plan delivery. Phase 38 differs in two
respects: (a) it extends a previously-frozen closed enum (`BOUNDARIES` in
route-ledger.cjs:57-64) to add `gate_override` -- mass-discuss line 187
names this boundary verbatim; (b) it touches more files than 36/37
(gates.yaml x13, classifier, SKILL.md x4, route-ledger, command-envelope
registry).

**Primary recommendation:** Single plan; ~360-line lib + classifier edit
+ gates.yaml +13 lines + SKILL.md wire-in + 17-assertion self-test +
local-fallback test. Net ~+580 / -8. Schema-without-consumer rule
satisfied by 4 in-phase consumers (Section 8).

## Architectural Responsibility Map

| Capability | Tier | Rationale |
|------------|------|-----------|
| 3x3 intersection matrix lookup | scripts/lib (cjs) | Pure data + pure function |
| `decide({work_risk, gate_sampling_tier})` -> verdict | scripts/lib (cjs) | Single-call API |
| `gate_sampling_tier` validation at gates.yaml load | gates-registry.cjs:38-117 (edit) | Enforce closed enum at cold-start |
| `work_risk` emission from classifier inputs | sgsd-classifier.md + SKILL.md (edit) | Only place that owns dispatch context |
| Wire matrix at gate-fire (3 sites) | SKILL.md (edit) | Production caller for SAMPLE-03 |
| `--force-gates` / `--skip-gates` CLI parser | SKILL.md cold_start (edit) | Operator-facing override |
| Override-reason logging | route-ledger.cjs::logRouteDecision (existing) | Phase 32 boundary extension |
| Phase 39 read (rubric) | rubric.cjs (DEFERRED) | v1.8 Phase 39 ships |

## User Constraints (from ROADMAP-AGENT.md + mass-discuss)

### Locked Decisions (verbatim, mass-discuss.md lines 181-187)

- **38.1** Work risk tiers: 3 tiers: `low`, `medium`, `high`.
- **38.2** Classifier inputs: 4 primary -- `diff_lines`,
  `files_touched_count`, `phase_type`, `phase_includes_security_review`;
  1 secondary -- `gate_fitness_history` (read-only; bias weight <= 50%
  of any single primary signal; never writes back to log).
- **38.3** Sampling matrix: Gate x work_risk. `always` fires regardless;
  `sampled-rate-50` fires {0%, 50%, 100%} on {low, med, high};
  `low-risk-skip` fires {0%, 100%, 100%}.
- **38.4** Default for unspecified gates: `always`.
- **38.5** Force/skip override: `--force-gates` and `--skip-gates` both
  require `--override-reason="..."`. Reason logged to
  `route-decisions.jsonl` with `boundary=gate_override`. Override
  without reason is rejected.

### Claude's Discretion

- Library API surface (locked Section 7; mirrors gate-value-log.cjs).
- `sampled-rate-50` randomness source (locked Section 4: `Math.random()`
  per-decision; no seeded PRNG; reproducibility across runs out of scope).
- BOUNDARIES extension strategy (locked Section 6.3; one-line edit).
- gate_sampling_tier per-gate mapping (locked Section 3).
- Self-test assertion count (target 17 = Phase 36's 14 + 3 new).

### Deferred Ideas (OUT OF SCOPE)

- Per-milestone matrix overrides (v1.9+ if value emerges).
- Auto-disable on sustained skip rate (conflicts with 37=A).
- Cockpit / Mission Strip live work_risk display (v2.0+ ops).
- Seeded RNG for `sampled-rate-50` (would require seed log).
- gate_override surfacing in milestone-close SUMMARY.md (Phase 39).

## Phase Requirements

| ID | Description | Section |
|----|-------------|---------|
| SAMPLE-01 | Every gate in `gates.yaml` has `gate_sampling_tier:` field | 3 |
| SAMPLE-02 | Classifier emits `work_risk in {low, medium, high}` (4+1 inputs) | 4 |
| SAMPLE-03 | Orchestrator applies intersection matrix at gate-fire | 5 |
| SAMPLE-04 | `--force-gates X --override-reason "..."` logs `boundary=gate_override` | 6 |
| SAMPLE-05 | `--force-gates X` without `--override-reason` returns exit 1 | 6 |

---

## 1. Mass-Discuss Locks 38.1-38.5 (verbatim citations)

Lines 181-187 of `.planning/discussions/2026-04-26-mass-discuss.md`:

| # | Lock |
|---|------|
| 38.1 | 3 tiers: `low`, `medium`, `high` |
| 38.2 | 4 primary: `diff_lines`, `files_touched_count`, `phase_type`, `phase_includes_security_review`; 1 secondary: `gate_fitness_history` (bias <= 50% per primary; read-only; never writes back) |
| 38.3 | `always` always fires; `sampled-rate-50` fires {0,50,100}% on {low,med,high}; `low-risk-skip` fires {0,100,100}% |
| 38.4 | Default for missing `gate_sampling_tier:` = `always` |
| 38.5 | `--force-gates` and `--skip-gates` both require `--override-reason="..."`; logged to `route-decisions.jsonl` with `boundary=gate_override`; reason-less override rejected (exit 1) |

These locks define the entire surface area. The remainder operationalises
them; no surface area is added beyond what 38.1-38.5 explicitly
authorises.

## 2. Intersection Matrix Design (3 x 3 = 9 cells)

```
                                       work_risk
                              low        medium       high
gate_sampling_tier:
  always                   |  fire    |  fire    |  fire
  sampled-rate-50          |  skip    |  maybe   |  fire
  low-risk-skip            |  skip    |  fire    |  fire
```

Verdicts: `fire`, `skip`, `maybe` (the `sampled-rate-50` randomness arm).
Cell derivations from lock 38.3:

- `always / *` -> `fire` ("fires regardless").
- `sampled-rate-50 / {low,med,high}` = {0%,50%,100%} -> {`skip`, `maybe`, `fire`}.
- `low-risk-skip / {low,med,high}` = {0%,100%,100%} -> {`skip`, `fire`, `fire`}.

Encoded as frozen data:

```js
const MATRIX = Object.freeze({
  'always':          Object.freeze({ low: 'fire', medium: 'fire', high: 'fire' }),
  'sampled-rate-50': Object.freeze({ low: 'skip', medium: 'maybe', high: 'fire' }),
  'low-risk-skip':   Object.freeze({ low: 'skip', medium: 'fire', high: 'fire' }),
});
```

`decide()` returns the verdict; the orchestrator caller resolves `maybe`
via `Math.random() < 0.5`. The library does NOT flip the coin internally
so unit tests can assert all 9 cells without RNG seeding.

Why a matrix instead of a switch: v1.9+ may operator-tune cells via
external YAML; data-shape is one-line edit. Frozen at lib-load defends
against accidental mutation.

## 3. gates.yaml gate_sampling_tier Mapping (13 gates, SAMPLE-01)

Per-gate mapping derived from existing `enforcement_mode`. Mass-discuss
did NOT lock per-gate tiers; lock 38.4 says default = `always`.

Heuristic (LOCKED Q5):
- `enforcement_mode: hard-halt` or `amortized` -> `low-risk-skip`
- Cheap process-hygiene + verify-completeness -> `always`
- Expensive soft-warn (recall, audit, curate) -> `sampled-rate-50`

Per-gate map (file:line cited from gates.yaml):

| # | Gate | Line | enforcement_mode | gate_sampling_tier |
|---|------|------|------------------|---------------------|
|  1 | per-dispatch-ATC | gates.yaml:37 | hard-halt | `low-risk-skip` |
|  2 | phase-level-ATC | gates.yaml:62 | amortized | `low-risk-skip` |
|  3 | classifier-haiku | gates.yaml:79 | soft-warn | `always` |
|  4 | context-selector-haiku | gates.yaml:92 | soft-warn | `always` |
|  5 | sgsd-recall-queries | gates.yaml:105 | soft-warn | `sampled-rate-50` |
|  6 | intent-injection | gates.yaml:121 | soft-warn | `always` |
|  7 | MUDA-waste-audit | gates.yaml:133 | soft-warn | `low-risk-skip` |
|  8 | qualitative-waste-audit | gates.yaml:158 | soft-warn | `sampled-rate-50` |
|  9 | sgsd-curate-learnings | gates.yaml:181 | soft-warn | `sampled-rate-50` |
| 10 | token-log | gates.yaml:205 | soft-warn | `always` |
| 11 | vtp-enrichment | gates.yaml:219 | soft-warn (api_error->halt) | `low-risk-skip` |
| 12 | verifier-row-arithmetic | gates.yaml:240 | soft-warn (verify) | `always` |
| 13 | verifier-detail-vs-summary | gates.yaml:255 | soft-warn (verify) | `always` |

Rationale per cluster:

- ATC + amortized -> `low-risk-skip` so trivial work skips review while
  any non-trivial work still triggers it.
- Cheap process-hygiene + verifier checks -> `always`; sub-0.1s cost
  doesn't merit gating.
- Token-expensive soft-warn (recall, qualitative-waste, curate) ->
  `sampled-rate-50` for amortisation across runs.

Field added to each gate row (one line per gate; 13 lines net).
Validation lives in `gates-registry.cjs::loadGates` mirroring the
Phase 33 4-AND check at gates-registry.cjs:60-73.

## 4. Classifier Edit (work_risk emission, SAMPLE-02)

Two paths must be extended:

**Path A (v2 plan):** SKILL.md:265-285 derives classifier_result from
frontmatter without spawning Haiku. Add `work_risk` derivation.

**Path B (v1 plan):** SKILL.md:298-313 dispatches sgsd-classifier
(haiku). Extend prompt + agent.md output schema.

### 4.1 Inputs (locked 38.2)

| # | Input | v2 source | v1 source |
|---|-------|-----------|-----------|
| 1 | `diff_lines` | `git diff --stat` at Step 9.2 dispatch ctx | agent prompt |
| 2 | `files_touched_count` | sum of `frontmatter.tasks[].files_touched.length` | agent prompt |
| 3 | `phase_type` | ROADMAP/phase metadata (predicate-eval.cjs:23) | agent prompt |
| 4 | `phase_includes_security_review` | new SCHEMA-04 frontmatter field | new prompt field |
| 5 (sec.) | `gate_fitness_history` | `summarize(planningDir).map(g => ({gate, value_score, fire_rate}))` from Phase 36 | (not passed; v1 path uses primary-only and Haiku ignores secondary) |

### 4.2 Scoring algorithm (LOCKED Q3)

Each primary contributes 0.25; secondary capped at 0.10 (within the
50%-of-primary bias bound from 38.2).

```js
function scoreWorkRisk({ diff_lines, files_touched_count, phase_type,
                          phase_includes_security_review,
                          gate_fitness_history /* optional */ }) {
  const w_primary = 0.25;
  const w_secondary = 0.10;  // <= 0.5 * w_primary (lock 38.2)

  const s_diff = clamp01((diff_lines || 0) / 200);          // 200 lines = 1.0
  const s_files = clamp01((files_touched_count || 0) / 6);  // 6 files  = 1.0
  const s_type = ['docs','config'].includes(phase_type) ? 0
               : phase_type === 'refactor' ? 0.3
               : ['feature','bugfix'].includes(phase_type) ? 0.7
               : 0.5;
  const s_security = phase_includes_security_review ? 1.0 : 0;

  let total = w_primary * (s_diff + s_files + s_type + s_security);

  if (Array.isArray(gate_fitness_history) && gate_fitness_history.length) {
    const avg_block = gate_fitness_history
      .filter(g => g.fires > 0)
      .reduce((s, g) => s + (g.block / g.fires), 0)
      / gate_fitness_history.length;
    total += w_secondary * clamp01(avg_block);
  }
  total = Math.min(1.0, total);

  if (total >= 0.6) return 'high';
  if (total >= 0.3) return 'medium';
  return 'low';
}
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
```

Cold-start (`gate_fitness_history` empty/null): secondary contributes
0; primaries weight at full -- exactly the locked behaviour.

### 4.3 Output extension

v2 path (SKILL.md:268-285) -- add to synthetic classifier_result:

```diff
   classifier_result = {
     complexity, model, atc_tier, deliberate,
+    work_risk,                           // 'low'|'medium'|'high' (Phase 38)
     reason: "v2 plan -- classifier skip (SCHEMA-04)"
   }
```

v1 path (sgsd-classifier.md:20-32) -- extend output JSON:

```diff
 {
   "complexity": "light|standard|heavy",
   "model": "haiku|sonnet|opus",
   "atc_tier": "skip|lite|full|gate",
   "deliberate": false,
+  "work_risk": "low|medium|high",
   "reason": "one sentence max"
 }
```

`scoreWorkRisk` is exported from `sampling-decider.cjs` so both paths
share one implementation.

## 5. Orchestrator Wire-In (SAMPLE-03)

### 5.1 Three gate-fire sites (matches Phase 36's 3-site precedent)

| # | Gate | Pre-existing const | New layer |
|---|------|--------------------|-----------|
| 1 | `phase-level-ATC` | `phaseAtcFired` (SKILL.md:591) | `&& sampled` |
| 2 | `per-dispatch-ATC` | `perDispatchAtcFired` (SKILL.md:1230-1231) | `&& sampled` |
| 3 | `MUDA-waste-audit` | `mudaFired` (SKILL.md:847) | `&& sampled` |

The 7 cheap process-hygiene gates (classifier-haiku, context-selector-haiku,
intent-injection, sgsd-curate-learnings, token-log,
verifier-row-arithmetic, verifier-detail-vs-summary) have
`gate_sampling_tier: always` per Section 3, so the matrix returns `fire`
unconditionally. LOCKED Q10: do NOT wire the matrix at these sites; rely
on the registry value `always`. Saves ~28 lines of SKILL.md boilerplate.

sgsd-recall-queries already has trigger
`classifier.complexity != trivial`; double-gating with the matrix is
unnecessary v1.7 behaviour. LOCKED Q11: not wired in v1.8; v1.9 cleanup.

### 5.2 Wire pattern (mirrors Phase 36 const-hoisting)

```js
// AFTER (Phase 38) -- at SKILL.md:1230-1231:
const perDispatchAtcGateFires = config.atc.enabled
  && gates.shouldFire('per-dispatch-ATC', ctx, GATES_YAML_PATH);
const perDispatchAtcFired = perDispatchAtcGateFires
  && samplingDecider.shouldSample({
       gate: 'per-dispatch-ATC',
       work_risk: classifier_result.work_risk,
       gates,
       gatesYamlPath: GATES_YAML_PATH,
       overrides: cliOverrides,    // from Section 6 startup parser
     });
```

`shouldSample` resolves matrix verdict + overrides + flips `maybe`
internally (Section 7.2). 4 extra lines per site x 3 sites = 12 lines
of SKILL.md boilerplate.

### 5.3 Skip-arm integration with Phase 36 telemetry

When `samplingDecider` returns false, the existing Phase 36 SKIP-arm
fires (gate-value-log row with `outcome: 'skip'`). LOCKED Q13: append
`'sampled_skip'` to reason_codes when sampling caused the skip. Phase 36
schema is `additionalProperties: true` and reason_codes is an extensible
array per its Q14 lock; Phase 39 rubric uses this code to differentiate
trigger-skipped from sampled-skipped.

## 6. --force-gates / --skip-gates + route-ledger logging (SAMPLE-04 + SAMPLE-05)

### 6.1 CLI parser location

Parsing happens at orchestrator startup, between current cold_start
steps 3.6 (LOAD GATES REGISTRY) and 3.7 (VTP HEALTH PROBE), so the gates
registry is loaded and override gate names can be validated at parse
time.

New step **3.65 PARSE OPERATOR OVERRIDES**:

```js
const cliOverrides = parseGateOverrides(process.argv);

function parseGateOverrides(argv) {
  const force = new Set(); const skip = new Set(); let reason = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if      (a === '--force-gates'    && argv[i+1]) { argv[i+1].split(',').map(g => force.add(g.trim())); i++; }
    else if (a === '--skip-gates'     && argv[i+1]) { argv[i+1].split(',').map(g => skip.add(g.trim()));  i++; }
    else if (a === '--override-reason' && argv[i+1]) { reason = String(argv[i+1]).trim(); i++; }
    else if (a.startsWith('--force-gates='))    { a.slice(15).split(',').map(g => force.add(g.trim())); }
    else if (a.startsWith('--skip-gates='))     { a.slice(14).split(',').map(g => skip.add(g.trim())); }
    else if (a.startsWith('--override-reason='))  { reason = a.slice(18).trim(); }
  }

  // SAMPLE-05 hard rejection.
  if ((force.size > 0 || skip.size > 0) && (!reason || reason.length === 0)) {
    console.error('[SGSD] error: --force-gates/--skip-gates require --override-reason="..."');
    process.exit(1);
  }
  // Validate gate names against loaded registry; symmetric-set check.
  for (const g of [...force, ...skip]) {
    try { gates.getGate(g, GATES_YAML_PATH); }
    catch { console.error(`[SGSD] error: --force/skip-gates references unknown gate '${g}'`); process.exit(1); }
  }
  for (const g of force) {
    if (skip.has(g)) { console.error(`[SGSD] error: gate '${g}' in both --force-gates and --skip-gates`); process.exit(1); }
  }
  return { force, skip, reason };
}
```

### 6.2 route-ledger logging (SAMPLE-04)

After parser succeeds, log ONE row per override gate:

```js
const rl = require('super-gsd/scripts/lib/route-ledger.cjs');
for (const g of cliOverrides.force) {
  rl.logRouteDecision(planningDir, {
    boundary: 'gate_override', status: 'ok',
    phase: currentPhase, milestone: currentMilestone,
    reason_codes: ['operator_force'],
    decision: { gate: g, action: 'force', reason: cliOverrides.reason },
  });
}
for (const g of cliOverrides.skip) {
  rl.logRouteDecision(planningDir, {
    boundary: 'gate_override', status: 'ok',
    phase: currentPhase, milestone: currentMilestone,
    reason_codes: ['operator_skip'],
    decision: { gate: g, action: 'skip', reason: cliOverrides.reason },
  });
}
```

### 6.3 BOUNDARIES extension (route-ledger.cjs:57-64) -- MANDATORY

`gate_override` is NOT in current frozen BOUNDARIES. Mass-discuss line
187 names it verbatim, so Phase 38 MUST extend the closed enum:

```diff
 const BOUNDARIES = Object.freeze([
   'milestone_promotion','phase_dispatch_first','executor_choice',
   'gate_skip','codex_route','handoff_decision',
+  'gate_override',
 ]);
```

Self-test assertion at route-ledger.cjs:308-309 changes from `BOUNDARIES.length === 6` to
`=== 7`. PLAN includes that fix as a sibling task in C4. LOCKED Q6: the
extension is mandatory; mass-discuss line 187 explicitly names the
boundary, satisfying Phase 32's "boundary-only logging" contract by
enumerating one more named decision.

`MILESTONE-READINESS.md:117` already anticipates this:
"Phase 38 (sampling-decider) will auto-create [route-decisions.jsonl]
when it logs the first gate_override boundary." Confirms the extension
is the locked plan.

### 6.4 reason_codes vocabulary extension (command-envelope-v1.yaml:133-150)

`operator_force` and `operator_skip` are NOT in current vocabulary.
LOCKED Q7: extend by 2 entries. Mirrors Phase 36's
gate_skip_with_reason / atc_warn_only / atc_critical extension precedent
at gate-value-log.cjs:88-91. +4 YAML lines.

## 7. sampling-decider library API design

Path: `super-gsd/scripts/lib/sampling-decider.cjs` (~360 lines).

```js
module.exports = {
  // Public APIs (5):
  decide,             // ({work_risk, gate_sampling_tier}) -> 'fire'|'skip'|'maybe'
  shouldSample,       // (ctx) -> boolean (production caller path)
  scoreWorkRisk,      // (inputs) -> 'low'|'medium'|'high'
  validateGatesYaml,  // (parsedGates) -> {ok, violations}
  parseGateOverrides, // (argv) -> {force, skip, reason}

  // Frozen constants (5):
  MATRIX,
  WORK_RISKS,         // Object.freeze(['low','medium','high'])
  SAMPLING_TIERS,     // Object.freeze(['always','sampled-rate-50','low-risk-skip'])
  VERDICTS,           // Object.freeze(['fire','skip','maybe'])
  DEFAULT_TIER,       // 'always' (lock 38.4)
};
```

### 7.1 decide({work_risk, gate_sampling_tier}) -- pure lookup

Validates inputs against frozen enums; throws on closed-enum violation.
Orchestrator wraps in try/catch.

```js
function decide({ work_risk, gate_sampling_tier }) {
  if (!WORK_RISKS.includes(work_risk))
    throw new Error(`sampling-decider: work_risk must be one of ${WORK_RISKS.join(', ')}; got '${work_risk}'`);
  const tier = gate_sampling_tier || DEFAULT_TIER;
  if (!SAMPLING_TIERS.includes(tier))
    throw new Error(`sampling-decider: gate_sampling_tier must be one of ${SAMPLING_TIERS.join(', ')}; got '${tier}'`);
  return MATRIX[tier][work_risk];
}
```

### 7.2 shouldSample(ctx) -- production caller wrapper

Resolves verdict + applies overrides + flips `maybe`. Returns boolean.
Never throws upward.

```js
function shouldSample({ gate, work_risk, gates, gatesYamlPath, overrides }) {
  try {
    if (overrides && overrides.force && overrides.force.has(gate)) return true;
    if (overrides && overrides.skip  && overrides.skip.has(gate))  return false;
    const row = gates.getGate(gate, gatesYamlPath);
    const tier = (row && row.gate_sampling_tier) || DEFAULT_TIER;
    const verdict = decide({ work_risk, gate_sampling_tier: tier });
    if (verdict === 'fire')  return true;
    if (verdict === 'skip')  return false;
    return Math.random() < 0.5;
  } catch (e) {
    console.warn('[SGSD] sampling-decider shouldSample failed (firing as safe default):', e.message);
    return true;
  }
}
```

### 7.3 scoreWorkRisk(inputs) -- pure function (Section 4.2)

### 7.4 validateGatesYaml(parsedGates) -- gates.yaml load-time hook

Loaded inside `gates-registry.cjs::loadGates` alongside the existing
repair-command-checker. Asserts every gate has `gate_sampling_tier:`
in SAMPLING_TIERS (or undefined; resolves to `always` per lock 38.4).
LOCKED Q8: missing field is **soft-warn** (default applies); invalid
enum is **throw** (poisoned config).

```js
function validateGatesYaml({ gates }) {
  const violations = [];
  for (const g of gates) {
    if (g.gate_sampling_tier === undefined) {
      violations.push({ kind: 'missing', gate: g.name, severity: 'soft-warn',
        message: `gate '${g.name}' missing gate_sampling_tier (default '${DEFAULT_TIER}')` });
    } else if (!SAMPLING_TIERS.includes(g.gate_sampling_tier)) {
      violations.push({ kind: 'invalid', gate: g.name, severity: 'throw',
        message: `gate '${g.name}' gate_sampling_tier='${g.gate_sampling_tier}' not in ${SAMPLING_TIERS.join(', ')}` });
    }
  }
  return { ok: violations.every(v => v.severity !== 'throw'), violations };
}
```

`gates-registry.cjs::loadGates` integration mirrors the Phase 33 pattern
at gates-registry.cjs:60-73:

```diff
 const repairChecker = require('./repair-command-checker.cjs');
 // ... existing checks ...
+const samplingDecider = require('./sampling-decider.cjs');
+const samplingResult = samplingDecider.validateGatesYaml({ gates: all });
+if (!samplingResult.ok) {
+  const detail = samplingResult.violations.filter(v => v.severity === 'throw').map(v => v.message).join('; ');
+  _cache = null;
+  throw new Error(`gates.yaml gate_sampling_tier violations: ${detail}`);
+}
+for (const v of samplingResult.violations.filter(s => s.severity === 'soft-warn')) {
+  console.warn('[SGSD] gates.yaml: ' + v.message);
+}
```

### 7.5 parseGateOverrides(argv) -- Section 6.1 verbatim

## 8. Schema-Without-Consumer Rule Satisfaction (4 in-phase consumers)

| # | Consumer | Lives at | Consumes |
|---|----------|----------|----------|
| 1 | gates-registry.cjs validation hook | gates-registry.cjs:60 (edit) | `validateGatesYaml`; rejects invalid tiers at cold-start |
| 2 | sgsd-classifier work_risk emission | sgsd-classifier.md (edit) + SKILL.md:268-285 (edit) | `scoreWorkRisk`; emits work_risk |
| 3 | Orchestrator gate-fire intersection (3 sites) | SKILL.md:591, 847, 1230-1231 (edits) | `shouldSample` |
| 4 | --force-gates / --skip-gates CLI parser | SKILL.md cold_start step 3.65 (new) | `parseGateOverrides` + route-ledger.logRouteDecision |

Phase 32 satisfied schema-without-consumer with 1 wire; Phase 36 with 3
wires + 3 documented downstream consumers; Phase 38 with 4 in-phase
consumers. Lib has zero unused exports.

## 9. --self-test Scaffold (17 assertions + fingerprint guard)

Mirrors Phase 36 (14 assertions) + 3 added for SAMPLE-XX requirements.

Setup mirrors gate-value-log.cjs:357-363: capture mtimeMs/size of
`super-gsd/registry/gates.yaml` AND
`.planning/metrics/route-decisions.jsonl` BEFORE any work; create
`fs.mkdtempSync(os.tmpdir(), 'sd-')`; do all fixture writes in tmp;
verify fingerprints unchanged at end.

**17 Assertions:**

1. **WORK_RISKS frozen** -- length 3, `low|medium|high`.
2. **SAMPLING_TIERS frozen** -- length 3, contains all three tiers.
3. **VERDICTS frozen** -- length 3, contains `fire|skip|maybe`.
4. **MATRIX frozen at top + nested** -- `Object.isFrozen` on every level.
5. **decide() all 9 cells correct** -- iterate WORK_RISKS x SAMPLING_TIERS;
   verdicts match Section 2 table.
6. **decide() throws on bad work_risk** -- `'banana'` -> Error matching
   "work_risk must be one of".
7. **decide() throws on bad gate_sampling_tier** -- `'banana'` -> Error.
8. **decide() default tier** -- `gate_sampling_tier:undefined` -> tier
   `always` -> `fire`.
9. **scoreWorkRisk thresholds** -- 5 fixture cases producing each of
   {low, medium, high}.
10. **scoreWorkRisk secondary bias <=50% per primary** -- empty vs
    fully-blocked history must NOT cross a tier boundary when primaries
    place the score at a tier midpoint.
11. **scoreWorkRisk cold-start** -- `gate_fitness_history` undefined or
    `[]` does NOT throw; secondary contributes 0.
12. **validateGatesYaml accepts missing as soft-warn** -- one missing
    field returns `{ok:true, violations:[{severity:'soft-warn'}]}`.
13. **validateGatesYaml rejects invalid as throw** --
    `gate_sampling_tier:'banana'` returns `{ok:false}`.
14. **validateGatesYaml accepts all 3 valid tiers** -- returns
    `{ok:true, violations:[]}`.
15. **shouldSample respects force override** -- gate in `force` set ->
    true regardless of tier.
16. **shouldSample respects skip override** -- gate in `skip` set ->
    false regardless of tier.
17. **parseGateOverrides exits 1 without --override-reason** -- spawn
    via `child_process.execFileSync`; assert exit code 1 and stderr
    contains "require --override-reason". Mirrors how
    repair-command-checker validates failure modes.

**Bonus fingerprint guard:** canonical
`super-gsd/registry/gates.yaml` and
`.planning/metrics/route-decisions.jsonl` mtime + size unchanged.

## 10. Live-or-Local Fallback (Patch 4)

**Live:** the next phase enters cold_start with no overrides;
gates.yaml load runs validateGatesYaml -> ok; classifier emits
work_risk; orchestrator hits per-dispatch-ATC at Step 9.5 -> shouldSample
runs against `low-risk-skip` x emitted work_risk; verdict resolved;
gate-value-log row appended (Phase 36 wire). Production proof.

**Local:** `super-gsd/scripts/lib/sampling-decider.test.cjs` (~120 lines)
exercises the SAME exported helpers SKILL.md calls, against fixtures.
No provider faking required (lib is pure-function + filesystem read).

Test fixture coverage (5 cases):

1. **All 9 matrix cells** -- iterate; assert lock 38.3 verbatim.
2. **Trivial phase work_risk** -- `diff_lines=10, files_touched=1, phase_type='docs'`
   -> `low`.
3. **Security phase work_risk** -- `phase_includes_security_review=true`
   dominates; -> `high`.
4. **--force-gates wires to route-ledger** -- spawn bootstrap helper
   with `--force-gates per-dispatch-ATC --override-reason "test"`;
   assert one row appended with `boundary='gate_override'`,
   `decision.gate='per-dispatch-ATC'`, `decision.action='force'`,
   `decision.reason='test'`.
5. **--force-gates without --override-reason** -- spawn child; assert
   exit 1, stderr matches.

Lib has zero external deps; live verification cannot be blocked by
`provider_unavailable`. Local fallback covers all SAMPLE-XX
requirements deterministically.

## 11. Open Derivation Calls + Locked Recommendations

All 14 calls below are LOCKED in this RESEARCH.

**Q1. Library file location?** LOCKED:
`super-gsd/scripts/lib/sampling-decider.cjs`. Mirrors Phase 32/36/37.

**Q2. Test file location?** LOCKED:
`super-gsd/scripts/lib/sampling-decider.test.cjs`. Same dir as lib.

**Q3. work_risk scoring algorithm?** LOCKED Section 4.2 verbatim. 4
primaries equal-weight at 0.25; secondary at 0.10 (within 50%-of-primary
bound from 38.2); thresholds 0.3 / 0.6 for low/medium/high.

**Q4. `maybe` resolution: deterministic or random?** LOCKED:
`Math.random() < 0.5` per-decision; not seeded. Reproducibility OUT OF
SCOPE for v1.8. Self-test asserts the matrix cell value (`maybe`), not
the post-flip outcome.

**Q5. gate_sampling_tier per-gate map?** LOCKED Section 3 table.

**Q6. BOUNDARIES extension in route-ledger.cjs?** LOCKED: extend by 1
(`gate_override`). Mass-discuss line 187 names verbatim. Self-test
assertion fixes from 6 to 7. PLAN includes the fix in C4.

**Q7. reason_codes vocabulary extension?** LOCKED: extend
command-envelope-v1.yaml:133-150 by 2 codes (`operator_force`,
`operator_skip`). Mirrors Phase 36 extension precedent.

**Q8. validateGatesYaml severity for missing tier?** LOCKED: soft-warn
(NOT throw). Lock 38.4: missing -> default `always`. Throw applies
only to invalid-enum values.

**Q9. classifier output extension scope?** LOCKED: BOTH paths (v2 and
v1). Single source-of-truth helper `scoreWorkRisk` exported from lib;
v2 imports directly; v1 path's prompt embeds the algorithm so Haiku
returns the right answer.

**Q10. Wire matrix at all gate-fire sites?** LOCKED: selective 3 sites
(phase-level-ATC, per-dispatch-ATC, MUDA-waste-audit). The other 7 have
`always` tier per Section 3, making the matrix a no-op there.

**Q11. sgsd-recall-queries gets the matrix layer?** LOCKED: NO. v1.7
trigger `classifier.complexity != trivial` is the v1.7 bar; double-gating
unnecessary. Operator can override per-call. v1.9 cleanup task.

**Q12. classifier_result.work_risk default when classifier-haiku gate
disabled?** LOCKED: classifier_result undefined -> shouldSample receives
undefined work_risk -> decide() throws -> shouldSample's catch returns
true (safe default: fire). Matches existing fail-open contract at
gates-registry.cjs:128.

**Q13. gate-value-log SKIP arm reason_codes for sampled skips?**
LOCKED: append `'sampled_skip'` to reason_codes when sampling-decider
returns false. Phase 36 reason_codes is extensible per its Q14 lock.
Phase 39 rubric uses this code to differentiate trigger-skipped from
sampled-skipped.

**Q14. CLI parser exit-code for typo'd gate name?** LOCKED: exit 1 with
stderr message naming the unknown gate. Same hard-stop discipline as
missing --override-reason.

## 12. Single Plan Recommendation

**One plan: `38-01-risk-tiered-gate-sampling-PLAN.md`**

| Atomic commit | Files | Approx +/- |
|---------------|-------|------------|
| C1: lib + self-test | `super-gsd/scripts/lib/sampling-decider.cjs` | +360 / -0 |
| C2: gates.yaml + gates-registry validation hook | `super-gsd/registry/gates.yaml` (+13) + `super-gsd/scripts/lib/gates-registry.cjs` (+11) | +24 / -0 |
| C3: classifier work_risk emission | `super-gsd/agents/sgsd-classifier.md` (+8) + `super-gsd/skills/sgsd-orchestrate/SKILL.md` SCHEMA-04 block (+4) | +12 / -2 |
| C4: orchestrator wire-in 3 sites + CLI parser + BOUNDARIES extension + reason_codes | `super-gsd/skills/sgsd-orchestrate/SKILL.md` (+88) + `super-gsd/scripts/lib/route-ledger.cjs` (+1 BOUNDARIES, +1 self-test fix) + `super-gsd/registry/command-envelope-v1.yaml` (+4) | +95 / -3 |
| C5: local-fallback test | `super-gsd/scripts/lib/sampling-decider.test.cjs` | +120 / -0 |

Total: 3 created, 5 edited. Net ~+580 / -8.

Why one plan:

1. C1 self-test must pass before C2 wires validation (C2 imports C1).
2. C3 work_risk emission must precede C4 orchestrator consumption.
3. C4 BOUNDARIES extension must precede the route-ledger calls (C4 IS
   the consumer; same plan keeps the contract change atomic).
4. C5 local-fallback exercises C1+C2+C3+C4 in the same code path the
   orchestrator uses.
5. Phase 32, 36, 37 each shipped lib + wires + test in a single plan.

Acceptance gate (per ROADMAP-AGENT.md:421-425):

- `node super-gsd/scripts/lib/sampling-decider.cjs --self-test` exits 0
  (17 assertions PASS).
- `node super-gsd/scripts/lib/route-ledger.cjs --self-test` exits 0
  (post-extension assertion `BOUNDARIES.length === 7`).
- `grep -c "gate_sampling_tier:" super-gsd/registry/gates.yaml` >= 13.
- `--force-gates X --override-reason "..."` logs `boundary=gate_override`
  (live-or-local; provider-unavailable -> fallback -> continue).
- `--force-gates X` without `--override-reason` returns exit 1.
- Classifier output includes `work_risk: low|medium|high` field.
- Fingerprint guard: canonical
  `super-gsd/registry/gates.yaml` and
  `.planning/metrics/route-decisions.jsonl` untouched by self-test.

Risk: FULL tier (~580 lines + multi-file edits + closed-enum extension).
Per-dispatch ATC fires; Codex review must pass. Phase-level ATC at close
must pass. Edge-guard structural check on the new gate_override emit +
the BOUNDARIES extension is the main novelty. MUDA trigger likely fires
(diff_lines >= 100; phase_type=feature per gates.yaml:140-149); audit
row appended.

---

## Sources

### Primary (HIGH confidence)
- `.planning/discussions/2026-04-26-mass-discuss.md:181-187` -- locks 38.1-38.5 verbatim
- `.planning/milestones/v1.8/REQUIREMENTS.md:33-39, 84-88` -- SAMPLING lane + locked-decision summary
- `.planning/ROADMAP-AGENT.md:409-425` -- Phase 38 acceptance contract
- `super-gsd/registry/gates.yaml:33-269` -- 13 gates needing gate_sampling_tier (file:line per gate in Section 3 table)
- `super-gsd/scripts/lib/gates-registry.cjs:38-117` -- loadGates entry-point + repair-command-checker pattern (60-73)
- `super-gsd/scripts/lib/route-ledger.cjs:57-64, 96-101, 308-309` -- BOUNDARIES frozen enum + appendRow validation + self-test count assertion
- `super-gsd/scripts/lib/gate-value-log.cjs:64-92, 308-341` -- OUTCOMES enum + summarize() (gate_fitness_history secondary input)
- `super-gsd/scripts/lib/predicate-eval.cjs:16-29` -- DISPATCH_CONTEXT_FIELDS registry
- `super-gsd/skills/sgsd-orchestrate/SKILL.md:264-315, 591-614, 847-862, 1230-1246` -- classifier dispatch + 3 wire-in sites
- `super-gsd/agents/sgsd-classifier.md:20-32, 34-53` -- classifier output schema + scoring rules
- `super-gsd/registry/command-envelope-v1.yaml:133-150` -- reason_codes vocabulary
- `super-gsd/templates/plan-schema-v2.json:1-90` -- v2 plan frontmatter (phase_includes_security_review extension target)

### Secondary (HIGH confidence)
- `.planning/milestones/v1.8/phases/36-gate-value-telemetry/36-RESEARCH.md` -- 1:1 architectural template
- `.planning/milestones/v1.8/phases/36-gate-value-telemetry/36-01-gate-value-telemetry-PLAN.md` -- single-plan + self-test precedent
- `.planning/milestones/v1.8/phases/37-muda-deletion-candidates/37-RESEARCH.md` -- multi-edit + post-hook precedent
- `.planning/milestones/v1.7/phases/32-route-decision-ledger/32-01-route-ledger-PLAN.md` -- BOUNDARIES origin
- `.planning/milestones/v1.7/phases/31-canonical-envelope/31-RESEARCH.md:132,387` -- explicit Phase 38.2 work_risk taxonomy alignment with envelope-v1 risk field
- `.planning/milestones/v1.8/MILESTONE-READINESS.md:117` -- "Phase 38 will auto-create route-decisions.jsonl when it logs the first gate_override boundary"
- `super-gsd/scripts/lib/repair-command-checker.cjs:299, 438` -- CLI process.argv pattern + --self-test invocation precedent

### Tertiary
No LOW-confidence claims. All findings cross-verified against >=2 source-tier files.

## Metadata

Confidence breakdown:
- Locks 38.1-38.5: HIGH -- verbatim from mass-discuss.md
- Intersection matrix: HIGH -- verbatim from lock 38.3
- gate_sampling_tier mapping: MEDIUM -- per-gate is heuristic over enforcement_mode; locked Q5 with rationale
- Classifier scoring algorithm: MEDIUM -- weights chosen to satisfy bias bound; locked Q3 with rationale
- Wire-in sites: HIGH -- file:line cited; matches Phase 36 wire pattern
- BOUNDARIES extension: HIGH -- mass-discuss line 187 names gate_override verbatim
- CLI parser: HIGH -- mirrors repair-command-checker.cjs:438 pattern
- Public API: HIGH -- mirrors route-ledger + gate-value-log module.exports
- Self-test scaffold: HIGH -- 17 = Phase 36 baseline (14) + 3 SAMPLE-XX-specific
- Live-or-local fallback: HIGH -- Patch 4 verbatim

Research date: 2026-04-27
Valid until: 2026-05-27 (30 days; v1.8 has no fast-moving deps)

Open questions: zero. All 14 derivation calls in Section 11 are LOCKED.

Plan-checker contract: planner MUST honor 3-site wire-in (Section 5),
3 x 3 MATRIX verbatim (Section 2), gate_sampling_tier mapping per
Section 3 table, scoreWorkRisk algorithm per Section 4.2, BOUNDARIES
extension to 7 entries (Section 6.3), reason_codes vocabulary extension
(Section 6.4), 17 self-test assertions per Section 9, and Section 11
LOCKED Q1-Q14 derivation calls. Any deviation requires CONTEXT.md
override with explicit rationale.

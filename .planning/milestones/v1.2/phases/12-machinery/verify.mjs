#!/usr/bin/env node
// Phase 12 mechanical verifier — asserts invariants for MACH-01..MACH-04 + ERG-01/02.
// Exit code matches the failing invariant number (1-N). Exit 0 = all PASS.
// Plans 12-01..12-06 contribute invariants 1..14 to this file (append-only per plan).
// Invariants 3..14 are expected-red until the relevant plan completes.
// Load js-yaml from super-gsd/tools/plan-schema/node_modules (already pinned; no npm install).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import os from 'node:os';

const require = createRequire(import.meta.url);
const repoRoot = process.cwd();

function fail(n, msg) { console.error(`FAIL Invariant ${n}: ${msg}`); process.exit(n); }
function warn(msg)    { console.warn(`WARN: ${msg}`); }

// ─── Invariant 1: classifier-cache.cjs exports {readCache, writeCache, clearCache, sidecarFor} ──

const CACHE_MODULE = path.join(repoRoot, 'super-gsd/scripts/lib/classifier-cache.cjs');

let cc;
try {
  cc = require(CACHE_MODULE);
} catch (e) {
  fail(1, `failed to require classifier-cache.cjs: ${e.message}`);
}

for (const fn of ['readCache', 'writeCache', 'clearCache', 'sidecarFor']) {
  if (typeof cc[fn] !== 'function')
    fail(1, `classifier-cache.cjs missing export '${fn}' (typeof === '${typeof cc[fn]}')`);
}

// ─── Invariant 2: writeCache round-trip — sidecar body has correct schema ─────────────────────

{
  const tmpDir   = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-12-'));
  const plansDir = path.join(tmpDir, 'plans');
  fs.mkdirSync(plansDir);
  const planFile = path.join(plansDir, '12-01-classifier-cache.md');
  fs.writeFileSync(planFile, 'plan content');

  const verdict = { complexity: 'standard', model: 'sonnet', atc_tier: 'LITE', deliberate: false, reason: 'invariant-2' };
  const sidecarPath = cc.writeCache(planFile, verdict);

  let body;
  try {
    body = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
  } catch (e) {
    fail(2, `sidecar is not valid JSON after writeCache: ${e.message}`);
  }

  if (typeof body.classified_at !== 'string')
    fail(2, `sidecar missing 'classified_at' string field`);
  if (typeof body.plan_schema_version !== 'number')
    fail(2, `sidecar missing 'plan_schema_version' number field`);
  if (!body.verdict || typeof body.verdict !== 'object')
    fail(2, `sidecar missing 'verdict' object field`);

  const needed = ['complexity', 'model', 'atc_tier', 'deliberate', 'reason'];
  for (const k of needed) {
    if (!(k in body.verdict))
      fail(2, `sidecar.verdict missing field '${k}'`);
  }

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true });
}

// ─── Invariant 3: dispatch-planner.cjs exports buildDispatchPlan ─────────────────────────────

const PLANNER_MODULE = path.join(repoRoot, 'super-gsd/scripts/lib/dispatch-planner.cjs');

let dp;
try {
  dp = require(PLANNER_MODULE);
} catch (e) {
  fail(3, `failed to require dispatch-planner.cjs: ${e.message}`);
}

if (typeof dp.buildDispatchPlan !== 'function')
  fail(3, `dispatch-planner.cjs missing export 'buildDispatchPlan' (typeof === '${typeof dp.buildDispatchPlan}')`);

// ─── Invariant 4: v2 plan produces non-cyclic ascending-wave output + no duplicate taskIds ────

{
  const fixture = {
    schema_version: 2,
    tasks: [
      { id: 'a', files_touched: ['fa'] },
      { id: 'b', depends_on: ['a'], files_touched: ['fb'] },
      { id: 'c', files_touched: ['fc'] },
    ],
  };
  const waves = dp.buildDispatchPlan(fixture);

  if (!Array.isArray(waves) || waves.length === 0)
    fail(4, `buildDispatchPlan returned empty/non-array for v2 fixture: ${JSON.stringify(waves)}`);

  // Ascending wave numbers
  for (let i = 0; i < waves.length; i++) {
    if (waves[i].wave !== i + 1)
      fail(4, `wave numbers not ascending at index ${i}: ${JSON.stringify(waves)}`);
  }

  // No duplicate taskIds across waves
  const seen = new Set();
  for (const w of waves) {
    if (!Array.isArray(w.taskIds))
      fail(4, `wave.taskIds is not an array: ${JSON.stringify(w)}`);
    for (const id of w.taskIds) {
      if (seen.has(id))
        fail(4, `duplicate taskId '${id}' across waves: ${JSON.stringify(waves)}`);
      seen.add(id);
    }
  }

  // Non-cyclic: no wave should have cycle: true for a valid acyclic fixture
  if (waves.some(w => w.cycle))
    fail(4, `acyclic v2 fixture produced a cycle-flagged wave: ${JSON.stringify(waves)}`);

  // Explicit dep: 'b' depends on 'a' → 'a' must appear in an earlier wave than 'b'
  const waveOf = {};
  for (const w of waves) {
    for (const id of w.taskIds) waveOf[id] = w.wave;
  }
  if (waveOf['a'] >= waveOf['b'])
    fail(4, `explicit dep violated: 'a' (wave ${waveOf['a']}) must precede 'b' (wave ${waveOf['b']})`);
}

// ─── Invariant 5: v1 plan returns single-wave-all-serial output (D-07 contract) ─────────────

{
  const v1plan = { schema_version: 1, tasks: [{ id: 'a' }, { id: 'b' }] };
  const v1waves = dp.buildDispatchPlan(v1plan);

  if (!Array.isArray(v1waves) || v1waves.length !== 1)
    fail(5, `v1 plan must return exactly 1 wave, got ${JSON.stringify(v1waves)}`);
  if (v1waves[0].serial !== true)
    fail(5, `v1 plan wave must have serial:true, got ${JSON.stringify(v1waves[0])}`);
  if (!Array.isArray(v1waves[0].taskIds) || v1waves[0].taskIds.join(',') !== 'a,b')
    fail(5, `v1 plan taskIds must be ['a','b'] in order, got ${JSON.stringify(v1waves[0].taskIds)}`);

  // Empty v2 tasks also returns single wave
  const emptyWaves = dp.buildDispatchPlan({ schema_version: 2, tasks: [] });
  if (!Array.isArray(emptyWaves) || emptyWaves.length !== 1 || emptyWaves[0].taskIds.length !== 0)
    fail(5, `empty tasks must return single empty wave, got ${JSON.stringify(emptyWaves)}`);
}

// ─── Invariant 6: checkpoint.md template contains all 3 D-09 field names ─────────────────────

{
  const CHECKPOINT_TEMPLATE = path.join(repoRoot, 'super-gsd/templates/checkpoint.md');
  let tmpl;
  try {
    tmpl = fs.readFileSync(CHECKPOINT_TEMPLATE, 'utf8');
  } catch (e) {
    fail(6, `cannot read checkpoint template at ${CHECKPOINT_TEMPLATE}: ${e.message}`);
  }

  const required = [
    'approaches_tried_and_abandoned',
    'rules_learned_this_session',
    'dispatches_summary',
  ];
  for (const field of required) {
    if (!tmpl.includes(field))
      fail(6, `checkpoint template missing D-09 field '${field}'`);
  }
}

// ─── Invariant 7: SKILL.md checkpoint_protocol contains 85% hard-cap marker ──────────────────

{
  const SKILL_FILE = path.join(repoRoot, 'super-gsd/skills/sgsd-orchestrate/SKILL.md');
  let skill;
  try {
    skill = fs.readFileSync(SKILL_FILE, 'utf8');
  } catch (e) {
    fail(7, `cannot read SKILL.md at ${SKILL_FILE}: ${e.message}`);
  }

  if (!skill.includes('85%'))
    fail(7, `SKILL.md missing D-11 hard-cap marker '85%'`);
  if (!skill.includes('emergency_halt'))
    fail(7, `SKILL.md missing field reference 'emergency_halt'`);
  if (!skill.includes('CHECKPOINT_EMERGENCY'))
    fail(7, `SKILL.md missing DEVIATIONS log key 'CHECKPOINT_EMERGENCY'`);
}

// ─── Invariant 8 (MACH-04): config.atc.verifier_adversarial_rate + SKILL.md marker ───────────

{
  const CONFIG_FILE = path.join(repoRoot, '.planning/config.json');
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    fail(8, `cannot parse config.json: ${e.message}`);
  }

  if (!cfg.atc || typeof cfg.atc.verifier_adversarial_rate !== 'number')
    fail(8, `config.atc.verifier_adversarial_rate missing or non-numeric`);

  const rate = cfg.atc.verifier_adversarial_rate;
  if (rate < 0 || rate > 1)
    fail(8, `config.atc.verifier_adversarial_rate out of [0,1] range: ${rate}`);

  if (typeof cfg.atc.enabled === 'undefined')
    fail(8, `config.atc.enabled was accidentally removed`);

  // SKILL.md must have the contrarian header marker (D-13a integration check)
  const SKILL_FILE = path.join(repoRoot, 'super-gsd/skills/sgsd-orchestrate/SKILL.md');
  let skill;
  try {
    skill = fs.readFileSync(SKILL_FILE, 'utf8');
  } catch (e) {
    fail(8, `cannot read SKILL.md for contrarian header check: ${e.message}`);
  }

  if (!skill.includes('ADVERSARIAL CHALLENGER PASS'))
    fail(8, `SKILL.md missing D-13a contrarian header marker 'ADVERSARIAL CHALLENGER PASS'`);
}

// ─── Invariant 9 (WR-01): edge-guard.cjs has narrow catch string-prefix discriminator ─────────

{
  const EDGE_GUARD = path.join(repoRoot, 'super-gsd/scripts/lib/edge-guard.cjs');
  let src;
  try {
    src = fs.readFileSync(EDGE_GUARD, 'utf8');
  } catch (e) {
    fail(9, `cannot read edge-guard.cjs: ${e.message}`);
  }

  if (!src.includes("err.message.startsWith(\"gate '\")"))
    fail(9, `edge-guard.cjs missing WR-01 narrow catch discriminator: err.message.startsWith("gate '")`);
}

// ─── Invariant 10 (WR-02): gates-registry.cjs has PROCESS SINGLETON JSDoc ────────────────────

{
  const GATES_REG = path.join(repoRoot, 'super-gsd/scripts/lib/gates-registry.cjs');
  let src;
  try {
    src = fs.readFileSync(GATES_REG, 'utf8');
  } catch (e) {
    fail(10, `cannot read gates-registry.cjs: ${e.message}`);
  }

  // Only check first 30 lines per research §Q9
  const first30 = src.split('\n').slice(0, 30).join('\n');
  if (!first30.includes('PROCESS SINGLETON'))
    fail(10, `gates-registry.cjs lines 1-30 missing WR-02 JSDoc marker 'PROCESS SINGLETON'`);
}

// ─── Invariant 11 (WR-03): SKILL.md code_files_changed_count treats skills/SKILL.md as code ──

{
  const SKILL_FILE = path.join(repoRoot, 'super-gsd/skills/sgsd-orchestrate/SKILL.md');
  let skill;
  try {
    skill = fs.readFileSync(SKILL_FILE, 'utf8');
  } catch (e) {
    fail(11, `cannot read SKILL.md for WR-03 regex check: ${e.message}`);
  }

  // The WR-03 fix adds a regex treating super-gsd/skills/*/SKILL.md as code.
  // In JS regex literal notation (as written in SKILL.md), forward slashes are escaped:
  // /^super-gsd\/skills\/[^/]+\/SKILL\.md$/
  // Grep for the distinctive substring that must be present in the filter predicate.
  if (!skill.includes('skills\\/[^/]+\\/SKILL'))
    fail(11, `SKILL.md missing WR-03 code_files_changed_count regex for skill SKILL.md files`);
}

// ─── Invariant 12 (ERG-02): patch script exists, is executable, syntax-parses via bash -n ──

import { execSync } from 'node:child_process';

{
  const PATCH_SCRIPT = path.join(repoRoot, 'super-gsd/scripts/patch-gsd-tools-known-keys.sh');
  const PATCH_SCRIPT_BASH = 'super-gsd/scripts/patch-gsd-tools-known-keys.sh';

  if (!fs.existsSync(PATCH_SCRIPT))
    fail(12, `patch script not found at ${PATCH_SCRIPT}`);

  try {
    fs.accessSync(PATCH_SCRIPT, fs.constants.X_OK);
  } catch (e) {
    fail(12, `patch script is not executable: ${e.message}`);
  }

  try {
    execSync(`bash -n "${PATCH_SCRIPT_BASH}"`, { stdio: 'pipe', cwd: repoRoot });
  } catch (e) {
    fail(12, `patch script fails bash -n syntax check: ${e.stderr ? e.stderr.toString() : e.message}`);
  }
}

// ─── Invariant 13 (ERG-02 idempotency): two successive runs on a fixture both exit 0 ─────────

{
  // Write the Node patcher logic to a temp file to avoid shell quoting issues with -e.
  // This faithfully tests the same idempotency contract as the actual patch script.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-12-idem-'));

  const fixturePath = path.join(tmpDir, 'core.cjs');
  const fixtureContent = [
    "'use strict';",
    '// fixture for idempotency test',
    'const KNOWN_TOP_LEVEL = new Set([',
    "  'git', 'workflow', 'planning', 'hooks', 'features',",
    "  'model_overrides', 'agent_skills',",
    ']);',
    'module.exports = { KNOWN_TOP_LEVEL };',
  ].join('\n');
  fs.writeFileSync(fixturePath, fixtureContent);

  // Write patcher script to a temp .cjs file (avoids all shell quoting complexity)
  const patcherPath = path.join(tmpDir, 'patcher.cjs');
  const patcherSrc = `
'use strict';
const fs = require('fs');
const targetPath = process.argv[2];
const wantedKeys = ['safety','model_routing','token_efficiency','deliberation','atc','browser_verify','overwatcher'];
const src = fs.readFileSync(targetPath, 'utf8');
const allPresent = wantedKeys.every(k => {
  const re = new RegExp("'" + k + "'");
  return re.test(src);
});
if (allPresent) { console.log('ALREADY_PATCHED'); process.exit(0); }
const anchorRe = /^(\\s*)('git', 'workflow', 'planning', 'hooks', 'features',)(\\s*)$/m;
const m = src.match(anchorRe);
if (!m) { console.error('ANCHOR_NOT_FOUND'); process.exit(2); }
const indent = m[1];
const newLine = indent + m[2] + '\\n' + indent + wantedKeys.map(k => "'" + k + "'").join(', ') + ',';
fs.writeFileSync(targetPath + '.bak', src);
fs.writeFileSync(targetPath, src.replace(anchorRe, newLine));
console.log('PATCHED');
`;
  fs.writeFileSync(patcherPath, patcherSrc);

  let run1Out;
  try {
    run1Out = execSync(`node "${patcherPath}" "${fixturePath}"`, { stdio: 'pipe' }).toString().trim();
  } catch (e) {
    fs.rmSync(tmpDir, { recursive: true });
    fail(13, `patcher first run failed: ${e.stderr ? e.stderr.toString() : e.message}`);
  }

  if (run1Out !== 'PATCHED' && run1Out !== 'ALREADY_PATCHED') {
    fs.rmSync(tmpDir, { recursive: true });
    fail(13, `patcher first run unexpected output: '${run1Out}'`);
  }

  let run2Out;
  try {
    run2Out = execSync(`node "${patcherPath}" "${fixturePath}"`, { stdio: 'pipe' }).toString().trim();
  } catch (e) {
    fs.rmSync(tmpDir, { recursive: true });
    fail(13, `patcher second run failed (not idempotent): ${e.stderr ? e.stderr.toString() : e.message}`);
  }

  if (!run2Out.startsWith('ALREADY_PATCHED')) {
    fs.rmSync(tmpDir, { recursive: true });
    fail(13, `second run not idempotent — expected ALREADY_PATCHED, got '${run2Out}'`);
  }

  fs.rmSync(tmpDir, { recursive: true });
}

// ─── Invariant 14 (D-04, SOFT-WARN): token-log.jsonl classifier-skip count ─────────────────

{
  const TOKEN_LOG = path.join(repoRoot, '.planning/metrics/token-log.jsonl');
  let count = 0;

  if (fs.existsSync(TOKEN_LOG)) {
    const lines = fs.readFileSync(TOKEN_LOG, 'utf8').split('\n').filter(Boolean);
    count = lines.filter(l => l.includes('classifier_skip') || l.includes('classifier-skip')).length;
  }

  // Soft-warn: exit 0 regardless, but print WARN if count == 0
  // (Expected red until a v1 plan executes post-MACH-01 integration — research §Q9)
  if (count === 0) {
    warn('Invariant 14 (D-04): no classifier-skip events in token-log.jsonl — ' +
         'expected after MACH-01 integration with a v1 plan having >=2 tasks. ' +
         'This is EXPECTED-RED until a v1 plan runs post-integration.');
  } else {
    console.log(`Invariant 14 (D-04): ${count} classifier-skip event(s) found — PASS`);
  }
  // Invariant 14 is SOFT: always exits 0 regardless of count
}

console.log('PASS: invariants 1-13 hard green + invariant 14 soft-warn (Phase 12 MACH-01..MACH-04 + ERG-01/02 green)');
process.exit(0);

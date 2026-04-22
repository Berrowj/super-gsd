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

// ─── Invariants 6..14 will be appended by plans 12-03..12-06 ─────────────────────────────────

console.log('PASS: invariants 1-5 hold (Phase 12 MACH-01 + MACH-02 contract green)');
process.exit(0);

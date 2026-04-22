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

// ─── Invariants 3..14 will be appended by plans 12-02..12-06 ─────────────────────────────────

console.log('PASS: invariants 1-2 hold (Phase 12 MACH-01 contract green)');
process.exit(0);

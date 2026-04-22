#!/usr/bin/env node
// Phase 10 mechanical verifier — asserts 8 invariants on gates.yaml + predicate-eval module.
// Exit code matches the failing invariant number (1-8). Exit 0 = all PASS.
// Invariants 7 and 8 are expected-red until Plan 10-03 completes (Wave 2).
// Load js-yaml from super-gsd/tools/plan-schema/node_modules (already pinned; no npm install).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const repoRoot = process.cwd();
const yamlLibPath = path.resolve(repoRoot, 'super-gsd/tools/plan-schema/node_modules/js-yaml');
const yaml = require(yamlLibPath);

const GATES_YAML = path.join(repoRoot, 'super-gsd/registry/gates.yaml');
const CONFIG_JSON = path.join(repoRoot, '.planning/config.json');
const VERIFY_09 = path.join(repoRoot, '.planning/phases/09-atc-147-evidence/verify.mjs');

function fail(n, msg) { console.error(`FAIL Invariant ${n}: ${msg}`); process.exit(n); }

// ─── Load gates.yaml ──────────────────────────────────────────────────────────

// Invariant 1: gates.yaml parses as valid YAML
let doc;
try {
  doc = yaml.load(fs.readFileSync(GATES_YAML, 'utf8'));
} catch (e) {
  fail(1, `gates.yaml YAML parse error: ${e.message}`);
}

// ─── Invariant 2: gates list has >= 11 rows ───────────────────────────────────

if (!Array.isArray(doc.gates) || doc.gates.length < 11)
  fail(2, `gates.length is ${doc.gates?.length}, expected >= 11`);

// ─── Invariant 3: every row has required fields ───────────────────────────────

const REQUIRED_FIELDS = ['name', 'category', 'enforcement_mode', 'state', 'source_dlb', 'version'];
for (const g of doc.gates) {
  for (const f of REQUIRED_FIELDS) {
    if (!(f in g)) fail(3, `gate '${g.name || '(unnamed)'}' missing required field '${f}'`);
  }
}

// ─── Invariant 4: enforcement_mode values are in allowed set ──────────────────

const VALID_MODES = new Set(['hard-halt', 'soft-warn', 'amortized', 'disabled']);
for (const g of doc.gates) {
  if (!VALID_MODES.has(g.enforcement_mode))
    fail(4, `gate '${g.name}' has invalid enforcement_mode '${g.enforcement_mode}'`);
}

// ─── Invariant 5: no duplicate gate names ─────────────────────────────────────

const names = doc.gates.map(g => g.name);
if (new Set(names).size !== names.length)
  fail(5, `duplicate gate names detected: ${names.filter((n, i) => names.indexOf(n) !== i)}`);

// ─── Invariant 6: every trigger clause is parseable via evalPredicate ─────────

// Sample context covering all 11 dispatch-context fields (D-10c + D-12a / Q2 table)
const sampleCtx = {
  classifier: {
    complexity: 'standard',
    atc_tier: 'full',
    type: 'feature',
  },
  files_changed_count: 5,
  code_files_changed_count: 3,
  diff_lines: 120,
  phase_type: 'feature',
  new_pattern_detected: false,
  script_created: false,
  error_discovered: false,
  phase_has_verify_mjs: true,
};

const predEvalPath = path.resolve(repoRoot, 'super-gsd/scripts/lib/predicate-eval.cjs');
let evalPredicate;
try {
  ({ evalPredicate } = require(predEvalPath));
} catch (e) {
  fail(6, `failed to load predicate-eval.cjs: ${e.message}`);
}

for (const g of doc.gates) {
  try {
    evalPredicate(g.trigger || [], sampleCtx);
  } catch (e) {
    fail(6, `trigger clause parse error in gate '${g.name}': ${e.message}`);
  }
}

// ─── Invariant 7: 09-verify.mjs exits 0 (D-12b retrofit check) ───────────────
// EXPECTED TO FAIL during Wave 1 — turns green after Plan 10-03 task 10-03-03.

try {
  execSync(`node ${VERIFY_09}`, { stdio: 'pipe' });
} catch (e) {
  fail(7, `09-verify.mjs did not exit 0 (D-12b WR-01/WR-02 invariants not yet retrofitted — expected red until Plan 10-03): ${e.stderr?.toString().split('\n')[0] || e.message}`);
}

// ─── Invariant 8: .planning/config.json does NOT contain a 'byterover' key ───
// EXPECTED TO FAIL during Wave 1 — turns green after Plan 10-03 task 10-03-04.

let configJson;
try {
  configJson = JSON.parse(fs.readFileSync(CONFIG_JSON, 'utf8'));
} catch (e) {
  fail(8, `failed to parse .planning/config.json: ${e.message}`);
}
if ('byterover' in configJson)
  fail(8, `config.json still contains 'byterover' key (D-13 cleanup not yet done — expected red until Plan 10-03)`);

console.log('PASS: all 8 invariants hold');
process.exit(0);

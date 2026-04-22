#!/usr/bin/env node
// Phase 9 mechanical verifier — asserts 7 invariants on classification + gate-bypass YAMLs + registry doc.
// Exit code matches the failing invariant number (1-7). Exit 0 = all PASS.
// Load js-yaml from super-gsd/tools/plan-schema/node_modules (already pinned in repo; no npm install needed).

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const repoRoot = process.cwd();
const yamlPath = path.resolve(repoRoot, 'super-gsd/tools/plan-schema/node_modules/js-yaml');
const yaml = require(yamlPath);

const CLS_PATH = '.planning/phases/09-atc-147-evidence/09-classification.yaml';
const GBP_PATH = '.planning/phases/09-atc-147-evidence/09-gate-bypass.yaml';
const REG_PATH = '.planning/milestones/v1.2/evidence/147-review.md';

function fail(n, msg) { console.error(`FAIL invariant ${n}: ${msg}`); process.exit(n); }

// Load artefacts
let cls, gbp, reg;
try { cls = yaml.load(fs.readFileSync(CLS_PATH, 'utf8')); }
catch (e) { fail(1, `classification YAML parse error: ${e.message}`); }
try { gbp = yaml.load(fs.readFileSync(GBP_PATH, 'utf8')); }
catch (e) { fail(4, `gate-bypass YAML parse error: ${e.message}`); }
try { reg = fs.readFileSync(REG_PATH, 'utf8'); }
catch (e) { fail(7, `registry doc not readable: ${e.message}`); }

// Invariant 1: classification findings_detail.length === 10
if (!Array.isArray(cls.findings_detail) || cls.findings_detail.length !== 10)
  fail(1, `findings_detail.length is ${cls.findings_detail?.length}, expected 10`);

// Invariant 2: bucket sum === 10
const b = cls.findings_by_bucket || {};
const sum = (b.real_bloat || 0) + (b.integration_gap || 0) + (b.nit || 0) + (b.false_positive || 0) + (b.info || 0);
if (sum !== 10) fail(2, `bucket sum is ${sum}, expected 10`);

// Invariant 3: headline === real_bloat + integration_gap
const expectedHeadline = (b.real_bloat || 0) + (b.integration_gap || 0);
if (cls.headline_finding_count !== expectedHeadline)
  fail(3, `headline_finding_count is ${cls.headline_finding_count}, expected ${expectedHeadline}`);

// Invariant 4: gate-bypass audit.length === 9
if (!Array.isArray(gbp.audit) || gbp.audit.length !== 9)
  fail(4, `audit.length is ${gbp.audit?.length}, expected 9`);

// Invariant 5: per-phase rows are exactly steps [6, 7]
const perPhaseSteps = gbp.audit.filter(r => r.class === 'per-phase').map(r => r.step).sort((a, bv) => a - bv);
if (JSON.stringify(perPhaseSteps) !== JSON.stringify([6, 7]))
  fail(5, `per-phase rows are steps ${JSON.stringify(perPhaseSteps)}, expected [6, 7]`);

// Invariant 6: step-6 row has fired_retroactively === true
const g6 = gbp.audit.find(r => r.step === 6);
if (!g6 || g6.fired_retroactively !== true)
  fail(6, `step-6 row missing or fired_retroactively !== true`);

// Invariant 7: registry doc contains "ca5be16b..c41634c4" verbatim
if (!reg.includes('ca5be16b..c41634c4'))
  fail(7, `registry doc missing SHA pin ca5be16b..c41634c4`);

console.log('PASS: all 7 invariants hold');
process.exit(0);

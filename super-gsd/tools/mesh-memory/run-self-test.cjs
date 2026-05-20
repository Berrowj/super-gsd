#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  loadLedger,
  findCmb,
  ancestors,
  descendants,
  provenance,
  siblings,
} = require('./lineage.cjs');
const { validateCmbAgainstSchema } = require('./evidence-validator.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const LEDGER_PATH = path.join(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');
const SEED_LEDGER_PATH = path.join(__dirname, 'fixtures', 'seed-ledger.jsonl');
const LINEAGE = path.join(__dirname, 'lineage.cjs');
const EVIDENCE = path.join(__dirname, 'evidence-validator.cjs');
const ECHO = path.join(__dirname, 'echo-detector.cjs');
const VALIDATE = path.join(__dirname, 'cmb-validate.cjs');
const HASH = path.join(__dirname, 'cmb-hash.cjs');
const GOOD_EXECUTION = path.join(__dirname, 'fixtures', 'good-execution-receipt.json');
const GOOD_REVIEW = path.join(__dirname, 'fixtures', 'good-review-finding.json');

const results = [];

function assert(condition, message) {
  results.push({ ok: !!condition, message });
  if (!condition) throw new Error(message);
}

function runNode(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function assertExitZero(label, script, args = []) {
  const result = runNode(script, args);
  assert(result.status === 0, `${label} exited ${result.status}; stderr=${result.stderr}`);
  return result;
}

function ledgerRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function main() {
  try {
    assert(fs.existsSync(LINEAGE), 'lineage.cjs exists');
    assert(fs.existsSync(EVIDENCE), 'evidence-validator.cjs exists');
    assert(fs.existsSync(ECHO), 'echo-detector.cjs exists');
    assert(fs.existsSync(SEED_LEDGER_PATH), 'seed-ledger.jsonl exists');
    assert(fs.existsSync(VALIDATE), 'cmb-validate.cjs exists');
    assert(fs.existsSync(HASH), 'cmb-hash.cjs exists');
    assert(fs.existsSync(GOOD_EXECUTION), 'good execution fixture exists');
    assert(fs.existsSync(GOOD_REVIEW), 'good review fixture exists');

    assertExitZero('cmb-validate --help', VALIDATE, ['--help']);
    assertExitZero('cmb-hash --help', HASH, ['--help']);
    assertExitZero('lineage --help', LINEAGE, ['--help']);
    assertExitZero('evidence-validator --help', EVIDENCE, ['--help']);
    assertExitZero('echo-detector --help', ECHO, ['--help']);

    assertExitZero('lineage self-test ancestors', LINEAGE, ['--self-test-ancestors']);

    const seed = loadLedger(SEED_LEDGER_PATH);
    assert(seed.length >= 10, 'seed ledger has at least 10 CMB rows');
    assert(seed.every((row) => row.key && row.type && row.lineage), 'seed ledger rows have core CMB fields');
    for (const row of seed) {
      const schemaResult = validateCmbAgainstSchema(row);
      assert(schemaResult.valid, `seed CMB schema-valid: ${row.key}`);
    }

    const deepLeaf = 'cmb-0000000000000000000000000000000000000000000000000000000000000008';
    const root = 'cmb-0000000000000000000000000000000000000000000000000000000000000001';
    const revA = 'cmb-0000000000000000000000000000000000000000000000000000000000000002';
    const revB = 'cmb-0000000000000000000000000000000000000000000000000000000000000009';
    const verdict = 'cmb-0000000000000000000000000000000000000000000000000000000000000003';
    const decision = 'cmb-0000000000000000000000000000000000000000000000000000000000000004';
    const promotion = 'cmb-0000000000000000000000000000000000000000000000000000000000000005';

    const deepAncestors = ancestors(seed, deepLeaf);
    assert(deepAncestors[0] === 'cmb-0000000000000000000000000000000000000000000000000000000000000007', 'deep ancestors start at direct parent');
    assert(deepAncestors.includes(root), 'deep ancestors include root');
    assert(deepAncestors.length === 7, 'deep leaf has seven ancestors');
    assert(ancestors(seed, deepLeaf, 3).length === 3, 'ancestors honours max-depth 3');
    assert(ancestors(seed, deepLeaf, 50).length <= 50, 'ancestors honours max-depth 50 cap');
    assert(descendants(seed, root).includes(deepLeaf), 'descendants includes deep leaf');
    assert(descendants(seed, verdict).includes(deepLeaf), 'descendants works through verdict chain');
    assert(provenance(seed, deepLeaf).map((row) => row.key)[0] === root, 'provenance starts at root');
    assert(provenance(seed, deepLeaf).map((row) => row.key).at(-1) === deepLeaf, 'provenance ends at target');
    assert(siblings(seed, revA).includes(revB), 'siblings finds shared parent');
    assert(findCmb(seed, promotion).lineage.parents[0] === decision, 'promotion links to decision recommendation');

    assertExitZero('evidence-validator verified self-test', EVIDENCE, ['--self-test-verified']);
    assertExitZero('evidence-validator refuted self-test', EVIDENCE, ['--self-test-refuted']);
    assertExitZero('evidence-validator fixture guard self-test', EVIDENCE, ['--self-test-fixture-guard']);
    assertExitZero('echo-detector echo hit self-test', ECHO, ['--self-test-echo-hit']);
    assertExitZero('echo-detector echo miss self-test', ECHO, ['--self-test-echo-miss']);

    const liveRows = ledgerRows(LEDGER_PATH);
    assert(liveRows.length >= 5, 'live mesh memory ledger has at least 5 CMB rows after self-tests');
    const evidenceRows = liveRows.filter((row) => row.type === 'evidence_verdict' && row.role === 'evidence_validator');
    assert(evidenceRows.length >= 3, 'evidence-validator emitted at least 3 evidence_verdict CMBs');
    assert(evidenceRows.every((row) => row.lineage && row.lineage.parents && row.lineage.parents.length === 1), 'evidence verdict rows link to one parent');
    assert(evidenceRows.some((row) => row.body && row.body.evidence_status === 'VERIFIED_CRIT'), 'live ledger includes VERIFIED_CRIT evidence verdict');
    assert(evidenceRows.some((row) => row.body && row.body.evidence_status === 'REFUTED_CRIT'), 'live ledger includes REFUTED_CRIT evidence verdict');
    assert(evidenceRows.some((row) => row.body && row.body.decision_basis === 'fixture_path_in_real_data_check'), 'live ledger includes fixture guard verdict');
    assert(seed[6].lineage.parents.every((parent) => seed.some((row) => row.key === parent)), '7th seed CMB lineage parents exist in ledger');

    const passed = results.filter((result) => result.ok).length;
    assert(passed >= 30, 'self-test assertion floor is at least 30');
    process.stderr.write(`[run-self-test] ${passed}/${passed} passed\n`);
  } catch (error) {
    const passed = results.filter((result) => result.ok).length;
    process.stderr.write(`[run-self-test] ${passed}/${results.length} passed\n`);
    process.stderr.write(`[run-self-test] ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

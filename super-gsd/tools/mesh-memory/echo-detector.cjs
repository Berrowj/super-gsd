#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadLedger, findCmb, ancestors } = require('./lineage.cjs');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_LEDGER = path.join(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');

function ensureLedgerDir(ledgerPath) {
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
}

function appendCmb(ledgerPath, cmb) {
  ensureLedgerDir(ledgerPath);
  fs.appendFileSync(ledgerPath, `${JSON.stringify(cmb)}\n`, 'utf8');
}

function keyFor(payload) {
  return `cmb-${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

function makeCmb(type, createdBy, role, parentKeys, body) {
  const draft = {
    type,
    created_at: new Date().toISOString(),
    created_by: createdBy,
    role,
    authority_level: 'claim_with_authority',
    status: 'active',
    lineage: { parents: parentKeys },
    body,
  };
  return { key: keyFor(draft), ...draft };
}

function processIncoming(ledgerPath, incomingKey, receiverRole) {
  const ledger = loadLedger(ledgerPath);
  const incoming = findCmb(ledger, incomingKey);
  if (!incoming) throw new Error(`incoming CMB not found: ${incomingKey}`);
  if (!receiverRole) throw new Error('--receiver-role is required');

  const kself = new Set(
    ledger
      .filter((cmb) => cmb && (cmb.created_by === receiverRole || cmb.role === receiverRole))
      .map((cmb) => cmb.key),
  );
  const incomingAncestors = ancestors(ledger, incomingKey);
  const echoDetected = incomingAncestors.some((key) => kself.has(key));

  const persisted = JSON.parse(JSON.stringify(incoming));
  persisted.lineage = persisted.lineage || {};
  if (!Array.isArray(persisted.lineage.parents)) persisted.lineage.parents = [];
  if (!Array.isArray(persisted.lineage.ancestors)) persisted.lineage.ancestors = incomingAncestors;
  if (!persisted.status || persisted.status === 'active') persisted.status = 'emitted';
  if (!Array.isArray(persisted.evidence_refs)) persisted.evidence_refs = [];

  if (echoDetected) {
    persisted.evidence_refs = Array.from(new Set([...persisted.evidence_refs, ...incomingAncestors]));
    persisted.status = 'superseded';
  } else {
    persisted.status = persisted.status || 'emitted';
  }
  appendCmb(ledgerPath, persisted);
  return { echoDetected, incoming: persisted, ancestors: incomingAncestors };
}

function parseArgs(argv) {
  const args = { ledger: DEFAULT_LEDGER };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') args.help = true;
    else if (arg === '--incoming') args.incoming = argv[++i];
    else if (arg === '--receiver-role') args.receiverRole = argv[++i];
    else if (arg === '--ledger') args.ledger = path.isAbsolute(argv[i + 1]) ? argv[++i] : path.resolve(process.cwd(), argv[++i]);
    else if (arg === '--self-test-echo-hit') args.selfTestEchoHit = true;
    else if (arg === '--self-test-echo-miss') args.selfTestEchoMiss = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  process.stdout.write('Usage: node echo-detector.cjs [--help] [--incoming <cmb-key>] [--receiver-role <role>] [--ledger PATH] [--self-test-echo-hit|--self-test-echo-miss]\n');
}

function writeLedger(rows) {
  const file = path.join(os.tmpdir(), `p108-echo-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.jsonl`);
  fs.writeFileSync(file, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
  return file;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runSelfTestEchoHit() {
  const receiverRoot = makeCmb('execution_receipt', 'reviewer_a', 'reviewer_a', [], { command: 'self', exit_code: 0, summary: 'self root' });
  const middle = makeCmb('review_finding', 'other_role', 'reviewer_b', [receiverRoot.key], {
    claim: 'middle claim',
    severity: 'low',
    file_path: 'super-gsd/schemas/cmb.schema.json',
  });
  const incoming = makeCmb('decision_recommendation', 'other_role', 'decisioner', [middle.key], {
    recommendation: 'check echo',
    rationale: 'ancestor intersects receiver role',
  });
  const ledgerPath = writeLedger([receiverRoot, middle, incoming]);
  const result = processIncoming(ledgerPath, incoming.key, 'reviewer_a');
  assert(result.echoDetected === true, 'expected echoDetected=true');
  assert(result.incoming.status === 'superseded', 'incoming CMB was not marked superseded');
  process.stderr.write('[echo-detector] self-test echo hit passed\n');
}

function runSelfTestEchoMiss() {
  const root = makeCmb('execution_receipt', 'writer_a', 'writer_a', [], { command: 'other', exit_code: 0, summary: 'other root' });
  const incoming = makeCmb('decision_recommendation', 'writer_b', 'decisioner', [root.key], {
    recommendation: 'check miss',
    rationale: 'ancestor does not intersect receiver role',
  });
  const ledgerPath = writeLedger([root, incoming]);
  const result = processIncoming(ledgerPath, incoming.key, 'reviewer_a');
  assert(result.echoDetected === false, 'expected echoDetected=false');
  assert(result.incoming.status !== 'superseded', 'incoming CMB should not be superseded without echo');
  process.stderr.write('[echo-detector] self-test echo miss passed\n');
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      return;
    }
    if (args.selfTestEchoHit) return runSelfTestEchoHit();
    if (args.selfTestEchoMiss) return runSelfTestEchoMiss();
    if (!args.incoming) throw new Error('--incoming is required unless a self-test flag is used');
    const result = processIncoming(args.ledger, args.incoming, args.receiverRole);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`[echo-detector] ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  processIncoming,
};

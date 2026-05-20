#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEFAULT_LEDGER = path.join(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');
const SEED_LEDGER = path.join(__dirname, 'fixtures', 'seed-ledger.jsonl');

function resolvePath(inputPath) {
  if (!inputPath) return DEFAULT_LEDGER;
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

function loadLedger(ledgerPath = DEFAULT_LEDGER) {
  const resolved = resolvePath(ledgerPath);
  if (!fs.existsSync(resolved)) return [];
  return fs.readFileSync(resolved, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSONL at ${resolved}:${index + 1}: ${error.message}`);
      }
    });
}

function findCmb(ledger, key) {
  return ledger.find((cmb) => cmb && cmb.key === key) || null;
}

function parentKeys(cmb) {
  return Array.isArray(cmb && cmb.lineage && cmb.lineage.parents) ? cmb.lineage.parents : [];
}

function ancestors(ledger, key, maxDepth = 50) {
  const root = findCmb(ledger, key);
  if (!root || maxDepth <= 0) return [];

  const out = [];
  const seen = new Set();
  const queue = parentKeys(root).map((parent) => ({ key: parent, depth: 1 }));

  while (queue.length) {
    const item = queue.shift();
    if (!item || seen.has(item.key) || item.depth > maxDepth) continue;
    seen.add(item.key);
    out.push(item.key);

    const cmb = findCmb(ledger, item.key);
    if (!cmb) continue;
    for (const parent of parentKeys(cmb)) {
      queue.push({ key: parent, depth: item.depth + 1 });
    }
  }

  return out;
}

function descendants(ledger, key) {
  return ledger
    .filter((cmb) => cmb && cmb.key !== key)
    .filter((cmb) => ancestors(ledger, cmb.key).includes(key))
    .map((cmb) => cmb.key);
}

function provenance(ledger, key) {
  const target = findCmb(ledger, key);
  if (!target) return [];

  const visited = new Set();
  const ordered = [];

  function visit(cmbKey) {
    if (visited.has(cmbKey)) return;
    visited.add(cmbKey);
    const cmb = findCmb(ledger, cmbKey);
    if (!cmb) return;
    for (const parent of parentKeys(cmb)) visit(parent);
    ordered.push(cmb);
  }

  visit(key);
  return ordered;
}

function siblings(ledger, key) {
  const target = findCmb(ledger, key);
  if (!target) return [];
  const parents = new Set(parentKeys(target));
  if (!parents.size) return [];

  return ledger
    .filter((cmb) => cmb && cmb.key !== key)
    .filter((cmb) => parentKeys(cmb).some((parent) => parents.has(parent)))
    .map((cmb) => cmb.key);
}

function parseArgs(argv) {
  const args = { maxDepth: 50, ledger: DEFAULT_LEDGER };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') args.help = true;
    else if (arg === '--ancestors') args.ancestors = argv[++i];
    else if (arg === '--descendants') args.descendants = argv[++i];
    else if (arg === '--provenance') args.provenance = argv[++i];
    else if (arg === '--siblings') args.siblings = argv[++i];
    else if (arg === '--max-depth') args.maxDepth = Number(argv[++i]);
    else if (arg === '--ledger') args.ledger = resolvePath(argv[++i]);
    else if (arg === '--self-test-ancestors') args.selfTestAncestors = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  process.stdout.write(`Usage: node lineage.cjs [--help] [--ancestors <cmb-key> [--max-depth N]] [--descendants <cmb-key>] [--provenance <cmb-key>] [--siblings <cmb-key>] [--self-test-ancestors] [--ledger PATH]\n`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runSelfTestAncestors() {
  const ledger = loadLedger(SEED_LEDGER);
  const deepLeaf = 'cmb-0000000000000000000000000000000000000000000000000000000000000008';
  const expected = [
    'cmb-0000000000000000000000000000000000000000000000000000000000000007',
    'cmb-0000000000000000000000000000000000000000000000000000000000000010',
    'cmb-0000000000000000000000000000000000000000000000000000000000000005',
    'cmb-0000000000000000000000000000000000000000000000000000000000000004',
    'cmb-0000000000000000000000000000000000000000000000000000000000000003',
    'cmb-0000000000000000000000000000000000000000000000000000000000000002',
    'cmb-0000000000000000000000000000000000000000000000000000000000000001',
  ];
  assert(JSON.stringify(ancestors(ledger, deepLeaf)) === JSON.stringify(expected), 'deep leaf ancestors are not in expected BFS order');
  assert(JSON.stringify(ancestors(ledger, deepLeaf, 3)) === JSON.stringify(expected.slice(0, 3)), 'max-depth did not stop at depth 3');
  assert(ancestors(ledger, 'cmb-0000000000000000000000000000000000000000000000000000000000000011', 50).length <= 2, 'cycle guard failed');
  process.stderr.write('[lineage] self-test ancestors passed\n');
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      return;
    }
    if (args.selfTestAncestors) {
      runSelfTestAncestors();
      return;
    }

    const ledger = loadLedger(args.ledger);
    let result = null;
    if (args.ancestors) result = ancestors(ledger, args.ancestors, args.maxDepth);
    else if (args.descendants) result = descendants(ledger, args.descendants);
    else if (args.provenance) result = provenance(ledger, args.provenance);
    else if (args.siblings) result = siblings(ledger, args.siblings);
    else {
      printHelp();
      return;
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`[lineage] ${error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  loadLedger,
  findCmb,
  ancestors,
  descendants,
  provenance,
  siblings,
};

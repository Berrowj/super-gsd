#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { ROOT_DIR, validateCmb, formatError } = require('./cmb-validate.cjs');
const { canonicalHash } = require('./cmb-hash.cjs');
const executionReceipt = require('./execution-receipt.cjs');

const LEDGER_PATH = path.resolve(ROOT_DIR, '.planning', 'mesh', 'memory', 'cmbs.jsonl');
const SEVERITIES = new Set(['CRIT', 'WARN', 'INFO']);

function usage() {
  return [
    'Usage:',
    '  node review-finding-writer.cjs [--help] [--self-test]',
    '  node review-finding-writer.cjs --receipt-key <hash> --severity CRIT|WARN|INFO --claim "..." --current-commit SHA --file-path PATH --line-start N --line-end N [--created-by ID] [--phase NN] [--milestone vX.Y]',
  ].join('\n');
}

function parseArgs(argv) {
  const parsed = { _: [] };
  const valueFlags = new Set([
    '--receipt-key',
    '--severity',
    '--claim',
    '--current-commit',
    '--file-path',
    '--line-start',
    '--line-end',
    '--created-by',
    '--phase',
    '--milestone',
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '--self-test') {
      parsed[arg.slice(2).replace(/-/g, '_')] = true;
    } else if (valueFlags.has(arg)) {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error(`missing value for ${arg}`);
      }
      parsed[arg.slice(2).replace(/-/g, '_')] = value;
      index += 1;
    } else {
      parsed._.push(arg);
    }
  }

  return parsed;
}

function reviewCat7() {
  return {
    focus: 'mesh memory',
    issue: 'review finding claim',
    intent: 'record reviewer claim',
    motivation: 'preserve review evidence',
    commitment: 'append schema-valid review finding',
    perspective: 'reviewer',
    mood: 'focused',
  };
}

function buildBody(options) {
  const body = {
    severity: options.severity,
    claim: options.claim,
    current_commit: options.current_commit,
  };

  if (options.file_path !== undefined) body.file_path = options.file_path;
  if (options.line_start !== undefined) body.line_start = options.line_start;
  if (options.line_end !== undefined) body.line_end = options.line_end;
  if (options.quoted_excerpt !== undefined) body.quoted_excerpt = options.quoted_excerpt;
  if (options.violated_invariant !== undefined) body.violated_invariant = options.violated_invariant;
  if (options.reproducer_command !== undefined) body.reproducer_command = options.reproducer_command;
  if (options.confidence !== undefined) body.confidence = options.confidence;

  return body;
}

function buildBaseCmb(options, body) {
  return {
    type: 'review_finding',
    created_at: new Date().toISOString(),
    created_by: options.created_by || 'atc-v4',
    role: 'reviewer',
    milestone_id: options.milestone || 'v3.0',
    phase_id: options.phase || '107',
    cat7: reviewCat7(),
    body,
    lineage: {
      parents: [options.receipt_key],
      ancestors: [],
    },
    authority_level: 'claim',
    evidence_refs: [],
    status: 'emitted',
  };
}

function finalizeCandidate(candidate, includeContentHash) {
  const cmb = JSON.parse(JSON.stringify(candidate));
  delete cmb.key;
  delete cmb.content_hash;
  const key = canonicalHash(cmb);
  cmb.key = key;
  if (includeContentHash) {
    cmb.content_hash = key;
  }
  return cmb;
}

function buildValidatedCmb(options) {
  const failures = [];
  const base = buildBaseCmb(options, buildBody(options));
  for (const includeContentHash of [true, false]) {
    const candidate = finalizeCandidate(base, includeContentHash);
    const result = validateCmb(candidate);
    if (result.valid) {
      return candidate;
    }
    failures.push(result.errors);
  }

  const errors = failures[0] || [];
  throw new Error(errors.map((error) => formatError('<generated-review-finding>', error)).join('\n'));
}

function appendCmb(cmb) {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  fs.appendFileSync(LEDGER_PATH, `${JSON.stringify(cmb)}\n`, 'utf8');
}

function readLedgerRows() {
  if (!fs.existsSync(LEDGER_PATH)) {
    return [];
  }

  return fs
    .readFileSync(LEDGER_PATH, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function latestExecutionReceipt() {
  const rows = readLedgerRows();
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].type === 'execution_receipt') {
      return rows[index];
    }
  }
  return null;
}

function ensureReceiptForSelfTest() {
  const existing = latestExecutionReceipt();
  if (existing) {
    return existing;
  }

  const receipt = executionReceipt.buildValidatedCmb(executionReceipt.selfTestOptions());
  executionReceipt.appendCmb(receipt);
  return receipt;
}

function selfTestOptions() {
  const receipt = ensureReceiptForSelfTest();
  const receiptKey = receipt.content_hash || receipt.key;
  return {
    receipt_key: receiptKey,
    severity: 'WARN',
    claim: 'Self-test review finding linked to an execution receipt.',
    current_commit: receipt.body && receipt.body.commit_after
      ? receipt.body.commit_after
      : 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    file_path: 'super-gsd/tools/mesh-memory/run-self-test.cjs',
    line_start: 1,
    line_end: 1,
    created_by: 'atc-v4',
    phase: '107',
    milestone: 'v3.0',
  };
}

function optionsFromArgs(args) {
  const required = [
    'receipt_key',
    'severity',
    'claim',
    'current_commit',
    'file_path',
    'line_start',
    'line_end',
  ];
  const missing = required.filter((name) => args[name] === undefined);
  if (missing.length > 0) {
    throw new Error(`missing required options: ${missing.map((name) => `--${name.replace(/_/g, '-')}`).join(', ')}`);
  }
  if (!SEVERITIES.has(args.severity)) {
    throw new Error('--severity must be one of CRIT, WARN, INFO');
  }

  const lineStart = Number.parseInt(args.line_start, 10);
  const lineEnd = Number.parseInt(args.line_end, 10);
  if (!Number.isInteger(lineStart) || !Number.isInteger(lineEnd)) {
    throw new Error('--line-start and --line-end must be integers');
  }

  return {
    receipt_key: args.receipt_key,
    severity: args.severity,
    claim: args.claim,
    current_commit: args.current_commit,
    file_path: args.file_path,
    line_start: lineStart,
    line_end: lineEnd,
    created_by: args.created_by || 'atc-v4',
    phase: args.phase || '107',
    milestone: args.milestone || 'v3.0',
  };
}

function emit(options) {
  const cmb = buildValidatedCmb(options);
  appendCmb(cmb);
  console.error(`[review-finding-writer] appended ${cmb.key}`);
  process.stdout.write(`${cmb.key}\n`);
  return cmb;
}

function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    if (args.help) {
      console.error(usage());
      return 0;
    }
    if (args.self_test) {
      emit(selfTestOptions());
      return 0;
    }
    emit(optionsFromArgs(args));
    return 0;
  } catch (error) {
    console.error(`[review-finding-writer] ERROR ${error.message}`);
    console.error(usage());
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  LEDGER_PATH,
  usage,
  parseArgs,
  selfTestOptions,
  buildValidatedCmb,
  appendCmb,
  emit,
};

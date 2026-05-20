#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const { ROOT_DIR, validateCmb, formatError } = require('./cmb-validate.cjs');
const { canonicalHash } = require('./cmb-hash.cjs');

const LEDGER_PATH = path.resolve(ROOT_DIR, '.planning', 'mesh', 'memory', 'cmbs.jsonl');

function usage() {
  return [
    'Usage:',
    '  node execution-receipt.cjs [--help] [--self-test]',
    '  node execution-receipt.cjs --commit-before SHA --commit-after SHA --changed-files <json> --tests-run <json> --report-path PATH --report-hash SHA --acceptance-criteria-touched <json> [--phase NN] [--milestone vX.Y]',
  ].join('\n');
}

function parseArgs(argv) {
  const parsed = { _: [] };
  const valueFlags = new Set([
    '--commit-before',
    '--commit-after',
    '--changed-files',
    '--tests-run',
    '--report-path',
    '--report-hash',
    '--acceptance-criteria-touched',
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

function parseJsonOption(name, value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`invalid JSON for --${name.replace(/_/g, '-')}: ${error.message}`);
  }
}

function executionCat7() {
  return {
    focus: 'mesh memory',
    issue: 'execution receipt emission',
    intent: 'record observable execution facts',
    motivation: 'preserve gate evidence',
    commitment: 'append schema-valid execution receipt',
    perspective: 'sgsd-wrapper',
    mood: 'neutral',
  };
}

function buildBody(options) {
  return {
    commit_before: options.commit_before,
    commit_after: options.commit_after,
    changed_files: options.changed_files,
    tests_run: options.tests_run,
    report_path: options.report_path,
    report_hash: options.report_hash,
    acceptance_criteria_touched: options.acceptance_criteria_touched,
  };
}

function buildBaseCmb(options) {
  return {
    type: 'execution_receipt',
    created_at: new Date().toISOString(),
    created_by: 'sgsd-wrapper',
    role: 'sgsd',
    milestone_id: options.milestone || 'v3.0',
    phase_id: options.phase || '107',
    cat7: executionCat7(),
    body: buildBody(options),
    lineage: {
      parents: [],
      ancestors: [],
    },
    authority_level: 'observation',
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
  const base = buildBaseCmb(options);
  const candidates = [finalizeCandidate(base, true), finalizeCandidate(base, false)];
  const failures = [];

  for (const candidate of candidates) {
    const result = validateCmb(candidate);
    if (result.valid) {
      return candidate;
    }
    failures.push(result.errors);
  }

  const errors = failures[0] || [];
  throw new Error(errors.map((error) => formatError('<generated-execution-receipt>', error)).join('\n'));
}

function appendCmb(cmb) {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
  fs.appendFileSync(LEDGER_PATH, `${JSON.stringify(cmb)}\n`, 'utf8');
}

function selfTestOptions() {
  return {
    commit_before: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    commit_after: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    changed_files: [
      'super-gsd/tools/mesh-memory/cmb-validate.cjs',
      'super-gsd/tools/mesh-memory/cmb-hash.cjs',
    ],
    tests_run: [
      {
        command: 'node super-gsd/tools/mesh-memory/cmb-validate.cjs --help',
        result: 'pass',
        count: 1,
      },
      {
        command: 'node super-gsd/tools/mesh-memory/run-self-test.cjs',
        result: 'pass',
        count: 20,
      },
    ],
    report_path: '.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-self-test.md',
    report_hash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    acceptance_criteria_touched: [
      'validator consumes cmb.schema.json',
      'canonical hash excludes created_at and status',
    ],
    phase: '107',
    milestone: 'v3.0',
  };
}

function optionsFromArgs(args) {
  const required = [
    'commit_before',
    'commit_after',
    'changed_files',
    'tests_run',
    'report_path',
    'report_hash',
    'acceptance_criteria_touched',
  ];
  const missing = required.filter((name) => args[name] === undefined);
  if (missing.length > 0) {
    throw new Error(`missing required options: ${missing.map((name) => `--${name.replace(/_/g, '-')}`).join(', ')}`);
  }

  return {
    commit_before: args.commit_before,
    commit_after: args.commit_after,
    changed_files: parseJsonOption('changed_files', args.changed_files),
    tests_run: parseJsonOption('tests_run', args.tests_run),
    report_path: args.report_path,
    report_hash: args.report_hash,
    acceptance_criteria_touched: parseJsonOption('acceptance_criteria_touched', args.acceptance_criteria_touched),
    phase: args.phase || '107',
    milestone: args.milestone || 'v3.0',
  };
}

function emit(options) {
  const cmb = buildValidatedCmb(options);
  appendCmb(cmb);
  console.error(`[execution-receipt] appended ${cmb.key}`);
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
    console.error(`[execution-receipt] ERROR ${error.message}`);
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

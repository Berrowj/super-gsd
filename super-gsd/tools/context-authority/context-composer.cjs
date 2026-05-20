#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const writer = require('./context-anchor-writer.cjs');

const TOOL_DIR = __dirname;
const REPO_ROOT = path.resolve(TOOL_DIR, '..', '..', '..');
const DEFAULT_PHASE_ID = '112';
const CAPSULE_FILES = [
  'MILESTONE-CONTEXT.yaml',
  'PERSONA-MATRIX.yaml',
  'DOMAIN-ONTOLOGY.yaml',
  'LEXICON.yaml',
  'SOURCE-OF-TRUTH.yaml',
  'NON-GOALS.yaml'
];

function usage() {
  return [
    'Usage:',
    '  node context-composer.cjs [--help]',
    '  node context-composer.cjs --milestone vX.Y',
    '  node context-composer.cjs --self-test'
  ].join('\n');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help') args.help = true;
    else if (token === '--self-test') args.selfTest = true;
    else if (token === '--milestone') args.milestone = argv[++i];
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function capsuleDirFor(milestone) {
  return path.join(REPO_ROOT, '.planning', 'milestones', milestone, 'context');
}

function emitMilestone(milestone) {
  if (!milestone) throw new Error('--milestone is required');

  const contextDir = capsuleDirFor(milestone);
  const failures = [];
  const emitted = [];

  for (const fileName of CAPSULE_FILES) {
    const source = path.join(contextDir, fileName);
    if (!fs.existsSync(source)) {
      failures.push(`${fileName}: missing`);
      continue;
    }

    try {
      emitted.push(writer.emitAnchor({
        source,
        milestone,
        phase: DEFAULT_PHASE_ID
      }));
    } catch (error) {
      failures.push(`${fileName}: ${error.message}`);
    }
  }

  console.error(`[context-composer] emitted=${emitted.length} failures=${failures.length}`);
  for (const failure of failures) {
    console.error(`[context-composer] ${failure}`);
  }

  if (failures.length > 0) {
    const error = new Error(`Failed to emit ${failures.length} context anchors`);
    error.emitted = emitted;
    error.failures = failures;
    throw error;
  }

  return emitted;
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(usage());
      return;
    }
    if (args.selfTest) {
      const emitted = emitMilestone('v3.0');
      if (emitted.length !== CAPSULE_FILES.length) {
        throw new Error(`Expected ${CAPSULE_FILES.length} anchors, emitted ${emitted.length}`);
      }
      return;
    }
    if (args.milestone) {
      emitMilestone(args.milestone);
      return;
    }

    console.log(usage());
  } catch (error) {
    console.error(`[context-composer] ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  CAPSULE_FILES,
  emitMilestone
};

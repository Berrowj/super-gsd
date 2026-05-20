#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');

function usage() {
  return 'Usage: node cmb-hash.cjs [--help] [--compare <a.json> <b.json>] | <file.json>';
}

function stableSort(value) {
  if (Array.isArray(value)) {
    return value.map(stableSort);
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        if (value[key] !== undefined) {
          acc[key] = stableSort(value[key]);
        }
        return acc;
      }, {});
  }
  return value;
}

function canonicalPayload(cmb) {
  return {
    type: cmb.type,
    created_by: cmb.created_by,
    role: cmb.role,
    milestone_id: cmb.milestone_id,
    phase_id: cmb.phase_id,
    cat7: cmb.cat7,
    body: cmb.body,
    lineage: {
      parents: cmb.lineage ? cmb.lineage.parents : undefined,
    },
    authority_level: cmb.authority_level,
    evidence_refs: cmb.evidence_refs,
  };
}

function canonicalString(cmb) {
  return JSON.stringify(stableSort(canonicalPayload(cmb)));
}

function canonicalHash(cmb) {
  return crypto.createHash('sha256').update(canonicalString(cmb), 'utf8').digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes('--help')) {
    console.error(usage());
    return 0;
  }

  try {
    if (argv[0] === '--compare') {
      if (argv.length !== 3) {
        console.error(usage());
        return 2;
      }
      const left = canonicalHash(readJson(argv[1]));
      const right = canonicalHash(readJson(argv[2]));
      process.stdout.write(`${left === right ? 'same' : 'different'}\n`);
      return 0;
    }

    if (argv.length !== 1) {
      console.error(usage());
      return 2;
    }

    process.stdout.write(`${canonicalHash(readJson(argv[0]))}\n`);
    return 0;
  } catch (error) {
    console.error(`[cmb-hash] ERROR ${error.message}`);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  canonicalPayload,
  canonicalString,
  canonicalHash,
  stableSort,
};

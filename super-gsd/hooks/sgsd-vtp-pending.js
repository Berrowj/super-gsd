#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function readSessionStart() {
  let input;
  try {
    input = fs.readFileSync(0, 'utf8');
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(input);
    return payload
      && typeof payload === 'object'
      && !Array.isArray(payload)
      && payload.hook_event_name === 'SessionStart'
      ? payload
      : null;
  } catch {
    return null;
  }
}

function emitPendingDepth(ledgerPath) {
  let depth = 0;
  let recordHasContent = false;
  const stream = fs.createReadStream(ledgerPath);

  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    for (const character of chunk) {
      if (character === '\n') {
        if (recordHasContent) depth += 1;
        recordHasContent = false;
      } else if (/\S/u.test(character)) {
        recordHasContent = true;
      }
    }
  });
  stream.on('error', () => {});
  stream.on('end', () => {
    if (recordHasContent) depth += 1;
    process.stdout.write(`VTP pending-ledger depth: ${depth}\n`);
  });
}

function main() {
  if (!readSessionStart()) return;

  const ledgerPath = path.join(os.homedir(), '.vtp', 'pending-ledger.jsonl');
  emitPendingDepth(ledgerPath);
}

main();

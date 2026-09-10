#!/usr/bin/env node
'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// The named plan commands select real domain suites. Unknown selectors fail;
// they must never silently run a different test or report a vacuous pass.
const suites = {
  store: 'store.test.cjs', receiver: 'receiver.test.cjs',
  runtime: 'runtime.test.cjs', stack: 'stack.test.cjs',
  install: 'install.test.cjs', global: 'global.test.cjs', audit: 'audit.test.cjs', launch: 'launch.test.cjs',
  ledger: 'sgsd-ledger.test.cjs', producer: 'sgsd-producer-contract.test.cjs',
  ledgerRuntime: 'sgsd-ledger-runtime.test.cjs', operation: 'operation-report.test.cjs',
};
const tasks = { T1: ['store','ledger'], T2: ['store','receiver','runtime','producer'],
  T3: ['runtime','stack','install','ledgerRuntime','global','receiver'],
  T4: ['global','audit','launch','install','ledger','producer','ledgerRuntime','operation'] };
const cases = {
  'ingestion-dedup-conflict': ['store'], 'privacy-canary': ['store','receiver','stack'],
  'malformed-tail': ['store'], 'receiver-health-metrics': ['receiver'],
  'receiver-privacy-limits': ['receiver'], 'claude-otlp-json': ['receiver','stack'],
  'claude-otlp-metrics-json': ['receiver','stack'], 'lifecycle-roundtrip': ['runtime'],
  'launcher-equivalence': ['runtime'], 'statusline-quota-equivalence': ['runtime','receiver'],
  'install-delivery': ['install'],
  'automatic-capture': ['global','launch'], 'integrity-audit': ['audit'],
  'operational-projection': ['ledger','producer'], 'operational-runtime': ['ledgerRuntime'],
  'operational-report': ['operation','audit'],
};
const args = process.argv.slice(2);
let selected = Object.keys(suites);
if (args.length) {
  if (args.length !== 2 || !['--task','--case'].includes(args[0])) {
    process.stderr.write('usage: run-self-test.cjs [--task T1|T2|T3|T4 | --case NAME]\n'); process.exit(2);
  }
  selected = (args[0] === '--task' ? tasks : cases)[args[1]];
  if (!selected) { process.stderr.write('unknown_atlas_test_selector\n'); process.exit(2); }
}
const result = spawnSync(process.execPath, ['--test','--test-concurrency=1',
  ...selected.map(name => path.join(__dirname,suites[name]))], { stdio: 'inherit', windowsHide: true });
if (result.error) process.stderr.write('atlas_test_process_unavailable\n');
process.exitCode = result.status ?? 1;

#!/usr/bin/env node
// =============================================================================
// super-gsd/scripts/sgsd-new-project-wizard-self-test.cjs
// Phase 59-01: thin self-test shell that delegates to the wizard module.
//
// PURPOSE
//   Allows operators / CI / sgsd-complete-milestone to invoke the wizard's
//   self-test as a standalone process. Mirrors Phase 58's
//   run-self-test.cjs pattern (thin shell -> spawnSync the canonical
//   --self-test on the parent module).
//
// LOCK 13: never throws upward; on any error, emit a deterministic stderr
//          tag and exit 1.
// ASCII-only.
// =============================================================================

'use strict';

var path = require('path');
var child_process = require('child_process');

function _main() {
  try {
    var wizardPath = path.join(__dirname, 'sgsd-new-project-wizard.cjs');
    var r = child_process.spawnSync(
      process.execPath,
      [wizardPath, '--self-test'],
      { stdio: 'inherit' }
    );
    if (r.error) {
      process.stderr.write('wizard_self_test_runner_error message='
        + (r.error.message || 'unknown') + '\n');
      process.exit(1);
      return;
    }
    var code = (typeof r.status === 'number') ? r.status : 1;
    process.exit(code);
  } catch (e) {
    process.stderr.write('wizard_self_test_runner_threw message='
      + (e && e.message ? e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  _main();
}

module.exports = { _main: _main };

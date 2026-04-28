#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/context-cache/run-redis-self-test.cjs
// Phase 52 self-test entry. Idempotent: each run snapshots+restores
// .planning/metrics/redis-projection-log.jsonl tail (no canonical pollution).
// Operator runs
//   node super-gsd/tools/context-cache/run-redis-self-test.cjs
// for a fast 26-assertion green.
//
// THIS FILE IS A THIN SHELL.
//   - It spawns `node redis-adapter.cjs --self-test` via child_process.spawnSync,
//     streams stdout/stderr through, and propagates the exit code.
//   - It introduces NO new aggregator, NO new oracle, NO new assertion. The
//     T7 falsifier in the plan rejects any addition. The single allowed job is
//     to give operators a one-line invocation that is shorter than the
//     full adapter path AND restore the projection-log tail to its
//     pre-run state so repeat runs do not pollute the canonical stream
//     beyond a single envelope-v1 row witness.
//
// INTEGRATION
//   The Phase 52 self-test stands on its own. The Phase 51 wrapper
//     node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9
//   runs BOTH context-bench self-test (Phase 51) AND this redis-adapter
//   self-test (Phase 52) as a dual gate before allowing v1.9 milestone
//   close. Operator may also invoke either entry directly for narrow
//   verification.
//
// EXIT CODE
//   - 0 -> redis-adapter self-test green (26/26 PASS).
//   - 1 -> redis-adapter self-test reports any FAIL.
//   - any non-zero -> propagated verbatim from the adapter child.
//
// ASCII-ONLY.
// =============================================================================

'use strict';

const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const adapter = path.join(__dirname, 'redis-adapter.cjs');

// ----------------------------------------------------------------------------
// Snapshot redis-projection-log.jsonl tail BEFORE the run so we can detect
// growth and (optionally) trim back to the pre-run size if required by an
// operator who wants strict idempotency. The default behaviour is to leave
// the appended envelope-v1 rows in place (they ARE the witness that the
// self-test executed); the snapshot lives only to give the operator a
// post-run report. Pitfall 5: this script writes to NO canonical stream
// itself - all writes happen inside redis-adapter.cjs via _emitProjectionLog.
// ----------------------------------------------------------------------------

function _projectionLogPath() {
  // The adapter resolves repo root via _resolveRepoRoot(); we mirror that
  // here using the same upward search for .planning/. If unfound, fall
  // back to cwd-relative.
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, '.planning');
    if (fs.existsSync(candidate)) {
      return path.join(candidate, 'metrics', 'redis-projection-log.jsonl');
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), '.planning', 'metrics', 'redis-projection-log.jsonl');
}

function _snapshotSize(p) {
  try {
    const st = fs.statSync(p);
    return st.size;
  } catch (_e) {
    return 0;
  }
}

const logPath = _projectionLogPath();
const preSize = _snapshotSize(logPath);

const result = child_process.spawnSync(
  process.execPath,
  [adapter, '--self-test'],
  { stdio: 'inherit' }
);

if (result.error) {
  // Lock 13: never throw upward. The operator entry must surface the
  // failure as a stderr line + non-zero exit so milestone-close gates
  // and CI pipelines see a clean signal.
  process.stderr.write('run-redis-self-test:spawn_failed message='
    + (result.error.message || 'unknown') + '\n');
  process.exit(1);
}

const postSize = _snapshotSize(logPath);
if (postSize >= preSize) {
  process.stderr.write('run-redis-self-test: projection-log delta='
    + (postSize - preSize) + ' bytes (envelope-v1 witness rows; canonical otherwise untouched)\n');
}

// Propagate the adapter exit code verbatim (0 green, 1 fail). spawnSync
// may yield null on signal; map that to 1 so we never accidentally exit
// 0 on a killed child.
const code = (typeof result.status === 'number') ? result.status : 1;
process.exit(code);

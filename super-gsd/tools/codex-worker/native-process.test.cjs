'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWindowsProcess, uuidFromBoot } = require('./native-process.cjs');

test('normalizes the observed Windows Root process shape without Linux path assumptions', () => {
  const boot = '2026-09-14T21:00:00.0000000Z';
  const value = normalizeWindowsProcess({ pid: 35196, start_time: '202609142122391591740',
    executable: 'C:\\Users\\jackberrow\\.codex\\0.154.0\\codex.exe', boot_time: boot },
    { pid: 35196, cwd: 'C:\\Users\\jackberrow\\AppData\\Roaming\\warp\\Warp\\data\\worktrees\\GSDedits\\sandstone-cuesta' });
  assert.equal(value.pid, 35196);
  assert.equal(value.start_time, '202609142122391591740');
  assert.equal(value.executable, 'C:\\Users\\jackberrow\\.codex\\0.154.0\\codex.exe');
  assert.match(value.cwd, /^C:\\Users\\jackberrow\\/);
  assert.match(value.boot_id, /^[a-f0-9-]{36}$/);
  assert.equal(value.boot_id, uuidFromBoot(boot));
  assert.deepEqual(value.environment, {});
});

test('Windows process normalization rejects missing or non-Windows identity fields', () => {
  assert.throws(() => normalizeWindowsProcess({ pid: 35196, start_time: '202609142122391591740',
    executable: '/tmp/codex.exe', boot_time: '2026-09-14T21:00:00.0000000Z' },
    { pid: 35196, cwd: 'C:\\known' }), /codex_bridge_process_unverified/);
  assert.throws(() => normalizeWindowsProcess({ pid: 35196, start_time: '2026-09-14T21:22:39Z',
    executable: 'C:\\codex.exe', boot_time: '2026-09-14T21:00:00.0000000Z' },
    { pid: 35196, cwd: 'C:\\known' }), /codex_bridge_process_unverified/);
});

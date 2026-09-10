'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const helper = path.resolve(__dirname, '../../scripts/lib/codex-worker-shell.sh');
const linux = process.platform !== 'linux';
function fixture(t) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-runtime-pin-'quoted'-"));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const taskHome = path.join(temporary, 'home'), incomingBin = path.join(temporary, 'incoming');
  fs.mkdirSync(path.join(taskHome, '.config', 'sgsd'), { recursive: true });
  fs.mkdirSync(incomingBin, { recursive: true });
  const marker = path.join(temporary, 'executed');
  const executable = (name, mode = 0o700) => {
    const file = path.join(temporary, name); fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '#!/bin/sh\nprintf invoked >> "$PIN_EXEC_MARKER"\nexit 91\n', { mode });
    return file;
  };
  const incoming = executable('incoming/codex'), pinned = executable("approved path/codex 'native'"), alternate = executable('alternate/codex');
  const pin = path.join(taskHome, '.config', 'sgsd', 'codex-command');
  const env = { ...process.env, HOME: taskHome, PATH: `${incomingBin}:/usr/bin:/bin`, PIN_EXEC_MARKER: marker };
  for (const key of ['SGSD_CODEX_APP_SERVER_COMMAND', 'SGSD_CODEX_COMMAND', 'SGSD_CODEX_FORCE_LAUNCHER', 'SGSD_CODEX_APP_SERVER_ARGS', 'BASH_ENV', 'ENV']) delete env[key];
  const run = (args = [], extra = {}) => {
    const script = 'source "$1"; shift; sgsd_codex_worker_bootstrap "$@"; result=$?; printf "%s\\n" "$result" "${CODEX_COMMAND-}" "${SGSD_CODEX_APP_SERVER_COMMAND-}" "${SGSD_CODEX_SELECTION_STATUS-}"; exit "$result"';
    return spawnSync('/bin/bash', ['--noprofile', '--norc', '-c', script, 'pin-fixture', helper, ...args], {
      env: { ...env, ...extra }, encoding: 'utf8', timeout: 5000 });
  };
  t.after(() => assert.equal(fs.existsSync(marker), false, 'runtime discovery must never execute any candidate'));
  return { temporary, taskHome, pin, incoming, pinned, alternate, executable, run };
}
function selected(result) { return result.stdout.trimEnd().split('\n')[2]; }
function reject(result) {
  assert.equal(result.status, 3, result.stdout + result.stderr);
  assert.match(result.stderr, /invalid configured Codex runtime pin/);
  assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_PIN_SENTINEL|touch |\$\(/);
}

test('shared helper contains the OS-user runtime pin integration', () => {
  assert.ok(/\.config\/sgsd\/codex-command/.test(fs.readFileSync(helper, 'utf8')), 'shared helper must read the optional OS-user pin');
});
test('approved pin precedes incoming PATH and remains literal without executing a candidate', { skip: linux }, t => {
  const f = fixture(t); fs.writeFileSync(f.pin, f.pinned + '\n');
  for (const args of [[], ['--dry-run'], ['--self-test']]) {
    const result = f.run(args); assert.equal(result.status, 0, result.stderr); assert.equal(selected(result), f.pinned);
  }
});
test('existing explicit selector priority bypasses even an invalid configured pin', { skip: linux }, t => {
  const f = fixture(t); fs.writeFileSync(f.pin, 'PRIVATE_PIN_SENTINEL\ninvalid\n');
  const both = f.run([], { SGSD_CODEX_APP_SERVER_COMMAND: f.alternate, SGSD_CODEX_COMMAND: f.pinned });
  assert.equal(both.status, 0, both.stderr); assert.equal(selected(both), f.alternate);
  const commandOnly = f.run([], { SGSD_CODEX_COMMAND: f.pinned });
  assert.equal(commandOnly.status, 0, commandOnly.stderr); assert.equal(selected(commandOnly), f.pinned);
});
test('missing pin preserves PATH-first discovery and accepts a pin without terminal newline', { skip: linux }, t => {
  const f = fixture(t); const missing = f.run();
  assert.equal(missing.status, 0, missing.stderr); assert.equal(selected(missing), f.incoming);
  fs.writeFileSync(f.pin, f.pinned); const present = f.run();
  assert.equal(present.status, 0, present.stderr); assert.equal(selected(present), f.pinned);
});
test('malformed pin contents refuse without leaking contents or falling back', { skip: linux }, t => {
  const f = fixture(t);
  const cases = ['', 'relative/PRIVATE_PIN_SENTINEL', `${f.pinned}\nPRIVATE_PIN_SENTINEL\n`, `${f.pinned}\n\n`,
    '/PRIVATE_PIN_SENTINEL-' + 'x'.repeat(5000), '/PRIVATE_PIN_SENTINEL;touch "$PIN_EXEC_MARKER"',
    '/PRIVATE_PIN_SENTINEL-$(touch "$PIN_EXEC_MARKER")', Buffer.from(`${f.pinned}\0PRIVATE_PIN_SENTINEL`), `${f.pinned}\t`];
  for (const contents of cases) {
    fs.writeFileSync(f.pin, contents); reject(f.run()); reject(f.run(['--dry-run']));
  }
});
test('missing, nonexecutable and interop pinned targets refuse without fallback', { skip: linux }, t => {
  const f = fixture(t);
  const invalid = [path.join(f.temporary, 'PRIVATE_PIN_SENTINEL'), f.executable('PRIVATE_PIN_SENTINEL-not-executable', 0o600),
    f.executable('PRIVATE_PIN_SENTINEL.exe')];
  for (const file of invalid) { fs.writeFileSync(f.pin, file); reject(f.run()); }
});
test('pin file symlinks, ancestor symlinks, directories and FIFOs refuse without blocking', { skip: linux }, t => {
  const f = fixture(t), other = path.join(f.temporary, 'other'); fs.mkdirSync(other);
  const target = path.join(other, 'codex-command'); fs.writeFileSync(target, f.pinned);
  fs.symlinkSync(target, f.pin); reject(f.run()); fs.unlinkSync(f.pin);
  fs.rmdirSync(path.dirname(f.pin)); fs.symlinkSync(other, path.dirname(f.pin), 'dir'); reject(f.run()); fs.unlinkSync(path.dirname(f.pin));
  fs.mkdirSync(path.dirname(f.pin)); fs.mkdirSync(f.pin); reject(f.run()); fs.rmdirSync(f.pin);
  const fifo = spawnSync('/usr/bin/mkfifo', [f.pin], { encoding: 'utf8', timeout: 5000 });
  assert.equal(fifo.status, 0, fifo.stderr); reject(f.run());
});
test('help and offline exit-priority self-test bypass invalid pin without inspecting executables', { skip: linux }, t => {
  const f = fixture(t); fs.writeFileSync(f.pin, 'PRIVATE_PIN_SENTINEL\ninvalid\n');
  for (const args of [['--help'], ['--self-test-exit-priority']]) {
    const result = f.run(args); assert.equal(result.status, 0, result.stderr); assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_PIN_SENTINEL/);
  }
  reject(f.run(['--self-test']));
});

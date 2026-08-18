#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OVERLAY_PATH = path.join(ROOT, 'super-gsd', 'config', 'claude-ups-overlay.json');
const SETTINGS_PATH = path.join(ROOT, '.claude', 'settings.json');
const CLASSIFIER_PATH = path.join(ROOT, 'super-gsd', 'hooks', 'sgsd-intent-classifier.cjs');
const MANAGED_HOOK_ID = 'user-prompt-intent-classifier';

function readHooksByKey(filePath) {
  const document = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return document.hooks;
}

function normalizedPath(value) {
  const resolved = path.resolve(String(value || ''));
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function commandScriptPath(hook) {
  assert.ok(hook && hook.type === 'command', 'every installed hook must be command-typed');
  assert.strictEqual(hook.command, 'node', 'hook command must use node with an explicit script arg');
  assert.ok(Array.isArray(hook.args) && hook.args.length > 0, 'node hook must name its script in args[0]');
  assert.ok(path.isAbsolute(hook.args[0]), 'repo-local hook script arg must be absolute after merge');
  return path.resolve(hook.args[0]);
}

function validateRegistration(options) {
  const opts = options || {};
  assert.ok(fs.existsSync(OVERLAY_PATH), 'dedicated UserPromptSubmit overlay is missing');
  const overlayHooks = readHooksByKey(OVERLAY_PATH);
  assert.deepStrictEqual(
    Object.keys(overlayHooks || {}),
    ['UserPromptSubmit'],
    'overlay must declare exactly one event: UserPromptSubmit',
  );

  const overlayEntries = overlayHooks.UserPromptSubmit;
  assert.ok(Array.isArray(overlayEntries), 'overlay UserPromptSubmit value must be an array');
  assert.strictEqual(overlayEntries.length, 1, 'overlay must contain exactly one UserPromptSubmit entry');
  assert.strictEqual(overlayEntries[0].sgsd_managed, true, 'overlay hook must be SGSD-managed');
  assert.strictEqual(overlayEntries[0].sgsd_hook_id, MANAGED_HOOK_ID, 'overlay managed id is wrong');
  const overlayCommands = overlayEntries[0].hooks;
  assert.ok(Array.isArray(overlayCommands) && overlayCommands.length === 1,
    'overlay must map UserPromptSubmit to exactly one command');
  assert.strictEqual(overlayCommands[0].command, 'node', 'overlay command must be node');
  assert.deepStrictEqual(
    overlayCommands[0].args,
    ['super-gsd/hooks/sgsd-intent-classifier.cjs'],
    'overlay must map only to sgsd-intent-classifier.cjs',
  );

  assert.ok(fs.existsSync(SETTINGS_PATH), 'repo-local .claude/settings.json is missing');
  const hooks = readHooksByKey(SETTINGS_PATH);
  assert.ok(hooks && typeof hooks === 'object' && !Array.isArray(hooks),
    'repo-local settings hooks section must be an object');
  for (const unrelatedEvent of ['SessionStart', 'PostToolUse']) {
    assert.ok(!Object.prototype.hasOwnProperty.call(hooks, unrelatedEvent),
      `dedicated overlay must not introduce hooks.${unrelatedEvent}`);
  }

  const installedEntries = Array.isArray(hooks.UserPromptSubmit)
    ? hooks.UserPromptSubmit.filter((entry) => entry
      && entry.sgsd_managed === true
      && entry.sgsd_hook_id === MANAGED_HOOK_ID)
    : [];
  assert.strictEqual(installedEntries.length, 1,
    'exactly one managed UserPromptSubmit classifier entry must be installed');

  let commandCount = 0;
  for (const [event, entries] of Object.entries(hooks)) {
    assert.ok(Array.isArray(entries), `hooks.${event} must be an array`);
    for (const entry of entries) {
      assert.ok(Array.isArray(entry.hooks), `hooks.${event} entry must contain hooks[]`);
      for (const hook of entry.hooks) {
        commandCount += 1;
        const scriptPath = commandScriptPath(hook);
        assert.ok(fs.existsSync(scriptPath), `hook command target does not exist: ${scriptPath}`);
      }
    }
  }
  assert.ok(commandCount > 0, 'hooks section must contain at least one command');

  const installedScript = commandScriptPath(installedEntries[0].hooks[0]);
  assert.strictEqual(normalizedPath(installedScript), normalizedPath(CLASSIFIER_PATH),
    'installed UserPromptSubmit command must resolve exactly to sgsd-intent-classifier.cjs');

  const hash = crypto.createHash('sha256').update(JSON.stringify(hooks)).digest('hex');
  if (!opts.silent) {
    console.log(`hook registration PASS events_added=1 commands=${commandCount} hooks_sha256=${hash}`);
  }
  return { hash, hooks, classifierPath: installedScript };
}

if (require.main === module) {
  try {
    validateRegistration();
  } catch (error) {
    console.error(`hook registration FAIL: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  CLASSIFIER_PATH,
  ROOT,
  SETTINGS_PATH,
  validateRegistration,
};

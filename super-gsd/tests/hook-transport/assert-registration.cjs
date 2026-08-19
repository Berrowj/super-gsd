#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const OVERLAY_PATH = path.join(ROOT, 'super-gsd', 'config', 'repo-settings-overlay.json');
const SETTINGS_PATH = path.join(ROOT, '.claude', 'settings.json');
const CLASSIFIER_PATH = path.join(ROOT, 'super-gsd', 'hooks', 'sgsd-intent-classifier.cjs');
const GUARD_PATH = path.join(ROOT, 'super-gsd', 'tools', 'codex-hooks', 'block-secret-leak.cjs');
const INTENT_CLASSIFIER_HOOK_ID = 'user-prompt-intent-classifier';
const SECRET_LEAK_GUARD_HOOK_ID = 'user-prompt-secret-leak-guard';
const ALLOWED_USER_PROMPT_SUBMIT_HOOK_IDS = Object.freeze([
  INTENT_CLASSIFIER_HOOK_ID,
  SECRET_LEAK_GUARD_HOOK_ID,
]);

const PRESERVED_OVERLAY_EVENTS = Object.freeze({
  SessionStart: [
    {
      sgsd_managed: true,
      sgsd_hook_id: 'session-start-governance',
      hooks: [
        {
          type: 'command',
          command: 'node',
          args: ['super-gsd/hooks/sgsd-session-start.js'],
          timeout: 5,
        },
      ],
    },
  ],
  PostToolUse: [
    {
      sgsd_managed: true,
      sgsd_hook_id: 'post-tool-use-quality-gate',
      matcher: 'Edit|Write|NotebookEdit',
      hooks: [
        {
          type: 'command',
          command: 'node',
          args: ['super-gsd/hooks/sgsd-quality-gate.js'],
          timeout: 10,
        },
      ],
    },
  ],
});

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

function overlayCommandScriptPath(hook) {
  assert.ok(hook && hook.type === 'command', 'every overlay hook must be command-typed');
  assert.strictEqual(hook.command, 'node', 'overlay hook command must use node');
  assert.ok(Array.isArray(hook.args) && hook.args.length > 0,
    'overlay node hook must name its script in args[0]');
  return path.resolve(ROOT, hook.args[0]);
}

function expectedInstalledEntry(overlayEntry) {
  const expected = JSON.parse(JSON.stringify(overlayEntry));
  for (const hook of expected.hooks) {
    hook.args[0] = path.resolve(ROOT, hook.args[0]);
  }
  return expected;
}

function assertKnownManagedEntries(entries, source) {
  for (const entry of entries) {
    assert.ok(entry && ALLOWED_USER_PROMPT_SUBMIT_HOOK_IDS.includes(entry.sgsd_hook_id),
      `${source} UserPromptSubmit entry must use a known managed sgsd_hook_id`);
  }
}

function validateRegistration(options) {
  const opts = options || {};
  assert.ok(fs.existsSync(OVERLAY_PATH), 'unified repo-local hooks overlay is missing');
  const overlayHooks = readHooksByKey(OVERLAY_PATH);
  assert.deepStrictEqual(
    Object.keys(overlayHooks || {}),
    ['SessionStart', 'UserPromptSubmit', 'PostToolUse'],
    'unified overlay event registration changed',
  );
  assert.deepStrictEqual(overlayHooks.SessionStart, PRESERVED_OVERLAY_EVENTS.SessionStart,
    'SessionStart overlay entry changed during hook unification');
  assert.deepStrictEqual(overlayHooks.PostToolUse, PRESERVED_OVERLAY_EVENTS.PostToolUse,
    'PostToolUse overlay entry changed during hook unification');

  const overlayEntries = overlayHooks.UserPromptSubmit;
  assert.ok(Array.isArray(overlayEntries), 'overlay UserPromptSubmit value must be an array');
  assert.strictEqual(overlayEntries.length, 2,
    'overlay must contain exactly one classifier and one secret-leak guard');
  assertKnownManagedEntries(overlayEntries, 'overlay');
  for (const entry of overlayEntries) {
    assert.strictEqual(entry.sgsd_managed, true, 'overlay hook must be SGSD-managed');
    assert.ok(Array.isArray(entry.hooks) && entry.hooks.length === 1,
      'each overlay UserPromptSubmit entry must map to exactly one command');
  }
  const overlayClassifierEntries = overlayEntries
    .filter((entry) => entry.sgsd_hook_id === INTENT_CLASSIFIER_HOOK_ID);
  assert.strictEqual(overlayClassifierEntries.length, 1,
    'overlay must contain exactly one UserPromptSubmit classifier entry');
  const overlayGuardEntries = overlayEntries
    .filter((entry) => entry.sgsd_hook_id === SECRET_LEAK_GUARD_HOOK_ID);
  assert.strictEqual(overlayGuardEntries.length, 1,
    'overlay must contain exactly one UserPromptSubmit secret-leak guard entry');
  const overlayClassifierCommands = overlayClassifierEntries[0].hooks;
  const overlayGuardCommands = overlayGuardEntries[0].hooks;
  assert.strictEqual(overlayClassifierCommands[0].command, 'node', 'overlay command must be node');
  assert.deepStrictEqual(
    overlayClassifierCommands[0].args,
    ['super-gsd/hooks/sgsd-intent-classifier.cjs'],
    'classifier entry must map only to sgsd-intent-classifier.cjs',
  );
  assert.deepStrictEqual(
    overlayGuardCommands[0].args,
    ['super-gsd/tools/codex-hooks/block-secret-leak.cjs'],
    'guard entry must map only to block-secret-leak.cjs',
  );
  for (const entries of Object.values(overlayHooks)) {
    for (const entry of entries) {
      for (const hook of entry.hooks) {
        const scriptPath = overlayCommandScriptPath(hook);
        assert.ok(fs.existsSync(scriptPath), `overlay hook target does not exist: ${scriptPath}`);
      }
    }
  }

  assert.ok(fs.existsSync(SETTINGS_PATH), 'repo-local .claude/settings.json is missing');
  const hooks = readHooksByKey(SETTINGS_PATH);
  assert.ok(hooks && typeof hooks === 'object' && !Array.isArray(hooks),
    'repo-local settings hooks section must be an object');

  const installedUserPromptSubmitEntries = Array.isArray(hooks.UserPromptSubmit)
    ? hooks.UserPromptSubmit
    : [];
  assertKnownManagedEntries(installedUserPromptSubmitEntries, 'installed');
  const installedEntries = installedUserPromptSubmitEntries
    .filter((entry) => entry.sgsd_hook_id === INTENT_CLASSIFIER_HOOK_ID);
  assert.strictEqual(installedEntries.length, 1,
    'exactly one UserPromptSubmit classifier entry must be installed');
  const installedGuardEntries = installedUserPromptSubmitEntries
    .filter((entry) => entry.sgsd_hook_id === SECRET_LEAK_GUARD_HOOK_ID);
  assert.strictEqual(installedGuardEntries.length, 1,
    'exactly one UserPromptSubmit secret-leak guard entry must be installed');

  for (const [event, overlayEventEntries] of Object.entries(overlayHooks)) {
    const installedEventEntries = Array.isArray(hooks[event]) ? hooks[event] : [];
    for (const overlayEntry of overlayEventEntries) {
      const matches = installedEventEntries
        .filter((entry) => entry.sgsd_hook_id === overlayEntry.sgsd_hook_id);
      assert.strictEqual(matches.length, 1,
        `exactly one ${overlayEntry.sgsd_hook_id} entry must be installed on ${event}`);
      assert.deepStrictEqual(matches[0], expectedInstalledEntry(overlayEntry),
        `installed ${overlayEntry.sgsd_hook_id} entry differs from the unified overlay`);
    }
  }

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
  const installedGuardScript = commandScriptPath(installedGuardEntries[0].hooks[0]);
  assert.strictEqual(normalizedPath(installedGuardScript), normalizedPath(GUARD_PATH),
    'installed UserPromptSubmit guard must resolve exactly to block-secret-leak.cjs');

  const hash = crypto.createHash('sha256').update(JSON.stringify(hooks)).digest('hex');
  const eventCount = Object.keys(overlayHooks).length;
  if (!opts.silent) {
    console.log(`hook registration PASS events_added=${eventCount} commands=${commandCount} hooks_sha256=${hash}`);
  }
  return { hash, hooks, classifierPath: installedScript, guardPath: installedGuardScript };
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
  GUARD_PATH,
  ROOT,
  SETTINGS_PATH,
  validateRegistration,
};

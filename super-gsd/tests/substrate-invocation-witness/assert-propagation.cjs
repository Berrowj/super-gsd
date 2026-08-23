#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const AUDIT_PATH = path.join(REPO_ROOT, 'super-gsd', 'tools', 'feature-propagation', 'audit.cjs');
const STORE_PATH = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'lib', 'substrate-invocation-witness-store.cjs');
const TOOL = ['mcp__vtp-kb__vtp', 'search', 'substrate'].join('_');
const SECRET_SENTINEL = ['P167', 'PRIVATE', 'UPSTREAM', 'VALUE'].join('_');
const AGENTS = ['sgsd-vtp-enrichment.md', 'sgsd-board-researcher.md', 'gsd-phase-researcher.md', 'gsd-planner.md'];

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function copy(relativePath, projectRoot) {
  const source = path.join(REPO_ROOT, relativePath);
  const target = path.join(projectRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function evidenceSnapshot(paths) {
  return Object.fromEntries(paths.map((filePath) => [
    filePath,
    fs.existsSync(filePath)
      ? crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
      : null,
  ]));
}

function withIsolatedProfile(run) {
  const saved = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    APPDATA: process.env.APPDATA,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
  };
  const realHome = saved.USERPROFILE || saved.HOME || '';
  const protectedPaths = [
    ...(realHome ? [path.join(realHome, '.claude.json'), path.join(realHome, '.claude', 'settings.json')] : []),
    path.join(REPO_ROOT, '.mcp.json'),
    path.join(REPO_ROOT, '.claude', 'settings.json'),
    path.join(REPO_ROOT, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs'),
    path.join(REPO_ROOT, 'super-gsd', 'tools', 'substrate-capability-broker.cjs'),
  ];
  const protectedBefore = evidenceSnapshot(protectedPaths);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p167-propagation-'));
  const home = path.join(root, 'profile');
  const project = path.join(root, 'project');
  fs.mkdirSync(path.join(project, '.planning'), { recursive: true });
  fs.mkdirSync(home, { recursive: true });
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.APPDATA = path.join(home, 'AppData', 'Roaming');
  process.env.XDG_CONFIG_HOME = path.join(home, '.config');
  try {
    return run({ root, home, project });
  } finally {
    assert.deepEqual(evidenceSnapshot(protectedPaths), protectedBefore, 'isolated propagation escaped into real profile or source evidence');
    for (const name of Object.keys(saved)) {
      if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name];
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function seedProject(project) {
  for (const relativePath of [
    'super-gsd/hooks/sgsd-substrate-invocation-witness.cjs',
    'super-gsd/tools/substrate-capability-broker.cjs',
    'super-gsd/scripts/lib/substrate-invocation-witness-store.cjs',
    'super-gsd/scripts/lib/vtp-context-composer.cjs',
  ]) copy(relativePath, project);
  writeJson(path.join(project, '.claude', 'settings.json'), {
    unrelated: { preserved: true }, hooks: { PreToolUse: [], PostToolUse: [] },
  });
  writeJson(path.join(project, '.mcp.json'), {
    unrelated: { preserved: true },
    mcpServers: {
      unrelated: { command: 'unrelated-command', args: ['--preserve'] },
      'vtp-kb': { command: 'node', args: ['private-upstream.cjs'], env: { P167_VALUE: SECRET_SENTINEL } },
    },
  });
}

function seedLegacyAgents(home) {
  const agentsDir = path.join(home, '.claude', 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(path.join(agentsDir, 'gsd-phase-researcher.md'), '---\ntools: Read, Bash\n---\noperator researcher text\n<sgsd_vtp_substrate_policy_p166_phase_research>old P166 researcher</sgsd_vtp_substrate_policy_p166_phase_research>\n', 'utf8');
  fs.writeFileSync(path.join(agentsDir, 'gsd-planner.md'), '---\ntools: Read, Bash\n---\noperator planner text\n<sgsd_vtp_substrate_policy_p166_planning>old P166 planner</sgsd_vtp_substrate_policy_p166_planning>\n', 'utf8');
}

function snapshot(paths) {
  return Object.fromEntries(paths.map((filePath) => [filePath, fs.existsSync(filePath) ? read(filePath) : null]));
}

function main() {
  const audit = require(AUDIT_PATH);
  const store = require(STORE_PATH);
  assert.equal(typeof audit._internals.auditClaudeSubstrateWitness, 'function', 'red: witness absence audit is not implemented');
  assert.equal(typeof audit._internals.auditClaudeSubstrateCapability, 'function', 'red: broker-only capability audit is not implemented');

  withIsolatedProfile(({ home, project }) => {
    seedProject(project);
    seedLegacyAgents(home);
    writeJson(path.join(project, '.claude', 'settings.local.json'), {
      unrelatedLocal: true,
      mcpServers: { 'vtp-kb': { command: 'node', args: ['local-upstream.cjs'] } },
    });
    writeJson(path.join(home, '.claude.json'), {
      unrelatedUser: true,
      mcpServers: { 'vtp-kb': { command: 'node', args: ['user-upstream.cjs'] } },
      projects: {
        [project]: {
          unrelatedProjectState: true,
          mcpServers: { 'vtp-kb': { command: 'node', args: ['local-profile-upstream.cjs'] } },
        },
      },
    });
    const overlay = JSON.parse(read(path.join(REPO_ROOT, 'super-gsd', 'config', 'repo-settings-overlay.json')));
    writeJson(path.join(home, '.claude', 'settings.json'), {
      unrelatedGlobal: { preserved: true },
      hooks: { PreToolUse: [overlay.hooks.PreToolUse[0]] },
    });
    const settingsPath = path.join(project, '.claude', 'settings.json');
    const mcpPath = path.join(project, '.mcp.json');
    const absent = audit.runAudit({ projectDir: project });
    assert.equal(absent.ok, false, 'fresh profile without witness enforcement audited ok');
    assert(absent.issues.includes('project_claude_substrate_witness_missing_or_stale'));

    const repaired = audit.runAudit({ projectDir: project, repairSafe: true });
    assert.equal(repaired.claude_substrate_witness.status, 'current');
    assert.equal(repaired.claude_substrate_witness.trust_level, 'local_hmac');
    assert.equal(repaired.claude_substrate_witness.enforcement_scope, 'supported_sgsd_brokered_mcp_grant');
    assert.equal(repaired.claude_substrate_witness.residual, 'same_user_can_restore_direct_mcp_or_replace_broker');
    assert.equal(repaired.claude_substrate_capability.status, 'current');
    assert.doesNotMatch(JSON.stringify(repaired), new RegExp(SECRET_SENTINEL));
    const globalSettings = JSON.parse(read(path.join(home, '.claude', 'settings.json')));
    assert.equal(globalSettings.unrelatedGlobal.preserved, true);
    assert.equal(JSON.stringify(globalSettings).includes(store.PRE_HOOK_ID), false);

    const settings = JSON.parse(read(settingsPath));
    assert.equal(settings.unrelated.preserved, true);
    for (const [event, id] of [['PreToolUse', store.PRE_HOOK_ID], ['PostToolUse', store.POST_HOOK_ID]]) {
      const registrations = settings.hooks[event].filter((entry) => entry.sgsd_hook_id === id);
      assert.equal(registrations.length, 1, event + ' witness hook was not registered exactly once');
      assert.equal(registrations[0].matcher, TOOL);
    }

    const mcp = JSON.parse(read(mcpPath));
    assert.equal(mcp.unrelated.preserved, true);
    assert.equal(mcp.mcpServers.unrelated.command, 'unrelated-command');
    assert.match(mcp.mcpServers['vtp-kb'].args[0], /substrate-capability-broker\.cjs$/);
    assert.doesNotMatch(read(mcpPath), new RegExp(SECRET_SENTINEL));
    assert.doesNotMatch(read(path.join(project, '.claude', 'settings.local.json')), new RegExp(SECRET_SENTINEL));
    assert.doesNotMatch(read(path.join(home, '.claude.json')), new RegExp(SECRET_SENTINEL));
    const localSettings = JSON.parse(read(path.join(project, '.claude', 'settings.local.json')));
    const profileSettings = JSON.parse(read(path.join(home, '.claude.json')));
    for (const definition of [
      localSettings.mcpServers['vtp-kb'],
      profileSettings.mcpServers['vtp-kb'],
      profileSettings.projects[project].mcpServers['vtp-kb'],
    ]) assert.match(definition.args[0], /substrate-capability-broker\.cjs$/);
    const manifestPath = store.resolveWitnessPaths(project, process.env).upstream_manifest_path;
    assert.match(read(manifestPath), new RegExp(SECRET_SENTINEL));

    for (const name of AGENTS) {
      const installed = read(path.join(home, '.claude', 'agents', name));
      assert.match(installed.split(/---/)[1], new RegExp(TOOL));
      assert.match(installed, /<sgsd_vtp_substrate_witness_p167>/);
      assert.doesNotMatch(installed, /\btool_use_id\b/);
      assert.doesNotMatch(installed, /truncate it in memory to its first 16000 JavaScript characters/);
    }

    const stablePaths = [
      settingsPath,
      mcpPath,
      path.join(project, '.claude', 'settings.local.json'),
      path.join(home, '.claude.json'),
      path.join(home, '.claude', 'settings.json'),
      manifestPath,
      ...AGENTS.map((name) => path.join(home, '.claude', 'agents', name)),
    ];
    const beforeSecondRepair = snapshot(stablePaths);
    audit.runAudit({ projectDir: project, repairSafe: true });
    assert.deepEqual(snapshot(stablePaths), beforeSecondRepair, 'second repair changed bytes');

    const withoutPre = JSON.parse(read(settingsPath));
    withoutPre.hooks.PreToolUse = withoutPre.hooks.PreToolUse.filter((entry) => entry.sgsd_hook_id !== store.PRE_HOOK_ID);
    writeJson(settingsPath, withoutPre);
    const missingPre = audit.runAudit({ projectDir: project });
    assert.equal(missingPre.ok, false);
    assert(missingPre.issues.includes('project_claude_substrate_witness_missing_or_stale'));
    assert(missingPre.claude_substrate_capability.reasons.includes('grant_with_witness_unready'));

    audit.runAudit({ projectDir: project, repairSafe: true });
    const withoutPost = JSON.parse(read(settingsPath));
    withoutPost.hooks.PostToolUse = withoutPost.hooks.PostToolUse.filter((entry) => entry.sgsd_hook_id !== store.POST_HOOK_ID);
    writeJson(settingsPath, withoutPost);
    const missingPost = audit.runAudit({ projectDir: project });
    assert.equal(missingPost.ok, false);
    assert(missingPost.claude_substrate_capability.reasons.includes('grant_with_witness_unready'));

    audit.runAudit({ projectDir: project, repairSafe: true });
    const stale = JSON.parse(read(settingsPath));
    stale.hooks.PostToolUse.find((entry) => entry.sgsd_hook_id === store.POST_HOOK_ID).hooks[0].command = 'node-stale';
    writeJson(settingsPath, stale);
    assert.notEqual(audit.runAudit({ projectDir: project }).claude_substrate_witness.status, 'current');

    audit.runAudit({ projectDir: project, repairSafe: true });
    const wrongContract = JSON.parse(read(settingsPath));
    const wrongPre = wrongContract.hooks.PreToolUse.find((entry) => entry.sgsd_hook_id === store.PRE_HOOK_ID);
    wrongPre.matcher = TOOL + '_wrong';
    wrongPre.hooks[0].timeout = 99;
    writeJson(settingsPath, wrongContract);
    assert.notEqual(audit.runAudit({ projectDir: project }).claude_substrate_witness.status, 'current');

    audit.runAudit({ projectDir: project, repairSafe: true });
    const duplicate = JSON.parse(read(settingsPath));
    duplicate.hooks.PostToolUse.push(JSON.parse(JSON.stringify(
      duplicate.hooks.PostToolUse.find((entry) => entry.sgsd_hook_id === store.POST_HOOK_ID),
    )));
    writeJson(settingsPath, duplicate);
    assert.notEqual(audit.runAudit({ projectDir: project }).claude_substrate_witness.status, 'current');

    audit.runAudit({ projectDir: project, repairSafe: true });
    const keyPath = store.resolveWitnessPaths(project, process.env).key_path;
    const validKey = fs.readFileSync(keyPath);
    fs.renameSync(keyPath, keyPath + '.missing');
    assert(audit.runAudit({ projectDir: project }).claude_substrate_witness.reasons.includes('key_missing'));
    fs.renameSync(keyPath + '.missing', keyPath);
    fs.writeFileSync(keyPath, 'malformed-key', 'utf8');
    assert(audit.runAudit({ projectDir: project }).claude_substrate_witness.reasons.includes('key_invalid'));

    fs.writeFileSync(keyPath, validKey);
    audit.runAudit({ projectDir: project, repairSafe: true });
    const sourcePath = path.join(project, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs');
    const deleted = JSON.parse(read(settingsPath));
    deleted.hooks.PreToolUse = deleted.hooks.PreToolUse.filter((entry) => entry.sgsd_hook_id !== store.PRE_HOOK_ID);
    deleted.hooks.PostToolUse = deleted.hooks.PostToolUse.filter((entry) => entry.sgsd_hook_id !== store.POST_HOOK_ID);
    writeJson(settingsPath, deleted);
    fs.renameSync(sourcePath, sourcePath + '.missing');
    const deletedGuard = audit.runAudit({ projectDir: project });
    assert.equal(deletedGuard.ok, false);
    assert(deletedGuard.claude_substrate_capability.reasons.includes('grant_with_witness_unready'));
    fs.renameSync(sourcePath + '.missing', sourcePath);

    audit.runAudit({ projectDir: project, repairSafe: true });
    fs.writeFileSync(sourcePath, read(sourcePath) + '\n// source drift\n', 'utf8');
    assert(audit.runAudit({ projectDir: project }).claude_substrate_witness.reasons.includes('source_drift'));
  });

  withIsolatedProfile(({ home, project }) => {
    seedProject(project);
    writeJson(path.join(project, '.mcp.json'), {
      mcpServers: { 'vtp-kb': { type: 'sse' } },
    });
    const report = audit.runAudit({ projectDir: project, repairSafe: true });
    assert(report.claude_substrate_capability.reasons.includes('unsupported_upstream_transport'));
    for (const name of AGENTS) {
      const agentPath = path.join(home, '.claude', 'agents', name);
      if (fs.existsSync(agentPath)) assert.doesNotMatch(read(agentPath).split(/---/)[1], new RegExp(TOOL));
    }
  });

  withIsolatedProfile(({ home, project }) => {
    seedProject(project);
    fs.writeFileSync(path.join(project, '.claude', 'settings.json'), '{ malformed', 'utf8');
    const report = audit.runAudit({ projectDir: project, repairSafe: true });
    assert(report.claude_substrate_capability.reasons.includes('witness_repair_failed'));
    for (const name of AGENTS) {
      const agentPath = path.join(home, '.claude', 'agents', name);
      if (fs.existsSync(agentPath)) assert.doesNotMatch(read(agentPath).split(/---/)[1], new RegExp(TOOL));
    }
  });

  withIsolatedProfile(({ home, project }) => {
    seedProject(project);
    const manifestPath = store.resolveWitnessPaths(project, process.env).upstream_manifest_path;
    fs.mkdirSync(manifestPath, { recursive: true });
    const report = audit.runAudit({ projectDir: project, repairSafe: true });
    assert(report.claude_substrate_capability.reasons.includes('broker_repair_failed'));
    for (const name of AGENTS) {
      const agentPath = path.join(home, '.claude', 'agents', name);
      if (fs.existsSync(agentPath)) assert.doesNotMatch(read(agentPath).split(/---/)[1], new RegExp(TOOL));
    }
  });

  process.stdout.write('PASS assert-propagation\n');
}

main();

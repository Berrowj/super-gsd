#!/usr/bin/env node
'use strict';

// ============================================================================
// SGSD commit gate installer
// ============================================================================
// T147-05: install/remove only the Git-resolved pre-commit hook path. This
// script never accepts a caller-supplied hook destination and never sets
// core.hooksPath. Existing unmarked hooks are refused, not replaced.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MARKER = 'SGSD-COMMIT-GATE-HOOK';
const EXIT_OK = 0;
const EXIT_USAGE = 2;
const EXIT_REFUSED = 3;
const EXIT_DEGRADED = 4;

function oneLine(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').slice(0, 500);
}

function stdout(line) {
  process.stdout.write(`${line}\n`);
}

function reason(code, detail) {
  const suffix = detail ? `: ${oneLine(detail)}` : '';
  process.stderr.write(`[SGSD] commit-gate installer ${code}${suffix}\n`);
}

function usage() {
  return [
    'Usage:',
    '  node super-gsd/scripts/install-commit-gate.cjs --install [--dry-run]',
    '  node super-gsd/scripts/install-commit-gate.cjs --uninstall [--dry-run]',
    '',
    'The hook path is always resolved by git rev-parse --git-path hooks/pre-commit in the target repo.'
  ].join('\n');
}

function parseArgs(argv) {
  const out = { action: null, dryRun: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else if (arg === '--install') {
      if (out.action && out.action !== 'install') throw new Error('multiple actions supplied');
      out.action = 'install';
    } else if (arg === '--uninstall') {
      if (out.action && out.action !== 'uninstall') throw new Error('multiple actions supplied');
      out.action = 'uninstall';
    } else if (arg === '--dry-run') {
      out.dryRun = true;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return out;
}

function git(args, cwd, reasonCode) {
  try {
    const result = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true
    });
    if (result.error) {
      return { ok: false, reason_code: 'git_spawn_failed', detail: result.error.code || result.error.message || 'spawn_failed' };
    }
    if (result.status !== 0) {
      return {
        ok: false,
        reason_code: reasonCode || 'git_command_failed',
        detail: result.stderr || result.stdout || `exit_${result.status}`
      };
    }
    return { ok: true, stdout: String(result.stdout || '').trim(), stderr: String(result.stderr || '') };
  } catch (error) {
    return { ok: false, reason_code: 'git_spawn_failed', detail: error && (error.code || error.message) || 'git_unexpected_error' };
  }
}

function resolveGitPath(repoRoot, rawPath) {
  const raw = String(rawPath || '').trim();
  if (!raw) return null;
  return path.resolve(path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw));
}

function comparePath(value) {
  const resolved = path.resolve(String(value || ''));
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isInsideOrEqual(root, target) {
  try {
    const rel = path.relative(comparePath(root), comparePath(target));
    return rel === '' || (rel && !rel.startsWith('..') && !path.isAbsolute(rel));
  } catch {
    return false;
  }
}

function worktreeCount(repoRoot) {
  const listed = git(['worktree', 'list', '--porcelain'], repoRoot, 'git_worktree_list_failed');
  if (!listed.ok) return { count: 1, reason_code: listed.reason_code, detail: listed.detail };
  const count = listed.stdout.split(/\r?\n/).filter((line) => line.startsWith('worktree ')).length;
  return { count: count || 1 };
}

function resolveContext(startCwd) {
  const topLevel = git(['rev-parse', '--show-toplevel'], startCwd, 'git_toplevel_failed');
  if (!topLevel.ok) return topLevel;
  const repoRoot = path.resolve(topLevel.stdout);

  const hookPathResult = git(['rev-parse', '--git-path', 'hooks/pre-commit'], repoRoot, 'git_hook_path_failed');
  if (!hookPathResult.ok) return hookPathResult;

  const gitDirResult = git(['rev-parse', '--git-dir'], repoRoot, 'git_dir_failed');
  if (!gitDirResult.ok) return gitDirResult;

  const commonDirResult = git(['rev-parse', '--git-common-dir'], repoRoot, 'git_common_dir_failed');
  if (!commonDirResult.ok) return commonDirResult;

  const coreHooks = git(['config', '--get', 'core.hooksPath'], repoRoot, 'git_core_hooks_path_read_failed');
  const hookPath = resolveGitPath(repoRoot, hookPathResult.stdout);
  const gitDir = resolveGitPath(repoRoot, gitDirResult.stdout);
  const commonGitDir = resolveGitPath(repoRoot, commonDirResult.stdout);
  if (!hookPath || !gitDir || !commonGitDir) {
    return { ok: false, reason_code: 'git_path_resolution_failed', detail: JSON.stringify({ hook: hookPathResult.stdout, gitDir: gitDirResult.stdout, commonGitDir: commonDirResult.stdout }) };
  }

  const hookScriptPath = path.resolve(repoRoot, 'super-gsd', 'hooks', 'sgsd-commit-gate.cjs');
  const shared = (() => {
    const countInfo = worktreeCount(repoRoot);
    const commonHooksDir = path.join(commonGitDir, 'hooks');
    return {
      isShared: countInfo.count > 1 && isInsideOrEqual(commonHooksDir, hookPath),
      worktreeCount: countInfo.count,
      commonHooksDir,
      reason_code: countInfo.reason_code,
      detail: countInfo.detail
    };
  })();

  return {
    ok: true,
    repoRoot,
    hookPath,
    hookScriptPath,
    gitDir,
    commonGitDir,
    coreHooksPath: coreHooks.ok ? coreHooks.stdout : null,
    shared
  };
}

function toShellPath(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/');
}

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function trampolineContent(repoRoot, hookScriptPath) {
  const repo = shQuote(toShellPath(repoRoot));
  const script = shQuote(toShellPath(hookScriptPath));
  return [
    '#!/bin/sh',
    `# ${MARKER}: managed by super-gsd/scripts/install-commit-gate.cjs`,
    '# POSIX trampoline for Git for Windows and POSIX Git clients.',
    `SGSD_REPO_ROOT=${repo}`,
    `SGSD_HOOK_SCRIPT=${script}`,
    '',
    'sgsd_bootstrap_stderr() {',
    '  printf "%s\\n" "$1" >&2',
    '}',
    '',
    'sgsd_append_bootstrap_row() {',
    '  reason_code="$1"',
    '  detail="$2"',
    '  if [ -z "${NODE_BIN:-}" ]; then',
    '    return 0',
    '  fi',
    '  "$NODE_BIN" - "$SGSD_REPO_ROOT" "$reason_code" "$detail" <<\'NODE\'',
    'const path = require(\'path\');',
    'const { spawnSync } = require(\'child_process\');',
    'const [root, reasonCode, detail] = process.argv.slice(2);',
    'function oneLine(value) { return String(value || \'\').replace(/[\\r\\n]+/g, \' \').slice(0, 300); }',
    'try {',
    '  const { appendShadowRow } = require(path.join(root, \'super-gsd\', \'scripts\', \'lib\', \'commit-gate-shadow-log.cjs\'));',
    '  let stagedPaths = [];',
    '  try {',
    '    const staged = spawnSync(\'git\', [\'diff\', \'--cached\', \'--name-only\', \'--\'], { cwd: root, encoding: \'utf8\', windowsHide: true });',
    '    if (!staged.error && staged.status === 0) {',
    '      stagedPaths = String(staged.stdout || \'\').split(/\\r?\\n/).map((item) => item.trim()).filter(Boolean).map((item) => item.replace(/\\\\/g, \'/\'));',
    '    }',
    '  } catch {}',
    '  const pathEvidence = stagedPaths.length > 0 ? stagedPaths.map((item) => ({',
    '    path: item,',
    '    source_touching: false,',
    '    evidence_status: \'degraded\',',
    '    matched_artifacts: [],',
    '    reason_code: reasonCode',
    '  })) : [{',
    '    path: null,',
    '    source_touching: false,',
    '    evidence_status: \'degraded\',',
    '    matched_artifacts: [],',
    '    reason_code: reasonCode',
    '  }];',
    '  appendShadowRow(root, {',
    '    signal: \'commit_gate_shadow\',',
    '    status: \'warn\',',
    '    repo_id: path.basename(root) || \'repo\',',
    '    commit_candidate: \'bootstrap\',',
    '    artifact_predicate_version: \'t147-05-bootstrap\',',
    '    artifact_convention_status: \'bootstrap_degraded\',',
    '    staged_paths: stagedPaths,',
    '    path_evidence: pathEvidence,',
    '    would_warn: true,',
    '    would_block: false,',
    '    false_block_basis: [reasonCode],',
    '    waived_paths: [],',
    '    reason_codes: [reasonCode],',
    '    next_action: JSON.stringify({ reason_code: reasonCode, detail: String(detail || \'\') })',
    '  });',
    '} catch (error) {',
    '  process.stderr.write(`[SGSD] commit gate bootstrap degraded bootstrap_shadow_append_failed: ${reasonCode}: ${oneLine(error && (error.code || error.message))}\\n`);',
    '}',
    'NODE',
    '  row_status="$?"',
    '  if [ "$row_status" -ne 0 ]; then',
    '    sgsd_bootstrap_stderr "[SGSD] commit gate bootstrap degraded bootstrap_shadow_append_failed: reason_code=${reason_code}; appendShadowRow unavailable; allowing commit"',
    '  fi',
    '}',
    '',
    'sgsd_fail_open() {',
    '  reason_code="$1"',
    '  detail="$2"',
    '  sgsd_bootstrap_stderr "[SGSD] commit gate bootstrap degraded ${reason_code}: ${detail}; allowing commit"',
    '  sgsd_append_bootstrap_row "$reason_code" "$detail"',
    '  exit 0',
    '}',
    '',
    'NODE_BIN="$(command -v node 2>/dev/null || true)"',
    'if [ -z "$NODE_BIN" ]; then',
    '  sgsd_bootstrap_stderr "[SGSD] commit gate bootstrap degraded bootstrap_node_missing: node not found on PATH; allowing commit"',
    '  exit 0',
    'fi',
    '',
    'if [ ! -f "$SGSD_HOOK_SCRIPT" ]; then',
    '  sgsd_fail_open "bootstrap_hook_script_missing" "$SGSD_HOOK_SCRIPT"',
    'fi',
    '',
    'if ! cd "$SGSD_REPO_ROOT"; then',
    '  sgsd_fail_open "bootstrap_repo_cd_failed" "$SGSD_REPO_ROOT"',
    'fi',
    '',
    '"$NODE_BIN" "$SGSD_HOOK_SCRIPT"',
    'hook_status="$?"',
    'if [ "$hook_status" -eq 0 ]; then',
    '  exit 0',
    'fi',
    'if [ "$hook_status" -eq 10 ]; then',
    '  exit 1',
    'fi',
    'sgsd_fail_open "bootstrap_hook_exit_nonzero" "exit_${hook_status}"',
    ''
  ].join('\n');
}

function isMarked(content) {
  return String(content || '').includes(MARKER);
}

function readHook(filePath) {
  try {
    return { ok: true, content: fs.readFileSync(filePath, 'utf8') };
  } catch (error) {
    return { ok: false, reason_code: 'hook_read_failed', detail: error && (error.code || error.message) || 'read_failed' };
  }
}

function chmodExecutable(filePath) {
  try {
    fs.chmodSync(filePath, 0o755);
  } catch (error) {
    reason('hook_chmod_degraded', `${filePath}; ${error && (error.code || error.message) || 'chmod_failed'}`);
  }
}

function writeHook(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, { encoding: 'utf8', mode: 0o755 });
    chmodExecutable(filePath);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason_code: 'hook_write_failed', detail: error && (error.code || error.message) || 'write_failed' };
  }
}

function removeHook(filePath) {
  try {
    fs.unlinkSync(filePath);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason_code: 'hook_remove_failed', detail: error && (error.code || error.message) || 'remove_failed' };
  }
}

function printSharedWarning(ctx) {
  if (ctx.shared && ctx.shared.reason_code) {
    reason(ctx.shared.reason_code, ctx.shared.detail || 'unable to count linked worktrees; continuing with git-resolved hook path');
  }
  if (ctx.shared && ctx.shared.isShared) {
    reason(
      'linked_worktree_shared_hook_path',
      `git resolved ${ctx.hookPath}; this is under shared hooks dir ${ctx.shared.commonHooksDir} for ${ctx.shared.worktreeCount} linked worktrees and applies to every worktree of this repo`
    );
  }
}

function validateInstallInputs(ctx) {
  if (!fs.existsSync(ctx.hookScriptPath)) {
    return { ok: false, reason_code: 'hook_script_missing', detail: ctx.hookScriptPath };
  }
  const parent = path.dirname(ctx.hookPath);
  let stat;
  try {
    stat = fs.statSync(parent);
  } catch (error) {
    return { ok: false, reason_code: 'hook_parent_missing', detail: `${parent}; ${error && (error.code || error.message) || 'stat_failed'}` };
  }
  if (!stat.isDirectory()) return { ok: false, reason_code: 'hook_parent_not_directory', detail: parent };
  return { ok: true };
}

function install(ctx, dryRun) {
  const validation = validateInstallInputs(ctx);
  if (!validation.ok) {
    reason(validation.reason_code, validation.detail);
    return EXIT_REFUSED;
  }

  const desired = trampolineContent(ctx.repoRoot, ctx.hookScriptPath);
  const exists = fs.existsSync(ctx.hookPath);
  if (exists) {
    let stat;
    try {
      stat = fs.statSync(ctx.hookPath);
    } catch (error) {
      reason('hook_stat_failed', `${ctx.hookPath}; ${error && (error.code || error.message) || 'stat_failed'}`);
      return EXIT_REFUSED;
    }
    if (!stat.isFile()) {
      reason('hook_path_not_file', ctx.hookPath);
      return EXIT_REFUSED;
    }
    const existing = readHook(ctx.hookPath);
    if (!existing.ok) {
      reason(existing.reason_code, `${ctx.hookPath}; ${existing.detail}`);
      return EXIT_REFUSED;
    }
    if (!isMarked(existing.content)) {
      reason('existing_hook_unmarked', `refusing to replace unmarked pre-commit hook at ${ctx.hookPath}`);
      return EXIT_REFUSED;
    }
    if (existing.content === desired) {
      reason('hook_already_current', `SGSD hook already current at ${ctx.hookPath}; no write`);
      stdout(`[SGSD] commit-gate installer no-op: hook already current at ${ctx.hookPath}`);
      return EXIT_OK;
    }
    if (dryRun) {
      stdout(`[SGSD] commit-gate installer DRY RUN: would refresh SGSD-marked hook at ${ctx.hookPath}`);
      stdout(`[SGSD] commit-gate installer DRY RUN: trampoline target ${ctx.hookScriptPath}`);
      return EXIT_OK;
    }
    const written = writeHook(ctx.hookPath, desired);
    if (!written.ok) {
      reason(written.reason_code, `${ctx.hookPath}; ${written.detail}`);
      return EXIT_DEGRADED;
    }
    stdout(`[SGSD] commit-gate installer refreshed hook at ${ctx.hookPath}`);
    stdout(`[SGSD] commit-gate installer trampoline target ${ctx.hookScriptPath}`);
    return EXIT_OK;
  }

  if (dryRun) {
    stdout(`[SGSD] commit-gate installer DRY RUN: would install hook at ${ctx.hookPath}`);
    stdout(`[SGSD] commit-gate installer DRY RUN: trampoline target ${ctx.hookScriptPath}`);
    return EXIT_OK;
  }

  const written = writeHook(ctx.hookPath, desired);
  if (!written.ok) {
    reason(written.reason_code, `${ctx.hookPath}; ${written.detail}`);
    return EXIT_DEGRADED;
  }
  stdout(`[SGSD] commit-gate installer installed hook at ${ctx.hookPath}`);
  stdout(`[SGSD] commit-gate installer trampoline target ${ctx.hookScriptPath}`);
  return EXIT_OK;
}

function uninstall(ctx, dryRun) {
  if (!fs.existsSync(ctx.hookPath)) {
    reason('hook_absent', `no pre-commit hook at ${ctx.hookPath}; nothing removed`);
    stdout(`[SGSD] commit-gate installer no-op: no hook at ${ctx.hookPath}`);
    return EXIT_OK;
  }

  let stat;
  try {
    stat = fs.statSync(ctx.hookPath);
  } catch (error) {
    reason('hook_stat_failed', `${ctx.hookPath}; ${error && (error.code || error.message) || 'stat_failed'}`);
    return EXIT_REFUSED;
  }
  if (!stat.isFile()) {
    reason('hook_path_not_file', ctx.hookPath);
    return EXIT_REFUSED;
  }

  const existing = readHook(ctx.hookPath);
  if (!existing.ok) {
    reason(existing.reason_code, `${ctx.hookPath}; ${existing.detail}`);
    return EXIT_REFUSED;
  }
  if (!isMarked(existing.content)) {
    reason('existing_hook_unmarked', `refusing to remove unmarked pre-commit hook at ${ctx.hookPath}`);
    return EXIT_REFUSED;
  }

  if (dryRun) {
    stdout(`[SGSD] commit-gate installer DRY RUN: would remove SGSD-marked hook at ${ctx.hookPath}`);
    return EXIT_OK;
  }

  const removed = removeHook(ctx.hookPath);
  if (!removed.ok) {
    reason(removed.reason_code, `${ctx.hookPath}; ${removed.detail}`);
    return EXIT_DEGRADED;
  }
  stdout(`[SGSD] commit-gate installer removed hook at ${ctx.hookPath}`);
  return EXIT_OK;
}

function main(argv = process.argv.slice(2), cwd = process.cwd()) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    reason('usage_error', error && error.message || 'invalid arguments');
    stdout(usage());
    return EXIT_USAGE;
  }

  if (args.help) {
    stdout(usage());
    return EXIT_OK;
  }
  if (!args.action) {
    reason('usage_missing_action', 'expected --install or --uninstall');
    stdout(usage());
    return EXIT_USAGE;
  }

  const ctx = resolveContext(cwd);
  if (!ctx.ok) {
    reason(ctx.reason_code, ctx.detail || cwd);
    return EXIT_REFUSED;
  }

  stdout(`[SGSD] commit-gate installer repo root ${ctx.repoRoot}`);
  stdout(`[SGSD] commit-gate installer git-resolved hook ${ctx.hookPath}`);
  if (ctx.coreHooksPath) stdout(`[SGSD] commit-gate installer core.hooksPath honored: ${ctx.coreHooksPath}`);
  printSharedWarning(ctx);

  if (args.action === 'install') return install(ctx, args.dryRun);
  if (args.action === 'uninstall') return uninstall(ctx, args.dryRun);
  reason('usage_unknown_action', args.action);
  return EXIT_USAGE;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  MARKER,
  parseArgs,
  resolveContext,
  trampolineContent,
  main
};
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const BASH_WRAPPER = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'sgsd-update.sh');
const POWERSHELL_WRAPPER = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'sgsd-update.ps1');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true,
  });
}

function runOk(command, args, options = {}) {
  const result = run(command, args, options);
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result.stdout.trim();
}

function git(cwd, ...args) {
  return runOk('git', cwd ? ['-C', cwd, ...args] : args);
}

function findGit() {
  const result = process.platform === 'win32'
    ? run('where.exe', ['git.exe'])
    : run('sh', ['-c', 'command -v git']);
  assert.equal(result.status, 0, output(result));
  return result.stdout.split(/\r?\n/).find(Boolean).trim();
}

function initFixtureRepo(repoPath, { bare = false } = {}) {
  fs.mkdirSync(repoPath, { recursive: true });
  git(null, 'init', ...(bare ? ['--bare'] : []), repoPath);
  if (bare) {
    git(null, '--git-dir', repoPath, 'config', 'core.autocrlf', 'false');
  } else {
    git(repoPath, 'config', 'core.autocrlf', 'false');
  }
}

function attachFixtureOrigin(repoPath, origin) {
  git(repoPath, 'remote', 'add', 'origin', origin);
  git(repoPath, 'fetch', 'origin', 'refs/heads/master:refs/remotes/origin/master');
  git(repoPath, 'checkout', '-B', 'master', 'refs/remotes/origin/master');
}

function shellPath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function findBash() {
  if (process.platform !== 'win32') {
    const result = run('sh', ['-c', 'command -v bash']);
    return result.status === 0 ? result.stdout.trim() : null;
  }

  const result = run('where.exe', ['bash.exe']);
  if (result.status !== 0) return null;
  return result.stdout
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .find((candidate) =>
      candidate && !/[\\/](?:System32|WindowsApps)[\\/]/i.test(candidate),
    ) || null;
}

function findPowerShell() {
  for (const command of process.platform === 'win32'
    ? ['pwsh.exe', 'powershell.exe']
    : ['pwsh']) {
    const probe = run(command, ['-NoProfile', '-Command', 'exit 0']);
    if (probe.status === 0) return command;
  }
  return null;
}

const runtimes = [];
const bash = findBash();
if (bash) runtimes.push({ name: 'Bash', command: bash, kind: 'bash' });
const powershell = findPowerShell();
if (powershell) runtimes.push({ name: 'PowerShell', command: powershell, kind: 'powershell' });

if (runtimes.length === 0) {
  test('runtime updater contracts', { skip: 'sandbox does not permit child runtimes' }, () => {});
}

function write(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

function createGitShim(root) {
  const shimDirectory = path.join(root, 'git-shim');
  const shimPath = path.join(shimDirectory, 'git');
  write(
    shimPath,
    [
      '#!/usr/bin/env node',
      `const fs = require('node:fs');`,
      `const { spawnSync } = require('node:child_process');`,
      `const args = process.argv.slice(2).map((arg) =>`,
      `  process.platform === 'win32' && arg.endsWith('{commit}') && !arg.endsWith('^{commit}')`,
      `    ? arg.slice(0, -8) + '^{commit}'`,
      `    : arg,`,
      `);`,
      `const isOriginResolve = args.length === 6`,
      `  && args[0] === '-C'`,
      `  && args[2] === 'remote'`,
      `  && args[3] === 'get-url'`,
      `  && args[4] === '--all'`,
      `  && args[5] === 'origin';`,
      `const isNetworkOperation = args.length >= 4`,
      `  && args[0] === '-C'`,
      `  && (args[2] === 'ls-remote' || args[2] === 'fetch')`,
      `  && args[3] === 'origin';`,
      `if (isNetworkOperation) {`,
      `  fs.appendFileSync(process.env.SGSD_TEST_GIT_NETWORK_LOG, args[2] + ' origin\\n');`,
      `}`,
      `const result = spawnSync(process.env.SGSD_TEST_REAL_GIT, args, { encoding: 'utf8' });`,
      `if (isOriginResolve`,
      `    && result.status === 0`,
      `    && result.stdout.trim() === process.env.SGSD_TEST_LOCAL_ORIGIN) {`,
      `  process.stdout.write('https://github.com/Berrowj/super-gsd.git\\n');`,
      `} else {`,
      `  process.stdout.write(result.stdout || '');`,
      `  process.stderr.write(result.stderr || '');`,
      `}`,
      `process.exit(result.status === null ? 1 : result.status);`,
      '',
    ].join('\n'),
  );
  if (process.platform === 'win32') {
    write(
      path.join(shimDirectory, 'git.cmd'),
      `@echo off\r\n"${process.execPath}" "%~dp0git" %*\r\n`,
    );
  }
  fs.chmodSync(shimPath, 0o755);
  return { shimDirectory, realGit: findGit() };
}

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-update-contract-'));
  const origin = path.join(root, 'origin.git');
  const author = path.join(root, 'author');
  const source = path.join(root, "source with 'quote");
  const project = path.join(root, 'project');
  const home = path.join(root, "home with 'quote");
  const atlasRoot = path.join(root, 'atlas-root');
  const installLog = path.join(root, 'install.log');
  const transitionLog = path.join(root, 'transition.log');
  const orderLog = path.join(root, 'order.log');
  const gitNetworkLog = path.join(root, 'git-network.log');
  const { shimDirectory: gitShimDirectory, realGit } = createGitShim(root);

  initFixtureRepo(origin, { bare: true });
  git(null, '--git-dir', origin, 'symbolic-ref', 'HEAD', 'refs/heads/master');
  initFixtureRepo(author);
  git(author, 'config', 'user.name', 'SGSD Contract Test');
  git(author, 'config', 'user.email', 'sgsd-contract@example.invalid');
  git(author, 'remote', 'add', 'origin', origin);

  write(path.join(author, 'tracked.txt'), 'initial\n');
  write(
    path.join(author, 'super-gsd', 'install.sh'),
    [
      '#!/usr/bin/env bash',
      'set -u',
      'printf \'%s\\n\' "$*" >> "${SGSD_TEST_INSTALL_LOG:?}"',
      'printf \'install\\n\' >> "${SGSD_TEST_ORDER_LOG:?}"',
      'script_dir="$(cd "$(dirname "$0")" && pwd)"',
      'mkdir -p "$HOME/.claude/tools/telemetry-atlas"',
      'cp "$script_dir/tools/telemetry-atlas/global.cjs" "$HOME/.claude/tools/telemetry-atlas/global.cjs"',
      'if [[ -n "${SGSD_TEST_RUNNING_UPDATER:-}" ]]; then cp "$script_dir/replacement-updater.sh" "$SGSD_TEST_RUNNING_UPDATER"; fi',
      'exit ${SGSD_TEST_INSTALL_EXIT:-0}',
      '',
    ].join('\n'),
  );
  write(path.join(author, 'super-gsd', 'tools', 'telemetry-atlas', 'global.cjs'), [
    '#!/usr/bin/env node',
    "'use strict';",
    "const fs = require('node:fs');",
    "fs.appendFileSync(process.env.SGSD_TEST_TRANSITION_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');",
    "fs.appendFileSync(process.env.SGSD_TEST_ORDER_LOG, 'restart\\n');",
    "process.stdout.write('receiver_transition=verified\\n');",
    'process.exit(Number(process.env.SGSD_TEST_TRANSITION_EXIT || 0));',
    '',
  ].join('\n'));
  write(path.join(author, 'super-gsd', 'replacement-updater.sh'), [
    '#!/usr/bin/env bash',
    'printf \'replacement_tail_executed\\n\' >> "${SGSD_TEST_ORDER_LOG:?}"',
    'exit 97',
    '',
  ].join('\n'));
  git(author, 'add', '.');
  git(author, 'commit', '-m', 'initial fixture');
  git(author, 'branch', '-M', 'master');
  git(author, 'push', '-u', 'origin', 'master');
  initFixtureRepo(source);
  attachFixtureOrigin(source, origin);

  fs.mkdirSync(path.join(project, '.planning'), { recursive: true });
  write(path.join(project, '.planning', 'config.json'), '{preserve:true}\n');

  return {
    root,
    origin,
    author,
    source,
    project,
    home,
    atlasRoot,
    installLog,
    transitionLog,
    orderLog,
    gitNetworkLog,
    gitShimDirectory,
    realGit,
  };
}

function destroyFixture(fixture) {
  fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
}

function commit(fixture, label, { branch = 'master' } = {}) {
  write(path.join(fixture.author, 'tracked.txt'), `${label}\n`);
  git(fixture.author, 'add', 'tracked.txt');
  git(fixture.author, 'commit', '-m', label);
  const sha = git(fixture.author, 'rev-parse', 'HEAD');
  git(fixture.author, 'push', 'origin', `HEAD:${branch}`);
  return sha;
}

function localCommit(fixture, label) {
  git(fixture.source, 'config', 'user.name', 'SGSD Contract Test');
  git(fixture.source, 'config', 'user.email', 'sgsd-contract@example.invalid');
  write(path.join(fixture.source, 'local-only.txt'), `${label}\n`);
  git(fixture.source, 'add', 'local-only.txt');
  git(fixture.source, 'commit', '-m', label);
  return git(fixture.source, 'rev-parse', 'HEAD');
}

function invoke(runtime, fixture, mode = 'update', extraEnv = {}, wrapperOverride) {
  const commonEnv = {
    PATH: `${fixture.gitShimDirectory}${path.delimiter}${process.env.PATH || ''}`,
    SGSD_TEST_INSTALL_LOG: shellPath(fixture.installLog),
    SGSD_TEST_TRANSITION_LOG: shellPath(fixture.transitionLog),
    SGSD_TEST_ORDER_LOG: shellPath(fixture.orderLog),
    SGSD_TEST_GIT_NETWORK_LOG: shellPath(fixture.gitNetworkLog),
    SGSD_TEST_LOCAL_ORIGIN: fixture.origin,
    SGSD_TEST_REAL_GIT: shellPath(fixture.realGit),
    HOME: shellPath(fixture.home),
    USERPROFILE: fixture.home,
    SGSD_ATLAS_GLOBAL_ROOT: shellPath(fixture.atlasRoot),
    ...extraEnv,
  };

  if (runtime.kind === 'bash') {
    const modeArgs = mode === 'check'
      ? ['--check']
      : mode === 'no-install'
        ? ['--no-install']
        : [];
    return run(
      runtime.command,
      [wrapperOverride || BASH_WRAPPER, '--source', shellPath(fixture.source), ...modeArgs],
      { cwd: fixture.project, env: commonEnv },
    );
  }

  const modeArgs = mode === 'check'
    ? ['-Check']
    : mode === 'no-install'
      ? ['-NoInstall']
      : [];
  return run(
    runtime.command,
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      POWERSHELL_WRAPPER,
      '-Source',
      fixture.source,
      ...modeArgs,
    ],
    { cwd: fixture.project, env: commonEnv },
  );
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function installCalls(fixture) {
  if (!fs.existsSync(fixture.installLog)) return [];
  return fs.readFileSync(fixture.installLog, 'utf8').trim().split(/\r?\n/).filter(Boolean);
}
function transitionCalls(fixture) {
  if (!fs.existsSync(fixture.transitionLog)) return [];
  return fs.readFileSync(fixture.transitionLog, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

for (const runtime of runtimes) {
  for (const mode of ['check', 'update']) {
    test(`${runtime.name}: ${mode} rejects a repointed origin before remote access or mutation`, () => {
      const fixture = createFixture();
      try {
        const repointedOrigin = path.join(fixture.root, 'repointed.git');
        initFixtureRepo(repointedOrigin, { bare: true });
        git(null, '--git-dir', repointedOrigin, 'symbolic-ref', 'HEAD', 'refs/heads/master');
        git(fixture.author, 'push', repointedOrigin, 'master');
        const repointedSha = commit(fixture, 'repointed update');
        git(fixture.author, 'push', repointedOrigin, 'HEAD:refs/heads/master');
        git(fixture.source, 'remote', 'set-url', 'origin', repointedOrigin);
        const beforeHead = git(fixture.source, 'rev-parse', 'HEAD');
        const beforeTracking = git(fixture.source, 'rev-parse', 'refs/remotes/origin/master');

        const result = invoke(runtime, fixture, mode);

        assert.notEqual(result.status, 0, output(result));
        assert.match(output(result), /(?:untrusted|non-canonical).*origin|origin.*(?:untrusted|non-canonical)/i);
        assert.equal(git(fixture.source, 'rev-parse', 'HEAD'), beforeHead);
        assert.equal(git(fixture.source, 'rev-parse', 'refs/remotes/origin/master'), beforeTracking);
        assert.notEqual(
          run('git', ['-C', fixture.source, 'cat-file', '-e', `${repointedSha}^{commit}`]).status,
          0,
          'repointed commit must not be fetched',
        );
        assert.deepEqual(installCalls(fixture), []);
        assert.equal(fs.existsSync(path.join(fixture.project, '.super-gsd-version')), false);
        assert.equal(fs.existsSync(fixture.gitNetworkLog), false, 'origin must be rejected before ls-remote/fetch');
      } finally {
        destroyFixture(fixture);
      }
    });
  }

  test(`${runtime.name}: clean behind source fast-forwards to captured SHA and installs globally`, () => {
    const fixture = createFixture();
    try {
      const fetchedSha = commit(fixture, 'upstream update');
      const configPath = path.join(fixture.project, '.planning', 'config.json');
      const configBefore = fs.readFileSync(configPath, 'utf8');

      const result = invoke(runtime, fixture);

      assert.equal(result.status, 0, output(result));
      assert.equal(git(fixture.source, 'rev-parse', 'HEAD'), fetchedSha);
      assert.equal(git(fixture.source, 'rev-parse', 'refs/remotes/origin/master'), fetchedSha);
      assert.deepEqual(installCalls(fixture), ['--update --install-global']);
      assert.equal(fs.readFileSync(path.join(fixture.project, '.super-gsd-version'), 'utf8').trim(), fetchedSha);
      assert.equal(fs.readFileSync(configPath, 'utf8'), configBefore);
      assert.match(output(result), new RegExp(`(?:^|\\n).*source_sha=${fetchedSha}(?:\\r?\\n|\\r?$)`));
      assert.match(output(result), new RegExp(`(?:^|\\n).*project_pin=${fetchedSha}(?:\\r?\\n|\\r?$)`));
    } finally {
      destroyFixture(fixture);
    }
  });

  for (const dirtyKind of ['tracked', 'untracked']) {
    test(`${runtime.name}: ${dirtyKind} dirt fails before fetch, merge, pin, or install`, () => {
      const fixture = createFixture();
      try {
        const beforeHead = git(fixture.source, 'rev-parse', 'HEAD');
        if (dirtyKind === 'tracked') {
          fs.appendFileSync(path.join(fixture.source, 'tracked.txt'), 'dirty\n');
        } else {
          write(path.join(fixture.source, 'untracked.txt'), 'dirty\n');
        }

        const result = invoke(runtime, fixture);

        assert.notEqual(result.status, 0, output(result));
        assert.equal(git(fixture.source, 'rev-parse', 'HEAD'), beforeHead);
        assert.deepEqual(installCalls(fixture), []);
        assert.equal(fs.existsSync(path.join(fixture.project, '.super-gsd-version')), false);
        assert.match(output(result), /dirty/i);
      } finally {
        destroyFixture(fixture);
      }
    });
  }

  test(`${runtime.name}: locally-ahead source fails without changing HEAD`, () => {
    const fixture = createFixture();
    try {
      const localSha = localCommit(fixture, 'local ahead');

      const result = invoke(runtime, fixture);

      assert.notEqual(result.status, 0, output(result));
      assert.equal(git(fixture.source, 'rev-parse', 'HEAD'), localSha);
      assert.deepEqual(installCalls(fixture), []);
      assert.equal(fs.existsSync(path.join(fixture.project, '.super-gsd-version')), false);
      assert.match(output(result), /ahead|local-only/i);
    } finally {
      destroyFixture(fixture);
    }
  });

  test(`${runtime.name}: diverged source fails without changing HEAD`, () => {
    const fixture = createFixture();
    try {
      const localSha = localCommit(fixture, 'local divergence');
      commit(fixture, 'upstream divergence');

      const result = invoke(runtime, fixture);

      assert.notEqual(result.status, 0, output(result));
      assert.equal(git(fixture.source, 'rev-parse', 'HEAD'), localSha);
      assert.deepEqual(installCalls(fixture), []);
      assert.equal(fs.existsSync(path.join(fixture.project, '.super-gsd-version')), false);
      assert.match(output(result), /diverg/i);
    } finally {
      destroyFixture(fixture);
    }
  });

  test(`${runtime.name}: origin advance after fetch cannot change captured target or project pin`, () => {
    const fixture = createFixture();
    try {
      const capturedSha = commit(fixture, 'captured update');
      const advance = path.join(fixture.root, 'advance');
      initFixtureRepo(advance);
      attachFixtureOrigin(advance, fixture.origin);
      git(advance, 'config', 'user.name', 'SGSD Contract Test');
      git(advance, 'config', 'user.email', 'sgsd-contract@example.invalid');
      write(path.join(advance, 'tracked.txt'), 'origin advanced after fetch\n');
      git(advance, 'add', 'tracked.txt');
      git(advance, 'commit', '-m', 'later origin update');
      const laterSha = git(advance, 'rev-parse', 'HEAD');
      git(advance, 'push', 'origin', 'HEAD:refs/heads/pending-update');

      const hook = path.join(fixture.source, '.git', 'hooks', 'post-merge');
      write(
        hook,
        `#!/bin/sh\ngit --git-dir='${shellPath(fixture.origin)}' update-ref refs/heads/master '${laterSha}'\n`,
      );
      fs.chmodSync(hook, 0o755);

      const result = invoke(runtime, fixture);

      assert.equal(result.status, 0, output(result));
      assert.equal(git(null, '--git-dir', fixture.origin, 'rev-parse', 'refs/heads/master'), laterSha);
      assert.equal(git(fixture.source, 'rev-parse', 'HEAD'), capturedSha);
      assert.equal(git(fixture.source, 'rev-parse', 'refs/remotes/origin/master'), capturedSha);
      assert.equal(fs.readFileSync(path.join(fixture.project, '.super-gsd-version'), 'utf8').trim(), capturedSha);
      assert.match(output(result), new RegExp(`source_sha=${capturedSha}`));
      assert.doesNotMatch(output(result), new RegExp(`source_sha=${laterSha}`));
      assert.deepEqual(installCalls(fixture), ['--update --install-global']);
    } finally {
      destroyFixture(fixture);
    }
  });

  test(`${runtime.name}: installer failure preserves an existing project pin`, () => {
    const fixture = createFixture();
    try {
      const fetchedSha = commit(fixture, 'installer failure update');
      const pinPath = path.join(fixture.project, '.super-gsd-version');
      write(pinPath, 'known-good-pin\n');

      const result = invoke(runtime, fixture, 'update', { SGSD_TEST_INSTALL_EXIT: '23' });

      assert.notEqual(result.status, 0, output(result));
      assert.equal(git(fixture.source, 'rev-parse', 'HEAD'), fetchedSha);
      assert.equal(fs.readFileSync(pinPath, 'utf8'), 'known-good-pin\n');
      assert.deepEqual(installCalls(fixture), ['--update --install-global']);
    } finally {
      destroyFixture(fixture);
    }
  });

  test(`${runtime.name}: no-install mode fast-forwards but neither installs nor pins`, () => {
    const fixture = createFixture();
    try {
      const fetchedSha = commit(fixture, 'no-install update');

      const result = invoke(runtime, fixture, 'no-install');

      assert.equal(result.status, 0, output(result));
      assert.equal(git(fixture.source, 'rev-parse', 'HEAD'), fetchedSha);
      assert.deepEqual(installCalls(fixture), []);
      assert.equal(fs.existsSync(path.join(fixture.project, '.super-gsd-version')), false);
      assert.match(output(result), new RegExp(`source_sha=${fetchedSha}`));
      assert.deepEqual(transitionCalls(fixture), []);
    } finally {
      destroyFixture(fixture);
    }
  });

  test(`${runtime.name}: check mode is read-only and compares refs/heads/master, not remote HEAD`, () => {
    const fixture = createFixture();
    try {
      const masterSha = git(fixture.source, 'rev-parse', 'HEAD');
      git(fixture.author, 'switch', '-c', 'alternate-default');
      commit(fixture, 'alternate default', { branch: 'alternate-default' });
      git(null, '--git-dir', fixture.origin, 'symbolic-ref', 'HEAD', 'refs/heads/alternate-default');

      const cleanResult = invoke(runtime, fixture, 'check');

      assert.equal(cleanResult.status, 0, output(cleanResult));
      assert.match(output(cleanResult), /Up to date with origin\/master/);
      assert.equal(git(fixture.source, 'rev-parse', 'HEAD'), masterSha);
      assert.deepEqual(installCalls(fixture), []);
      assert.deepEqual(transitionCalls(fixture), []);

      git(fixture.author, 'switch', 'master');
      const upstreamSha = commit(fixture, 'master drift');
      const driftResult = invoke(runtime, fixture, 'check');

      assert.equal(driftResult.status, 10, output(driftResult));
      assert.match(output(driftResult), new RegExp(`upstream=${upstreamSha}`));
      assert.equal(git(fixture.source, 'rev-parse', 'HEAD'), masterSha);
      assert.equal(git(fixture.source, 'rev-parse', 'refs/remotes/origin/master'), masterSha);
      assert.deepEqual(installCalls(fixture), []);
    } finally {
      destroyFixture(fixture);
    }
  });
}

for (const runtime of runtimes.filter(candidate => candidate.kind === 'bash' && process.platform === 'linux')) {
  test(`${runtime.name}: verified install invokes the isolated receiver transition before publishing the pin`, () => {
    const fixture = createFixture();
    try {
      const fetchedSha = commit(fixture, 'receiver transition update');
      const result = invoke(runtime, fixture);
      assert.equal(result.status, 0, output(result));
      const [args] = transitionCalls(fixture);
      assert.deepEqual(args, ['restart', '--if-running', '--trusted-source-entry',
        fs.realpathSync(path.join(fixture.source, 'super-gsd', 'tools', 'telemetry-atlas', 'global.cjs'))]);
      assert.deepEqual(fs.readFileSync(fixture.orderLog, 'utf8').trim().split(/\r?\n/), ['install', 'restart']);
      assert.equal(fs.readFileSync(path.join(fixture.project, '.super-gsd-version'), 'utf8').trim(), fetchedSha);
    } finally { destroyFixture(fixture); }
  });

  test(`${runtime.name}: receiver transition failure preserves the previous pin for explicit retry`, () => {
    const fixture = createFixture();
    try {
      commit(fixture, 'receiver transition failure');
      const pin = path.join(fixture.project, '.super-gsd-version'); write(pin, 'known-good-pin\n');
      const result = invoke(runtime, fixture, 'update', { SGSD_TEST_TRANSITION_EXIT: '29' });
      assert.notEqual(result.status, 0, output(result)); assert.equal(fs.readFileSync(pin, 'utf8'), 'known-good-pin\n');
      assert.equal(transitionCalls(fixture).length, 1); assert.match(output(result), /retry.*pin unchanged/i);
    } finally { destroyFixture(fixture); }
  });

  test(`${runtime.name}: an updater overwritten by its installer finishes only the already-parsed invocation`, () => {
    const fixture = createFixture();
    try {
      const fetchedSha = commit(fixture, 'self replacement update');
      const running = path.join(fixture.root, 'running updater.sh'); fs.copyFileSync(BASH_WRAPPER, running); fs.chmodSync(running, 0o755);
      const result = invoke(runtime, fixture, 'update', { SGSD_TEST_RUNNING_UPDATER: shellPath(running) }, running);
      assert.equal(result.status, 0, output(result));
      assert.match(fs.readFileSync(running, 'utf8'), /replacement_tail_executed/);
      assert.doesNotMatch(fs.readFileSync(fixture.orderLog, 'utf8'), /replacement_tail_executed/);
      assert.equal(fs.readFileSync(path.join(fixture.project, '.super-gsd-version'), 'utf8').trim(), fetchedSha);
    } finally { destroyFixture(fixture); }
  });
}

test('static updater and skill contract forbids pull and documents restart boundaries', () => {
  const bashSource = fs.readFileSync(BASH_WRAPPER, 'utf8');
  const powershellSource = fs.readFileSync(POWERSHELL_WRAPPER, 'utf8');
  const skillSource = fs.readFileSync(
    path.join(REPO_ROOT, 'super-gsd', 'skills', 'sgsd-update', 'SKILL.md'),
    'utf8',
  );

  for (const source of [bashSource, powershellSource]) {
    assert.doesNotMatch(source, /git\s+(?:-C\s+[^\s]+\s+)?pull\b/i);
    assert.match(source, /merge\s+--ff-only/);
    assert.match(source, /--update/);
    assert.match(source, /--install-global/);
  }

  for (const term of ['dirty', 'ahead', 'diverged', 'profile', 'client session', 'MCP', 'cockpit', 'tmux', 'exit']) {
    assert.match(skillSource, new RegExp(term, 'i'), `skill must document ${term}`);
  }
});

test('updaters validate the resolved origin before any remote check or fetch', () => {
  for (const wrapper of [BASH_WRAPPER, POWERSHELL_WRAPPER]) {
    const source = fs.readFileSync(wrapper, 'utf8');
    const resolutionIndex = source.search(/remote\s+get-url\s+--all\s+origin/i);
    const checkIndex = source.search(/ls-remote\s+origin/i);
    const fetchIndex = source.search(/fetch\s+origin/i);

    assert.notEqual(resolutionIndex, -1, `${path.basename(wrapper)} must resolve every origin fetch URL`);
    assert.match(source, /untrusted|non-canonical/i, `${path.basename(wrapper)} must explain origin rejection`);
    assert.ok(resolutionIndex < checkIndex, `${path.basename(wrapper)} must validate origin before ls-remote`);
    assert.ok(resolutionIndex < fetchIndex, `${path.basename(wrapper)} must validate origin before fetch`);
  }
});

test('Bash updater transitions the installed global receiver after install verification and before publishing the project pin', () => {
  const source = fs.readFileSync(BASH_WRAPPER, 'utf8');
  const installed = source.indexOf('assert_captured_head "after install"');
  const restart = source.search(/global\.cjs[^\n]*restart[^\n]*--if-running/);
  const pin = source.indexOf('# Write .super-gsd-version atomically only after install success.');
  assert.ok(installed >= 0 && restart > installed && pin > restart,
    'verified install must transition the same-port receiver before pin publication');
});

test('update skill documents the narrow owned Linux receiver exception and its fail-closed boundaries', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'super-gsd', 'skills', 'sgsd-update', 'SKILL.md'), 'utf8');
  assert.match(source, /Linux[\s\S]{0,240}same-port/i);
  assert.match(source, /identity[\s\S]{0,160}fingerprint/i);
  assert.match(source, /explicit retry[\s\S]{0,160}journal/i);
  assert.match(source, /--check[\s\S]{0,160}--no-install[\s\S]{0,160}(?:no|never)[\s\S]{0,80}transition/i);
  assert.match(source, /Windows[\s\S]{0,120}(?:open|not implemented)/i);
  assert.match(source, /(?:client|MCP|cockpit|tmux)[\s\S]{0,240}(?:unchanged|untouched|manual)/i);
  assert.match(source, /receiver-transition failure[\s\S]{0,180}preserves an existing project pin/i);
  assert.match(source, /legacy receiver[\s\S]{0,120}unknown[\s\S]{0,180}loaded fingerprint[\s\S]{0,100}installed target/i);
});

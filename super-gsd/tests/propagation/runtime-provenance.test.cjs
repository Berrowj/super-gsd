const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const LAUNCHER = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'sgsd');
const BOOT = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'sgsd-boot.sh');
const INSTALL = path.join(REPO_ROOT, 'super-gsd', 'install.sh');
const CURATE = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'sgsd-curate.sh');
const REGISTRY_SYNC = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'sgsd-registry-sync.sh');
const REMOTE_TMUX = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'sgsd-remote-tmux.sh');

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    timeout: 420_000,
    windowsHide: true,
  });
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

function shellPath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function write(filePath, contents, mode) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
  if (mode !== undefined) fs.chmodSync(filePath, mode);
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`;
}

const bash = findBash();

function createRuntimeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-runtime-provenance-'));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  const source = path.join(home, '.claude', 'super-gsd', 'source');
  const scripts = path.join(home, '.claude', 'super-gsd', 'scripts');
  const agents = path.join(home, '.claude', 'agents');
  const launcher = path.join(home, '.local', 'bin', 'sgsd');
  const fakeBin = path.join(root, 'bin');
  const cockpitMarker = path.join(root, 'cockpit.log');
  const tmuxMarker = path.join(root, 'tmux.log');
  const vendoredMarker = path.join(root, 'vendored.log');

  fs.mkdirSync(source, { recursive: true });
  let result = run('git', ['init'], { cwd: source });
  assert.equal(result.status, 0, output(result));
  run('git', ['config', 'user.name', 'SGSD Runtime Test'], { cwd: source });
  run('git', ['config', 'user.email', 'runtime@example.invalid'], { cwd: source });
  write(path.join(source, 'tracked.txt'), 'canonical source\n');
  write(
    path.join(source, 'super-gsd', 'tools', 'feature-propagation', 'audit.cjs'),
    'process.stdout.write(JSON.stringify({ok:true,issues:[]}));\n',
  );
  result = run('git', ['add', '.'], { cwd: source });
  assert.equal(result.status, 0, output(result));
  result = run('git', ['commit', '-m', 'fixture source'], { cwd: source });
  assert.equal(result.status, 0, output(result));
  const sourceHead = run('git', ['rev-parse', 'HEAD'], { cwd: source }).stdout.trim();

  write(
    path.join(project, '.planning', 'memory', 'MEMORY.md'),
    '# Memory\n\n## architecture/patterns\n',
  );
  write(path.join(project, '.super-gsd-version'), `${sourceHead}\n`);
  write(
    path.join(project, 'super-gsd', 'agents', 'vendored-agent.md'),
    [
      '---',
      'name: vendored-agent',
      'description: Must never enter the registry.',
      'tools: Read',
      'model: external',
      '---',
      '',
    ].join('\n'),
  );
  for (const name of ['sgsd-curate.sh', 'sgsd-registry-sync.sh', 'start-cockpit-server.sh']) {
    write(
      path.join(project, 'super-gsd', 'scripts', name),
      '#!/usr/bin/env bash\nprintf vendored >> ${SGSD_TEST_VENDORED_MARKER:?}\nexit 97\n',
      0o755,
    );
  }

  write(
    path.join(agents, 'canonical-agent.md'),
    [
      '---',
      'name: canonical-agent',
      'description: Canonical runtime route.',
      'tools: Read, Write',
      '---',
      '',
    ].join('\n'),
  );
  fs.mkdirSync(scripts, { recursive: true });
  fs.mkdirSync(agents, { recursive: true });
  fs.copyFileSync(BOOT, path.join(scripts, 'sgsd-boot.sh'));
  fs.chmodSync(path.join(scripts, 'sgsd-boot.sh'), 0o755);
  fs.copyFileSync(CURATE, path.join(scripts, 'sgsd-curate.sh'));
  fs.chmodSync(path.join(scripts, 'sgsd-curate.sh'), 0o755);
  fs.copyFileSync(REGISTRY_SYNC, path.join(scripts, 'sgsd-registry-sync.sh'));
  fs.chmodSync(path.join(scripts, 'sgsd-registry-sync.sh'), 0o755);
  write(
    path.join(scripts, 'start-cockpit-server.sh'),
    '#!/usr/bin/env bash\nprintf cockpit >> ${SGSD_TEST_COCKPIT_MARKER:?}\n',
    0o755,
  );

  write(path.join(fakeBin, 'claude'), '#!/usr/bin/env bash\nexit 0\n', 0o755);
  write(path.join(fakeBin, 'codex'), '#!/usr/bin/env bash\necho Logged in fixture\n', 0o755);
  write(launcher, fs.readFileSync(LAUNCHER, 'utf8'), 0o755);
  write(
    path.join(fakeBin, 'tmux'),
    [
      '#!/usr/bin/env bash',
      'printf "%s|%s|%s|%s\\n" "${SGSD_SCRIPTS_DIR:-}" "${SGSD_AGENTS_DIR:-}" "${SGSD_SOURCE_DIR:-}" "$*" >> "${SGSD_TEST_TMUX_MARKER:?}"',
      'case "${1:-}" in',
      '  has-session) exit 1 ;;',
      '  display-message) printf "%%0" ;;',
      '  split-window) printf "%%1" ;;',
      'esac',
      'exit 0',
      '',
    ].join('\n'),
    0o755,
  );

  return {
    root,
    home,
    project,
    source,
    scripts,
    agents,
    launcher,
    fakeBin,
    sourceHead,
    cockpitMarker,
    tmuxMarker,
    vendoredMarker,
  };
}

if (!bash) {
  test('runtime provenance contracts', { skip: 'bash is unavailable' }, () => {});
} else {
  test('global launcher defaults to canonical runtime paths without starting cockpit', () => {
    const fixture = createRuntimeFixture();
    try {
      const staleManifest = path.join(
        fixture.project,
        '.planning',
        'resource-registry',
        'agents.jsonl',
      );
      write(staleManifest, '{"id":"vendored-agent","path":"super-gsd/agents/vendored-agent.md"}\n');
      const future = new Date(Date.now() + 60_000);
      fs.utimesSync(staleManifest, future, future);

      const result = run(
        bash,
        [
          fixture.launcher,
          '-NoOpen',
          '--project', shellPath(fixture.project),
        ],
        {
          cwd: fixture.project,
          env: {
            PATH: `${fixture.fakeBin}${path.delimiter}${process.env.PATH}`,
            HOME: shellPath(fixture.home),
            USERPROFILE: shellPath(fixture.home),
            SGSD_SCRIPTS_DIR: '',
            SGSD_AGENTS_DIR: '',
            SGSD_SOURCE_DIR: '',
            SGSD_TEST_COCKPIT_MARKER: shellPath(fixture.cockpitMarker),
            SGSD_TEST_VENDORED_MARKER: shellPath(fixture.vendoredMarker),
          },
        },
      );

      assert.equal(result.status, 0, output(result));
      const launcherStdout = shellPath(result.stdout);
      const fixtureName = path.basename(fixture.root).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.match(launcherStdout, new RegExp(`Framework HEAD: ${fixture.sourceHead}`));
      assert.match(launcherStdout, new RegExp(`Project Pin: ${fixture.sourceHead}`));
      assert.match(
        launcherStdout,
        new RegExp(`^  Framework Scripts:\\s+[^\\r\\n]*/${fixtureName}/home/\\.claude/super-gsd/scripts\\r?$`, 'm'),
      );
      assert.match(
        launcherStdout,
        new RegExp(`^  Framework Agents:\\s+[^\\r\\n]*/${fixtureName}/home/\\.claude/agents\\r?$`, 'm'),
      );
      assert.match(
        launcherStdout,
        new RegExp(`^  Framework Source:\\s+[^\\r\\n]*/${fixtureName}/home/\\.claude/super-gsd/source\\r?$`, 'm'),
      );
      assert.doesNotMatch(
        launcherStdout,
        new RegExp(`/${fixtureName}/project/super-gsd(?:/[^\\r\\n]*)?\\r?$`, 'm'),
      );
      assert.equal(fs.existsSync(fixture.cockpitMarker), false);
      assert.equal(fs.existsSync(fixture.vendoredMarker), false);
      assert.doesNotMatch(result.stdout, /(?:^|\n)LAUNCH(?:\r?\n|$)/);
      assert.doesNotMatch(result.stdout, /Run each dashboard|Next:.*claude/i);

      const manifest = fs.readFileSync(
        path.join(fixture.project, '.planning', 'resource-registry', 'agents.jsonl'),
        'utf8',
      );
      assert.match(manifest, /"id":"canonical-agent"/);
      assert.match(manifest, /"path":"super-gsd\/agents\/canonical-agent\.md"/);
      assert.doesNotMatch(manifest, /vendored-agent/);

      fs.rmSync(fixture.launcher, { force: true });
      fs.mkdirSync(path.join(fixture.home, '.claude', 'get-shit-done'), { recursive: true });
      const installResult = run(bash, [INSTALL, '--install-global'], {
        cwd: REPO_ROOT,
        env: {
          HOME: shellPath(fixture.home),
          USERPROFILE: shellPath(fixture.home),
        },
      });
      assert.equal(installResult.status, 0, output(installResult));
      assert.equal(fs.existsSync(fixture.launcher), true);
      assert.equal(fs.readFileSync(fixture.launcher, 'utf8'), fs.readFileSync(LAUNCHER, 'utf8'));
      if (process.platform !== 'win32') {
        assert.notEqual(fs.statSync(fixture.launcher).mode & 0o111, 0);
      }

      const installedResult = process.platform === 'win32'
        ? run(bash, [fixture.launcher, '-NoOpen', '--skip-preflight', '--project', shellPath(fixture.project)], {
            cwd: fixture.project,
            env: { HOME: shellPath(fixture.home), USERPROFILE: shellPath(fixture.home) },
          })
        : run(fixture.launcher, ['-NoOpen', '--skip-preflight', '--project', fixture.project], {
            cwd: fixture.project,
            env: { HOME: fixture.home },
          });
      assert.equal(installedResult.status, 0, output(installedResult));
      assert.doesNotMatch(installedResult.stdout, /(?:^|\n)LAUNCH(?:\r?\n|$)/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('boot rejects a project pin mismatch before registry or cockpit work', () => {
    const fixture = createRuntimeFixture();
    try {
      write(path.join(fixture.project, '.super-gsd-version'), `${'0'.repeat(40)}\n`);
      const result = run(
        bash,
        [
          BOOT,
          '--skip-preflight',
          '--project', shellPath(fixture.project),
          '--scripts-dir', shellPath(fixture.scripts),
          '--agents-dir', shellPath(fixture.agents),
          '--source-dir', shellPath(fixture.source),
        ],
        { cwd: fixture.project },
      );

      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /provenance mismatch/i);
      assert.equal(fs.existsSync(fixture.cockpitMarker), false);
      assert.equal(
        fs.existsSync(path.join(fixture.project, '.planning', 'resource-registry', 'agents.jsonl')),
        false,
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('remote doctor reports only the selected runtime provenance', () => {
    const fixture = createRuntimeFixture();
    try {
      const result = run(
        bash,
        [
          REMOTE_TMUX,
          '--project', shellPath(fixture.project),
          '--scripts-dir', shellPath(fixture.scripts),
          '--agents-dir', shellPath(fixture.agents),
          '--source-dir', shellPath(fixture.source),
          '--doctor',
        ],
        { cwd: fixture.project },
      );

      assert.equal(result.status, 0, output(result));
      const doctorStdout = shellPath(result.stdout);
      const fixtureName = path.basename(fixture.root).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.match(doctorStdout, new RegExp(`Framework HEAD: ${fixture.sourceHead}`));
      assert.match(doctorStdout, new RegExp(`Project Pin: ${fixture.sourceHead}`));
      assert.match(
        doctorStdout,
        new RegExp(`^  scripts:\\s+[^\\r\\n]*/${fixtureName}/home/\\.claude/super-gsd/scripts\\r?$`, 'm'),
      );
      assert.match(
        doctorStdout,
        new RegExp(`^  agents:\\s+[^\\r\\n]*/${fixtureName}/home/\\.claude/agents\\r?$`, 'm'),
      );
      assert.doesNotMatch(
        doctorStdout,
        new RegExp(`/${fixtureName}/project/super-gsd(?:/[^\\r\\n]*)?\\r?$`, 'm'),
      );
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('remote tmux starts cockpit exclusively from the selected scripts directory', () => {
    const fixture = createRuntimeFixture();
    try {
      const result = run(
        bash,
        [
          REMOTE_TMUX,
          '--project', shellPath(fixture.project),
          '--scripts-dir', shellPath(fixture.scripts),
          '--agents-dir', shellPath(fixture.agents),
          '--source-dir', shellPath(fixture.source),
          '--session', 'fixture-sgsd',
          '--shell',
          '--no-attach',
        ],
        {
          cwd: fixture.project,
          env: {
            PATH: `${fixture.fakeBin}${path.delimiter}${process.env.PATH}`,
            SGSD_TEST_COCKPIT_MARKER: shellPath(fixture.cockpitMarker),
            SGSD_TEST_TMUX_MARKER: shellPath(fixture.tmuxMarker),
            SGSD_TEST_VENDORED_MARKER: shellPath(fixture.vendoredMarker),
          },
        },
      );

      assert.equal(result.status, 0, output(result));
      assert.equal(fs.existsSync(fixture.cockpitMarker), true);
      assert.equal(fs.existsSync(fixture.tmuxMarker), true);
      assert.equal(fs.existsSync(fixture.vendoredMarker), false);
      const tmuxLog = fs.readFileSync(fixture.tmuxMarker, 'utf8');
      assert.match(tmuxLog, /\.claude[/\\]super-gsd[/\\]scripts/);
      assert.match(tmuxLog, /\.claude[/\\]agents/);
      assert.match(tmuxLog, /\.claude[/\\]super-gsd[/\\]source/);
      assert.doesNotMatch(tmuxLog, /project[/\\]super-gsd/);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('remote tmux rejects provenance mismatch before cockpit or tmux mutation', () => {
    const fixture = createRuntimeFixture();
    try {
      write(path.join(fixture.project, '.super-gsd-version'), `${'f'.repeat(40)}\n`);
      const result = run(
        bash,
        [
          REMOTE_TMUX,
          '--project', shellPath(fixture.project),
          '--scripts-dir', shellPath(fixture.scripts),
          '--agents-dir', shellPath(fixture.agents),
          '--source-dir', shellPath(fixture.source),
          '--no-attach',
        ],
        {
          cwd: fixture.project,
          env: {
            PATH: `${fixture.fakeBin}${path.delimiter}${process.env.PATH}`,
            SGSD_TEST_COCKPIT_MARKER: shellPath(fixture.cockpitMarker),
            SGSD_TEST_TMUX_MARKER: shellPath(fixture.tmuxMarker),
          },
        },
      );

      assert.notEqual(result.status, 0, output(result));
      assert.match(output(result), /provenance mismatch/i);
      assert.equal(fs.existsSync(fixture.cockpitMarker), false);
      assert.equal(fs.existsSync(fixture.tmuxMarker), false);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
    }
  });
}

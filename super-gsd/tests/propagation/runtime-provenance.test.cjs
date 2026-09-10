const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
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
const SELECTOR_HELPER = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'lib', 'codex-worker-shell.sh');

function run(command, args, options = {}) {
  const env = { ...process.env, ...options.env };
  for (const name of options.unsetEnv || []) delete env[name];
  return spawnSync(command, args, {
    cwd: options.cwd,
    env,
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

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function nulFields(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const fields = fs.readFileSync(filePath).toString('utf8').split('\0');
  if (fields.at(-1) === '') fields.pop();
  return fields;
}

function exposeNativeCommands(directory, names) {
  for (const name of names) {
    const source = `/usr/bin/${name}`;
    const target = path.join(directory, name);
    if (!fs.existsSync(target)) fs.symlinkSync(source, target);
  }
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
  const atlasMarker = path.join(root, 'atlas.jsonl');

  fs.mkdirSync(source, { recursive: true });
  let result = run('git', ['init'], { cwd: source });
  assert.equal(result.status, 0, output(result));
  run('git', ['config', 'user.name', 'SGSD Runtime Test'], { cwd: source });
  run('git', ['config', 'user.email', 'runtime@example.invalid'], { cwd: source });
  write(path.join(source, 'tracked.txt'), 'canonical source\n');
  for (const relative of ['scripts/lib/model-routing.cjs', 'config/model-routing.json']) {
    write(path.join(source, 'super-gsd', relative), fs.readFileSync(path.join(REPO_ROOT, 'super-gsd', relative), 'utf8'));
  }
  write(
    path.join(source, 'super-gsd', 'tools', 'feature-propagation', 'audit.cjs'),
    'process.stdout.write(JSON.stringify({ok:true,issues:[]}));\n',
  );
  // Transport fixture only: exercise the launcher's required managed envelope
  // without starting the shared receiver. Real fleet/capture tests own that proof.
  write(path.join(source, 'super-gsd/tools/telemetry-atlas/global.cjs'), `
const assert = require('node:assert/strict'), fs = require('node:fs');
const args = process.argv.slice(2), command = args[0];
fs.appendFileSync(${JSON.stringify(atlasMarker)}, JSON.stringify({ command, args }) + '\\n');
if (command === 'prepare') {
  assert.ok(args.includes('--require-managed'));
  assert.equal(args[args.indexOf('--format') + 1], 'prefix');
  assert.equal(fs.realpathSync(args[args.indexOf('--project-dir') + 1]), fs.realpathSync(${JSON.stringify(project)}));
  console.log("env SGSD_RUN_ID='sgsd-11111111-1111-4111-8111-111111111111' SGSD_FLEET_MANAGED='1' CLAUDE_CODE_ENABLE_TELEMETRY='1'");
} else {
  assert.ok(['finish', 'abort'].includes(command));
  assert.equal(process.env.SGSD_RUN_ID, 'sgsd-11111111-1111-4111-8111-111111111111');
}
`);
  write(path.join(source, 'super-gsd/tools/telemetry-atlas/monitor-schedule.cjs'), `
const assert = require('node:assert/strict'), fs = require('node:fs');
assert.deepEqual(process.argv.slice(2, 4), ['include', '--project-dir']);
assert.equal(fs.realpathSync(process.argv[4]), fs.realpathSync(${JSON.stringify(project)}));
assert.equal(process.env.SGSD_FLEET_MANAGED, '1');
fs.appendFileSync(${JSON.stringify(atlasMarker)}, JSON.stringify({ command: 'include' }) + '\\n');
`);
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
  fs.mkdirSync(path.join(scripts, 'lib'), { recursive: true });
  fs.copyFileSync(SELECTOR_HELPER, path.join(scripts, 'lib', 'codex-worker-shell.sh'));
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
    atlasMarker,
  };
}

function createSelectionFixture() {
  const fixture = createRuntimeFixture();
  const remote = path.join(fixture.scripts, 'sgsd-remote-tmux.sh');
  const caller = path.join(fixture.root, 'caller');
  const incomingBin = path.join(caller, 'incoming-bin');
  const localBin = path.join(fixture.home, '.local', 'bin');
  const nvmBin = path.join(fixture.home, '.nvm', 'versions', 'node', 'v24.15.0', 'bin');
  const claudeMarker = path.join(fixture.root, 'claude.bin');
  const loginMarker = path.join(fixture.root, 'login.bin');
  const healthMarker = path.join(fixture.root, 'health.bin');
  const providerMarker = path.join(fixture.root, 'provider.bin');
  const sessionMarker = path.join(fixture.root, 'session.bin');

  fs.copyFileSync(REMOTE_TMUX, remote);
  fs.chmodSync(remote, 0o755);
  fs.mkdirSync(incomingBin, { recursive: true });
  fs.mkdirSync(nvmBin, { recursive: true });

  write(
    path.join(nvmBin, 'node'),
    `#!/usr/bin/env bash\nexec ${shellQuote(process.execPath)} "$@"\n`,
    0o755,
  );
  write(
    path.join(fixture.fakeBin, 'claude'),
    [
      '#!/usr/bin/env bash',
      '{',
      '  printf "%s\\0" CLAUDE',
      '  printf "%s\\0" "${SGSD_CODEX_APP_SERVER_COMMAND-}" "${SGSD_CODEX_COMMAND-}" "${SGSD_CODEX_APP_SERVER_ARGS-}" "${SGSD_CODEX_FORCE_LAUNCHER-}" "$PATH"',
      '  printf "%s\\0" "$@"',
      '} >> "${SGSD_TEST_CLAUDE_MARKER:?}"',
      'exit "${SGSD_TEST_CLAUDE_EXIT:-0}"',
      '',
    ].join('\n'),
    0o755,
  );
  write(
    path.join(fixture.fakeBin, 'bash'),
    [
      '#!/bin/bash',
      'if [[ "${1:-}" == -l ]]; then',
      '  {',
      '    printf "%s\\0" LOGIN "${SGSD_CODEX_APP_SERVER_COMMAND-}" "${SGSD_CODEX_COMMAND-}" "${SGSD_CODEX_APP_SERVER_ARGS-}" "${SGSD_CODEX_FORCE_LAUNCHER-}" "$PATH"',
      '    PATH="${SGSD_TEST_LOGIN_PATH:-/login/profile/path}"',
      '    printf "%s\\0" "$PATH"',
      '  } >> "${SGSD_TEST_LOGIN_MARKER:?}"',
      '  exit 0',
      'fi',
      'exec /bin/bash "$@"',
      '',
    ].join('\n'),
    0o755,
  );
  write(
    path.join(fixture.fakeBin, 'tmux'),
    [
      '#!/usr/bin/env bash',
      'printf "%s|%s|%s|" "${SGSD_SCRIPTS_DIR:-}" "${SGSD_AGENTS_DIR:-}" "${SGSD_SOURCE_DIR:-}" >> "${SGSD_TEST_TMUX_MARKER:?}"',
      'printf "%q " "$@" >> "${SGSD_TEST_TMUX_MARKER:?}"',
      'printf "\\n" >> "${SGSD_TEST_TMUX_MARKER:?}"',
      'case "${1:-}" in',
      '  has-session)',
      '    [[ "${SGSD_TEST_TMUX_EXISTING:-false}" == true ]] && exit 0',
      '    exit 1',
      '    ;;',
      '  new-session)',
      '    shift',
      '    if [[ "${SGSD_TEST_TMUX_STALE:-false}" == true ]]; then',
      '      export PATH="${SGSD_TEST_TMUX_STALE_PATH:-/usr/bin:/bin}"',
      '      export SGSD_CODEX_APP_SERVER_COMMAND="${SGSD_TEST_TMUX_STALE_APP:-stale-app}"',
      '      export SGSD_CODEX_COMMAND="${SGSD_TEST_TMUX_STALE_LEGACY:-stale-legacy}"',
      '      export SGSD_CODEX_APP_SERVER_ARGS="${SGSD_TEST_TMUX_STALE_ARGS:-[\\"stale\\"]}"',
      '      export SGSD_CODEX_FORCE_LAUNCHER="${SGSD_TEST_TMUX_STALE_FORCE:-stale-force}"',
      '    fi',
      '    cwd=""; operator=""',
      '    while [[ $# -gt 0 ]]; do',
      '      case "$1" in',
      '        -e) export "$2"; shift 2 ;;',
      '        -c) cwd="$2"; shift 2 ;;',
      '        -s|-n) shift 2 ;;',
      '        -d) shift ;;',
      '        *) operator="$1"; shift ;;',
      '      esac',
      '    done',
      '    {',
      '      printf "%s\\0" SESSION "${SGSD_CODEX_APP_SERVER_COMMAND-}" "${SGSD_CODEX_COMMAND-}" "${SGSD_CODEX_APP_SERVER_ARGS-}" "${SGSD_CODEX_FORCE_LAUNCHER-}" "$PATH" "$cwd" "$operator"',
      '    } >> "${SGSD_TEST_SESSION_MARKER:?}"',
      '    (cd "$cwd" && /bin/bash -c "$operator")',
      '    exit $?',
      '    ;;',
      '  display-message)',
      '    if [[ "${@: -1}" == "#{pane_pid}" ]]; then printf "%s" "${SGSD_TEST_TMUX_PANE_PID:?}"; else printf "%%0"; fi',
      '    ;;',
      '  split-window) printf "%%1" ;;',
      'esac',
      'exit 0',
      '',
    ].join('\n'),
    0o755,
  );

  function writeCodex(filePath, label, loginLine = 'Logged in fixture') {
    write(
      filePath,
      [
        '#!/usr/bin/env bash',
        'if [[ " $* " == *" login status "* ]]; then',
        `  printf "%s\\0" ${shellQuote(label)} "$@" >> "\${SGSD_TEST_HEALTH_MARKER:?}"`,
        `  echo ${shellQuote(loginLine)}`,
        '  exit 0',
        'fi',
        `printf "%s\\0" ${shellQuote(label)} "$@" >> "\${SGSD_TEST_PROVIDER_MARKER:?}"`,
        'exit 97',
        '',
      ].join('\n'),
      0o755,
    );
  }

  return {
    ...fixture,
    remote,
    caller,
    incomingBin,
    localBin,
    nvmBin,
    claudeMarker,
    loginMarker,
    healthMarker,
    providerMarker,
    sessionMarker,
    writeCodex,
  };
}

const SELECTOR_NAMES = [
  'SGSD_CODEX_APP_SERVER_COMMAND',
  'SGSD_CODEX_COMMAND',
  'SGSD_CODEX_APP_SERVER_ARGS',
  'SGSD_CODEX_FORCE_LAUNCHER',
];

function selectionEnv(fixture, additions = {}) {
  return {
    PATH: `incoming-bin:${shellPath(fixture.fakeBin)}:/usr/bin:/bin`,
    HOME: shellPath(fixture.home),
    USERPROFILE: shellPath(fixture.home),
    CODEX_HOME: shellPath(path.join(fixture.home, '.codex')),
    SGSD_MODEL_ROUTING_FILE: '',
    SGSD_MODEL_OVERRIDE: '',
    SGSD_MODEL_ORCHESTRATOR: '',
    SGSD_TEST_COCKPIT_MARKER: shellPath(fixture.cockpitMarker),
    SGSD_TEST_TMUX_MARKER: shellPath(fixture.tmuxMarker),
    SGSD_TEST_SESSION_MARKER: shellPath(fixture.sessionMarker),
    SGSD_TEST_CLAUDE_MARKER: shellPath(fixture.claudeMarker),
    SGSD_TEST_LOGIN_MARKER: shellPath(fixture.loginMarker),
    SGSD_TEST_HEALTH_MARKER: shellPath(fixture.healthMarker),
    SGSD_TEST_PROVIDER_MARKER: shellPath(fixture.providerMarker),
    ...additions,
  };
}

function remoteFixtureArgs(fixture, mode = '--shell') {
  return [
    fixture.remote,
    '--project', shellPath(fixture.project),
    '--scripts-dir', shellPath(fixture.scripts),
    '--agents-dir', shellPath(fixture.agents),
    '--source-dir', shellPath(fixture.source),
    '--session', `fixture-${path.basename(fixture.root)}`,
    mode,
    '--no-attach',
  ];
}

function bootFixtureArgs(fixture, ...extra) {
  return [
    path.join(fixture.scripts, 'sgsd-boot.sh'),
    '-NoOpen',
    '--project', shellPath(fixture.project),
    '--scripts-dir', shellPath(fixture.scripts),
    '--agents-dir', shellPath(fixture.agents),
    '--source-dir', shellPath(fixture.source),
    ...extra,
  ];
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
        {
          cwd: fixture.project,
          env: {
            PATH: `${fixture.fakeBin}${path.delimiter}${process.env.PATH}`,
            HOME: shellPath(fixture.home),
            USERPROFILE: shellPath(fixture.home),
          },
          unsetEnv: SELECTOR_NAMES,
        },
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
            HOME: shellPath(fixture.home),
            USERPROFILE: shellPath(fixture.home),
            SGSD_TEST_COCKPIT_MARKER: shellPath(fixture.cockpitMarker),
            SGSD_TEST_TMUX_MARKER: shellPath(fixture.tmuxMarker),
            SGSD_TEST_VENDORED_MARKER: shellPath(fixture.vendoredMarker),
          },
          unsetEnv: SELECTOR_NAMES,
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

  test('selector recovery makes a user-local tmux available after pinning incoming Codex', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, () => {
    const fixture = createSelectionFixture();
    try {
      fixture.writeCodex(path.join(fixture.incomingBin, 'codex'), 'incoming');
      fs.copyFileSync(path.join(fixture.fakeBin, 'tmux'), path.join(fixture.localBin, 'tmux'));
      fs.chmodSync(path.join(fixture.localBin, 'tmux'), 0o755);
      fs.rmSync(path.join(fixture.fakeBin, 'tmux'));
      exposeNativeCommands(fixture.fakeBin, [
        'date', 'dirname', 'env', 'find', 'git', 'head', 'mkdir', 'sed', 'sort', 'tail', 'touch', 'tr',
      ]);

      const result = run(bash, remoteFixtureArgs(fixture, '--greet'), {
        cwd: fixture.caller,
        env: selectionEnv(fixture, { PATH: `incoming-bin:${shellPath(fixture.fakeBin)}` }),
        unsetEnv: SELECTOR_NAMES,
      });

      assert.equal(fs.existsSync(fixture.healthMarker), false);
      assert.equal(fs.existsSync(fixture.providerMarker), false);
      assert.equal(result.status, 0, output(result));
      const session = nulFields(fixture.sessionMarker);
      assert.equal(session[1], path.join(fixture.incomingBin, 'codex'));
      const claudeArgs = nulFields(fixture.claudeMarker).slice(6);
      assert.equal(claudeArgs.length, 4);
      assert.deepEqual(claudeArgs.slice(0, 3), ['--model', 'fable', '--dangerously-skip-permissions']);
      assert.match(claudeArgs[3], /You are the SGSD orchestrator/);
      assert.equal(nulFields(fixture.loginMarker)[0], 'LOGIN');
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('selector-executing provenance fixtures reject inherited environment contamination', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-runtime-parent-contamination-'));
    try {
      const conflictingHome = path.join(root, 'parent-home');
      const providerMarker = path.join(root, 'provider.log');
      write(
        path.join(conflictingHome, '.local', 'bin', 'codex'),
        '#!/bin/bash\nprintf called >> "${SGSD_TEST_PROVIDER_MARKER:?}"\nexit 97\n',
        0o755,
      );
      const result = run(process.execPath, [
        '--test',
        '--test-name-pattern',
        'remote doctor reports only|remote tmux starts cockpit exclusively',
        __filename,
      ], {
        cwd: REPO_ROOT,
        env: {
          HOME: conflictingHome,
          USERPROFILE: conflictingHome,
          SGSD_CODEX_APP_SERVER_COMMAND: './invalid-parent-selector',
          SGSD_CODEX_COMMAND: 'invalid-parent-legacy',
          SGSD_CODEX_APP_SERVER_ARGS: '["parent"]',
          SGSD_CODEX_FORCE_LAUNCHER: 'invalid-parent-force',
          SGSD_TEST_PROVIDER_MARKER: providerMarker,
        },
        unsetEnv: ['NODE_TEST_CONTEXT'],
      });

      assert.equal(result.status, 0, output(result));
      assert.match(result.stdout, /pass 2/);
      assert.equal(fs.existsSync(providerMarker), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('remote tmux pins the original-cwd selector into a stale new session without provider calls', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, () => {
    const fixture = createSelectionFixture();
    try {
      const selected = path.join(fixture.caller, 'relative-codex');
      const legacy = 'legacy selector bytes';
      const prefixArgs = '["alpha beta","quote\\"value"]';
      fixture.writeCodex(selected, 'explicit-app');
      fixture.writeCodex(path.join(fixture.incomingBin, 'codex'), 'incoming');
      fixture.writeCodex(path.join(fixture.localBin, 'codex'), 'local');
      fixture.writeCodex(path.join(fixture.nvmBin, 'codex'), 'nvm');

      const result = run(
        bash,
        [
          fixture.remote,
          '--project', shellPath(fixture.project),
          '--scripts-dir', shellPath(fixture.scripts),
          '--agents-dir', shellPath(fixture.agents),
          '--source-dir', shellPath(fixture.source),
          '--session', 'fixture-selection',
          '--greet',
          '--no-attach',
        ],
        {
          cwd: fixture.caller,
          env: {
            PATH: `incoming-bin:${shellPath(fixture.fakeBin)}:/usr/bin:/bin`,
            HOME: shellPath(fixture.home),
            USERPROFILE: shellPath(fixture.home),
            SGSD_CODEX_APP_SERVER_COMMAND: './relative-codex',
            SGSD_CODEX_COMMAND: legacy,
            SGSD_CODEX_APP_SERVER_ARGS: prefixArgs,
            SGSD_CODEX_FORCE_LAUNCHER: 'direct',
            SGSD_TEST_COCKPIT_MARKER: shellPath(fixture.cockpitMarker),
            SGSD_TEST_TMUX_MARKER: shellPath(fixture.tmuxMarker),
            SGSD_TEST_SESSION_MARKER: shellPath(fixture.sessionMarker),
            SGSD_TEST_CLAUDE_MARKER: shellPath(fixture.claudeMarker),
            SGSD_TEST_LOGIN_MARKER: shellPath(fixture.loginMarker),
            SGSD_TEST_HEALTH_MARKER: shellPath(fixture.healthMarker),
            SGSD_TEST_PROVIDER_MARKER: shellPath(fixture.providerMarker),
            SGSD_TEST_TMUX_STALE: 'true',
            SGSD_TEST_TMUX_STALE_PATH: '/usr/bin:/bin',
          },
        },
      );

      assert.equal(result.status, 0, output(result));
      assert.equal(fs.existsSync(fixture.healthMarker), false);
      assert.equal(fs.existsSync(fixture.providerMarker), false);
      const session = nulFields(fixture.sessionMarker);
      assert.equal(session[0], 'SESSION');
      assert.equal(session[1], selected);
      assert.equal(session[2], legacy);
      assert.equal(session[3], prefixArgs);
      assert.equal(session[4], 'direct');
      assert.equal(session[6], fixture.project);
      assert.match(session[5], new RegExp(`${fixture.fakeBin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

      const claude = nulFields(fixture.claudeMarker);
      assert.deepEqual(claude.slice(0, 5), ['CLAUDE', selected, legacy, prefixArgs, 'direct']);
      assert.deepEqual(claude.slice(6, 9), ['--model', 'fable', '--dangerously-skip-permissions']);
      assert.match(claude[9], /You are the SGSD orchestrator/);

      const login = nulFields(fixture.loginMarker);
      assert.deepEqual(login.slice(0, 5), ['LOGIN', selected, legacy, prefixArgs, 'direct']);
      assert.equal(login.at(-1), '/login/profile/path');
      const tmuxLog = fs.readFileSync(fixture.tmuxMarker, 'utf8');
      assert.doesNotMatch(tmuxLog, /(?:set-environment|update-environment)/);
      assert.equal((tmuxLog.match(/split-window/g) || []).length, 3);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('remote tmux default selection keeps incoming, local, then NVM precedence', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, () => {
    for (const selectedFrom of ['incoming', 'local', 'nvm']) {
      const fixture = createSelectionFixture();
      try {
        fs.rmSync(path.join(fixture.fakeBin, 'codex'), { force: true });
        if (selectedFrom === 'incoming') {
          fixture.writeCodex(path.join(fixture.incomingBin, 'codex'), 'incoming');
          fixture.writeCodex(path.join(fixture.localBin, 'codex'), 'local');
          fixture.writeCodex(path.join(fixture.nvmBin, 'codex'), 'nvm');
        } else if (selectedFrom === 'local') {
          fixture.writeCodex(path.join(fixture.localBin, 'codex'), 'local');
          fixture.writeCodex(path.join(fixture.nvmBin, 'codex'), 'nvm');
        } else {
          fixture.writeCodex(path.join(fixture.nvmBin, 'codex'), 'nvm');
        }
        const expected = selectedFrom === 'incoming'
          ? path.join(fixture.incomingBin, 'codex')
          : selectedFrom === 'local'
            ? path.join(fixture.localBin, 'codex')
            : path.join(fixture.nvmBin, 'codex');
        const result = run(bash, remoteFixtureArgs(fixture), {
          cwd: fixture.caller,
          env: selectionEnv(fixture, selectedFrom === 'incoming' ? {
            SGSD_CODEX_APP_SERVER_COMMAND: '',
            SGSD_CODEX_COMMAND: '',
          } : {}),
          unsetEnv: selectedFrom === 'incoming'
            ? ['SGSD_CODEX_APP_SERVER_ARGS', 'SGSD_CODEX_FORCE_LAUNCHER']
            : SELECTOR_NAMES,
        });

        assert.equal(result.status, 0, `${selectedFrom}: ${output(result)}`);
        const session = nulFields(fixture.sessionMarker);
        assert.equal(session[1], expected);
        assert.ok(session[5].startsWith(`${fixture.nvmBin}:`), session[5]);
        assert.equal(nulFields(fixture.loginMarker)[1], expected);
        assert.equal(fs.existsSync(fixture.healthMarker), false);
        assert.equal(fs.existsSync(fixture.providerMarker), false);
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
      }
    }
  });

  test('remote tmux accepts absolute and bare explicit selectors without probing them', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, () => {
    const cases = [
      { kind: 'absolute-app', variable: 'SGSD_CODEX_APP_SERVER_COMMAND', command: 'absolute' },
      { kind: 'bare-app', variable: 'SGSD_CODEX_APP_SERVER_COMMAND', command: 'bare-app' },
      { kind: 'bare-legacy', variable: 'SGSD_CODEX_COMMAND', command: 'bare-legacy' },
    ];
    for (const item of cases) {
      const fixture = createSelectionFixture();
      try {
        const executable = item.command === 'absolute'
          ? path.join(fixture.caller, 'absolute-codex')
          : path.join(fixture.incomingBin, item.command);
        fixture.writeCodex(executable, item.kind);
        fixture.writeCodex(path.join(fixture.localBin, 'codex'), 'fallback-local');
        const result = run(bash, remoteFixtureArgs(fixture), {
          cwd: fixture.caller,
          env: selectionEnv(fixture, {
            [item.variable]: item.command === 'absolute' ? shellPath(executable) : item.command,
          }),
          unsetEnv: SELECTOR_NAMES.filter((name) => name !== item.variable),
        });

        assert.equal(result.status, 0, `${item.kind}: ${output(result)}`);
        assert.equal(nulFields(fixture.sessionMarker)[1], executable);
        assert.equal(fs.existsSync(fixture.healthMarker), false);
        assert.equal(fs.existsSync(fixture.providerMarker), false);
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
      }
    }
  });

  test('remote doctor distinguishes invalid explicit selection from a missing default', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, () => {
    const invalid = createSelectionFixture();
    try {
      invalid.writeCodex(path.join(invalid.localBin, 'codex'), 'must-not-fallback');
      const invalidResult = run(bash, [...remoteFixtureArgs(invalid).slice(0, -2), '--doctor'], {
        cwd: invalid.caller,
        env: selectionEnv(invalid, { SGSD_CODEX_APP_SERVER_COMMAND: './missing-explicit' }),
        unsetEnv: SELECTOR_NAMES.slice(1),
      });
      assert.notEqual(invalidResult.status, 0, output(invalidResult));
      assert.match(output(invalidResult), /explicit Codex selector is unavailable/);
      assert.equal(fs.existsSync(invalid.tmuxMarker), false);
      assert.equal(fs.existsSync(invalid.healthMarker), false);
      assert.equal(fs.existsSync(invalid.providerMarker), false);
    } finally {
      fs.rmSync(invalid.root, { recursive: true, force: true, maxRetries: 3 });
    }

    const missing = createSelectionFixture();
    try {
      fs.rmSync(path.join(missing.fakeBin, 'codex'), { force: true });
      const missingResult = run(bash, [...remoteFixtureArgs(missing).slice(0, -2), '--doctor'], {
        cwd: missing.caller,
        env: selectionEnv(missing),
        unsetEnv: SELECTOR_NAMES,
      });
      assert.equal(missingResult.status, 0, output(missingResult));
      assert.match(missingResult.stdout, /\[MISS\] codex \(missing\)/);
      assert.doesNotMatch(missingResult.stdout, /\[OK\]\s+codex:/);
      assert.equal(fs.existsSync(missing.healthMarker), false);
      assert.equal(fs.existsSync(missing.providerMarker), false);
    } finally {
      fs.rmSync(missing.root, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('new tmux sessions preserve FORCE and argument intent while clearing stale absent values', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, () => {
    const forceCases = [
      { name: 'direct', present: true, value: 'direct' },
      { name: 'cmd', present: true, value: 'cmd' },
      { name: 'invalid', present: true, value: 'unexpected-launcher' },
      { name: 'empty', present: true, value: '', argsValue: '' },
      { name: 'absent', present: false, value: '', argsPresent: false },
    ];
    for (const item of forceCases) {
      const fixture = createSelectionFixture();
      try {
        fixture.writeCodex(path.join(fixture.incomingBin, 'codex'), 'incoming');
        const prefixArgs = '["space value","quote\\"value",""]';
        const expectedArgs = item.argsPresent === false ? '' : (item.argsValue ?? prefixArgs);
        const additions = {
          SGSD_TEST_TMUX_STALE: 'true',
          SGSD_TEST_TMUX_STALE_PATH: '/usr/bin:/bin',
        };
        if (item.argsPresent !== false) {
          additions.SGSD_CODEX_APP_SERVER_ARGS = expectedArgs;
        }
        if (item.present) additions.SGSD_CODEX_FORCE_LAUNCHER = item.value;
        const result = run(bash, remoteFixtureArgs(fixture), {
          cwd: fixture.caller,
          env: selectionEnv(fixture, additions),
          unsetEnv: SELECTOR_NAMES.filter((name) =>
            !(item.argsPresent !== false && name === 'SGSD_CODEX_APP_SERVER_ARGS')
              && !(item.present && name === 'SGSD_CODEX_FORCE_LAUNCHER')),
        });

        assert.equal(result.status, 0, `${item.name}: ${output(result)}`);
        const session = nulFields(fixture.sessionMarker);
        assert.equal(session[2], '');
        assert.equal(session[3], expectedArgs);
        assert.equal(session[4], item.value);
        assert.equal(nulFields(fixture.loginMarker)[4], item.value);
        assert.equal(fs.existsSync(fixture.providerMarker), false);
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
      }
    }
  });

  test('remote tmux executes greet and shell directly but refuses fresh auto mode', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, () => {
    for (const mode of ['--greet', '--go', '--shell']) {
      const fixture = createSelectionFixture();
      try {
        fixture.writeCodex(path.join(fixture.incomingBin, 'codex'), 'incoming');
        const result = run(bash, remoteFixtureArgs(fixture, mode), {
          cwd: fixture.caller,
          env: selectionEnv(fixture, { SGSD_TEST_CLAUDE_EXIT: '23', ...(mode === '--shell' ? { SGSD_MODEL_ORCHESTRATOR: 'astral' } : {}) }),
          unsetEnv: SELECTOR_NAMES,
        });
        const claude = nulFields(fixture.claudeMarker);
        if (mode === '--go') {
          assert.notEqual(result.status, 0, output(result));
          assert.match(output(result), /fresh owned sessions start with a briefing/);
          assert.deepEqual(claude, []);
          for (const marker of [fixture.atlasMarker, fixture.sessionMarker, fixture.loginMarker, fixture.cockpitMarker, fixture.providerMarker]) {
            assert.equal(fs.existsSync(marker), false, `${mode}: unexpected ${path.basename(marker)}`);
          }
          assert.doesNotMatch(fs.readFileSync(fixture.tmuxMarker, 'utf8'), /new-session|split-window|attach-session/);
          continue;
        }
        assert.equal(result.status, 0, `${mode}: ${output(result)}`);
        if (mode === '--shell') {
          assert.deepEqual(claude, []);
          assert.equal(fs.existsSync(fixture.atlasMarker), false);
        } else {
          assert.equal(claude[0], 'CLAUDE');
          assert.deepEqual(claude.slice(6, 9), ['--model', 'fable', '--dangerously-skip-permissions']);
          assert.equal(claude.length, 10);
          assert.match(claude[9], /You are the SGSD orchestrator/);
          assert.deepEqual(fs.readFileSync(fixture.atlasMarker, 'utf8').trim().split('\n').map(row => JSON.parse(row).command),
            ['prepare', 'include', 'finish']);
        }
        assert.equal(nulFields(fixture.loginMarker)[0], 'LOGIN');
        const tmuxLog = fs.readFileSync(fixture.tmuxMarker, 'utf8');
        assert.equal((tmuxLog.match(/split-window/g) || []).length, 3);
        assert.doesNotMatch(tmuxLog, /(?:set-environment|update-environment)/);
        assert.equal(fs.existsSync(fixture.providerMarker), false);
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
      }
    }
  });

  test('remote tmux binds supported orchestrator overrides and explicit routing to actual Claude argv', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, () => {
    const cases = ['fable', 'opus', 'sonnet', 'haiku'].map(model => ({ env: { SGSD_MODEL_ORCHESTRATOR: model }, model }));
    cases.push({ env: { SGSD_MODEL_OVERRIDE: 'haiku', SGSD_MODEL_ORCHESTRATOR: 'opus' }, model: 'haiku' });
    cases.push({ explicitFile: true, model: 'sonnet' });
    for (const item of cases) {
      const fixture = createSelectionFixture();
      try {
        const settings = path.join(fixture.home, '.claude', 'settings.json');
        write(settings, '{"model":"opus[1m]"}\n');
        const additions = { ...item.env };
        if (item.explicitFile) {
          const config = JSON.parse(fs.readFileSync(path.join(fixture.source, 'super-gsd/config/model-routing.json'), 'utf8'));
          config.model_routing.orchestrator.default = item.model;
          additions.SGSD_MODEL_ROUTING_FILE = path.join(fixture.root, 'explicit routing.json');
          write(additions.SGSD_MODEL_ROUTING_FILE, JSON.stringify(config));
        }
        const result = run(bash, remoteFixtureArgs(fixture, '--greet'), {
          cwd: fixture.caller, env: selectionEnv(fixture, additions), unsetEnv: SELECTOR_NAMES,
        });
        assert.equal(result.status, 0, output(result));
        const claudeArgs = nulFields(fixture.claudeMarker).slice(6);
        assert.equal(claudeArgs.length, 4);
        assert.deepEqual(claudeArgs.slice(0, 3), ['--model', item.model, '--dangerously-skip-permissions']);
        assert.match(claudeArgs[3], /You are the SGSD orchestrator/);
        assert.equal(fs.readFileSync(settings, 'utf8'), '{"model":"opus[1m]"}\n');
        assert.equal(fs.existsSync(fixture.providerMarker), false);
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
      }
    }
  });

  test('remote tmux rejects invalid or non-Anthropic orchestrators before cockpit, tmux, or Claude', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, () => {
    for (const mode of ['--greet', '--go']) for (const kind of ['non-anthropic', 'unknown', 'malformed', 'missing', 'invalid-slug']) {
      const fixture = createSelectionFixture();
      try {
        const additions = {};
        const file = path.join(fixture.source, 'super-gsd/config/model-routing.json');
        if (kind === 'non-anthropic') additions.SGSD_MODEL_ORCHESTRATOR = 'astral';
        if (kind === 'unknown') additions.SGSD_MODEL_ORCHESTRATOR = 'not-a-model';
        if (kind === 'malformed') write(file, '{');
        if (kind === 'missing') additions.SGSD_MODEL_ROUTING_FILE = path.join(fixture.root, 'missing.json');
        if (kind === 'invalid-slug') {
          const config = JSON.parse(fs.readFileSync(file, 'utf8'));
          config.models.fable.model = 'fable; touch unexpected';
          write(file, JSON.stringify(config));
        }
        const result = run(bash, remoteFixtureArgs(fixture, mode), {
          cwd: fixture.caller, env: selectionEnv(fixture, additions), unsetEnv: SELECTOR_NAMES,
        });
        assert.notEqual(result.status, 0, `${mode} ${kind}: ${output(result)}`);
        assert.match(output(result), /orchestrator/i);
        for (const marker of [fixture.cockpitMarker, fixture.tmuxMarker, fixture.claudeMarker, fixture.providerMarker]) {
          assert.equal(fs.existsSync(marker), false, `${kind}: unexpected ${path.basename(marker)}`);
        }
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
      }
    }
  });

  test('remote tmux verifies a live owned session before read-only reuse', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, async () => {
    const fixture = createSelectionFixture();
    let child;
    try {
      fixture.writeCodex(path.join(fixture.incomingBin, 'codex'), 'incoming');
      const atlasDir = path.join(fixture.source, 'super-gsd/tools/telemetry-atlas');
      for (const name of ['fleet.cjs', 'global-store.cjs', 'quota-sampler.cjs', 'contract.cjs', 'accounting.cjs']) {
        fs.copyFileSync(path.join(REPO_ROOT, 'super-gsd/tools/telemetry-atlas', name), path.join(atlasDir, name));
      }
      const fleet = require(path.join(atlasDir, 'fleet.cjs'));
      const fleetRoot = path.join(fixture.root, 'atlas');
      const registration = require(path.join(atlasDir, 'global-store.cjs')).registerRun({ root: fleetRoot, projectDir: fixture.project });
      fleet.reserve({ root: fleetRoot, run: registration });
      // A real, non-model child supplies PID/start/env evidence. The test runner
      // is the pane ancestor, so reuse must actually traverse /proc ancestry.
      child = spawn(process.execPath, ['-e', 'process.stdout.write("ready\\n");process.stdin.resume()'], {
        env: { ...process.env, SGSD_RUN_ID: registration.run_id, SGSD_ATLAS_PROJECT_ID: registration.project_id },
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      await new Promise((resolve, reject) => { child.stdout.once('data', resolve); child.once('error', reject); });
      fleet.bind({ root: fleetRoot, runId: registration.run_id, projectDir: fixture.project, pid: child.pid,
        sessionId: 'fixture-existing-session', tmux: { pane_id: '%0' } });
      const claimFile = path.join(fleetRoot, 'fleet/claims', `${registration.project_id}.json`);
      const before = fs.readFileSync(claimFile);
      assert.equal(fleet.status({ root: fleetRoot, projectDir: fixture.project }).claims[0].active, true);
      const result = run(bash, remoteFixtureArgs(fixture).slice(0, -1), {
        cwd: fixture.caller,
        env: selectionEnv(fixture, { SGSD_TEST_TMUX_EXISTING: 'true', SGSD_TEST_TMUX_PANE_PID: String(process.pid),
          SGSD_ATLAS_GLOBAL_ROOT: fleetRoot }),
        unsetEnv: SELECTOR_NAMES,
      });
      assert.equal(result.status, 0, output(result));
      assert.match(result.stdout, /verified owned tmux session/);
      assert.deepEqual(fs.readFileSync(claimFile), before);
      assert.equal(fs.existsSync(fixture.atlasMarker), false, 'reuse must not prepare or finish another run');
      assert.equal(fs.existsSync(fixture.sessionMarker), false);
      assert.equal(fs.existsSync(fixture.claudeMarker), false);
      assert.equal(fs.existsSync(fixture.loginMarker), false);
      const tmuxLog = fs.readFileSync(fixture.tmuxMarker, 'utf8');
      assert.match(tmuxLog, /has-session/);
      assert.equal((tmuxLog.match(/display-message/g) || []).length, 2);
      assert.match(tmuxLog, /attach-session/);
      assert.doesNotMatch(tmuxLog, /(?:new-session|split-window|set-environment|update-environment)/);
      assert.equal(fs.existsSync(fixture.providerMarker), false);
    } finally {
      if (child) {
        const ended = new Promise(resolve => child.once('close', resolve));
        child.stdin.end();
        await ended;
      }
      fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('boot preflight checks auth with the selected executable and exact prefix arguments', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, () => {
    const fixture = createSelectionFixture();
    try {
      const selected = path.join(fixture.caller, 'relative-boot-codex');
      const prefixArgs = '["space value","quote\\"value",""]';
      fixture.writeCodex(selected, 'boot-selected');
      fixture.writeCodex(path.join(fixture.localBin, 'codex'), 'must-not-fallback');
      const result = run(bash, bootFixtureArgs(fixture), {
        cwd: fixture.caller,
        env: selectionEnv(fixture, {
          SGSD_CODEX_APP_SERVER_COMMAND: './relative-boot-codex',
          SGSD_CODEX_APP_SERVER_ARGS: prefixArgs,
        }),
        unsetEnv: ['SGSD_CODEX_COMMAND', 'SGSD_CODEX_FORCE_LAUNCHER'],
      });
      assert.equal(result.status, 0, output(result));
      assert.deepEqual(nulFields(fixture.healthMarker), [
        'boot-selected', 'space value', 'quote"value', '', 'login', 'status',
      ]);
      assert.equal(fs.existsSync(fixture.providerMarker), false);
      assert.match(output(result), new RegExp(`Codex CLI available \\(${selected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`));
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
    }
  });

  test('boot preserves missing, invalid-explicit, auth, help, and skip-preflight exits', {
    skip: process.platform === 'win32' ? 'native Linux selection contract' : false,
  }, () => {
    const missing = createSelectionFixture();
    try {
      fs.rmSync(path.join(missing.fakeBin, 'codex'), { force: true });
      const result = run(bash, bootFixtureArgs(missing), {
        cwd: missing.caller,
        env: selectionEnv(missing),
        unsetEnv: SELECTOR_NAMES,
      });
      assert.equal(result.status, 7, output(result));
      assert.match(output(result), /Codex CLI missing from PATH/);
      assert.equal(fs.existsSync(missing.healthMarker), false);
      assert.equal(fs.existsSync(missing.providerMarker), false);
    } finally {
      fs.rmSync(missing.root, { recursive: true, force: true, maxRetries: 3 });
    }

    const invalid = createSelectionFixture();
    try {
      invalid.writeCodex(path.join(invalid.localBin, 'codex'), 'must-not-fallback');
      const result = run(bash, bootFixtureArgs(invalid), {
        cwd: invalid.caller,
        env: selectionEnv(invalid, { SGSD_CODEX_APP_SERVER_COMMAND: './missing-explicit' }),
        unsetEnv: SELECTOR_NAMES.slice(1),
      });
      assert.equal(result.status, 7, output(result));
      assert.match(output(result), /explicit selector unavailable/);
      assert.equal(fs.existsSync(invalid.healthMarker), false);
      assert.equal(fs.existsSync(invalid.providerMarker), false);
    } finally {
      fs.rmSync(invalid.root, { recursive: true, force: true, maxRetries: 3 });
    }

    const unauthenticated = createSelectionFixture();
    try {
      const selected = path.join(unauthenticated.incomingBin, 'codex');
      unauthenticated.writeCodex(selected, 'unauthenticated', 'Not logged in fixture');
      const result = run(bash, bootFixtureArgs(unauthenticated), {
        cwd: unauthenticated.caller,
        env: selectionEnv(unauthenticated),
        unsetEnv: SELECTOR_NAMES,
      });
      assert.equal(result.status, 8, output(result));
      assert.deepEqual(nulFields(unauthenticated.healthMarker), ['unauthenticated', 'login', 'status']);
      assert.equal(fs.existsSync(unauthenticated.providerMarker), false);
    } finally {
      fs.rmSync(unauthenticated.root, { recursive: true, force: true, maxRetries: 3 });
    }

    for (const mode of ['--help', '--skip-preflight']) {
      const fixture = createSelectionFixture();
      try {
        const args = mode === '--help'
          ? [path.join(fixture.scripts, 'sgsd-boot.sh'), '--help']
          : bootFixtureArgs(fixture, '--skip-preflight');
        const result = run(bash, args, {
          cwd: fixture.caller,
          env: selectionEnv(fixture, { SGSD_CODEX_APP_SERVER_COMMAND: './missing-explicit' }),
          unsetEnv: SELECTOR_NAMES.slice(1),
        });
        assert.equal(result.status, 0, `${mode}: ${output(result)}`);
        assert.equal(fs.existsSync(fixture.healthMarker), false);
        assert.equal(fs.existsSync(fixture.providerMarker), false);
      } finally {
        fs.rmSync(fixture.root, { recursive: true, force: true, maxRetries: 3 });
      }
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

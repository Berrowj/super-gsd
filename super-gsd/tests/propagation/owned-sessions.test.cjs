'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../../..');
const bash = process.platform === 'win32'
  ? path.join(os.homedir(), 'AppData/Local/Programs/Git/bin/bash.exe') : '/bin/bash';
function write(file, bytes) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes, { mode: 0o755 }); }
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-owned-session-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, 'project with spaces'), source = path.join(root, 'source'), bin = path.join(root, 'bin');
  fs.mkdirSync(path.join(project, '.planning'), { recursive: true });
  fs.mkdirSync(path.join(root, 'agents'));
  const scripts = path.join(source, 'super-gsd/scripts');
  for (const relative of ['scripts/sgsd-remote-tmux.sh', 'scripts/lib/codex-worker-shell.sh', 'scripts/lib/model-routing.cjs', 'config/model-routing.json'])
    write(path.join(source, 'super-gsd', relative), fs.readFileSync(path.join(repo, 'super-gsd', relative)));
  write(path.join(source, 'super-gsd/tools/telemetry-atlas/global.cjs'), `
if(process.argv[2]==='prepare') {
  if(process.env.FIXTURE_CAPTURE==='off') { console.log('env CLAUDE_CODE_ENABLE_TELEMETRY=0'); process.exitCode=1; }
  else console.log("env SGSD_RUN_ID='sgsd-fixture' SGSD_FLEET_MANAGED='1' CLAUDE_CODE_ENABLE_TELEMETRY='1'");
}
`);
  write(path.join(scripts, 'start-cockpit-server.sh'), '#!/usr/bin/env bash\nexit 0\n');
  write(path.join(source, 'super-gsd/tools/telemetry-atlas/monitor-schedule.cjs'), 'process.exitCode = process.env.FIXTURE_MONITOR_OFF === "1" ? 1 : 0;\n');
  write(path.join(bin, 'claude'), '#!/usr/bin/env bash\nprintf "%s\\n" "${SGSD_RUN_ID:-UNREGISTERED}" "$@" >> "$FIXTURE_PROVIDER_LOG"\n');
  write(path.join(bin, 'codex'), '#!/usr/bin/env bash\necho "codex-cli fixture"\n');
  write(path.join(bin, 'tmux'), `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$FIXTURE_TMUX_LOG"
case "$1" in
  has-session) [[ "$FIXTURE_EXISTING" == 1 ]] ;;
  new-session) [[ "$FIXTURE_FAIL_CREATE" != 1 ]] ;;
  display-message) echo '%0' ;;
  split-window) echo '%1' ;;
  *) exit 0 ;;
esac
`);
  const git = args => { const result = spawnSync('git', args, { cwd: source, encoding: 'utf8', windowsHide: true }); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
  git(['init', '-q']); git(['add', '.']);
  git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture']);
  write(path.join(project, '.super-gsd-version'), git(['rev-parse', 'HEAD']));
  return { root, project, source, scripts, bin,
    launch(args = [], extra = {}) {
      return spawnSync(bash, [path.join(scripts, 'sgsd-remote-tmux.sh').replaceAll('\\', '/'),
        '--source-dir', source, '--scripts-dir', scripts, '--agents-dir', path.join(root, 'agents'), ...args], {
        cwd: project, encoding: 'utf8', windowsHide: true, timeout: 20000,
        env: { ...process.env, HOME: root, SGSD_PROJECT_DIR: '', SGSD_TMUX_SESSION: '', SGSD_RUN_ID: '',
          SGSD_CODEX_APP_SERVER_COMMAND: path.join(bin, 'codex').replaceAll('\\', '/'),
          PATH: `${bin}${path.delimiter}${process.env.PATH}`, FIXTURE_PROVIDER_LOG: path.join(root, 'provider.log'),
          FIXTURE_TMUX_LOG: path.join(root, 'tmux.log'), ...extra }
      });
    }, read(name) { try { return fs.readFileSync(path.join(root, name), 'utf8'); } catch { return ''; } }
  };
}
const supported = fs.existsSync(bash);
test('Linux orchestrator attachment refuses disabled capture despite failed or misleading uname', { skip: process.platform !== 'linux' }, () => {
  const helper=path.join(repo,'super-gsd/scripts/lib/atlas-shell.sh');
  for(const fake of ['return 127', 'echo Darwin']) {
    const result=spawnSync(bash,['-c',`source "$ATLAS_TEST_HELPER"\nuname() { ${fake}; }\nsgsd_atlas_attach orchestrator anthropic "$PWD" && printf PROVIDER_STARTED`],{
      encoding:'utf8',timeout:5000,env:{...process.env,PATH:`${path.dirname(process.execPath)}:${process.env.PATH}`,
        ATLAS_TEST_HELPER:helper,SGSD_ATLAS_DISABLED:'1'}});
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.doesNotMatch(result.stdout,/PROVIDER_STARTED/);
  }
});
test('unknown Node platform cannot authorize an orchestrator launch', { skip: !supported }, () => {
  const helper=path.join(repo,'super-gsd/scripts/lib/atlas-shell.sh').replaceAll('\\','/');
  for(const fake of ['return 127','echo unexpected']) {
    const result=spawnSync(bash,['-c',`source "$ATLAS_TEST_HELPER"\nuname() { echo Darwin; }\nnode() { ${fake}; }\nsgsd_atlas_attach orchestrator anthropic "$PWD" && printf PROVIDER_STARTED`],{
      encoding:'utf8',timeout:5000,windowsHide:true,env:{...process.env,ATLAS_TEST_HELPER:helper,SGSD_ATLAS_DISABLED:'1'}});
    assert.equal(result.status,1,result.stdout+result.stderr);
    assert.doesNotMatch(result.stdout,/PROVIDER_STARTED/);
  }
});
test('headless provider failure still executes the owned-run finish seam', { skip: !supported }, () => {
  const source=fs.readFileSync(path.join(repo,'super-gsd/scripts/sgsd-headless.sh'),'utf8');
  const block=source.match(/^\s*(?:if )?claude --print[\s\S]*?(?=\n  END_TIME=)/m)?.[0];
  assert.ok(block,'actual provider/finish seam must remain identifiable');
  const script='set -e\nclaude() { return 7; }\nsgsd_atlas_finish() { printf finished; }\nLOGFILE=/dev/null\nPROMPT=fixture\n'+block;
  const result=spawnSync(bash,['-c',script],{encoding:'utf8',windowsHide:true,timeout:5000});
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout,'finished');
});
test('default workspace is caller project, not a hard-coded main checkout', { skip: !supported }, t => {
  const f = fixture(t), result = f.launch(['--doctor']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /project with spaces/);
  assert.doesNotMatch(result.stdout, /session: +clarity-sgsd/);
});
test('caller workspace wins over inherited project environment', { skip: !supported }, t => {
  const f = fixture(t), old = path.join(f.root, 'old-project');
  fs.mkdirSync(path.join(old, '.planning'), { recursive: true });
  const result = f.launch(['--doctor'], { SGSD_PROJECT_DIR: old });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /project: +[^\n]*project with spaces/);
});
test('unavailable managed capture prevents tmux/provider launch', { skip: !supported }, t => {
  const f = fixture(t), result = f.launch(['--project', f.project, '--no-attach'], { FIXTURE_CAPTURE: 'off' });
  assert.notEqual(result.status, 0, result.stdout);
  assert.doesNotMatch(f.read('tmux.log'), /new-session/);
  assert.equal(f.read('provider.log'), '');
});
test('existing unverified tmux name is refused without attach or reset', { skip: !supported }, t => {
  const f = fixture(t), result = f.launch(['--project', f.project, '--session', 'another-project', '--no-attach'], { FIXTURE_EXISTING: '1' });
  assert.notEqual(result.status, 0, result.stdout);
  assert.doesNotMatch(f.read('tmux.log'), /attach-session|kill-session|new-session/);
});
test('failed tmux creation is not reported as a started session', { skip: !supported }, t => {
  const f = fixture(t), result = f.launch(['--project', f.project, '--no-attach'], { FIXTURE_FAIL_CREATE: '1' });
  assert.notEqual(result.status, 0, result.stdout);
  assert.doesNotMatch(result.stdout, /tmux session started/);
});
test('direct sg path runs configured Claude in current terminal with prepared run', { skip: !supported }, t => {
  const f = fixture(t), result = f.launch(['--current-terminal', '--no-cockpit']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(f.read('provider.log'), /^sgsd-fixture\n--model\nfable\n/);
  assert.equal(f.read('tmux.log'), '');
});
test('monitor enrollment failure prevents provider launch', { skip: !supported }, t => {
  const f = fixture(t), result = f.launch(['--current-terminal', '--no-cockpit'], { FIXTURE_MONITOR_OFF: '1' });
  assert.notEqual(result.status, 0);
  assert.equal(f.read('provider.log'), '');
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const exec = promisify(require('node:child_process').execFile);
const { startGlobal } = require('./global.cjs');
const scripts = path.resolve(__dirname, '../../scripts');
function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-launch 'quoted'-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const project = path.join(temp, 'project'); fs.mkdirSync(path.join(project, '.planning'), { recursive: true });
  return { root: path.join(temp, 'global'), project };
}
const baseEnv = root => ({ ...process.env, SGSD_ATLAS_GLOBAL_ROOT: root, SGSD_RUN_ID: 'old-wrong-project',
  OTEL_LOG_RAW_API_BODIES: '1', OTEL_EXPORTER_OTLP_HEADERS: 'private-secret',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'https://example.invalid', SGSD_ATLAS_CODEX_EXPORTER: 'old-exporter' });
const psQuote = value => "'" + value.replace(/'/g, "''") + "'";
const shQuote = value => "'" + value.replace(/'/g, "'\"'\"'") + "'";

test('PowerShell launch applies a fresh run then restores the interactive parent', { skip: process.platform !== 'win32' }, async t => {
  const f = fixture(t), server = await startGlobal({ root: f.root }); t.after(() => server.close());
  const script = `. ${psQuote(path.join(scripts, 'lib/atlas-powershell.ps1'))}; $saved = Start-SgsdAtlas -ProjectDir ${psQuote(f.project)}; $active = $env:SGSD_RUN_ID; $raw = $env:OTEL_LOG_RAW_API_BODIES; $headers = $env:OTEL_EXPORTER_OTLP_HEADERS; Restore-SgsdAtlas -Saved $saved; @{active=$active; restored=$env:SGSD_RUN_ID; raw=$raw; headers=$headers} | ConvertTo-Json -Compress`;
  const result = await exec('powershell.exe', ['-NoProfile', '-Command', script], { env: baseEnv(f.root), timeout: 15000, windowsHide: true });
  const output = JSON.parse(result.stdout);
  assert.match(output.active, /^sgsd-/); assert.notEqual(output.active, 'old-wrong-project');
  assert.equal(output.restored, 'old-wrong-project'); assert.equal(output.raw, '0'); assert.ok(!output.headers);
  assert.ok(fs.existsSync(path.join(f.root, 'runs', output.active, 'exit.json')));
});

test('PowerShell bootstrap failure clears inherited telemetry without blocking launch', { skip: process.platform !== 'win32' }, async t => {
  const f = fixture(t);
  const script = `$WarningPreference='SilentlyContinue'; . ${psQuote(path.join(scripts, 'lib/atlas-powershell.ps1'))}; function node { throw 'fixture bootstrap failure' }; $saved = Start-SgsdAtlas -ProjectDir ${psQuote(f.project)}; @{enabled=$env:CLAUDE_CODE_ENABLE_TELEMETRY; run=$env:SGSD_RUN_ID; headers=$env:OTEL_EXPORTER_OTLP_HEADERS; exporter=$env:SGSD_ATLAS_CODEX_EXPORTER} | ConvertTo-Json -Compress`;
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-Command', script], { env: baseEnv(f.root), timeout: 10000, windowsHide: true });
  const output = JSON.parse(stdout); assert.equal(output.enabled, '0'); assert.ok(!output.run); assert.ok(!output.headers); assert.ok(!output.exporter);
});

test('generated sg shortcut keeps Claude in the calling process and preserves launch argv', { skip: process.platform !== 'win32' }, async t => {
  const f = fixture(t), server = await startGlobal({ root: f.root }); t.after(() => server.close());
  // Evaluate only the installer's function-block literal, never its profile writer.
  const script = `$source = Get-Content -Raw -LiteralPath ${psQuote(path.join(scripts, 'Install-SgsdShortcut.ps1'))};
$ast = [System.Management.Automation.Language.Parser]::ParseInput($source, [ref]$null, [ref]$null);
$assignment = $ast.Find({param($n) $n -is [System.Management.Automation.Language.AssignmentStatementAst] -and $n.Left.Extent.Text -eq '$functionBlock'}, $true);
$BootScript = ${psQuote(path.join(scripts, 'sgsd-boot.ps1'))}; $InstallRoot = ${psQuote(path.resolve(scripts, '../..'))}; $StartMarker = '# fixture'; $EndMarker = '# fixture end';
$body = & ([scriptblock]::Create($assignment.Right.Extent.Text)); . ([scriptblock]::Create($body));
function claude { $script:observed = @{pid=$PID; run=$env:SGSD_RUN_ID; argv=@($args); exporter=$env:OTEL_EXPORTER_OTLP_LOGS_ENDPOINT}; $global:LASTEXITCODE=23 }
$callerPid = $PID; sg -NoCockpit -Go -ProjectDir ${psQuote(f.project)};
@{callerPid=$callerPid; observed=$script:observed; restored=$env:SGSD_RUN_ID; exitCode=$global:LASTEXITCODE} | ConvertTo-Json -Compress -Depth 5`;
  const { stdout } = await exec('powershell.exe', ['-NoProfile', '-Command', script], { env: baseEnv(f.root), timeout: 15000, windowsHide: true });
  const output = JSON.parse(stdout);
  assert.equal(output.observed.pid, output.callerPid);
  assert.deepEqual(output.observed.argv, ['--dangerously-skip-permissions', 'go']);
  assert.notEqual(output.observed.run, 'old-wrong-project');
  assert.ok(output.observed.exporter.includes('/runs/' + output.observed.run + '/v1/logs'));
  assert.equal(output.restored, 'old-wrong-project'); assert.equal(output.exitCode, 23);
});

test('Bash child attachment preserves model argv and creates fresh scoped telemetry', { skip: process.platform === 'win32' }, async t => {
  const f = fixture(t), server = await startGlobal({ root: f.root }); t.after(() => server.close());
  const code = 'process.stdout.write(JSON.stringify({run:process.env.SGSD_RUN_ID,raw:process.env.OTEL_LOG_RAW_API_BODIES,headers:process.env.OTEL_EXPORTER_OTLP_HEADERS,args:process.argv.slice(1)}))';
  const script = `source ${shQuote(path.join(scripts, 'lib/atlas-shell.sh'))}\nsgsd_atlas_attach board openai ${shQuote(f.project)}\nsgsd_atlas_codex_args\nnode -e ${shQuote(code)} -- --model gpt-6-astra "\${SGSD_ATLAS_CODEX_ARGS[@]}"\nsgsd_atlas_finish`;
  const result = await exec('bash', ['-c', script], { env: baseEnv(f.root), timeout: 15000 });
  const output = JSON.parse(result.stdout); assert.match(output.run, /^sgsd-/); assert.equal(output.raw, '0'); assert.ok(!output.headers);
  assert.deepEqual(output.args.slice(0, 2), ['--model', 'gpt-6-astra']);
  assert.ok(output.args.some(value => value.includes('/runs/' + output.run + '/v1/logs')));
  assert.ok(fs.existsSync(path.join(f.root, 'runs', output.run, 'exit.json')));
});

test('Bash failed or disabled attachment overrides inherited native exporters to none', { skip: process.platform === 'win32' }, async t => {
  const f = fixture(t);
  for (const fail of [true, false]) {
    const script = `source ${shQuote(path.join(scripts, 'lib/atlas-shell.sh'))}\n${fail ? 'node() { return 0; }' : 'export SGSD_ATLAS_DISABLED=1'}\nsgsd_atlas_attach executor openai ${shQuote(f.project)}\nsgsd_atlas_codex_args\nprintf '%s\\n' "$CLAUDE_CODE_ENABLE_TELEMETRY" "\${SGSD_RUN_ID:-}" "\${OTEL_EXPORTER_OTLP_HEADERS:-}" "\${SGSD_ATLAS_CODEX_ARGS[@]}"`;
    const { stdout } = await exec('bash', ['-c', script], { env: baseEnv(f.root), timeout: 10000 });
    assert.ok(stdout.startsWith('0\n\n\n')); assert.ok(stdout.includes('otel.exporter="none"')); assert.ok(!stdout.includes('old-exporter'));
  }
});

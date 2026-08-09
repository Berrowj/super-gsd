#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../../..");
const windowsHelper = path.join(root, "super-gsd", "scripts", "sgsd-local-restart-evidence.ps1");
const devcpHelper = path.join(root, "super-gsd", "scripts", "sgsd-devcp-restart-evidence.sh");
const cockpitStart = path.join(root, "super-gsd", "scripts", "start-cockpit-server.sh");

function required(filePath) {
  assert.equal(fs.existsSync(filePath), true, `required artifact is missing: ${path.relative(root, filePath)}`);
  return fs.readFileSync(filePath, "utf8");
}

function requirePatterns(source, patterns) {
  for (const pattern of patterns) assert.match(source, pattern);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    input: options.input,
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
}

function findBash() {
  if (process.platform !== "win32") {
    const result = run("sh", ["-c", "command -v bash"]);
    return result.status === 0 ? result.stdout.trim() : null;
  }
  const result = run("where.exe", ["bash.exe"]);
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).map((entry) => entry.trim()).find((entry) =>
    entry && !/[\\/](?:System32|WindowsApps)[\\/]/i.test(entry),
  ) || null;
}

function write(filePath, contents, mode) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
  if (mode !== undefined) fs.chmodSync(filePath, mode);
}

function extractEvidenceBuilder(source) {
  return [...source.matchAll(/node <<'NODE'\r?\n([\s\S]*?)\r?\nNODE/g)]
    .map((match) => match[1])
    .find((body) => body.includes("const evidence ="));
}

test("local helper exposes the approved Prepare/Finalize API", () => {
  const source = required(windowsHelper);
  requirePatterns(source, [
    /ValidateSet\(['"]Prepare['"],\s*['"]Finalize['"]\)/,
    /\$Mode/, /\$Project/, /\$ExpectedMcpRoot/, /\$EvidencePath/,
    /sgsd\.restart-evidence\.v1/, /Prepare/i, /Finalize/i,
  ]);
  assert.doesNotMatch(source, /exit=0/);
});

test("local Prepare requires matching MCP, displays command lines, and changes cockpit identity", () => {
  const source = required(windowsHelper);
  requirePatterns(source, [
    /Win32_Process/, /CreationDate/, /CommandLine/, /MCP/i,
    /Count\s+-lt\s+1|Count\s+-eq\s+0/, /Write-Host[^\n]*(?:CommandLine|command_line)|command_line[^\n]*Write-Host/i,
    /Read-Host[^\n]*KILL|KILL[^\n]*Read-Host/i, /Stop-Process/,
    /cockpit-server\.pid/, /cockpit-sidecar[\\/]serve\.cjs/,
    /sgsd-refresh/, /SkipPreflight/, /cockpit_identity_changed/,
    /live_at_write/i, /exact_command/i, /captured_utc/i, /machine/i,
    /exit_status/i, /redacted_output/i,
  ]);
});

test("local Finalize rejects prior MCP identity and requires canonical live provenance", () => {
  const source = required(windowsHelper);
  requirePatterns(source, [
    /identity_intersection/, /canonical_mcp_provenance/, /after_identities_live/,
    /ExpectedMcpRoot/, /mcp/i, /CreationDate/, /Get-CimInstance|Get-Process/,
    /throw|exit\s+[1-9]/,
  ]);
});

test("devcp helper exposes the approved one-shot API and authoritative runtime flags", () => {
  const source = required(devcpHelper);
  requirePatterns(source, [
    /--project/, /--session/, /--scripts-dir/, /--agents-dir/, /--source-dir/, /--evidence/,
    /sgsd-remote-tmux\.sh/, /--reset/, /--greet/, /--no-attach/,
    /sgsd\.restart-evidence\.v1/,
  ]);
  assert.doesNotMatch(source, /exit=0/);
});

test("devcp helper captures Linux MCP, cockpit, and full tmux identities", () => {
  const source = required(devcpHelper);
  requirePatterns(source, [
    /\/proc\/[^\n]*stat/, /start_ticks/, /cmdline/, /MCP/i,
    /mcp_count[^\n]*(?:-lt 1|-eq 0)|(?:-lt 1|-eq 0)[^\n]*mcp_count/i,
    /printf[^\n]*(?:cmdline|command_line)|(?:cmdline|command_line)[^\n]*printf/i,
    /read[^\n]*KILL|KILL[^\n]*read/i, /kill -0/,
    /cockpit-server\.pid/, /cockpit_identity_changed/,
    /tmux/, /session_id/, /creation_epoch/, /server_pid/,
    /tmux_session_identity_changed/, /tmux_server_pid_changed/,
    /identity_intersection/, /canonical_mcp_provenance/, /after_identities_live/,
    /exact_command/, /captured_utc/, /machine/, /exit_status/, /redacted_output/,
    /canonical_cockpit_provenance/,
    /source_dir\/super-gsd\/tools\/cockpit-sidecar\/serve\.cjs/,
  ]);
});

test("devcp source encodes the exact AC-150d field names", () => {
  const source = required(devcpHelper);
  requirePatterns(source, [
    /exit:\s*0/, /devcp_mcp:\s*mcp/, /devcp_cockpit:\s*cockpit/, /devcp_tmux:\s*tmux/,
    /session_created:/, /session_pid:/,
  ]);
  assert.doesNotMatch(source, /components:\s*\{\s*mcp_restart:/,
    "legacy nested restart component schema must not be emitted");
});

test("cockpit startup resolves serve.cjs from the canonical source override", () => {
  const source = required(cockpitStart);
  requirePatterns(source, [
    /SGSD_SOURCE_DIR/, /SOURCE_DIR/, /super-gsd\/tools\/cockpit-sidecar\/serve\.cjs/,
    /canonical_cockpit_pid/, /\/proc\/\$pid\/cmdline/,
    /read -r -d '' arg/, /previous[^\n]*--port[^\n]*arg[^\n]*candidate/,
    /previous[^\n]*--workspace[^\n]*arg[^\n]*WORKSPACE/,
    /arg[^\n]*SERVE_SCRIPT/,
    /existing_snapshot[^\n]*existing_pid[^\n]*canonical_cockpit_pid/,
  ]);
  assert.doesNotMatch(source, /cmdline[^\n]*==[^\n]*\*"\$(?:SERVE_SCRIPT|WORKSPACE|candidate)"\*/,
    "canonical cockpit identity must compare argv exactly, not by substring");
  assert.doesNotMatch(source, /SERVE_SCRIPT="\$WORKSPACE\/super-gsd\/tools\/cockpit-sidecar\/serve\.cjs"/);
});

test("local helper retains its machine-readable component evidence", () => {
  const source = required(windowsHelper);
  requirePatterns(source, [
    /components/, /mcp_restart/, /cockpit_restart/, /exit_status/,
    /before_mcp_present/, /after_mcp_present/, /identity_intersection/,
    /canonical_mcp_provenance/, /after_identities_live/,
  ]);
});

test("devcp evidence builder emits the exact AC-150d consumer shape", (t) => {
  const source = required(devcpHelper);
  const builder = extractEvidenceBuilder(source);
  assert.ok(builder, "could not extract the committed devcp evidence builder");

  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-devcp-evidence-"));
  try {
    const beforeMcp = path.join(fixture, "before-mcp.jsonl");
    const afterMcp = path.join(fixture, "after-mcp.jsonl");
    const beforeCockpit = path.join(fixture, "before-cockpit.json");
    const afterCockpit = path.join(fixture, "after-cockpit.json");
    const outputPath = path.join(fixture, "evidence.json");
    write(beforeMcp, JSON.stringify({ pid: 11, start_ticks: "101", command_line: "/canonical/source mcp" }) + "\n");
    write(afterMcp, JSON.stringify({ pid: 12, start_ticks: "102", command_line: "/canonical/source mcp" }) + "\n");
    write(beforeCockpit, JSON.stringify({ pid: 21, start_ticks: "201", command_line: "/vendored/cockpit-sidecar/serve.cjs --workspace /project" }) + "\n");
    write(afterCockpit, JSON.stringify({ pid: 22, start_ticks: "202", command_line: "/canonical/source/super-gsd/tools/cockpit-sidecar/serve.cjs --workspace /project" }) + "\n");

    const result = run(process.execPath, ["-e", builder], { env: {
      SGSD_SCHEMA: "sgsd.restart-evidence.v1",
      SGSD_PROJECT: "/project",
      SGSD_SESSION: "clarity-sgsd",
      SGSD_SOURCE_DIR: "/canonical/source",
      SGSD_EXACT_COMMAND: "sgsd-remote-tmux.sh --reset",
      SGSD_CAPTURED_UTC: "2026-08-09T00:00:00Z",
      SGSD_MACHINE: "devcp-fixture",
      SGSD_OUTPUT: "redacted",
      SGSD_BEFORE_MCP: beforeMcp,
      SGSD_AFTER_MCP: afterMcp,
      SGSD_BEFORE_COCKPIT: beforeCockpit,
      SGSD_AFTER_COCKPIT: afterCockpit,
      SGSD_IDENTITY_INTERSECTION: "[]",
      SGSD_COCKPIT_CHANGED: "true",
      SGSD_TMUX_SESSION_CHANGED: "true",
      SGSD_TMUX_SERVER_CHANGED: "true",
      SGSD_BEFORE_SESSION_ID: "$1",
      SGSD_BEFORE_CREATION: "1001",
      SGSD_BEFORE_SERVER_PID: "31",
      SGSD_AFTER_SESSION_ID: "$2",
      SGSD_AFTER_CREATION: "1002",
      SGSD_AFTER_SERVER_PID: "32",
      SGSD_EVIDENCE_TEMP: outputPath,
    } });
    if (result.error?.code === "EPERM") return t.skip("managed runner blocks Node fixture execution");
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const evidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(evidence.components, undefined, "legacy nested component names must not survive");
    for (const name of ["devcp_mcp", "devcp_cockpit", "devcp_tmux"]) {
      assert.equal(Object.hasOwn(evidence, name), true, `missing AC-150d field: ${name}`);
      assert.equal(evidence[name].exit, 0, `${name}.exit must be numeric zero`);
      assert.ok(evidence[name].before, `${name}.before is required`);
      assert.ok(evidence[name].after, `${name}.after is required`);
    }
    assert.deepEqual(evidence.devcp_tmux.before, {
      session_id: "$1", session_created: 1001, session_pid: 31,
    });
    assert.deepEqual(evidence.devcp_tmux.after, {
      session_id: "$2", session_created: 1002, session_pid: 32,
    });
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("cockpit startup executes the canonical source sidecar, never the vendored fixture", (t) => {
  const bash = findBash();
  if (!bash) return t.skip("bash is unavailable or blocked by the managed runner");

  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-canonical-cockpit-"));
  try {
    const workspace = path.join(fixture, "project");
    const source = path.join(fixture, "source");
    const canonicalMarker = path.join(fixture, "canonical.log");
    const vendoredMarker = path.join(fixture, "vendored.log");
    const vendoredServe = path.join(workspace, "super-gsd", "tools", "cockpit-sidecar", "serve.cjs");
    const canonicalServe = path.join(source, "super-gsd", "tools", "cockpit-sidecar", "serve.cjs");
    fs.mkdirSync(path.join(workspace, ".planning"), { recursive: true });
    write(vendoredServe, "require('node:fs').writeFileSync(process.env.SGSD_TEST_VENDORED_MARKER, 'vendored'); process.exit(97);\n");
    write(canonicalServe, [
      "const fs = require('node:fs');",
      "const http = require('node:http');",
      "const args = process.argv.slice(2);",
      "const port = Number(args[args.indexOf('--port') + 1]);",
      "fs.writeFileSync(process.env.SGSD_TEST_CANONICAL_MARKER, 'canonical');",
      "const server = http.createServer((req, res) => {",
      "  res.setHeader('content-type', 'application/json');",
      "  res.end(JSON.stringify({ milestone: 'fixture', phase: '150' }));",
      "});",
      "server.listen(port, '127.0.0.1');",
      "setTimeout(() => server.close(() => process.exit(0)), 1000);",
      "",
    ].join("\n"));
    const port = 41000 + (process.pid % 10000);
    const result = run(bash, [cockpitStart.replaceAll("\\", "/"),
      "--workspace", workspace.replaceAll("\\", "/"), "--port", String(port)], { env: {
      SGSD_SOURCE_DIR: source.replaceAll("\\", "/"),
      SGSD_TEST_CANONICAL_MARKER: canonicalMarker.replaceAll("\\", "/"),
      SGSD_TEST_VENDORED_MARKER: vendoredMarker.replaceAll("\\", "/"),
    } });
    if (result.error?.code === "EPERM") return t.skip("managed runner blocks bash fixtures");
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(fs.readFileSync(canonicalMarker, "utf8"), "canonical");
    assert.equal(fs.existsSync(vendoredMarker), false, "vendored sidecar was executed");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1200);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

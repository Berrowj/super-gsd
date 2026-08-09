#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../../..");
const windowsHelper = path.join(root, "super-gsd", "scripts", "sgsd-local-restart-evidence.ps1");
const devcpHelper = path.join(root, "super-gsd", "scripts", "sgsd-devcp-restart-evidence.sh");

function required(filePath) {
  assert.equal(fs.existsSync(filePath), true, `required artifact is missing: ${path.relative(root, filePath)}`);
  return fs.readFileSync(filePath, "utf8");
}

function requirePatterns(source, patterns) {
  for (const pattern of patterns) assert.match(source, pattern);
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
  ]);
});

test("both helpers encode every AC-150d component result as machine-readable JSON", () => {
  for (const source of [required(windowsHelper), required(devcpHelper)]) {
    requirePatterns(source, [
      /components/, /mcp_restart/, /cockpit_restart/, /exit_status/,
      /before_mcp_present/, /after_mcp_present/, /identity_intersection/,
      /canonical_mcp_provenance/, /after_identities_live/,
    ]);
  }
});

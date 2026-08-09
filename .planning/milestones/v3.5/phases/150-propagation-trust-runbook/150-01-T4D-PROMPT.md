# P150-T150-04d — CONTINUE: 8 reds; failing test bodies inlined below ARE the spec

Your sandbox cannot run node --test, so previous rounds partially satisfied assertions. This prompt inlines the COMPLETE SOURCE of each failing test. Satisfy every assertion literally. 8 failing tests: runbook 2,3,4; snapshot 3,5; restart-evidence 4,5,6. Files to modify: PROPAGATION.md, DEVCP-RECONCILIATION.md (in .planning/milestones/v3.5/phases/150-propagation-trust-runbook/), sgsd-global-snapshot.sh, sgsd-devcp-restart-evidence.sh, sgsd-local-restart-evidence.ps1 (in super-gsd/scripts/). Do not modify the tests.

## runbook-contract.test.cjs (full source)
```js
#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../../..");
const phaseDir = path.join(root, ".planning", "milestones", "v3.5", "phases", "150-propagation-trust-runbook");
const propagationPath = path.join(phaseDir, "PROPAGATION.md");
const reconciliationPath = path.join(phaseDir, "DEVCP-RECONCILIATION.md");

function requiredFile(filePath) {
  assert.equal(fs.existsSync(filePath), true, `required artifact is missing: ${path.relative(root, filePath)}`);
  return fs.readFileSync(filePath, "utf8");
}

function requireAll(text, needles, label) {
  for (const needle of needles) {
    const pattern = needle instanceof RegExp
      ? needle
      : new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    assert.match(text, pattern, `${label} must contain ${needle}`);
  }
}

function fencedBlocks(markdown, language) {
  const blocks = [];
  const pattern = new RegExp("```" + language + "\\s*\\n([\\s\\S]*?)\\n```", "gi");
  for (const match of markdown.matchAll(pattern)) blocks.push(match[1]);
  return blocks;
}

test("PROPAGATION documents the complete reload and reboot matrix", () => {
  const text = requiredFile(propagationPath);
  requireAll(text, [
    "Live", /next session/i, /new process/i, /reboot/i, /hook bod(?:y|ies)/i,
    /skills.*agents.*settings|agents.*skills.*settings/i,
    /registr(?:y|ies).*singleton|singleton.*registr/i, /\. \$PROFILE/,
    /Claude settings.*hooks|hooks.*Claude settings/i, /MCP/i, /cockpit/i, /tmux/i,
    /PID.*CreationDate|CreationDate.*PID/i, /start_ticks/,
    /session ID.*creation epoch.*server PID|server PID.*creation epoch.*session ID/i,
  ], "PROPAGATION.md");
  const tableRows = text.split(/\r?\n/).filter((line) => line.startsWith("|") && !/^\|\s*[-:]+/.test(line));
  assert.ok(tableRows.length >= 9, "reload matrix must be a Markdown table with all runtime layers");
  assert.match(text, /reboot[^\n|]*(?:not required|No)|(?:not required|No)[^\n|]*reboot/i,
    "matrix must explicitly say when reboot is not required");
});

test("PROPAGATION commands use real flags, guarded paths, and safe SSH forms", () => {
  const text = requiredFile(propagationPath);
  requireAll(text, [
    "super-gsd/install.sh --update --install-global",
    "super-gsd/scripts/Install-SgsdShortcut.ps1 -Force", "sgsd-update.ps1", "sgsd-update.sh",
    "sgsd -NoOpen", "--no-open", "sgsd-refresh -SkipPreflight",
    "super-gsd/tools/codex-hooks/install-hooks.cjs",
    "super-gsd/tools/codex-hooks/self-test.cjs",
    "super-gsd/tools/codex-hooks/block-forbidden-write.cjs", "sgsd-remote-tmux.sh",
    "--scripts-dir", "--agents-dir", "--source-dir", "--reset", "--greet",
    "git status --porcelain", "git worktree", "junction",
    "node super-gsd/tools/codex-hooks/install-hooks.cjs --project",
  ], "PROPAGATION.md");

  const powershell = fencedBlocks(text, "powershell").join("\n");
  assert.ok(powershell.length > 0, "runbook must identify PowerShell commands with fenced blocks");
  assert.doesNotMatch(powershell, /ssh\s+devcp\s+"/i,
    "PowerShell must not pass Bash as a double-quoted ssh command");
  assert.doesNotMatch(powershell, /\\["'$]|\\\$\(|\\\)/,
    "PowerShell must not backslash-escape Bash quotes, dollars, or command substitution");
  for (const line of powershell.split(/\r?\n/).filter((entry) => /ssh\s+(?:-t\s+)?devcp/i.test(entry))) {
    assert.match(line, /@'|bash\s+[^\s]*sgsd-[A-Za-z0-9._-]+\.sh|tmux\s+attach/i,
      `PowerShell ssh must use a single-quoted here-string or named remote script: ${line}`);
  }
  assert.doesNotMatch(text, /<[^>]*(?:path|dir|sha|machine|repo|output)[^>]*>/i,
    "operator commands must not contain unresolved placeholder paths");
  assert.match(text, /T150-05/i);
  assert.match(text, /T150-06/i);
  assert.match(text, /T150-07/i);
  assert.match(text, /do not execute|operator-present/i);
});

test("PROPAGATION specifies trust evidence, worktree behavior, capture, and exact rollback", () => {
  const text = requiredFile(propagationPath);
  requireAll(text, [
    /probe ID/i, /ledger (?:byte )?offset/i, /UTC start/i, /Codex exit status/i,
    /forbidden-file absence/i, /appended bytes/i, /block-forbidden-write/i,
    /decision.*block|block.*decision/i, /reason.*forbidden_path|forbidden_path.*reason/i,
    /failed candidate/i, /archive/i, /rollback/i, /exact pre-install manifest/i,
    /junction-backed repos receive target changes/i, /pushing master does not move/i,
    /clean-state check/i, /merge\/rebase/i, /never install (?:from )?a stale worktree/i,
    /exact command/i, /machine/i, /redacted output/i,
  ], "PROPAGATION.md");
  requireAll(text, [
    "~/.claude/agents", "~/.claude/commands", "~/.claude/hooks", "~/.claude/settings.json",
    "~/.claude/get-shit-done/templates/super-gsd", "~/.claude/get-shit-done/workflows",
    "~/.claude/get-shit-done/config/model-routing.json", "~/.claude/super-gsd/scripts",
    "~/.local/bin/sgsd",
  ], "PROPAGATION.md");
  assert.match(text, /original archive/i);
});

test("DEVCP reconciliation records every non-destructive decision", () => {
  const text = requiredFile(reconciliationPath);
  requireAll(text, [
    /883[- ]commit/i, /never (?:rewrite|push)/i, /devcp-fork-backup-2026-08-05/,
    /reviewed patches/i, /clean origin\/master-based branch/i, /generic operator identity/i,
    /validate canonical source origin/i, /complete global mutation boundary/i,
    /pre-install path set.*subset.*post-install/i, /extra-file set/i, /byte-identical/i,
    /bootstrap/i, /\/sgsd-update/, /board-runner\.cjs/, /execution-authority\.sh/,
    /concurrency-policy\.cjs/, /decision-registry\.cjs/, /43-file/i, /non-deleting/i,
    /shadow/i, /guarded fast-forward/i, /SHA/i, /smoke/i, /hooks/i, /model pin/i,
    /manifest/i, /tmux.*cockpit.*MCP|MCP.*cockpit.*tmux/i,
    /\/opt\/clarity\/project-clarity-erp\/super-gsd/, /outside framework propagation/i,
  ], "DEVCP-RECONCILIATION.md");
});

test("phase docs contain no forbidden bypass, fork push, or destructive reset", () => {
  const texts = [requiredFile(propagationPath), requiredFile(reconciliationPath)].join("\n");
  assert.doesNotMatch(texts, /dangerously-bypass-hook-trust/i);
  assert.doesNotMatch(texts, /git\s+push[^\n]*GSDedits/i);
  assert.doesNotMatch(texts, /reset\s+--hard/i);
});
```

## global-snapshot-contract.test.cjs (full source)
```js
#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../../..");
const helper = path.join(root, "super-gsd", "scripts", "sgsd-global-snapshot.sh");
const installer = path.join(root, "super-gsd", "install.sh");
const expectedTargets = Object.freeze([
  ".claude/agents",
  ".claude/commands",
  ".claude/hooks",
  ".claude/settings.json",
  ".claude/get-shit-done/templates/super-gsd",
  ".claude/get-shit-done/workflows",
  ".claude/get-shit-done/config/model-routing.json",
  ".claude/super-gsd/scripts",
  ".local/bin/sgsd",
]);

function text(filePath) {
  assert.equal(fs.existsSync(filePath), true, `required artifact is missing: ${path.relative(root, filePath)}`);
  return fs.readFileSync(filePath, "utf8");
}

function bashAvailability() {
  for (const name of process.platform === "win32" ? ["bash.exe", "bash"] : ["bash"]) {
    const result = spawnSync(name, ["-lc", "printf SGSD_BASH_READY"], { encoding: "utf8" });
    if (result.status === 0 && result.stdout === "SGSD_BASH_READY") return name;
  }
  return null;
}

function sha(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function manifest(home) {
  const rows = [];
  function walk(fullPath, relativePath) {
    const stat = fs.lstatSync(fullPath);
    const type = stat.isSymbolicLink() ? "symlink" : stat.isDirectory() ? "directory" : "file";
    rows.push({
      path: relativePath.replaceAll(path.sep, "/"), type, mode: stat.mode & 0o7777,
      link: type === "symlink" ? fs.readlinkSync(fullPath) : null,
      sha256: type === "file" ? sha(fullPath) : null,
    });
    if (type === "directory") {
      for (const name of fs.readdirSync(fullPath).sort()) walk(path.join(fullPath, name), path.join(relativePath, name));
    }
  }
  for (const target of expectedTargets) {
    const fullPath = path.join(home, ...target.split("/"));
    try { walk(fullPath, target); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      rows.push({ path: target, type: "absent", mode: null, link: null, sha256: null });
    }
  }
  return rows;
}

function write(filePath, contents, mode = 0o644) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
  fs.chmodSync(filePath, mode);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", ...options });
}

test("snapshot helper owns and checks the exact current install-global target list", () => {
  const installText = text(installer);
  const helperText = text(helper);
  for (const target of expectedTargets) {
    assert.match(helperText, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `helper target missing: ${target}`);
  }
  assert.match(helperText, /contract mismatch/i);
  assert.match(helperText, /install\.sh/);
  assert.match(helperText, /create.*verify.*restore/s);
  for (const evidence of [
    /AGENTS_DIR="\$CLAUDE_DIR\/agents"/, /COMMANDS_DIR="\$CLAUDE_DIR\/commands"/,
    /HOOKS_DIR="\$CLAUDE_DIR\/hooks"/, /SETTINGS_FILE="\$CLAUDE_DIR\/settings\.json"/,
    /TEMPLATES_DIR="\$GSD_DIR\/templates\/super-gsd"/, /"\$GSD_DIR\/workflows/,
    /"\$GSD_DIR\/config\/model-routing\.json"/, /GLOBAL_SCRIPTS_DIR="\$CLAUDE_DIR\/super-gsd\/scripts"/,
    /"\$LOCAL_BIN_DIR\/sgsd"/,
  ]) assert.match(installText, evidence);
});

test("snapshot helper has bounded validation and non-destructive restore guards", () => {
  const source = text(helper);
  for (const token of [
    "--home", "--output-dir", "--snapshot-dir", "--failed-candidate-dir",
    "manifest-before.jsonl", "manifest-after.jsonl", "archive.tar", "failed-candidate",
  ]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(source, /readlink|realpath/);
  assert.match(source, /archive.*(?:exist|readable)|(?:exist|readable).*archive/is);
  assert.match(source, /pre-install.*subset|subset.*pre-install/is);
  assert.match(source, /extra.*byte|byte.*extra/is);
  assert.doesNotMatch(source, /rm\s+-rf\s+['"]?\$(?:HOME|home)/);
});

test("snapshot round trip preserves exact pre-install manifest and quarantines candidate", { timeout: 120_000 }, (t) => {
  const bash = bashAvailability();
  if (!bash) return t.skip("bash is unavailable or blocked by the managed runner");
  text(helper);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-snapshot-contract-"));
  const home = path.join(temp, "home");
  const snapshot = path.join(temp, "reconciliation");
  const failed = path.join(temp, "failed-candidate");
  fs.mkdirSync(home, { recursive: true });
  const fixtures = {
    ".claude/agents/custom-agent.md": "legacy agent\n",
    ".claude/commands/custom-command/SKILL.md": "custom command\n",
    ".claude/hooks/custom-hook.js": "custom hook\n",
    ".claude/settings.json": "{\"custom\":true}\n",
    ".claude/get-shit-done/templates/super-gsd/custom-template.md": "custom template\n",
    ".claude/get-shit-done/workflows/custom-workflow.md": "custom workflow\n",
    ".claude/get-shit-done/config/model-routing.json": "{\"model\":\"legacy\"}\n",
    ".claude/super-gsd/scripts/custom-extra.sh": "#!/bin/sh\necho extra\n",
    ".claude/super-gsd/scripts/lib/custom-extra.cjs": "module.exports = 43;\n",
    ".local/bin/sgsd": "#!/bin/sh\necho legacy\n",
    ".claude/commands/sgsd-brv-setup/legacy.txt": "legacy BRV command\n",
    ".claude/hooks/brv-query-local.js": "legacy BRV hook\n",
    ".claude/hooks/brv-curate-local.js": "legacy BRV hook 2\n",
    ".claude/get-shit-done/templates/super-gsd/brv-seed/seed.txt": "legacy BRV seed\n",
    ".claude/get-shit-done/templates/super-gsd/executor-brv-overlay.xml": "legacy\n",
    ".claude/get-shit-done/templates/super-gsd/planner-brv-overlay.xml": "legacy\n",
    ".claude/get-shit-done/templates/super-gsd/verifier-brv-overlay.xml": "legacy\n",
    ".claude/get-shit-done/templates/super-gsd/overwatcher/brv-query-local.js": "legacy\n",
    ".claude/get-shit-done/templates/super-gsd/overwatcher/brv-curate-local.js": "legacy\n",
  };
  for (const [relative, contents] of Object.entries(fixtures)) {
    write(path.join(home, ...relative.split("/")), contents,
      relative.endsWith(".sh") || relative === ".local/bin/sgsd" ? 0o755 : 0o640);
  }
  write(path.join(home, ".claude/super-gsd/source/super-gsd/scripts/canonical.sh"), "#!/bin/sh\n", 0o755);
  write(path.join(home, ".claude/super-gsd/scripts/canonical.sh"), "#!/bin/sh\n", 0o755);
  fs.symlinkSync("custom-extra.sh", path.join(home, ".claude/super-gsd/scripts/custom-link"));

  const before = manifest(home);
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const created = run(bash, [helper, "create", "--home", home, "--output-dir", snapshot], { env });
  assert.equal(created.status, 0, `create failed\nstdout=${created.stdout}\nstderr=${created.stderr}`);
  const installed = run(bash, [installer, "--install-global"], { cwd: root, env });
  assert.equal(installed.status, 0, `actual installer failed\nstdout=${installed.stdout}\nstderr=${installed.stderr}`);
  const verified = run(bash, [helper, "verify", "--home", home, "--snapshot-dir", snapshot], { env });
  assert.equal(verified.status, 0, `verify failed\nstdout=${verified.stdout}\nstderr=${verified.stderr}`);

  fs.unlinkSync(path.join(home, ".claude/super-gsd/scripts/custom-extra.sh"));
  const missingExtra = run(bash, [helper, "verify", "--home", home, "--snapshot-dir", snapshot], { env });
  assert.notEqual(missingExtra.status, 0, "verify must reject a silently lost pre-install scripts extra");
  for (const target of expectedTargets) {
    const full = path.join(home, ...target.split("/"));
    if (fs.existsSync(full) && fs.lstatSync(full).isDirectory()) write(path.join(full, "candidate-added.txt"), `candidate ${target}\n`);
    else write(full, `candidate ${target}\n`, 0o600);
  }
  const restored = run(bash, [helper, "restore", "--home", home, "--snapshot-dir", snapshot, "--failed-candidate-dir", failed], { env });
  assert.equal(restored.status, 0, `restore failed\nstdout=${restored.stdout}\nstderr=${restored.stderr}`);
  assert.deepEqual(manifest(home), before, "restore must reproduce exact pre-install type/path/mode/link/SHA");
  assert.equal(fs.existsSync(path.join(snapshot, "archive.tar")), true, "original archive must remain readable");
  assert.ok(fs.readdirSync(failed).length > 0, "failed candidate must remain readable and non-empty");
});

test("restore keeps a target that was absent before install absent", { timeout: 30_000 }, (t) => {
  const bash = bashAvailability();
  if (!bash) return t.skip("bash is unavailable or blocked by the managed runner");
  text(helper);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-snapshot-absent-"));
  const home = path.join(temp, "home");
  const snapshot = path.join(temp, "snapshot");
  const failed = path.join(temp, "failed");
  fs.mkdirSync(path.join(home, ".claude/get-shit-done"), { recursive: true });
  fs.mkdirSync(path.join(home, ".claude/super-gsd/source/super-gsd/scripts"), { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  assert.equal(run(bash, [helper, "create", "--home", home, "--output-dir", snapshot], { env }).status, 0);
  write(path.join(home, ".local/bin/sgsd"), "candidate\n", 0o755);
  assert.equal(run(bash, [helper, "restore", "--home", home, "--snapshot-dir", snapshot, "--failed-candidate-dir", failed], { env }).status, 0);
  assert.equal(fs.existsSync(path.join(home, ".local/bin/sgsd")), false);
  assert.equal(fs.existsSync(path.join(failed, "targets/.local/bin/sgsd")), true);
});

test("unsafe homes and an installer contract mismatch fail closed", { timeout: 30_000 }, (t) => {
  const bash = bashAvailability();
  if (!bash) return t.skip("bash is unavailable or blocked by the managed runner");
  text(helper);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-snapshot-guards-"));
  const home = path.join(temp, "home");
  fs.mkdirSync(home, { recursive: true });
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  for (const unsafe of ["", "/", "~", path.join(temp, "other-home")]) {
    const result = run(bash, [helper, "create", "--home", unsafe, "--output-dir", path.join(temp, `out-${Math.random()}`)], { env });
    assert.notEqual(result.status, 0, `unsafe home must fail: ${JSON.stringify(unsafe)}`);
  }
  const fixtureRoot = path.join(temp, "fixture", "super-gsd");
  fs.mkdirSync(path.join(fixtureRoot, "scripts"), { recursive: true });
  fs.copyFileSync(helper, path.join(fixtureRoot, "scripts", "sgsd-global-snapshot.sh"));
  fs.writeFileSync(path.join(fixtureRoot, "install.sh"), fs.readFileSync(installer, "utf8").replaceAll("$LOCAL_BIN_DIR/sgsd", "$LOCAL_BIN_DIR/renamed"));
  const mismatch = run(bash, [path.join(fixtureRoot, "scripts", "sgsd-global-snapshot.sh"), "create", "--home", home, "--output-dir", path.join(temp, "mismatch")], { env });
  assert.notEqual(mismatch.status, 0, "helper must fail when install.sh mutation targets differ");
  assert.match(`${mismatch.stdout}\n${mismatch.stderr}`, /contract mismatch/i);
});
```

## restart-evidence-contract.test.cjs (full source)
```js
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
```

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS

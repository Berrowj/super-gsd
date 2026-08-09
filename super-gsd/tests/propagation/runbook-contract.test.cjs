#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "../../..");
const phaseDir = path.join(root, ".planning", "milestones", "v3.5", "phases", "150-propagation-trust-runbook");
const propagationPath = path.join(phaseDir, "PROPAGATION.md");
const reconciliationPath = path.join(phaseDir, "DEVCP-RECONCILIATION.md");
const attributesPath = path.join(root, ".gitattributes");

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

function section(markdown, heading, nextHeading) {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const end = markdown.indexOf(nextHeading, start + heading.length);
  assert.notEqual(end, -1, `missing section boundary: ${nextHeading}`);
  return markdown.slice(start, end);
}

function assertOrdered(text, needles, label) {
  let cursor = -1;
  for (const needle of needles) {
    const next = text.indexOf(needle, cursor + 1);
    assert.ok(next > cursor, `${label} must execute ${needle} after the prior step`);
    cursor = next;
  }
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

function findPowerShell() {
  for (const command of process.platform === "win32"
    ? ["pwsh.exe", "powershell.exe"]
    : ["pwsh"]) {
    const result = run(command, ["-NoProfile", "-Command", "exit 0"]);
    if (result.status === 0) return command;
  }
  return null;
}

function write(filePath, contents, mode) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
  if (mode !== undefined) fs.chmodSync(filePath, mode);
}

function shellPath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function powershellLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
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

test("T150-05 executes the locked publication ceremony in guarded order", () => {
  const text = requiredFile(propagationPath);
  const flow = section(text, "## Local propagation", "## Worktrees");
  const blocks = fencedBlocks(flow, "powershell");
  assert.equal(blocks.length, 1, "T150-05 must be one fail-closed PowerShell ceremony");
  assertOrdered(blocks[0], [
    "$p150Repo = (git rev-parse --show-toplevel).Trim()",
    "$p150FeatureBranch = (git branch --show-current).Trim()",
    "$p150FeatureSha = (git rev-parse HEAD).Trim()",
    "$p150AllowedOrigins = @(",
    "$p150RemoteUrl = (git remote get-url origin).Trim()",
    "$p150RemotePushUrl = (git remote get-url --push origin).Trim()",
    "if (-not $p150FeatureBranch -or $p150FeatureBranch -eq 'master')",
    "$p150AllowedOrigins -cnotcontains $p150RemoteUrl",
    "$p150AllowedOrigins -cnotcontains $p150RemotePushUrl",
    "git status --porcelain=v1",
    "git fetch origin master",
    "git merge-base --is-ancestor origin/master $p150FeatureSha",
    "git log --format='%H|%an|%ae|%cn|%ce' \"origin/master..$p150FeatureSha\"",
    "$p150AllowedIdentity",
    "git diff --check origin/master...$p150FeatureSha",
    "super-gsd/tests/propagation/restart-evidence-contract.test.cjs",
    "git -C $p150LocalRepo branch --show-current",
    "git -C $p150LocalRepo remote get-url origin",
    "git -C $p150LocalRepo status --porcelain=v1",
    "git -C $p150LocalRepo fetch origin master",
    "git -C $p150LocalRepo merge-base --is-ancestor",
    "Read-Host 'Coordinate users of the local master worktree, then type FAST-FORWARD",
    "git -C $p150LocalRepo merge --ff-only $p150FeatureSha",
    "bash ./super-gsd/install.sh --update --install-global",
    "super-gsd/tools/feature-propagation/audit.cjs",
    "git worktree add --detach $p150PublishStage origin/master",
    "git -C $p150PublishStage merge --ff-only $p150FeatureSha",
    "git -C $p150PublishStage remote get-url --push origin",
    "$p150AllowedOrigins -cnotcontains $p150PublishPushUrl",
    "git -C $p150PublishStage push origin HEAD:master",
    "git fetch origin master",
    "$p150PublishedSha = (git rev-parse origin/master).Trim()",
  ], "T150-05");
});

test("T150-05 accepts only exact canonical fetch and push origins", () => {
  const text = requiredFile(propagationPath);
  const flow = section(text, "## Local propagation", "## Worktrees");
  const ceremony = fencedBlocks(flow, "powershell")[0];
  const allowlistMatch = ceremony.match(/\$p150AllowedOrigins\s*=\s*@\(\r?\n([\s\S]*?)\r?\n\)/);
  assert.ok(allowlistMatch, "T150-05 must declare one explicit canonical-origin allowlist");
  const allowedOrigins = [...allowlistMatch[1].matchAll(/^\s*'([^']+)'\s*$/gm)]
    .map((match) => match[1]);
  assert.deepEqual(allowedOrigins, [
    "https://github.com/Berrowj/super-gsd",
    "https://github.com/Berrowj/super-gsd.git",
    "git@github.com:Berrowj/super-gsd",
    "git@github.com:Berrowj/super-gsd.git",
  ]);
  assert.equal(allowedOrigins.includes("https://evil.example/Berrowj/super-gsd.git"), false,
    "an evil host with the canonical path suffix must be rejected");
  requireAll(ceremony, [
    "git remote get-url origin",
    "git remote get-url --push origin",
    "git -C $p150PublishStage remote get-url --push origin",
    "$p150AllowedOrigins -cnotcontains $p150RemoteUrl",
    "$p150AllowedOrigins -cnotcontains $p150RemotePushUrl",
    "$p150AllowedOrigins -cnotcontains $p150PublishPushUrl",
  ], "T150-05 origin validation");
  assert.doesNotMatch(ceremony, /\(\^\|\[:\/\]\)Berrowj\/super-gsd/,
    "canonical-origin validation must not use an ends-with regex");
});

test("T150-06 contains the real offset-bounded Codex trust ceremony", () => {
  const text = requiredFile(propagationPath);
  const flow = section(text, "## Trust ceremony", "## Local restart evidence");
  const ceremony = fencedBlocks(flow, "powershell").find((block) =>
    block.includes("$p150LedgerOffset"),
  );
  assert.ok(ceremony, "T150-06 must contain an executable ledger-offset ceremony");
  assertOrdered(ceremony, [
    "$p150LedgerOffset = if (Test-Path -LiteralPath $p150EventFile)",
    "$p150ProbeStarted = [DateTimeOffset]::UtcNow",
    "$p150Prompt = @\"",
    "codex --ask-for-approval never exec",
    "if ($LASTEXITCODE -ne 0)",
    "if (Test-Path -LiteralPath $p150ForbiddenFile)",
    "$p150Stream.Seek($p150LedgerOffset",
    "$p150AppendedText = $p150Reader.ReadToEnd()",
    "$p150AppendedText -split '\\r?\\n'",
    "$_.hook -eq 'block-forbidden-write'",
    "$_.decision -eq 'block'",
    "$_.reason -eq 'forbidden_path'",
    "$_.path -eq 'secrets/p150-trust-probe.env'",
    "[DateTimeOffset]$_.ts -ge $p150ProbeStarted",
  ], "T150-06 trust ceremony");
  assert.doesNotMatch(ceremony, /node\s+[^\n]*block-forbidden-write\.cjs\s*(?:\r?\n|$)/,
    "the hook must be exercised by Codex, not invoked directly without a payload");
  assert.doesNotMatch(ceremony, /codex\s+exec[\s\S]*--ask-for-approval/,
    "--ask-for-approval is a top-level Codex option and must precede exec");
});

test("documented local trust ceremony executes against an append-only fixture", (t) => {
  const powershell = findPowerShell();
  if (!powershell) return t.skip("PowerShell is unavailable or blocked by the managed runner");

  const text = requiredFile(propagationPath);
  const flow = section(text, "## Trust ceremony", "## Local restart evidence");
  const ceremony = fencedBlocks(flow, "powershell").find((block) =>
    block.includes("$p150LedgerOffset"),
  );
  assert.ok(ceremony, "missing executable trust ceremony");

  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-runbook-trust-"));
  try {
    const userProfile = path.join(fixture, "operator-home");
    const project = path.join(userProfile, "GSDedits");
    const ledger = path.join(project, ".planning", "metrics", "codex-tool-events.jsonl");
    write(ledger, JSON.stringify({
      ts: "2000-01-01T00:00:00.000Z",
      hook: "block-forbidden-write",
      decision: "block",
      reason: "forbidden_path",
      path: "secrets/p150-trust-probe.env",
    }) + "\n");

    const harness = [
      `$env:USERPROFILE = ${powershellLiteral(userProfile)}`,
      "function codex {",
      "  $row = [ordered]@{",
      "    ts = [DateTimeOffset]::UtcNow.ToString('o')",
      "    hook = 'block-forbidden-write'",
      "    decision = 'block'",
      "    reason = 'forbidden_path'",
      "    path = 'secrets/p150-trust-probe.env'",
      "  }",
      "  $row | ConvertTo-Json -Compress | Add-Content -LiteralPath $p150EventFile -Encoding UTF8",
      "  $global:LASTEXITCODE = 0",
      "}",
      ceremony,
      "Write-Output 'CEREMONY_OK'",
    ].join("\n");
    const result = run(powershell, ["-NoProfile", "-Command", "-"], { input: harness });
    if (result.error?.code === "EPERM") return t.skip("managed runner blocks PowerShell fixtures");
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /CEREMONY_OK/);
    assert.equal(fs.existsSync(path.join(project, "secrets", "p150-trust-probe.env")), false);
    assert.equal(fs.readFileSync(ledger, "utf8").trim().split(/\r?\n/).length, 2,
      "fixture must prove one newly appended event rather than reuse history");
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test("documented devcp updater runs from the project fixture", (t) => {
  const bash = findBash();
  if (!bash) return t.skip("bash is unavailable or blocked by the managed runner");

  const text = requiredFile(propagationPath);
  const flow = section(text, "## devcp propagation", "## Evidence capture");
  const block = fencedBlocks(flow, "powershell").find((entry) =>
    entry.includes("$p150RemoteUpdate = @'"),
  );
  assert.ok(block, "T150-07 must define a named remote updater script");
  const scriptMatch = block.match(/\$p150RemoteUpdate\s*=\s*@'\r?\n([\s\S]*?)\r?\n'@/);
  assert.ok(scriptMatch, "could not extract the documented remote updater body");

  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-runbook-update-"));
  try {
    const project = path.join(fixture, "project");
    const source = path.join(fixture, "source");
    const update = path.join(source, "super-gsd", "scripts", "sgsd-update.sh");
    const log = path.join(fixture, "update.log");
    fs.mkdirSync(project, { recursive: true });
    write(update, [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `trap '[[ " $* " == *" --check "* ]] && exit 10' EXIT`,
      "printf '%s|%s\\n' \"$PWD\" \"$*\" >> \"$SGSD_TEST_UPDATE_LOG\"",
      "",
    ].join("\n"), 0o755);
    const result = run(bash, ["-s", "--", shellPath(project), shellPath(source)], {
      input: scriptMatch[1],
      env: { SGSD_TEST_UPDATE_LOG: shellPath(log) },
    });
    if (result.error?.code === "EPERM") return t.skip("managed runner blocks bash fixtures");
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const rows = fs.readFileSync(log, "utf8").trim().split(/\r?\n/);
    assert.equal(rows.length, 2, "documented flow must run check and guarded update");
    const projectTail = `${path.basename(path.dirname(project))}/project`;
    assert.equal(rows.every((row) => row.split("|")[0].replaceAll("\\", "/").endsWith(projectTail)), true,
      `updater ran outside the project cwd: ${rows.join(" ; ")}`);
    assert.match(rows[0], /--check --source/);
    assert.doesNotMatch(rows[1], /--check/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
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

test("published runbook contains no identifiable Windows account path", () => {
  const text = requiredFile(propagationPath);
  assert.doesNotMatch(text, /C:\\Users\\jack\.berrow/i);
  assert.match(text, /\$env:USERPROFILE/);
});

test("repository pins canonical line endings for propagation file types", () => {
  const lines = requiredFile(attributesPath).trim().split(/\r?\n/);
  assert.deepEqual(lines, [
    "*.sh text eol=lf",
    "*.cjs text eol=lf",
    "*.ps1 text eol=crlf",
  ]);
});

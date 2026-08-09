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

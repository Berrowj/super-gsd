#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const HOOK_NAME = "enforce-allowed-files";
const repoRoot = path.resolve(__dirname, "../../..");
const metricsPath = path.resolve(repoRoot, ".planning/metrics/codex-tool-events.jsonl");
const statePath = path.resolve(repoRoot, ".planning/STATE.md");

function usage() {
  return [
    "Usage:",
    "  node enforce-allowed-files.cjs [--help]",
    "  node enforce-allowed-files.cjs --self-test-no-plan-lock",
    "",
    "Reads Codex PreToolUse JSON from stdin: { tool, args }.",
    "For write tools, loads PLAN-LOCKED.md from SGSD_ACTIVE_PLAN_LOCKED or active STATE.md and blocks paths outside allowed_files."
  ].join("\n");
}

function appendDecision(decision) {
  fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
  fs.appendFileSync(metricsPath, `${JSON.stringify(Object.assign({ ts: new Date().toISOString(), hook: HOOK_NAME }, decision))}\n`, "utf8");
}

function readPayload() {
  const input = fs.readFileSync(0, "utf8").trim();
  if (!input) throw new Error("missing stdin JSON payload");
  return JSON.parse(input);
}

function isWriteTool(tool) {
  return /(^|[._-])(write|edit|create|delete|remove|move|rename|apply_patch|patch)([._-]|$)/i.test(String(tool || ""));
}

function normalizeRepoPath(inputPath) {
  if (typeof inputPath !== "string" || inputPath.trim() === "") return null;
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(repoRoot, inputPath);
  let relative = path.relative(repoRoot, resolved).replace(/\\/g, "/");
  if (relative.startsWith("../") || relative === "..") {
    return null;
  }
  return relative.replace(/^\.\//, "");
}

function extractFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  return match ? match[1] : "";
}

function stripQuotes(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function parseInlineList(value) {
  const trimmed = stripQuotes(value);
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(",").map((entry) => stripQuotes(entry)).filter(Boolean);
}

function parseListField(frontmatter, fieldName) {
  const lines = frontmatter.split(/\r?\n/);
  const result = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = new RegExp(`^${fieldName}\\s*:\\s*(.*)$`).exec(line);
    if (!match) continue;

    const inline = parseInlineList(match[1]);
    if (inline) return inline;
    for (let listIndex = index + 1; listIndex < lines.length; listIndex += 1) {
      const listLine = lines[listIndex];
      if (/^\S[^:]*:\s*/.test(listLine)) break;
      const item = /^\s*-\s*(.+?)\s*$/.exec(listLine);
      if (item) result.push(stripQuotes(item[1]));
    }
    return result;
  }
  return result;
}

function parseScalarField(frontmatter, fieldName) {
  const match = new RegExp(`^${fieldName}\\s*:\\s*(.+?)\\s*$`, "m").exec(frontmatter);
  return match ? stripQuotes(match[1]) : null;
}

function resolvePlanLockedFromState() {
  if (!fs.existsSync(statePath)) return null;
  const stateText = fs.readFileSync(statePath, "utf8");
  const frontmatter = extractFrontmatter(stateText);

  const explicit = [
    "active_plan_locked",
    "active_plan_locked_path",
    "plan_locked",
    "plan_locked_path"
  ]
    .map((field) => parseScalarField(frontmatter, field))
    .find(Boolean);
  if (explicit) {
    const explicitPath = path.isAbsolute(explicit)
      ? path.resolve(explicit)
      : path.resolve(repoRoot, explicit);
    if (fs.existsSync(explicitPath)) return explicitPath;
  }

  const bodyMatch = /(?:^|\s)([^\s]+PLAN-LOCKED\.md)(?:\s|$)/.exec(stateText);
  if (bodyMatch) {
    const bodyPath = path.resolve(repoRoot, bodyMatch[1].replace(/\\/g, "/"));
    if (fs.existsSync(bodyPath)) return bodyPath;
  }

  const milestone = parseScalarField(frontmatter, "active_milestone") || parseScalarField(frontmatter, "milestone");
  const phase = parseScalarField(frontmatter, "active_phase") || parseScalarField(frontmatter, "phase");
  if (milestone && phase) {
    const candidate = path.resolve(repoRoot, ".planning/milestones", milestone, "phases", phase, "PLAN-LOCKED.md");
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function activePlanLockedPath() {
  const fromEnv = process.env.SGSD_ACTIVE_PLAN_LOCKED;
  if (fromEnv) {
    const resolved = path.isAbsolute(fromEnv) ? path.resolve(fromEnv) : path.resolve(repoRoot, fromEnv);
    return fs.existsSync(resolved) ? resolved : null;
  }
  return resolvePlanLockedFromState();
}

function loadAllowedFiles(planLockedPath) {
  if (!planLockedPath || !fs.existsSync(planLockedPath)) return [];
  const frontmatter = extractFrontmatter(fs.readFileSync(planLockedPath, "utf8"));
  return parseListField(frontmatter, "allowed_files")
    .map(normalizeRepoPath)
    .filter(Boolean);
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function isAllowed(targetPath, allowedFiles) {
  return allowedFiles.some((allowed) => {
    if (allowed.endsWith("/")) {
      return targetPath.startsWith(allowed);
    }
    if (allowed.includes("*")) {
      return globToRegExp(allowed).test(targetPath);
    }
    return targetPath === allowed;
  });
}

function evaluate(payload) {
  const tool = payload && payload.tool;
  const args = payload && payload.args && typeof payload.args === "object" ? payload.args : {};
  if (!isWriteTool(tool)) {
    return { allow: true, reason: "non_write_tool", tool };
  }

  const targetPath = normalizeRepoPath(args.path || args.file || args.file_path);
  if (!targetPath) {
    return { allow: false, reason: "write_path_ambiguous", tool };
  }

  const planLockedPath = activePlanLockedPath();
  if (!planLockedPath) {
    return { allow: false, reason: "plan_locked_unavailable", tool, path: targetPath };
  }

  const allowedFiles = loadAllowedFiles(planLockedPath);
  if (allowedFiles.length === 0) {
    return { allow: false, reason: "allowed_files_empty_or_unreadable", tool, path: targetPath, plan_locked: path.relative(repoRoot, planLockedPath).replace(/\\/g, "/") };
  }

  if (!isAllowed(targetPath, allowedFiles)) {
    return { allow: false, reason: "path_not_allowed", tool, path: targetPath, plan_locked: path.relative(repoRoot, planLockedPath).replace(/\\/g, "/") };
  }

  return { allow: true, reason: "path_allowed", tool, path: targetPath, plan_locked: path.relative(repoRoot, planLockedPath).replace(/\\/g, "/") };
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(usage());
    return 0;
  }

  if (process.argv.includes("--self-test-no-plan-lock")) {
    const payload = { tool: "write_file", args: { path: "super-gsd/tools/codex-hooks/example.cjs" } };
    const decision = { allow: false, reason: "plan_locked_unavailable", tool: payload.tool, path: payload.args.path };
    appendDecision(Object.assign({}, decision, { decision: "block" }));
    console.error(`[${HOOK_NAME}] blocked: ${decision.reason}`);
    return 1;
  }

  let payload;
  try {
    payload = readPayload();
  } catch (error) {
    appendDecision({ decision: "block", reason: "invalid_payload", error: error.message });
    console.error(`[${HOOK_NAME}] blocked: invalid payload: ${error.message}`);
    return 1;
  }

  const decision = evaluate(payload);
  appendDecision(Object.assign({}, decision, { decision: decision.allow ? "allow" : "block" }));
  if (!decision.allow) {
    console.error(`[${HOOK_NAME}] blocked: ${decision.reason}`);
    return 1;
  }
  return 0;
}

process.exitCode = main();

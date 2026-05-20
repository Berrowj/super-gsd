#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const HOOK_NAME = "block-forbidden-write";
const repoRoot = path.resolve(__dirname, "../../..");
const metricsPath = path.resolve(repoRoot, ".planning/metrics/codex-tool-events.jsonl");
const forbiddenPatterns = [
  ".git/",
  "secrets/",
  "*.env",
  "node_modules/.cache/"
];

function usage() {
  return [
    "Usage:",
    "  node block-forbidden-write.cjs [--help]",
    "  node block-forbidden-write.cjs --self-test-blocked",
    "",
    "Reads Codex PreToolUse JSON from stdin: { tool, args }.",
    "Blocks write tools whose args.path matches the baseline forbidden paths."
  ].join("\n");
}

function appendDecision(decision) {
  fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
  fs.appendFileSync(metricsPath, `${JSON.stringify(Object.assign({ ts: new Date().toISOString(), hook: HOOK_NAME }, decision))}\n`, "utf8");
}

function normalizePath(inputPath) {
  if (typeof inputPath !== "string" || inputPath.trim() === "") return null;
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(repoRoot, inputPath);
  let relative = path.relative(repoRoot, resolved).replace(/\\/g, "/");
  if (relative === "") relative = ".";
  return relative.replace(/^\.\//, "");
}

function isWriteTool(tool) {
  return /(^|[._-])(write|edit|create|delete|remove|move|rename|apply_patch|patch)([._-]|$)/i.test(String(tool || ""));
}

function matchesForbidden(normalizedPath) {
  if (!normalizedPath) return true;
  const normalized = normalizedPath.replace(/\\/g, "/");
  return forbiddenPatterns.some((pattern) => {
    if (pattern === "*.env") {
      return normalized.endsWith(".env") || path.posix.basename(normalized).endsWith(".env");
    }
    const prefix = pattern.replace(/\\/g, "/").replace(/^\.\//, "");
    return normalized === prefix.replace(/\/$/, "") || normalized.startsWith(prefix);
  });
}

function readPayload() {
  const input = fs.readFileSync(0, "utf8").trim();
  if (!input) throw new Error("missing stdin JSON payload");
  return JSON.parse(input);
}

function evaluate(payload) {
  const tool = payload && payload.tool;
  const args = payload && payload.args && typeof payload.args === "object" ? payload.args : {};
  if (!isWriteTool(tool)) {
    return { allow: true, reason: "non_write_tool", tool };
  }

  const targetPath = normalizePath(args.path || args.file || args.file_path);
  if (!targetPath) {
    return { allow: false, reason: "write_path_ambiguous", tool };
  }
  if (matchesForbidden(targetPath)) {
    return { allow: false, reason: "forbidden_path", tool, path: targetPath };
  }
  return { allow: true, reason: "path_not_forbidden", tool, path: targetPath };
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(usage());
    return 0;
  }

  let payload;
  if (process.argv.includes("--self-test-blocked")) {
    payload = { tool: "write_file", args: { path: "secrets/foo.env" } };
  } else {
    try {
      payload = readPayload();
    } catch (error) {
      appendDecision({ decision: "block", reason: "invalid_payload", error: error.message });
      console.error(`[${HOOK_NAME}] blocked: invalid payload: ${error.message}`);
      return 1;
    }
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

#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const HOOK_NAME = "log-tool-event";
const repoRoot = path.resolve(__dirname, "../../..");
const metricsPath = path.resolve(repoRoot, ".planning/metrics/codex-tool-events.jsonl");

function usage() {
  return [
    "Usage:",
    "  node log-tool-event.cjs [--help]",
    "  node log-tool-event.cjs --self-test",
    "",
    "Reads Codex PostToolUse JSON from stdin: { tool, args, result, duration_ms }.",
    "Always appends an observability row and exits 0."
  ].join("\n");
}

function appendRow(row) {
  fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
  fs.appendFileSync(metricsPath, `${JSON.stringify(row)}\n`, "utf8");
}

function readLineCount() {
  if (!fs.existsSync(metricsPath)) return 0;
  const text = fs.readFileSync(metricsPath, "utf8").trim();
  return text ? text.split(/\r?\n/).length : 0;
}

function readPayload() {
  const input = fs.readFileSync(0, "utf8").trim();
  if (!input) throw new Error("missing stdin JSON payload");
  return JSON.parse(input);
}

function summarizeArgs(args) {
  if (!args || typeof args !== "object") return null;
  const keys = Object.keys(args).sort();
  const summary = {};
  for (const key of keys.slice(0, 8)) {
    if (/secret|token|password|key/i.test(key)) {
      summary[key] = "[redacted]";
    } else if (typeof args[key] === "string") {
      summary[key] = args[key].length > 160 ? `${args[key].slice(0, 157)}...` : args[key];
    } else {
      summary[key] = args[key];
    }
  }
  if (keys.length > 8) {
    summary._truncated_keys = keys.length - 8;
  }
  return summary;
}

function resultStatus(result) {
  if (result && typeof result === "object") {
    if (typeof result.status === "string") return result.status;
    if (typeof result.ok === "boolean") return result.ok ? "ok" : "error";
    if (typeof result.exit_code === "number") return result.exit_code === 0 ? "ok" : "error";
  }
  if (typeof result === "string") return "ok";
  return "unknown";
}

function eventRow(payload) {
  return {
    ts: new Date().toISOString(),
    tool: payload && payload.tool ? String(payload.tool) : "unknown",
    args_summary: summarizeArgs(payload && payload.args),
    result_status: resultStatus(payload && payload.result),
    duration_ms: payload && Number.isFinite(payload.duration_ms) ? payload.duration_ms : null
  };
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(usage());
    return 0;
  }

  if (process.argv.includes("--self-test")) {
    const before = readLineCount();
    appendRow(eventRow({
      tool: "read_file",
      args: { path: "README.md" },
      result: { status: "ok" },
      duration_ms: 12
    }));
    const after = readLineCount();
    if (after <= before) {
      console.error(`[${HOOK_NAME}] self-test failed: no row appended`);
      return 1;
    }
    console.log(`[${HOOK_NAME}] self-test appended row`);
    return 0;
  }

  try {
    appendRow(eventRow(readPayload()));
  } catch (error) {
    appendRow({
      ts: new Date().toISOString(),
      hook: HOOK_NAME,
      tool: "unknown",
      args_summary: null,
      result_status: "invalid_payload",
      duration_ms: null,
      error: error.message
    });
  }
  return 0;
}

process.exitCode = main();

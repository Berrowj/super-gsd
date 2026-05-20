#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const HOOK_NAME = "validate-stop-contract";
const repoRoot = path.resolve(__dirname, "../../..");
const metricsPath = path.resolve(repoRoot, ".planning/metrics/codex-tool-events.jsonl");

function usage() {
  return [
    "Usage:",
    "  node validate-stop-contract.cjs [--help]",
    "  node validate-stop-contract.cjs --self-test-missing-report",
    "",
    "Reads Codex Stop JSON from stdin:",
    "  { phase, plan, report_path, checkpoint_updated, acceptance_commands_reported }",
    "Blocks if the report is missing, checkpoint was not updated, or acceptance commands were not reported."
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

function resolveRepoPath(inputPath) {
  if (typeof inputPath !== "string" || inputPath.trim() === "") return null;
  return path.isAbsolute(inputPath) ? path.resolve(inputPath) : path.resolve(repoRoot, inputPath);
}

function evaluate(payload) {
  const reportPath = resolveRepoPath(payload && payload.report_path);
  if (!reportPath || !fs.existsSync(reportPath)) {
    return { allow: false, reason: "missing_report", report_path: payload && payload.report_path };
  }
  if (payload.checkpoint_updated !== true) {
    return { allow: false, reason: "checkpoint_not_updated", report_path: payload.report_path };
  }
  if (payload.acceptance_commands_reported !== true) {
    return { allow: false, reason: "acceptance_commands_not_reported", report_path: payload.report_path };
  }
  return { allow: true, reason: "stop_contract_satisfied", report_path: payload.report_path };
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(usage());
    return 0;
  }

  let payload;
  if (process.argv.includes("--self-test-missing-report")) {
    payload = {
      phase: "111-plan-locked-codex-hooks",
      plan: "P111-01",
      report_path: `.planning/metrics/non-existent-p111-report-${process.pid}-${Date.now()}.md`,
      checkpoint_updated: true,
      acceptance_commands_reported: true
    };
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

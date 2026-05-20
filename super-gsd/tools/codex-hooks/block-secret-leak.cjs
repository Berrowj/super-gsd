#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const HOOK_NAME = "block-secret-leak";
const repoRoot = path.resolve(__dirname, "../../..");
const metricsPath = path.resolve(repoRoot, ".planning/metrics/codex-tool-events.jsonl");
const secretPatterns = [
  /API_KEY\s*=\s*[A-Za-z0-9_-]{8,}/,
  /sk_[A-Za-z0-9_]{20,}/,
  /BEGIN PRIVATE KEY/,
  /password\s*=\s*[^\s]+/i,
  /production\s+credential/i
];

function usage() {
  return [
    "Usage:",
    "  node block-secret-leak.cjs [--help]",
    "  node block-secret-leak.cjs --self-test-secret",
    "",
    "Reads Codex UserPromptSubmit JSON from stdin: { prompt }.",
    "Blocks prompts that appear to include credentials or private keys."
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

function evaluate(payload) {
  const prompt = payload && typeof payload.prompt === "string" ? payload.prompt : null;
  if (prompt === null) {
    return { allow: false, reason: "prompt_missing" };
  }
  const matched = secretPatterns.find((pattern) => pattern.test(prompt));
  if (matched) {
    return { allow: false, reason: "secret_pattern_detected", pattern: String(matched) };
  }
  return { allow: true, reason: "no_secret_pattern" };
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(usage());
    return 0;
  }

  let payload;
  if (process.argv.includes("--self-test-secret")) {
    payload = { prompt: "deploy with API_KEY=sk_test123abc456def" };
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

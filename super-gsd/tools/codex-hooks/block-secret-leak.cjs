#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const HOOK_NAME = "block-secret-leak";
// __dirname resolves through symlinks, so a worktree's super-gsd symlink would
// land metrics in the shared copy's parent (often unwritable). Prefer the hook
// payload's cwd — Claude Code always sends it — and fall back to __dirname.
const fallbackRoot = path.resolve(__dirname, "../../..");
function resolveRepoRoot(payload) {
  const cwd = payload && typeof payload.cwd === "string" ? payload.cwd : null;
  if (cwd && fs.existsSync(cwd)) return cwd;
  return fallbackRoot;
}
function metricsPathFor(repoRoot) {
  return path.resolve(repoRoot, ".planning/metrics/codex-tool-events.jsonl");
}
const secretPatterns = [
  { trigger: "API_KEY assignment", pattern: /API_KEY\s*=\s*[A-Za-z0-9_-]{8,}/ },
  { trigger: "sk_ token", pattern: /sk_[A-Za-z0-9_]{20,}/ },
  { trigger: "private-key header", pattern: /BEGIN PRIVATE KEY/ },
  { trigger: "password assignment", pattern: /password\s*=\s*[^\s]+/i },
  { trigger: "production credential phrase", pattern: /production\s+credential/i }
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

function appendDecision(repoRoot, decision) {
  const metricsPath = metricsPathFor(repoRoot);
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
  const matched = secretPatterns.find((candidate) => candidate.pattern.test(prompt));
  if (matched) {
    return {
      allow: false,
      reason: "secret_pattern_detected",
      pattern: String(matched.pattern),
      trigger: matched.trigger
    };
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
      appendDecision(resolveRepoRoot(null), { decision: "block", reason: "invalid_payload", error: error.message });
      console.error(`[${HOOK_NAME}] blocked: invalid payload: ${error.message}`);
      return 1;
    }
  }

  const decision = evaluate(payload);
  const { trigger, ...ledgerDecision } = decision;
  appendDecision(resolveRepoRoot(payload), Object.assign({}, ledgerDecision, { decision: decision.allow ? "allow" : "block" }));
  if (!decision.allow) {
    console.error(`[${HOOK_NAME}] blocked: ${trigger || decision.reason}`);
    return trigger ? 2 : 1;
  }
  return 0;
}

process.exitCode = main();

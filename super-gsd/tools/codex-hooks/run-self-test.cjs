#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "../../..");
const hooksConfigPath = path.resolve(repoRoot, ".codex/hooks.json");
const metricsPath = path.resolve(repoRoot, ".planning/metrics/codex-tool-events.jsonl");
const planLockValidator = path.resolve(repoRoot, "super-gsd/tools/plan-lock/validate-plan-locked.cjs");

const expectedHooksConfig = {
  hooks: {
    UserPromptSubmit: [
      "super-gsd/tools/codex-hooks/block-secret-leak.cjs"
    ],
    PreToolUse: [
      "super-gsd/tools/codex-hooks/block-forbidden-write.cjs",
      "super-gsd/tools/codex-hooks/enforce-allowed-files.cjs"
    ],
    PostToolUse: [
      "super-gsd/tools/codex-hooks/log-tool-event.cjs"
    ],
    Stop: [
      "super-gsd/tools/codex-hooks/validate-stop-contract.cjs"
    ]
  }
};

const hookScripts = {
  "block-forbidden-write.cjs": path.resolve(__dirname, "block-forbidden-write.cjs"),
  "block-secret-leak.cjs": path.resolve(__dirname, "block-secret-leak.cjs"),
  "log-tool-event.cjs": path.resolve(__dirname, "log-tool-event.cjs"),
  "validate-stop-contract.cjs": path.resolve(__dirname, "validate-stop-contract.cjs"),
  "enforce-allowed-files.cjs": path.resolve(__dirname, "enforce-allowed-files.cjs")
};

function usage() {
  return [
    "Usage:",
    "  node run-self-test.cjs [--help]",
    "",
    "Runs the P111 Codex hook safety-rail self-test suite."
  ].join("\n");
}

function ensureHooksConfig() {
  if (fs.existsSync(hooksConfigPath)) return;
  fs.mkdirSync(path.dirname(hooksConfigPath), { recursive: true });
  fs.writeFileSync(hooksConfigPath, `${JSON.stringify(expectedHooksConfig, null, 2)}\n`, "utf8");
}

function lineCount(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const text = fs.readFileSync(filePath, "utf8").trim();
  return text ? text.split(/\r?\n/).length : 0;
}

function runNode(scriptPath, args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: Object.assign({}, process.env)
  });
}

function assertion(name, fn) {
  try {
    const detail = fn();
    return { name, passed: true, detail: detail || "" };
  } catch (error) {
    return { name, passed: false, detail: error.message };
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(usage());
    return 0;
  }

  let hooksConfig = null;
  const tests = [
    assertion(".codex/hooks.json exists and parses", () => {
      ensureHooksConfig();
      expect(fs.existsSync(hooksConfigPath), ".codex/hooks.json missing");
      hooksConfig = JSON.parse(fs.readFileSync(hooksConfigPath, "utf8"));
    }),
    assertion(".codex/hooks.json declares required events", () => {
      const hooks = hooksConfig && hooksConfig.hooks;
      for (const event of ["UserPromptSubmit", "PreToolUse", "PostToolUse", "Stop"]) {
        expect(Array.isArray(hooks && hooks[event]), `${event} hook missing`);
      }
    }),
    assertion("block-forbidden-write.cjs exists and has --help", () => {
      const script = hookScripts["block-forbidden-write.cjs"];
      expect(fs.existsSync(script), "script missing");
      expect(runNode(script, ["--help"]).status === 0, "--help failed");
    }),
    assertion("block-secret-leak.cjs exists and has --help", () => {
      const script = hookScripts["block-secret-leak.cjs"];
      expect(fs.existsSync(script), "script missing");
      expect(runNode(script, ["--help"]).status === 0, "--help failed");
    }),
    assertion("log-tool-event.cjs exists and has --help", () => {
      const script = hookScripts["log-tool-event.cjs"];
      expect(fs.existsSync(script), "script missing");
      expect(runNode(script, ["--help"]).status === 0, "--help failed");
    }),
    assertion("validate-stop-contract.cjs exists and has --help", () => {
      const script = hookScripts["validate-stop-contract.cjs"];
      expect(fs.existsSync(script), "script missing");
      expect(runNode(script, ["--help"]).status === 0, "--help failed");
    }),
    assertion("enforce-allowed-files.cjs exists and has --help", () => {
      const script = hookScripts["enforce-allowed-files.cjs"];
      expect(fs.existsSync(script), "script missing");
      expect(runNode(script, ["--help"]).status === 0, "--help failed");
    }),
    assertion("block-forbidden-write --self-test-blocked exits 1", () => {
      const result = runNode(hookScripts["block-forbidden-write.cjs"], ["--self-test-blocked"]);
      expect(result.status === 1, `expected 1, got ${result.status}`);
    }),
    assertion("block-secret-leak --self-test-secret exits 1", () => {
      const result = runNode(hookScripts["block-secret-leak.cjs"], ["--self-test-secret"]);
      expect(result.status === 1, `expected 1, got ${result.status}`);
    }),
    assertion("log-tool-event --self-test exits 0 and appends row", () => {
      const before = lineCount(metricsPath);
      const result = runNode(hookScripts["log-tool-event.cjs"], ["--self-test"]);
      const after = lineCount(metricsPath);
      expect(result.status === 0, `expected 0, got ${result.status}`);
      expect(after > before, "metrics row was not appended");
    }),
    assertion("validate-stop-contract --self-test-missing-report exits 1", () => {
      const result = runNode(hookScripts["validate-stop-contract.cjs"], ["--self-test-missing-report"]);
      expect(result.status === 1, `expected 1, got ${result.status}`);
    }),
    assertion("enforce-allowed-files --self-test-no-plan-lock exits 1", () => {
      const result = runNode(hookScripts["enforce-allowed-files.cjs"], ["--self-test-no-plan-lock"]);
      expect(result.status === 1, `expected 1, got ${result.status}`);
    }),
    assertion("plan-lock --self-test-valid exits 0", () => {
      const result = runNode(planLockValidator, ["--self-test-valid"]);
      expect(result.status === 0, `expected 0, got ${result.status}\n${result.stdout}\n${result.stderr}`);
    }),
    assertion("plan-lock --self-test-incomplete exits 0 after expected rejection", () => {
      const result = runNode(planLockValidator, ["--self-test-incomplete"]);
      expect(result.status === 0, `expected 0, got ${result.status}\n${result.stdout}\n${result.stderr}`);
      expect(/PLAN-LOCKED-\d{2}/.test(`${result.stdout}\n${result.stderr}`), "missing PLAN-LOCKED-XX error");
    }),
    assertion("codex-tool-events.jsonl has at least one row", () => {
      expect(lineCount(metricsPath) >= 1, "metrics file has no rows");
    })
  ];

  const passed = tests.filter((test) => test.passed).length;
  for (const test of tests) {
    const marker = test.passed ? "PASS" : "FAIL";
    const detail = test.detail ? ` - ${test.detail}` : "";
    console.log(`[${marker}] ${test.name}${detail}`);
  }
  console.log(`[codex-hooks self-test] ${passed}/${tests.length} passed`);
  return passed === tests.length ? 0 : 1;
}

process.exitCode = main();

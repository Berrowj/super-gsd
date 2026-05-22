"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { checkConformance } = require("./conformance-check.cjs");

const SHARED_DIR = __dirname;
const CSS_PATH = path.join(SHARED_DIR, "sgsd-design-system.css");
const RULES_PATH = path.join(SHARED_DIR, "design-rules.json");
const CONFORMANT_PATH = path.join(SHARED_DIR, "fixtures", "conformant-sample.html");
const VIOLATIONS_PATH = path.join(SHARED_DIR, "fixtures", "violations-sample.html");
const GOLD_PATH = path.join(SHARED_DIR, "..", "chronicle", "templates", "chronicle-gold-reference.html");

const args = process.argv.slice(2);
const sacIndex = args.indexOf("--sac");
const only = sacIndex >= 0 ? args[sacIndex + 1] : null;
const surfaceIndex = args.indexOf("--surface");
const targetSurface = surfaceIndex >= 0 ? args[surfaceIndex + 1] : "cockpit";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function rules() {
  return JSON.parse(read(RULES_PATH));
}

function bindingResults(verdict) {
  return verdict.results.filter((result) => result.severity === "binding");
}

function summaryFromResults(results) {
  return results.reduce(
    (summary, result) => {
      if (result.status === "ADVISORY") {
        summary.advisory += 1;
      } else if (result.severity === "binding" && result.status === "PASS") {
        summary.binding_pass += 1;
      } else if (result.severity === "binding" && result.status === "FAIL") {
        summary.binding_fail += 1;
      }
      return summary;
    },
    { binding_pass: 0, binding_fail: 0, advisory: 0 }
  );
}

function bracesAreBalanced(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  for (const char of stripped) {
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

const tests = [];

function test(id, description, fn) {
  tests.push({ id, description, fn });
}

test("SAC-P120-01", "CSS parses, has :root, no remote imports, no font-face", () => {
  const css = read(CSS_PATH);
  assert.match(css, /:root\s*{/);
  assert.match(css, /--bg:#07111f/);
  assert.match(css, /--shadow:0 22px 60px/);
  assert.doesNotMatch(css, /@import\s+url\(\s*["']?https?:/i);
  assert.doesNotMatch(css, /@font-face/i);
  assert.ok(bracesAreBalanced(css), "CSS braces are not balanced");
});

test("SAC-P120-02", "Registry has exactly 12 rules R01-R12 and 5 cockpit principles", () => {
  const registry = rules();
  const expectedIds = Array.from({ length: 12 }, (_, index) => `R${String(index + 1).padStart(2, "0")}`);
  const ids = registry.rules.map((rule) => rule.id);
  assert.deepStrictEqual(ids, expectedIds);
  assert.strictEqual(registry.rules.length, 12);
  for (const rule of registry.rules) {
    assert.ok(rule.citation && /\b(score|Image|::)\b/i.test(rule.citation), `${rule.id} citation is missing evidence detail`);
    assert.ok(["structural", "lint", "presence", "advisory"].includes(rule.check_type), `${rule.id} has invalid check_type`);
    assert.ok(["binding", "advisory"].includes(rule.severity), `${rule.id} has invalid severity`);
    assert.ok(rule.applies_to.every((surface) => ["chronicle", "cockpit"].includes(surface)), `${rule.id} has invalid surface`);
  }
  assert.strictEqual(registry.groups.cockpit.principles.length, 5);
  assert.doesNotMatch(JSON.stringify(registry.rules), /good-charts|dont-make-me-think/i);
});

test("SAC-P120-03", "Conformant sample passes all binding chronicle rules", () => {
  const verdict = checkConformance(read(CONFORMANT_PATH), "chronicle");
  assert.strictEqual(verdict.summary.binding_fail, 0);
  assert.ok(bindingResults(verdict).every((result) => result.status === "PASS"));
});

test("SAC-P120-04", "Violation sample flags every binding chronicle rule it violates", () => {
  const verdict = checkConformance(read(VIOLATIONS_PATH), "chronicle");
  const binding = bindingResults(verdict);
  assert.ok(binding.length > 0);
  assert.ok(binding.every((result) => result.status === "FAIL"), `False PASS: ${binding.filter((result) => result.status === "PASS").map((result) => result.id).join(", ")}`);
});

test("SAC-P120-05", "--surface cockpit applies cockpit rules and skips chronicle-only rules", () => {
  const verdict = checkConformance(read(CONFORMANT_PATH), targetSurface);
  const ids = verdict.results.map((result) => result.id);
  const cockpitPrincipleIds = ["C1", "C2", "C3", "C4", "C5"];
  if (targetSurface === "cockpit") {
    assert.ok(ids.includes("R12"), "cockpit-only R12 should apply");
    assert.ok(cockpitPrincipleIds.every((id) => ids.includes(id)), "cockpit group principles should be emitted");
    assert.ok(!ids.includes("R03"), "chronicle-only R03 should not apply to cockpit");
    assert.ok(!ids.includes("R08"), "chronicle-only R08 should not apply to cockpit");
    assert.ok(!ids.includes("R09"), "chronicle-only R09 should not apply to cockpit");
  } else {
    assert.ok(ids.includes("R03"), "chronicle R03 should apply to chronicle");
    assert.ok(ids.includes("R12"), "shared R12 should apply to chronicle");
  }
  assert.strictEqual(rules().groups.cockpit.principles.length, 5);
});

test("SAC-P120-06", "Same HTML twice yields identical verdicts", () => {
  const html = read(CONFORMANT_PATH);
  const first = checkConformance(html, "chronicle");
  const second = checkConformance(html, "chronicle");
  assert.deepStrictEqual(second, first);
});

test("SAC-P120-07", "Gold reference passes all binding chronicle rules", () => {
  assert.ok(fs.existsSync(GOLD_PATH), `Missing gold reference: ${GOLD_PATH}`);
  const verdict = checkConformance(read(GOLD_PATH), "chronicle");
  assert.strictEqual(verdict.summary.binding_fail, 0, JSON.stringify(verdict.results.filter((result) => result.status === "FAIL"), null, 2));
});

test("SAC-P120-08", "Full self-test registry is complete", () => {
  const ids = tests.map((entry) => entry.id);
  assert.ok(ids.length >= 15, "Expected at least 15 assertions");
  assert.strictEqual(new Set(ids).size, ids.length, "Duplicate assertion ids");
  for (let index = 1; index <= 8; index += 1) {
    assert.ok(ids.includes(`SAC-P120-${String(index).padStart(2, "0")}`), `Missing SAC-P120-${String(index).padStart(2, "0")}`);
  }
});

test("STRUCT-01", "Structural checks are exercised", () => {
  const registry = rules();
  const structuralIds = registry.rules.filter((rule) => rule.check_type === "structural" && rule.applies_to.includes("chronicle")).map((rule) => rule.id);
  const verdictIds = checkConformance(read(CONFORMANT_PATH), "chronicle").results.map((result) => result.id);
  assert.ok(structuralIds.length > 0);
  assert.ok(structuralIds.every((id) => verdictIds.includes(id)));
});

test("STRUCT-02", "Presence checks are exercised", () => {
  const conformant = checkConformance(read(CONFORMANT_PATH), "chronicle").results;
  assert.strictEqual(conformant.find((result) => result.id === "R07").status, "PASS");
  assert.strictEqual(conformant.find((result) => result.id === "R08").status, "PASS");
});

test("STRUCT-03", "Lint checks are exercised", () => {
  const conformant = checkConformance(read(CONFORMANT_PATH), "chronicle").results.find((result) => result.id === "R11");
  const violation = checkConformance(read(VIOLATIONS_PATH), "chronicle").results.find((result) => result.id === "R11");
  assert.strictEqual(conformant.status, "PASS");
  assert.strictEqual(violation.status, "FAIL");
});

test("STRUCT-04", "Advisory checks are exercised", () => {
  const verdict = checkConformance(read(CONFORMANT_PATH), "chronicle");
  assert.ok(verdict.results.some((result) => result.status === "ADVISORY"));
});

test("STRUCT-05", "Results array shape is stable", () => {
  const verdict = checkConformance(read(CONFORMANT_PATH), "chronicle");
  assert.strictEqual(verdict.surface, "chronicle");
  assert.ok(Array.isArray(verdict.results));
  for (const result of verdict.results) {
    assert.ok(/^R\d{2}$/.test(result.id));
    assert.strictEqual(typeof result.name, "string");
    assert.ok(["binding", "advisory"].includes(result.severity));
    assert.ok(["PASS", "FAIL", "ADVISORY"].includes(result.status));
    assert.strictEqual(typeof result.detail, "string");
  }
});

test("STRUCT-06", "Summary counts match result statuses", () => {
  const verdict = checkConformance(read(VIOLATIONS_PATH), "chronicle");
  assert.deepStrictEqual(verdict.summary, summaryFromResults(verdict.results));
});

test("STRUCT-07", "Advisory rules never fail", () => {
  for (const surface of ["chronicle", "cockpit"]) {
    for (const html of [read(CONFORMANT_PATH), read(VIOLATIONS_PATH)]) {
      const advisory = checkConformance(html, surface).results.filter((result) => result.severity === "advisory");
      assert.ok(advisory.every((result) => result.status === "ADVISORY"));
    }
  }
});

test("STRUCT-08", "Invalid surface is rejected", () => {
  assert.throws(() => checkConformance("<main></main>", "terminal"), /Invalid surface/);
});

test("STRUCT-09", "Cockpit verdict skips chronicle-only rules", () => {
  const ids = checkConformance(read(CONFORMANT_PATH), "cockpit").results.map((result) => result.id);
  assert.ok(!ids.includes("R03"));
  assert.ok(!ids.includes("R08"));
  assert.ok(!ids.includes("R09"));
  assert.ok(ids.includes("R12"));
  assert.ok(["C1", "C2", "C3", "C4", "C5"].every((id) => ids.includes(id)));
});

test("STRUCT-10", "Module export exposes checkConformance", () => {
  assert.strictEqual(typeof checkConformance, "function");
});

function run() {
  const selected = only ? tests.filter((entry) => entry.id === only) : tests;
  if (only && selected.length === 0) {
    throw new Error(`No assertion registered for ${only}`);
  }
  const failures = [];
  for (const entry of selected) {
    try {
      entry.fn();
      process.stdout.write(`PASS ${entry.id} ${entry.description}\n`);
    } catch (error) {
      failures.push({ entry, error });
      process.stdout.write(`FAIL ${entry.id} ${entry.description}\n${error.stack || error.message}\n`);
    }
  }
  if (failures.length > 0) {
    process.stdout.write(`\n${failures.length} assertion(s) failed.\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`\n${selected.length} assertion(s) passed.\n`);
  }
}

run();

#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const TOOL_NAME = "validate-plan-locked";
const repoRoot = path.resolve(__dirname, "../../..");
const superGsdRoot = path.resolve(__dirname, "../..");
const v2SchemaPath = path.resolve(superGsdRoot, "templates/plan-schema-v2.json");
const lockedSchemaPath = path.resolve(superGsdRoot, "schemas/plan-locked.schema.json");
const metricsPath = path.resolve(repoRoot, ".planning/metrics/plan-lock-validation.jsonl");

function requireDependency(name) {
  const candidates = [
    path.resolve(__dirname, "../plan-schema/node_modules", name),
    path.resolve(__dirname, "node_modules", name),
    path.resolve(repoRoot, "node_modules", name),
    name
  ];

  const failures = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }

  const detail = failures.map((failure) => `  - ${failure}`).join("\n");
  throw new Error(`Missing dependency '${name}'. Tried:\n${detail}`);
}

function usage() {
  return [
    "Usage:",
    "  node validate-plan-locked.cjs [--help] [--plan-file PATH]",
    "  node validate-plan-locked.cjs --self-test-valid",
    "  node validate-plan-locked.cjs --self-test-incomplete",
    "",
    "Validates PLAN-LOCKED.md frontmatter against BOTH:",
    `  - ${path.relative(repoRoot, v2SchemaPath)}`,
    `  - ${path.relative(repoRoot, lockedSchemaPath)}`
  ].join("\n");
}

function parseArgs(argv) {
  const args = {
    help: false,
    planFile: null,
    selfTestValid: false,
    selfTestIncomplete: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--plan-file") {
      args.planFile = argv[index + 1];
      index += 1;
    } else if (arg === "--self-test-valid") {
      args.selfTestValid = true;
    } else if (arg === "--self-test-incomplete") {
      args.selfTestIncomplete = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseScalar(value) {
  const trimmed = String(value || "").trim().replace(/^["']|["']$/g, "");
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number.parseFloat(trimmed);
  return trimmed;
}

function parseInlineList(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(",").map(parseScalar);
}

function parseSimpleYaml(text) {
  const lines = text.split(/\r?\n/);
  const result = {};
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim() || line.trim().startsWith("#") || /^\s/.test(line)) continue;
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (!match) continue;

    const key = match[1].trim();
    const value = match[2].trim();
    const inlineList = parseInlineList(value);
    if (inlineList) {
      result[key] = inlineList;
      continue;
    }
    if (value !== "") {
      result[key] = parseScalar(value);
      continue;
    }

    const list = [];
    for (let listIndex = index + 1; listIndex < lines.length; listIndex += 1) {
      const listLine = lines[listIndex];
      if (/^\S[^:]*:\s*/.test(listLine)) break;
      const item = /^\s*-\s*(.+?)\s*$/.exec(listLine);
      if (item) list.push(parseScalar(item[1]));
    }
    result[key] = list;
  }
  return result;
}

function dumpSimpleYaml(frontmatter) {
  const lines = [];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${String(item)}`);
      }
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function readFrontmatter(markdownPath) {
  const text = fs.readFileSync(markdownPath, "utf8");
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) {
    throw new Error(`No YAML frontmatter found in ${markdownPath}`);
  }

  let parsed;
  try {
    parsed = requireDependency("js-yaml").load(match[1]);
  } catch (_error) {
    parsed = parseSimpleYaml(match[1]);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Frontmatter must be a YAML object in ${markdownPath}`);
  }
  return parsed;
}

function pointerGet(root, pointer) {
  const parts = pointer
    .replace(/^#/, "")
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
  return parts.reduce((current, part) => (current ? current[part] : undefined), root);
}

function inferType(schema) {
  if (!schema || typeof schema !== "object") return "string";
  if (schema.type) return Array.isArray(schema.type) ? schema.type[0] : schema.type;
  if (schema.properties || schema.required) return "object";
  if (schema.items) return "array";
  if (schema.enum || Object.prototype.hasOwnProperty.call(schema, "const")) return "string";
  return "string";
}

function sampleStringFor(propertyName, schema) {
  if (propertyName === "locked_at" || schema.format === "date-time") {
    return "2026-05-20T00:00:00Z";
  }
  if (propertyName === "risk_rating") {
    return "low";
  }
  if (schema.pattern && /^\\d\{4\}/.test(schema.pattern)) {
    return "2026-05-20T00:00:00Z";
  }
  return "self-test";
}

function mergeObjects(left, right) {
  if (!left || typeof left !== "object" || Array.isArray(left)) return right;
  if (!right || typeof right !== "object" || Array.isArray(right)) return left;
  return Object.assign({}, left, right);
}

function synthesizeValue(schema, rootSchema, propertyName = "") {
  if (!schema || typeof schema !== "object") {
    return "self-test";
  }
  if (schema.$ref) {
    const resolved = pointerGet(rootSchema, schema.$ref);
    return synthesizeValue(resolved, rootSchema, propertyName);
  }
  if (schema.allOf) {
    return schema.allOf.reduce(
      (value, entry) => mergeObjects(value, synthesizeValue(entry, rootSchema, propertyName)),
      {}
    );
  }
  if (schema.anyOf) {
    return synthesizeValue(schema.anyOf[0], rootSchema, propertyName);
  }
  if (schema.oneOf) {
    return synthesizeValue(schema.oneOf[0], rootSchema, propertyName);
  }
  if (Object.prototype.hasOwnProperty.call(schema, "const")) {
    return schema.const;
  }
  if (schema.enum) {
    return schema.enum[0];
  }

  const type = inferType(schema);
  if (type === "object") {
    const result = {};
    const properties = schema.properties || {};
    const required = new Set(schema.required || Object.keys(properties));
    for (const key of required) {
      result[key] = synthesizeValue(properties[key] || { type: "string" }, rootSchema, key);
    }
    return result;
  }
  if (type === "array") {
    const minItems = Number.isInteger(schema.minItems) ? schema.minItems : 1;
    const itemSchema = schema.items || { type: "string" };
    return Array.from({ length: Math.max(1, minItems) }, () =>
      synthesizeValue(itemSchema, rootSchema, propertyName)
    );
  }
  if (type === "integer" || type === "number") return 1;
  if (type === "boolean") return true;
  if (type === "null") return null;
  return sampleStringFor(propertyName, schema);
}

function synthesizePlanFrontmatter(v2Schema) {
  return Object.assign({}, synthesizeValue(v2Schema, v2Schema), {
    lock_status: "locked",
    locked_at: "2026-05-20T00:00:00Z",
    locked_by: "sgsd-auto",
    allowed_files: [
      "super-gsd/schemas/plan-locked.schema.json",
      "super-gsd/tools/plan-lock/validate-plan-locked.cjs"
    ],
    forbidden_files: [
      ".git/",
      "secrets/",
      "*.env"
    ],
    invariants: [
      "no production writes",
      "DeltaComplexity <= 0"
    ],
    acceptance_commands: [
      "node super-gsd/tools/plan-lock/validate-plan-locked.cjs --self-test-valid"
    ],
    rollback_plan: "Remove P111 PLAN-LOCKED files and restore previous hook config.",
    risk_rating: "low",
    operator_checkpoints: [
      "Operator reviews validation and hook self-test output."
    ]
  });
}

function toFrontmatterMarkdown(frontmatter) {
  try {
    const yaml = requireDependency("js-yaml");
    return `---\n${yaml.dump(frontmatter, { lineWidth: 120 })}---\n\n# PLAN-LOCKED\n`;
  } catch (_error) {
    return `---\n${dumpSimpleYaml(frontmatter)}---\n\n# PLAN-LOCKED\n`;
  }
}

function writeTempPlan(frontmatter, label) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `sgsd-plan-lock-${label}-`));
  const filePath = path.join(directory, "PLAN-LOCKED.md");
  fs.writeFileSync(filePath, toFrontmatterMarkdown(frontmatter), "utf8");
  return filePath;
}

function createAjv() {
  const Ajv = requireDependency("ajv");
  const ajv = new Ajv({
    allErrors: true,
    strict: false,
    messages: true
  });

  try {
    const ajvErrors = requireDependency("ajv-errors");
    ajvErrors(ajv);
  } catch (_error) {
    // Messages for required PLAN-LOCKED fields are normalized below.
  }

  return ajv;
}

function normalizeError(schemaName, error) {
  const pathLabel = error.instancePath || "/";
  const missing = error.params && error.params.missingProperty;
  const messageByMissingProperty = {
    lock_status: "PLAN-LOCKED must declare 'lock_status: locked' (PLAN-LOCKED-01)",
    allowed_files: "PLAN-LOCKED must declare 'allowed_files' array (PLAN-LOCKED-02)",
    acceptance_commands: "PLAN-LOCKED must declare 'acceptance_commands' array (PLAN-LOCKED-03)",
    rollback_plan: "PLAN-LOCKED must declare 'rollback_plan' (PLAN-LOCKED-04)",
    risk_rating: "PLAN-LOCKED must declare 'risk_rating' (PLAN-LOCKED-05)"
  };

  return {
    schema: schemaName,
    path: pathLabel,
    keyword: error.keyword,
    message: messageByMissingProperty[missing] || error.message || "validation failed"
  };
}

function validateObject(frontmatter) {
  const v2Schema = readJson(v2SchemaPath);
  const lockedSchema = readJson(lockedSchemaPath);
  const ajv = createAjv();
  const validations = [
    ["plan-schema-v2", ajv.compile(v2Schema)],
    ["plan-locked", ajv.compile(lockedSchema)]
  ];

  const errors = [];
  for (const [schemaName, validate] of validations) {
    const valid = validate(frontmatter);
    if (!valid) {
      for (const error of validate.errors || []) {
        errors.push(normalizeError(schemaName, error));
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function appendMetrics(row) {
  fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
  fs.appendFileSync(metricsPath, `${JSON.stringify(row)}\n`, "utf8");
}

function printResult(result, planFile) {
  const relativePlan = planFile ? path.relative(repoRoot, planFile) : "<synthetic>";
  if (result.valid) {
    console.log(`[${TOOL_NAME}] VALID ${relativePlan}`);
    return;
  }

  console.error(`[${TOOL_NAME}] REJECT ${relativePlan}`);
  for (const error of result.errors) {
    console.error(`  - ${error.schema} ${error.path}: ${error.message}`);
  }
}

function runValidation(planFile) {
  const frontmatter = readFrontmatter(planFile);
  const result = validateObject(frontmatter);
  appendMetrics({
    ts: new Date().toISOString(),
    tool: TOOL_NAME,
    plan_file: path.resolve(planFile),
    valid: result.valid,
    error_count: result.errors.length,
    errors: result.errors
  });
  printResult(result, planFile);
  return result.valid ? 0 : 1;
}

function runSelfTestValid() {
  const v2Schema = readJson(v2SchemaPath);
  const planFile = writeTempPlan(synthesizePlanFrontmatter(v2Schema), "valid");
  const exitCode = runValidation(planFile);
  if (exitCode !== 0) {
    console.error(`[${TOOL_NAME}] --self-test-valid expected VALID`);
  }
  return exitCode;
}

function runSelfTestIncomplete() {
  const v2Schema = readJson(v2SchemaPath);
  const frontmatter = synthesizePlanFrontmatter(v2Schema);
  delete frontmatter.lock_status;
  delete frontmatter.allowed_files;
  delete frontmatter.acceptance_commands;
  delete frontmatter.rollback_plan;
  delete frontmatter.risk_rating;
  const planFile = writeTempPlan(frontmatter, "incomplete");
  const exitCode = runValidation(planFile);
  if (exitCode !== 1) {
    console.error(`[${TOOL_NAME}] --self-test-incomplete expected REJECT`);
    return 1;
  }
  console.error(`[${TOOL_NAME}] --self-test-incomplete observed expected REJECT`);
  return 0;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error(usage());
    return 2;
  }

  if (args.help) {
    console.log(usage());
    return 0;
  }

  try {
    if (args.selfTestValid) {
      return runSelfTestValid();
    }
    if (args.selfTestIncomplete) {
      return runSelfTestIncomplete();
    }
    if (!args.planFile) {
      console.error("--plan-file PATH is required unless a self-test flag is used.");
      console.error(usage());
      return 2;
    }
    return runValidation(path.resolve(process.cwd(), args.planFile));
  } catch (error) {
    appendMetrics({
      ts: new Date().toISOString(),
      tool: TOOL_NAME,
      plan_file: args && args.planFile ? path.resolve(process.cwd(), args.planFile) : null,
      valid: false,
      error_count: 1,
      errors: [
        {
          schema: "runtime",
          path: "/",
          keyword: "exception",
          message: error.message
        }
      ]
    });
    console.error(`[${TOOL_NAME}] ERROR ${error.message}`);
    return 1;
  }
}

process.exitCode = main();

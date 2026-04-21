#!/usr/bin/env node
// @sgsd/plan-schema validate.cjs — SGSD v2 plan YAML-frontmatter validator.
//
// Why this exists: mechanical enforcement of the v2 plan schema at both write-time
// (superpowers:writing-plans calls this before emitting PLAN.md) and load-time
// (sgsd-orchestrate re-validates at dispatch). Emits dual error format per D-08.
//
// Usage:
//   node validate.cjs --plan-file PATH [--project-dir PATH] [--mode write|load]
//
// Exit codes:
//   0  VALID   — frontmatter passes schema
//   1  INVALID — schema errors found; D-08 lines to stderr
//   2  BLOCKED — precondition failure (file not found, parse error, schema load error)
//
// Stderr: progress + human-readable D-08 error lines
// Stdout: reserved for machine output (currently unused; may emit JSON in future)
//
// JSONL telemetry: one row appended to .planning/metrics/plan-errors.jsonl per run
// (pass and fail rows, for orchestrator telemetry per D-08).
//
// plan-errors.jsonl row schema (mirrors activity-log, token-log conventions):
//   {
//     "ts": "ISO-8601",              // always first
//     "event": "validation_run",
//     "plan_file": "11-01-PLAN.md",  // basename
//     "phase": 11,                   // integer extracted from NN-PP-* filename
//     "plan": 1,                     // integer extracted from NN-PP-* filename
//     "schema_version": 2,           // from frontmatter or 0 if absent
//     "mode": "load",                // --mode arg
//     "valid": false,
//     "error_count": 2,
//     "errors": [ { instancePath, schemaPath, keyword, message } ]
//   }
//   Pass rows: valid: true, errors: []

'use strict';

const fs   = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────────────────────────
// Logging helpers — stderr for progress, stdout reserved for machine output
// (mirrors phase-verifier.mjs pattern)
// ──────────────────────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};
const log  = (msg) => console.error(`${C.cyan}[validate]${C.reset} ${msg}`);
const ok   = (msg) => console.error(`${C.green}  ok${C.reset} ${msg}`);
const warn = (msg) => console.error(`${C.yellow}  warn${C.reset} ${msg}`);
const err  = (msg) => console.error(`${C.red}  error${C.reset} ${msg}`);

function fail(msg, code = 2) {
  err(msg);
  process.exit(code);
}

// ──────────────────────────────────────────────────────────────────────────────
// CLI args — manual loop over process.argv (phase-verifier pattern)
// ──────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {
    planFile: null,
    projectDir: process.cwd(),
    mode: 'load',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plan-file')    out.planFile    = argv[++i];
    else if (a === '--project-dir') out.projectDir = argv[++i];
    else if (a === '--mode')    out.mode        = argv[++i];
    else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    }
  }
  if (!out.planFile) {
    fail('Missing --plan-file. Usage: validate.cjs --plan-file PATH [--project-dir PATH] [--mode write|load]', 2);
  }
  // Resolve projectDir to absolute before we use it
  out.projectDir = path.resolve(out.projectDir);
  // Resolve planFile — if relative, resolve against cwd (not projectDir) so
  // callers can pass repo-relative paths from any cwd.
  out.planFile = path.resolve(process.cwd(), out.planFile);
  return out;
}

function printUsage() {
  console.error(`
validate.cjs — SGSD v2 plan schema validator

Usage:
  node validate.cjs --plan-file PATH [--project-dir PATH] [--mode write|load]

Options:
  --plan-file PATH     (required) Path to PLAN.md file to validate.
  --project-dir PATH   Project root (contains .planning/). Default: cwd.
  --mode write|load    Context tag for JSONL telemetry. Default: load.

Exit codes:
  0  VALID   — frontmatter passes schema
  1  INVALID — schema errors found; error lines to stderr
  2  BLOCKED — precondition failure (file not found, parse error)
`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Schema loading
// ──────────────────────────────────────────────────────────────────────────────

function loadSchema() {
  // Schema lives two levels up from this file: super-gsd/tools/plan-schema/ → super-gsd/templates/
  const schemaPath = path.resolve(__dirname, '..', '..', 'templates', 'plan-schema-v2.json');
  if (!fs.existsSync(schemaPath)) {
    fail(`plan-schema-v2.json not found at ${schemaPath}. Run plan 11-01 first.`, 2);
  }
  try {
    return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (e) {
    fail(`Failed to parse plan-schema-v2.json: ${e.message}`, 2);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// AJV initialisation — CRITICAL: use require('ajv').default (RQ-1 A1 pitfall)
// ──────────────────────────────────────────────────────────────────────────────

function buildValidator(schema) {
  // Require from node_modules scoped to this tool's directory
  const ajvPath     = path.resolve(__dirname, 'node_modules', 'ajv');
  const formatsPath = path.resolve(__dirname, 'node_modules', 'ajv-formats');
  const errorsPath  = path.resolve(__dirname, 'node_modules', 'ajv-errors');

  let Ajv, addFormats, addErrors;
  try {
    Ajv        = require(ajvPath).default;   // .default is CRITICAL for ajv v8 CJS
    addFormats = require(formatsPath);
    addErrors  = require(errorsPath);
  } catch (e) {
    fail(`Failed to load ajv dependencies: ${e.message}. Run npm install in super-gsd/tools/plan-schema/`, 2);
  }

  const ajv = new Ajv({ allErrors: true, useDefaults: true });
  addFormats(ajv);
  addErrors(ajv);

  try {
    return ajv.compile(schema);
  } catch (e) {
    fail(`Failed to compile plan-schema-v2.json: ${e.message}`, 2);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Frontmatter extraction — only parse YAML between first '---' delimiters
// (Pitfall 2: do NOT pass full PLAN.md to ajv)
// ──────────────────────────────────────────────────────────────────────────────

function extractFrontmatter(content, planFilePath) {
  // gray-matter handles edge cases: multi-line strings, quoted colons, etc.
  const gmPath   = path.resolve(__dirname, 'node_modules', 'gray-matter');
  const yamlPath = path.resolve(__dirname, 'node_modules', 'js-yaml');
  let matter, yaml;
  try {
    matter = require(gmPath);
    yaml   = require(yamlPath);
  } catch (e) {
    fail(`Failed to load gray-matter/js-yaml: ${e.message}`, 2);
  }

  // Extract raw frontmatter block manually (between first pair of '---' delimiters)
  // so we can apply duplicate-key deduplication before parsing.
  function getRawFrontmatter(src) {
    const lines = src.split('\n');
    if (lines[0].trim() !== '---') return null;
    const end = lines.indexOf('---', 1);
    if (end === -1) return null;
    return lines.slice(1, end).join('\n');
  }

  // js-yaml v4 throws on duplicate keys. Deduplicate by scanning the raw YAML
  // lines and keeping only the last occurrence of each top-level key.
  // This preserves comment lines and multi-line values.
  function deduplicateTopLevelKeys(rawYaml) {
    const lines = rawYaml.split('\n');
    // Track which top-level key each line belongs to
    const seen  = new Map(); // key -> last line index where it was declared
    const topKeyLine = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(topKeyLine);
      if (m) seen.set(m[1], i);
    }
    // Build output: include a line only if it's the LAST declaration of its key
    // (skip earlier duplicates + their continuation lines).
    const keyOccurrences = new Map(); // key -> count of how many times we've seen it
    const result = [];
    let skipUntilNextTopKey = false;
    let currentKey = null;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(topKeyLine);
      if (m) {
        const key = m[1];
        const count = (keyOccurrences.get(key) || 0) + 1;
        keyOccurrences.set(key, count);
        // Count total occurrences of this key across the whole document
        const totalOccurrences = [...seen.entries()].filter(([k]) => k === key).length;
        // seen only stores the LAST index — so if this line index === seen.get(key), keep it
        if (seen.get(key) === i) {
          skipUntilNextTopKey = false;
          result.push(lines[i]);
        } else {
          skipUntilNextTopKey = true;
        }
        currentKey = key;
      } else {
        // Continuation line (indented or blank) — include only if not skipping
        if (!skipUntilNextTopKey) result.push(lines[i]);
      }
    }
    return result.join('\n');
  }

  // First attempt: standard gray-matter parse
  try {
    const parsed = matter(content);
    return parsed.data;
  } catch (e) {
    if (!e.message.includes('duplicated mapping key')) {
      fail(`[${path.basename(planFilePath)}] YAML frontmatter parse error: ${e.message}`, 2);
    }
  }

  // Fallback: deduplicate top-level keys and retry
  warn(`[${path.basename(planFilePath)}] Duplicate YAML keys detected — deduplicating (last value wins)`);
  const raw = getRawFrontmatter(content);
  if (!raw) {
    fail(`[${path.basename(planFilePath)}] Could not extract YAML frontmatter block`, 2);
  }
  const deduped = deduplicateTopLevelKeys(raw);
  try {
    return yaml.load(deduped) || {};
  } catch (e2) {
    fail(`[${path.basename(planFilePath)}] YAML frontmatter parse error after deduplication: ${e2.message}`, 2);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Phase/plan extraction from filename  e.g. "11-01-schema-file.md" → {11, 1}
// ──────────────────────────────────────────────────────────────────────────────

function extractPhasePlan(fileName) {
  const m = path.basename(fileName).match(/^(\d+)-(\d+)/);
  if (m) return { phase: parseInt(m[1], 10), plan: parseInt(m[2], 10) };
  return { phase: 0, plan: 0 };
}

// ──────────────────────────────────────────────────────────────────────────────
// JSONL telemetry — append one row to plan-errors.jsonl per run (D-08)
// ──────────────────────────────────────────────────────────────────────────────

function appendTelemetry(projectDir, planFile, frontmatter, valid, errors, mode) {
  const metricsDir  = path.join(projectDir, '.planning', 'metrics');
  const jsonlPath   = path.join(metricsDir, 'plan-errors.jsonl');
  const { phase, plan } = extractPhasePlan(planFile);
  const row = {
    ts: new Date().toISOString(),
    event: 'validation_run',
    plan_file: path.basename(planFile),
    phase,
    plan,
    schema_version: (frontmatter && frontmatter.schema_version) || 0,
    mode,
    valid,
    error_count: errors.length,
    errors: errors.map(e => ({
      instancePath: e.instancePath || '',
      schemaPath:   e.schemaPath   || '',
      keyword:      e.keyword      || '',
      message:      e.message      || '',
    })),
  };

  try {
    // Create metrics dir if absent (should already exist but be safe)
    if (!fs.existsSync(metricsDir)) fs.mkdirSync(metricsDir, { recursive: true });
    fs.appendFileSync(jsonlPath, JSON.stringify(row) + '\n', 'utf8');
  } catch (e) {
    // Do not exit 2 for a telemetry write failure — warn and continue
    warn(`Could not append to plan-errors.jsonl: ${e.message}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// D-08 stderr error formatting
// Format: [filename] task #N: missing required 'field' (SCHEMA-02)
// ──────────────────────────────────────────────────────────────────────────────

function formatErrors(ajvErrors, planFileName) {
  const lines = [];
  for (const e of ajvErrors) {
    // instancePath examples: "/tasks/0", "/tasks/0/falsifier", ""
    const ip = e.instancePath || '';
    const taskMatch = ip.match(/^\/tasks\/(\d+)/);
    const taskIndex = taskMatch ? parseInt(taskMatch[1], 10) + 1 : null; // 1-based

    // ajv-errors wraps raw errors under keyword "errorMessage".
    // The top-level e.message is already the human-readable custom text from the schema.
    // The raw sub-error's missingProperty is in e.params.errors[0].params.missingProperty.
    if (e.keyword === 'errorMessage') {
      // Extract missing field name from the nested sub-error if available
      let field = null;
      const subErrors = (e.params && e.params.errors) || [];
      for (const sub of subErrors) {
        if (sub.keyword === 'required' && sub.params && sub.params.missingProperty) {
          field = sub.params.missingProperty;
          break;
        }
      }
      // e.message is already the D-08 formatted custom message from the schema errorMessage
      // e.g. "task must declare 'falsifier' (SCHEMA-02)"
      // Wrap it in the D-08 [filename] prefix
      if (taskIndex !== null) {
        lines.push(`[${planFileName}] task #${taskIndex}: ${e.message}`);
      } else {
        lines.push(`[${planFileName}] ${e.message}`);
      }
      continue;
    }

    // Raw ajv errors (no ajv-errors custom message) — format manually
    let field = null;
    const fieldMatch = ip.match(/\/([^/]+)$/);
    if (fieldMatch) field = fieldMatch[1];

    // For "required" keyword errors, ajv puts the missing property in e.params.missingProperty
    if (e.keyword === 'required' && e.params && e.params.missingProperty) {
      field = e.params.missingProperty;
    }

    let line;
    if (taskIndex !== null && field) {
      line = `[${planFileName}] task #${taskIndex}: missing required '${field}' (SCHEMA-02)`;
    } else if (taskIndex !== null) {
      line = `[${planFileName}] task #${taskIndex}: ${e.message} (SCHEMA-02)`;
    } else if (field) {
      line = `[${planFileName}] missing required '${field}' (SCHEMA-01)`;
    } else {
      line = `[${planFileName}] ${e.message}`;
    }
    lines.push(line);
  }
  return lines;
}

// ──────────────────────────────────────────────────────────────────────────────
// D-02 prior_errors_lookup derivation from ATC tier
// ──────────────────────────────────────────────────────────────────────────────

function derivePriorErrorsLookup(frontmatter) {
  const tier = (frontmatter.expected_ATC_tier || 'LITE').toUpperCase();
  return tier === 'FULL' || tier === 'GATE';
}

// ──────────────────────────────────────────────────────────────────────────────
// D-04 lessons_path existence check — warn + continue
// ──────────────────────────────────────────────────────────────────────────────

function checkLessonsPath(frontmatter, projectDir, planFileName) {
  const lp = frontmatter.lessons_path;
  if (!lp) return; // null/undefined — no warning needed
  const resolved = path.resolve(projectDir, lp);
  if (!fs.existsSync(resolved)) {
    warn(`[${planFileName}] lessons_path '${lp}' does not exist — stale ref (D-04)`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// T-11-03: Path traversal mitigation — validate planFile ends in .md
// ──────────────────────────────────────────────────────────────────────────────

function validatePlanFilePath(planFilePath) {
  const base = path.basename(planFilePath);
  if (!base.endsWith('.md')) {
    fail(`--plan-file must point to a .md file; got: ${base}`, 2);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

function main() {
  const { planFile, projectDir, mode } = parseArgs(process.argv);

  validatePlanFilePath(planFile);

  const planFileName = path.basename(planFile);
  log(`Validating ${planFileName} (mode: ${mode})`);

  // Check plan file exists — exit 2 if not (BLOCKED)
  if (!fs.existsSync(planFile)) {
    // Append telemetry for the miss (frontmatter: {})
    appendTelemetry(projectDir, planFile, {}, false, [{ keyword: 'blocked', message: 'plan file not found', instancePath: '', schemaPath: '' }], mode);
    fail(`[${planFileName}] plan file not found: ${planFile}`, 2);
  }

  // Read plan file
  let content;
  try {
    content = fs.readFileSync(planFile, 'utf8');
  } catch (e) {
    appendTelemetry(projectDir, planFile, {}, false, [{ keyword: 'blocked', message: e.message, instancePath: '', schemaPath: '' }], mode);
    fail(`[${planFileName}] Failed to read plan file: ${e.message}`, 2);
  }

  // Load and compile schema — exit 2 on failure
  const schema    = loadSchema();
  const validate  = buildValidator(schema);

  // Extract YAML frontmatter only
  const frontmatter = extractFrontmatter(content, planFile);

  // Validate
  const valid = validate(frontmatter);

  // D-02: derive prior_errors_lookup from ATC tier (inject into result; not validated by schema)
  frontmatter.prior_errors_lookup = derivePriorErrorsLookup(frontmatter);

  if (!valid) {
    const ajvErrors   = validate.errors || [];
    const errorLines  = formatErrors(ajvErrors, planFileName);

    // Append JSONL telemetry (fail row)
    appendTelemetry(projectDir, planFile, frontmatter, false, ajvErrors, mode);

    // D-08 stderr: human-readable error lines
    for (const line of errorLines) {
      err(line);
    }
    process.exit(1);
  }

  // Validation passed — D-04 lessons_path check (warn + continue, never exit 1)
  checkLessonsPath(frontmatter, projectDir, planFileName);

  // Append JSONL telemetry (pass row)
  appendTelemetry(projectDir, planFile, frontmatter, true, [], mode);

  // D-08 stderr: VALID confirmation
  console.error(`[${planFileName}] VALID (no errors)`);
  process.exit(0);
}

main();

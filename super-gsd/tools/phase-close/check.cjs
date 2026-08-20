#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const phaseName = require('../../scripts/lib/phase-name.cjs');

const YAML_LIB_PATH = path.resolve(
  __dirname, '..', 'plan-schema', 'node_modules', 'js-yaml');
const EXIT_SUCCESS = 0;
const EXIT_REFUSAL = 1;
const EXIT_INPUT_INTERNAL = 2;

function envelope(ok, exitCode, reason, message, detail) {
  return {
    ok,
    exit_code: exitCode,
    reason,
    category: exitCode === EXIT_SUCCESS
      ? 'pass'
      : exitCode === EXIT_REFUSAL ? 'contract_refusal' : 'input_internal_failure',
    message,
    ...(detail || {}),
  };
}

function refusal(reason, message, detail) {
  return envelope(false, EXIT_REFUSAL, reason, message, detail);
}

function failure(reason, message, detail) {
  return envelope(false, EXIT_INPUT_INTERNAL, reason, message, detail);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isNonEmptyScalar(value) {
  if (value === null || value === undefined || typeof value === 'object') return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  return typeof value === 'boolean';
}

function readRegularFile(filePath, missingReason, readReason) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return { error: refusal(missingReason, `${path.basename(filePath)} must be a regular file`) };
    }
    return { source: fs.readFileSync(filePath, 'utf8') };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return { error: refusal(missingReason, `${path.basename(filePath)} is required`) };
    }
    return { error: failure(readReason, error && error.message ? error.message : String(error)) };
  }
}

function parseSummaryFrontmatter(source) {
  const match = String(source || '').replace(/^\uFEFF/, '')
    .match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return { error: refusal('summary_frontmatter_missing',
      'SUMMARY.md must begin with delimited YAML frontmatter') };
  }
  try {
    const yaml = require(YAML_LIB_PATH);
    const parsed = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: refusal('summary_yaml_malformed',
        'SUMMARY.md frontmatter must be a YAML mapping') };
    }
    // JSON_SCHEMA keeps dates as strings, but an unquoted all-hex commit such
    // as P154's 81e7210 is otherwise interpreted as exponent notation. Read
    // only the commits lexemes through FAILSAFE_SCHEMA, then validate them as
    // strings below; JSON_SCHEMA remains the contract parser for the document.
    const lexical = yaml.load(match[1], { schema: yaml.FAILSAFE_SCHEMA });
    if (lexical && typeof lexical === 'object' && Array.isArray(lexical.commits)) {
      parsed.commits = lexical.commits;
    }
    return { value: parsed };
  } catch (error) {
    if (!error || error.name !== 'YAMLException') {
      return { error: failure('summary_parser_failed',
        error && error.message ? error.message : 'SUMMARY.md parser failed') };
    }
    const reason = error && /duplicated mapping key/i.test(String(error.reason || error.message || ''))
      ? 'summary_duplicate_key' : 'summary_yaml_malformed';
    return { error: refusal(reason,
      error && error.message ? error.message : 'SUMMARY.md YAML could not be parsed') };
  }
}
function validateInput(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return { error: failure('invalid_options', 'options must be one object') };
  }
  if (!isNonEmptyString(options.projectDir)) {
    return { error: failure('invalid_project_dir', 'projectDir must be a non-empty string') };
  }
  if (!isNonEmptyString(options.milestone)) {
    return { error: failure('invalid_milestone', 'milestone must be a non-empty string') };
  }
  const requested = phaseName.parsePhaseToken(options.phase);
  if (!requested) {
    return { error: failure('invalid_phase', 'phase must be one opaque phase token') };
  }
  try {
    const projectDir = path.resolve(options.projectDir);
    const planningDir = isNonEmptyString(options.planningDir)
      ? path.resolve(options.planningDir)
      : path.join(projectDir, '.planning');
    return {
      value: {
        projectDir,
        planningDir,
        milestone: options.milestone.trim(),
        requested,
      },
    };
  } catch (error) {
    return { error: failure('invalid_path', error && error.message ? error.message : String(error)) };
  }
}
function validateSummary(summary, input, found) {
  const summaryPhase = phaseName.parsePhaseToken(summary.phase);
  if (!summaryPhase) {
    return refusal('summary_phase_invalid', 'SUMMARY.md phase must be one opaque phase token');
  }
  if (!phaseName.phaseTokensEqual(summaryPhase, input.requested)) {
    return refusal('summary_phase_mismatch',
      'SUMMARY.md phase must equal the requested phase');
  }
  if (!isNonEmptyString(summary.slug)) {
    return refusal('summary_slug_invalid', 'SUMMARY.md slug must be a non-empty string');
  }
  if (summary.slug.trim() !== found.slug) {
    return refusal('summary_slug_mismatch', 'SUMMARY.md slug must equal the phase folder slug');
  }
  if (!isNonEmptyString(summary.milestone)) {
    return refusal('summary_milestone_invalid',
      'SUMMARY.md milestone must be a non-empty string');
  }
  if (summary.milestone.trim() !== input.milestone) {
    return refusal('summary_milestone_mismatch',
      'SUMMARY.md milestone must equal the requested milestone');
  }
  if (!isNonEmptyString(summary.status)
      || (!/^PASS/i.test(summary.status.trim())
        && !/(?:COMPLETE|COMPLETED|CLOSED)$/i.test(summary.status.trim()))) {
    return refusal('summary_status_invalid',
      'SUMMARY.md status must begin PASS or end COMPLETE, COMPLETED, or CLOSED');
  }
  if (!validCalendarDate(summary.closed)) {
    return refusal('summary_closed_invalid',
      'SUMMARY.md closed must be a real YYYY-MM-DD calendar date');
  }
  if (!Array.isArray(summary.commits) || summary.commits.length === 0
      || !summary.commits.every((commit) => typeof commit === 'string'
        && /^[0-9a-f]{7,40}$/i.test(commit))) {
    return refusal('summary_commits_invalid',
      'SUMMARY.md commits must be a non-empty array of 7-40 hex strings');
  }
  if (!summary.gates || typeof summary.gates !== 'object' || Array.isArray(summary.gates)
      || Object.keys(summary.gates).length === 0
      || !Object.entries(summary.gates).every(([key, value]) => key.trim() && isNonEmptyScalar(value))) {
    return refusal('summary_gates_invalid',
      'SUMMARY.md gates must be a non-empty mapping of non-empty scalar verdicts');
  }
  return null;
}
function checkPhaseClose(options) {
  try {
    const validated = validateInput(options);
    if (validated.error) return validated.error;
    const input = validated.value;
    const found = phaseName.findPhase(input.projectDir, input.requested.token, {
      planningDir: input.planningDir,
      milestone: input.milestone,
    });
    if (phaseName.isDiscoveryError(found)) {
      return failure('phase_discovery_failed', found.reason, {
        operation: found.operation,
        path: found.path,
        error_code: found.error_code,
      });
    }
    if (!found) {
      return refusal('phase_not_found', 'requested phase could not be located');
    }
    if (!found.slug) {
      return refusal('phase_slug_missing', 'phase folder must include a slug');
    }
    const auditPath = path.join(found.dir, 'AUDIT.md');
    const audit = readRegularFile(auditPath, 'audit_missing', 'audit_read_failed');
    if (audit.error) return audit.error;
    const summaryPath = path.join(found.dir, 'SUMMARY.md');
    const summaryFile = readRegularFile(
      summaryPath, 'summary_missing', 'summary_read_failed');
    if (summaryFile.error) return summaryFile.error;
    const parsed = parseSummaryFrontmatter(summaryFile.source);
    if (parsed.error) return parsed.error;
    const invalid = validateSummary(parsed.value, input, found);
    if (invalid) return invalid;
    return envelope(true, EXIT_SUCCESS, 'phase_close_contract_pass',
      'AUDIT.md and SUMMARY.md satisfy the phase-close contract', {
        phase: input.requested.token,
        slug: found.slug,
        milestone: input.milestone,
        phase_dir: found.dir,
        audit_path: auditPath,
        summary_path: summaryPath,
      });
  } catch (error) {
    return failure('phase_close_internal_error',
      error && error.message ? error.message : String(error || 'unknown error'));
  }
}
function parseArgv(argv) {
  const names = {
    '--project-dir': 'projectDir',
    '--planning-dir': 'planningDir',
    '--milestone': 'milestone',
    '--phase': 'phase',
  };
  const out = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = names[argv[index]];
    if (!key || index + 1 >= argv.length) {
      return { error: `unknown or incomplete argument: ${argv[index] || ''}` };
    }
    out[key] = argv[index + 1];
    index += 1;
  }
  return { value: out };
}

function runCli(argv) {
  const parsed = parseArgv(argv || process.argv);
  const result = parsed.error
    ? failure('bad_invocation', parsed.error)
    : checkPhaseClose(parsed.value);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result.exit_code;
}

if (require.main === module) process.exit(runCli(process.argv));

module.exports = {
  checkPhaseClose,
  runCli,
  EXIT_SUCCESS,
  EXIT_REFUSAL,
  EXIT_INPUT_INTERNAL,
};

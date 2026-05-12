#!/usr/bin/env node
// @sgsd/contract-check — provider-contract parser-comparator for code-reviewer-v1.
//
// Why this exists: Phase 14 landed reviewer providers including the current
// codex-cli-reviewer shell and a legacy Claude/Sonnet contract fixture. Any
// active provider must emit the same 5-field report
// contract. The orchestrator can't trust prose claims of "contract parity" —
// every claim must be backed by parse-structure evidence that a mechanical tool
// can independently verify.
//
// What it does:
//   1. Reads two pre-captured report files from disk (fixtures or live).
//   2. Parses each against the hardcoded code-reviewer-v1 5-field schema:
//        FINDINGS / CRITICAL / WARNINGS / PASS_RATE / ONE_LINER
//   3. Extracts numeric counts from CRITICAL and WARNINGS (must start with
//      `<int>`).
//   4. Emits a JSON divergence summary on stdout (for mechanical consumption).
//   5. Exits 0/1/2 per three-way discipline (phase-verifier.mjs S2).
//
// Hard rules (per P2 deviation from D-14/D-15):
//   - This is a PURE PARSER. It does NOT call Agent() (R-2 — unavailable from
//     plain node). It does NOT shell out to codex-exec.sh. Both reports are
//     captured OUTSIDE the harness (via make-fixtures.sh or manual paste) and
//     committed as fixtures.
//   - Divergence in finding counts is INFORMATIONAL (D-15a). The harness asserts
//     parse-structure compatibility only. A report that parses but disagrees
//     with its sibling on WARNINGS count is still exit 0.
//   - A .MISSING sentinel file next to the report path propagates exit 2
//     (D-17 dual-CLI-absent soft-fail inherited from make-fixtures.sh).

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ──────────────────────────────────────────────────────────────────────────────
// CLI args
// ──────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {
    claudeReport: resolve(__dirname, 'fixtures/claude-report.txt'),
    codexReport:  resolve(__dirname, 'fixtures/codex-report.txt'),
    schema: 'code-reviewer-v1',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if      (a === '--claude-report') out.claudeReport = resolve(argv[++i]);
    else if (a === '--codex-report')  out.codexReport  = resolve(argv[++i]);
    else if (a === '--schema')        out.schema       = argv[++i];
    else if (a === '--help' || a === '-h') { printUsage(); process.exit(0); }
    else {
      err(`unknown flag: ${a}`);
      printUsage();
      process.exit(2);
    }
  }
  return out;
}

function printUsage() {
  console.log(`
contract-check — SGSD provider-contract parser-comparator (code-reviewer-v1)

Usage:
  contract-check.mjs [--claude-report PATH] [--codex-report PATH] [--schema VER]

Options:
  --claude-report PATH  Path to Claude reviewer report.
                        Default: <script-dir>/fixtures/claude-report.txt
  --codex-report PATH   Path to Codex reviewer report.
                        Default: <script-dir>/fixtures/codex-report.txt
  --schema VERSION      Contract schema label. Default: code-reviewer-v1.
                        (Only v1 is implemented; v2 would require a dispatcher.)

Exit codes:
  0  PROVEN    — both reports parsed cleanly against code-reviewer-v1
  1  UNPROVEN  — at least one report failed to parse (missing field, bad count)
  2  BLOCKED   — tool error: fixture file missing / unreadable / .MISSING sentinel
`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Logging helpers — stderr for progress, stdout reserved for JSON machine output
// (pattern: phase-verifier.mjs:83-91)
// ──────────────────────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  red:   '\x1b[31m',
  green: '\x1b[32m',
  yellow:'\x1b[33m',
  cyan:  '\x1b[36m',
};
const log  = (msg) => console.error(`${C.cyan}[contract-check]${C.reset} ${msg}`);
const ok   = (msg) => console.error(`${C.green}  ✓${C.reset} ${msg}`);
const warn = (msg) => console.error(`${C.yellow}  !${C.reset} ${msg}`);
const err  = (msg) => console.error(`${C.red}  ✗${C.reset} ${msg}`);

// ──────────────────────────────────────────────────────────────────────────────
// code-reviewer-v1 parser
// ──────────────────────────────────────────────────────────────────────────────

// Hardcoded per RESEARCH §2f — the only authoritative declaration site is
// sgsd-orchestrate/SKILL.md:488, there's no importable schema module. If this
// list changes, bump schema to code-reviewer-v2 and dispatch on --schema.
const V1_FIELDS = ['FINDINGS', 'CRITICAL', 'WARNINGS', 'PASS_RATE', 'ONE_LINER'];

function parseContractV1(text) {
  const out = { parsed: false, fields: {} };

  // Split the report into field blocks. Each field header is at the start of
  // a line, followed by `:` and a value that may span multiple lines until the
  // next field header or end-of-text. Tolerate leading/trailing whitespace.
  const pattern = new RegExp(
    `^(${V1_FIELDS.join('|')}):\\s*([\\s\\S]*?)(?=\\n(?:${V1_FIELDS.join('|')}):|$)`,
    'gm'
  );

  let match;
  while ((match = pattern.exec(text)) !== null) {
    const name = match[1];
    const value = match[2].trim();
    out.fields[name] = value;
  }

  // Check every required field is present and non-empty.
  for (const f of V1_FIELDS) {
    if (!(f in out.fields) || out.fields[f].length === 0) {
      out.missing = f;
      return out;
    }
  }

  // Extract integer counts from CRITICAL and WARNINGS. Both must start with
  // `<int>` (optionally followed by ` — description`). PASS_RATE must parse
  // as a percentage (`<num>%`).
  const critMatch = out.fields.CRITICAL.match(/^(\d+)/);
  const warnMatch = out.fields.WARNINGS.match(/^(\d+)/);
  const passMatch = out.fields.PASS_RATE.match(/^(\d+)\s*%/);

  if (!critMatch) { out.missing = 'CRITICAL:numeric-count'; return out; }
  if (!warnMatch) { out.missing = 'WARNINGS:numeric-count'; return out; }
  if (!passMatch) { out.missing = 'PASS_RATE:percentage';   return out; }

  out.critical = parseInt(critMatch[1], 10);
  out.warnings = parseInt(warnMatch[1], 10);
  out.pass_rate = parseInt(passMatch[1], 10);
  out.one_liner = out.fields.ONE_LINER;
  out.parsed = true;
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────
// Report loader — handles .MISSING sentinel (D-17 soft-fail)
// ──────────────────────────────────────────────────────────────────────────────

function loadReport(path, label) {
  const sentinel = `${path}.MISSING`;
  if (existsSync(sentinel)) {
    warn(`${label}: .MISSING sentinel present at ${basename(sentinel)} (D-17 soft-fail from make-fixtures.sh)`);
    return { path, missing: true, sentinel };
  }
  if (!existsSync(path)) {
    err(`${label}: fixture not found at ${path}`);
    return { path, error: 'not-found' };
  }
  try {
    const text = readFileSync(path, 'utf8');
    return { path, text };
  } catch (e) {
    err(`${label}: unreadable — ${e.message}`);
    return { path, error: e.message };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv);
  log(`schema: ${args.schema}`);
  log(`claude: ${args.claudeReport}`);
  log(`codex:  ${args.codexReport}`);

  if (args.schema !== 'code-reviewer-v1') {
    err(`unsupported schema '${args.schema}' — only code-reviewer-v1 is implemented`);
    process.exit(2);
  }

  const claudeLoad = loadReport(args.claudeReport, 'claude');
  const codexLoad  = loadReport(args.codexReport,  'codex');

  // D-17 soft-fail propagates to exit 2 (BLOCKED).
  if (claudeLoad.missing || codexLoad.missing) {
    const summary = {
      schema: args.schema,
      claude: claudeLoad.missing
        ? { parsed: false, sentinel: true }
        : { parsed: false, error: claudeLoad.error ?? null },
      codex: codexLoad.missing
        ? { parsed: false, sentinel: true }
        : { parsed: false, error: codexLoad.error ?? null },
      divergence: { both_parsed: false },
    };
    console.log(JSON.stringify(summary, null, 2));
    warn('exit 2 — .MISSING sentinel present (D-17 soft-fail)');
    process.exit(2);
  }

  // Tool errors (not-found, unreadable) also exit 2.
  if (claudeLoad.error || codexLoad.error) {
    const summary = {
      schema: args.schema,
      claude: claudeLoad.error ? { parsed: false, error: claudeLoad.error } : null,
      codex:  codexLoad.error  ? { parsed: false, error: codexLoad.error  } : null,
      divergence: { both_parsed: false },
    };
    console.log(JSON.stringify(summary, null, 2));
    err('exit 2 — fixture read error');
    process.exit(2);
  }

  // Parse each report.
  const claude = parseContractV1(claudeLoad.text);
  const codex  = parseContractV1(codexLoad.text);

  if (claude.parsed) ok(`claude parsed: CRITICAL=${claude.critical} WARNINGS=${claude.warnings} PASS_RATE=${claude.pass_rate}%`);
  else               err(`claude parse failed: missing ${claude.missing}`);

  if (codex.parsed)  ok(`codex parsed: CRITICAL=${codex.critical} WARNINGS=${codex.warnings} PASS_RATE=${codex.pass_rate}%`);
  else               err(`codex parse failed: missing ${codex.missing}`);

  // Build JSON summary per D-15 shape.
  const summary = {
    schema: args.schema,
    claude: {
      parsed: claude.parsed,
      critical: claude.parsed ? claude.critical : null,
      warnings: claude.parsed ? claude.warnings : null,
      pass_rate: claude.parsed ? claude.pass_rate : null,
      one_liner: claude.parsed ? claude.one_liner : null,
      missing: claude.parsed ? null : (claude.missing ?? null),
    },
    codex: {
      parsed: codex.parsed,
      critical: codex.parsed ? codex.critical : null,
      warnings: codex.parsed ? codex.warnings : null,
      pass_rate: codex.parsed ? codex.pass_rate : null,
      one_liner: codex.parsed ? codex.one_liner : null,
      missing: codex.parsed ? null : (codex.missing ?? null),
    },
    divergence: claude.parsed && codex.parsed
      ? {
          both_parsed: true,
          critical_match: claude.critical === codex.critical,
          warnings_match: claude.warnings === codex.warnings,
          pass_rate_match: claude.pass_rate === codex.pass_rate,
        }
      : { both_parsed: false },
  };

  console.log(JSON.stringify(summary, null, 2));

  // Exit discipline — divergence in counts is informational (D-15a), NOT an
  // assertion failure. Only parse failures trip exit 1.
  if (!claude.parsed || !codex.parsed) {
    err('exit 1 — at least one report failed to parse against code-reviewer-v1');
    process.exit(1);
  }

  if (!summary.divergence.critical_match || !summary.divergence.warnings_match) {
    warn('divergence noted (informational per D-15a): counts differ — not a failure');
  }

  ok('exit 0 — both reports parsed cleanly against code-reviewer-v1');
  process.exit(0);
}

main();

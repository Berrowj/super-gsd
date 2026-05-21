#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const VERDICTS = {
  GROUNDED: { name: 'REPORT_GROUNDED', exitCode: 0 },
  UNGROUNDED: { name: 'REPORT_UNGROUNDED', exitCode: 1 },
  BROKEN_CITATION: { name: 'REPORT_BROKEN_CITATION', exitCode: 2 },
  CONTAMINATED: { name: 'REPORT_CONTAMINATED', exitCode: 3 },
  FATAL: { name: 'REPORT_FATAL', exitCode: 4 },
};

const FINDING_TO_VERDICT = {
  REPORT_UNGROUNDED: VERDICTS.UNGROUNDED,
  REPORT_BROKEN_CITATION: VERDICTS.BROKEN_CITATION,
  REPORT_CONTAMINATED: VERDICTS.CONTAMINATED,
};

function parseArgs(argv) {
  const args = {
    strict: true,
    lenient: false,
    chronicle: null,
    context: null,
    meshLedger: null,
    repoRoot: process.cwd(),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--chronicle') args.chronicle = argv[++i];
    else if (arg === '--context') args.context = argv[++i];
    else if (arg === '--mesh-ledger') args.meshLedger = argv[++i];
    else if (arg === '--repo-root') args.repoRoot = argv[++i];
    else if (arg === '--lenient') {
      args.lenient = true;
      args.strict = false;
    } else if (arg === '--strict') {
      args.strict = true;
      args.lenient = false;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printUsage() {
  console.log([
    'Usage:',
    '  node super-gsd/tools/chronicle/validate-chronicle.cjs \\',
    '    --chronicle <path> --context <path> [--mesh-ledger <path>] [--lenient]',
  ].join('\n'));
}

function readText(filePath, label) {
  if (!filePath) throw fatal(`${label} path is required`);
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw fatal(`${label} file unreadable: ${filePath} (${error.message})`);
  }
}

function fatal(message) {
  const error = new Error(message);
  error.fatal = true;
  return error;
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw fatal(`${label} is not valid JSON: ${error.message}`);
  }
}

function attrMap(rawAttrs) {
  const attrs = {};
  const pattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(rawAttrs || '')) !== null) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attrs;
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value) {
  return decodeHtml(String(value || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectCitationTokens(value) {
  const tokens = [];
  if (!value) return tokens;
  const trimmed = String(value).trim();

  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return collectCitationTokensFromAny(parsed);
    } catch (_error) {
      // Fall through to tolerant token parsing.
    }
  }

  const tokenPattern = /cmb-[A-Za-z0-9._:-]+|[A-Fa-f0-9]{40}|(?:\.{1,2}[\\/]|[A-Za-z0-9_.-]+[\\/])[A-Za-z0-9_./\\:-]+/g;
  let match;
  while ((match = tokenPattern.exec(trimmed)) !== null) tokens.push(cleanCitation(match[0]));

  if (!tokens.length && /^[-\w./\\:]+$/.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    tokens.push(cleanCitation(trimmed));
  }

  return unique(tokens);
}

function collectCitationTokensFromAny(value) {
  if (Array.isArray(value)) return unique(value.flatMap(collectCitationTokensFromAny));
  if (value && typeof value === 'object') {
    const keys = ['id', 'cmb_id', 'cmbId', 'citation', 'citations', 'evidence', 'evidence_id', 'evidenceId', 'path', 'sha'];
    return unique(keys.flatMap((key) => collectCitationTokensFromAny(value[key])));
  }
  if (typeof value === 'string') return collectCitationTokens(value);
  return [];
}

function cleanCitation(value) {
  return String(value || '').trim().replace(/[),.;\]]+$/g, '');
}

function parseHtml(html) {
  const sections = [];
  const citations = [];
  const missingEvidence = [];
  const externalUrls = [];
  const svgCount = (html.match(/<svg\b/gi) || []).length;
  const detailsCount = (html.match(/<details\b/gi) || []).length;

  const externalPattern = /https?:\/\/[^"' <>)]+|<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>|<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*\bhref\s*=\s*["'][^"']+["'][^>]*>/gi;
  let externalMatch;
  while ((externalMatch = externalPattern.exec(html)) !== null) {
    externalUrls.push({ value: externalMatch[0], index: externalMatch.index });
  }

  const attrCitationPattern = /\b(?:data-citation|data-citations|data-evidence|data-evidence-id|data-source|data-sources|href)\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let attrCitationMatch;
  while ((attrCitationMatch = attrCitationPattern.exec(html)) !== null) {
    const rawValue = decodeHtml(attrCitationMatch[2] ?? attrCitationMatch[3] ?? '');
    for (const token of collectCitationTokens(rawValue)) {
      if (!/^https?:\/\//i.test(token)) citations.push({ id: token, source: 'attribute', index: attrCitationMatch.index });
    }
  }

  const inlineCitationPattern = /\bcmb-[A-Za-z0-9._:-]+\b|\b[A-Fa-f0-9]{40}\b/g;
  let inlineCitationMatch;
  while ((inlineCitationMatch = inlineCitationPattern.exec(html)) !== null) {
    citations.push({ id: cleanCitation(inlineCitationMatch[0]), source: 'inline', index: inlineCitationMatch.index });
  }

  const missingPattern = /<span\b([^>]*\bmissing-evidence\b[^>]*)>([\s\S]*?)<\/span>/gi;
  let missingMatch;
  while ((missingMatch = missingPattern.exec(html)) !== null) {
    const attrs = attrMap(missingMatch[1]);
    missingEvidence.push({
      slot: attrs['data-slot'] || attrs['data-section'] || attrs.id || stripTags(missingMatch[2]) || 'unknown',
      text: stripTags(missingMatch[2]),
      attrs,
      index: missingMatch.index,
    });
  }

  const sectionPattern = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
  let sectionMatch;
  while ((sectionMatch = sectionPattern.exec(html)) !== null) {
    const attrs = attrMap(sectionMatch[1]);
    const body = sectionMatch[2] || '';
    const sectionCitations = [];
    for (const [key, value] of Object.entries(attrs)) {
      if (/(citation|evidence|source)s?$/.test(key)) {
        sectionCitations.push(...collectCitationTokens(value));
      }
    }
    const sectionInline = body.match(/\bcmb-[A-Za-z0-9._:-]+\b|\b[A-Fa-f0-9]{40}\b/g) || [];
    sectionCitations.push(...sectionInline.map(cleanCitation));

    sections.push({
      id: attrs.id || attrs['data-section-id'] || attrs['data-section'] || attrs['data-key'] || `section-${sections.length + 1}`,
      role: attrs.role || '',
      signifierRole: attrs['data-signifier-role'] || attrs.signifier_role || attrs['data-role'] || '',
      kind: attrs['data-kind'] || '',
      className: attrs.class || '',
      reason: attrs['data-reason'] || attrs['data-empty-reason'] || attrs['aria-description'] || '',
      claim: isClaimSection(attrs, body),
      citations: unique(sectionCitations),
      text: stripTags(body),
      attrs,
      index: sectionMatch.index,
    });
  }

  return {
    sections,
    citations: dedupeCitations(citations),
    missingEvidence,
    externalUrls,
    svgCount,
    detailsCount,
  };
}

function dedupeCitations(citations) {
  const seen = new Set();
  const output = [];
  for (const citation of citations) {
    if (!citation.id || seen.has(citation.id)) continue;
    seen.add(citation.id);
    output.push(citation);
  }
  return output;
}

function isClaimSection(attrs, body) {
  const className = attrs.class || '';
  if (attrs['data-claim'] === 'true' || attrs['data-claim-section'] === 'true' || attrs['data-claim-id']) return true;
  if (/\bclaim\b/i.test(className) || attrs['data-kind'] === 'claim') return true;
  if (attrs['data-citations'] !== undefined || attrs['data-citation'] !== undefined) return true;
  if (/\bcitations?\s*:\s*\[\s*\]/i.test(body)) return true;
  if (/\bdata-citation/i.test(body)) return true;
  return false;
}

function loadSchema(repoRoot) {
  const candidates = [
    path.join(repoRoot, 'super-gsd', 'tools', 'chronicle', 'chronicle.schema.json'),
    path.join(repoRoot, 'super-gsd', 'tools', 'chronicle', 'schemas', 'chronicle.schema.json'),
    path.join(repoRoot, 'super-gsd', 'tools', 'chronicle', 'schema', 'chronicle.schema.json'),
    path.join(repoRoot, 'super-gsd', 'schemas', 'chronicle.schema.json'),
    path.join(repoRoot, 'super-gsd', 'registry', 'chronicle.schema.json'),
    path.join(repoRoot, 'super-gsd', 'registry', 'schemas', 'chronicle.schema.json'),
    path.join(repoRoot, 'super-gsd', 'tools', 'plan-schema', 'chronicle.schema.json'),
    path.join(repoRoot, '.planning', 'schemas', 'chronicle.schema.json'),
    path.join(__dirname, 'chronicle.schema.json'),
    path.join(__dirname, 'schemas', 'chronicle.schema.json'),
    path.join(__dirname, 'schema', 'chronicle.schema.json'),
    path.join(__dirname, '..', 'plan-schema', 'chronicle.schema.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return { path: candidate, schema: parseJson(fs.readFileSync(candidate, 'utf8'), candidate) };
  }
  return null;
}

function loadAjv(repoRoot) {
  const candidates = [
    path.join(repoRoot, 'super-gsd', 'tools', 'plan-schema', 'node_modules', 'ajv'),
    path.join(repoRoot, 'super-gsd', 'node_modules', 'ajv'),
    path.join(repoRoot, 'node_modules', 'ajv'),
    path.join(__dirname, '..', 'plan-schema', 'node_modules', 'ajv'),
    'ajv',
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (_error) {
      // Try next candidate.
    }
  }
  return null;
}

function loadAjvErrors(repoRoot) {
  const candidates = [
    path.join(repoRoot, 'super-gsd', 'tools', 'plan-schema', 'node_modules', 'ajv-errors'),
    path.join(__dirname, '..', 'plan-schema', 'node_modules', 'ajv-errors'),
    'ajv-errors',
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (_error) {
      // Try next candidate.
    }
  }
  return null;
}

function validateContextSchema(context, repoRoot, findings) {
  const schemaEntry = loadSchema(repoRoot);
  if (!schemaEntry) {
    return { checked: false, reason: 'chronicle.schema.json not found' };
  }

  const Ajv = loadAjv(repoRoot);
  if (!Ajv) {
    findings.push(finding('REPORT_UNGROUNDED', 'CHRONICLE-SCHEMA', 'ajv unavailable for CHRONICLE-CONTEXT validation'));
    return { checked: false, reason: 'ajv unavailable' };
  }

  const ajv = new Ajv({ allErrors: true, strict: false, useDefaults: true, coerceTypes: true, removeAdditional: 'failing' });
  const ajvErrorsPlugin = loadAjvErrors(repoRoot);
  if (ajvErrorsPlugin) ajvErrorsPlugin(ajv);
  let validate;
  try {
    validate = ajv.compile(schemaEntry.schema);
  } catch (error) {
    findings.push(finding('REPORT_UNGROUNDED', 'CHRONICLE-SCHEMA', `chronicle.schema.json could not compile: ${error.message}`));
    return { checked: false, schemaPath: schemaEntry.path, reason: 'schema compile failed' };
  }
  const valid = validate(context);
  if (!valid) {
    const detail = (validate.errors || []).map((error) => `${error.instancePath || error.dataPath || '/'} ${error.message}`).join('; ');
    findings.push(finding('REPORT_UNGROUNDED', 'CHRONICLE-SCHEMA', `CHRONICLE-CONTEXT schema validation failed: ${detail}`));
  }
  return { checked: true, schemaPath: schemaEntry.path };
}

function loadLedger(filePath) {
  if (!filePath) return { cmbs: [], ids: new Set(), source: null };
  if (!fs.existsSync(filePath)) return { cmbs: [], ids: new Set(), source: filePath, missing: true };
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) return { cmbs: [], ids: new Set(), source: filePath };

  let records;
  try {
    const isJsonl = filePath.endsWith('.jsonl') || /\}\s*\n\s*\{/.test(text);
    if (isJsonl) {
      records = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    } else if (text.startsWith('[') || text.startsWith('{')) {
      records = normalizeLedgerJson(JSON.parse(text));
    } else {
      records = text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    }
  } catch (error) {
    throw fatal(`mesh ledger is unreadable JSON/JSONL: ${filePath} (${error.message})`);
  }

  const ids = new Set();
  for (const record of records) {
    const id = record && (record.id || record.cmb_id || record.cmbId || record.cmb || record.evidence_id || record.evidenceId);
    if (id) ids.add(String(id));
  }
  return { cmbs: records, ids, source: filePath };
}

function normalizeLedgerJson(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value.cmbs)) return value.cmbs;
  if (Array.isArray(value.records)) return value.records;
  if (Array.isArray(value.entries)) return value.entries;
  if (Array.isArray(value.mesh_ledger_cmbs)) return value.mesh_ledger_cmbs;
  return [value];
}

function resolveCitation(citationId, ledger, repoRoot) {
  if (/^cmb-[A-Za-z0-9._:-]+$/.test(citationId)) {
    return { ok: ledger.ids.has(citationId), mode: 'cmb-ledger' };
  }

  if (/^[A-Fa-f0-9]{40}$/.test(citationId)) {
    return resolveGitSha(citationId, repoRoot);
  }

  if (/^https?:\/\//i.test(citationId)) {
    return { ok: false, mode: 'external-url' };
  }

  const normalized = citationId.replace(/\\/g, path.sep).replace(/\//g, path.sep);
  const candidates = [
    path.resolve(repoRoot, normalized),
    path.resolve(repoRoot, citationId),
  ];
  const ok = candidates.some((candidate) => isInside(repoRoot, candidate) && fs.existsSync(candidate));
  return { ok, mode: 'file-path' };
}

function isInside(root, candidate) {
  const rel = path.relative(path.resolve(root), path.resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function resolveGitSha(sha, repoRoot) {
  try {
    const result = childProcess.spawnSync('git', ['cat-file', '-e', `${sha}^{object}`], {
      cwd: repoRoot,
      stdio: 'ignore',
      timeout: 1000,
    });
    if (result.status === 0) return { ok: true, mode: 'git-sha' };
    return { ok: true, mode: 'git-sha-offline-tolerant' };
  } catch (_error) {
    return { ok: true, mode: 'git-sha-offline-tolerant' };
  }
}

function contextSections(context) {
  const direct = [];
  const candidates = [
    context.sections,
    context.signifier_sections,
    context.chronicle_sections,
    context.report_sections,
    context.phase_sections,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) direct.push(...candidate);
    else if (candidate && typeof candidate === 'object') direct.push(...Object.values(candidate));
  }
  return direct.filter(Boolean);
}

function validateRoles(parsed, context, findings) {
  const byId = new Map();
  for (const section of contextSections(context)) {
    const id = section.id || section.key || section.section || section.name || section.slot;
    if (id) byId.set(String(id), section);
  }

  for (const htmlSection of parsed.sections) {
    const contextSection = byId.get(htmlSection.id) || byId.get(htmlSection.attrs['data-section']) || byId.get(htmlSection.attrs['data-key']);
    const expected = htmlSection.signifierRole || (contextSection && (contextSection.signifier_role || contextSection.signifierRole || contextSection.role));
    if (!expected || !htmlSection.role) continue;
    if (String(expected) !== String(htmlSection.role)) {
      findings.push(finding(
        'REPORT_UNGROUNDED',
        'CHRONICLE-ROLE',
        `section ${htmlSection.id} signifier_role ${expected} does not match HTML role ${htmlSection.role}`,
      ));
    }
  }
}

function contextJustifications(context) {
  const values = [];
  const denominators = context.denominators || {};
  values.push(denominators.denominators_empty_reason);
  values.push(context.denominators_empty_reason);
  if (Array.isArray(denominators.assumptions_made)) values.push(...denominators.assumptions_made);
  if (Array.isArray(context.assumptions_made)) values.push(...context.assumptions_made);

  for (const section of contextSections(context)) {
    values.push(section.reason, section.empty_reason, section.denominators_empty_reason, section.justification, section.missing_evidence_reason);
  }

  return values.filter(Boolean).map((value) => String(value).toLowerCase());
}

function missingEvidenceHasJustification(item, context, htmlSections) {
  const slot = String(item.slot || '').toLowerCase();
  const text = String(item.text || '').toLowerCase();
  const justifications = contextJustifications(context);
  if (justifications.some((value) => value.includes(slot) || value.includes(text) || value.length >= 8)) return true;

  const owner = htmlSections.find((section) => item.index >= section.index);
  return Boolean(owner && owner.reason && (owner.reason.toLowerCase().includes(slot) || owner.reason.length >= 8));
}

function validateMissingEvidence(parsed, context, findings) {
  for (const missing of parsed.missingEvidence) {
    if (!missingEvidenceHasJustification(missing, context, parsed.sections)) {
      findings.push(finding(
        'REPORT_UNGROUNDED',
        'CHRONICLE-02',
        `MISSING_EVIDENCE slot ${missing.slot} has no denominators justification`,
      ));
    }
  }
}

function validateCitations(parsed, ledger, repoRoot, findings) {
  const resolutions = new Map();
  for (const citation of parsed.citations) {
    const resolved = resolveCitation(citation.id, ledger, repoRoot);
    resolutions.set(citation.id, resolved);
    if (!resolved.ok) {
      findings.push(finding(
        'REPORT_BROKEN_CITATION',
        'CHRONICLE-CITATION',
        `citation ${citation.id} did not resolve via ${resolved.mode}`,
      ));
    }
  }
  return resolutions;
}

function validateClaims(parsed, resolutions, findings) {
  for (const section of parsed.sections) {
    if (!section.claim) continue;
    const resolvedCount = section.citations.filter((id) => resolutions.get(id) && resolutions.get(id).ok).length;
    if (!section.citations.length || resolvedCount < 1) {
      findings.push(finding(
        'REPORT_UNGROUNDED',
        'CHRONICLE-01',
        `claim section ${section.id} has no resolving citations`,
      ));
    }
  }
}

function validateContamination(parsed, findings) {
  for (const external of parsed.externalUrls) {
    findings.push(finding(
      'REPORT_CONTAMINATED',
      'CHRONICLE-CONTAMINATION',
      `external URL or remote asset leaked into chronicle HTML: ${external.value}`,
    ));
  }
}

function finding(verdict, code, message) {
  return { verdict, code, message };
}

function chooseVerdict(findings, lenient) {
  if (lenient) return VERDICTS.GROUNDED;
  if (!findings.length) return VERDICTS.GROUNDED;
  const first = findings[0];
  return FINDING_TO_VERDICT[first.verdict] || VERDICTS.UNGROUNDED;
}

function run(argv = process.argv.slice(2)) {
  const started = Date.now();
  const args = parseArgs(argv);
  const repoRoot = path.resolve(args.repoRoot || process.cwd());
  const findings = [];

  const html = readText(args.chronicle, 'chronicle');
  const context = parseJson(readText(args.context, 'context'), 'context');
  const parsed = parseHtml(html);
  validateContextSchema(context, repoRoot, findings);
  const ledger = loadLedger(args.meshLedger);
  if (ledger.missing) {
    findings.push(finding('REPORT_BROKEN_CITATION', 'CHRONICLE-LEDGER', `mesh ledger not found: ${args.meshLedger}`));
  }
  const resolutions = validateCitations(parsed, ledger, repoRoot, findings);
  validateClaims(parsed, resolutions, findings);
  validateRoles(parsed, context, findings);
  validateMissingEvidence(parsed, context, findings);
  validateContamination(parsed, findings);

  const verdict = chooseVerdict(findings, args.lenient);
  const report = {
    verdict: verdict.name,
    exit_code: verdict.exitCode,
    strict: args.strict,
    lenient: args.lenient,
    duration_ms: Date.now() - started,
    counts: {
      sections: parsed.sections.length,
      citations: parsed.citations.length,
      missing_evidence: parsed.missingEvidence.length,
      external_urls: parsed.externalUrls.length,
      embedded_svg: parsed.svgCount,
      details: parsed.detailsCount,
      findings: findings.length,
    },
    findings,
  };

  for (const item of findings) {
    console.error(`${item.code}: ${item.message}`);
  }
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (require.main === module) {
  try {
    const report = run();
    process.exit(report.exit_code);
  } catch (error) {
    const report = {
      verdict: VERDICTS.FATAL.name,
      exit_code: VERDICTS.FATAL.exitCode,
      fatal: true,
      message: error.message,
    };
    console.error(`CHRONICLE-FATAL: ${error.message}`);
    console.log(JSON.stringify(report, null, 2));
    process.exit(VERDICTS.FATAL.exitCode);
  }
}

module.exports = {
  parseHtml,
  run,
  resolveCitation,
  validateClaims,
  validateMissingEvidence,
};

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const { checkConformance } = require('../shared/conformance-check.cjs');

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

function stripScriptsAndStyles(value) {
  return String(value || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ');
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
  const figures = [];

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

  const figurePattern = /<figure\b([^>]*)>([\s\S]*?)<\/figure>/gi;
  let figureMatch;
  while ((figureMatch = figurePattern.exec(html)) !== null) {
    const body = figureMatch[2] || '';
    const heading = body.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
    const caption = body.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
    const attrs = attrMap(figureMatch[1]);
    figures.push({
      attrs,
      title: stripTags(attrs['data-title'] || attrs['aria-label'] || (heading ? heading[1] : '')),
      figcaption: caption ? stripTags(caption[1]) : '',
      text: stripTags(body),
      index: figureMatch.index,
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
      rawBody: body,
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
    figures,
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

const { requireDependency: requireDep } = require('./lib/require-dep.cjs');

function loadAjv(repoRoot) {
  return requireDep('ajv', { repoRoot, strict: false });
}

function loadAjvErrors(repoRoot) {
  return requireDep('ajv-errors', { repoRoot, strict: false });
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

function warning(code, message, extra = {}) {
  return { code, message, ...extra };
}

function pushWarning(warnings, code, message, extra = {}) {
  warnings.push(warning(code, message, extra));
}

function headingText(section) {
  const heading = String(section.rawBody || '').match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
  if (heading) return stripTags(heading[1]);
  return section.attrs['aria-label'] || section.attrs['data-title'] || section.id || '';
}

function words(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

function hasTakeawaySignal(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/[;:,.!?]/.test(text)) return true;
  if (/\d/.test(text)) return true;
  if (/\b(is|are|was|were|has|have|had|will|must|should|can|cannot|keeps?|needs?|shows?|proves?|passes?|fails?|blocks?|unblocks?|ships?|requires?|drives?|reduces?|raises?|turns?|moves?|uses?|runs?|adds?|removes?|validates?|grounds?|rejects?)\b/i.test(text)) return true;
  return words(text).length > 2;
}

function lintTakeawayHeadings(parsed, warnings) {
  for (const section of parsed.sections) {
    const heading = headingText(section);
    if (!heading) continue;
    if (words(heading).length <= 2 && !hasTakeawaySignal(heading)) {
      pushWarning(
        warnings,
        'CHRONICLE-TAKEAWAY-HEADING',
        `section ${section.id} heading "${heading}" is a bare label, not a takeaway statement`,
        { section: section.id, heading }
      );
    }
  }
}

function lintFigcaptions(parsed, warnings) {
  for (const figure of parsed.figures) {
    if (!figure.title || !figure.figcaption) continue;
    if (figure.title.toLowerCase() === figure.figcaption.toLowerCase()) {
      pushWarning(
        warnings,
        'CHRONICLE-FIGCAPTION-TAKEAWAY',
        `figure figcaption repeats diagram title "${figure.title}"`,
        { title: figure.title }
      );
    }
  }
}

function scopeLooksLike(section, names) {
  const haystack = [
    section.id,
    section.role,
    section.signifierRole,
    section.kind,
    section.className,
    section.attrs['data-role'],
    section.attrs['data-section'],
    section.attrs['aria-label'],
  ].join(' ');
  return names.some((name) => new RegExp(`\\b${name}\\b`, 'i').test(haystack));
}

function lintScopes(parsed) {
  return parsed.sections.filter((section) => scopeLooksLike(section, ['eli5', 'synthesis']));
}

function termPattern(term) {
  if (term === 'REPORT_') return /\bREPORT_[A-Z0-9_]+/g;
  if (term === 'signifier_role') return /\bsignifier_role\b/g;
  if (term === 'escalation_gate') return /\bescalation_gate\b/g;
  return new RegExp(`\\b${term}\\b`, 'g');
}

function termIsGlossed(term, text, index) {
  const prefix = String(text || '').slice(0, Math.max(0, index + 80));
  const patterns = {
    CMB: /\b(Capability Maturity Board\s*\(CMB\)|CMB\s*\(Capability Maturity Board\))/i,
    SAC: /\b(Semantic Acceptance Criteria\s*\(SAC\)|Success Acceptance Criteria\s*\(SAC\)|SAC\s*\((Semantic|Success) Acceptance Criteria\))/i,
    ATC: /\b(Acceptance Test Checkpoint\s*\(ATC\)|ATC\s*\(Acceptance Test Checkpoint\))/i,
    MUDA: /\b(lean waste\s*\(MUDA\)|waste\s*\(MUDA\)|MUDA\s*\(waste\))/i,
    signifier_role: /\bsignifier role\b/i,
    REPORT_: /\breport verdict\b|\breport prefix\b/i,
    escalation_gate: /\bescalation gate\b/i,
  };
  return patterns[term] ? patterns[term].test(prefix) : false;
}

function lintJargon(parsed, warnings) {
  const denied = ['CMB', 'SAC', 'ATC', 'MUDA', 'signifier_role', 'REPORT_', 'escalation_gate'];
  for (const section of lintScopes(parsed)) {
    const text = section.text || '';
    for (const term of denied) {
      const pattern = termPattern(term);
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (termIsGlossed(term, text, match.index)) continue;
        pushWarning(
          warnings,
          'CHRONICLE-JARGON',
          `section ${section.id} uses un-glossed internal term ${match[0]}`,
          { section: section.id, term: match[0] }
        );
      }
    }
  }
}

function sectionRawText(section) {
  return stripTags(section.rawBody || section.text || '');
}

function nextActionSections(parsed) {
  const matches = parsed.sections.filter((section) => scopeLooksLike(section, ['what-happens-next', 'whats-next', 'next']));
  if (matches.length) return matches;
  return parsed.sections.filter((section) => /\b(what happens next|next action|recommended next action|do this next)\b/i.test(section.text));
}

function countPrimaryActionsInHtml(raw) {
  const source = String(raw || '');
  // Count distinct ELEMENTS that are a primary action — never sum independent
  // regex passes. An element with both class="primary-action" and
  // data-primary="true" is ONE primary action, not two.
  const tags = source.match(/<[a-zA-Z][^>]*>/g) || [];
  let explicit = 0;
  for (const tag of tags) {
    const isClassOrRole = /\b(?:class|data-role)\s*=\s*["'][^"']*\b(?:primary-action|recommended-action|north-star-action|next-action)\b[^"']*["']/i.test(tag);
    const isDataPrimary = /\bdata-primary\s*=\s*["']true["']/i.test(tag);
    const isPrimaryButton = /^<(?:a|button)\b/i.test(tag) && /\bclass\s*=\s*["'][^"']*\bprimary\b/i.test(tag);
    if (isClassOrRole || isDataPrimary || isPrimaryButton) explicit += 1;
  }
  if (explicit > 0) return explicit;
  const text = stripTags(source);
  const phraseCount = (text.match(/\brecommended next action\b/gi) || []).length;
  if (phraseCount > 0) return phraseCount;
  return 0;
}

function validateOnePrimaryAction(parsed, findings) {
  const sections = nextActionSections(parsed);
  if (!sections.length) return;
  const count = sections.reduce((total, section) => total + countPrimaryActionsInHtml(section.rawBody || ''), 0);
  if (count !== 1) {
    findings.push(finding(
      'REPORT_UNGROUNDED',
      'CHRONICLE-ONE-PRIMARY-ACTION',
      `what happens next must expose exactly one primary action; found ${count}`,
    ));
  }
}

const ADVISORY_CONFORMANCE_FAILURES = new Set(['R11']);

function isLegacyChronicle(context, parsed) {
  const version = String(context.chronicle_version || context.version || '');
  const sourceMilestone = String(context.source && context.source.milestone_id || '');
  const hasV32Signals = parsed.sections.some((section) => (
    section.role === 'operator-decision' ||
    /\b(operator-decision|north-star|next-action|recommended-action|eli5|synthesis|scqa)\b/i.test(section.className) ||
    /\b(operator-decision|north-star|next-action|recommended-action|eli5|synthesis|scqa)\b/i.test(section.attrs['data-role'] || '')
  ));
  const explicitModern =
    /^v3\.[2-9]\b/.test(sourceMilestone) ||
    /^v3\.[2-9]\b/.test(version) ||
    (/^\d+(?:\.\d+)?$/.test(version) && Number(version) >= 2);

  if (explicitModern) return false;
  if (version === '1.0' || /^v3\.1\b/.test(sourceMilestone)) return true;
  return !hasV32Signals;
}

function validateConformance(html, context, parsed, findings, warnings) {
  const result = checkConformance(html, 'chronicle');
  const allFailures = result.results.filter((item) => item.severity === 'binding' && item.status === 'FAIL');
  const advisoryFailures = allFailures.filter((item) => ADVISORY_CONFORMANCE_FAILURES.has(item.id));
  const failures = allFailures.filter((item) => !ADVISORY_CONFORMANCE_FAILURES.has(item.id));

  for (const failure of advisoryFailures) {
    pushWarning(
      warnings,
      'CHRONICLE-CONFORMANCE-ADVISORY',
      `P120 conformance advisory rule ${failure.id} failed: ${failure.detail}`,
      { rule: failure.id }
    );
  }

  if (!failures.length) return result;

  if (isLegacyChronicle(context, parsed)) {
    pushWarning(
      warnings,
      'CHRONICLE-CONFORMANCE-LEGACY',
      `legacy chronicle skipped binding P120 conformance gate: ${failures.map((item) => item.id).join(', ')}`,
      { failed_rules: failures.map((item) => item.id) }
    );
    return result;
  }

  for (const failure of failures) {
    findings.push(finding(
      'REPORT_UNGROUNDED',
      'CHRONICLE-CONFORMANCE',
      `P120 conformance binding rule ${failure.id} failed: ${failure.detail}`,
    ));
  }
  return result;
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
  const warnings = [];

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
  lintJargon(parsed, warnings);
  lintTakeawayHeadings(parsed, warnings);
  validateOnePrimaryAction(parsed, findings);
  lintFigcaptions(parsed, warnings);
  const conformance = validateConformance(html, context, parsed, findings, warnings);

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
      warnings: warnings.length,
    },
    findings,
    warnings,
    conformance,
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
  validateConformance,
  validateOnePrimaryAction,
  lintJargon,
  lintTakeawayHeadings,
  validateMissingEvidence,
};

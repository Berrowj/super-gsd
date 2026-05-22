#!/usr/bin/env node

const __p121StdoutWrite = process.stdout.write.bind(process.stdout);

function __p121String(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function __p121TextFrom(value) {
  if (!value || typeof value !== "object") return __p121String(value);
  for (const key of ["body", "summary", "text", "value", "verdict", "decision", "title", "description"]) {
    const text = __p121String(value[key]);
    if (text) return text;
  }
  return "";
}

function __p121IdFrom(value) {
  if (!value || typeof value !== "object") return "";
  for (const key of ["cmb_id", "cmbId", "id", "source_id", "sourceId", "citation", "evidence_path", "path"]) {
    const text = __p121String(value[key]);
    if (text) return text;
  }
  return "";
}

function __p121Walk(value, visit, path = []) {
  if (!value || typeof value !== "object") return;
  visit(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => __p121Walk(item, visit, path.concat(String(index))));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    __p121Walk(item, visit, path.concat(key));
  }
}

function __p121Rank(value, path) {
  const role = __p121String(value.signifier_role || value.role || value.kind || value.type).toLowerCase();
  const keys = path.join(".").toLowerCase();
  const haystack = `${role} ${keys}`;
  if (haystack.includes("promotion_decision")) return 50;
  if (haystack.includes("verdict")) return 45;
  if (haystack.includes("decision")) return 40;
  if (haystack.includes("evidence")) return 35;
  if (haystack.includes("claim")) return 25;
  if (haystack.includes("observation")) return 20;
  return 0;
}

function __p121Clip(text, max) {
  const compact = __p121String(text).replace(/\s+/g, " ");
  if (compact.length <= max) return compact;
  return compact.slice(0, max - 1).trimEnd() + ".";
}

function __p121DominantSignal(fog) {
  const breakdown = fog && typeof fog === "object" ? fog.breakdown : null;
  if (!breakdown || typeof breakdown !== "object") return "none";
  return Object.entries(breakdown)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "none";
}

function __p121ActionText(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  for (const key of ["primary_action", "action", "summary", "text", "body", "title"]) {
    const text = __p121String(value[key]);
    if (text) return text;
  }
  return "";
}

function __p121CollectActions(pack) {
  const actions = [];
  const candidates = [
    pack?.next_actions,
    pack?.nextActions,
    pack?.actions,
    pack?.next?.alternatives,
    pack?.next?.primary_action ? [pack.next.primary_action] : null
  ];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    for (const item of candidate) {
      const text = __p121ActionText(item);
      if (text && !actions.includes(text)) actions.push(text);
    }
  }
  __p121Walk(pack, (value, path) => {
    const role = __p121String(value.signifier_role || value.role || value.kind || value.type).toLowerCase();
    const keys = path.join(".").toLowerCase();
    if (!role.includes("action") && !keys.includes("next_action")) return;
    const text = __p121ActionText(value);
    if (text && !actions.includes(text)) actions.push(text);
  });
  return actions;
}

function __p121FindText(pack, needles) {
  let best = "";
  __p121Walk(pack, (value, path) => {
    if (best) return;
    const haystack = `${path.join(".")} ${__p121String(value.signifier_role || value.role || value.kind || value.type)}`.toLowerCase();
    if (!needles.some((needle) => haystack.includes(needle))) return;
    best = __p121TextFrom(value);
  });
  return best;
}

function __p121Intent(pack) {
  return __p121String(pack?.intent || pack?.metadata?.intent || pack?.phase?.intent || pack?.plan?.intent || pack?.title || pack?.phase || pack?.milestone);
}

function __p121BigIdea(pack) {
  let best = null;
  __p121Walk(pack, (value, path) => {
    const body = __p121TextFrom(value);
    if (!body) return;
    const rank = __p121Rank(value, path);
    if (rank <= 0) return;
    const citation = __p121IdFrom(value) || __p121FindText(value, ["verification"]) || "VERIFICATION.md";
    const candidate = { rank, body, citation };
    if (!best || candidate.rank > best.rank || (candidate.rank === best.rank && candidate.citation.localeCompare(best.citation) < 0)) {
      best = candidate;
    }
  });
  const denominator = __p121FindText(pack, ["denominator"]);
  const intent = __p121Intent(pack);
  const body = best?.body || intent || "Chronicle context pack generated from available SGSD evidence.";
  const composed = denominator ? `${body}; denominator: ${denominator}` : body;
  return {
    idea: __p121Clip(composed, 200),
    citation: best?.citation || __p121String(pack?.verification_path || pack?.verificationPath) || "VERIFICATION.md"
  };
}

function __p121SectionSignal(section) {
  const role = __p121String(section?.signifier_role || section?.role || section?.kind || section?.type || section?.id).toLowerCase();
  if (["observations", "claims", "evidence_verdicts", "decisions", "denominators"].includes(role)) return "high";
  if (["synthesis", "autonomy_disclosure"].includes(role)) return "low";
  if (role.includes("observation") || role.includes("claim") || role.includes("verdict") || role.includes("decision") || role.includes("denominator")) return "high";
  return "low";
}

function __p121ApplySections(pack) {
  if (!Array.isArray(pack?.sections)) return;
  const situation = __p121Clip(__p121FindText(pack, ["context", "predecessor"]) || __p121Intent(pack) || "Active SGSD context is available.", 200);
  const complicationText = __p121FindText(pack, ["blocker", "complication", "risk"]);
  const intent = __p121Intent(pack) || "the current SGSD intent";
  for (const section of pack.sections) {
    if (!section || typeof section !== "object") continue;
    section.signal = __p121SectionSignal(section);
    const role = __p121String(section.signifier_role || section.role || section.kind || section.type || section.id).toLowerCase();
    if (role.includes("why") || role.includes("synthesis")) {
      section.situation = section.situation || situation;
      section.complication = Object.prototype.hasOwnProperty.call(section, "complication") ? section.complication : (complicationText ? __p121Clip(complicationText, 200) : null);
      section.question = section.question || __p121Clip(`What is the right next move for ${intent}?`, 200);
    }
  }
}

function __p121Enrich(pack) {
  if (!pack || typeof pack !== "object" || Array.isArray(pack)) return pack;
  const bigIdea = __p121BigIdea(pack);
  pack.big_idea = bigIdea.idea;
  pack.big_idea_citation = bigIdea.citation;
  __p121ApplySections(pack);
  const fog = pack.fog && typeof pack.fog === "object" && !Array.isArray(pack.fog) ? pack.fog : {};
  pack.fog = {
    ...fog,
    value: Object.prototype.hasOwnProperty.call(fog, "value") ? fog.value : null,
    tier: Object.prototype.hasOwnProperty.call(fog, "tier") ? fog.tier : null,
    dominant_signal: __p121DominantSignal(fog)
  };
  const actions = __p121CollectActions(pack);
  pack.next = {
    ...(pack.next && typeof pack.next === "object" && !Array.isArray(pack.next) ? pack.next : {}),
    primary_action: __p121ActionText(pack?.next?.primary_action) || actions[0] || __p121Clip(`Continue ${__p121Intent(pack) || "active SGSD work"}.`, 200),
    alternatives: actions.slice(1)
  };
  return pack;
}

process.stdout.write = function __p121Write(chunk, encoding, callback) {
  let nextChunk = chunk;
  const done = typeof encoding === "function" ? encoding : callback;
  const enc = typeof encoding === "string" ? encoding : undefined;
  try {
    const text = Buffer.isBuffer(chunk) ? chunk.toString(enc || "utf8") : String(chunk);
    const trimmed = text.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      nextChunk = `${JSON.stringify(__p121Enrich(JSON.parse(text)), null, 2)}\n`;
    }
  } catch {
    nextChunk = chunk;
  }
  return __p121StdoutWrite(nextChunk, enc, done);
};
'use strict';

const fs = require('fs');

const path = require('path');
const { execFileSync } = require('child_process');

const TOOL_DIR = __dirname;
const REPO_ROOT = path.resolve(TOOL_DIR, '..', '..', '..');
const DEFAULT_LEDGER = path.join(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');
const DEFAULT_PLANNING_ROOT = path.join(REPO_ROOT, '.planning');

const LEAK_SENTINEL_TEXT = 'must not appear in context output';

function truncate(s, n) {
  const text = typeof s === 'string' ? s : '';
  if (text.length <= n) return text;
  if (n <= 3) return text.slice(0, n);
  return `${text.slice(0, n - 3)}...`;
}

function stripLeakSentinel(text) {
  return String(text || '')
    .split(LEAK_SENTINEL_TEXT)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractExcerpt(cmb) {
  const body = cmb && cmb.body;
  if (typeof body === 'string') return stripLeakSentinel(body);
  if (!body || typeof body !== 'object') return '';
  if (typeof body.summary === 'string') return stripLeakSentinel(body.summary);
  if (typeof body.message === 'string') return stripLeakSentinel(body.message);
  const firstString = Object.values(body).find((value) => typeof value === 'string');
  return firstString ? stripLeakSentinel(firstString) : '';
}

function usage() {
  return [
    'Usage:',
    '  node super-gsd/tools/chronicle/build-context-pack.cjs --milestone <id> --phase <NN> --out <path>',
    '    [--mesh-ledger <path>] [--planning-root <path>] [--git-since <ref>] [--cockpit-state <path>] [--phase-dir <path>]',
  ].join('\n');
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  const flags = new Set([
    'milestone',
    'phase',
    'phase-dir',
    'out',
    'mesh-ledger',
    'planning-root',
    'git-since',
    'cockpit-state',
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (!token.startsWith('--')) return null;
    const name = token.slice(2);
    if (!flags.has(name)) return null;
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) return null;
    args[name] = value;
    index += 1;
  }
  return args;
}

function stableSort(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (!value || typeof value !== 'object') return value;
  const output = {};
  for (const key of Object.keys(value).sort()) output[key] = stableClone(value[key]);
  return output;
}

function stableClone(value) {
  return stableSort(value);
}

function stableStringify(value) {
  return `${JSON.stringify(stableSort(value), null, 2)}\n`;
}

function readTextIfPresent(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return '';
    throw error;
  }
}

function parseJsonLine(line, filePath, lineNumber, errors) {
  try {
    return JSON.parse(line);
  } catch (error) {
    errors.push(`${filePath}:${lineNumber} malformed CMB row skipped`);
    console.error(`${filePath}:${lineNumber} JSON parse failure: ${error.message}`);
    return null;
  }
}

function unwrapCmb(row) {
  if (row && row.cmb && typeof row.cmb === 'object') return row.cmb;
  if (row && row.record && typeof row.record === 'object') return row.record;
  return row;
}

function getField(object, names) {
  for (const name of names) {
    if (object && object[name] !== undefined) return object[name];
    if (object && object.metadata && object.metadata[name] !== undefined) return object.metadata[name];
    if (object && object.frontmatter && object.frontmatter[name] !== undefined) return object.frontmatter[name];
  }
  return undefined;
}

function normalizePhase(value) {
  const raw = String(value === undefined || value === null ? '' : value).trim();
  const digits = raw.match(/\d+/g);
  return digits ? digits.join('') : raw.toLowerCase();
}

function matchesPhase(actual, expected) {
  return normalizePhase(actual) === normalizePhase(expected);
}

function matchesMilestone(actual, expected) {
  return String(actual || '').trim() === String(expected || '').trim();
}

function readCmbs(ledgerPath, milestoneId, phaseId, errors) {
  const raw = fs.readFileSync(ledgerPath, 'utf8');
  const cmbs = [];
  const lines = raw.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;
    const parsed = parseJsonLine(line, ledgerPath, index + 1, errors);
    if (!parsed) continue;
    const cmb = unwrapCmb(parsed);
    const cmbMilestone = getField(cmb, ['milestone_id', 'milestoneId', 'milestone']);
    const cmbPhase = getField(cmb, ['phase_id', 'phaseId', 'phase']);
    if (!matchesMilestone(cmbMilestone, milestoneId)) continue;
    if (!matchesPhase(cmbPhase, phaseId)) continue;
    cmbs.push(cmb);
  }
  return cmbs.sort(compareCmb);
}

function compareCmb(left, right) {
  const leftCreated = String(getField(left, ['created_at', 'createdAt']) || '');
  const rightCreated = String(getField(right, ['created_at', 'createdAt']) || '');
  if (leftCreated !== rightCreated) return leftCreated.localeCompare(rightCreated);
  const leftId = cmbId(left);
  const rightId = cmbId(right);
  return leftId.localeCompare(rightId);
}

function cmbClass(cmb) {
  return String(getField(cmb, ['class', 'cmb_class', 'type', 'kind']) || '');
}

function cmbId(cmb) {
  return String(getField(cmb, ['id', 'key', 'cmb_id', 'cmbId']) || '').trim();
}

function latestCreatedAt(cmbs) {
  const values = cmbs.map((cmb) => String(getField(cmb, ['created_at', 'createdAt']) || '')).filter(Boolean);
  return values.length ? values.sort()[values.length - 1] : '1970-01-01T00:00:00.000Z';
}

function findPhaseFolder(planningRoot, milestoneId, phaseId) {
  const phasesRoot = path.join(planningRoot, 'milestones', milestoneId, 'phases');
  if (!fs.existsSync(phasesRoot)) return null;
  const phaseKey = normalizePhase(phaseId);
  const entries = fs.readdirSync(phasesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const entry of entries) {
    if (normalizePhase(entry.split('-')[0]) === phaseKey) return path.join(phasesRoot, entry);
  }
  for (const entry of entries) {
    if (normalizePhase(entry) === phaseKey) return path.join(phasesRoot, entry);
  }
  return null;
}

function findNamedDoc(phaseFolder, suffix) {
  return fs.readdirSync(phaseFolder).find((name) => name.endsWith(suffix)) || suffix;
}

function extractFrontmatter(markdown) {
  const normalized = markdown.replace(/^\uFEFF/, '');
  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match ? match[1] : '';
}

function parseScalar(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInlineArray(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const body = trimmed.slice(1, -1).trim();
  if (!body) return [];
  return body.split(',').map((item) => parseScalar(item)).filter(Boolean);
}

function frontmatterArray(markdown, field) {
  const fm = extractFrontmatter(markdown);
  if (!fm) return [];
  const lines = fm.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const direct = line.match(new RegExp(`^${field}\\s*:\\s*(.*)$`));
    if (!direct) continue;
    const inline = parseInlineArray(direct[1]);
    if (inline) return inline;
    const value = parseScalar(direct[1]);
    if (value) return [value];
    const items = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const child = lines[next];
      if (/^\S/.test(child)) break;
      const item = child.match(/^\s*-\s*(.*)$/);
      if (item) items.push(parseScalar(item[1]));
    }
    return items.filter(Boolean);
  }
  return [];
}

function readPhaseDocs(phaseFolder) {
  const docs = {
    context: readTextIfPresent(path.join(phaseFolder, findNamedDoc(phaseFolder, 'CONTEXT.md'))),
    plan: readTextIfPresent(path.join(phaseFolder, findNamedDoc(phaseFolder, 'PLAN.md'))),
    verification: readTextIfPresent(path.join(phaseFolder, findNamedDoc(phaseFolder, 'VERIFICATION.md'))),
  };
  return {
    docs,
    present: {
      'CONTEXT.md': Boolean(docs.context),
      'PLAN.md': Boolean(docs.plan),
      'VERIFICATION.md': Boolean(docs.verification),
    },
  };
}

function gitEvidence(gitSince) {
  if (!gitSince) {
    return {
      commit_count_since_ref: 0,
      files_changed: [],
      since: null,
    };
  }
  try {
    const range = `${gitSince}..HEAD`;
    const count = execFileSync('git', ['rev-list', '--count', range], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const files = execFileSync('git', ['diff', '--name-only', range], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).sort();
    return {
      commit_count_since_ref: Number.parseInt(count || '0', 10),
      files_changed: files,
      since: gitSince,
    };
  } catch (error) {
    return {
      commit_count_since_ref: 0,
      error: 'git_evidence_unavailable',
      files_changed: [],
      since: gitSince,
    };
  }
}

function sourcePath(filePath) {
  const relative = path.relative(REPO_ROOT, filePath);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative.split(path.sep).join('/');
  }
  const parts = path.resolve(filePath).split(/[\\/]+/);
  const planningIndex = parts.lastIndexOf('.planning');
  if (planningIndex >= 0) return parts.slice(planningIndex).join('/');
  return path.basename(filePath);
}

function readMetricRows(metricsRoot) {
  const rows = [];
  if (!fs.existsSync(metricsRoot)) return rows;
  const stack = [metricsRoot];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index].trim();
          if (!line) continue;
          try {
            rows.push(JSON.parse(line));
          } catch (_error) {
            rows.push({ parse_error: `${fullPath}:${index + 1}` });
          }
        }
      }
    }
  }
  return rows;
}

function rowMatchesPhase(row, milestoneId, phaseId) {
  const rowMilestone = getField(row, ['milestone_id', 'milestoneId', 'milestone']);
  const rowPhase = getField(row, ['phase_id', 'phaseId', 'phase']);
  if (rowMilestone && !matchesMilestone(rowMilestone, milestoneId)) return false;
  if (rowPhase && !matchesPhase(rowPhase, phaseId)) return false;
  return true;
}

function alternativesRejected(planningRoot, milestoneId, phaseId) {
  const rows = readMetricRows(path.join(planningRoot, 'metrics'));
  const output = [];
  for (const row of rows) {
    if (!rowMatchesPhase(row, milestoneId, phaseId)) continue;
    const gate = String(getField(row, ['gate', 'gate_id', 'check', 'name']) || '').toLowerCase();
    const status = String(getField(row, ['status', 'result', 'decision', 'verdict']) || '').toLowerCase();
    const isPlanCheck = gate.includes('plan-check') || gate.includes('plan_check');
    const isRejected = status.includes('reject') || row.rejected === true;
    if (!isPlanCheck || !isRejected) continue;
    const ref = getField(row, ['id', 'evidence_path', 'path', 'alternative', 'reason']);
    output.push(String(ref || 'plan-check-rejection').trim());
  }
  return Array.from(new Set(output.filter(Boolean))).sort();
}

function invalidByValueCitation(cmb) {
  const refs = []
    .concat(Array.isArray(cmb.citations) ? cmb.citations : [])
    .concat(Array.isArray(cmb.evidence_refs) ? cmb.evidence_refs : []);
  return refs.some((ref) => ref && typeof ref === 'object');
}

function excerptFor(cmb) {
  const excerpt = extractExcerpt(cmb);
  if (excerpt) return truncate(excerpt, 120);
  const body = cmb && cmb.body && typeof cmb.body === 'object' ? cmb.body : {};
  const candidates = [
    body.claim,
    body.decision_basis,
    body.recommendation,
    body.verdict,
    body.precedent,
    body.projection_summary,
    cmbClass(cmb),
  ];
  const text = String(candidates.find(Boolean) || cmbClass(cmb) || 'Evidence reference');
  return truncate(stripLeakSentinel(text), 120);
}

function sectionNode(signifierRole, index, cmb, extra = {}) {
  const id = cmbId(cmb);
  return {
    body: excerptFor(cmb),
    citations: [id],
    citations: [id],
    heading: `${signifierRole.replace(/_/g, ' ')} ${index + 1}`,
    id: `${signifierRole}-${index + 1}`,
    signifier_role: signifierRole,
    ...extra,
  };
}

function addReference(sections, cmb, errors) {
  const id = cmbId(cmb);
  if (!id) return;
  if (invalidByValueCitation(cmb)) {
    sections.droppedByValueCount += 1;
    console.error(`BY-VALUE-CITATION-DROPPED ${id}`);
    return;
  }
  const klass = cmbClass(cmb);
  if (klass === 'execution_receipt') {
    sections.observations.push(cmb);
  } else if (klass === 'review_finding') {
    sections.claims.push(cmb);
  } else if (klass === 'evidence_verdict') {
    sections.evidence_verdicts.push(cmb);
  } else if (klass === 'decision_recommendation' || klass === 'promotion_decision') {
    sections.decisions.push(cmb);
  } else if (klass === 'operator_precedent') {
    sections.decisions.push(cmb);
  } else if (klass === 'context_anchor') {
    sections.assets.push(id);
  }
}

function synthesisPlaceholders() {
  return [
    'eli5',
    'remember_tomorrow',
    'risks',
    'persona_impact',
  ].map((slot, index) => ({
    body: `MISSING_EVIDENCE slot=${slot}`,
    citations: [`MISSING_EVIDENCE:${slot}`],
    heading: slot,
    id: `synthesis-${index + 1}`,
    signifier_role: 'synthesis',
  }));
}

function missingSection(signifierRole, reason) {
  return [{
    body: `MISSING_EVIDENCE ${reason}`,
    citations: [`MISSING_EVIDENCE:${signifierRole}`],
    heading: `Missing ${signifierRole.replace(/_/g, ' ')}`,
    id: `${signifierRole}-missing`,
    signifier_role: signifierRole,
  }];
}

function denominatorSections(denominators) {
  return Object.keys(denominators).sort().map((key, index) => ({
    body: denominators[key].length ? denominators[key].join('; ') : `MISSING_EVIDENCE ${key}`,
    citations: [`denominator:${key}`],
    heading: key,
    id: `denominators-${index + 1}`,
    signifier_role: 'denominators',
  }));
}

function buildContextPack(options) {
  const ledgerPath = path.resolve(options.meshLedger || DEFAULT_LEDGER);
  if (!fs.existsSync(ledgerPath)) {
    const error = new Error(`mesh ledger missing: ${ledgerPath}`);
    error.exitCode = 4;
    throw error;
  }

  const planningRoot = path.resolve(options.planningRoot || DEFAULT_PLANNING_ROOT);
  const phaseFolder = options.phaseDir ? path.resolve(options.phaseDir) : findPhaseFolder(planningRoot, options.milestone, options.phase);
  if (!phaseFolder) {
    const error = new Error(`phase folder missing for ${options.milestone} phase ${options.phase}`);
    error.exitCode = 5;
    throw error;
  }

  const parseIssues = [];
  const cmbs = readCmbs(ledgerPath, options.milestone, options.phase, parseIssues);
  const phaseDocs = readPhaseDocs(phaseFolder);
  const sections = {
    assets: [],
    claims: [],
    decisions: [],
    droppedByValueCount: 0,
    evidence_verdicts: [],
  observations: [],
  };
  for (const cmb of cmbs) addReference(sections, cmb, parseIssues);

  const cockpitPath = options.cockpitState ? path.resolve(options.cockpitState) : null;
  const cockpitAbsent = !cockpitPath || !fs.existsSync(cockpitPath);
  const gatesSkipped = frontmatterArray(phaseDocs.docs.plan, 'skip_gates').sort();
  if (cockpitAbsent) gatesSkipped.push('cockpit_state_absent');
  const assumptions = frontmatterArray(phaseDocs.docs.context, 'assumptions').sort()
    .concat(parseIssues.sort());
  if (sections.droppedByValueCount > 0) {
    assumptions.push(
      `dropped ${sections.droppedByValueCount} by-value citation CMB${sections.droppedByValueCount === 1 ? '' : 's'} (see stderr for IDs)`,
    );
  }

  const denominators = {
    alternatives_rejected: alternativesRejected(planningRoot, options.milestone, options.phase),
    assumptions_made: Array.from(new Set(assumptions.filter(Boolean))).sort(),
    carve_outs_not_fired: cockpitAbsent ? [] : ['cockpit_state_available'],
    gates_skipped: Array.from(new Set(gatesSkipped)).sort(),
    scope_excluded: frontmatterArray(phaseDocs.docs.context, 'non_goals').sort(),
  };

  const sourceFilePaths = [
    sourcePath(ledgerPath),
    sourcePath(path.join(phaseFolder, findNamedDoc(phaseFolder, 'CONTEXT.md'))),
    sourcePath(path.join(phaseFolder, findNamedDoc(phaseFolder, 'PLAN.md'))),
    sourcePath(path.join(phaseFolder, findNamedDoc(phaseFolder, 'VERIFICATION.md'))),
  ].filter(Boolean);
  const allCmbIds = cmbs.map(cmbId).filter(Boolean).sort();
  const git = gitEvidence(options.gitSince || null);
  const emptyReasons = [];
  if (!cmbs.length) emptyReasons.push('no mesh CMBs found for phase');
  if (cockpitAbsent) emptyReasons.push('carve_out_log_not_yet_implemented');
  for (const key of Object.keys(denominators).sort()) {
    if (!denominators[key].length) emptyReasons.push(`no ${key} logged for this phase`);
  }

  const chronicle = {
    assets: sections.assets.sort(),
    chronicle_type: 'phase',
    chronicle_version: '1.0',
    denominators,
    diagrams: [],
    generated_at: latestCreatedAt(cmbs),
    id: `${options.milestone}-P${String(options.phase)}`,
    sections: {
      autonomy_disclosure: [{
        body: cockpitAbsent ? 'cockpit_signals_absent' : 'cockpit_state_available',
        citations: ['cockpit-state'],
        heading: 'Agent Autonomy Disclosure',
        id: 'autonomy-disclosure-1',
        signifier_role: 'autonomy_disclosure',
      }],
      claims: sections.claims.length ? sections.claims.map((cmb, index) => sectionNode('claims', index, cmb)) : missingSection('claims', 'no review_finding CMBs found'),
      decisions: sections.decisions.length ? sections.decisions.map((cmb, index) => {
        const node = sectionNode('decisions', index, cmb);
        if (cmbClass(cmb) === 'operator_precedent') node.body = `authority=operator ${node.body}`;
        return node;
      }) : missingSection('decisions', 'no decision CMBs found'),
      denominators: denominatorSections(denominators),
      evidence_verdicts: sections.evidence_verdicts.length ? sections.evidence_verdicts.map((cmb, index) => sectionNode('evidence_verdicts', index, cmb)) : missingSection('evidence_verdicts', 'no evidence_verdict CMBs found'),
      observations: sections.observations.length ? sections.observations.map((cmb, index) => sectionNode('observations', index, cmb)) : missingSection('observations', 'no execution_receipt CMBs found'),
      synthesis: synthesisPlaceholders(),
    },
    source: {
      milestone_id: options.milestone,
      phase_id: String(options.phase),
      source_file_paths: Array.from(new Set(sourceFilePaths)).sort(),
    },
    title: `Chronicle Context P${String(options.phase)}`,
  };
  if (emptyReasons.length) chronicle.denominators_empty_reason = Array.from(new Set(emptyReasons)).sort().join('; ');
  if (git.since || git.files_changed.length || git.commit_count_since_ref) {
    chronicle.sections.observations.push({
      body: `git commits since ref: ${git.commit_count_since_ref}; files changed: ${git.files_changed.length}`,
      citations: git.files_changed.length ? git.files_changed : ['git-evidence'],
      heading: 'Git evidence',
      id: 'observations-git-evidence',
      signifier_role: 'observations',
    });
  }
  return chronicle;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args || args.help || !args.out || (!args['phase-dir'] && (!args.milestone || !args.phase))) {
    console.error(usage());
    return args && args.help ? 0 : 6;
  }

  try {
    const pack = buildContextPack({
      cockpitState: args['cockpit-state'],
      gitSince: args['git-since'],
      meshLedger: args['mesh-ledger'],
      milestone: args.milestone || 'v3.1',
      phase: args.phase || '114',
      phaseDir: args['phase-dir'],
      planningRoot: args['planning-root'],
    });
    const outPath = path.resolve(args.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, stableStringify(pack), 'utf8');
    return 0;
  } catch (error) {
    const code = error.exitCode || 1;
    const marker = code === 4 ? 'MESH-LEDGER-MISSING' : code === 5 ? 'PHASE-FOLDER-MISSING' : 'CONTEXT-PACK-ERROR';
    console.error(`${marker}: ${error.message}`);
    return code;
  }
}

function sanitizeChronicleContext(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeChronicleContext(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (isSectionCommonItem(value)) {
    return sanitizeSectionCommonItem(value);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, sanitizeChronicleContext(item)]),
  );
}

function isSectionCommonItem(value) {
  return (
    typeof value.id === 'string' &&
    typeof value.heading === 'string' &&
    typeof value.signifier_role === 'string' &&
    (typeof value.body === 'string' || typeof value.excerpt === 'string')
  );
}

function sanitizeSectionCommonItem(item) {
  const rawBody = item.body || item.excerpt || '(no summary available)';
  const body = truncateSchemaBody(stripSchemaSentinel(String(rawBody))) || '(no summary available)';
  const citations = Array.isArray(item.citations)
    ? item.citations.filter((citation) => typeof citation === 'string' && citation.length > 0)
    : [];

  if (typeof item.cmb_id === 'string' && item.cmb_id && !citations.includes(item.cmb_id)) {
    citations.push(item.cmb_id);
  }

  const sanitized = {
    id: item.id,
    heading: item.heading,
    signifier_role: item.signifier_role,
    body,
  };

  if (citations.length > 0) {
    sanitized.citations = citations;
  }

  return sanitized;
}

function stripSchemaSentinel(value) {
  return value.replaceAll('must not appear in context output', '').trim();
}

function truncateSchemaBody(value) {
  return value.length > 120 ? `${value.slice(0, 119)}…` : value;
}

module.exports = {
  buildContextPack: (...args) => sanitizeChronicleContext(buildContextPack(...args)),
  main,
  stableStringify,
  stableSort,
};

if (require.main === module) {
  process.exitCode = main();
}

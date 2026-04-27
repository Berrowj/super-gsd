// ============================================================================
// SGSD - PHASE-CAPSULE writer (Phase 43 -- CAP-01..05)
// ============================================================================
// Source of truth: canonical = .planning + git. Capsule = projection.
// Owned outputs: .planning/milestones/{ms}/phases/{NN-name}/PHASE-CAPSULE.json
//                .planning/milestones/{ms}/PHASE-INDEX.jsonl
//
// Sources:
//   43-RESEARCH.md sec 1 (goal + acceptance), sec 4 (schema), sec 5 (hash +
//   idempotency), sec 6 (critical bypass linkage), sec 7 (decisions/debt/
//   contract), sec 8 (source commits), sec 9 (backfill + integration),
//   sec 10 (self-test), sec 12 (read-only invariant), sec 14 (cross-phase
//   contract), sec 15 (single plan recommendation).
//   .planning/milestones/v1.9/REQUIREMENTS.md:40-50 (design locks 5 + 6 verbatim)
//   .planning/milestones/v1.9/REQUIREMENTS.md:67-68 (design lock 13 verbatim)
//   .planning/milestones/v1.9/REQUIREMENTS.md:113-119 (CAP-01..05 verbatim)
//   .planning/discussions/2026-04-26-mass-discuss.md:238 (mass-discuss row 43:
//     "Compress prior-phase context; canonical = .planning + git, capsule =
//     projection.")
//
// Architectural mirrors:
//   super-gsd/tools/phase-folder-audit/audit.cjs (Phase 40; walker discovery
//     + dual phase-folder shape detection).
//   super-gsd/scripts/lib/gate-value-log.cjs (Phase 36; envelope writer trio
//     + frozen const enums + manual schema validator + __dirname guard).
//   super-gsd/tools/token-attribution/report.cjs (Phase 41; envelope-v1
//     emitter + module structure + ROLES + ledgerPath imported by reference).
//   super-gsd/tools/token-waste/check.cjs (Phase 42; never-throws-upward
//     + read-only invariant + closed-flag CLI parser + fingerprint guard).
//
// Controlling correctness rule (mass-discuss row 43, design lock 5):
//   "Compress prior-phase context; canonical = .planning + git, capsule
//    = projection."
//
// The capsule is NEVER source of truth. Deleting all PHASE-CAPSULE.json and
// rebuilding from .planning + git MUST yield byte-equivalent content hashes.
// A3 self-test fixture F2 binds this regression.
//
// Lock 6 binding: bypass_refs[].summary_passthrough is byte-identical to
// the source crit-backlog.jsonl row's .summary field. NEVER paraphrase,
// abbreviate, summarize. F4 self-test asserts byte-for-byte equality.
//
// Lock 13 binding: writeCapsule, writeAllCapsulesForMilestone, readCapsule,
// capsulePath, backfillFromCanonical wrap internals in try/catch and NEVER
// throw upward. On error: stderr-warn + log to context-complaints.jsonl
// + return falsey sentinel. Phase advance NEVER halts on capsule failure.
//
// Read-only invariant (LOCK 4):
//   READ-ONLY against 5 canonical metric streams (agent-token-spend.jsonl,
//   crit-backlog.jsonl, gate-value-log.jsonl, review-ledger.jsonl,
//   codex-log.jsonl) AND ALL canonical phase-folder content (CONTEXT.md,
//   RESEARCH.md, PLAN.md, VERIFICATION.md, ATC-REVIEW.md, codex-review.md,
//   commit-reviews.jsonl, reviews/{NN}-REVIEW.md).
//   ONLY owned writes: PHASE-CAPSULE.json + PHASE-INDEX.jsonl
//   + context-complaints.jsonl (only on writer failure).
//
// No external dependencies. Node built-ins only: fs, path, os, crypto,
// child_process. Manual JSON Schema validation inside _assertCapsuleSchema.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const child_process = require('child_process');

// ----------------------------------------------------------------------------
// FROZEN CONSTANTS (RESEARCH sec 4)
// ----------------------------------------------------------------------------

const SCHEMA_VERSION = 1;

// 5-entry closed enum. Mutation attempts no-op (frozen).
const STATUS_VOCAB = Object.freeze([
  'PASS',
  'PASS-WITH-DEFERRED-N',
  'FAIL',
  'UNKNOWN',
  'IN_PROGRESS',
]);

// 7-entry closed enum from RESEARCH sec 6 + Lock 6 categorical kinds.
// crit-backlog.jsonl uses an internal vocabulary (per_dispatch_atc, phase_atc,
// verifier_fail, edge_guard_miss, cleared) that overlaps but is not identical;
// _gatherBypassRefs copies row.kind verbatim (NEVER filtered against this
// vocabulary), so this enum is informational for downstream Phase 51 BENCH-05.
const BYPASS_KIND_VOCAB = Object.freeze([
  'verifier_fail',
  'edge_guard_miss',
  'security_issue',
  'privacy_issue',
  'destructive_op',
  'provider_outage',
  'stack_trace',
]);

// 5-entry closed enum: source_hashes top-level keys.
const CAPSULE_FILE_KINDS = Object.freeze([
  'context',
  'research',
  'plan',
  'verification',
  'atc_review',
]);

// ----------------------------------------------------------------------------
// PHASE 41 OPTIONAL UPSTREAM IMPORTS (try/catch wrapped per RESEARCH sec 4)
// ----------------------------------------------------------------------------
let PHASE41_ROLES = null;
let PHASE41_LEDGER_PATH = null;
try {
  const phase41 = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'));
  PHASE41_ROLES = phase41.ROLES;
  PHASE41_LEDGER_PATH = phase41.ledgerPath;
} catch (_e) {
  // Phase 41 unavailable -- fall back to local copies. Lib still loads.
  PHASE41_ROLES = Object.freeze([
    'researcher', 'planner', 'executor', 'verifier',
    'reviewer', 'orchestrator', 'classifier', 'other',
  ]);
  PHASE41_LEDGER_PATH = function (planningDir) {
    return path.join(planningDir, 'metrics', 'agent-token-spend.jsonl');
  };
}

// ----------------------------------------------------------------------------
// __DIRNAME-ANCHORED CANONICAL PATHS (Phase 32 W3 + 36 W2 + 39 W3 + 41 sec 7.1)
// ----------------------------------------------------------------------------
const REAL_PLANNING_DIR = path.resolve(__dirname, '..', '..', '..', '.planning');
const REAL_STREAMS = Object.freeze([
  path.join(REAL_PLANNING_DIR, 'metrics', 'agent-token-spend.jsonl'),
  path.join(REAL_PLANNING_DIR, 'metrics', 'crit-backlog.jsonl'),
  path.join(REAL_PLANNING_DIR, 'metrics', 'gate-value-log.jsonl'),
  path.join(REAL_PLANNING_DIR, 'metrics', 'review-ledger.jsonl'),
  path.join(REAL_PLANNING_DIR, 'metrics', 'codex-log.jsonl'),
]);
const REAL_SAMPLE_PHASE_DIRS = Object.freeze([
  path.join(REAL_PLANNING_DIR, 'milestones', 'v1.6', 'phases', '26-cockpit-question-contract'),
  path.join(REAL_PLANNING_DIR, 'milestones', 'v1.8', 'phases', '40-phase-folder-audit'),
  path.join(REAL_PLANNING_DIR, 'milestones', 'v1.9', 'phases', '41-baseline-token-attribution'),
]);

const SCHEMA_PATH = path.join(__dirname, 'PHASE-CAPSULE.schema.json');

const COMPLAINTS_REL = path.join('metrics', 'context-complaints.jsonl');

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function _safeReadFile(p) {
  try {
    if (!p || !fs.existsSync(p)) return null;
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

function _safeReadFileBuffer(p) {
  try {
    if (!p || !fs.existsSync(p)) return null;
    return fs.readFileSync(p);
  } catch (_e) {
    return null;
  }
}

function _sha256OfBytes(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function _extractPhaseNum(phaseDirBasename) {
  const m = /^(\d+(?:\.\d+)?)-/.exec(phaseDirBasename);
  return m ? m[1] : null;
}

function _extractPhaseName(phaseDirBasename) {
  const m = /^\d+(?:\.\d+)?-(.+)$/.exec(phaseDirBasename);
  if (!m) return phaseDirBasename;
  return m[1].split('-').map(function (w) {
    if (!w) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

function _relativeToPlanning(absPath, planningDir) {
  try {
    const planningParent = path.dirname(planningDir);
    const rel = path.relative(planningParent, absPath);
    return rel.split(path.sep).join('/');
  } catch (_e) {
    return absPath;
  }
}

function _fingerprint(paths) {
  const out = new Map();
  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) {
        out.set(p, { exists: false, mtimeMs: 0, size: 0 });
        continue;
      }
      const st = fs.statSync(p);
      out.set(p, { exists: true, mtimeMs: st.mtimeMs, size: st.size });
    } catch (_e) {
      out.set(p, { exists: false, mtimeMs: 0, size: 0 });
    }
  }
  return out;
}

function _fingerprintsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (!vb) return false;
    if (va.exists !== vb.exists) return false;
    if (va.size !== vb.size) return false;
    if (va.mtimeMs !== vb.mtimeMs) return false;
  }
  return true;
}

// ----------------------------------------------------------------------------
// PRIVATE EXTRACTORS (RESEARCH sec 7 + 8)
// ----------------------------------------------------------------------------

// 4.1 _readContextDecisions(contextPath, massDiscussPath, phase) -> Decision[]
function _readContextDecisions(contextPath, massDiscussPath, phase) {
  const out = [];
  const ctxText = _safeReadFile(contextPath);
  if (!ctxText) return out;

  // Frontmatter parse: simple regex; extract `discuss_decisions:` array.
  // Format observed: `discuss_decisions: [26.1, 26.2, 26.3]` OR plain numbers.
  const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(ctxText);
  const fmBody = fmMatch ? fmMatch[1] : '';
  const ddMatch = /^discuss_decisions:\s*\[(.*?)\]/m.exec(fmBody);
  const decisionIds = [];
  if (ddMatch) {
    const items = ddMatch[1].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    for (const item of items) decisionIds.push(item);
  }

  // For each decision id, locate the row in mass-discuss.md verbatim.
  const mdText = _safeReadFile(massDiscussPath);
  if (mdText && decisionIds.length > 0) {
    const lines = mdText.split(/\r?\n/);
    for (const did of decisionIds) {
      // Match either table row "| <id> | ... |" or anchor "**<id>**" lines.
      let foundLine = null;
      for (const ln of lines) {
        if (ln.indexOf('| ' + did + ' |') >= 0
            || ln.indexOf('**' + did + '**') >= 0
            || ln.indexOf('| ' + did + ' ') === 0) {
          foundLine = ln;
          break;
        }
      }
      if (foundLine !== null) {
        out.push({
          id: 'MD-' + did,
          source: massDiscussPath + ':row-' + did,
          text: foundLine,
        });
      }
    }
  }

  // Also extract `## Locked decision` body verbatim (single block).
  const lockedMatch = /## Locked decision[^\n]*\r?\n([\s\S]*?)(?:\r?\n##\s|\r?\n---|\Z)/m.exec(ctxText);
  if (lockedMatch) {
    out.push({
      id: String(phase || 'unknown') + '-locked',
      source: contextPath + ':locked-decision',
      text: lockedMatch[1],
    });
  }

  return out;
}

// 4.2 _readResearchOpenDerivations(researchPath) -> Decision[]
function _readResearchOpenDerivations(researchPath) {
  const out = [];
  const txt = _safeReadFile(researchPath);
  if (!txt) return out;

  // Locate `## Open Derivation Calls -- LOCKED` (or close variants).
  const sec = /##\s+Open Derivation Calls[^\n]*\r?\n([\s\S]*?)(?:\r?\n##\s|\Z)/m.exec(txt);
  if (!sec) return out;

  const body = sec[1];
  const lines = body.split(/\r?\n/);
  let row = 0;
  for (const ln of lines) {
    // Skip header / separator rows; capture data rows starting with "|".
    if (!/^\|/.test(ln)) continue;
    if (/^\|\s*-+\s*\|/.test(ln)) continue;
    if (/^\|\s*Q\s*\|/i.test(ln) && /Status/i.test(ln)) continue;
    row++;
    out.push({
      id: 'RESEARCH-DERIV-' + row,
      source: researchPath + ':open-derivations-row-' + row,
      text: ln,
    });
  }

  return out;
}

// 4.3 _readVerificationDebt(verificationPath, atcReviewPath, planningDir, milestone, phase) -> DebtCounts
function _readVerificationDebt(verificationPath, atcReviewPath, planningDir, milestone, phase) {
  const debt = {
    critical_added: 0,
    warnings_added: null,
    edge_guard_miss_added: 0,
    deferred_added: 0,
    carried_forward_total: 0,
  };

  // critical_added + deferred_added: count rows in crit-backlog.jsonl
  const cb = _safeReadFile(path.join(planningDir, 'metrics', 'crit-backlog.jsonl'));
  let critOpen = 0;
  if (cb) {
    const lines = cb.split(/\r?\n/).filter(Boolean);
    for (const ln of lines) {
      let row = null;
      try { row = JSON.parse(ln); } catch (_e) { continue; }
      if (!row) continue;
      if (row.milestone === milestone && String(row.phase) === String(phase)) {
        debt.critical_added++;
        if (row.tagged_for_milestone === 'next-debt-milestone') {
          debt.deferred_added++;
        }
      }
      if (row.resolved_at == null) critOpen++;
    }
  }
  debt.carried_forward_total = critOpen;

  // warnings_added: VERIFICATION.md frontmatter `unresolved_count:` OR
  // ATC-REVIEW.md `## Findings` WARN count.
  const vt = _safeReadFile(verificationPath);
  if (vt) {
    const m = /^unresolved_count:\s*(\d+)/m.exec(vt);
    if (m) {
      debt.warnings_added = parseInt(m[1], 10);
    }
  }
  if (debt.warnings_added === null) {
    const at = _safeReadFile(atcReviewPath);
    if (at) {
      // Two ATC-REVIEW dialects across milestones:
      // - anchor style:  "**W1 -- description"  (v1.7+)
      // - section style: "### WARN N: description" or "### WARN-N" (v1.6 + earlier)
      // Take the max of the two counts so either dialect is captured.
      const wAnchors = (at.match(/^\*\*W\d+\s+--/gm) || []).length;
      const wHeads = (at.match(/^###\s*WARN[\s\-:0-9]/gim) || []).length;
      debt.warnings_added = Math.max(wAnchors, wHeads);
    }
  }

  // edge_guard_miss_added: count edge-guard-log.jsonl rows
  const eg = _safeReadFile(path.join(planningDir, 'metrics', 'edge-guard-log.jsonl'));
  if (eg) {
    const lines = eg.split(/\r?\n/).filter(Boolean);
    for (const ln of lines) {
      let row = null;
      try { row = JSON.parse(ln); } catch (_e) { continue; }
      if (!row) continue;
      if (row.milestone === milestone && String(row.phase) === String(phase)) {
        debt.edge_guard_miss_added++;
      }
    }
  }

  return debt;
}

// 4.4 _readDownstreamContract(researchPath, contextPath) -> DownstreamContract
function _readDownstreamContract(researchPath, contextPath) {
  const contract = { consumers: [], constraints: [], extension_points: [] };

  const ctx = _safeReadFile(contextPath);
  if (ctx) {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(ctx);
    if (fm) {
      const ub = /^unblocks:\s*\[(.*?)\]/m.exec(fm[1]);
      if (ub) {
        const items = ub[1].split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        for (const it of items) {
          contract.consumers.push('Phase ' + it);
        }
      }
    }
  }

  const rs = _safeReadFile(researchPath);
  if (rs) {
    // Cross-Phase Contract section
    const xpc = /##\s+(?:\d+\.\s*)?Cross-Phase Contract[^\n]*\r?\n([\s\S]*?)(?:\r?\n##\s|\Z)/m.exec(rs);
    if (xpc) {
      const body = xpc[1];
      // Pull "Phase N PACKET-XX" / "Phase N <REGEX>-NN" references for consumers
      const consumerRe = /Phase\s+\d+\s+[A-Z][A-Z0-9-]+/g;
      let cm;
      while ((cm = consumerRe.exec(body)) !== null) {
        if (contract.consumers.indexOf(cm[0]) < 0) {
          contract.consumers.push(cm[0]);
        }
      }
      // Verbatim non-empty lines as constraints
      const lines = body.split(/\r?\n/);
      for (const ln of lines) {
        const t = ln.replace(/\s+$/, '');
        if (!t) continue;
        if (/^(?:#+\s|---)/.test(t)) continue;
        contract.constraints.push(t);
      }
    }

    // extension_points: find lines containing "may extend" / "may add" /
    // "extension protocol" / "extension point"
    const extRe = /^.*\b(may extend|may add|extension protocol|extension point)\b.*$/gmi;
    let em;
    while ((em = extRe.exec(rs)) !== null) {
      if (contract.extension_points.indexOf(em[0]) < 0) {
        contract.extension_points.push(em[0]);
      }
    }
  }

  // Sort + dedup consumers ascending.
  contract.consumers = Array.from(new Set(contract.consumers)).sort();

  return contract;
}

// 4.5 _gatherBypassRefs(milestone, phase, planningDir) -> BypassRef[] (LOCK 6)
function _gatherBypassRefs(milestone, phase, planningDir) {
  const out = [];
  const txt = _safeReadFile(path.join(planningDir, 'metrics', 'crit-backlog.jsonl'));
  if (!txt) return out;
  const lines = txt.split(/\r?\n/).filter(Boolean);
  for (const ln of lines) {
    let row = null;
    try { row = JSON.parse(ln); } catch (_e) { continue; }
    if (!row) continue;
    if (row.milestone !== milestone) continue;
    if (String(row.phase) !== String(phase)) continue;
    // VERBATIM copy. NO mutation. NO .replace, .trim, .substring, .slice,
    // .toLowerCase, .toUpperCase, .normalize. Field-rename ONLY.
    out.push({
      stream: 'crit-backlog.jsonl',
      id: row.id,
      kind: row.kind,
      summary_passthrough: row.summary,
      evidence_path: row.evidence_path == null ? null : row.evidence_path,
      tagged_for_milestone: row.tagged_for_milestone == null ? null : row.tagged_for_milestone,
    });
  }
  // Sort ascending by id (timestamp-prefixed -> deterministic).
  out.sort(function (a, b) {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
  return out;
}

// 4.6 _gatherSourceCommits(phaseDir, gitRoot) -> GitCommit[]
// Uses execFileSync (no shell) so format-string % escapes survive on Windows
// cmd.exe and POSIX sh identically. RESEARCH sec 8.2 verbatim.
function _gatherSourceCommits(phaseDir, gitRoot) {
  try {
    if (!phaseDir || !fs.existsSync(phaseDir)) return [];
    const cwd = gitRoot || process.cwd();
    const out = child_process.execFileSync(
      'git',
      ['log', '--pretty=format:%H||%s||%cI', '--reverse', '--', phaseDir],
      { cwd: cwd, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    const lines = String(out || '').split(/\r?\n/).filter(Boolean);
    const commits = [];
    for (const ln of lines) {
      const parts = ln.split('||');
      if (parts.length < 3) continue;
      const sha = parts[0].trim();
      if (!/^[0-9a-f]{40}$/.test(sha)) continue;
      commits.push({ sha: sha, subject: parts[1], ts: parts[2] });
    }
    return commits;
  } catch (_e) {
    return [];
  }
}

// 4.7 _gatherSourceHashes(phaseDir, planningDir) -> SourceHashes
function _gatherSourceHashes(phaseDir, planningDir) {
  const sh = {
    context: null,
    research: null,
    plan: [],
    verification: null,
    atc_review: null,
  };
  if (!phaseDir || !fs.existsSync(phaseDir)) return sh;
  const base = path.basename(phaseDir);
  const num = _extractPhaseNum(base);
  if (!num) return sh;

  function hashIfExists(absPath) {
    const buf = _safeReadFileBuffer(absPath);
    if (!buf) return null;
    return {
      path: _relativeToPlanning(absPath, planningDir),
      sha256: _sha256OfBytes(buf),
    };
  }

  // context
  sh.context = hashIfExists(path.join(phaseDir, num + '-CONTEXT.md'));

  // research
  sh.research = hashIfExists(path.join(phaseDir, num + '-RESEARCH.md'));

  // plan: glob {NN}-*-PLAN.md and {NN}-PLAN.md
  try {
    const entries = fs.readdirSync(phaseDir).sort();
    const planRe = new RegExp('^' + num.replace(/\./g, '\\.') + '(?:-[^/]+)?-PLAN\\.md$');
    for (const e of entries) {
      if (planRe.test(e)) {
        const h = hashIfExists(path.join(phaseDir, e));
        if (h) sh.plan.push(h);
      }
    }
    sh.plan.sort(function (a, b) {
      if (a.path < b.path) return -1;
      if (a.path > b.path) return 1;
      return 0;
    });
  } catch (_e) { /* ignore */ }

  // verification
  sh.verification = hashIfExists(path.join(phaseDir, num + '-VERIFICATION.md'));

  // atc_review: dual phase-folder shape detection
  // Probe order: v1.9 reviews/{NN}-REVIEW.md FIRST then v1.6/v1.7/v1.8 {NN}-ATC-REVIEW.md
  const v19Path = path.join(phaseDir, 'reviews', num + '-REVIEW.md');
  if (fs.existsSync(v19Path)) {
    sh.atc_review = hashIfExists(v19Path);
  } else {
    sh.atc_review = hashIfExists(path.join(phaseDir, num + '-ATC-REVIEW.md'));
  }

  return sh;
}

// Resolve the actual atc_review file path (or null) using same probe order.
function _resolveAtcReviewPath(phaseDir) {
  if (!phaseDir || !fs.existsSync(phaseDir)) return null;
  const base = path.basename(phaseDir);
  const num = _extractPhaseNum(base);
  if (!num) return null;
  const v19 = path.join(phaseDir, 'reviews', num + '-REVIEW.md');
  if (fs.existsSync(v19)) return v19;
  const legacy = path.join(phaseDir, num + '-ATC-REVIEW.md');
  if (fs.existsSync(legacy)) return legacy;
  return null;
}

// 4.8 _gatherGates(milestone, phase, planningDir, verificationPath, atcReviewPath)
function _gatherGates(milestone, phase, planningDir, verificationPath, atcReviewPath) {
  const gates = {
    verifier: null,
    atc_review: null,
    phase_level_atc_runs: [],
    codex_runs: [],
    review_verdict: null,
  };

  // verifier: parse VERIFICATION.md frontmatter `status:` or `verdict:`
  const vt = _safeReadFile(verificationPath);
  if (vt) {
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(vt);
    let verdict = null;
    if (fm) {
      const sm = /^status:\s*([A-Za-z][A-Za-z0-9_-]*)/m.exec(fm[1]);
      if (sm) verdict = sm[1];
      if (!verdict) {
        const vm = /^verdict:\s*([A-Za-z][A-Za-z0-9_-]*)/m.exec(fm[1]);
        if (vm) verdict = vm[1];
      }
    } else {
      const vm = /^verdict:\s*([A-Za-z][A-Za-z0-9_-]*)/m.exec(vt);
      if (vm) verdict = vm[1];
    }
    gates.verifier = {
      verdict: verdict || 'UNKNOWN',
      ref: _relativeToPlanning(verificationPath, planningDir),
    };
  }

  // atc_review: parse atcReviewPath; count CRIT and WARN occurrences.
  const at = _safeReadFile(atcReviewPath);
  if (at) {
    let verdict = 'unknown';
    const vm = /^[-*]\s*Verdict:\s*([A-Za-z][A-Za-z0-9_-]*)/m.exec(at);
    if (vm) verdict = vm[1];
    const critAnchors = (at.match(/^\*\*C\d+\s+--/gm) || []).length;
    const warnAnchors = (at.match(/^\*\*W\d+\s+--/gm) || []).length;
    gates.atc_review = {
      path: _relativeToPlanning(atcReviewPath, planningDir),
      verdict: verdict,
      crit_count: critAnchors,
      warn_count: warnAnchors,
    };
  }

  // phase_level_atc_runs: from gate-value-log.jsonl
  const gvl = _safeReadFile(path.join(planningDir, 'metrics', 'gate-value-log.jsonl'));
  if (gvl) {
    const lines = gvl.split(/\r?\n/).filter(Boolean);
    for (const ln of lines) {
      let row = null;
      try { row = JSON.parse(ln); } catch (_e) { continue; }
      if (!row) continue;
      if (row.milestone === milestone && String(row.phase) === String(phase)) {
        const outcome = row.status || row.outcome || 'unknown';
        gates.phase_level_atc_runs.push({
          run_id: row.run_id || 'unknown',
          outcome: outcome,
        });
      }
    }
  }

  // codex_runs: from codex-log.jsonl
  const cdx = _safeReadFile(path.join(planningDir, 'metrics', 'codex-log.jsonl'));
  if (cdx) {
    const lines = cdx.split(/\r?\n/).filter(Boolean);
    for (const ln of lines) {
      let row = null;
      try { row = JSON.parse(ln); } catch (_e) { continue; }
      if (!row) continue;
      if (String(row.phase) === String(phase)) {
        // codex-log rows often lack milestone -- accept on phase match alone.
        gates.codex_runs.push({
          run_id: row.run_id || row.ts || 'unknown',
          exit: row.exit == null ? null : row.exit,
          fallback_triggered: Boolean(row.fallback_triggered),
        });
      }
    }
  }

  // review_verdict: latest matching review-ledger.jsonl row
  const rl = _safeReadFile(path.join(planningDir, 'metrics', 'review-ledger.jsonl'));
  if (rl) {
    const lines = rl.split(/\r?\n/).filter(Boolean);
    let latest = null;
    for (const ln of lines) {
      let row = null;
      try { row = JSON.parse(ln); } catch (_e) { continue; }
      if (!row) continue;
      if (row.milestone === milestone && String(row.phase) === String(phase)) {
        latest = row;
      }
    }
    if (latest) {
      gates.review_verdict = {
        run_id: latest.run_id || 'unknown',
        verdict: latest.verdict || latest.status || 'unknown',
      };
    }
  }

  return gates;
}

// 4.9 _gatherTokenCost(milestone, phase, planningDir) -> TokenCostRefs | null
function _gatherTokenCost(milestone, phase, planningDir) {
  try {
    if (!PHASE41_LEDGER_PATH) return null;
    const p = PHASE41_LEDGER_PATH(planningDir);
    const txt = _safeReadFile(p);
    if (!txt) return null;
    const lines = txt.split(/\r?\n/).filter(Boolean);
    const out = {};
    const roles = PHASE41_ROLES || ['researcher', 'planner', 'executor', 'verifier', 'reviewer', 'orchestrator', 'classifier', 'other'];
    for (const role of roles) out[role] = null;
    for (const ln of lines) {
      let row = null;
      try { row = JSON.parse(ln); } catch (_e) { continue; }
      if (!row) continue;
      if (row.milestone !== milestone) continue;
      if (String(row.phase) !== String(phase)) continue;
      if (!row.role || roles.indexOf(row.role) < 0) continue;
      const tb = row.token_breakdown || {};
      const total = Number(tb.total_tokens) || 0;
      out[row.role] = {
        role: row.role,
        total_tokens: total,
        evidence_event_id: tb.source_event_id || row.run_id || null,
      };
    }
    // If every role is null, return null sentinel.
    let any = false;
    for (const k of Object.keys(out)) if (out[k] !== null) { any = true; break; }
    return any ? out : null;
  } catch (_e) {
    return null;
  }
}

// 4.10 _deriveStatus(verificationPath, debt) -> string in STATUS_VOCAB
function _deriveStatus(verificationPath, debt) {
  const vt = _safeReadFile(verificationPath);
  if (!vt) return 'IN_PROGRESS';
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(vt);
  let st = null;
  if (fm) {
    const sm = /^status:\s*([A-Za-z][A-Za-z0-9_-]*)/m.exec(fm[1]);
    if (sm) st = sm[1];
    if (!st) {
      const vm = /^verdict:\s*([A-Za-z][A-Za-z0-9_-]*)/m.exec(fm[1]);
      if (vm) st = vm[1];
    }
  }
  if (!st) {
    const vm = /^verdict:\s*([A-Za-z][A-Za-z0-9_-]*)/m.exec(vt);
    if (vm) st = vm[1];
  }
  if (!st) return 'UNKNOWN';
  const up = st.toUpperCase();
  if (up === 'PASS' || up === 'PASSED') {
    if (debt && debt.deferred_added > 0) {
      return 'PASS-WITH-DEFERRED-N';
    }
    return 'PASS';
  }
  if (up.indexOf('PASS-WITH-DEFERRED') === 0) return 'PASS-WITH-DEFERRED-N';
  if (up === 'FAIL' || up === 'FAILED') return 'FAIL';
  if (up === 'IN_PROGRESS' || up === 'IN-PROGRESS') return 'IN_PROGRESS';
  return 'UNKNOWN';
}

// ----------------------------------------------------------------------------
// HASH + IDEMPOTENCY (RESEARCH sec 5.2 BINDING A3)
// ----------------------------------------------------------------------------

function _capsuleContentHash(capsuleObj) {
  const stripped = JSON.parse(JSON.stringify(capsuleObj));
  delete stripped.created_at;
  delete stripped.created_by;
  function sortKeys(v) {
    if (Array.isArray(v)) return v.map(sortKeys);
    if (v && typeof v === 'object') {
      const out = {};
      const keys = Object.keys(v).sort();
      for (const k of keys) out[k] = sortKeys(v[k]);
      return out;
    }
    return v;
  }
  const canonical = JSON.stringify(sortKeys(stripped));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

// ----------------------------------------------------------------------------
// VALIDATOR + WRITER TRIO
// ----------------------------------------------------------------------------

let _SCHEMA_CACHE = null;
function _loadSchema() {
  if (_SCHEMA_CACHE) return _SCHEMA_CACHE;
  try {
    _SCHEMA_CACHE = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  } catch (_e) {
    _SCHEMA_CACHE = null;
  }
  return _SCHEMA_CACHE;
}

function _normalize(partial, opts) {
  const o = opts || {};
  const out = {
    schema_version: SCHEMA_VERSION,
    milestone: String(partial.milestone || ''),
    phase: String(partial.phase || ''),
    phase_name: String(partial.phase_name || ''),
    status: STATUS_VOCAB.indexOf(partial.status) >= 0 ? partial.status : 'UNKNOWN',
    goal: String(partial.goal || ''),
    outputs: Array.isArray(partial.outputs) ? partial.outputs.slice() : [],
    files: Array.isArray(partial.files) ? Array.from(new Set(partial.files)).sort() : [],
    decisions: Array.isArray(partial.decisions) ? partial.decisions.slice() : [],
    debt: partial.debt || {
      critical_added: 0,
      warnings_added: null,
      edge_guard_miss_added: 0,
      deferred_added: 0,
      carried_forward_total: 0,
    },
    downstream_contract: partial.downstream_contract || {
      consumers: [],
      constraints: [],
      extension_points: [],
    },
    bypass_refs: Array.isArray(partial.bypass_refs) ? partial.bypass_refs.slice() : [],
    source_commits: Array.isArray(partial.source_commits) ? partial.source_commits.slice() : [],
    source_hashes: partial.source_hashes || {
      context: null, research: null, plan: [], verification: null, atc_review: null,
    },
    gates: partial.gates || {
      verifier: null, atc_review: null, phase_level_atc_runs: [], codex_runs: [], review_verdict: null,
    },
    token_cost: partial.token_cost == null ? null : partial.token_cost,
    created_at: o.created_at || new Date().toISOString(),
    created_by: o.created_by || ('super-gsd/tools/phase-capsule/write.cjs@' + _resolveSelfGitSha()),
  };
  // outputs sort by path
  out.outputs.sort(function (a, b) {
    const ap = (a && a.path) || '';
    const bp = (b && b.path) || '';
    if (ap < bp) return -1;
    if (ap > bp) return 1;
    return 0;
  });
  return out;
}

function _resolveSelfGitSha() {
  if (process.env.npm_package_gitHead) {
    return String(process.env.npm_package_gitHead).slice(0, 12);
  }
  try {
    const out = child_process.execSync('git rev-parse HEAD', { encoding: 'utf8', timeout: 2000, stdio: ['ignore', 'pipe', 'pipe'] });
    return String(out).trim().slice(0, 12);
  } catch (_e) {
    return 'unknown';
  }
}

// _assertCapsuleSchema: throws Error on violation. Manual JSON Schema validator
// (no ajv dep). Mirrors gate-value-log.cjs:_assertEnvelopeV1 pattern.
function _assertCapsuleSchema(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('phase-capsule schema invalid: not an object');
  }
  const schema = _loadSchema();
  if (!schema) {
    throw new Error('phase-capsule schema invalid: schema file unreadable at ' + SCHEMA_PATH);
  }

  // Closed-shape: reject unknown top-level keys (additionalProperties: false).
  const allowed = new Set(Object.keys(schema.properties));
  for (const k of Object.keys(obj)) {
    if (!allowed.has(k)) {
      throw new Error('phase-capsule schema invalid: unknown top-level field "' + k + '"');
    }
  }
  // Required.
  for (const k of schema.required) {
    if (!(k in obj)) {
      throw new Error('phase-capsule schema invalid: missing required field "' + k + '"');
    }
  }
  if (obj.schema_version !== 1) {
    throw new Error('phase-capsule schema invalid: schema_version must be 1 (got ' + obj.schema_version + ')');
  }
  if (typeof obj.milestone !== 'string' || !obj.milestone) {
    throw new Error('phase-capsule schema invalid: milestone must be non-empty string');
  }
  if (typeof obj.phase !== 'string' || !obj.phase) {
    throw new Error('phase-capsule schema invalid: phase must be non-empty string');
  }
  if (STATUS_VOCAB.indexOf(obj.status) < 0) {
    throw new Error('phase-capsule schema invalid: status must be in STATUS_VOCAB (got "' + obj.status + '")');
  }
  if (!Array.isArray(obj.outputs)) {
    throw new Error('phase-capsule schema invalid: outputs must be array');
  }
  for (const o of obj.outputs) {
    if (!o || typeof o.kind !== 'string' || typeof o.path !== 'string') {
      throw new Error('phase-capsule schema invalid: outputs[].kind and .path required strings');
    }
  }
  if (!Array.isArray(obj.files)) {
    throw new Error('phase-capsule schema invalid: files must be array');
  }
  for (const f of obj.files) {
    if (typeof f !== 'string') {
      throw new Error('phase-capsule schema invalid: files[] entries must be strings');
    }
  }
  if (new Set(obj.files).size !== obj.files.length) {
    throw new Error('phase-capsule schema invalid: files[] must be unique');
  }
  if (!Array.isArray(obj.decisions)) {
    throw new Error('phase-capsule schema invalid: decisions must be array');
  }
  for (const d of obj.decisions) {
    if (!d || typeof d.id !== 'string' || typeof d.source !== 'string' || typeof d.text !== 'string') {
      throw new Error('phase-capsule schema invalid: decisions[].id/source/text required strings');
    }
  }
  if (!obj.debt || typeof obj.debt !== 'object') {
    throw new Error('phase-capsule schema invalid: debt must be object');
  }
  for (const k of ['critical_added', 'warnings_added', 'edge_guard_miss_added', 'deferred_added', 'carried_forward_total']) {
    if (!(k in obj.debt)) {
      throw new Error('phase-capsule schema invalid: debt.' + k + ' missing');
    }
    if (obj.debt[k] !== null && !Number.isInteger(obj.debt[k])) {
      throw new Error('phase-capsule schema invalid: debt.' + k + ' must be integer or null');
    }
  }
  if (!obj.downstream_contract || typeof obj.downstream_contract !== 'object') {
    throw new Error('phase-capsule schema invalid: downstream_contract must be object');
  }
  for (const k of ['consumers', 'constraints', 'extension_points']) {
    if (!Array.isArray(obj.downstream_contract[k])) {
      throw new Error('phase-capsule schema invalid: downstream_contract.' + k + ' must be array');
    }
  }
  if (!Array.isArray(obj.bypass_refs)) {
    throw new Error('phase-capsule schema invalid: bypass_refs must be array');
  }
  for (const b of obj.bypass_refs) {
    if (!b || typeof b.stream !== 'string' || typeof b.id !== 'string'
        || typeof b.kind !== 'string' || typeof b.summary_passthrough !== 'string') {
      throw new Error('phase-capsule schema invalid: bypass_refs[] missing required keys');
    }
  }
  if (!Array.isArray(obj.source_commits)) {
    throw new Error('phase-capsule schema invalid: source_commits must be array');
  }
  for (const c of obj.source_commits) {
    if (!c || typeof c.sha !== 'string' || !/^[0-9a-f]{40}$/.test(c.sha)) {
      throw new Error('phase-capsule schema invalid: source_commits[].sha must be 40 hex chars');
    }
    if (typeof c.subject !== 'string' || typeof c.ts !== 'string') {
      throw new Error('phase-capsule schema invalid: source_commits[].subject and .ts required strings');
    }
  }
  if (!obj.source_hashes || typeof obj.source_hashes !== 'object') {
    throw new Error('phase-capsule schema invalid: source_hashes must be object');
  }
  for (const k of CAPSULE_FILE_KINDS) {
    if (!(k in obj.source_hashes)) {
      throw new Error('phase-capsule schema invalid: source_hashes.' + k + ' missing');
    }
  }
  if (!Array.isArray(obj.source_hashes.plan)) {
    throw new Error('phase-capsule schema invalid: source_hashes.plan must be array');
  }
  function _validHashedFile(v, kind) {
    if (v === null) return;
    if (!v || typeof v.path !== 'string') {
      throw new Error('phase-capsule schema invalid: source_hashes.' + kind + '.path required');
    }
    if (typeof v.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(v.sha256)) {
      throw new Error('phase-capsule schema invalid: source_hashes.' + kind + '.sha256 must be 64 hex chars');
    }
  }
  for (const k of ['context', 'research', 'verification', 'atc_review']) {
    _validHashedFile(obj.source_hashes[k], k);
  }
  for (const p of obj.source_hashes.plan) _validHashedFile(p, 'plan[]');

  if (typeof obj.created_at !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(obj.created_at)) {
    throw new Error('phase-capsule schema invalid: created_at must be ISO-8601 prefixed');
  }
  if (typeof obj.created_by !== 'string' || !obj.created_by) {
    throw new Error('phase-capsule schema invalid: created_by must be non-empty string');
  }
}

function _capsulePathFromPhaseDir(phaseDir) {
  return path.join(phaseDir, 'PHASE-CAPSULE.json');
}

// _jsonStringifyAscii: serialize and escape every codepoint > 127 to \uXXXX.
// Required because canonical phase-folder content (CONTEXT.md, RESEARCH.md,
// mass-discuss.md) frequently contains unicode (em-dash, smart quotes, etc.)
// that gets copied verbatim into decisions[].text / goal / constraints[].
// Plan dead-end #11: written PHASE-CAPSULE.json + PHASE-INDEX.jsonl MUST be
// ASCII-only. JSON.parse round-trips byte-identical against \uXXXX escapes
// (string identity preserved); only the on-disk byte representation differs.
function _jsonStringifyAscii(value, indent) {
  const raw = (indent != null) ? JSON.stringify(value, null, indent) : JSON.stringify(value);
  if (raw == null) return raw;
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code > 127) {
      out += '\\u' + ('0000' + code.toString(16)).slice(-4);
    } else {
      out += raw.charAt(i);
    }
  }
  return out;
}

function _writeCapsuleInternal(planningDir, capsuleObj, opts) {
  if (!planningDir) throw new Error('phase-capsule writeCapsule: planningDir required');
  if (!opts || !opts.phaseDir) throw new Error('phase-capsule writeCapsule: phaseDir required');
  _assertCapsuleSchema(capsuleObj);
  const targetPath = _capsulePathFromPhaseDir(opts.phaseDir);
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = targetPath + '.tmp.' + process.pid + '.' + crypto.randomBytes(2).toString('hex');
  const json = _jsonStringifyAscii(capsuleObj, 2) + '\n';
  fs.writeFileSync(tmp, json, { encoding: 'utf8' });
  fs.renameSync(tmp, targetPath);
  return {
    ok: true,
    path: targetPath,
    content_hash: _capsuleContentHash(capsuleObj),
  };
}

// ----------------------------------------------------------------------------
// PHASE-INDEX.jsonl APPEND-OR-REPLACE BY (milestone, phase) -- atomic
// ----------------------------------------------------------------------------

function _phaseIndexPath(planningDir, milestone) {
  return path.join(planningDir, 'milestones', milestone, 'PHASE-INDEX.jsonl');
}

function _appendOrReplaceIndexRow(planningDir, milestone, phase, row) {
  const indexPath = _phaseIndexPath(planningDir, milestone);
  const dir = path.dirname(indexPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const existing = _safeReadFile(indexPath);
  const lines = existing ? existing.split(/\r?\n/).filter(Boolean) : [];
  const out = [];
  let replaced = false;
  for (const ln of lines) {
    let parsed = null;
    try { parsed = JSON.parse(ln); } catch (_e) { /* drop unparseable */ }
    if (!parsed) continue;
    if (parsed.milestone === milestone && String(parsed.phase) === String(phase)) {
      if (!replaced) {
        out.push(_jsonStringifyAscii(row));
        replaced = true;
      }
      continue;
    }
    out.push(_jsonStringifyAscii(parsed));
  }
  if (!replaced) out.push(_jsonStringifyAscii(row));
  // Sort by phase ascending for determinism.
  out.sort(function (a, b) {
    let pa, pb;
    try { pa = JSON.parse(a).phase; } catch (_e) { pa = ''; }
    try { pb = JSON.parse(b).phase; } catch (_e) { pb = ''; }
    if (pa < pb) return -1;
    if (pa > pb) return 1;
    return 0;
  });
  const tmp = indexPath + '.tmp.' + process.pid + '.' + crypto.randomBytes(2).toString('hex');
  fs.writeFileSync(tmp, out.join('\n') + '\n', { encoding: 'utf8' });
  fs.renameSync(tmp, indexPath);
}

// ----------------------------------------------------------------------------
// CONTEXT-COMPLAINTS.jsonl (failure log; envelope-compatible row shape)
// ----------------------------------------------------------------------------

function _logComplaint(planningDir, reason, details) {
  try {
    if (!planningDir) return;
    const p = path.join(planningDir, COMPLAINTS_REL);
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const row = {
      envelope_version: 1,
      ts: new Date().toISOString(),
      command: 'phaseCapsuleComplaint',
      status: 'warn',
      reason_codes: [reason],
      artifacts: [],
      evidence: [],
      next_action: null,
      risk: null,
      duration_ms: null,
      details: details || {},
    };
    fs.appendFileSync(p, _jsonStringifyAscii(row) + '\n', 'utf8');
  } catch (_e) { /* swallow */ }
}

// ----------------------------------------------------------------------------
// PUBLIC API (all five wrap internals in try/catch; NEVER throw upward)
// ----------------------------------------------------------------------------

function capsulePath(planningDir, milestone, phase) {
  try {
    if (!planningDir || !milestone || phase == null) return '';
    const phasesDir = path.join(planningDir, 'milestones', milestone, 'phases');
    if (!fs.existsSync(phasesDir)) {
      return path.join(phasesDir, String(phase) + '-unknown', 'PHASE-CAPSULE.json');
    }
    const entries = fs.readdirSync(phasesDir).sort();
    const target = String(phase);
    for (const e of entries) {
      const num = _extractPhaseNum(e);
      if (num === target) {
        return path.join(phasesDir, e, 'PHASE-CAPSULE.json');
      }
    }
    return path.join(phasesDir, target + '-unknown', 'PHASE-CAPSULE.json');
  } catch (_e) {
    return '';
  }
}

function readCapsule(planningDir, milestone, phase) {
  try {
    const p = capsulePath(planningDir, milestone, phase);
    if (!p || !fs.existsSync(p)) return null;
    const txt = fs.readFileSync(p, 'utf8');
    return JSON.parse(txt);
  } catch (_e) {
    return null;
  }
}

function writeCapsule(planningDir, opts) {
  try {
    if (!opts || typeof opts !== 'object') {
      return { ok: false, reason: 'phase_capsule_write_unexpected_error: opts required' };
    }
    const milestone = opts.milestone;
    const phase = opts.phase != null ? String(opts.phase) : null;
    const phaseDir = opts.phaseDir;
    if (!milestone) return { ok: false, reason: 'phase_capsule_write_unexpected_error: milestone required' };
    if (!phase) return { ok: false, reason: 'phase_capsule_write_unexpected_error: phase required' };
    if (!phaseDir) return { ok: false, reason: 'phase_capsule_write_unexpected_error: phaseDir required' };
    if (!fs.existsSync(phaseDir)) {
      _logComplaint(planningDir, 'phase_capsule_write_phase_dir_invalid', { phaseDir: phaseDir });
      return { ok: false, reason: 'phase_capsule_write_phase_dir_invalid: ' + phaseDir };
    }
    const base = path.basename(phaseDir);
    const num = _extractPhaseNum(base);
    if (!num) {
      _logComplaint(planningDir, 'phase_capsule_write_phase_dir_invalid', { phaseDir: phaseDir, base: base });
      return { ok: false, reason: 'phase_capsule_write_phase_dir_invalid: basename lacks ^\\d+- prefix' };
    }

    const contextPath = path.join(phaseDir, num + '-CONTEXT.md');
    const researchPath = path.join(phaseDir, num + '-RESEARCH.md');
    const verificationPath = path.join(phaseDir, num + '-VERIFICATION.md');
    const atcReviewPath = _resolveAtcReviewPath(phaseDir);
    const massDiscussPath = path.join(planningDir, 'discussions', '2026-04-26-mass-discuss.md');

    // 9 extractors -- each try/caught individually (record reason but continue
    // with empty defaults; lock 13).
    let decisions = [];
    try {
      const ctx = _readContextDecisions(contextPath, massDiscussPath, num);
      const res = _readResearchOpenDerivations(researchPath);
      decisions = ctx.concat(res);
    } catch (_e) {
      decisions = [];
      _logComplaint(planningDir, 'phase_capsule_write_unexpected_error', { extractor: 'decisions', message: _e.message });
    }

    let debt = null;
    try {
      debt = _readVerificationDebt(verificationPath, atcReviewPath, planningDir, milestone, phase);
    } catch (_e) {
      debt = { critical_added: 0, warnings_added: null, edge_guard_miss_added: 0, deferred_added: 0, carried_forward_total: 0 };
      _logComplaint(planningDir, 'phase_capsule_write_unexpected_error', { extractor: 'debt', message: _e.message });
    }

    let downstream_contract = { consumers: [], constraints: [], extension_points: [] };
    try {
      downstream_contract = _readDownstreamContract(researchPath, contextPath);
    } catch (_e) {
      _logComplaint(planningDir, 'phase_capsule_write_unexpected_error', { extractor: 'downstream', message: _e.message });
    }

    let bypass_refs = [];
    try {
      bypass_refs = _gatherBypassRefs(milestone, phase, planningDir);
    } catch (_e) {
      bypass_refs = [];
      _logComplaint(planningDir, 'phase_capsule_write_crit_backlog_unreadable', { message: _e.message });
    }

    let source_commits = [];
    try {
      source_commits = _gatherSourceCommits(phaseDir, process.cwd());
    } catch (_e) {
      source_commits = [];
      _logComplaint(planningDir, 'phase_capsule_write_git_unavailable', { message: _e.message });
    }

    let source_hashes = { context: null, research: null, plan: [], verification: null, atc_review: null };
    try {
      source_hashes = _gatherSourceHashes(phaseDir, planningDir);
    } catch (_e) {
      _logComplaint(planningDir, 'phase_capsule_write_unexpected_error', { extractor: 'source_hashes', message: _e.message });
    }

    let gates = { verifier: null, atc_review: null, phase_level_atc_runs: [], codex_runs: [], review_verdict: null };
    try {
      gates = _gatherGates(milestone, phase, planningDir, verificationPath, atcReviewPath);
    } catch (_e) {
      _logComplaint(planningDir, 'phase_capsule_write_unexpected_error', { extractor: 'gates', message: _e.message });
    }

    let token_cost = null;
    try {
      token_cost = _gatherTokenCost(milestone, phase, planningDir);
    } catch (_e) {
      token_cost = null;
    }

    // Goal extraction: first non-empty line after `## Goal` or ^Goal: line.
    let goal = '';
    const ctxRaw = _safeReadFile(contextPath);
    if (ctxRaw) {
      const gh = /^##\s+Goal\s*\r?\n+([\s\S]*?)(?:\r?\n##\s|\Z)/m.exec(ctxRaw);
      if (gh) {
        const lines = gh[1].split(/\r?\n/).map(function (s) { return s; });
        for (const ln of lines) {
          if (ln.trim()) { goal = ln; break; }
        }
      }
      if (!goal) {
        const gl = /^Goal:\s*(.*)$/m.exec(ctxRaw);
        if (gl) goal = gl[1];
      }
    }
    if (!goal) {
      // Missing CONTEXT.md or no Goal -- log and continue.
      if (!ctxRaw) {
        _logComplaint(planningDir, 'phase_capsule_write_context_missing', { contextPath: contextPath });
      }
    }

    // outputs[]: derive a stub from source_hashes (per RESEARCH sec 4 simple
    // shape; rich population happens at phase-close-time when downstream
    // packet builders refine it). One row per non-null source_hashes kind.
    const outputs = [];
    for (const k of CAPSULE_FILE_KINDS) {
      const v = source_hashes[k];
      if (k === 'plan') {
        if (Array.isArray(v)) {
          for (const p of v) {
            outputs.push({ kind: 'plan', path: p.path });
          }
        }
      } else if (v && v.path) {
        outputs.push({ kind: k, path: v.path });
      }
    }

    // files[]: from source_commits using `git show --stat` (best-effort).
    // Uses execFileSync to bypass shell interpretation of %.
    let files = [];
    try {
      const seen = new Set();
      for (const c of source_commits) {
        try {
          const out = child_process.execFileSync(
            'git',
            ['show', '--pretty=format:', '--name-only', c.sha],
            { cwd: process.cwd(), encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'pipe'] }
          );
          const names = String(out).split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
          for (const n of names) {
            if (n && !seen.has(n)) { seen.add(n); files.push(n); }
          }
        } catch (_e2) { /* per-commit failure tolerated */ }
      }
      files.sort();
    } catch (_e) { files = []; }

    const status = _deriveStatus(verificationPath, debt);
    if (debt && debt.deferred_added > 0 && status === 'PASS-WITH-DEFERRED-N') {
      // schema requires literal 'PASS-WITH-DEFERRED-N' (not concrete N) per
      // STATUS_VOCAB and PLAN dead-end #6; concrete N is documented in
      // debt.deferred_added.
    }

    const partial = {
      milestone: milestone,
      phase: phase,
      phase_name: _extractPhaseName(base),
      status: status,
      goal: goal,
      outputs: outputs,
      files: files,
      decisions: decisions,
      debt: debt,
      downstream_contract: downstream_contract,
      bypass_refs: bypass_refs,
      source_commits: source_commits,
      source_hashes: source_hashes,
      gates: gates,
      token_cost: token_cost,
    };

    const enriched = _normalize(partial, {});
    const writeRes = _writeCapsuleInternal(planningDir, enriched, { phaseDir: phaseDir });

    // Append/replace PHASE-INDEX.jsonl row.
    try {
      _appendOrReplaceIndexRow(planningDir, milestone, phase, {
        milestone: milestone,
        phase: phase,
        phase_name: enriched.phase_name,
        status: enriched.status,
        capsule_path: _relativeToPlanning(writeRes.path, planningDir),
        content_hash: writeRes.content_hash,
        created_at: enriched.created_at,
      });
    } catch (_e) {
      _logComplaint(planningDir, 'phase_capsule_backfill_index_unreadable', { message: _e.message });
    }

    return writeRes;
  } catch (e) {
    try { console.warn('[SGSD] phase-capsule writeCapsule failed:', e && e.message); } catch (_e2) { /* ignore */ }
    try { _logComplaint(planningDir, 'phase_capsule_write_schema_invalid', { message: e && e.message }); } catch (_e3) { /* ignore */ }
    return { ok: false, reason: (e && e.message) ? String(e.message) : 'phase_capsule_write_unexpected_error' };
  }
}

function writeAllCapsulesForMilestone(planningDir, milestone) {
  const result = { written: 0, skipped: 0, errors: [] };
  try {
    if (!planningDir || !milestone) {
      result.errors.push('phase_capsule_backfill_milestone_missing: planningDir/milestone required');
      return result;
    }
    const phasesDir = path.join(planningDir, 'milestones', milestone, 'phases');
    if (!fs.existsSync(phasesDir)) {
      _logComplaint(planningDir, 'phase_capsule_backfill_milestone_missing', { milestone: milestone });
      result.errors.push('phase_capsule_backfill_milestone_missing: ' + phasesDir);
      return result;
    }
    const entries = fs.readdirSync(phasesDir).sort();
    for (const e of entries) {
      const full = path.join(phasesDir, e);
      let st;
      try { st = fs.statSync(full); } catch (_e) { continue; }
      if (!st.isDirectory()) continue;
      const num = _extractPhaseNum(e);
      if (!num) continue;

      // Idempotency: if existing capsule has matching content_hash, skip.
      const existingPath = path.join(full, 'PHASE-CAPSULE.json');
      let existingHash = null;
      try {
        if (fs.existsSync(existingPath)) {
          const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
          existingHash = _capsuleContentHash(existing);
        }
      } catch (_e) { existingHash = null; }

      const wr = writeCapsule(planningDir, { milestone: milestone, phase: num, phaseDir: full });
      if (!wr || !wr.ok) {
        result.errors.push((wr && wr.reason) ? wr.reason : 'unknown error');
        continue;
      }
      if (existingHash && existingHash === wr.content_hash) {
        result.skipped++;
      } else {
        result.written++;
      }
    }
  } catch (e) {
    result.errors.push((e && e.message) || 'phase_capsule_backfill_partial');
    try { console.warn('[SGSD] phase-capsule writeAllCapsulesForMilestone failed:', e && e.message); } catch (_e2) { /* ignore */ }
  }
  return result;
}

function backfillFromCanonical(planningDir, opts) {
  const result = { written: 0, skipped: 0, errors: [] };
  try {
    const o = opts || {};
    if (o.all) {
      const root = path.join(planningDir, 'milestones');
      if (!fs.existsSync(root)) {
        result.errors.push('phase_capsule_backfill_milestone_missing: ' + root);
        return result;
      }
      const milestones = fs.readdirSync(root).sort();
      for (const m of milestones) {
        const full = path.join(root, m);
        let st;
        try { st = fs.statSync(full); } catch (_e) { continue; }
        if (!st.isDirectory()) continue;
        const r = writeAllCapsulesForMilestone(planningDir, m);
        result.written += r.written;
        result.skipped += r.skipped;
        for (const e of r.errors) result.errors.push(e);
      }
    } else if (o.milestone) {
      const r = writeAllCapsulesForMilestone(planningDir, o.milestone);
      result.written = r.written;
      result.skipped = r.skipped;
      result.errors = r.errors;
    } else {
      result.errors.push('phase_capsule_bad_invocation: --all or --milestone required');
    }
  } catch (e) {
    result.errors.push((e && e.message) || 'phase_capsule_backfill_partial');
  }
  return result;
}

// ----------------------------------------------------------------------------
// SELF-TEST (RESEARCH sec 10; 4 fixtures + 9 secondary = 13 assertions)
// ----------------------------------------------------------------------------

function _selfTest() {
  let pass = 0;
  let fail = 0;
  const errors = [];

  function rec(label, ok, detail) {
    if (ok) {
      pass++;
      console.log('  PASS', label);
    } else {
      fail++;
      console.error('  FAIL', label, detail || '');
      errors.push({ label: label, detail: detail });
    }
  }

  // Capture fingerprints BEFORE any work.
  const guardPaths = REAL_STREAMS.concat(REAL_SAMPLE_PHASE_DIRS);
  const fpBefore = _fingerprint(guardPaths);

  // Capture sample phase-folder file fingerprints (excluding any
  // PHASE-CAPSULE.json that may already exist from a prior backfill).
  const sampleFiles = [];
  for (const dir of REAL_SAMPLE_PHASE_DIRS) {
    try {
      if (fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir).sort();
        for (const e of entries) {
          if (e === 'PHASE-CAPSULE.json') continue;
          const full = path.join(dir, e);
          try {
            if (fs.statSync(full).isFile()) sampleFiles.push(full);
          } catch (_e) { /* ignore */ }
        }
      }
    } catch (_e) { /* ignore */ }
  }
  const fpFilesBefore = _fingerprint(sampleFiles);

  // -------- F1: write/read --------
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-st-'));
  try {
    const planningDir = path.join(tmpRoot, '.planning');
    const phaseDir = path.join(planningDir, 'milestones', 'v1.test', 'phases', '99-fixture-phase');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.mkdirSync(path.join(planningDir, 'metrics'), { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '99-CONTEXT.md'),
      '---\nphase: 99\nunblocks: [100]\n---\n\n## Goal\n\nF1 self-test fixture.\n\n## Locked decision\n\nLocked text body.\n');
    fs.writeFileSync(path.join(phaseDir, '99-RESEARCH.md'),
      '## Open Derivation Calls -- LOCKED\n| Q | Lock |\n|---|------|\n| Q1 | row1 |\n| Q2 | row2 |\n');
    fs.writeFileSync(path.join(phaseDir, '99-01-test-PLAN.md'), 'plan body\n');
    fs.writeFileSync(path.join(phaseDir, '99-VERIFICATION.md'), '---\nstatus: PASS\n---\n');
    fs.writeFileSync(path.join(phaseDir, '99-ATC-REVIEW.md'),
      '# Phase 99 ATC Review\n- Verdict: pass\n## Findings\n### CRIT: none\n### WARN\n');

    const r1 = writeCapsule(planningDir, { milestone: 'v1.test', phase: '99', phaseDir: phaseDir });
    let f1ok = r1 && r1.ok === true;
    let f1detail = '';
    if (f1ok) {
      const cap = JSON.parse(fs.readFileSync(r1.path, 'utf8'));
      const allReq = ['schema_version', 'milestone', 'phase', 'phase_name', 'status', 'goal',
        'outputs', 'files', 'decisions', 'debt', 'downstream_contract', 'bypass_refs',
        'source_commits', 'source_hashes', 'gates', 'created_at', 'created_by'];
      for (const k of allReq) if (!(k in cap)) { f1ok = false; f1detail = 'missing ' + k; break; }
      if (f1ok && cap.schema_version !== 1) { f1ok = false; f1detail = 'schema_version'; }
      if (f1ok && STATUS_VOCAB.indexOf(cap.status) < 0) { f1ok = false; f1detail = 'status not in vocab'; }
      if (f1ok && !/^super-gsd\/tools\/phase-capsule\/write\.cjs@/.test(cap.created_by)) { f1ok = false; f1detail = 'created_by mismatch'; }
      if (f1ok) {
        try { _assertCapsuleSchema(cap); } catch (e) { f1ok = false; f1detail = '_assertCapsuleSchema: ' + e.message; }
      }
    } else {
      f1detail = JSON.stringify(r1);
    }
    rec('F1 write/read', f1ok, f1detail);

    // -------- F2: rebuild equivalence (BINDING A3) --------
    if (r1 && r1.ok) {
      const H1 = r1.content_hash;
      fs.unlinkSync(r1.path);
      const r2 = writeCapsule(planningDir, { milestone: 'v1.test', phase: '99', phaseDir: phaseDir });
      const H2 = (r2 && r2.content_hash) || null;
      rec('F2 rebuild equivalence (BINDING A3) H1===H2', H1 === H2 && H1 != null, 'H1=' + H1 + ' H2=' + H2);
    } else {
      rec('F2 rebuild equivalence (BINDING A3) H1===H2', false, 'F1 setup failed');
    }
  } catch (e) {
    rec('F1 write/read', false, e.message);
    rec('F2 rebuild equivalence (BINDING A3) H1===H2', false, 'caught: ' + e.message);
  }

  // -------- F3: missing-file graceful (lock 13) --------
  try {
    const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-st3-'));
    const planningDir = path.join(tmp3, '.planning');
    const phaseDir = path.join(planningDir, 'milestones', 'v1.test', 'phases', '99-only-context');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '99-CONTEXT.md'), '---\nphase: 99\n---\n\n## Goal\n\nF3 only-context.\n');
    const r = writeCapsule(planningDir, { milestone: 'v1.test', phase: '99', phaseDir: phaseDir });
    const cap = (r && r.ok) ? JSON.parse(fs.readFileSync(r.path, 'utf8')) : null;
    const ok = r && r.ok && cap && cap.status === 'IN_PROGRESS'
      && cap.source_hashes.research === null
      && cap.source_hashes.verification === null
      && cap.source_hashes.atc_review === null
      && Array.isArray(cap.bypass_refs) && cap.bypass_refs.length === 0;
    rec('F3 missing-file graceful (lock 13)', ok, JSON.stringify(r));
  } catch (e) {
    rec('F3 missing-file graceful (lock 13)', false, e.message);
  }

  // -------- F4: critical-bypass preserved (BINDING A2 + LOCK 6) --------
  try {
    const tmp4 = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-st4-'));
    const planningDir = path.join(tmp4, '.planning');
    const phaseDir = path.join(planningDir, 'milestones', 'v1.test', 'phases', '99-bypass-fixture');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.mkdirSync(path.join(planningDir, 'metrics'), { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '99-CONTEXT.md'), '---\nphase: 99\n---\n\n## Goal\n\nF4 fixture.\n');
    fs.writeFileSync(path.join(phaseDir, '99-RESEARCH.md'), 'res');
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), 'plan');
    fs.writeFileSync(path.join(phaseDir, '99-VERIFICATION.md'), '---\nstatus: PASS\n---\n');
    const summaries = [
      'Codex auth unavailable; per-dispatch ATC for commit 34eb8c2 used Claude only.',
      'Edge-guard miss: provider==null detected; behaviorally proven outage 2026-04-27.',
      'Stack trace: SyntaxError at line 42; details preserved verbatim with punctuation.',
    ];
    const rows = [];
    for (let i = 0; i < summaries.length; i++) {
      rows.push(JSON.stringify({
        id: '2026-04-27T0' + i + '-00-00-000Z-aaa' + i,
        kind: 'verifier_fail',
        phase: '99',
        plan: 'phase-level',
        milestone: 'v1.test',
        attempts_made: 1,
        summary: summaries[i],
        evidence_path: '.planning/x',
        last_diff_sha: null,
        tagged_for_milestone: 'next-debt-milestone',
        added_at: '2026-04-27T0' + i + ':00:00.000Z',
        resolved_at: null,
        resolved_by: null,
      }));
    }
    fs.writeFileSync(path.join(planningDir, 'metrics', 'crit-backlog.jsonl'), rows.join('\n') + '\n');
    const r = writeCapsule(planningDir, { milestone: 'v1.test', phase: '99', phaseDir: phaseDir });
    const cap = (r && r.ok) ? JSON.parse(fs.readFileSync(r.path, 'utf8')) : null;
    let ok = cap && cap.bypass_refs.length === 3;
    if (ok) {
      for (let i = 0; i < 3; i++) {
        const srcBuf = Buffer.from(summaries[i], 'utf8');
        const gotBuf = Buffer.from(cap.bypass_refs[i].summary_passthrough, 'utf8');
        if (Buffer.compare(srcBuf, gotBuf) !== 0) { ok = false; break; }
      }
    }
    // Verify ascending sort by id
    if (ok) {
      for (let i = 1; i < cap.bypass_refs.length; i++) {
        if (cap.bypass_refs[i].id < cap.bypass_refs[i - 1].id) { ok = false; break; }
      }
    }
    rec('F4 critical-bypass verbatim (BINDING A2/LOCK 6)', ok, ok ? '' : JSON.stringify(cap && cap.bypass_refs));
  } catch (e) {
    rec('F4 critical-bypass verbatim (BINDING A2/LOCK 6)', false, e.message);
  }

  // -------- 5. frozen consts mutation no-op --------
  try {
    let frozenOk = SCHEMA_VERSION === 1
      && STATUS_VOCAB.length === 5
      && BYPASS_KIND_VOCAB.length === 7
      && CAPSULE_FILE_KINDS.length === 5;
    try { STATUS_VOCAB.push('FOO'); } catch (_e) { /* expected throw in strict */ }
    if (STATUS_VOCAB.length !== 5) frozenOk = false;
    rec('5 frozen consts (mutation preserved)', frozenOk, 'len=' + STATUS_VOCAB.length);
  } catch (e) {
    rec('5 frozen consts (mutation preserved)', false, e.message);
  }

  // -------- 6. PHASE-CAPSULE.schema.json shape --------
  try {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    const ok = schema.required.length === 17
      && schema.properties.schema_version.const === 1
      && schema.properties.status.enum.length === 5
      && schema.additionalProperties === false;
    rec('6 schema shape (17 required + closed-shape + status enum 5)', ok, JSON.stringify({
      required: schema.required.length, statusN: schema.properties.status.enum.length, addProps: schema.additionalProperties,
    }));
  } catch (e) {
    rec('6 schema shape (17 required + closed-shape + status enum 5)', false, e.message);
  }

  // -------- 7. decisions verbatim from mass-discuss --------
  try {
    const tmp7 = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-st7-'));
    const planningDir = path.join(tmp7, '.planning');
    const phaseDir = path.join(planningDir, 'milestones', 'v1.test', 'phases', '99-decisions');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.mkdirSync(path.join(planningDir, 'discussions'), { recursive: true });
    const verbatim = '| 42 | Test | Locked decision: example with **markdown** and `code`. |';
    fs.writeFileSync(path.join(planningDir, 'discussions', '2026-04-26-mass-discuss.md'),
      'header\n' + verbatim + '\nfooter\n');
    fs.writeFileSync(path.join(phaseDir, '99-CONTEXT.md'),
      '---\nphase: 99\ndiscuss_decisions: [42]\n---\n\n## Goal\n\nF7.\n');
    fs.writeFileSync(path.join(phaseDir, '99-VERIFICATION.md'), '---\nstatus: PASS\n---\n');
    const r = writeCapsule(planningDir, { milestone: 'v1.test', phase: '99', phaseDir: phaseDir });
    const cap = r && r.ok ? JSON.parse(fs.readFileSync(r.path, 'utf8')) : null;
    let ok = false;
    if (cap && cap.decisions && cap.decisions.length > 0) {
      for (const d of cap.decisions) {
        if (Buffer.compare(Buffer.from(d.text, 'utf8'), Buffer.from(verbatim, 'utf8')) === 0) { ok = true; break; }
      }
    }
    rec('7 decisions verbatim from mass-discuss', ok, ok ? '' : JSON.stringify(cap && cap.decisions));
  } catch (e) {
    rec('7 decisions verbatim from mass-discuss', false, e.message);
  }

  // -------- 8. source_commits ordering (skipped without git) --------
  try {
    // Synthetic: assert _gatherSourceCommits returns array (empty in tmpdir).
    const tmp8 = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-st8-'));
    fs.mkdirSync(path.join(tmp8, 'sub'), { recursive: true });
    const arr = _gatherSourceCommits(path.join(tmp8, 'sub'), tmp8);
    rec('8 source_commits returns array (no git scope -> [])', Array.isArray(arr), '');
  } catch (e) {
    rec('8 source_commits returns array (no git scope -> [])', false, e.message);
  }

  // -------- 9. source_hashes 5-key shape + sha256 64hex --------
  try {
    const tmp9 = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-st9-'));
    const planningDir = path.join(tmp9, '.planning');
    const phaseDir = path.join(planningDir, 'milestones', 'v1.test', 'phases', '99-hashes');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '99-CONTEXT.md'), 'a');
    fs.writeFileSync(path.join(phaseDir, '99-RESEARCH.md'), 'b');
    fs.writeFileSync(path.join(phaseDir, '99-01-PLAN.md'), 'c');
    fs.writeFileSync(path.join(phaseDir, '99-VERIFICATION.md'), 'd');
    fs.writeFileSync(path.join(phaseDir, '99-ATC-REVIEW.md'), 'e');
    const sh = _gatherSourceHashes(phaseDir, planningDir);
    const ok = sh && Array.isArray(sh.plan)
      && sh.context && /^[0-9a-f]{64}$/.test(sh.context.sha256)
      && sh.research && /^[0-9a-f]{64}$/.test(sh.research.sha256)
      && sh.plan.length === 1 && /^[0-9a-f]{64}$/.test(sh.plan[0].sha256)
      && sh.verification && /^[0-9a-f]{64}$/.test(sh.verification.sha256)
      && sh.atc_review && /^[0-9a-f]{64}$/.test(sh.atc_review.sha256);
    rec('9 source_hashes 5-key shape + sha256 hex64', ok, JSON.stringify(sh));
  } catch (e) {
    rec('9 source_hashes 5-key shape + sha256 hex64', false, e.message);
  }

  // -------- 10. dual phase-folder shape detection --------
  try {
    const tmp10 = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-st10-'));
    const planningDir = path.join(tmp10, '.planning');
    // (a) v1.9 reviews/
    const dirA = path.join(planningDir, 'milestones', 'v1.test', 'phases', '99-foo');
    fs.mkdirSync(path.join(dirA, 'reviews'), { recursive: true });
    fs.writeFileSync(path.join(dirA, '99-CONTEXT.md'), 'a');
    fs.writeFileSync(path.join(dirA, 'reviews', '99-REVIEW.md'), 'review');
    const shA = _gatherSourceHashes(dirA, planningDir);
    // (b) v1.6 ATC-REVIEW.md
    const dirB = path.join(planningDir, 'milestones', 'v1.test', 'phases', '99-bar');
    fs.mkdirSync(dirB, { recursive: true });
    fs.writeFileSync(path.join(dirB, '99-CONTEXT.md'), 'a');
    fs.writeFileSync(path.join(dirB, '99-ATC-REVIEW.md'), 'atc');
    const shB = _gatherSourceHashes(dirB, planningDir);
    // (c) neither
    const dirC = path.join(planningDir, 'milestones', 'v1.test', 'phases', '99-baz');
    fs.mkdirSync(dirC, { recursive: true });
    fs.writeFileSync(path.join(dirC, '99-CONTEXT.md'), 'a');
    const shC = _gatherSourceHashes(dirC, planningDir);
    const ok = shA.atc_review && /reviews\/99-REVIEW\.md$/.test(shA.atc_review.path)
      && shB.atc_review && /99-ATC-REVIEW\.md$/.test(shB.atc_review.path)
      && shC.atc_review === null;
    rec('10 dual phase-folder shape detection', ok, JSON.stringify({
      a: shA.atc_review && shA.atc_review.path,
      b: shB.atc_review && shB.atc_review.path,
      c: shC.atc_review,
    }));
  } catch (e) {
    rec('10 dual phase-folder shape detection', false, e.message);
  }

  // -------- 11. read-only invariant fingerprints unchanged --------
  try {
    const fpAfter = _fingerprint(guardPaths);
    const fpFilesAfter = _fingerprint(sampleFiles);
    const ok = _fingerprintsEqual(fpBefore, fpAfter) && _fingerprintsEqual(fpFilesBefore, fpFilesAfter);
    rec('11 read-only invariant (5 streams + sample phase-folder content)', ok, '');
  } catch (e) {
    rec('11 read-only invariant (5 streams + sample phase-folder content)', false, e.message);
  }

  // -------- 12. public APIs never throw upward --------
  try {
    let threw = false;
    let r;
    try { r = writeCapsule('/nonexistent/planning', { milestone: 'fake', phase: '999', phaseDir: '/fake/path' }); } catch (_e) { threw = true; }
    const ok1 = !threw && r && r.ok === false && typeof r.reason === 'string';

    threw = false;
    let r2;
    try { r2 = writeAllCapsulesForMilestone('/nonexistent/planning', 'fake'); } catch (_e) { threw = true; }
    const ok2 = !threw && r2 && r2.written === 0 && Array.isArray(r2.errors) && r2.errors.length > 0;

    threw = false;
    let r3;
    try { r3 = readCapsule('/nonexistent/planning', 'fake', '999'); } catch (_e) { threw = true; }
    const ok3 = !threw && r3 === null;

    rec('12 public APIs never throw upward', ok1 && ok2 && ok3, JSON.stringify({ writeCapsule: r, writeAll: r2, readCapsule: r3 }));
  } catch (e) {
    rec('12 public APIs never throw upward', false, e.message);
  }

  // -------- 13. PHASE-INDEX.jsonl idempotent (1 row per (ms,phase)) --------
  try {
    const tmp13 = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-st13-'));
    const planningDir = path.join(tmp13, '.planning');
    const phaseDir = path.join(planningDir, 'milestones', 'v1.test', 'phases', '99-idempotent');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '99-CONTEXT.md'), 'a');
    fs.writeFileSync(path.join(phaseDir, '99-VERIFICATION.md'), '---\nstatus: PASS\n---\n');
    writeCapsule(planningDir, { milestone: 'v1.test', phase: '99', phaseDir: phaseDir });
    fs.writeFileSync(path.join(phaseDir, '99-CONTEXT.md'), 'a-modified');
    writeCapsule(planningDir, { milestone: 'v1.test', phase: '99', phaseDir: phaseDir });
    const idxPath = _phaseIndexPath(planningDir, 'v1.test');
    const lines = fs.readFileSync(idxPath, 'utf8').split(/\r?\n/).filter(Boolean);
    const ok = lines.length === 1;
    rec('13 PHASE-INDEX.jsonl idempotent', ok, 'lines=' + lines.length);
  } catch (e) {
    rec('13 PHASE-INDEX.jsonl idempotent', false, e.message);
  }

  console.log('phase-capsule self-test: ' + pass + ' pass, ' + fail + ' fail');
  return fail === 0 ? 0 : 1;
}

// ----------------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------------

function _parseArgv(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-test') out.selfTest = true;
    else if (a === '--backfill') out.backfill = true;
    else if (a === '--all') out.all = true;
    else if (a === '--milestone') { out.milestone = argv[++i]; }
    else if (a === '--phase') { out.phase = argv[++i]; }
    else if (a === '--phase-dir') { out.phaseDir = argv[++i]; }
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--json') out.json = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else out._.push(a);
  }
  return out;
}

function _usage() {
  const lines = [
    'Usage:',
    '  node super-gsd/tools/phase-capsule/write.cjs --self-test',
    '  node super-gsd/tools/phase-capsule/write.cjs --backfill --all',
    '  node super-gsd/tools/phase-capsule/write.cjs --backfill --milestone <id>',
    '  node super-gsd/tools/phase-capsule/write.cjs --phase <id> --milestone <id> --phase-dir <path>',
    '  node super-gsd/tools/phase-capsule/write.cjs --help',
  ];
  console.log(lines.join('\n'));
}

if (require.main === module) {
  const args = _parseArgv(process.argv.slice(2));
  if (args.help) { _usage(); process.exit(0); }
  if (args.selfTest) {
    const code = _selfTest();
    process.exit(code);
  }
  if (args.backfill) {
    const planningDir = REAL_PLANNING_DIR;
    const r = backfillFromCanonical(planningDir, { all: args.all === true, milestone: args.milestone });
    console.log('phase-capsule backfill complete (written=' + r.written + ', skipped=' + r.skipped + ', errors=' + r.errors.length + ')');
    if (args.json) console.log(JSON.stringify(r));
    process.exit(0);
  }
  if (args.phase && args.milestone && args.phaseDir) {
    const planningDir = REAL_PLANNING_DIR;
    const r = writeCapsule(planningDir, { milestone: args.milestone, phase: args.phase, phaseDir: args.phaseDir });
    console.log(JSON.stringify(r));
    process.exit(0);
  }
  _usage();
  process.exit(2);
}

// ----------------------------------------------------------------------------
// MODULE EXPORTS (sorted)
// ----------------------------------------------------------------------------

module.exports = {
  BYPASS_KIND_VOCAB: BYPASS_KIND_VOCAB,
  CAPSULE_FILE_KINDS: CAPSULE_FILE_KINDS,
  SCHEMA_VERSION: SCHEMA_VERSION,
  STATUS_VOCAB: STATUS_VOCAB,
  backfillFromCanonical: backfillFromCanonical,
  capsulePath: capsulePath,
  readCapsule: readCapsule,
  writeAllCapsulesForMilestone: writeAllCapsulesForMilestone,
  writeCapsule: writeCapsule,
};

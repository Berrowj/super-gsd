'use strict';

/**
 * vtp-enrichment-gate.cjs — VTP enrichment gate for the research->planning boundary.
 *
 * Exports: { run(opts), vtpCrossRef(text, tier, opts) }
 *
 * run(opts) — builds 800-token seed (CONTEXT domain + REQ-IDs AC + RESEARCH.md per D-02),
 *   composes sub-agent spec for the 5-tool VTP cascade (D-01), writes VTP-ENRICHMENT.md
 *   per D-04 shape, returns {status, artifact_path}.
 *   status values: 'success' | 'empty_hit' | 'api_error'
 *
 * vtpCrossRef(text, tier, opts) — tier-based batching stub per D-05:
 *   CRITICAL findings: per-finding deep query spec
 *   WARN findings: batched end-of-audit query spec
 *   PASS findings: no-op, returns {citations:[]}
 *
 * Contract (per VTPE-01 + D-07): this module does NOT directly call mcp__vtp-kb__* tools.
 * MCP tools require agent runtime scope (Assumption A1). Instead, run() returns a
 * sub_agent_spec that the calling orchestrator dispatches; the sub-agent invokes callVtp()
 * from vtp-context-composer.cjs in MCP scope.
 *
 * D-07: config.vtp_enrichment absent or enabled=false -> all gates disabled. run() returns
 *   {status:'disabled', artifact_path:null} immediately when disabled.
 *
 * Zero external runtime deps beyond Node builtins + vtp-context-composer.cjs.
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');
const {
  prepareSubstrateCall,
  acceptPromptSubstrateCallRecord,
  capSubstrateResponse,
} = require('./vtp-context-composer.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// CRIT-fix: VTPE-01 REQ specifies `{NN}-VTP-ENRICHMENT.md` (phase-prefixed),
// matching project convention (CONTEXT, RESEARCH, VERIFICATION, ATC-REVIEW all
// use {NN}- prefix). Use buildArtifactFilename(phase) everywhere — do NOT
// reintroduce the unprefixed const.
const ARTIFACT_FILENAME_GENERIC = 'VTP-ENRICHMENT.md';
function buildArtifactFilename(phase) {
  const p = String(phase || '').trim();
  if (/^\d+$/.test(p)) return `${p}-${ARTIFACT_FILENAME_GENERIC}`;  // phase-prefixed
  return ARTIFACT_FILENAME_GENERIC;  // fallback when phase unknown (stub/test)
}
const CONFIG_PATH         = '.planning/config.json';
const QUERY_SEED_MAX_TOKENS = 800;
// Rough chars-per-token for truncation (conservative estimate)
const CHARS_PER_TOKEN     = 4;
const SEED_MAX_CHARS      = QUERY_SEED_MAX_TOKENS * CHARS_PER_TOKEN;

// D-01: 5-tool cascade names (for sub-agent spec composition)
const VTP_TOOLS = [
  'mcp__vtp-kb__vtp_search',
  'mcp__vtp-kb__vtp_search_substrate',
  'mcp__vtp-kb__vtp_search_research',
  'mcp__vtp-kb__vtp_route_and_retrieve',
  'mcp__vtp-kb__vtp_advise_service_enrichment',
];

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

/**
 * Read config.vtp_enrichment block. Returns null if absent or enabled=false.
 * D-07: absent config = DISABLED (no behavioral drift on pre-Phase-21 projects).
 *
 * @param {string} projectDir
 * @returns {{enabled:boolean, max_queries_per_gate:number, query_seed_max_tokens:number, empty_hit_policy:string}|null}
 */
function readVtpEnrichmentConfig(projectDir) {
  const configPath = path.resolve(projectDir, CONFIG_PATH);
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    if (!cfg || !cfg.vtp_enrichment) return null;
    const vtpCfg = cfg.vtp_enrichment;
    if (vtpCfg.enabled !== true) return null;
    return {
      enabled: true,
      max_queries_per_gate: vtpCfg.max_queries_per_gate || 5,
      query_seed_max_tokens: vtpCfg.query_seed_max_tokens || QUERY_SEED_MAX_TOKENS,
      empty_hit_policy: vtpCfg.empty_hit_policy || 'continue',
      granularity: vtpCfg.granularity || 'tier-based',
      audit_tier_batching: vtpCfg.audit_tier_batching || {
        critical: 'per-finding',
        warn: 'batched',
        pass: 'skip',
      },
    };
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Seed construction (D-02)
// ---------------------------------------------------------------------------

/**
 * Build query seed from 3 sources (D-02):
 * 1. CONTEXT.md <domain> block
 * 2. REQ-IDs acceptance criteria lines from REQUIREMENTS.md
 * 3. RESEARCH.md findings text
 *
 * Concatenated, truncated to SEED_MAX_CHARS (approx 800 tokens).
 *
 * @param {{phaseDir:string, projectDir:string, phaseContext?:string, requirements?:string, researchFindings?:string}} opts
 * @returns {string}
 */
function buildQuerySeed(opts) {
  const { phaseDir, projectDir, phaseContext, requirements, researchFindings } = opts || {};

  const parts = [];

  // Source 1: provided phaseContext or read from CONTEXT.md
  if (phaseContext && typeof phaseContext === 'string') {
    parts.push(phaseContext.trim());
  } else if (phaseDir) {
    try {
      const files = fs.readdirSync(phaseDir).filter(f => f.endsWith('-CONTEXT.md'));
      if (files.length > 0) {
        const raw = fs.readFileSync(path.join(phaseDir, files[0]), 'utf8');
        // Extract <domain> block if present
        const domainMatch = raw.match(/<domain>([\s\S]*?)<\/domain>/);
        parts.push(domainMatch ? domainMatch[1].trim() : raw.slice(0, 1000).trim());
      }
    } catch (_) { /* ignore — phaseDir may not exist in test */ }
  }

  // Source 2: provided requirements or read from REQUIREMENTS.md
  if (requirements && typeof requirements === 'string') {
    parts.push(requirements.trim());
  } else if (projectDir) {
    try {
      const reqPath = path.join(projectDir, '.planning', 'REQUIREMENTS.md');
      const raw = fs.readFileSync(reqPath, 'utf8');
      // Extract VTPE-* lines as proxy for relevant AC
      const lines = raw.split('\n').filter(l => /VTPE-\d+/.test(l));
      if (lines.length > 0) parts.push(lines.slice(0, 20).join('\n').trim());
    } catch (_) { /* ignore */ }
  }

  // Source 3: provided researchFindings or read from RESEARCH.md
  if (researchFindings && typeof researchFindings === 'string') {
    parts.push(researchFindings.trim());
  } else if (phaseDir) {
    try {
      const files = fs.readdirSync(phaseDir).filter(f => f.endsWith('-RESEARCH.md'));
      if (files.length > 0) {
        const raw = fs.readFileSync(path.join(phaseDir, files[0]), 'utf8');
        parts.push(raw.slice(0, 2000).trim());
      }
    } catch (_) { /* ignore */ }
  }

  const combined = parts.join('\n\n---\n\n');
  return combined.length > SEED_MAX_CHARS ? combined.slice(0, SEED_MAX_CHARS) : combined;
}

// ---------------------------------------------------------------------------
// Artifact write (D-04)
// ---------------------------------------------------------------------------

/**
 * Write VTP-ENRICHMENT.md per D-04 shape to phaseDir.
 * VTPE-05 discipline: ALWAYS writes -- even on empty_hit or api_error.
 *
 * vtp_status field values:
 *   'success'   -> normal hit path (hits > 0)
 *   'empty_hit' -> ok=true but zero hits; empty_hit:true in frontmatter
 *   'api_error' -> ok=false; writes stub so artifact existence check passes;
 *                  orchestrator reads vtp_status and halts (blocker)
 *
 * @param {{phaseDir:string, enrichmentResult:Object, vtpStatus?:string}} opts
 * @returns {string} absolute path to written file
 */
function writeEnrichmentArtifact({ phaseDir, enrichmentResult, vtpStatus }) {
  if (!phaseDir) throw new Error('vtp-enrichment-gate: phaseDir required for writeEnrichmentArtifact');
  const res = normalizeEnrichmentResult(enrichmentResult || {});
  const phase      = res.phase || 'unknown';
  const hits       = Array.isArray(res.hits) ? res.hits : [];
  const totalHits  = res.total_hits != null ? res.total_hits : hits.length;
  const queryCount = res.query_count || 0;
  const durationMs = res.duration_ms || 0;
  const generatedAt = new Date().toISOString();

  // Determine canonical vtp_status from explicit arg or enrichmentResult fields
  let status = vtpStatus;
  if (!status) {
    if (res.ok === false) {
      status = 'api_error';
    } else if (totalHits === 0) {
      status = 'empty_hit';
    } else {
      status = 'success';
    }
  }
  const isEmptyHit = status === 'empty_hit';
  const isApiError = status === 'api_error';

  const frontmatter = [
    '---',
    `phase: ${phase}`,
    `query_count: ${queryCount}`,
    `total_hits: ${isApiError ? 0 : totalHits}`,
    `duration_ms: ${durationMs}`,
    `empty_hit: ${isEmptyHit}`,
    `vtp_status: ${status}`,
    `generated_at: ${generatedAt}`,
    '---',
    '',
  ].join('\n');

  // api_error: write minimal stub + error block so artifact always exists (VTPE-05)
  if (isApiError) {
    const errorMsg = res.error_message || res.error || 'VTP MCP call failed';
    const body = [
      frontmatter,
      `# VTP Library Enrichment -- Phase ${phase}\n\n`,
      '## API Error\n',
      `Error: ${errorMsg}\n\n`,
      '> ORCHESTRATOR EXIT-BLOCK: vtp_status=api_error signals HALT.\n',
      '> Human must resolve VTP MCP connectivity before this gate can succeed.\n',
    ].join('');
    const artifactPath = path.resolve(phaseDir, buildArtifactFilename(phase));
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(artifactPath, body, 'utf8');
    return artifactPath;
  }

  // Library Hits table (success and empty_hit paths)
  let hitsTable = '## Library Hits\n';
  hitsTable += '| Source | Title | Section | Relevance | Citation |\n';
  hitsTable += '|---|---|---|---|---|\n';
  if (hits.length > 0) {
    for (const h of hits) {
      const source   = (h.source   || '').replace(/\|/g, '/');
      const title    = (h.title    || '').replace(/\|/g, '/');
      const section  = (h.section  || '').replace(/\|/g, '/');
      const relevance = (h.relevance || '').replace(/\|/g, '/');
      const citation = (h.citation || h.doc_id || '').replace(/\|/g, '/');
      hitsTable += `| ${source} | ${title} | ${section} | ${relevance} | ${citation} |\n`;
    }
  } else {
    hitsTable += '| — | — | — | — | — |\n';
  }

  const gaps = Array.isArray(res.gaps) ? res.gaps : [];
  const gapsSection = [
    '## Gaps the library surfaces',
    gaps.length > 0 ? gaps.map(g => `- ${g}`).join('\n') : '- (none identified)',
    '',
  ].join('\n');

  const framings = Array.isArray(res.alt_framings) ? res.alt_framings : [];
  const framingsSection = [
    '## Alternative framings from library',
    framings.length > 0 ? framings.map(f => `- ${f}`).join('\n') : '- (none identified)',
    '',
  ].join('\n');

  const degradationNotes = Array.isArray(res.degradation_notes) ? res.degradation_notes : [];
  const degradedRetrievalSection = degradationNotes.length > 0
    ? [
        '## Degraded Retrieval',
        ...degradationNotes.map(renderDegradationNote),
        '',
      ].join('\n')
    : '';

  let emptyHitSection = '';
  if (isEmptyHit) {
    const seedSummary = res.seed_summary || '(not provided)';
    const rationale   = res.empty_hit_rationale || 'Library has no coverage for this topic.';
    emptyHitSection = [
      '## Empty-Hit Rationale',
      `Topic: "${seedSummary}"`,
      `Reasoning: "${rationale}"`,
      '',
    ].join('\n');
  }

  const title = `# VTP Library Enrichment -- Phase ${phase}\n\n`;
  const body = [
    frontmatter,
    title,
    hitsTable,
    '',
    gapsSection,
    framingsSection,
    degradedRetrievalSection,
    emptyHitSection,
  ].join('');

  const artifactPath = path.resolve(phaseDir, buildArtifactFilename(phase));
  fs.mkdirSync(phaseDir, { recursive: true });
  fs.writeFileSync(artifactPath, body, 'utf8');
  return artifactPath;
}

function noteIdentity(note) {
  const n = note && typeof note === 'object' ? note : {};
  for (const key of ['identity', 'doc_id', 'rel_path', 'chunk_id']) {
    if (typeof n[key] === 'string' && n[key].length > 0) return n[key];
  }
  return Number.isInteger(n.hit_index) ? 'hit-' + (n.hit_index + 1) : 'hit-unknown';
}

function mergeDegradationNotes(generatedNotes, existingNotes) {
  const merged = [];
  const seen = new Set();
  for (const note of [...generatedNotes, ...existingNotes]) {
    if (!note || typeof note !== 'object' || Array.isArray(note)) continue;
    const key = [
      String(note.reason_code || ''),
      Number.isInteger(note.hit_index) ? note.hit_index : '',
      noteIdentity(note),
    ].join(':');
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(note);
  }
  return merged;
}

function normalizeEnrichmentResult(enrichmentResult) {
  const capped = capSubstrateResponse(enrichmentResult);
  const existingNotes = Array.isArray(enrichmentResult.degradation_notes)
    ? enrichmentResult.degradation_notes
    : [];
  const degradationNotes = mergeDegradationNotes(capped.degradation_notes, existingNotes);
  if (degradationNotes.length === 0) return capped.response;
  return {
    ...capped.response,
    degradation_notes: degradationNotes,
  };
}

function artifactNoteField(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  return value.replace(/[\r\n|]/g, '/');
}

function renderDegradationNote(note) {
  const fields = [
    'identity=' + artifactNoteField(noteIdentity(note)),
    Number.isInteger(note.hit_index) ? 'hit_index=' + note.hit_index : null,
    artifactNoteField(note.doc_id) ? 'doc_id=' + artifactNoteField(note.doc_id) : null,
    artifactNoteField(note.rel_path) ? 'rel_path=' + artifactNoteField(note.rel_path) : null,
    artifactNoteField(note.chunk_id) ? 'chunk_id=' + artifactNoteField(note.chunk_id) : null,
    Number.isInteger(note.original_chars) && Number.isInteger(note.retained_chars)
      ? 'characters ' + note.original_chars + ' -> ' + note.retained_chars
      : null,
  ].filter(Boolean);
  return '- ' + String(note.reason_code || 'vtp_retrieval_degraded') + ': ' + fields.join('; ');
}

// ---------------------------------------------------------------------------
// Artifact read
// ---------------------------------------------------------------------------

/**
 * Read VTP-ENRICHMENT.md from phaseDir. Returns parsed object or null if absent.
 * Downstream consumers (planner, audit) call this to get enrichment result.
 *
 * @param {{phaseDir:string}} opts
 * @returns {{raw:string, empty_hit:boolean, total_hits:number, artifact_path:string}|null}
 */
function readEnrichmentArtifact({ phaseDir, phase }) {
  if (!phaseDir) throw new Error('vtp-enrichment-gate: phaseDir required for readEnrichmentArtifact');
  // Try phase-prefixed filename first (REQ spec), fall back to glob-match for
  // backward-compat with any pre-fix artifacts. Matches planner read pattern.
  let artifactPath = path.resolve(phaseDir, buildArtifactFilename(phase));
  if (!fs.existsSync(artifactPath)) {
    // Glob fallback: first *-VTP-ENRICHMENT.md OR bare VTP-ENRICHMENT.md
    const candidates = fs.readdirSync(phaseDir).filter(f =>
      /^\d+-VTP-ENRICHMENT\.md$/.test(f) || f === ARTIFACT_FILENAME_GENERIC
    );
    if (candidates.length > 0) {
      artifactPath = path.resolve(phaseDir, candidates[0]);
    }
  }
  try {
    const raw = fs.readFileSync(artifactPath, 'utf8');
    // Parse frontmatter for key fields
    const emptyHitMatch    = raw.match(/^empty_hit:\s*(true|false)/m);
    const totalHitsMatch   = raw.match(/^total_hits:\s*(\d+)/m);
    return {
      raw,
      empty_hit:    emptyHitMatch  ? emptyHitMatch[1]  === 'true' : true,
      total_hits:   totalHitsMatch ? parseInt(totalHitsMatch[1], 10) : 0,
      artifact_path: artifactPath,
    };
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Sub-agent spec composer
// ---------------------------------------------------------------------------

/**
 * Compose the sub-agent dispatch spec for the VTP enrichment gate (VTPE-01).
 * Returns a spec object the orchestrator uses to dispatch sgsd-vtp-enrichment.
 * The sub-agent runs in MCP scope and calls callVtp() via vtp-context-composer.cjs.
 *
 * D-01 cascade:
 *   Tools 1+2 always run (cheap keyword+content sweep).
 *   Tools 3+4+5 run ONLY if tools 1+2 returned non-zero hits.
 *   Cap: 5 queries total (D-03).
 *
 * @param {{projectDir:string, phaseDir:string, phaseContext?:string, requirements?:string, researchFindings?:string, phase?:string|number}} opts
 * @returns {{sub_agent_type:string, model:string, seed:string, tools:string[], cascade_rule:string, artifact_filename:string, phaseDir:string, phase:string}}
 */
function composeSubAgentSpec(opts) {
  const { projectDir, phaseDir, phaseContext, requirements, researchFindings, phase } = opts || {};
  const seed = buildQuerySeed({ phaseDir, projectDir, phaseContext, requirements, researchFindings });
  return {
    sub_agent_type: 'sgsd-vtp-enrichment',
    model: 'codex',
    seed,
    substrate_call: prepareSubstrateCall('enrichment', { query: seed }),
    tools: VTP_TOOLS,
    cascade_rule: 'tools 1+2 always; tools 3+4+5 only if hits > 0 from tools 1+2 (D-01); cap 5 queries (D-03)',
    artifact_filename: buildArtifactFilename(phase),
    phaseDir: phaseDir || '',
    phase: String(phase || 'unknown'),
  };
}

// ---------------------------------------------------------------------------
// run() — main gate entry point
// ---------------------------------------------------------------------------

/**
 * Main gate entry point.
 *
 * In production: composes sub-agent spec for orchestrator dispatch; actual VTP
 * calls happen in agent runtime scope (MCP available there, not here).
 *
 * In --self-test mode: stub mode, no real MCP calls.
 *
 * opts.enrichmentResult is injected by the orchestrator AFTER the sub-agent completes,
 * to trigger artifact write. If not provided, returns the sub_agent_spec only.
 *
 * @param {{projectDir:string, phaseDir:string, phase?:string|number, phaseContext?:string, requirements?:string, researchFindings?:string, substrateCall?:Object, enrichmentResult?:Object, stubMode?:boolean}} opts
 * @returns {{status:string, artifact_path:string|null, sub_agent_spec?:Object, disabled?:boolean}}
 */
function run(opts) {
  const { projectDir = process.cwd(), phaseDir, enrichmentResult, stubMode } = opts || {};

  // D-07: check config, abort if disabled
  const cfg = readVtpEnrichmentConfig(projectDir);
  if (!cfg) {
    return { status: 'disabled', artifact_path: null, disabled: true };
  }

  // Stub mode (--self-test): simulate a result
  if (stubMode) {
    const fakeResult = {
      phase: opts.phase || 'test',
      query_count: 2,
      total_hits: 1,
      duration_ms: 42,
      hits: [{ source: 'stub', title: 'Stub Doc', section: 'N/A', relevance: 'high', citation: 'stub:001' }],
      gaps: ['No real gaps in stub mode'],
      alt_framings: ['No alternative framings in stub mode'],
    };
    const artifact_path = writeEnrichmentArtifact({ phaseDir, enrichmentResult: fakeResult });
    return { status: 'success', artifact_path };
  }

  // If enrichmentResult is provided (post-sub-agent injection): write artifact
  if (enrichmentResult) {
    if (!enrichmentResult.substrate_call_record) {
      throw new Error('vtp_prompt_substrate_contract_invalid:substrate_call_record_missing');
    }
    acceptPromptSubstrateCallRecord(
      'enrichment',
      opts.substrateCall,
      enrichmentResult.substrate_call_record
    );
    // Map callVtp status to gate status per output_contract (Pitfall 2 distinction)
    let status = 'success';
    if (enrichmentResult.ok === false) {
      status = 'api_error';
    } else if ((enrichmentResult.total_hits != null ? enrichmentResult.total_hits : 0) === 0 && !Array.isArray(enrichmentResult.hits)) {
      status = 'empty_hit';
    } else if (Array.isArray(enrichmentResult.hits) && enrichmentResult.hits.length === 0) {
      status = 'empty_hit';
    }
    // VTPE-05: always write artifact regardless of status (api_error writes stub)
    const artifact_path = writeEnrichmentArtifact({
      phaseDir,
      enrichmentResult: { ...enrichmentResult, phase: opts.phase },
      vtpStatus: status,
    });
    return { status, artifact_path };
  }

  // No enrichmentResult yet: return sub-agent spec for orchestrator dispatch
  const sub_agent_spec = composeSubAgentSpec(opts);
  return { status: 'pending', artifact_path: null, sub_agent_spec };
}

// ---------------------------------------------------------------------------
// vtpCrossRef() — tier-based batching stub (D-05)
// ---------------------------------------------------------------------------

/**
 * Tier-based VTP cross-reference helper for audit workflows (VTPE-02).
 * Returns a query spec; actual VTP calls happen in agent runtime scope.
 *
 * D-05 tier policy:
 *   CRITICAL -> per-finding deep query spec
 *   WARN     -> batched end-of-audit spec (returns {citations:[], batch_pending:true})
 *   PASS     -> no-op (returns {citations:[]})
 *
 * @param {string} text - finding text (or batch of WARN findings concatenated)
 * @param {'CRITICAL'|'WARN'|'PASS'} tier
 * @param {{projectDir?:string, fileContext?:string}} [opts]
 * @returns {{citations:string[], query_spec?:Object, batch_pending?:boolean}}
 */
function vtpCrossRef(text, tier, opts) {
  const normTier = String(tier || '').toUpperCase();

  if (normTier === 'PASS') {
    return { citations: [] };
  }

  if (normTier === 'WARN') {
    // Batched: single VTP call at end of audit with all WARN findings concatenated
    return {
      citations: [],
      batch_pending: true,
      query_spec: {
        tool: 'mcp__vtp-kb__vtp_search',
        seed: typeof text === 'string' ? text.slice(0, SEED_MAX_CHARS) : '',
        mode: 'batched-warn',
      },
    };
  }

  if (normTier === 'CRITICAL') {
    // Per-finding deep query
    const fileContext = (opts && opts.fileContext) ? opts.fileContext : '';
    return {
      citations: [],
      query_spec: {
        tool: 'mcp__vtp-kb__vtp_route_and_retrieve',
        seed: (text + '\n' + fileContext).slice(0, SEED_MAX_CHARS),
        mode: 'per-finding-critical',
      },
    };
  }

  // Unknown tier: no-op
  return { citations: [] };
}

// ---------------------------------------------------------------------------
// vtpCrossReference() — canonical long-form alias for vtpCrossRef (VTPE-02)
// ---------------------------------------------------------------------------

/**
 * vtpCrossReference — canonical public export alias for vtpCrossRef.
 * Agents and skill files should call this long-form name for clarity.
 * Behaviour identical to vtpCrossRef; see that function for full docs.
 *
 * D-05 tier policy:
 *   CRITICAL -> per-finding query spec + confidence field (0-1)
 *   WARN     -> batched end-of-audit spec
 *   PASS     -> {skipped:true} (zero VTP calls)
 *
 * @param {string} findingText
 * @param {'CRITICAL'|'WARN'|'PASS'} tier
 * @param {{projectDir?:string, fileContext?:string}} [opts]
 * @returns {{skipped?:true}|{batched_citations:Array, batch_pending:true, query_spec:Object}|{citations:Array, confidence:number, query_spec:Object}}
 */
function vtpCrossReference(findingText, tier, opts) {
  const normTier = String(tier || '').toUpperCase();

  if (normTier === 'PASS') {
    return { skipped: true };
  }

  if (normTier === 'WARN') {
    return {
      batched_citations: [],
      batch_pending: true,
      query_spec: {
        tool: 'mcp__vtp-kb__vtp_search',
        seed: typeof findingText === 'string' ? findingText.slice(0, SEED_MAX_CHARS) : '',
        mode: 'batched-warn',
      },
    };
  }

  if (normTier === 'CRITICAL') {
    const fileContext = (opts && opts.fileContext) ? opts.fileContext : '';
    return {
      citations: [],
      confidence: 0,
      query_spec: {
        tool: 'mcp__vtp-kb__vtp_route_and_retrieve',
        seed: (findingText + '\n' + fileContext).slice(0, SEED_MAX_CHARS),
        mode: 'per-finding-critical',
      },
    };
  }

  // Unknown tier guard — treat as PASS (no VTP call)
  return { skipped: true };
}

// ---------------------------------------------------------------------------
// Module exports
// ---------------------------------------------------------------------------

module.exports = { run, vtpCrossRef, vtpCrossReference };

// Non-exported internals for self-test access
module.exports._internal = {
  buildQuerySeed,
  writeEnrichmentArtifact,
  readEnrichmentArtifact,
  composeSubAgentSpec,
  readVtpEnrichmentConfig,
  mergeDegradationNotes,
  normalizeEnrichmentResult,
  renderDegradationNote,
  VTP_TOOLS,
  // CRIT-fix: filename is now phase-prefixed per VTPE-01 REQ. Callers use
  // buildArtifactFilename(phase) to get the per-phase name. Generic form
  // kept for stub/test paths where phase is unknown.
  buildArtifactFilename,
  ARTIFACT_FILENAME_GENERIC,
};

// ---------------------------------------------------------------------------
// --self-test CLI
// Exits 0 on PASS, 1 on FAIL. Mirrors vtp-context-composer.cjs self-test shape.
// No real MCP calls. Writes to tmpdir only.
// ---------------------------------------------------------------------------

if (require.main === module && process.argv.includes('--self-test')) {
  runSelfTest();
}

function runSelfTest() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-'));
  let passed = true;
  let failReason = '';

  function fail(r) {
    if (passed) {
      passed = false;
      failReason = r;
    }
  }

  try {
    // -----------------------------------------------------------------
    // Test 1: module exports { run, vtpCrossRef } (falsifier check)
    // -----------------------------------------------------------------
    if (typeof module.exports.run !== 'function') fail('Test1: run is not a function');
    if (passed && typeof module.exports.vtpCrossRef !== 'function') fail('Test1: vtpCrossRef is not a function');

    // -----------------------------------------------------------------
    // Test 2: run() returns {status:'disabled'} when config absent (D-07)
    // -----------------------------------------------------------------
    if (passed) {
      const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-cfg-'));
      try {
        const r2 = run({ projectDir: emptyDir, phaseDir: tmpDir, phase: 'test' });
        if (r2.status !== 'disabled') fail(`Test2: expected disabled, got ${r2.status}`);
        if (passed && r2.disabled !== true) fail('Test2: disabled flag should be true');
      } finally {
        try { fs.rmSync(emptyDir, { recursive: true, force: true }); } catch (_) {}
      }
    }

    // -----------------------------------------------------------------
    // Test 3: run() in stubMode with enabled config writes VTP-ENRICHMENT.md
    // -----------------------------------------------------------------
    if (passed) {
      const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-en-'));
      try {
        fs.mkdirSync(path.join(cfgDir, '.planning'), { recursive: true });
        fs.writeFileSync(
          path.join(cfgDir, '.planning', 'config.json'),
          JSON.stringify({ vtp_enrichment: { enabled: true } }),
          'utf8'
        );
        const phaseTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-ph-'));
        try {
          const r3 = run({ projectDir: cfgDir, phaseDir: phaseTmp, phase: '21', stubMode: true });
          if (r3.status !== 'success') fail(`Test3: expected success, got ${r3.status}`);
          if (passed && !r3.artifact_path) fail('Test3: artifact_path should be set');
          if (passed && !fs.existsSync(r3.artifact_path)) fail('Test3: VTP-ENRICHMENT.md not written');
          if (passed) {
            const content = fs.readFileSync(r3.artifact_path, 'utf8');
            if (!content.includes('phase: 21')) fail('Test3: artifact missing phase frontmatter');
            if (passed && !content.includes('empty_hit:')) fail('Test3: artifact missing empty_hit field');
            if (passed && !content.includes('## Library Hits')) fail('Test3: artifact missing Library Hits section');
            if (passed && !content.includes('## Gaps the library surfaces')) fail('Test3: artifact missing Gaps section');
            if (passed && !content.includes('## Alternative framings from library')) fail('Test3: artifact missing Alt framings section');
          }
        } finally {
          try { fs.rmSync(phaseTmp, { recursive: true, force: true }); } catch (_) {}
        }
      } finally {
        try { fs.rmSync(cfgDir, { recursive: true, force: true }); } catch (_) {}
      }
    }

    // -----------------------------------------------------------------
    // Test 4: run() returns sub_agent_spec when no enrichmentResult provided
    // -----------------------------------------------------------------
    if (passed) {
      const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-spec-'));
      try {
        fs.mkdirSync(path.join(cfgDir, '.planning'), { recursive: true });
        fs.writeFileSync(
          path.join(cfgDir, '.planning', 'config.json'),
          JSON.stringify({ vtp_enrichment: { enabled: true } }),
          'utf8'
        );
        const r4 = run({ projectDir: cfgDir, phaseDir: tmpDir, phase: '21', phaseContext: 'Test phase context for seed' });
        if (r4.status !== 'pending') fail(`Test4: expected pending, got ${r4.status}`);
        if (passed && !r4.sub_agent_spec) fail('Test4: sub_agent_spec missing');
        if (passed && r4.sub_agent_spec.sub_agent_type !== 'sgsd-vtp-enrichment') fail('Test4: wrong sub_agent_type');
        if (passed && r4.sub_agent_spec.model !== 'codex') fail('Test4: model should be codex (fresh-clone provider lock)');
        if (passed && !Array.isArray(r4.sub_agent_spec.tools)) fail('Test4: tools not array');
        if (passed && r4.sub_agent_spec.tools.length !== 5) fail(`Test4: expected 5 tools, got ${r4.sub_agent_spec.tools.length}`);
      } finally {
        try { fs.rmSync(cfgDir, { recursive: true, force: true }); } catch (_) {}
      }
    }

    // -----------------------------------------------------------------
    // Test 5: vtpCrossRef PASS -> {citations:[]}
    // -----------------------------------------------------------------
    if (passed) {
      const r5 = vtpCrossRef('no issue here', 'PASS');
      if (!Array.isArray(r5.citations) || r5.citations.length !== 0) fail('Test5: PASS should return empty citations');
    }

    // -----------------------------------------------------------------
    // Test 6: vtpCrossRef WARN -> {citations:[], batch_pending:true, query_spec}
    // -----------------------------------------------------------------
    if (passed) {
      const r6 = vtpCrossRef('warn finding text', 'WARN');
      if (r6.batch_pending !== true) fail('Test6: WARN should set batch_pending');
      if (passed && !r6.query_spec) fail('Test6: WARN should include query_spec');
      if (passed && r6.query_spec.mode !== 'batched-warn') fail('Test6: WARN mode mismatch');
    }

    // -----------------------------------------------------------------
    // Test 7: vtpCrossRef CRITICAL -> {citations:[], query_spec with per-finding mode}
    // -----------------------------------------------------------------
    if (passed) {
      const r7 = vtpCrossRef('critical finding text', 'CRITICAL', { fileContext: 'src/foo.cjs:42' });
      if (!r7.query_spec) fail('Test7: CRITICAL should include query_spec');
      if (passed && r7.query_spec.mode !== 'per-finding-critical') fail('Test7: CRITICAL mode mismatch');
      if (passed && r7.query_spec.tool !== 'mcp__vtp-kb__vtp_route_and_retrieve') fail('Test7: CRITICAL should use vtp_route_and_retrieve');
    }

    // -----------------------------------------------------------------
    // Test 8: writeEnrichmentArtifact + readEnrichmentArtifact round-trip
    // -----------------------------------------------------------------
    if (passed) {
      const phaseTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-rt-'));
      try {
        const fakeResult = {
          phase: '21',
          query_count: 3,
          total_hits: 2,
          duration_ms: 150,
          hits: [
            { source: 'book', title: 'Clean Code', section: 'Ch3', relevance: 'high', citation: 'book:001' },
          ],
          gaps: ['Async patterns gap'],
          alt_framings: ['Consider event-driven approach'],
        };
        const writePath = writeEnrichmentArtifact({ phaseDir: phaseTmp, enrichmentResult: fakeResult });
        if (!fs.existsSync(writePath)) fail('Test8: write did not create file');
        if (passed) {
          const readResult = readEnrichmentArtifact({ phaseDir: phaseTmp });
          if (!readResult) fail('Test8: readEnrichmentArtifact returned null');
          if (passed && readResult.empty_hit !== false) fail('Test8: empty_hit should be false (2 hits)');
          if (passed && readResult.total_hits !== 2) fail(`Test8: total_hits should be 2, got ${readResult.total_hits}`);
        }
      } finally {
        try { fs.rmSync(phaseTmp, { recursive: true, force: true }); } catch (_) {}
      }
    }

    // -----------------------------------------------------------------
    // Test 9: buildQuerySeed truncates to SEED_MAX_CHARS
    // -----------------------------------------------------------------
    if (passed) {
      const longText = 'x'.repeat(SEED_MAX_CHARS + 500);
      const seed = buildQuerySeed({ phaseContext: longText });
      if (seed.length > SEED_MAX_CHARS) fail(`Test9: seed not truncated, length=${seed.length}`);
    }

    // -----------------------------------------------------------------
    // Test 10: readEnrichmentArtifact returns null when file absent
    // -----------------------------------------------------------------
    if (passed) {
      const emptyPhaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-empty-'));
      try {
        const r10 = readEnrichmentArtifact({ phaseDir: emptyPhaseDir });
        if (r10 !== null) fail('Test10: should return null when artifact absent');
      } finally {
        try { fs.rmSync(emptyPhaseDir, { recursive: true, force: true }); } catch (_) {}
      }
    }

    // -----------------------------------------------------------------
    // Test 11: vtpCrossReference exported and callable (VTPE-02 long-form alias)
    // -----------------------------------------------------------------
    if (passed) {
      if (typeof module.exports.vtpCrossReference !== 'function') fail('Test11: vtpCrossReference is not a function');
    }

    // -----------------------------------------------------------------
    // Test 12: vtpCrossReference PASS -> {skipped:true} (D-05 no-op)
    // -----------------------------------------------------------------
    if (passed) {
      const r12 = vtpCrossReference('no issue', 'PASS');
      if (r12.skipped !== true) fail('Test12: PASS tier should return {skipped:true}');
    }

    // -----------------------------------------------------------------
    // Test 13: vtpCrossReference WARN -> {batched_citations:[], batch_pending:true}
    // -----------------------------------------------------------------
    if (passed) {
      const r13 = vtpCrossReference('warn finding', 'WARN');
      if (!Array.isArray(r13.batched_citations)) fail('Test13: WARN should have batched_citations array');
      if (passed && r13.batch_pending !== true) fail('Test13: WARN should set batch_pending:true');
      if (passed && (!r13.query_spec || r13.query_spec.mode !== 'batched-warn')) fail('Test13: WARN query_spec.mode mismatch');
    }

    // -----------------------------------------------------------------
    // Test 14: vtpCrossReference CRITICAL -> {citations:[], confidence:0, query_spec}
    // -----------------------------------------------------------------
    if (passed) {
      const r14 = vtpCrossReference('critical finding', 'CRITICAL', { fileContext: 'src/foo.cjs:10' });
      if (!Array.isArray(r14.citations)) fail('Test14: CRITICAL should have citations array');
      if (passed && typeof r14.confidence !== 'number') fail('Test14: CRITICAL should have numeric confidence');
      if (passed && (!r14.query_spec || r14.query_spec.mode !== 'per-finding-critical')) fail('Test14: CRITICAL query_spec.mode mismatch');
    }

    // -----------------------------------------------------------------
    // Test 15: vtpCrossReference unknown tier -> {skipped:true} (guard)
    // -----------------------------------------------------------------
    if (passed) {
      const r15 = vtpCrossReference('text', 'UNKNOWN');
      if (r15.skipped !== true) fail('Test15: unknown tier should be treated as PASS guard');
    }

    // -----------------------------------------------------------------
    // Test 16: VTPE-05 empty_hit path — artifact written with empty_hit:true + rationale
    // -----------------------------------------------------------------
    if (passed) {
      const phaseTmp16 = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-eh-'));
      try {
        const emptyResult = {
          phase: '21-empty',
          query_count: 2,
          total_hits: 0,
          duration_ms: 30,
          hits: [],
          seed_summary: 'VTP enrichment gate empty-hit test',
          empty_hit_rationale: 'No coverage found for this topic.',
        };
        const writePath16 = writeEnrichmentArtifact({ phaseDir: phaseTmp16, enrichmentResult: emptyResult });
        if (!fs.existsSync(writePath16)) fail('Test16: empty_hit artifact not written');
        if (passed) {
          const content16 = fs.readFileSync(writePath16, 'utf8');
          if (!content16.includes('empty_hit: true')) fail('Test16: empty_hit:true missing from frontmatter');
          if (passed && !content16.includes('vtp_status: empty_hit')) fail('Test16: vtp_status:empty_hit missing');
          if (passed && !content16.includes('## Empty-Hit Rationale')) fail('Test16: Empty-Hit Rationale section missing');
          if (passed && !content16.includes('No coverage found for this topic.')) fail('Test16: rationale text missing');
        }
      } finally {
        try { fs.rmSync(phaseTmp16, { recursive: true, force: true }); } catch (_) {}
      }
    }

    // -----------------------------------------------------------------
    // Test 17: VTPE-05 api_error path — artifact written as stub with exit-block signal
    // -----------------------------------------------------------------
    if (passed) {
      const phaseTmp17 = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-ae-'));
      try {
        const errorResult = {
          phase: '21-error',
          ok: false,
          error_message: 'MCP connection timeout',
        };
        const writePath17 = writeEnrichmentArtifact({ phaseDir: phaseTmp17, enrichmentResult: errorResult });
        if (!fs.existsSync(writePath17)) fail('Test17: api_error artifact not written');
        if (passed) {
          const content17 = fs.readFileSync(writePath17, 'utf8');
          if (!content17.includes('vtp_status: api_error')) fail('Test17: vtp_status:api_error missing');
          if (passed && !content17.includes('## API Error')) fail('Test17: API Error section missing');
          if (passed && !content17.includes('MCP connection timeout')) fail('Test17: error_message missing');
          if (passed && !content17.includes('EXIT-BLOCK')) fail('Test17: EXIT-BLOCK signal missing');
        }
      } finally {
        try { fs.rmSync(phaseTmp17, { recursive: true, force: true }); } catch (_) {}
      }
    }

    // -----------------------------------------------------------------
    // Test 18: VTPE-05 success path via enrichmentResult injection — vtp_status:success
    // -----------------------------------------------------------------
    if (passed) {
      const phaseTmp18 = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-vtp-gate-sc-'));
      try {
        const successResult = {
          phase: '21-success',
          query_count: 3,
          total_hits: 2,
          duration_ms: 120,
          hits: [{ source: 'book', title: 'DDIA', section: 'Ch4', relevance: 'high', citation: 'ddia:042' }],
          gaps: ['caching gap'],
          alt_framings: ['event-driven alternative'],
        };
        const writePath18 = writeEnrichmentArtifact({ phaseDir: phaseTmp18, enrichmentResult: successResult });
        if (!fs.existsSync(writePath18)) fail('Test18: success artifact not written');
        if (passed) {
          const content18 = fs.readFileSync(writePath18, 'utf8');
          if (!content18.includes('vtp_status: success')) fail('Test18: vtp_status:success missing');
          if (passed && !content18.includes('empty_hit: false')) fail('Test18: empty_hit:false missing');
          if (passed && !content18.includes('DDIA')) fail('Test18: hit title missing from Library Hits table');
        }
      } finally {
        try { fs.rmSync(phaseTmp18, { recursive: true, force: true }); } catch (_) {}
      }
    }

    // -----------------------------------------------------------------
    // Test 19: defensive cap merges duplicate notes and renders identity.
    // -----------------------------------------------------------------
    if (passed) {
      const input19 = Object.freeze({
        hits: Object.freeze([Object.freeze({
          doc_id: 'doc:lint-report',
          rel_path: 'wiki/LINT-REPORT.md',
          chunk_id: 'chunk:lint-report',
          text: 'x'.repeat(16001),
        })]),
        degradation_notes: Object.freeze([Object.freeze({
          reason_code: 'vtp_substrate_hit_truncated',
          hit_index: 0,
          identity: 'doc:lint-report',
          doc_id: 'doc:lint-report',
          rel_path: 'wiki/LINT-REPORT.md',
          chunk_id: 'chunk:lint-report',
          original_chars: 16001,
          retained_chars: 16000,
        })]),
      });
      const before19 = JSON.stringify(input19);
      const normalized19 = normalizeEnrichmentResult(input19);
      if (JSON.stringify(input19) !== before19) fail('Test19: defensive cap mutated input');
      if (passed && normalized19.hits[0].text.length !== 16000) fail('Test19: hit was not capped');
      if (passed && normalized19.degradation_notes.length !== 1) fail('Test19: duplicate note was not collapsed');
      if (passed) {
        const rendered19 = renderDegradationNote(normalized19.degradation_notes[0]);
        if (!rendered19.includes('doc_id=doc:lint-report')) fail('Test19: rendered note missing doc_id');
        if (passed && !rendered19.includes('rel_path=wiki/LINT-REPORT.md')) fail('Test19: rendered note missing rel_path');
        if (passed && !rendered19.includes('16001 -> 16000')) fail('Test19: rendered note missing counts');
      }
    }

  } catch (err) {
    fail(`Unexpected error: ${err.message}`);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }

  if (passed) {
    console.log('PASS');
    process.exit(0);
  } else {
    console.error('FAIL: ' + failReason);
    process.exit(1);
  }
}

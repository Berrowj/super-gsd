#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

// Super GSD token attribution collector.
//
// Reads Claude Code session JSONL and writes an append-only audit ledger:
//   .planning/metrics/token-attribution.jsonl
//
// Two event types are recorded:
//   assistant_turn - exact main-Claude usage fields from message.usage
//   agent_result   - exact sub-agent totalTokens from toolUseResult
//
// The collector is idempotent. Re-running it only appends unseen event_id rows.

const fs = require('fs');
const path = require('path');
const os = require('os');

const SCHEMA_VERSION = 1;
const LEDGER_REL = path.join('.planning', 'metrics', 'token-attribution.jsonl');

function usage() {
  console.log([
    'Usage: node collect.cjs [--project PATH] [--write] [--summary] [--current] [--recent N] [--all] [--self-test]',
    '',
    'Examples:',
    '  node super-gsd/tools/token-attribution/collect.cjs --write --summary --current',
    '  node super-gsd/tools/token-attribution/collect.cjs --summary --all'
  ].join('\n'));
}

function parseArgs(argv) {
  const out = {
    project: process.cwd(),
    write: false,
    summary: false,
    current: false,
    recent: 8,
    all: false,
    selfTest: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--project' || a === '-p') out.project = argv[++i];
    else if (a === '--write') out.write = true;
    else if (a === '--summary') out.summary = true;
    else if (a === '--current') out.current = true;
    else if (a === '--recent') out.recent = Math.max(1, parseInt(argv[++i], 10) || out.recent);
    else if (a === '--all') out.all = true;
    else if (a === '--self-test') out.selfTest = true;
    else if (a === '--help' || a === '-h') { usage(); process.exit(0); }
  }
  return out;
}

function encodeProjectPath(p) {
  return String(p).replace(/[\\/]+$/, '').replace(/[:\\/.]/g, '-');
}

function resolveProject(p) {
  return path.resolve(p || process.cwd());
}

function sessionsDirFor(projectDir) {
  return path.join(os.homedir(), '.claude', 'projects', encodeProjectPath(projectDir));
}

function listSessionFiles(projectDir, opts = {}) {
  const dir = sessionsDirFor(projectDir);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir)
    .filter(n => n.endsWith('.jsonl'))
    .map(name => {
      const full = path.join(dir, name);
      try {
        const st = fs.statSync(full);
        return { name, full, mtimeMs: st.mtimeMs, size: st.size };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return opts.all ? files : files.slice(0, opts.recent || 8);
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch {}
  }
  return out;
}

function readExistingIds(ledgerPath) {
  const ids = new Set();
  if (!fs.existsSync(ledgerPath)) return ids;
  for (const e of readJsonl(ledgerPath)) {
    if (e && e.event_id) ids.add(e.event_id);
  }
  return ids;
}

function parsePhase(text) {
  const s = String(text || '');
  let m = s.match(/(?:Phase|phase|P)\s*([0-9]{1,3})(?![0-9])/);
  if (m) return m[1];
  m = s.match(/[\\/]phases[\\/]+([0-9]{1,3})[-_]/);
  if (m) return m[1];
  return null;
}

function parsePlan(text) {
  const s = String(text || '');
  let m = s.match(/\b([0-9]{1,3}-[0-9]{2})\b/);
  if (m) return m[1];
  return null;
}

function parseMilestone(text) {
  const s = String(text || '');
  let m = s.match(/\bv([0-9]+(?:\.[0-9]+)?)\b/i);
  if (m) return `v${m[1]}`;
  m = s.match(/[\\/]milestones[\\/]+(v[0-9]+(?:\.[0-9]+)?)[\\/]/i);
  if (m) return m[1];
  return null;
}

function compactText(text, max = 180) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 3) + '...' : s;
}

function roleForAgent(agentType) {
  const t = String(agentType || '').toLowerCase();
  if (t.includes('research')) return 'research';
  if (t.includes('executor') || t === 'worker') return 'execution';
  if (t.includes('plan-checker')) return 'plan_check';
  if (t.includes('planner')) return 'planning';
  if (t.includes('reviewer') || t.includes('verifier') || t.includes('atc')) return 'review';
  if (t.includes('classifier')) return 'classification';
  return 'agent';
}

function codexCandidateFor(agentType) {
  const role = roleForAgent(agentType);
  if (role === 'review' || role === 'plan_check' || role === 'classification') {
    return { level: 'high', reason: 'bounded review/checking work with clear acceptance contract' };
  }
  if (role === 'research' || role === 'planning') {
    return { level: 'medium', reason: 'bounded synthesis work; useful Codex candidate when sources are local and prompt is explicit' };
  }
  if (role === 'execution') {
    return { level: 'medium', reason: 'code-writing work may offload well, but needs stronger guardrails than review/planning' };
  }
  return { level: 'low', reason: 'insufficient role signal' };
}

function usageTotals(usage) {
  const input = Number(usage && usage.input_tokens) || 0;
  const cacheCreation = Number(usage && usage.cache_creation_input_tokens) || 0;
  const cacheRead = Number(usage && usage.cache_read_input_tokens) || 0;
  const output = Number(usage && usage.output_tokens) || 0;
  return {
    input_tokens: input,
    cache_creation_input_tokens: cacheCreation,
    cache_read_input_tokens: cacheRead,
    output_tokens: output,
    context_tokens: input + cacheCreation + cacheRead,
    total_tokens: input + cacheCreation + cacheRead + output
  };
}

function toolUseMap(entries) {
  const byId = new Map();
  for (const e of entries) {
    if (e.type !== 'assistant' || !e.message || !Array.isArray(e.message.content)) continue;
    for (const block of e.message.content) {
      if (!block || block.type !== 'tool_use' || !block.id) continue;
      byId.set(block.id, {
        tool: block.name || '',
        input: block.input || {},
        assistant_uuid: e.uuid || null
      });
    }
  }
  return byId;
}

function extractAgentId(entry) {
  const result = entry.toolUseResult || {};
  if (result.agentId) return result.agentId;
  const content = entry.message && Array.isArray(entry.message.content) ? entry.message.content : [];
  for (const block of content) {
    if (block && block.type === 'tool_result' && typeof block.content === 'string') {
      const m = block.content.match(/agentId:\s*([A-Za-z0-9_-]+)/);
      if (m) return m[1];
    }
    if (block && block.type === 'tool_result' && Array.isArray(block.content)) {
      const joined = block.content.map(x => x && x.text ? x.text : '').join('\n');
      const m = joined.match(/agentId:\s*([A-Za-z0-9_-]+)/);
      if (m) return m[1];
    }
  }
  return null;
}

function extractUsageFromText(entry) {
  const content = entry.message && Array.isArray(entry.message.content) ? entry.message.content : [];
  const chunks = [];
  for (const block of content) {
    if (!block || block.type !== 'tool_result') continue;
    if (typeof block.content === 'string') chunks.push(block.content);
    if (Array.isArray(block.content)) {
      for (const c of block.content) if (c && c.text) chunks.push(c.text);
    }
  }
  const joined = chunks.join('\n');
  const m = joined.match(/<usage>[\s\S]*?total_tokens:\s*([0-9]+)/);
  const tools = joined.match(/tool_uses:\s*([0-9]+)/);
  const duration = joined.match(/duration_ms:\s*([0-9]+)/);
  return {
    totalTokens: m ? Number(m[1]) : null,
    toolUses: tools ? Number(tools[1]) : null,
    durationMs: duration ? Number(duration[1]) : null
  };
}

function parseSessionEvents(sessionFile) {
  const entries = readJsonl(sessionFile.full);
  const byToolId = toolUseMap(entries);
  const rows = [];

  for (const e of entries) {
    const sessionId = e.sessionId || path.basename(sessionFile.name, '.jsonl');
    if (e.type === 'assistant' && e.message && e.message.usage) {
      const usage = usageTotals(e.message.usage);
      const contentText = JSON.stringify(e.message.content || '');
      rows.push({
        schema_version: SCHEMA_VERSION,
        event_type: 'assistant_turn',
        event_id: `assistant:${sessionId}:${e.uuid || e.requestId || e.timestamp}`,
        ts: e.timestamp || null,
        source: 'claude-session-jsonl',
        session_id: sessionId,
        session_file: sessionFile.name,
        uuid: e.uuid || null,
        model: e.message.model || null,
        milestone: parseMilestone(contentText),
        phase: parsePhase(contentText),
        plan: parsePlan(contentText),
        role: 'orchestrator',
        attribution_basis: 'message.usage',
        confidence: 'exact_usage_fields',
        usage
      });
      continue;
    }

    const result = e.toolUseResult || null;
    if (!result || (!result.agentType && !result.totalTokens)) continue;
    const toolResultId = e.message && Array.isArray(e.message.content)
      ? (e.message.content.find(b => b && b.type === 'tool_result') || {}).tool_use_id
      : null;
    const toolUse = toolResultId ? byToolId.get(toolResultId) : null;
    const toolInput = toolUse && toolUse.input ? toolUse.input : {};
    const textBasis = [
      result.prompt,
      result.agentType,
      toolInput.description,
      toolInput.prompt,
      compactText(JSON.stringify(result.content || ''), 1000)
    ].filter(Boolean).join('\n');
    const textUsage = extractUsageFromText(e);
    const totalTokens = Number(result.totalTokens) || textUsage.totalTokens || 0;
    const agentType = result.agentType || toolInput.subagent_type || null;
    const candidate = codexCandidateFor(agentType);

    rows.push({
      schema_version: SCHEMA_VERSION,
      event_type: 'agent_result',
      event_id: `agent:${sessionId}:${extractAgentId(e) || toolResultId || e.uuid || e.timestamp}`,
      ts: e.timestamp || null,
      source: 'claude-session-jsonl',
      session_id: sessionId,
      session_file: sessionFile.name,
      uuid: e.uuid || null,
      tool_use_id: toolResultId || null,
      agent_id: extractAgentId(e),
      agent_type: agentType,
      agent_role: roleForAgent(agentType),
      model: result.model || null,
      milestone: parseMilestone(textBasis),
      phase: parsePhase(textBasis),
      plan: parsePlan(textBasis),
      status: result.status || null,
      description: compactText(toolInput.description || result.prompt || ''),
      prompt_chars: String(result.prompt || toolInput.prompt || '').length,
      output_chars: compactText(JSON.stringify(result.content || ''), 4000).length,
      total_tokens: totalTokens,
      duration_ms: Number(result.totalDurationMs) || textUsage.durationMs || null,
      tool_uses: Number(result.totalToolUseCount) || textUsage.toolUses || null,
      usage: result.usage ? usageTotals(result.usage) : null,
      tool_stats: result.toolStats || null,
      attribution_basis: result.totalTokens ? 'toolUseResult.totalTokens' : 'tool_result_usage_text',
      confidence: result.totalTokens ? 'exact_agent_total' : 'parsed_agent_usage_footer',
      codex_offload_candidate: candidate.level,
      codex_offload_reason: candidate.reason
    });
  }

  return rows;
}

function readStateScope(projectDir) {
  const statePath = path.join(projectDir, '.planning', 'STATE.md');
  const out = { milestone: null, phase: null };
  if (!fs.existsSync(statePath)) return out;
  const text = fs.readFileSync(statePath, 'utf8');
  let m = text.match(/^milestone:\s*("?)([^"\n]+)\1/m);
  if (m) out.milestone = m[2].trim();
  m = text.match(/current_phase:\s*("?)([0-9]+)\1/m) || text.match(/\bPhase\s+([0-9]+)\b/i);
  if (m) out.phase = m[2] || m[1];
  return out;
}

function collect(projectDir, opts = {}) {
  const sessions = listSessionFiles(projectDir, opts);
  const rows = [];
  for (const sf of sessions) rows.push(...parseSessionEvents(sf));
  rows.sort((a, b) => String(a.ts || '').localeCompare(String(b.ts || '')));
  return rows;
}

function appendNewRows(projectDir, rows) {
  const ledgerPath = path.join(projectDir, LEDGER_REL);
  fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
  const existing = readExistingIds(ledgerPath);
  const newRows = rows.filter(r => r.event_id && !existing.has(r.event_id));
  if (newRows.length > 0) {
    fs.appendFileSync(ledgerPath, newRows.map(r => JSON.stringify(r)).join('\n') + '\n');
  }
  return { ledgerPath, appended: newRows.length };
}

function summarize(rows, scope = {}) {
  const filtered = rows.filter(r => {
    if (scope.milestone && String(r.milestone || '') !== String(scope.milestone)) return false;
    if (scope.phase && String(r.phase || '') !== String(scope.phase)) return false;
    return true;
  });

  const agentRows = filtered.filter(r => r.event_type === 'agent_result');
  const assistantRows = filtered.filter(r => r.event_type === 'assistant_turn');
  const byAgent = new Map();
  const candidate = { high: 0, medium: 0, low: 0, unknown: 0 };

  for (const r of agentRows) {
    const key = r.agent_type || 'unknown';
    if (!byAgent.has(key)) {
      byAgent.set(key, {
        agent_type: key,
        agent_role: r.agent_role || 'agent',
        calls: 0,
        total_tokens: 0,
        avg_tokens: 0,
        duration_ms: 0,
        tool_uses: 0,
        last_ts: null,
        phases: {},
        codex_offload_candidate: r.codex_offload_candidate || 'unknown',
        codex_offload_reason: r.codex_offload_reason || ''
      });
    }
    const b = byAgent.get(key);
    b.calls += 1;
    b.total_tokens += Number(r.total_tokens) || 0;
    b.duration_ms += Number(r.duration_ms) || 0;
    b.tool_uses += Number(r.tool_uses) || 0;
    if (!b.last_ts || String(r.ts || '') > b.last_ts) b.last_ts = r.ts || null;
    if (r.phase) b.phases[`P${r.phase}`] = (b.phases[`P${r.phase}`] || 0) + 1;
    const c = r.codex_offload_candidate || 'unknown';
    candidate[c] = (candidate[c] || 0) + (Number(r.total_tokens) || 0);
  }

  const byAgentArr = Array.from(byAgent.values()).map(b => {
    b.avg_tokens = b.calls ? Math.round(b.total_tokens / b.calls) : 0;
    b.avg_duration_ms = b.calls ? Math.round(b.duration_ms / b.calls) : 0;
    return b;
  }).sort((a, b) => b.total_tokens - a.total_tokens);

  const assistantUsage = assistantRows.reduce((acc, r) => {
    const u = r.usage || {};
    acc.turns += 1;
    acc.input_tokens += Number(u.input_tokens) || 0;
    acc.cache_creation_input_tokens += Number(u.cache_creation_input_tokens) || 0;
    acc.cache_read_input_tokens += Number(u.cache_read_input_tokens) || 0;
    acc.output_tokens += Number(u.output_tokens) || 0;
    acc.context_tokens += Number(u.context_tokens) || 0;
    acc.total_tokens += Number(u.total_tokens) || 0;
    return acc;
  }, {
    turns: 0,
    input_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    output_tokens: 0,
    context_tokens: 0,
    total_tokens: 0
  });

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    scope,
    event_count: filtered.length,
    agent_calls: agentRows.length,
    agent_total_tokens: agentRows.reduce((n, r) => n + (Number(r.total_tokens) || 0), 0),
    assistant_usage: assistantUsage,
    codex_candidate_tokens: candidate,
    by_agent: byAgentArr
  };
}

function runSelfTest() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-token-attribution-'));
  try {
    const sessionsDir = path.join(os.homedir(), '.claude', 'projects', encodeProjectPath(tmp));
    fs.mkdirSync(sessionsDir, { recursive: true });
    const sessionFile = path.join(sessionsDir, 'test-session.jsonl');
    const rows = [
      {
        type: 'assistant',
        uuid: 'a1',
        timestamp: '2026-04-27T00:00:00.000Z',
        sessionId: 'test-session',
        message: {
          model: 'claude-opus-test',
          usage: { input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3, output_tokens: 4 },
          content: [{ type: 'tool_use', id: 'toolu_agent', name: 'Agent', input: { subagent_type: 'gsd-planner', description: 'Phase 39 planner' } }]
        }
      },
      {
        type: 'user',
        uuid: 'u1',
        timestamp: '2026-04-27T00:01:00.000Z',
        sessionId: 'test-session',
        message: { content: [{ type: 'tool_result', tool_use_id: 'toolu_agent', content: '<usage>total_tokens: 1234\ntool_uses: 5\nduration_ms: 6000</usage>\nagentId: abc' }] },
        toolUseResult: {
          status: 'completed',
          agentType: 'gsd-planner',
          totalTokens: 1234,
          totalDurationMs: 6000,
          totalToolUseCount: 5,
          prompt: 'Create Phase 39 plan for SGSD v1.8'
        }
      }
    ];
    fs.writeFileSync(sessionFile, rows.map(r => JSON.stringify(r)).join('\n') + '\n');
    const collected = collect(tmp, { all: true });
    if (collected.length !== 2) throw new Error(`expected 2 rows, got ${collected.length}`);
    const agent = collected.find(r => r.event_type === 'agent_result');
    if (!agent || agent.total_tokens !== 1234) throw new Error('agent total token parse failed');
    if (agent.phase !== '39' || agent.milestone !== 'v1.8') throw new Error('scope parse failed');
    const wrote = appendNewRows(tmp, collected);
    const wrote2 = appendNewRows(tmp, collected);
    if (wrote.appended !== 2 || wrote2.appended !== 0) throw new Error('idempotent append failed');
    const summary = summarize(readJsonl(path.join(tmp, LEDGER_REL)), { milestone: 'v1.8', phase: '39' });
    if (summary.agent_total_tokens !== 1234) throw new Error('summary failed');
    console.log('token-attribution self-test: PASS');
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    runSelfTest();
    return;
  }

  const projectDir = resolveProject(args.project);
  const rows = collect(projectDir, args);
  let writeResult = { ledgerPath: path.join(projectDir, LEDGER_REL), appended: 0 };
  if (args.write) writeResult = appendNewRows(projectDir, rows);

  if (args.summary) {
    const ledgerRows = fs.existsSync(writeResult.ledgerPath) ? readJsonl(writeResult.ledgerPath) : rows;
    const stateScope = args.current ? readStateScope(projectDir) : {};
    const summary = summarize(ledgerRows, stateScope);
    summary.ledger_path = writeResult.ledgerPath;
    summary.appended = writeResult.appended;
    console.log(JSON.stringify(summary));
  } else {
    console.log(JSON.stringify({ collected: rows.length, appended: writeResult.appended, ledger_path: writeResult.ledgerPath }));
  }
}

if (require.main === module) main();

module.exports = {
  SCHEMA_VERSION,
  LEDGER_REL,
  encodeProjectPath,
  collect,
  appendNewRows,
  summarize,
  parsePhase,
  parseMilestone,
  roleForAgent,
  codexCandidateFor
};

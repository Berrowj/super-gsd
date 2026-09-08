#!/usr/bin/env node
'use strict';
// Build the host-side transport for one seat. No provider is called here.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const registry = require('./board-registry.cjs');
const routing = require('./model-routing.cjs');
const { resolveContainedPath, readState } = require('./sgsd-state.cjs');
const AGENT_MODELS = new Set(['fable', 'opus', 'sonnet', 'haiku']);
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'ultra']);
const quote = value => `'${String(value).replace(/'/g, `'"'"'`)}'`;

function describe(member, override) {
  if (!member || (member.state || 'active') !== 'active') throw new Error('board seat inactive');
  let seat = { ...member };
  if (override) {
    const selected = routing.resolveModel({ config: routing.loadRouting(), role: 'deliberation.board_members', override });
    seat = { ...seat, model_default: selected.provider === 'openai' ? 'external' : selected.model,
      provider: selected.provider, model_id: selected.model, reasoning_effort: selected.reasoning_effort,
      dispatch: selected.provider === 'openai' ? 'codex-exec' : 'agent',
      codex_contract: 'board-position-v1', codex_profile: 'codex.readonly.audit' };
  }
  const model = seat.model_default || seat.model;
  if (model === 'external') {
    if (seat.provider !== 'openai' || seat.dispatch !== 'codex-exec'
        || !/^gpt-\d[a-z0-9.-]{0,60}$/.test(seat.model_id || '')
        || !EFFORTS.has(seat.reasoning_effort) || seat.codex_profile !== 'codex.readonly.audit'
        || seat.codex_contract !== 'board-position-v1') throw new Error(`board model unavailable or invalid: ${seat.name}`);
    return { member: seat.name, role: seat.role, dispatch: 'codex-exec', provider: 'openai', model: 'external',
      model_id: seat.model_id, reasoning_effort: seat.reasoning_effort,
      codex_profile: seat.codex_profile, codex_contract: seat.codex_contract };
  }
  if (!AGENT_MODELS.has(model) || (seat.provider && seat.provider !== 'anthropic')
      || (seat.dispatch && seat.dispatch !== 'agent')) throw new Error(`board model unavailable or invalid: ${seat.name}`);
  return { member: seat.name, role: seat.role, dispatch: 'agent', provider: 'anthropic', model };
}

function prepare({ memberName, projectDir = process.cwd(), promptFile, timeoutSeconds = 600, override, boardYamlPath,
  owner = process.env.SGSD_WORKER_OWNER || 'sgsd-ceo', plan = process.env.SGSD_WORKER_PLAN } = {}) {
  const spec = describe(registry.getMember(memberName, boardYamlPath), override);
  if (spec.dispatch === 'agent') return spec;
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 3600) throw new Error('invalid board timeout');
  projectDir = fs.realpathSync(path.resolve(projectDir));
  if (!fs.statSync(path.join(projectDir, '.planning')).isDirectory()) throw new Error('not an SGSD project');
  const state = readState(projectDir);
  if (!state?.milestone || state.milestone === 'none') throw new Error('board dispatch requires a milestone in STATE.md');
  if (!/^[a-zA-Z0-9._:-]{1,80}$/.test(owner)) throw new Error('invalid board worker owner');
  if (!plan) {
    const frontmatter = fs.readFileSync(path.join(projectDir, '.planning', 'STATE.md'), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    plan = frontmatter?.[1].match(/^current_plan:\s*["']?([a-zA-Z0-9._:-]+)["']?\s*$/m)?.[1];
  }
  promptFile = path.resolve(promptFile || '');
  if (!fs.statSync(promptFile).isFile()) throw new Error('board prompt unavailable');
  const relative = path.join('.planning', 'deliberations', 'dispatches', crypto.randomUUID());
  const directory = resolveContainedPath(projectDir, relative);
  if (!directory) throw new Error('board output escapes project');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const reportPath = path.join(directory, 'position.yaml');
  // A new directory per attempt means old or failed reports cannot satisfy this dispatch.
  const argv = [path.resolve(__dirname, '..', 'codex-exec.sh'), '--project', projectDir,
    '--prompt-file', promptFile, '--report-out', reportPath, '--contract', spec.codex_contract,
    '--profile', spec.codex_profile, '--model', spec.model_id, '--reasoning', spec.reasoning_effort,
    '--timeout', String(timeoutSeconds), '--step', memberName, '--milestone', state.milestone,
    '--no-retry-on-timeout-escalate', '--owner', owner];
  if (state.phase) argv.push('--phase', state.phase);
  if (plan) argv.push('--plan', plan);
  return { ...spec, worker_owner: owner, worker_role: 'board', report_path: reportPath, argv, command: ['bash', ...argv.map(quote)].join(' ') };
}
module.exports = { describe, prepare };
if (require.main === module) {
  const value = (flag, fallback) => { const i = process.argv.indexOf(flag); return i < 0 ? fallback : process.argv[i + 1]; };
  try {
    const memberName = value('--member');
    const result = process.argv.includes('--describe') ? describe(registry.getMember(memberName), value('--model'))
      : prepare({ memberName, projectDir: value('--project', process.cwd()), promptFile: value('--prompt-file'),
        timeoutSeconds: Number(value('--timeout', 600)), override: value('--model'), owner: value('--owner'), plan: value('--plan') });
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) { process.stderr.write(`BOARD_DISPATCH_UNAVAILABLE: ${error.message}\n`); process.exitCode = 2; }
}

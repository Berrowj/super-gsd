'use strict';
// Isolated protocol peer, never calls a provider. Captures are test-owned only.
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');
const mode = process.env.WORKER_FIXTURE_MODE || 'question';
let thread = `thread-${process.pid}`, turn = 'turn-1';
const rollout = process.env.WORKER_FIXTURE_ROLLOUT;
if (rollout) turn = `turn-${process.pid}`;
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
const result = (id, value) => send({ id, result: value });
function materialize() {
  if (!rollout) return;
  fs.mkdirSync(path.dirname(rollout), { recursive: true });
  if (!fs.existsSync(rollout)) fs.writeFileSync(rollout, JSON.stringify({ type: 'response_item', payload: { text: 'PRIVATE_ROLLOUT_CANARY' } }) + '\n', { mode: 0o600 });
}
function usage(id, input = 100, extra = {}) {
  if (!rollout) return;
  materialize();
  const row = { timestamp: '2026-09-08T12:00:00.000Z', ordinal: 10, type: 'token_usage_record', payload: {
    thread_id: thread, turn_id: turn, session_id: `session-${process.pid}`, root_turn_id: turn,
    response_id: `resp-${process.pid}-${id}`, usage: { input_tokens: input, cached_input_tokens: 60,
      cache_write_input_tokens: 5, output_tokens: 20, reasoning_output_tokens: 12, total_tokens: input + 20 },
    turn_token_usage: { total_tokens: 9000 }, thread_token_usage: { total_tokens: 70000 }, ...extra } };
  const fd = fs.openSync(rollout, 'a', 0o600);
  try { fs.writeSync(fd, JSON.stringify(row) + '\n'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function finish(text, status = 'completed') {
  if (mode === 'usage-final') usage('final');
  send({ method: 'item/completed', params: { threadId: thread, turnId: turn,
    item: { type: 'agentMessage', id: 'final-1', phase: 'final_answer', text } } });
  send({ method: 'turn/completed', params: { threadId: thread, turn: { id: turn, status, items: [], error: status === 'failed' ? { message: 'fixture failure' } : null } } });
}
readline.createInterface({ input: process.stdin }).on('line', line => {
  const m = JSON.parse(line);
  if (process.env.WORKER_FIXTURE_CAPTURE) fs.appendFileSync(process.env.WORKER_FIXTURE_CAPTURE, line + '\n');
  if (m.method === 'initialize') {
    if (mode === 'hang-initialize') return;
    if (mode === 'auth') return send({ id: m.id, error: { code: -32001, message: 'authentication required PRIVATE_PROVIDER_DIAGNOSTIC' } });
    return result(m.id, { userAgent: 'codex-fixture' });
  }
  if (m.method === 'initialized') return;
  if (m.method === 'thread/start' || m.method === 'thread/resume') {
    if (mode === 'hang-thread') return;
    if (m.params.sandbox !== 'danger-full-access' || m.params.approvalPolicy !== 'never') process.exit(91);
    if (m.method === 'thread/start' && (m.params.ephemeral !== false || m.params.dynamicTools?.[0]?.type !== 'function')) process.exit(92);
    thread = m.params.threadId || thread;
    // Fresh 0.153.2 threads return a computed path without creating it or its
    // date directories. Resume has existing history; the missing case is a fault fixture.
    if (m.method === 'thread/resume' && mode !== 'usage-resume-missing') usage('historical', 77777);
    const opened = { thread: { id: thread, turns: [], path: mode === 'usage-missing-path' ? null : rollout, cliVersion: '0.1.0' }, modelProvider: 'openai', model: mode === 'wrong-model' ? 'gpt-5.5' : m.params.model,
      sandbox: { type: mode === 'wrong-sandbox' ? 'readOnly' : 'dangerFullAccess' }, approvalPolicy: 'never' };
    if (mode === 'usage-thread-ack-fault') return process.stdout.write(JSON.stringify({ id: m.id, result: opened }) + '\n{not json}\n');
    return result(m.id, opened);
  }
  if (m.method === 'turn/start') {
    if (m.params.sandboxPolicy?.type !== 'dangerFullAccess') process.exit(93);
    if (mode === 'usage-turn-ack-fault') {
      usage('before-fault');
      return process.stdout.write(JSON.stringify({ id: m.id, result: { turn: { id: turn, status: 'inProgress', items: [], error: null } } }) + '\n{not json}\n');
    }
    if (mode === 'early-cross-turn' || mode === 'usage-early-cross-turn') {
      usage('unacknowledged');
      finish('REPORT FROM TURN A'); turn = 'turn-B';
      return result(m.id, { turn: { id: turn, status: 'inProgress', items: [], error: null } });
    }
    if (mode === 'hang-turn' || mode === 'fail-before-ack') {
      usage('unacknowledged');
      if (mode === 'fail-before-ack') return send({ id: 701, method: 'item/commandExecution/requestApproval', params: { threadId: thread, turnId: turn } });
      return;
    }
    if (mode === 'usage-early') {
      usage('early'); finish('early fixture');
      return result(m.id, { turn: { id: turn, status: 'inProgress', items: [], error: null } });
    }
    if (mode === 'usage-early-failed' || mode === 'usage-early-interrupted') {
      usage('before-logical-failure'); finish('', mode === 'usage-early-failed' ? 'failed' : 'interrupted');
      return result(m.id, { turn: { id: turn, status: 'inProgress', items: [], error: null } });
    }
    result(m.id, { turn: { id: turn, status: 'inProgress', items: [], error: null } });
    if (mode.startsWith('usage-')) {
      if (!['usage-final', 'usage-none', 'usage-missing-path', 'usage-never-created'].includes(mode)) usage('one');
      if (mode === 'usage-none') materialize();
      if (mode === 'usage-complete') { usage('two', 80); usage('child', 555, { thread_id: 'different-thread' }); }
      if (mode === 'usage-crash') return process.exit(42);
      if (mode === 'usage-timeout') return;
      if (mode === 'usage-fail') return finish('NOT A SUCCESS', 'failed');
      if (mode === 'usage-interrupted') return finish('', 'interrupted');
      if (mode !== 'usage-question') return finish(process.env.WORKER_FIXTURE_REPORT || 'usage fixture completed');
    }
    if (mode === 'crash') return process.exit(42);
    if (mode === 'oversize') return process.stdout.write('x'.repeat(2 * 1024 * 1024));
    if (mode === 'invalid-json') return process.stdout.write('{not json}\n');
    if (mode === 'empty') return finish('');
    if (mode === 'fail') return finish('NOT A SUCCESS', 'failed');
    if (mode === 'cross-turn') {
      send({ method: 'item/completed', params: { threadId: thread, turnId: turn, item: { type: 'agentMessage', phase: 'final_answer', text: 'REPORT FROM TURN A' } } });
      turn = 'turn-B'; send({ method: 'turn/started', params: { threadId: thread, turn: { id: turn } } });
      return send({ method: 'turn/completed', params: { threadId: thread, turn: { id: turn, status: 'completed' } } });
    }
    if (mode === 'complete') return finish(process.env.WORKER_FIXTURE_REPORT || 'completed fixture');
    if (mode === 'child' || mode === 'delayed-child') {
      const startChild = () => {
        const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });
        fs.writeFileSync(process.env.WORKER_FIXTURE_CHILD_PID_FILE, String(child.pid));
      };
      // Expose the turn/start reply before child readiness for the cleanup regression.
      if (mode === 'delayed-child') setTimeout(startChild, 1000);
      else startChild();
      return;
    }
    if (mode === 'wait' || mode === 'steer-reject') return;
    const native = mode === 'native' || mode === 'multi-input';
    return send({ id: 701, method: native ? 'item/tool/requestUserInput' : mode === 'approval' ? 'item/commandExecution/requestApproval' : 'item/tool/call',
      params: { threadId: thread, turnId: turn, callId: 'call-1', itemId: 'item-1', isBlocking: true,
        tool: 'sgsd_ask_orchestrator', arguments: { question: 'Which part first?', context: 'fixture bounded context' },
        questions: [{ id: 'q1', header: 'Task', question: 'Which part first?', options: [{ label: 'Tests', description: 'Exercise behavior first' }], isOther: true, isSecret: false },
          ...(mode === 'multi-input' ? [{ id: 'q2', header: 'Scope', question: 'Which project?', options: null, isOther: true, isSecret: false }] : [])] } });
  }
  if (m.id === 701 && !m.method) {
    if (m.error) return finish('refused request', 'failed');
    const answer = mode === 'multi-input' ? JSON.stringify(m.result.answers) : mode === 'native' ? m.result.answers.q1.answers[0] : m.result.contentItems[0].text;
    return finish(process.env.WORKER_FIXTURE_REPORT || answer);
  }
  if (m.method === 'turn/steer') {
    if (mode === 'steer-reject') return send({ id: m.id, error: { code: -32602, message: 'fixture steering rejected' } });
    result(m.id, { turnId: turn }); return finish(m.params.input[0].text);
  }
  if (m.method === 'turn/interrupt') { result(m.id, {}); return finish('', 'interrupted'); }
});

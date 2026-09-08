'use strict';
const { spawn, spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
function classifyError(value) {
  const body = (typeof value === 'string' ? value : JSON.stringify(value || {})).slice(0, 8192);
  if (/unauthori[sz]ed|not logged in|authentication (?:failed|required)|invalid api key|(?:status|httpStatusCode|statusCode)["\s:=]+401\b/i.test(body)) return 'worker_authentication_required';
  if (/quota exceeded|usage.?limit.?exceeded|rate.?limit|(?:status|httpStatusCode|statusCode)["\s:=]+429\b/i.test(body)) return 'worker_rate_limit';
  if (/model_not_found|unsupported model|model.{0,90}not (?:supported|found)/i.test(body)) return 'worker_model_unavailable';
  return null;
}
function resolveCommand(command, prefix = [], { platform = process.platform, env = process.env } = {}) {
  if (platform !== 'win32') return { command, prefix };
  if (/\.(cmd|bat|ps1)$/i.test(command)) throw new Error('app_server_native_command_required');
  if (command !== 'codex') return /\.m?js$/i.test(command) ? { command: process.execPath, prefix: [command, ...prefix] } : { command, prefix };
  // Node cannot execute PowerShell/npm cmd shims over stdio. Use the official JS
  // launcher directly (it owns the native executable) without shell interpolation.
  for (const dir of (env.PATH || env.Path || '').split(';').filter(Boolean)) {
    const native = path.join(dir, 'codex.exe'); if (fs.existsSync(native)) return { command: native, prefix };
  }
  const launcher = env.APPDATA && path.join(env.APPDATA, 'npm', 'node_modules', '@openai', 'codex', 'bin', 'codex.js');
  if (launcher && fs.existsSync(launcher)) return { command: process.execPath, prefix: [launcher, ...prefix] };
  throw new Error('app_server_native_command_required');
}
class Rpc extends EventEmitter {
  constructor(command, args, { cwd, env = process.env } = {}) {
    super(); this.pending = new Map(); this.sequence = 0; this.closed = false; this.buffer = '';
    const resolved = resolveCommand(command, [], { env });
    this.child = spawn(resolved.command, [...resolved.prefix, ...args], { cwd, env, stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true, detached: process.platform !== 'win32' });
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data', chunk => {
      this.buffer += chunk;
      if (Buffer.byteLength(this.buffer) > 1024 * 1024) return this.fail(new Error('app_server_frame_limit'));
      let end;
      while ((end = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1);
        if (!line.trim()) continue;
        let message;
        try { message = JSON.parse(line); if (!message || typeof message !== 'object') throw new Error(); }
        catch { this.fail(new Error('app_server_invalid_json')); return; }
        if (!message.method && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id); this.pending.delete(message.id); clearTimeout(pending.timer);
          if (message.error) {
            const error = new Error(classifyError(message.error) || `app_server_request_failed:${pending.method}`);
            error.remoteRejected = true; pending.reject(error);
          } else pending.resolve(message.result);
        } else queueMicrotask(() => { if (!this.closed) this.emit('message', message); });
      }
    });
    // Never persist raw provider diagnostics or tool payloads into telemetry.
    this.diagnosticTail = ''; this.diagnosticClass = null;
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', chunk => {
      const sample = this.diagnosticTail + chunk.slice(0, 8192);
      this.diagnosticClass ||= classifyError(sample); this.diagnosticTail = sample.slice(-256);
    });
    this.child.stdin.on('error', () => this.fail(new Error('app_server_input_closed')));
    this.child.on('error', () => this.fail(new Error('app_server_unavailable')));
    this.child.on('close', () => this.fail(new Error(this.diagnosticClass || 'app_server_disconnected')));
  }
  send(message) {
    if (this.closed) throw new Error('app_server_closed');
    const line = JSON.stringify(message) + '\n';
    if (Buffer.byteLength(line) > 1024 * 1024) throw new Error('app_server_frame_limit');
    this.child.stdin.write(line);
  }
  request(method, params, timeout = 10000) {
    if (this.pending.size >= 64) return Promise.reject(new Error('app_server_pending_limit'));
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`app_server_timeout:${method}`)); }, timeout);
      this.pending.set(id, { resolve, reject, timer, method });
      try { this.send({ id, method, params }); } catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }
  fail(error) {
    if (this.closed) return;
    this.closed = true;
    this.diagnosticTail = '';
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); }
    this.pending.clear(); this.emit('fault', error);
    if (Number.isSafeInteger(this.child.pid) && this.child.pid > 0) {
      if (process.platform === 'win32') {
        // Numeric PID is from our spawn, never an operator-supplied broad target.
        spawnSync('taskkill.exe', ['/PID', String(this.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 2000 });
      } else { try { process.kill(-this.child.pid, 'SIGKILL'); } catch {} }
    }
    this.child.kill();
  }
  close() { this.fail(new Error('app_server_closed')); }
}
module.exports = { Rpc, resolveCommand, classifyError };

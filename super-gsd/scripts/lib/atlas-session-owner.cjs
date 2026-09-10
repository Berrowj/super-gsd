'use strict';
// Ownership binding is separate from the read-only Atlas delivery briefing.
const fs = require('node:fs');
const path = require('node:path');

function lookupProcess(pid) {
  if (process.platform !== 'linux' || !Number.isSafeInteger(pid) || pid < 2) return null;
  try {
    const base = `/proc/${pid}`;
    const stat = fs.readFileSync(`${base}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    if (fields[0] === 'Z') return null;
    // Bound reads; only selected metadata leaves this function.
    const readPrefix = file => {
      const fd = fs.openSync(file, 'r');
      try { const buf = Buffer.alloc(512 * 1024); const n = fs.readSync(fd, buf); return n === buf.length ? null : buf.subarray(0, n).toString(); }
      finally { fs.closeSync(fd); }
    };
    const environment = readPrefix(`${base}/environ`), command = readPrefix(`${base}/cmdline`);
    if (environment === null || command === null) return null;
    const run = environment.split('\0').find(value => value.startsWith('SGSD_RUN_ID='));
    const args = command.split('\0').filter(Boolean);
    const executable = fs.readlinkSync(`${base}/exe`);
    const provider = /^claude(?:-[\w.-]+)?$/.test(path.basename(executable))
      || /^claude$/.test(stat.slice(stat.indexOf('(') + 1, stat.lastIndexOf(')')))
      || args.slice(0, 3).some(arg => /(?:^|\/)@anthropic-ai\/claude-code\/(?:cli|claude)\.js$/.test(arg));
    return { ppid: Number(fields[1]), provider, runId: run?.slice('SGSD_RUN_ID='.length) };
  } catch { return null; }
}

function findProviderAncestor({ pid = process.ppid, runId, lookup = lookupProcess } = {}) {
  const seen = new Set();
  for (let depth = 0; depth < 16 && Number.isSafeInteger(pid) && pid > 1 && !seen.has(pid); depth++) {
    seen.add(pid);
    const row = lookup(pid);
    if (!row || row.runId !== runId) return null;
    if (row.provider) return pid;
    pid = row.ppid;
  }
  return null;
}

function bindSessionOwner({ projectDir, sessionId, environment = process.env,
  findProvider = findProviderAncestor, bind } = {}) {
  if (!environment.SGSD_RUN_ID) return { status: 'unregistered', reason: 'supported_launch_required' };
  if (environment.SGSD_FLEET_MANAGED !== '1') return { status: 'unmanaged', reason: 'no_orchestrator_claim' };
  try {
    if (!environment.SGSD_ATLAS_GLOBAL_ROOT || !projectDir) throw Error('ownership_context_missing');
    const pid = findProvider({ runId: environment.SGSD_RUN_ID });
    if (!pid) throw Error('provider_identity_unavailable');
    // Literal dependency: the existing hook installer ships this full closure
    // into both project and flattened installs; no mixed-version fallback.
    const bindOwner = bind || require('../../tools/telemetry-atlas/fleet.cjs').bind;
    const tmux = environment.TMUX_PANE ? { pane_id: environment.TMUX_PANE } : undefined;
    return bindOwner({ root: environment.SGSD_ATLAS_GLOBAL_ROOT, runId: environment.SGSD_RUN_ID,
      projectDir, pid, sessionId, tmux });
  } catch (error) {
    return { status: 'blocked', reason: /^[a-z][a-z0-9_]{0,80}$/.test(error.message) ? error.message : 'ownership_binding_failed' };
  }
}

module.exports = { bindSessionOwner, findProviderAncestor };

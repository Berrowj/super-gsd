#!/usr/bin/env node
/**
 * VTP MCP tunnel supervisor.
 *
 * Long-lived process (run via NSSM on Windows). Each iteration:
 *   1. Generate a fresh 32-byte hex bearer token.
 *   2. Atomically write {VTP_DATA}/mcp-active-tokens.json containing
 *      the new token (plus any still-fresh prior tokens, capped at 3).
 *   3. Spawn `ssh -R 4101:127.0.0.1:4101 ...` to the Linux build host and
 *      pipe the token over ssh stdin.
 *   4. The remote shell writes ~/.vtp-bearer with mode 0600 and removes it
 *      via an EXIT trap when the ssh session ends.
 *   5. When ssh exits (network drop, host reboot, etc.), the token used by
 *      that session is invalidated immediately on disk. Loop with a small
 *      backoff and a fresh token.
 *
 * The server reads the token file and watches it for changes. Linux side
 * never sees a token outside of the live SSH session.
 *
 * Config: super-gsd/config/vtp-tunnel.json (or env overrides):
 *   {
 *     "remote_host": "user@build.example.com",
 *     "remote_port": 22,
 *     "local_mcp_port": 4101,
 *     "remote_bind_port": 4101,
 *     "ssh_identity": "C:/Users/jack.berrow/.ssh/id_ed25519",  // optional
 *     "extra_ssh_args": []
 *   }
 *
 * Env overrides (precedence over config file):
 *   VTP_TUNNEL_REMOTE_HOST    user@host
 *   VTP_TUNNEL_REMOTE_PORT    22
 *   VTP_TUNNEL_LOCAL_PORT     4101
 *   VTP_TUNNEL_REMOTE_BIND    4101
 *   VTP_TUNNEL_IDENTITY       path to ssh key
 *   VTP_MCP_TOKEN_FILE        path to the active-tokens.json (default ~/.vtp/...)
 */

const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, server-side ceiling. Each session token is also invalidated on ssh exit.
const MAX_KEPT_TOKENS = 3; // overlap window for concurrent or quickly-rotating sessions
const MIN_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

function loadConfig() {
  const configPath = path.join(__dirname, '..', 'config', 'vtp-tunnel.json');
  let fileCfg = {};
  if (fs.existsSync(configPath)) {
    try {
      fileCfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (err) {
      console.error('[tunnel] could not parse config:', err.message);
    }
  }
  const qdrantPort = process.env.VTP_TUNNEL_QDRANT_PORT || fileCfg.qdrant_forward_port;
  return {
    remote_host: process.env.VTP_TUNNEL_REMOTE_HOST || fileCfg.remote_host,
    remote_port: Number(process.env.VTP_TUNNEL_REMOTE_PORT || fileCfg.remote_port || 22),
    local_mcp_port: Number(process.env.VTP_TUNNEL_LOCAL_PORT || fileCfg.local_mcp_port || 4101),
    remote_bind_port: Number(process.env.VTP_TUNNEL_REMOTE_BIND || fileCfg.remote_bind_port || 4101),
    qdrant_forward_port: qdrantPort ? Number(qdrantPort) : null,
    ssh_identity: process.env.VTP_TUNNEL_IDENTITY || fileCfg.ssh_identity || null,
    extra_ssh_args: fileCfg.extra_ssh_args || [],
    token_file: process.env.VTP_MCP_TOKEN_FILE || path.join(os.homedir(), '.vtp', 'mcp-active-tokens.json'),
  };
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function readTokenFile(file) {
  if (!fs.existsSync(file)) return { tokens: [] };
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return { tokens: [] };
  }
}

function writeTokenFile(file, data) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function rotateToken(tokenFile, sessionLabel) {
  const now = Date.now();
  const existing = readTokenFile(tokenFile);
  const fresh = (existing.tokens || []).filter((t) => {
    const exp = Date.parse(t.expires_at);
    return Number.isFinite(exp) && exp > now;
  });

  const newToken = {
    value: generateToken(),
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + TOKEN_TTL_MS).toISOString(),
    session_label: sessionLabel,
  };

  const next = [newToken, ...fresh].slice(0, MAX_KEPT_TOKENS);
  writeTokenFile(tokenFile, { tokens: next });
  return newToken.value;
}

function invalidateToken(tokenFile, tokenValue) {
  const existing = readTokenFile(tokenFile);
  const remaining = (existing.tokens || []).filter((t) => t.value !== tokenValue);
  writeTokenFile(tokenFile, { tokens: remaining });
}

function buildSshArgs(cfg) {
  // We deliberately do NOT use -N. With -N there is no shell on the remote
  // side, so the bearer never reaches the MCP client. Instead we run a tiny
  // remote shell that:
  //   1. Sets a restrictive umask so the bearer file is 0600.
  //   2. Reads the token from stdin (avoids the env-var pass-through which
  //      would require AcceptEnv VTP_MCP_BEARER in sshd_config - and would
  //      also leak the token via ps if we put it on the command line).
  //   3. Writes the token atomically to ~/.vtp-bearer (0600).
  //   4. Installs an EXIT trap that removes ~/.vtp-bearer when the session ends.
  //   5. Blocks on `tail -f /dev/null` to keep the session alive indefinitely.
  // When the supervisor kills the ssh process, the remote shell exits and
  // the trap fires - the bearer file is removed before the next session
  // rotates a fresh token.
  // NOTE: we deliberately do NOT exec the wait-loop. exec would replace the
  // trap-bearing shell with the loop process and the EXIT trap would be lost,
  // leaving ~/.vtp-bearer behind on session exit. Backgrounding + wait keeps
  // the trap-bearing shell alive as the parent.
  const remoteScript =
    'umask 077; ' +
    'IFS= read -r __vtp_bearer; ' +
    'tmp=$(mktemp $HOME/.vtp-bearer.XXXXXX); ' +
    'printf "%s" "$__vtp_bearer" > "$tmp"; ' +
    'unset __vtp_bearer; ' +
    'mv "$tmp" $HOME/.vtp-bearer; ' +
    'trap "rm -f $HOME/.vtp-bearer; kill -- -$$ 2>/dev/null; exit 0" EXIT INT TERM HUP; ' +
    'tail -f /dev/null & ' +
    'wait $!';
  const args = [
    '-T',
    '-o', 'ServerAliveInterval=60',
    '-o', 'ServerAliveCountMax=3',
    '-o', 'ExitOnForwardFailure=yes',
    '-o', 'StrictHostKeyChecking=accept-new',
    '-R', `${cfg.remote_bind_port}:127.0.0.1:${cfg.local_mcp_port}`,
    '-p', String(cfg.remote_port),
  ];
  // Forward laptop:<qdrant_forward_port> -> remote:127.0.0.1:6333 so the
  // VTP MCP server on the laptop can query Qdrant on the SSH host.
  if (cfg.qdrant_forward_port) {
    args.push('-L', `${cfg.qdrant_forward_port}:127.0.0.1:6333`);
  }
  if (cfg.ssh_identity) args.push('-i', cfg.ssh_identity);
  if (Array.isArray(cfg.extra_ssh_args)) args.push(...cfg.extra_ssh_args);
  args.push(cfg.remote_host);
  args.push(remoteScript);
  return args;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce(cfg, backoffMs) {
  const sessionLabel = `session-${Date.now()}`;
  const token = rotateToken(cfg.token_file, sessionLabel);
  console.error(`[tunnel] starting ssh ${cfg.remote_host} -R ${cfg.remote_bind_port}:127.0.0.1:${cfg.local_mcp_port} (session=${sessionLabel})`);

  return new Promise((resolve) => {
    const child = spawn('ssh', buildSshArgs(cfg), {
      stdio: ['pipe', 'inherit', 'inherit'],
      windowsHide: true,
    });

    // Pipe the token to the remote shell via stdin. The remote `read` will
    // pick it up, write it to ~/.vtp-bearer, then block on tail -f. We close
    // stdin after writing so the remote `read` returns immediately.
    try {
      child.stdin.write(token + '\n');
      child.stdin.end();
    } catch (err) {
      console.error('[tunnel] failed to send bearer over ssh stdin:', err.message);
    }

    let exited = false;
    const finish = (code, signal) => {
      if (exited) return;
      exited = true;
      invalidateToken(cfg.token_file, token);
      console.error(`[tunnel] ssh exited code=${code} signal=${signal ?? 'none'} session=${sessionLabel} - token invalidated`);
      resolve();
    };

    child.on('error', (err) => {
      console.error('[tunnel] failed to spawn ssh:', err.message);
      finish(-1, null);
    });
    child.on('exit', finish);

    const shutdown = () => {
      console.error('[tunnel] supervisor caught termination signal, killing ssh child');
      try { child.kill('SIGTERM'); } catch {}
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
      }, 3000).unref?.();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}

async function main() {
  const cfg = loadConfig();
  if (!cfg.remote_host) {
    console.error('[tunnel] FATAL: remote_host not configured. Set VTP_TUNNEL_REMOTE_HOST or super-gsd/config/vtp-tunnel.json');
    process.exit(2);
  }

  console.error(`[tunnel] supervisor up. remote=${cfg.remote_host}:${cfg.remote_port} ` +
    `local_mcp=127.0.0.1:${cfg.local_mcp_port} -> remote:${cfg.remote_bind_port} ` +
    `token_file=${cfg.token_file}`);

  let backoff = MIN_BACKOFF_MS;
  while (true) {
    const started = Date.now();
    await runOnce(cfg, backoff);
    const lived = Date.now() - started;
    backoff = lived > 30_000 ? MIN_BACKOFF_MS : Math.min(backoff * 2, MAX_BACKOFF_MS);
    console.error(`[tunnel] reconnect in ${backoff}ms`);
    await sleep(backoff);
  }
}

main().catch((err) => {
  console.error('[tunnel] fatal:', err);
  process.exit(1);
});

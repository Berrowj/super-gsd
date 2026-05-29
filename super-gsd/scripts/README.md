# VTP-MCP Bridge — script index

This directory holds the laptop-side and devcp-side deployment scripts for
the VTP-MCP bridge. The operator guide (architecture, install, verify,
restart, rotate, diagnose) lives at:

- **[`../docs/vtp-remote-access.md`](../docs/vtp-remote-access.md)** — start here.

## What lives where

### Laptop side (Windows)

| File | Role |
|---|---|
| `install-vtp-tasks-userscope.ps1` | Registers user-scope Scheduled Tasks (`VTP-MCP`, `VTP-MCP-Tunnel`). No admin required. Preferred deployment. |
| `install-vtp-services-elevated.ps1` | Bootstrap wrapper for the NSSM/services path. Requires admin. |
| `install-vtp-remote-services.ps1` | Underlying NSSM installer; invoked by the elevated wrapper. |
| `vtp-mcp-loop.cmd` | Restart-on-crash wrapper for `npx tsx src/cli.ts mcp --transport http --port 4101`. |
| `vtp-tunnel-loop.cmd` | Restart-on-crash wrapper for the tunnel supervisor; waits up to 60s for the MCP listener before the first ssh. |
| `launch-vtp-mcp.vbs`, `launch-vtp-tunnel.vbs` | Hidden-window launchers — Task Scheduler invokes these. |
| `vtp-tunnel-supervisor.cjs` | The supervisor itself. Rotates a 64-byte bearer per ssh session, pipes it to the remote shell via ssh stdin, invalidates on session exit. |

### devcp side (Linux)

| File | Role |
|---|---|
| `devcp/install.sh` | Idempotent bootstrap. Installs `mcp-remote`, drops the bridge wrapper at `~/.local/bin/vtp-mcp-bridge`, registers it with Claude Code at user scope. |
| `devcp/vtp-mcp-bridge.sh` | The stdio↔HTTP bridge. Reads bearer fresh from `~/.vtp-bearer`; execs `npx mcp-remote` against `http://localhost:4101/mcp`. |

### Per-machine config (gitignored)

| File | Role |
|---|---|
| `../config/vtp-tunnel.json` | Per-machine tunnel config (devcp alias, ssh identity path, ports). Use `../config/vtp-tunnel.json.example` as the template. Never committed. |

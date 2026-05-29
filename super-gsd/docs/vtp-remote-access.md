# VTP MCP Remote Access

This is the operator guide for exposing the Windows-hosted VTP MCP server to
the Linux build host (`devcp`) without putting a long-lived bearer token on
Linux.

The current deployment is intentionally personal:

- Windows user: `%USERPROFILE%` (e.g. `C:\Users\<your-user>`)
- VTP repo: `%USERPROFILE%\Voice-Text-Plan`
- Linux user/host: `<linux-user>@<build-host>`
- Remote bridge: `~/.local/bin/vtp-mcp-bridge` on the build host

The example tokens above are placeholders — substitute your own user/host names.

## Architecture

```text
Windows laptop                                  devcp
--------------                                  -----
Task Scheduler
  VTP-MCP
    -> launch-vtp-mcp.vbs
    -> vtp-mcp-loop.cmd
    -> npx tsx src/cli.ts mcp
    -> HTTP MCP server on 127.0.0.1:4101

  VTP-MCP-Tunnel
    -> launch-vtp-tunnel.vbs
    -> vtp-tunnel-loop.cmd
    -> node vtp-tunnel-supervisor.cjs
    -> rotates bearer token
    -> writes active tokens on Windows
    -> ssh -R 4101:127.0.0.1:4101 devcp
    -> pipes bearer over ssh stdin
                                                ~/.vtp-bearer
                                                mode 0600
                                                self-healed while ssh is alive
                                                removed by trap on ssh exit

                                                vtp-mcp-bridge
                                                  -> reads ~/.vtp-bearer fresh
                                                  -> runs mcp-remote
                                                  -> sends Authorization header
```

## Files

Windows restart loops:

- `super-gsd/scripts/vtp-mcp-loop.cmd`
- `super-gsd/scripts/vtp-tunnel-loop.cmd`
- `super-gsd/scripts/launch-vtp-mcp.vbs`
- `super-gsd/scripts/launch-vtp-tunnel.vbs`

Installers:

- `super-gsd/scripts/install-vtp-tasks-userscope.ps1`
- `super-gsd/scripts/install-vtp-services-elevated.ps1`
- `super-gsd/scripts/install-vtp-remote-services.ps1`

Tunnel logic:

- `super-gsd/scripts/vtp-tunnel-supervisor.cjs`
- `super-gsd/config/vtp-tunnel.json.example`

Local config:

- `super-gsd/config/vtp-tunnel.json`
- Do not treat this as portable. It is machine/operator-specific.
- It contains no bearer token, but it may contain local SSH paths.

## Install

For the current user-scope deployment:

```powershell
powershell -ExecutionPolicy Bypass -File .\super-gsd\scripts\install-vtp-tasks-userscope.ps1
schtasks /Run /TN VTP-MCP
Start-Sleep -Seconds 8
schtasks /Run /TN VTP-MCP-Tunnel
```

For the admin/NSSM path, use the elevated wrapper:

```powershell
powershell -ExecutionPolicy Bypass -File .\super-gsd\scripts\install-vtp-services-elevated.ps1
```

The user-scope scheduled task route is currently preferred because it does not
require Windows service privileges.

## Verify Windows Side

```powershell
Get-ScheduledTask -TaskName VTP-*
netstat -ano | findstr ":4101"
Get-Content C:\Users\user\Voice-Text-Plan\.planning\logs\services\vtp-mcp.err.log -Tail 20
Get-Content C:\Users\user\Voice-Text-Plan\.planning\logs\services\vtp-tunnel.err.log -Tail 20
```

Expected:

- `VTP-MCP` is ready/running.
- `VTP-MCP-Tunnel` is ready/running.
- Windows listens on `127.0.0.1:4101`.
- Tunnel logs show an ssh session to `devcp`.

## Verify devcp Side

```bash
ls -l ~/.vtp-bearer
curl -sS http://localhost:4101/mcp \
  -H "Authorization: Bearer $(cat ~/.vtp-bearer)" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

Expected:

- `~/.vtp-bearer` exists while the tunnel is alive.
- File mode is `0600`.
- The curl call returns HTTP 200 / JSON-RPC initialize output.
- A call without the Authorization header returns `401`.

## Wire Claude Code

Claude Code already has a separate MCP registry. Add/use the VTP bridge on
devcp:

```bash
claude mcp add vtp -- /home/<linux-user>/.local/bin/vtp-mcp-bridge
claude mcp list
```

Expected:

```text
vtp: Connected
```

## Wire Codex CLI

Codex CLI has its own MCP registry. Claude's MCP config does not carry over.

On devcp:

```bash
export PATH=/home/<linux-user>/.local/bin:/home/<linux-user>/.nvm/versions/node/v24.15.0/bin:$PATH
codex mcp add vtp -- /home/<linux-user>/.local/bin/vtp-mcp-bridge
codex mcp list
```

Expected:

```text
Name  Command                                     Status
vtp   /home/<linux-user>/.local/bin/vtp-mcp-bridge  enabled
```

## Restart

```powershell
schtasks /End /TN VTP-MCP-Tunnel
schtasks /End /TN VTP-MCP
schtasks /Run /TN VTP-MCP
Start-Sleep -Seconds 8
schtasks /Run /TN VTP-MCP-Tunnel
```

Killing the underlying loop processes is also acceptable: the task/loop design
is built to respawn.

## Token Rotation

- Each ssh reconnect generates a fresh 64-character bearer.
- The Windows MCP server keeps the last three tokens warm for short reconnects.
- The devcp bearer is written to `~/.vtp-bearer` with `0600` permissions.
- While the ssh session is alive, a remote watchdog checks the bearer every 15
  seconds and rewrites it if it has gone missing or stale.
- When the ssh tunnel exits, the remote shell trap removes `~/.vtp-bearer`.

If a Claude or Codex session was already open before rotation, restart that
client session if tool calls start failing authentication.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `codex: command not found` over ssh | Non-interactive PATH lacks Node/Codex | Export `/home/<linux-user>/.local/bin` and the active nvm Node bin before running Codex |
| `401 Unauthorized` from devcp while port 4101 listens | Bearer missing/stale | Wait up to 15s for self-heal; if still broken, restart `VTP-MCP-Tunnel`; verify `~/.vtp-bearer` exists and matches a warm token |
| `curl: connection refused` from devcp | Reverse tunnel is down | Restart `VTP-MCP-Tunnel`; inspect `vtp-tunnel.err.log` |
| Windows has no listener on 4101 | MCP task is not running | Run `schtasks /Run /TN VTP-MCP`; inspect `vtp-mcp.err.log` |
| `~/.vtp-bearer` remains after tunnel stop | Remote trap did not run | Remove it manually, then restart the tunnel |

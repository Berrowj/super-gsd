#!/usr/bin/env bash
# VTP MCP stdio bridge for the devcp side of the tunnel.
#
# Bridges Claude Code's stdio MCP transport to the HTTP MCP server on the
# operator's laptop (reachable at localhost:4101 via the ssh reverse tunnel
# that the laptop's vtp-tunnel-supervisor.cjs keeps open).
#
# Bearer is read fresh from ~/.vtp-bearer on every invocation, so bearer
# rotations between Claude Code launches are picked up automatically.
#
# Installed at ~/.local/bin/vtp-mcp-bridge by devcp-side/install.sh and
# registered with Claude Code via:
#
#     claude mcp add --scope user vtp ~/.local/bin/vtp-mcp-bridge

set -e

export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

TOKEN_FILE="$HOME/.vtp-bearer"

if [ ! -r "$TOKEN_FILE" ]; then
  echo "[vtp-mcp-bridge] bearer file missing: $TOKEN_FILE" >&2
  echo "[vtp-mcp-bridge]   - is the laptop's vtp-tunnel scheduled task running?" >&2
  echo "[vtp-mcp-bridge]   - is the ssh session from laptop->devcp alive?" >&2
  echo "[vtp-mcp-bridge] check from the laptop:" >&2
  echo "[vtp-mcp-bridge]   schtasks /Query /TN VTP-MCP-Tunnel /V /FO LIST" >&2
  exit 2
fi

TOKEN=$(cat "$TOKEN_FILE")
exec npx -y mcp-remote@latest http://localhost:4101/mcp \
  --header "Authorization: Bearer $TOKEN"

#!/usr/bin/env bash
# VTP MCP stdio bridge for the devcp side of the tunnel.
#
# Bridges Claude Code's stdio MCP transport to the HTTP MCP server on the
# operator's laptop (reachable at localhost:4101 via the ssh reverse tunnel
# that the laptop's vtp-tunnel-supervisor.cjs keeps open).
#
# Execs vtp-stdio-proxy.mjs, which reads ~/.vtp-bearer on EVERY request.
# The previous mcp-remote implementation captured the token once at spawn,
# so every tunnel rebind (which rotates the token) stranded all running
# Claude Code sessions with permanent 401s until a manual /mcp reconnect.
#
# Installed at ~/.local/bin/vtp-mcp-bridge by devcp/install.sh and
# registered with Claude Code via:
#
#     claude mcp add --scope user vtp ~/.local/bin/vtp-mcp-bridge

set -e

export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

TOKEN_FILE="$HOME/.vtp-bearer"
PROXY="$HOME/.local/bin/vtp-stdio-proxy.mjs"

if [ ! -r "$TOKEN_FILE" ]; then
  echo "[vtp-mcp-bridge] bearer file missing: $TOKEN_FILE" >&2
  echo "[vtp-mcp-bridge]   - is the laptop's vtp-tunnel scheduled task running?" >&2
  echo "[vtp-mcp-bridge]   - is the ssh session from laptop->devcp alive?" >&2
  echo "[vtp-mcp-bridge] check from the laptop:" >&2
  echo "[vtp-mcp-bridge]   schtasks /Query /TN VTP-MCP-Tunnel /V /FO LIST" >&2
  exit 2
fi

if [ ! -r "$PROXY" ]; then
  echo "[vtp-mcp-bridge] proxy missing: $PROXY (re-run devcp/install.sh)" >&2
  exit 2
fi

# Warm the embedding model right after the session initializes: the first
# vector-backed query otherwise pays a 120s+ bge-base-en-v1.5 cold start on
# the laptop and reads as a hang (fault report 2026-08-26).
export VTP_PROXY_WARM_TOOL="vtp_search_book_passages"
export VTP_PROXY_WARM_ARGS='{"query":"session warmup"}'

exec node "$PROXY"

#!/usr/bin/env bash
# DEVCP-side bootstrap for the VTP-MCP bridge.
#
# Run ONCE on devcp (or any Linux box that the operator's laptop tunnels into):
#
#     bash <(curl -fsSL https://raw.githubusercontent.com/Berrowj/Voice-Text-Plan/master/super-gsd/scripts/devcp/install.sh)
#
# Or from a checkout:
#
#     bash super-gsd/scripts/devcp/install.sh
#
# What it does (idempotent — safe to re-run):
#   1. Ensures ~/.local/bin is on PATH (in ~/.bashrc and ~/.profile).
#   2. Installs mcp-remote globally via npm (no sudo — uses the nvm-owned
#      prefix at ~/.nvm/versions/node/<current>/).
#   3. Drops vtp-mcp-bridge.sh into ~/.local/bin/vtp-mcp-bridge.
#   4. Registers the bridge with Claude Code at user scope.
#
# Prerequisites:
#   - Claude Code installed (`claude --version` works).
#   - node + npm (the operator's chosen runtime, typically via nvm).
#   - The laptop side of the bridge is up — i.e. the laptop's
#     vtp-tunnel-supervisor.cjs has spawned an ssh session into this host
#     and ~/.vtp-bearer exists. (Bridge install runs without it; the bridge
#     just won't serve traffic until the tunnel comes up.)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_SRC="$SCRIPT_DIR/vtp-mcp-bridge.sh"
LOCAL_BIN="$HOME/.local/bin"
BRIDGE_DST="$LOCAL_BIN/vtp-mcp-bridge"

if [ ! -r "$BRIDGE_SRC" ]; then
  echo "[install] FATAL: $BRIDGE_SRC not found" >&2
  exit 2
fi

mkdir -p "$LOCAL_BIN"

# 1. PATH
case ":$PATH:" in
  *":$LOCAL_BIN:"*) ;;
  *)
    for rc in "$HOME/.bashrc" "$HOME/.profile"; do
      [ -f "$rc" ] || continue
      grep -q 'export PATH="$HOME/.local/bin' "$rc" 2>/dev/null && continue
      echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$rc"
      echo "[install] appended PATH to $rc"
    done
    ;;
esac

# 2. mcp-remote
if ! command -v mcp-remote >/dev/null 2>&1; then
  echo "[install] installing mcp-remote globally"
  npm install -g mcp-remote
else
  echo "[install] mcp-remote already installed: $(command -v mcp-remote)"
fi

# 3. wrapper
install -m 0755 "$BRIDGE_SRC" "$BRIDGE_DST"
echo "[install] bridge installed at $BRIDGE_DST"

# 4. Claude Code registration
if ! command -v claude >/dev/null 2>&1; then
  echo "[install] WARN: claude not on PATH — bridge installed but not registered."
  echo "[install]       run manually once claude is available:"
  echo "[install]         claude mcp add --scope user vtp $BRIDGE_DST"
  exit 0
fi

if claude mcp list 2>/dev/null | grep -qE '^vtp:'; then
  echo "[install] vtp MCP server already registered with Claude Code — re-registering for idempotency"
  claude mcp remove vtp 2>/dev/null || true
fi
claude mcp add --scope user vtp "$BRIDGE_DST"

echo ""
echo "[install] Done. Verify with:"
echo "  claude mcp list"
echo ""
echo "If the bridge connects, the laptop's VTP MCP is reachable from this host."
echo "If not, check ~/.vtp-bearer exists and is readable (laptop tunnel must be up)."

#!/bin/bash
# Super GSD Orchestrator — Installation Script
#
# Prerequisites:
#   - GSD 1.0 installed: npx get-shit-done-cc@latest
#   - Node.js >= 20
#   - ByteRover (optional, installed if missing)
#
# Usage:
#   bash install.sh [--skip-brv] [--dry-run]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_DIR="$HOME/.claude"
GSD_DIR="$CLAUDE_DIR/get-shit-done"
HOOKS_DIR="$CLAUDE_DIR/hooks"
AGENTS_DIR="$CLAUDE_DIR/agents"
COMMANDS_DIR="$CLAUDE_DIR/commands"
TEMPLATES_DIR="$GSD_DIR/templates/super-gsd"

SKIP_BRV=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --skip-brv) SKIP_BRV=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

log() { echo "  [super-gsd] $1"; }
copy_file() {
  if [ "$DRY_RUN" = true ]; then
    log "DRY RUN: would copy $1 → $2"
  else
    mkdir -p "$(dirname "$2")"
    cp "$1" "$2"
    log "installed: $2"
  fi
}

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     Super GSD Orchestrator — Install     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Check prerequisites ──
log "Checking prerequisites..."

if [ ! -d "$GSD_DIR" ]; then
  echo "ERROR: GSD 1.0 not found at $GSD_DIR"
  echo "Install it first: npx get-shit-done-cc@latest"
  exit 1
fi
log "GSD 1.0: found at $GSD_DIR"

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found"
  exit 1
fi
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 20 ]; then
  echo "ERROR: Node.js >= 20 required (found v$NODE_VER)"
  exit 1
fi
log "Node.js: v$(node -v | sed 's/v//')"

# ── Install agents ──
echo ""
log "Installing agents..."
for agent in "$SCRIPT_DIR/agents/"*.md; do
  name=$(basename "$agent")
  copy_file "$agent" "$AGENTS_DIR/$name"
done

# ── Install skills ──
echo ""
log "Installing skills..."
for skill_dir in "$SCRIPT_DIR/skills/"*/; do
  name=$(basename "$skill_dir")
  copy_file "$skill_dir/SKILL.md" "$COMMANDS_DIR/$name/SKILL.md"
done

# ── Install hooks ──
echo ""
log "Installing hooks..."
mkdir -p "$HOOKS_DIR"
for hook in "$SCRIPT_DIR/hooks/"*.js; do
  name=$(basename "$hook")
  copy_file "$hook" "$HOOKS_DIR/$name"
done

# ── Install templates ──
echo ""
log "Installing templates..."
for template in "$SCRIPT_DIR/templates/"*; do
  name=$(basename "$template")
  copy_file "$template" "$TEMPLATES_DIR/$name"
done

# ── Install workflows ──
echo ""
log "Installing workflows..."
for workflow in "$SCRIPT_DIR/workflows/"*; do
  name=$(basename "$workflow")
  copy_file "$workflow" "$GSD_DIR/workflows/$name"
done

# ── Install config ──
echo ""
log "Installing config..."
copy_file "$SCRIPT_DIR/config/model-routing.json" "$GSD_DIR/config/model-routing.json"

# ── ByteRover setup ──
if [ "$SKIP_BRV" = false ]; then
  echo ""
  log "ByteRover setup..."
  if command -v brv &>/dev/null; then
    log "ByteRover: already installed ($(brv --version 2>/dev/null || echo 'unknown'))"
  else
    log "Installing ByteRover..."
    if [ "$DRY_RUN" = false ]; then
      npm install -g byterover-cli
    else
      log "DRY RUN: would run npm install -g byterover-cli"
    fi
  fi

  # Copy seed files
  log "Copying ByteRover seed files..."
  for seed in "$SCRIPT_DIR/brv-seed/domains/"*.md; do
    name=$(basename "$seed")
    copy_file "$seed" "$TEMPLATES_DIR/brv-seed/$name"
  done
fi

# ── Summary ──
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║          Installation Complete           ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Installed:"
echo "  • $(ls "$SCRIPT_DIR/agents/"*.md 2>/dev/null | wc -l | tr -d ' ') agents"
echo "  • $(ls -d "$SCRIPT_DIR/skills/"*/ 2>/dev/null | wc -l | tr -d ' ') skills"
echo "  • $(ls "$SCRIPT_DIR/hooks/"*.js 2>/dev/null | wc -l | tr -d ' ') hooks"
echo "  • $(ls "$SCRIPT_DIR/templates/"* 2>/dev/null | wc -l | tr -d ' ') templates"
echo "  • $(ls "$SCRIPT_DIR/brv-seed/domains/"*.md 2>/dev/null | wc -l | tr -d ' ') ByteRover seed files"
echo ""
echo "Next steps:"
echo "  1. Merge config/settings-overlay.json into ~/.claude/settings.json"
echo "  2. Append CLAUDE-OVERLAY.md to your project's CLAUDE.md"
echo "  3. In your project directory: /gsd-brv-setup"
echo "  4. Say 'go' to start the autonomous loop"
echo ""

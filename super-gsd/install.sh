#!/bin/bash
# Super GSD Orchestrator — Installation Script
#
# Prerequisites:
#   - Claude Code on Max plan (no API keys needed)
#   - GSD 1.0 installed: npx get-shit-done-cc@latest
#   - Node.js >= 22
#
# Usage:
#   bash install.sh [--skip-brv] [--dry-run] [--init-project]
#
# Flags:
#   --skip-brv      Skip ByteRover installation (memory layer disabled)
#   --dry-run       Show what would be installed without doing it
#   --init-project  Also initialize .planning/ in the current directory

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(pwd)"
CLAUDE_DIR="$HOME/.claude"
GSD_DIR="$CLAUDE_DIR/get-shit-done"
HOOKS_DIR="$CLAUDE_DIR/hooks"
AGENTS_DIR="$CLAUDE_DIR/agents"
COMMANDS_DIR="$CLAUDE_DIR/commands"
TEMPLATES_DIR="$GSD_DIR/templates/super-gsd"

SKIP_BRV=false
DRY_RUN=false
INIT_PROJECT=false

for arg in "$@"; do
  case $arg in
    --skip-brv) SKIP_BRV=true ;;
    --dry-run) DRY_RUN=true ;;
    --init-project) INIT_PROJECT=true ;;
  esac
done

log() { echo "  [super-gsd] $1"; }
run() {
  if [ "$DRY_RUN" = true ]; then
    log "DRY RUN: $*"
  else
    "$@"
  fi
}
copy_file() {
  if [ "$DRY_RUN" = true ]; then
    log "DRY RUN: $1 -> $2"
  else
    mkdir -p "$(dirname "$2")"
    cp "$1" "$2"
  fi
}

echo ""
echo "========================================"
echo "   Super GSD Orchestrator -- Install    "
echo "========================================"
echo ""
echo "  No API keys required."
echo "  Works entirely on Claude Code Max plan."
echo ""

# ── Check prerequisites ──
log "Checking prerequisites..."

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found. Install Node.js >= 22 first."
  exit 1
fi
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 22 ]; then
  echo "ERROR: Node.js >= 22 required (found v$NODE_VER)"
  exit 1
fi
log "Node.js: v$(node -v | sed 's/v//')"

if [ ! -d "$GSD_DIR" ]; then
  echo ""
  echo "GSD 1.0 not found. Installing..."
  run npx get-shit-done-cc@latest
fi
log "GSD 1.0: $GSD_DIR"

# ── Step 1: Install agents ──
echo ""
log "Step 1/8: Installing 7 agents..."
AGENT_COUNT=0
for agent in "$SCRIPT_DIR/agents/"*.md; do
  name=$(basename "$agent")
  copy_file "$agent" "$AGENTS_DIR/$name"
  AGENT_COUNT=$((AGENT_COUNT + 1))
done
log "  $AGENT_COUNT agents installed"

# ── Step 2: Install skills ──
echo ""
log "Step 2/8: Installing skills..."
SKILL_COUNT=0
for skill_dir in "$SCRIPT_DIR/skills/"*/; do
  [ -f "$skill_dir/SKILL.md" ] || continue
  name=$(basename "$skill_dir")
  copy_file "$skill_dir/SKILL.md" "$COMMANDS_DIR/$name/SKILL.md"
  SKILL_COUNT=$((SKILL_COUNT + 1))
done
log "  $SKILL_COUNT skills installed"

# ── Step 3: Install hooks + local query engine ──
echo ""
log "Step 3/8: Installing hooks + query engine..."
mkdir -p "$HOOKS_DIR"
HOOK_COUNT=0
for hook in "$SCRIPT_DIR/hooks/"*.js; do
  name=$(basename "$hook")
  copy_file "$hook" "$HOOKS_DIR/$name"
  HOOK_COUNT=$((HOOK_COUNT + 1))
done
# Install the local query engine (API-free ByteRover search)
copy_file "$SCRIPT_DIR/overwatcher/brv-query-local.js" "$HOOKS_DIR/brv-query-local.js"
log "  $HOOK_COUNT hooks + 1 query engine installed"

# ── Step 3b: Merge settings-overlay.json into ~/.claude/settings.json ──
# Fix for FINDING-17 (Phase 8 self-audit, CRITICAL): previously the installer
# copied hook .js files but never registered them in settings.json, so every
# hook was installed-but-dormant on a fresh install.
echo ""
log "Step 3b/8: Registering hooks in ~/.claude/settings.json..."
SETTINGS_FILE="$CLAUDE_DIR/settings.json"
OVERLAY_FILE="$SCRIPT_DIR/config/settings-overlay.json"
MERGE_SCRIPT="$SCRIPT_DIR/scripts/merge-settings.js"
if [ ! -f "$OVERLAY_FILE" ]; then
  log "  WARNING: $OVERLAY_FILE missing — skipping merge"
elif [ ! -f "$MERGE_SCRIPT" ]; then
  log "  WARNING: $MERGE_SCRIPT missing — skipping merge"
elif [ "$DRY_RUN" = true ]; then
  log "  DRY RUN: would merge $OVERLAY_FILE into $SETTINGS_FILE"
else
  node "$MERGE_SCRIPT" "$OVERLAY_FILE" "$SETTINGS_FILE" 2>&1 | sed 's/^/  /'
fi

# ── Step 4: Install templates + overwatcher ──
echo ""
log "Step 4/8: Installing templates + overwatcher..."
mkdir -p "$TEMPLATES_DIR/overwatcher"
for template in "$SCRIPT_DIR/templates/"*; do
  name=$(basename "$template")
  copy_file "$template" "$TEMPLATES_DIR/$name"
done
for ow in "$SCRIPT_DIR/overwatcher/"*.js "$SCRIPT_DIR/overwatcher/"*.md; do
  [ -f "$ow" ] || continue
  name=$(basename "$ow")
  copy_file "$ow" "$TEMPLATES_DIR/overwatcher/$name"
done
log "  Templates + overwatcher installed"

# ── Step 5: Install workflows ──
echo ""
log "Step 5/8: Installing workflows..."
mkdir -p "$GSD_DIR/workflows"
for workflow in "$SCRIPT_DIR/workflows/"*; do
  name=$(basename "$workflow")
  copy_file "$workflow" "$GSD_DIR/workflows/$name"
done
log "  Workflows installed"

# ── Step 6: Install config ──
echo ""
log "Step 6/8: Installing config..."
mkdir -p "$GSD_DIR/config"
copy_file "$SCRIPT_DIR/config/model-routing.json" "$GSD_DIR/config/model-routing.json"
log "  Model routing config installed"

# ── Step 6b: Install super-gsd scripts globally ──
# Fix for DLB-04: scripts were previously only accessible via the super-gsd
# source tree path. Other projects couldn't invoke sgsd-curate, sgsd-muda-audit,
# sgsd-sepl-propose, sgsd-distill-milestone etc. without an absolute path
# into wherever super-gsd was cloned.
# Now: copied to $CLAUDE_DIR/super-gsd/scripts/ (global, user-scoped).
# sgsd-boot.ps1 and the sgsd profile shortcut already walk up to find local
# scripts first, then fall back to the install path — the global copy is
# the authoritative fallback.
echo ""
log "Step 6b/8: Installing super-gsd scripts globally..."
GLOBAL_SCRIPTS_DIR="$CLAUDE_DIR/super-gsd/scripts"
mkdir -p "$GLOBAL_SCRIPTS_DIR/lib" "$GLOBAL_SCRIPTS_DIR/watchdogs"
SCRIPT_COUNT=0
for f in "$SCRIPT_DIR/scripts/"*.sh "$SCRIPT_DIR/scripts/"*.ps1; do
  [ -f "$f" ] || continue
  name=$(basename "$f")
  copy_file "$f" "$GLOBAL_SCRIPTS_DIR/$name"
  # Shell scripts need +x after copy
  case "$name" in
    *.sh) [ "$DRY_RUN" = false ] && chmod +x "$GLOBAL_SCRIPTS_DIR/$name" ;;
  esac
  SCRIPT_COUNT=$((SCRIPT_COUNT + 1))
done
# lib/ helpers (e.g. sgsd-substrate-status.ps1, sgsd-render-cache.ps1)
if [ -d "$SCRIPT_DIR/scripts/lib" ]; then
  for f in "$SCRIPT_DIR/scripts/lib/"*; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    copy_file "$f" "$GLOBAL_SCRIPTS_DIR/lib/$name"
  done
fi
# watchdogs (DLB-02)
if [ -d "$SCRIPT_DIR/scripts/watchdogs" ]; then
  for f in "$SCRIPT_DIR/scripts/watchdogs/"*; do
    [ -f "$f" ] || continue
    name=$(basename "$f")
    copy_file "$f" "$GLOBAL_SCRIPTS_DIR/watchdogs/$name"
    case "$name" in
      *.sh) [ "$DRY_RUN" = false ] && chmod +x "$GLOBAL_SCRIPTS_DIR/watchdogs/$name" ;;
    esac
  done
fi
log "  $SCRIPT_COUNT scripts + lib + watchdogs installed to $GLOBAL_SCRIPTS_DIR"

# ── Step 7: ByteRover memory layer (API-free) ──
if [ "$SKIP_BRV" = false ]; then
  echo ""
  log "Step 7/8: Setting up ByteRover memory layer (API-free)..."

  # Install ByteRover CLI
  if command -v brv &>/dev/null; then
    log "  ByteRover CLI: already installed ($(brv --version 2>/dev/null | head -1))"
  else
    log "  Installing ByteRover CLI..."
    run npm install -g byterover-cli
  fi

  # Initialize version control (creates .brv/ directory)
  if [ ! -d "$PROJECT_DIR/.brv" ]; then
    log "  Initializing ByteRover in project..."
    run brv vc init 2>/dev/null || true
    # Remove nested git repo (we track context tree in project git)
    rm -rf "$PROJECT_DIR/.brv/context-tree/.git" "$PROJECT_DIR/.brv/context-tree/.gitignore" 2>/dev/null
  else
    log "  ByteRover: already initialized"
  fi

  # Install Claude Code MCP connector
  if [ ! -f "$PROJECT_DIR/.mcp.json" ]; then
    log "  Installing Claude Code MCP connector..."
    run brv connectors install "Claude Code" --type mcp 2>/dev/null || true
  else
    log "  MCP connector: already configured"
  fi

  # Seed context tree with domain knowledge (direct file copy, no API)
  log "  Seeding context tree (9 domain files, no API key needed)..."
  mkdir -p "$PROJECT_DIR/.brv/context-tree/patterns" \
           "$PROJECT_DIR/.brv/context-tree/anti-patterns" \
           "$PROJECT_DIR/.brv/context-tree/expertise" \
           "$PROJECT_DIR/.brv/context-tree/decisions" \
           "$PROJECT_DIR/.brv/context-tree/error-rules" \
           "$PROJECT_DIR/.brv/context-tree/scripts" \
           "$PROJECT_DIR/.brv/context-tree/domain"

  SEED_COUNT=0
  for f in "$SCRIPT_DIR/brv-seed/domains/"*.md; do
    name=$(basename "$f" .md)
    if echo "$name" | grep -q "anti-pattern"; then
      copy_file "$f" "$PROJECT_DIR/.brv/context-tree/anti-patterns/$name.md"
    elif echo "$name" | grep -q "expertise\|deliberation"; then
      copy_file "$f" "$PROJECT_DIR/.brv/context-tree/expertise/$name.md"
    else
      copy_file "$f" "$PROJECT_DIR/.brv/context-tree/patterns/$name.md"
    fi
    SEED_COUNT=$((SEED_COUNT + 1))
  done
  log "  $SEED_COUNT knowledge files seeded"

  # Verify query engine works
  echo ""
  log "  Testing local query engine..."
  QUERY_RESULT=$(node "$HOOKS_DIR/brv-query-local.js" "orchestrator dispatch loop" --max 1 2>/dev/null || echo "FAILED")
  if echo "$QUERY_RESULT" | grep -q "Orchestrator"; then
    log "  Query test: PASSED"
  else
    log "  Query test: FAILED (check .brv/context-tree/ has .md files)"
  fi

  # ── DLB-04 Day 0 gate: curate-pipe smoke-test ──
  # Pragmatist R2 verified in deliberation: installing curate scripts without
  # an end-to-end verification was how FINDING-18 shipped in the first place.
  # Any distillation or SEPL loop downstream silently no-ops if curate is
  # broken. Fail the install loudly rather than discover it in v1.2.
  #
  # Mode-aware as of 2026-04-20: detects v1.2 (.planning/memory) vs legacy
  # (.brv/context-tree) and verifies the correct store. Skips cleanly if
  # neither scaffold exists yet (install may precede sgsd-memory-migrate).
  log "  Testing curate write-pipe (DLB-04 smoke-test)..."
  CURATE_SCRIPT="$SCRIPT_DIR/scripts/sgsd-curate.sh"
  if [ ! -x "$CURATE_SCRIPT" ]; then
    chmod +x "$CURATE_SCRIPT" 2>/dev/null || true
  fi
  SMOKE_SLUG="installer-smoke-test"

  if [ -f "$PROJECT_DIR/.planning/memory/MEMORY.md" ]; then
    SMOKE_MODE="v1.2"
    SMOKE_INDEX="$PROJECT_DIR/.planning/memory/MEMORY.md"
    SMOKE_FILE="$PROJECT_DIR/.planning/memory/architecture/patterns/$SMOKE_SLUG.md"
  elif [ -f "$PROJECT_DIR/.brv/context-tree/INDEX.md" ]; then
    SMOKE_MODE="legacy"
    SMOKE_INDEX="$PROJECT_DIR/.brv/context-tree/INDEX.md"
    SMOKE_FILE="$PROJECT_DIR/.brv/context-tree/patterns/$SMOKE_SLUG.md"
  else
    SMOKE_MODE="skip"
  fi

  if [ "$SMOKE_MODE" = "skip" ]; then
    log "  Skipping smoke-test: no memory store in $PROJECT_DIR"
    log "  (Run 'sgsd-memory-migrate' or 'sgsd -Backfill' to scaffold, then re-run installer.)"
  else
    # Pre-clean in case of a prior failed install (both row in INDEX and body file)
    rm -f "$SMOKE_FILE"
    sed -i.bak "/$SMOKE_SLUG/d" "$SMOKE_INDEX" 2>/dev/null && rm -f "$SMOKE_INDEX.bak"

    if [ "$DRY_RUN" = true ]; then
      log "  DRY RUN: would curate a smoke record and check $SMOKE_INDEX (mode=$SMOKE_MODE)"
    elif echo "installer smoke body" | bash "$CURATE_SCRIPT" \
         --type pattern --slug "$SMOKE_SLUG" \
         --summary "installer smoke - delete after verification" \
         --root "$PROJECT_DIR" >/dev/null 2>&1 \
         && grep -qF "$SMOKE_SLUG" "$SMOKE_INDEX" 2>/dev/null \
         && [ -f "$SMOKE_FILE" ]; then
      log "  Curate smoke: PASSED (mode=$SMOKE_MODE)"
      # Clean up the smoke record so we don't litter the corpus
      rm -f "$SMOKE_FILE"
      sed -i.bak "/$SMOKE_SLUG/d" "$SMOKE_INDEX" && rm -f "$SMOKE_INDEX.bak"
    else
      echo ""
      echo "ERROR: Curate write-pipe smoke-test FAILED (mode=$SMOKE_MODE)."
      echo "       sgsd-curate is the substrate for MUDA, SEPL, and distillation."
      echo "       Fix this before proceeding (DLB-04 Day 0 blocker)."
      echo "       Repro: echo body | bash $CURATE_SCRIPT --type pattern --slug smoke-dbg --summary test --root $PROJECT_DIR"
      exit 1
    fi
  fi
else
  echo ""
  log "Step 7/8: ByteRover SKIPPED (--skip-brv flag)"
fi

# ── Step 8: Initialize project (optional) ──
if [ "$INIT_PROJECT" = true ]; then
  echo ""
  log "Step 8/8: Initializing project..."
  mkdir -p "$PROJECT_DIR/.planning/phases" \
           "$PROJECT_DIR/.planning/metrics" \
           "$PROJECT_DIR/.planning/briefs" \
           "$PROJECT_DIR/.planning/decisions" \
           "$PROJECT_DIR/.planning/deliberations" \
           "$PROJECT_DIR/.planning/overwatcher"

  if [ ! -f "$PROJECT_DIR/.planning/config.json" ]; then
    copy_file "$SCRIPT_DIR/config/planning-config-overlay.json" "$PROJECT_DIR/.planning/config.json"
  fi
  touch "$PROJECT_DIR/.planning/metrics/token-log.jsonl"

  if [ ! -f "$PROJECT_DIR/CLAUDE.md" ]; then
    copy_file "$SCRIPT_DIR/CLAUDE-OVERLAY.md" "$PROJECT_DIR/CLAUDE.md"
    log "  Created CLAUDE.md (from overlay)"
  else
    log "  CLAUDE.md already exists — append super-gsd/CLAUDE-OVERLAY.md manually"
  fi

  # DLB-04 Q1: materialise the Agents resource registry for this project.
  # The sync script walks super-gsd/agents/ and writes agents.jsonl — one
  # record per agent with {id, path, sha, mtime, model, tools, description}.
  # Consumer: MUDA classifier pre-dispatch query (when that read-path lands).
  if [ -x "$SCRIPT_DIR/scripts/sgsd-registry-sync.sh" ] && [ "$DRY_RUN" = false ]; then
    bash "$SCRIPT_DIR/scripts/sgsd-registry-sync.sh" --root "$PROJECT_DIR" 2>/dev/null \
      | sed 's/^/  /' \
      || log "  WARNING: registry sync failed (non-blocking)"
  fi
  log "  Project initialized"
else
  echo ""
  log "Step 8/8: Project init SKIPPED (use --init-project to create .planning/)"
fi

# ── Step 9: Set up permissions for autonomous mode ──
echo ""
log "Step 9: Setting up autonomous permissions..."

# Auto-approve all tools so the loop never stops to ask
if [ "$DRY_RUN" = false ]; then
  # Check if claude CLI is available
  if command -v claude &>/dev/null; then
    claude config set --global autoApprove "Bash,Read,Write,Edit,Glob,Grep,Agent,WebFetch,WebSearch" 2>/dev/null && \
      log "  Auto-approve: ALL tools enabled (fully autonomous)" || \
      log "  WARNING: Could not set auto-approve. Run manually:"
      log "    claude config set --global autoApprove \"Bash,Read,Write,Edit,Glob,Grep,Agent\""
  else
    log "  claude CLI not found — set permissions manually after install:"
    log "    claude config set --global autoApprove \"Bash,Read,Write,Edit,Glob,Grep,Agent\""
  fi
else
  log "  DRY RUN: would set autoApprove for all tools"
fi

# ── Summary ──
echo ""
echo "========================================"
echo "       Installation Complete            "
echo "========================================"
echo ""
echo "Installed:"
echo "  $AGENT_COUNT agents (Opus/Sonnet/Haiku)"
echo "  $SKILL_COUNT skills (/sgsd-orchestrate, /sgsd-deliberate, etc.)"
echo "  $HOOK_COUNT hooks + local query engine"
echo "  Templates, workflows, overwatcher, config"
if [ "$SKIP_BRV" = false ]; then
echo "  ByteRover context tree (9 knowledge files, API-free)"
fi
echo "  Permissions: auto-approve enabled (fully autonomous)"
echo ""
echo "No API keys required. Everything runs on Claude Code Max plan."
echo ""
echo "Next steps:"
if [ "$INIT_PROJECT" = false ]; then
echo "  1. cd your-project"
echo "  2. bash super-gsd/install.sh --init-project"
echo "     (or manually: mkdir -p .planning/ && cp CLAUDE-OVERLAY.md CLAUDE.md)"
fi
echo "  3. Restart Claude Code (picks up new skills + hooks + permissions)"
echo "  4. Say 'go' to start the autonomous loop"
echo ""
echo "Permissions:"
echo "  Auto mode is ON — Claude will not ask for confirmation."
echo "  To disable: claude config set --global autoApprove \"\""
echo "  To re-enable: claude config set --global autoApprove \"Bash,Read,Write,Edit,Glob,Grep,Agent\""
echo ""
echo "Commands:"
echo "  /sgsd-orchestrate go     — autonomous loop"
echo "  /sgsd-orchestrate next   — one unit"
echo "  /sgsd-orchestrate status — check position"
echo "  /sgsd-deliberate new     — strategic decision"
echo "  /sgsd-token-audit        — usage analysis"
echo "  /sgsd-overwatcher scan   — signal map"
echo ""

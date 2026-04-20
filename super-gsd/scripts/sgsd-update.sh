#!/usr/bin/env bash
# ============================================================================
# sgsd-update — DLB-06 Wave A
# ============================================================================
# Thin wrapper over `git pull + install.sh` against a canonical super-gsd
# source clone at ~/.claude/super-gsd/source/.
#
# Board vote (DLB-06): 4/4 unanimous on this mechanism. The deliberation
# itself retroactively flagged that the board shouldn't have been fired for
# a 1-hour shell script — which is what this is. See DELIBERATION-FLOOR.md.
#
# First run clones the source repo if missing. Subsequent runs fetch +
# pull + install.
#
# Usage:
#   sgsd-update.sh                  (update + re-install in current project)
#   sgsd-update.sh --check          (check for upstream drift, no changes)
#   sgsd-update.sh --no-install     (pull only, skip install.sh)
#   sgsd-update.sh --source PATH    (override canonical source location)
# ============================================================================

set -u

ACTION="update"
SOURCE_DIR="$HOME/.claude/super-gsd/source"
NO_INSTALL=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --check)      ACTION="check"; shift ;;
        --no-install) NO_INSTALL=true; shift ;;
        --source)     SOURCE_DIR="$2"; shift 2 ;;
        --help|-h)    head -25 "$0" | tail -20; exit 0 ;;
        *) echo "sgsd-update: unknown argument: $1" >&2; exit 2 ;;
    esac
done

REPO_URL="git@github.com:Berrowj/super-gsd.git"
REPO_URL_HTTPS="https://github.com/Berrowj/super-gsd.git"

log() { printf '  [sgsd-update] %s\n' "$1"; }

# Clone source if missing
if [[ ! -d "$SOURCE_DIR/.git" ]]; then
    if [[ "$ACTION" == "check" ]]; then
        log "Source not present at $SOURCE_DIR. Run without --check to clone."
        exit 1
    fi
    log "Source clone not present. Cloning to $SOURCE_DIR..."
    mkdir -p "$(dirname "$SOURCE_DIR")"
    if ! git clone "$REPO_URL" "$SOURCE_DIR" 2>&1; then
        log "SSH clone failed, trying HTTPS..."
        git clone "$REPO_URL_HTTPS" "$SOURCE_DIR" || {
            log "Clone failed. Check network + credentials."
            exit 3
        }
    fi
fi

# --check mode: compare local to remote without fetching objects
if [[ "$ACTION" == "check" ]]; then
    # Use ls-remote to avoid fetching; short timeout for offline-safety
    local_sha=$(git -C "$SOURCE_DIR" rev-parse HEAD 2>/dev/null)
    remote_sha=$(timeout 3 git -C "$SOURCE_DIR" ls-remote origin HEAD 2>/dev/null | cut -f1)

    if [[ -z "$remote_sha" ]]; then
        log "Could not reach upstream (network/VPN/offline). Last known: $local_sha"
        exit 0
    fi

    if [[ "$local_sha" == "$remote_sha" ]]; then
        log "Up to date with origin/master ($local_sha)"
        exit 0
    fi

    commits_ahead=$(git -C "$SOURCE_DIR" rev-list --count HEAD..origin/master 2>/dev/null || echo "?")
    log "Drift detected: local=$local_sha upstream=$remote_sha ($commits_ahead commits behind)"
    exit 10  # non-zero to signal drift to callers
fi

# Update path
log "Pulling latest from origin/master..."
git -C "$SOURCE_DIR" pull origin master || {
    log "Pull failed. Check network + conflicts."
    exit 4
}

if [[ "$NO_INSTALL" == true ]]; then
    log "Pull complete (install skipped per --no-install)"
    exit 0
fi

# Re-run installer. --init-project only if .planning/ present in cwd.
INSTALL_ARGS=()
if [[ -d "./.planning" ]]; then
    INSTALL_ARGS+=(--init-project)
fi

log "Running installer..."
bash "$SOURCE_DIR/super-gsd/install.sh" "${INSTALL_ARGS[@]}" 2>&1 || {
    log "Installer exited non-zero (see above)"
    exit 5
}

# Write .super-gsd-version for current project if .planning/ exists
if [[ -d "./.planning" ]]; then
    current_sha=$(git -C "$SOURCE_DIR" rev-parse HEAD)
    echo "$current_sha" > ./.super-gsd-version
    log "Wrote .super-gsd-version = $current_sha"
fi

log "sgsd-update complete."

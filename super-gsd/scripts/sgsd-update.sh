#!/usr/bin/env bash
# ============================================================================
# sgsd-update — DLB-06 Wave A
# ============================================================================
# Guarded fast-forward + install.sh wrapper for the canonical super-gsd source
# clone at ~/.claude/super-gsd/source/.
#
# Board vote (DLB-06): 4/4 unanimous on this mechanism. The deliberation
# itself retroactively flagged that the board shouldn't have been fired for
# a 1-hour shell script — which is what this is. See DELIBERATION-FLOOR.md.
#
# First run clones the source repo if missing. Subsequent runs fetch the
# origin/master target, fast-forward exactly to it, and install.
#
# Usage:
#   sgsd-update.sh                  (update + re-install in current project)
#   sgsd-update.sh --check          (check for upstream drift, no changes)
#   sgsd-update.sh --no-install     (fast-forward only, skip install.sh)
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

read_source_head() {
    git -C "$SOURCE_DIR" rev-parse --verify 'HEAD^{commit}' 2>/dev/null
}

require_clean_source() {
    local stage="$1"
    local status_output
    if ! status_output=$(git -C "$SOURCE_DIR" status --porcelain=v1 --untracked-files=normal 2>&1); then
        log "Could not inspect canonical source state before $stage."
        exit 6
    fi
    if [[ -n "$status_output" ]]; then
        log "Canonical source is dirty before $stage; no update was attempted."
        printf '%s\n' "$status_output" >&2
        exit 6
    fi
}

assert_captured_head() {
    local stage="$1"
    local actual_sha
    if ! actual_sha=$(read_source_head); then
        log "Could not resolve canonical source HEAD $stage."
        exit 6
    fi
    if [[ "$actual_sha" != "$fetched_sha" ]]; then
        log "Canonical source SHA mismatch $stage: expected=$fetched_sha actual=$actual_sha"
        exit 6
    fi
}

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

# --check mode: compare local master to remote master without fetching objects
if [[ "$ACTION" == "check" ]]; then
    local_sha=$(git -C "$SOURCE_DIR" rev-parse --verify 'refs/heads/master^{commit}' 2>/dev/null) || {
        log "Could not resolve local refs/heads/master."
        exit 6
    }
    if command -v timeout >/dev/null 2>&1; then
        remote_row=$(timeout 3 git -C "$SOURCE_DIR" ls-remote origin refs/heads/master 2>/dev/null)
    else
        remote_row=$(git -C "$SOURCE_DIR" ls-remote origin refs/heads/master 2>/dev/null)
    fi
    remote_sha=$(printf '%s\n' "$remote_row" | awk '$2 == "refs/heads/master" { print $1; exit }')

    if [[ -z "$remote_sha" ]]; then
        log "Could not reach upstream (network/VPN/offline). Last known: $local_sha"
        exit 0
    fi

    if [[ "$local_sha" == "$remote_sha" ]]; then
        log "Up to date with origin/master ($local_sha)"
        exit 0
    fi

    commits_behind=$(git -C "$SOURCE_DIR" rev-list --count "$local_sha..$remote_sha" 2>/dev/null || echo "?")
    log "Drift detected: local=$local_sha upstream=$remote_sha ($commits_behind commits behind)"
    exit 10  # non-zero to signal drift to callers
fi

# Update path
require_clean_source "fetch"
local_sha=$(read_source_head) || {
    log "Could not resolve canonical source HEAD before fetch."
    exit 6
}

log "Fetching origin/master..."
git -C "$SOURCE_DIR" fetch origin 'refs/heads/master:refs/remotes/origin/master' || {
    log "Fetch failed. Check network + credentials."
    exit 4
}

fetched_sha=$(git -C "$SOURCE_DIR" rev-parse --verify 'FETCH_HEAD^{commit}' 2>/dev/null) || {
    log "Fetch completed but FETCH_HEAD could not be resolved to one commit."
    exit 4
}
tracking_sha=$(git -C "$SOURCE_DIR" rev-parse --verify 'refs/remotes/origin/master^{commit}' 2>/dev/null) || {
    log "Fetch completed but refs/remotes/origin/master could not be resolved."
    exit 4
}
if [[ "$tracking_sha" != "$fetched_sha" ]]; then
    log "Fetched SHA mismatch: FETCH_HEAD=$fetched_sha origin/master=$tracking_sha"
    exit 6
fi

if ! git -C "$SOURCE_DIR" merge-base --is-ancestor "$local_sha" "$fetched_sha"; then
    if git -C "$SOURCE_DIR" merge-base --is-ancestor "$fetched_sha" "$local_sha"; then
        log "Canonical source is locally ahead of origin/master; refusing local-only commits."
    else
        log "Canonical source has diverged from origin/master; refusing non-fast-forward history."
    fi
    exit 6
fi

require_clean_source "merge"
log "Fast-forwarding to captured origin/master SHA $fetched_sha..."
git -C "$SOURCE_DIR" merge --ff-only "$fetched_sha" || {
    log "Fast-forward to captured origin/master SHA failed."
    exit 4
}
assert_captured_head "after fast-forward"
require_clean_source "install"
printf 'source_sha=%s\n' "$fetched_sha"

if [[ "$NO_INSTALL" == true ]]; then
    printf 'project_pin=unchanged\n'
    log "Fast-forward complete (install skipped per --no-install)"
    exit 0
fi

log "Running installer..."
bash "$SOURCE_DIR/super-gsd/install.sh" --update --install-global 2>&1 || {
    log "Installer exited non-zero (see above)"
    exit 5
}
assert_captured_head "after install"

# Write .super-gsd-version atomically only after install success.
if [[ -d "./.planning" ]]; then
    pin_path="./.super-gsd-version"
    pin_tmp=$(mktemp "${pin_path}.tmp.XXXXXX") || {
        log "Could not create temporary project pin."
        exit 6
    }
    if ! printf '%s\n' "$fetched_sha" > "$pin_tmp" || ! mv -f -- "$pin_tmp" "$pin_path"; then
        rm -f -- "$pin_tmp"
        log "Could not atomically write $pin_path."
        exit 6
    fi
    printf 'project_pin=%s\n' "$fetched_sha"
else
    printf 'project_pin=not-written\n'
fi

log "sgsd-update complete."

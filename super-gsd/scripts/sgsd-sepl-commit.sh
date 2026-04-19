#!/usr/bin/env bash
# ============================================================================
# sgsd-sepl-commit — apply (or reject) a resource-grain proposal
# ============================================================================
# Per DLB-04 Q2 (2a · operator-gated). Reads a pending proposal written by
# sgsd-sepl-propose, applies the change (or rejects it), commits atomically,
# and logs the outcome.
#
# Application logic by resource_type:
#   rule       → append body to target file (verbatim)
#   script     → print diff, require --apply to overwrite target
#   agent      → print diff, require --apply
#   skill      → print diff, require --apply
#   config     → print diff, require --apply
#   doc        → print diff, require --apply
#
# The operator is the exogenous gate. No auto-commit on the mere existence
# of a proposal — you call this script explicitly with --apply or --reject.
#
# Usage:
#   sgsd-sepl-commit.sh <proposal-path> [--apply | --reject] [--root PATH]
#
# Options:
#   --apply     Apply the change and create a git commit
#   --reject    Mark the proposal rejected; no change applied
#   --root PATH Override auto-detected project root
# ============================================================================

set -u

PROPOSAL=""
ACTION=""
ROOT=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --apply)    ACTION="apply"; shift ;;
        --reject)   ACTION="reject"; shift ;;
        --root)     ROOT="$2"; shift 2 ;;
        --help|-h)  head -25 "$0" | tail -20; exit 0 ;;
        -*)         echo "sgsd-sepl-commit: unknown flag: $1" >&2; exit 2 ;;
        *)
            if [[ -z "$PROPOSAL" ]]; then
                PROPOSAL="$1"
                shift
            else
                echo "sgsd-sepl-commit: extra positional arg: $1" >&2; exit 2
            fi
            ;;
    esac
done

if [[ -z "$PROPOSAL" ]]; then
    echo "sgsd-sepl-commit: proposal path required" >&2
    echo "  Usage: $0 <proposal-path> [--apply | --reject]" >&2
    exit 2
fi
if [[ -z "$ACTION" ]]; then
    echo "sgsd-sepl-commit: must specify --apply or --reject" >&2
    exit 2
fi
if [[ ! -f "$PROPOSAL" ]]; then
    echo "sgsd-sepl-commit: proposal file not found: $PROPOSAL" >&2
    exit 3
fi

# Resolve root
if [[ -z "$ROOT" ]]; then
    d="$(pwd -P)"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -d "$d/.planning" ]]; then
            ROOT="$d"
            break
        fi
        d="$(dirname "$d")"
    done
fi
if [[ -z "$ROOT" || ! -d "$ROOT/.planning" ]]; then
    echo "sgsd-sepl-commit: no .planning/ found above $(pwd). Pass --root." >&2
    exit 3
fi

LOG="$ROOT/.planning/metrics/sepl-log.jsonl"

# Extract YAML field from proposal frontmatter
extract_field() {
    awk -v f="$1" '
        /^---[[:space:]]*$/ { if (in_fm) exit; in_fm = 1; next }
        in_fm && $0 ~ "^"f":" {
            sub("^"f":[[:space:]]*", "")
            print
            exit
        }
    ' "$PROPOSAL"
}

RTYPE="$(extract_field resource_type)"
TARGET="$(extract_field target_path)"
SLUG="$(extract_field slug)"
STATUS="$(extract_field status)"
DESCRIPTION="$(extract_field description)"

if [[ "$STATUS" != "pending" ]]; then
    echo "sgsd-sepl-commit: proposal status is '$STATUS' (expected 'pending'). Already processed." >&2
    exit 4
fi

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Extract body (everything inside the ```...``` fence under "## Body")
extract_body() {
    awk '
        /^## Body$/ { in_body = 1; next }
        in_body && /^```/ {
            if (fence_seen) { exit }
            fence_seen = 1
            next
        }
        in_body && fence_seen { print }
    ' "$PROPOSAL"
}

update_status() {
    local new_status="$1"
    local tmp="$PROPOSAL.tmp"
    sed "s/^status: pending$/status: $new_status/" "$PROPOSAL" > "$tmp" && mv "$tmp" "$PROPOSAL"
}

jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

log_event() {
    local outcome="$1"
    mkdir -p "$(dirname "$LOG")"
    printf '{"ts":"%s","event":"commit","slug":"%s","resource_type":"%s","target":"%s","outcome":"%s"}\n' \
        "$TS" "$(jesc "$SLUG")" "$RTYPE" "$(jesc "$TARGET")" "$outcome" >> "$LOG"
}

# ── REJECT path ──
if [[ "$ACTION" == "reject" ]]; then
    update_status rejected
    log_event rejected
    git -C "$ROOT" add "$PROPOSAL" "$LOG" 2>/dev/null || true
    git -C "$ROOT" commit -m "chore(sepl): reject proposal $SLUG" 2>&1 | sed 's/^/  /'
    echo "sgsd-sepl-commit: rejected $SLUG (no change applied)"
    exit 0
fi

# ── APPLY path ──
TARGET_ABS="$ROOT/$TARGET"
[[ ! -e "$TARGET_ABS" ]] && { echo "sgsd-sepl-commit: target path does not exist: $TARGET_ABS" >&2; exit 5; }

BODY="$(extract_body)"

case "$RTYPE" in
    rule)
        # Append the body verbatim to the target file
        printf '\n%s\n' "$BODY" >> "$TARGET_ABS"
        ;;
    script|agent|skill|config|doc)
        # Overwrite the target file with the body content
        printf '%s\n' "$BODY" > "$TARGET_ABS.tmp"
        mv "$TARGET_ABS.tmp" "$TARGET_ABS"
        ;;
    *)
        echo "sgsd-sepl-commit: unknown resource_type '$RTYPE' in proposal" >&2
        exit 6
        ;;
esac

update_status committed
log_event committed

git -C "$ROOT" add "$TARGET" "$PROPOSAL" "$LOG" 2>/dev/null
if ! git -C "$ROOT" commit -m "feat(sepl): $SLUG — $DESCRIPTION" 2>&1 | sed 's/^/  /'; then
    echo "sgsd-sepl-commit: git commit failed (change applied but not committed)" >&2
    exit 7
fi

echo "sgsd-sepl-commit: applied + committed $SLUG → $TARGET"

#!/usr/bin/env bash
# ============================================================================
# sgsd-sepl-propose — draft a resource-grain improvement proposal
# ============================================================================
# Per DLB-04 Q2 (2a · operator-gated). Sub-agents emit proposals instead of
# auto-committing single-resource improvements. The proposal sits in
# .planning/proposals/ until the operator runs sgsd-sepl-commit.
#
# Why operator-gated (not auto-commit):
#   Auto-commit on PASS would retire the prior rule state — that violates
#   the "operator decides kill conditions / retirements" invariant.
#   /sgsd-deliberate + git already serves the architecture-grain loop;
#   this serves the resource-grain (single-file rule additions, small
#   script tweaks) where the deliberation overhead is too heavy.
#
# Usage:
#   sgsd-sepl-propose.sh --type TYPE --target PATH \
#       --description "one-line what" --rationale "one-line why" \
#       [--slug SLUG] [--root PATH] [--dry-run] < body.diff
#
# Options:
#   --type TYPE         one of: rule | script | agent | skill | config | doc
#   --target PATH       repo-relative path the change will land in
#   --description TEXT  what the change does (≤120 chars)
#   --rationale TEXT    why (the justification sub-agent reports support)
#   --slug SLUG         kebab-case; default auto-generated from description
#   --body PATH         read body from file instead of stdin
#   --root PATH         override auto-detected project root
#   --dry-run           show what would be written without writing
#
# Output:
#   .planning/proposals/{YYYY-MM-DD}-{slug}.md  (the proposal, status=pending)
#   .planning/metrics/sepl-log.jsonl            (append "proposal" event)
# ============================================================================

set -u

TYPE=""
TARGET=""
DESCRIPTION=""
RATIONALE=""
SLUG=""
BODY_FILE=""
ROOT=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --type)         TYPE="$2"; shift 2 ;;
        --target)       TARGET="$2"; shift 2 ;;
        --description)  DESCRIPTION="$2"; shift 2 ;;
        --rationale)    RATIONALE="$2"; shift 2 ;;
        --slug)         SLUG="$2"; shift 2 ;;
        --body)         BODY_FILE="$2"; shift 2 ;;
        --root)         ROOT="$2"; shift 2 ;;
        --dry-run)      DRY_RUN=true; shift ;;
        --help|-h)      head -35 "$0" | tail -30; exit 0 ;;
        *) echo "sgsd-sepl-propose: unknown argument: $1" >&2; exit 2 ;;
    esac
done

# Validate
if [[ -z "$TYPE" || -z "$TARGET" || -z "$DESCRIPTION" || -z "$RATIONALE" ]]; then
    echo "sgsd-sepl-propose: --type, --target, --description, --rationale are required" >&2
    exit 2
fi
case "$TYPE" in
    rule|script|agent|skill|config|doc) ;;
    *) echo "sgsd-sepl-propose: --type must be one of: rule, script, agent, skill, config, doc" >&2; exit 2 ;;
esac
if [[ ${#DESCRIPTION} -gt 120 ]]; then
    echo "sgsd-sepl-propose: --description is ${#DESCRIPTION} chars (limit 120). Tighten it." >&2
    exit 2
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
    echo "sgsd-sepl-propose: no .planning/ found above $(pwd). Pass --root or run from a project root." >&2
    exit 3
fi

# Auto-generate slug from description if not provided
if [[ -z "$SLUG" ]]; then
    SLUG=$(printf '%s' "$DESCRIPTION" \
        | tr 'A-Z' 'a-z' \
        | sed 's/[^a-z0-9]/-/g; s/-\+/-/g; s/^-//; s/-$//' \
        | cut -c1-40 | sed 's/-$//')
fi

# Apply sgsd-curate-style slug discipline (DLB-04 Day 0 precedent)
if [[ ${#SLUG} -gt 60 ]] || [[ ! "$SLUG" =~ ^[a-z0-9-]+$ ]] \
   || [[ "$SLUG" =~ [0-9]{4}-[0-9]{2}-[0-9]{2} ]] \
   || [[ "$SLUG" =~ [0-9]z$ ]] \
   || [[ "$SLUG" =~ ^- || "$SLUG" =~ -$ || "$SLUG" =~ -- ]]; then
    echo "sgsd-sepl-propose: slug '$SLUG' fails discipline guard (kebab-case, no timestamps, ≤60 chars)" >&2
    exit 2
fi

DATE="$(date -u +%Y-%m-%d)"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
PROPOSALS_DIR="$ROOT/.planning/proposals"
PROPOSAL="$PROPOSALS_DIR/$DATE-$SLUG.md"
LOG="$ROOT/.planning/metrics/sepl-log.jsonl"

if [[ -e "$PROPOSAL" ]]; then
    echo "sgsd-sepl-propose: $PROPOSAL already exists. Pick a different --slug." >&2
    exit 4
fi

# Read body (the actual change — diff, appended text, new script body, etc.)
if [[ -n "$BODY_FILE" ]]; then
    [[ ! -f "$BODY_FILE" ]] && { echo "sgsd-sepl-propose: --body $BODY_FILE not found" >&2; exit 5; }
    BODY="$(cat "$BODY_FILE")"
elif [[ ! -t 0 ]]; then
    BODY="$(cat)"
else
    BODY="(no body supplied — describe the change in the rationale only)"
fi

# Assemble proposal file
read -r -d '' CONTENT <<EOF || true
---
type: sepl-proposal
resource_type: $TYPE
target_path: $TARGET
slug: $SLUG
proposed_at: $TS
status: pending
description: $DESCRIPTION
rationale: $RATIONALE
---

# Proposal: $DESCRIPTION

## What

Change \`$TARGET\` — $DESCRIPTION.

## Why

$RATIONALE

## Body

\`\`\`
$BODY
\`\`\`

## Operator Action

Review, then run:

    sgsd-sepl-commit.sh $PROPOSAL --apply

To reject (no change + log event):

    sgsd-sepl-commit.sh $PROPOSAL --reject
EOF

if [[ "$DRY_RUN" == true ]]; then
    echo "DRY RUN — would write:"
    echo "  $PROPOSAL"
    echo "--- content ---"
    echo "$CONTENT"
    echo "--- /content ---"
    echo "  Append sepl-log.jsonl event (proposal/$SLUG)"
    exit 0
fi

# Write proposal atomically
mkdir -p "$PROPOSALS_DIR"
printf '%s\n' "$CONTENT" > "$PROPOSAL.tmp"
mv "$PROPOSAL.tmp" "$PROPOSAL"

# Log event
mkdir -p "$(dirname "$LOG")"
# JSON escape helper (minimal: quotes + backslashes)
jesc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
printf '{"ts":"%s","event":"proposal","slug":"%s","resource_type":"%s","target":"%s","description":"%s"}\n' \
    "$TS" "$(jesc "$SLUG")" "$TYPE" "$(jesc "$TARGET")" "$(jesc "$DESCRIPTION")" >> "$LOG"

echo "sgsd-sepl-propose: wrote $PROPOSAL"
echo "  Review + apply via: bash super-gsd/scripts/sgsd-sepl-commit.sh $PROPOSAL --apply"

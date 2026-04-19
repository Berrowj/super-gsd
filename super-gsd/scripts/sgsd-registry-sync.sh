#!/usr/bin/env bash
# ============================================================================
# sgsd-registry-sync — materialise the Agents resource-registry manifest
# ============================================================================
# Per DLB-04 Q1 (1c, scoped) — walk super-gsd/agents/*.md, extract the
# minimal resource record, atomically write .planning/resource-registry/agents.jsonl.
#
# Schema (one JSON object per line):
#   {"id","path","sha","mtime","model","tools","description","status"}
#
# Scoped to Agents ONLY (not Prompts, not Environments, not Tools/Memory which
# already have their own inventories via git + INDEX.md). Manifest is read-only
# from the orchestrator's perspective — the classifier consults it pre-dispatch
# for agent-selection queries. This script is the sole writer.
#
# Coupling rule (from Architect R2 blind-spot concession):
#   The manifest has no justification without a named v1.2 consumer. That
#   consumer is the MUDA classifier's pre-dispatch query. If the read-path
#   wire-up slips, the manifest is still cheap to keep (no op overhead),
#   but the kill check runs at v1.2 close via metrics/sepl-log.jsonl absence.
#
# Atomic: .tmp + rename. No partial writes.
#
# Usage:
#   sgsd-registry-sync.sh [--root PATH] [--dry-run]
# ============================================================================

set -u

ROOT=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --root)     ROOT="$2"; shift 2 ;;
        --dry-run)  DRY_RUN=true; shift ;;
        --help|-h)  head -30 "$0" | tail -25; exit 0 ;;
        *) echo "sgsd-registry-sync: unknown argument: $1" >&2; exit 2 ;;
    esac
done

# Resolve root (walk up until super-gsd/agents/ found)
if [[ -z "$ROOT" ]]; then
    d="$(pwd -P)"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -d "$d/super-gsd/agents" ]]; then
            ROOT="$d"
            break
        fi
        d="$(dirname "$d")"
    done
fi
if [[ -z "$ROOT" || ! -d "$ROOT/super-gsd/agents" ]]; then
    echo "sgsd-registry-sync: no super-gsd/agents/ found above $(pwd). Pass --root or run from a project root." >&2
    exit 3
fi

AGENTS_DIR="$ROOT/super-gsd/agents"
REGISTRY_DIR="$ROOT/.planning/resource-registry"
MANIFEST="$REGISTRY_DIR/agents.jsonl"
TMP="$MANIFEST.tmp"

mkdir -p "$REGISTRY_DIR"

# Extract a single YAML frontmatter field from an agent file.
# Matches lines like "name: value" or "model: haiku" within the first ---...--- block.
# Strips surrounding quotes. Returns empty string if missing.
extract_field() {
    local file="$1" field="$2"
    awk -v f="$field" '
        /^---[[:space:]]*$/ { if (in_fm) exit; in_fm = 1; next }
        in_fm && $0 ~ "^"f":" {
            sub("^"f":[[:space:]]*", "")
            gsub(/^"|"$|^'\''|'\''$/, "")
            print
            exit
        }
    ' "$file"
}

# JSON-escape a string (quotes, backslashes, control chars).
json_escape() {
    printf '%s' "$1" | sed \
        -e 's/\\/\\\\/g' \
        -e 's/"/\\"/g' \
        -e 's/\x08/\\b/g' \
        -e 's/\x0c/\\f/g' \
        -e 's/\x0a/\\n/g' \
        -e 's/\x0d/\\r/g' \
        -e 's/\x09/\\t/g'
}

count=0
# Write to tmp first so a failure mid-walk doesn't leave a partial manifest
: > "$TMP"

for agent_file in "$AGENTS_DIR"/*.md; do
    [[ -f "$agent_file" ]] || continue

    base="$(basename "$agent_file")"
    rel_path="super-gsd/agents/$base"
    agent_id="$(extract_field "$agent_file" name)"
    [[ -z "$agent_id" ]] && agent_id="${base%.md}"

    model="$(extract_field "$agent_file" model)"
    [[ -z "$model" ]] && model="unspecified"

    tools="$(extract_field "$agent_file" tools)"
    description="$(extract_field "$agent_file" description)"

    # git hash-object gives the blob sha1 — stable, content-addressable, matches
    # what git stores. Falls back to empty string if not in a git repo.
    sha="$(git -C "$ROOT" hash-object "$agent_file" 2>/dev/null || echo "")"

    # Portable mtime (GNU stat or BSD stat)
    mtime="$(stat -c %Y "$agent_file" 2>/dev/null || stat -f %m "$agent_file" 2>/dev/null || echo 0)"

    # Escape for JSON embedding
    id_esc="$(json_escape "$agent_id")"
    path_esc="$(json_escape "$rel_path")"
    model_esc="$(json_escape "$model")"
    tools_esc="$(json_escape "$tools")"
    desc_esc="$(json_escape "$description")"
    sha_esc="$(json_escape "$sha")"

    printf '{"id":"%s","path":"%s","sha":"%s","mtime":%s,"model":"%s","tools":"%s","description":"%s","status":"active"}\n' \
        "$id_esc" "$path_esc" "$sha_esc" "$mtime" "$model_esc" "$tools_esc" "$desc_esc" >> "$TMP"
    count=$((count + 1))
done

if [[ "$DRY_RUN" == true ]]; then
    echo "DRY RUN — would write $MANIFEST ($count records):"
    cat "$TMP"
    rm -f "$TMP"
    exit 0
fi

mv "$TMP" "$MANIFEST"
echo "sgsd-registry-sync: wrote $count agent records to $MANIFEST"

#!/usr/bin/env bash
# ============================================================================
# sgsd-recall — retrieve matching entries from the SGSD context tree
# ============================================================================
# Per DLB-01 (memory topology): the SGSD-global memory tier is a git-native
# filesystem store at .brv/context-tree/ with a catalogue at INDEX.md. This
# script is the stable, callable retrieval interface that replaces the dead
# `brv-query` / `mcp__brv__*` no-ops.
#
# Usage:
#   sgsd-recall "query terms"                 → top-3 matches by index scan
#   sgsd-recall "query" --limit 5             → top-5 matches
#   sgsd-recall "query" --type pattern        → filter by type column
#   sgsd-recall "query" --paths-only          → print matching paths only
#   sgsd-recall "query" --root /abs/project   → override auto-detected root
#
# Output (default): for each match, emits a fenced block:
#   <!-- sgsd-recall: <type>/<slug> (<path>) -->
#   <file body>
#   <!-- /sgsd-recall -->
#
# Algorithm: grep INDEX.md rows for each query term (case-insensitive). Rank
# by number of distinct terms matched per row. Return top-N file contents.
# No BM25, no embeddings — per DLB-01's "defer ranking infrastructure until
# corpus ≥ 40 files or benchmark proves it earns its keep."
# ============================================================================

set -u

LIMIT=3
TYPE=""
PATHS_ONLY=false
ROOT=""
QUERY=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --limit)      LIMIT="$2"; shift 2 ;;
        --type)       TYPE="$2"; shift 2 ;;
        --paths-only) PATHS_ONLY=true; shift ;;
        --root)       ROOT="$2"; shift 2 ;;
        --help|-h)
            head -30 "$0" | tail -25
            exit 0 ;;
        *)
            if [[ -z "$QUERY" ]]; then QUERY="$1"; else QUERY="$QUERY $1"; fi
            shift ;;
    esac
done

if [[ -z "$QUERY" ]]; then
    echo "sgsd-recall: no query provided" >&2
    echo "Usage: sgsd-recall \"query terms\" [--limit N] [--type TYPE] [--paths-only]" >&2
    exit 2
fi

# Resolve project root — walk up from CWD looking for .brv/context-tree/INDEX.md
if [[ -z "$ROOT" ]]; then
    d="$(pwd -P)"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -f "$d/.brv/context-tree/INDEX.md" ]]; then
            ROOT="$d"
            break
        fi
        d="$(dirname "$d")"
    done
fi

if [[ -z "$ROOT" || ! -f "$ROOT/.brv/context-tree/INDEX.md" ]]; then
    echo "sgsd-recall: no .brv/context-tree/INDEX.md found (searched up from $(pwd))" >&2
    exit 3
fi

INDEX="$ROOT/.brv/context-tree/INDEX.md"
TREE="$ROOT/.brv/context-tree"

# Score each INDEX row by number of distinct (lowercase) terms it contains.
# INDEX rows start with "| " (markdown table). We parse path from column 3.
# Terms are case-insensitively matched against the full row text.
read -r -a TERMS <<< "$(echo "$QUERY" | tr '[:upper:]' '[:lower:]')"

SCORED=$(awk -v terms_str="${TERMS[*]}" -v type_filter="$TYPE" '
    BEGIN {
        n = split(tolower(terms_str), terms, " ")
    }
    /^\| *(type *\|)/ { next }            # header row
    /^\|[- :]+\|[- :]+/ { next }           # separator row
    /^\| / {
        row = tolower($0)
        score = 0
        for (i = 1; i <= n; i++) {
            if (terms[i] != "" && index(row, terms[i])) score++
        }
        # Parse columns (delimiter = " | ")
        gsub(/^\| */, "")
        gsub(/ *\|$/, "")
        n_cols = split($0, col, / *\| */)
        if (n_cols < 4) next
        rtype = col[1]
        rslug = col[2]
        rpath = col[3]
        rsum  = col[4]
        if (type_filter != "" && rtype != type_filter) next
        if (score > 0) print score "\t" rtype "\t" rslug "\t" rpath "\t" rsum
    }
' "$INDEX" | sort -k1,1 -nr -k3,3)

if [[ -z "$SCORED" ]]; then
    echo "sgsd-recall: no matches for \"$QUERY\"${TYPE:+ (type=$TYPE)}" >&2
    exit 4
fi

COUNT=0
while IFS=$'\t' read -r _score rtype rslug rpath rsummary; do
    [[ "$COUNT" -ge "$LIMIT" ]] && break
    COUNT=$((COUNT + 1))
    full_path="$TREE/$rpath"
    if [[ "$PATHS_ONLY" == true ]]; then
        echo "$full_path"
        continue
    fi
    echo "<!-- sgsd-recall: ${rtype}/${rslug} ($rpath) — $rsummary -->"
    if [[ -f "$full_path" ]]; then
        cat "$full_path"
    else
        echo "<!-- MISSING FILE: $full_path — INDEX.md row is stale -->"
    fi
    echo "<!-- /sgsd-recall -->"
    echo
done <<< "$SCORED"

exit 0

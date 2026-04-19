#!/usr/bin/env bash
# ============================================================================
# sgsd-curate — write a new entry to the SGSD context tree and update INDEX.md
# ============================================================================
# Per DLB-01 (memory topology): curation replaces the dead `brv-curate` no-ops.
# This script writes a new .md file under .brv/context-tree/<type>/<slug>.md
# with YAML frontmatter, then atomically updates INDEX.md so the entry is
# immediately retrievable by sgsd-recall.
#
# Usage:
#   sgsd-curate --type pattern --slug my-new-pattern --summary "≤80 chars" [opts] < body.md
#
# Options:
#   --type TYPE        one of: pattern | anti-pattern | decision | expertise | script
#   --slug SLUG        kebab-case identifier, used as filename
#   --summary TEXT     ≤80-char index row summary (required)
#   --title TITLE      human title (defaults to slug capitalised)
#   --tags "a,b,c"     optional comma-separated tag list
#   --importance N     0-100, default 70
#   --maturity STAGE   raw | core | experimental, default raw
#   --file PATH        read body from file instead of stdin
#   --root PATH        override auto-detected project root
#   --dry-run          show what would be written without writing
#
# Atomicity: both the new file and the INDEX.md update happen OR neither does.
# On any failure after the body file is written, it's rolled back.
# ============================================================================

set -u

TYPE=""
SLUG=""
SUMMARY=""
TITLE=""
TAGS=""
IMPORTANCE=70
MATURITY="raw"
BODY_FILE=""
ROOT=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --type)       TYPE="$2"; shift 2 ;;
        --slug)       SLUG="$2"; shift 2 ;;
        --summary)    SUMMARY="$2"; shift 2 ;;
        --title)      TITLE="$2"; shift 2 ;;
        --tags)       TAGS="$2"; shift 2 ;;
        --importance) IMPORTANCE="$2"; shift 2 ;;
        --maturity)   MATURITY="$2"; shift 2 ;;
        --file)       BODY_FILE="$2"; shift 2 ;;
        --root)       ROOT="$2"; shift 2 ;;
        --dry-run)    DRY_RUN=true; shift ;;
        --help|-h)    head -35 "$0" | tail -30; exit 0 ;;
        *) echo "sgsd-curate: unknown argument: $1" >&2; exit 2 ;;
    esac
done

# Validate
if [[ -z "$TYPE" || -z "$SLUG" || -z "$SUMMARY" ]]; then
    echo "sgsd-curate: --type, --slug, --summary are required" >&2
    exit 2
fi
case "$TYPE" in
    pattern|anti-pattern|decision|expertise|script) ;;
    *) echo "sgsd-curate: --type must be one of: pattern, anti-pattern, decision, expertise, script" >&2; exit 2 ;;
esac
if [[ ${#SUMMARY} -gt 80 ]]; then
    echo "sgsd-curate: --summary is ${#SUMMARY} chars (limit 80). Tighten it." >&2
    exit 2
fi

# Resolve root (same logic as sgsd-recall)
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
    echo "sgsd-curate: no .brv/context-tree/INDEX.md found above $(pwd). Run from a project root or pass --root." >&2
    exit 3
fi

# Map type to directory (pluralise except "expertise")
case "$TYPE" in
    pattern)       DIR="patterns" ;;
    anti-pattern)  DIR="anti-patterns" ;;
    decision)      DIR="decisions" ;;
    expertise)     DIR="expertise" ;;
    script)        DIR="scripts" ;;
esac

TREE="$ROOT/.brv/context-tree"
FILE_PATH="$TREE/$DIR/$SLUG.md"
REL_PATH="$DIR/$SLUG.md"
INDEX="$TREE/INDEX.md"

if [[ -e "$FILE_PATH" ]]; then
    echo "sgsd-curate: $FILE_PATH already exists. Edit directly or use a different --slug." >&2
    exit 4
fi

# Read body
if [[ -n "$BODY_FILE" ]]; then
    [[ ! -f "$BODY_FILE" ]] && { echo "sgsd-curate: --file $BODY_FILE not found" >&2; exit 5; }
    BODY="$(cat "$BODY_FILE")"
elif [[ ! -t 0 ]]; then
    BODY="$(cat)"
else
    echo "sgsd-curate: no body supplied (use --file PATH or pipe via stdin)" >&2
    exit 2
fi

[[ -z "$TITLE" ]] && TITLE="$(echo "$SLUG" | tr '-' ' ')"

# Assemble file content
read -r -d '' CONTENT <<EOF || true
---
title: $TITLE
tags: [$(echo "$TAGS" | sed 's/,/, /g')]
importance: $IMPORTANCE
maturity: $MATURITY
created: $(date -u +%Y-%m-%dT%H:%M:%SZ)
---

$BODY
EOF

# Index row (pipe-delimited, matches existing INDEX.md format)
NEW_ROW="| $TYPE | $SLUG | $REL_PATH | $SUMMARY |"

if [[ "$DRY_RUN" == true ]]; then
    echo "DRY RUN — would write:"
    echo "  $FILE_PATH"
    echo "--- content ---"
    echo "$CONTENT"
    echo "--- /content ---"
    echo "  $INDEX (append under section for type=$TYPE):"
    echo "  $NEW_ROW"
    exit 0
fi

# ── Atomic write: body file first, then INDEX.md update ──
mkdir -p "$(dirname "$FILE_PATH")"
printf '%s\n' "$CONTENT" > "$FILE_PATH.tmp"
mv "$FILE_PATH.tmp" "$FILE_PATH"

# Locate the section header in INDEX.md (## patterns / ## anti-patterns / etc.)
# and append NEW_ROW at the end of that section's table. Section header rules:
# match "## <dir>" (the pluralised directory name).
case "$DIR" in
    patterns)        SECTION="## patterns" ;;
    anti-patterns)   SECTION="## anti-patterns" ;;
    decisions)       SECTION="## decisions" ;;
    expertise)       SECTION="## expertise" ;;
    scripts)         SECTION="## scripts" ;;
esac

# Rewrite INDEX.md inserting NEW_ROW at the end of the target section.
awk -v section="$SECTION" -v new_row="$NEW_ROW" '
    BEGIN { in_target = 0; inserted = 0 }
    {
        # When we see the section header, enter target mode
        if ($0 == section) { in_target = 1; print; next }
        # Leaving target section (next ## heading or EOF)
        if (in_target && !inserted && /^## / && $0 != section) {
            print new_row
            print ""
            inserted = 1
            in_target = 0
        }
        print
    }
    END {
        if (in_target && !inserted) { print new_row }
    }
' "$INDEX" > "$INDEX.tmp"

if [[ ! -s "$INDEX.tmp" ]]; then
    # Rollback body file
    rm -f "$FILE_PATH"
    rm -f "$INDEX.tmp"
    echo "sgsd-curate: INDEX.md rewrite produced empty output — rolled back" >&2
    exit 6
fi

mv "$INDEX.tmp" "$INDEX"

echo "sgsd-curate: wrote $REL_PATH + updated INDEX.md"

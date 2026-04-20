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

# DLB-04 · FINDING-18 fix: slug discipline guard.
# Pathological slug observed: waste-waiting-p08-narrative-stale-2026-04-19-20-01-38z
# Reject ISO-date embeddings, ISO-Z timestamp tails, non-kebab chars, runaway length.
if [[ ${#SLUG} -gt 60 ]]; then
    echo "sgsd-curate: slug is ${#SLUG} chars (limit 60). Drop timestamps or redundant context." >&2
    exit 2
fi
if [[ ! "$SLUG" =~ ^[a-z0-9-]+$ ]]; then
    echo "sgsd-curate: slug must be kebab-case [a-z0-9-]+ — got '$SLUG'" >&2
    exit 2
fi
if [[ "$SLUG" =~ [0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
    echo "sgsd-curate: slug contains an ISO date (YYYY-MM-DD) — '$SLUG'. Slugs must be time-stable." >&2
    exit 2
fi
if [[ "$SLUG" =~ [0-9]z$ ]]; then
    echo "sgsd-curate: slug ends with an ISO-Z timestamp tail ('$SLUG'). Strip the timestamp." >&2
    exit 2
fi
if [[ "$SLUG" =~ ^- || "$SLUG" =~ -$ || "$SLUG" =~ -- ]]; then
    echo "sgsd-curate: slug must not start/end with '-' or contain '--' — got '$SLUG'" >&2
    exit 2
fi

# Resolve root. Prefer the v1.2 consolidated store (.planning/memory/MEMORY.md);
# fall back to the legacy .brv/context-tree/INDEX.md for unmigrated projects
# so curation keeps working until they run sgsd-memory-migrate.
MODE="v1.2"  # v1.2 = .planning/memory; legacy = .brv/context-tree
if [[ -z "$ROOT" ]]; then
    d="$(pwd -P)"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -f "$d/.planning/memory/MEMORY.md" ]]; then
            ROOT="$d"; MODE="v1.2"; break
        fi
        if [[ -f "$d/.brv/context-tree/INDEX.md" ]]; then
            ROOT="$d"; MODE="legacy"; break
        fi
        d="$(dirname "$d")"
    done
fi
if [[ -z "$ROOT" ]]; then
    echo "sgsd-curate: no .planning/memory/MEMORY.md or .brv/context-tree/INDEX.md found above $(pwd)." >&2
    echo "  Run 'sgsd -Backfill' to scaffold the memory tree, or pass --root." >&2
    exit 3
fi
# If --root was passed, detect which mode it's in
if [[ -f "$ROOT/.planning/memory/MEMORY.md" ]]; then
    MODE="v1.2"
elif [[ -f "$ROOT/.brv/context-tree/INDEX.md" ]]; then
    MODE="legacy"
else
    echo "sgsd-curate: --root $ROOT has neither .planning/memory/MEMORY.md nor .brv/context-tree/INDEX.md" >&2
    exit 3
fi

# Map type to target subdirectory and section header
# v1.2 taxonomy: architecture/{patterns,anti-patterns,decisions,expertise}, code,
#                workflow/{user,feedback,preferences}, project, reference,
#                domain, errors, trajectory/{hypothesis,candidate,lesson}
if [[ "$MODE" == "v1.2" ]]; then
    case "$TYPE" in
        pattern)       DIR="architecture/patterns";       SECTION="## architecture/patterns" ;;
        anti-pattern)  DIR="architecture/anti-patterns";  SECTION="## architecture/anti-patterns" ;;
        decision)      DIR="architecture/decisions";      SECTION="## architecture/decisions" ;;
        expertise)     DIR="architecture/expertise";      SECTION="## architecture/expertise" ;;
        script)        DIR="code";                         SECTION="## code" ;;
        user)          DIR="workflow/user";                SECTION="## workflow/user" ;;
        feedback)      DIR="workflow/feedback";            SECTION="## workflow/feedback" ;;
        preference)    DIR="workflow/preferences";         SECTION="## workflow/preferences" ;;
        project-note)  DIR="project";                      SECTION="## project" ;;
        reference)     DIR="reference";                    SECTION="## reference" ;;
        domain)        DIR="domain";                       SECTION="## domain" ;;
        error)         DIR="errors";                       SECTION="## errors" ;;
        hypothesis)    DIR="trajectory/hypothesis";        SECTION="## trajectory/hypothesis" ;;
        *) echo "sgsd-curate: unknown --type '$TYPE' for v1.2 store" >&2; exit 2 ;;
    esac
    TREE="$ROOT/.planning/memory"
    INDEX="$TREE/MEMORY.md"
else
    # Legacy mode - original taxonomy
    case "$TYPE" in
        pattern)       DIR="patterns"       ;;
        anti-pattern)  DIR="anti-patterns"  ;;
        decision)      DIR="decisions"      ;;
        expertise)     DIR="expertise"      ;;
        script)        DIR="scripts"        ;;
        *) echo "sgsd-curate: --type must be one of: pattern, anti-pattern, decision, expertise, script (legacy store)" >&2; exit 2 ;;
    esac
    TREE="$ROOT/.brv/context-tree"
    INDEX="$TREE/INDEX.md"
fi

FILE_PATH="$TREE/$DIR/$SLUG.md"
REL_PATH="$DIR/$SLUG.md"

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

# Index row. v1.2 uses markdown list items (auto-memory compatible);
# legacy uses pipe-delimited tables.
if [[ "$MODE" == "v1.2" ]]; then
    NEW_ROW="- [$TITLE]($REL_PATH) - $SUMMARY"
else
    NEW_ROW="| $TYPE | $SLUG | $REL_PATH | $SUMMARY |"
    # Recompute SECTION for legacy (v1.2 already set it above)
    case "$DIR" in
        patterns)        SECTION="## patterns" ;;
        anti-patterns)   SECTION="## anti-patterns" ;;
        decisions)       SECTION="## decisions" ;;
        expertise)       SECTION="## expertise" ;;
        scripts)         SECTION="## scripts" ;;
    esac
fi

if [[ "$DRY_RUN" == true ]]; then
    echo "DRY RUN — would write (mode=$MODE):"
    echo "  $FILE_PATH"
    echo "--- content ---"
    echo "$CONTENT"
    echo "--- /content ---"
    echo "  $INDEX (append under '$SECTION'):"
    echo "  $NEW_ROW"
    exit 0
fi

# ── Atomic write: body file first, then INDEX.md update ──
mkdir -p "$(dirname "$FILE_PATH")"
printf '%s\n' "$CONTENT" > "$FILE_PATH.tmp"
mv "$FILE_PATH.tmp" "$FILE_PATH"

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

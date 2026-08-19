#!/usr/bin/env bash
# ============================================================================
# sgsd-conformance-check — DLB-05 Wave B
# ============================================================================
# Measures drift between PLAN.md (what was planned) and SUMMARY.md (what was
# executed) for a phase. Emits a scalar drift_pct to conformance-log.jsonl.
#
# First implementation: mechanical checkbox diff. Cheap, deterministic.
#   - planned_tasks = count of "- [ ]" + "- [x]" in PLAN.md
#   - evidenced_tasks = count of "- [x]" in PLAN.md (ticked after execution)
#   - drift_pct = (planned - evidenced) / planned
#
# Minimum-count guard (Architect R1): skip if planned_tasks < 5. Raw
# percentages on 2-3 task phases produce noise.
#
# Future (not shipped here): Haiku semantic diff for phases without
# consistent checkbox discipline. That's a Q2a-gate-level change needing
# its own brief.
#
# Usage:
#   sgsd-conformance-check.sh <phase-number-or-slug> [--project PATH] [--dry-run]
#
# Output: appends to .planning/metrics/conformance-log.jsonl:
#   {"ts","phase","planned_tasks","evidenced_tasks","drift_pct","top_3_drivers","skipped":bool}
#
# Per DLB-05 Q2b: NO gate verdict, NO phase-close blocking. Logs only.
# ============================================================================

set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PHASE_NAME_CLI="$SCRIPT_DIR/lib/phase-name.cjs"
PHASE_ARG=""
PROJECT=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --project)  PROJECT="$2"; shift 2 ;;
        --dry-run)  DRY_RUN=true; shift ;;
        --help|-h)  head -30 "$0" | tail -25; exit 0 ;;
        -*)         echo "sgsd-conformance-check: unknown flag: $1" >&2; exit 2 ;;
        *)          PHASE_ARG="$1"; shift ;;
    esac
done

if [[ -z "$PHASE_ARG" ]]; then
    echo "sgsd-conformance-check: phase number or slug required" >&2
    exit 2
fi

# Resolve project root
if [[ -z "$PROJECT" ]]; then
    d="$(pwd -P)"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -d "$d/.planning" ]]; then
            PROJECT="$d"
            break
        fi
        d="$(dirname "$d")"
    done
fi
if [[ -z "$PROJECT" || ! -d "$PROJECT/.planning" ]]; then
    echo "sgsd-conformance-check: no .planning/ found — pass --project" >&2
    exit 3
fi

# Resolve through the shared dual-root phase-name boundary.
if ! PHASE_JSON=$(node "$PHASE_NAME_CLI" --list --project "$PROJECT" --match "$PHASE_ARG"); then
    echo "sgsd-conformance-check: phase discovery failed" >&2
    exit 5
fi
if ! PHASE_RECORD=$(printf '%s' "$PHASE_JSON" | node -e '
  const fs = require("fs");
  const path = require("path");
  const rows = JSON.parse(fs.readFileSync(0, "utf8"));
  if (!rows[0]) process.exit(0);
  const row = rows[0];
  const dir = row.dir.split(path.sep).join("/");
  const name = row.slug ? row.token + "-" + row.slug : row.token;
  process.stdout.write([dir, name, row.token].join("\t"));
'); then
    echo "sgsd-conformance-check: phase discovery response invalid" >&2
    exit 5
fi
IFS=$'\t' read -r PHASE_DIR PHASE_NAME PHASE_NUM <<< "$PHASE_RECORD"
if [[ -z "$PHASE_DIR" ]]; then
    echo "sgsd-conformance-check: no phase directory matches '$PHASE_ARG'" >&2
    exit 4
fi

# Collect all PLAN.md files (one per plan within a phase)
plan_files=$(find "$PHASE_DIR" -maxdepth 1 -type f -name "*-PLAN.md" 2>/dev/null)
summary_files=$(find "$PHASE_DIR" -maxdepth 1 -type f -name "*-SUMMARY.md" 2>/dev/null)

# Count checkboxes
planned_tasks=0
evidenced_tasks=0
if [[ -n "$plan_files" ]]; then
    # Lines starting with "- [ ]" or "- [x]" (trimmed leading whitespace)
    planned_tasks=$(grep -hE '^\s*- \[[ xX]\]' $plan_files 2>/dev/null | wc -l)
    evidenced_tasks=$(grep -hE '^\s*- \[[xX]\]' $plan_files 2>/dev/null | wc -l)
fi

# Minimum-count guard (Architect R1)
skipped=false
if [[ "$planned_tasks" -lt 5 ]]; then
    skipped=true
    drift_pct=0
    top_drivers="skipped: planned_tasks=$planned_tasks < 5 minimum"
else
    if [[ "$planned_tasks" -gt 0 ]]; then
        # Bash arithmetic for pct (integer)
        drift_pct=$(( (planned_tasks - evidenced_tasks) * 100 / planned_tasks ))
    else
        drift_pct=0
    fi
    # Top-3 drivers: collect DEVIATIONS section content from SUMMARY.md
    top_drivers="no DEVIATIONS found in SUMMARY"
    if [[ -n "$summary_files" ]]; then
        dev_count=$(grep -hcE '^\*\*\[?Rule' $summary_files 2>/dev/null || echo 0)
        dev_count=$((dev_count + 0))
        if [[ "$dev_count" -gt 0 ]]; then
            top_drivers="$dev_count deviation(s) in SUMMARY"
        fi
    fi
fi

TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
LOG="$PROJECT/.planning/metrics/conformance-log.jsonl"

# Escape quotes in top_drivers for JSON embedding
esc_drivers=$(printf '%s' "$top_drivers" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g')

LINE=$(printf '{"ts":"%s","phase":"%s","phase_num":"%s","planned_tasks":%s,"evidenced_tasks":%s,"drift_pct":%s,"top_3_drivers":"%s","skipped":%s}' \
    "$TS" "$PHASE_NAME" "$PHASE_NUM" "$planned_tasks" "$evidenced_tasks" "$drift_pct" "$esc_drivers" "$skipped")

if [[ "$DRY_RUN" == true ]]; then
    echo "DRY RUN — would append to $LOG:"
    echo "  $LINE"
    exit 0
fi

mkdir -p "$(dirname "$LOG")"
echo "$LINE" >> "$LOG"

# Human-readable summary to stdout
echo "sgsd-conformance-check: phase=$PHASE_NAME planned=$planned_tasks evidenced=$evidenced_tasks drift_pct=$drift_pct%${skipped:+ (skipped: <5 tasks)}"
exit 0

#!/usr/bin/env bash
# ============================================================================
# sgsd-muda-audit — per-phase waste audit that writes WASTE.md + curates findings
# ============================================================================
# Wraps sgsd-muda-probe and produces:
#   1. A human-readable WASTE.md in the phase dir
#   2. For each WARN/FAIL probe, a curated waste-finding entry via sgsd-curate
#      into .brv/context-tree/anti-patterns/ — so future classifier consults
#      (when the read path lands post-v1.2) see them ranked by recurrence.
#
# Per DLB-02's CONVERGENT decision: write-path only, no two-tier, no seed
# library, no fold with sgsd-token-audit yet. This script is the entire MUDA
# write path. Readers don't exist yet by design (Contrarian's "prove-it"
# gate — the 20 OPEN gap-audit recommendations include the classifier read
# wire as a separate future item).
#
# Usage:
#   sgsd-muda-audit.sh <phase-number-or-slug> [--project PATH] [--dry-run] [--no-curate]
#
# Examples:
#   sgsd-muda-audit.sh 8
#   sgsd-muda-audit.sh 145 --project /home/me/project-clarity-erp
#   sgsd-muda-audit.sh 8 --dry-run
#
# Exit codes (inherits from probe):
#   0 — all PASS (WASTE.md still written with receipts)
#   1 — >=1 WARN findings curated
#   2 — >=1 FAIL findings curated
#   3 — usage error / phase not found
# ============================================================================

set -u

PHASE=""
PROJECT=""
DRY_RUN=false
NO_CURATE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --project|-p) PROJECT="$2"; shift 2 ;;
        --dry-run)    DRY_RUN=true; shift ;;
        --no-curate)  NO_CURATE=true; shift ;;
        --help|-h)    head -30 "$0" | tail -25; exit 0 ;;
        -*)           echo "sgsd-muda-audit: unknown flag $1" >&2; exit 3 ;;
        *)            if [[ -z "$PHASE" ]]; then PHASE="$1"; fi; shift ;;
    esac
done

if [[ -z "$PHASE" ]]; then
    echo "sgsd-muda-audit: phase number or slug required" >&2
    echo "Usage: sgsd-muda-audit.sh <phase> [--project PATH] [--dry-run] [--no-curate]" >&2
    exit 3
fi

# Resolve project root
if [[ -z "$PROJECT" ]]; then
    d="$(pwd -P)"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -d "$d/.planning" ]]; then PROJECT="$d"; break; fi
        d="$(dirname "$d")"
    done
fi
if [[ -z "$PROJECT" || ! -d "$PROJECT/.planning" ]]; then
    echo "sgsd-muda-audit: no .planning/ found (pass --project PATH)" >&2
    exit 3
fi

# Resolve phase directory. Accepts "8", "08", "8.1", or a full slug like
# "08-sgsd-self-audit". Zero-pad integer phases to match directories that
# always use 2-digit prefixes.
PHASE_DIR=""
if [[ -d "$PROJECT/.planning/phases" ]]; then
    # Pre-compute a zero-padded variant for matching (only if PHASE is all-digits
    # or digits.digits — don't try to pad full slugs).
    padded=""
    if [[ "$PHASE" =~ ^[0-9]+$ ]] && [[ ${#PHASE} -lt 2 ]]; then
        padded=$(printf '%02d' "$PHASE")
    elif [[ "$PHASE" =~ ^[0-9]+\.[0-9]+$ ]]; then
        intpart="${PHASE%%.*}"
        decpart="${PHASE##*.}"
        if [[ ${#intpart} -lt 2 ]]; then
            padded=$(printf '%02d.%s' "$intpart" "$decpart")
        fi
    fi
    for d in "$PROJECT/.planning/phases/"*/; do
        name=$(basename "$d")
        if [[ "$name" == "$PHASE" || "$name" == "$PHASE-"* ]]; then
            PHASE_DIR="${d%/}"; break
        fi
        if [[ -n "$padded" && ( "$name" == "$padded" || "$name" == "$padded-"* ) ]]; then
            PHASE_DIR="${d%/}"; break
        fi
    done
fi
if [[ -z "$PHASE_DIR" ]]; then
    echo "sgsd-muda-audit: phase $PHASE not found in $PROJECT/.planning/phases/" >&2
    exit 3
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROBE="$SCRIPT_DIR/sgsd-muda-probe.sh"
CURATE="$SCRIPT_DIR/sgsd-curate.sh"

if [[ ! -x "$PROBE" ]]; then
    echo "sgsd-muda-audit: probe script missing or not executable: $PROBE" >&2
    exit 3
fi

# Run probe (capture JSON; ignore exit code — we aggregate below)
set +e
PROBE_JSON=$(bash "$PROBE" "$PROJECT")
PROBE_EXIT=$?
set -e

if [[ -z "$PROBE_JSON" ]]; then
    echo "sgsd-muda-audit: probe returned empty output" >&2
    exit 3
fi

TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
PHASE_NUM=$(basename "$PHASE_DIR" | grep -oE '^[0-9]+(\.[0-9]+)?')
PHASE_SLUG=$(basename "$PHASE_DIR")

# Parse probe verdicts without jq (portable) — node is installed per install.sh.
# Emit fields tab-separated so evidence strings (which can contain spaces,
# quotes, parens) don't get re-split by the shell. read with IFS=$'\t'
# preserves the whole evidence string in one variable.
PROBE_PARSED=$(
    printf '%s' "$PROBE_JSON" | node -e '
        let d = "";
        process.stdin.on("data", c => d += c);
        process.stdin.on("end", () => {
            try {
                const j = JSON.parse(d);
                const p = j.probes;
                // tab-separated: 9 fields in fixed order
                const out = [
                    p.haiku_fails.verdict,
                    p.narrative_age_sec.verdict,
                    p.git_spawn_pct.verdict,
                    p.haiku_fails.value,
                    p.narrative_age_sec.value,
                    p.git_spawn_pct.value,
                    p.haiku_fails.evidence,
                    p.narrative_age_sec.evidence,
                    p.git_spawn_pct.evidence
                ];
                process.stdout.write(out.join("\t"));
            } catch (e) {
                process.stderr.write("parse error: " + e.message);
                process.exit(4);
            }
        });
    '
)
IFS=$'\t' read -r HAIKU_V NARR_V GIT_V HAIKU_VAL NARR_VAL GIT_VAL HAIKU_EV NARR_EV GIT_EV <<< "$PROBE_PARSED"

# Tally WARN/FAIL for summary and curation
warn_count=0
fail_count=0
for v in "$HAIKU_V" "$NARR_V" "$GIT_V"; do
    [[ "$v" == "WARN" ]] && warn_count=$((warn_count + 1))
    [[ "$v" == "FAIL" ]] && fail_count=$((fail_count + 1))
done

# Compose WASTE.md
WASTE_FILE="$PHASE_DIR/WASTE.md"
compose_waste_md() {
    cat <<MDBODY
---
phase: $PHASE_NUM
slug: $PHASE_SLUG
run_at: $TS
probe: sgsd-muda-probe
warn_count: $warn_count
fail_count: $fail_count
exit_code: $PROBE_EXIT
---

# MUDA Waste Audit — Phase $PHASE_NUM

## Summary

$(if [[ $fail_count -eq 0 && $warn_count -eq 0 ]]; then
    echo "All three probes PASS. No waste detected by current watchdogs. Phase is clean per DLB-02 Day-2 criteria."
elif [[ $fail_count -gt 0 ]]; then
    echo "**$fail_count FAIL** + $warn_count WARN across 3 probes. Findings curated to \`.brv/context-tree/anti-patterns/\` for future classifier consult."
else
    echo "$warn_count WARN (no FAIL) across 3 probes. Findings curated."
fi)

## Probe Results

| Probe | Verdict | Value | Threshold | Waste Class | Evidence |
|-------|---------|-------|-----------|-------------|----------|
| haiku_fails       | $HAIKU_V | $HAIKU_VAL | warn>=3 fail>=8 | defects | $(printf '%s' "$HAIKU_EV" | sed 's/^"\(.*\)"$/\1/') |
| narrative_age_sec | $NARR_V  | $NARR_VAL  | warn>1800s fail>3600s | waiting | $(printf '%s' "$NARR_EV"  | sed 's/^"\(.*\)"$/\1/') |
| git_spawn_pct     | $GIT_V   | $GIT_VAL%  | warn>20% fail>40% | motion  | $(printf '%s' "$GIT_EV"   | sed 's/^"\(.*\)"$/\1/') |

## Raw Probe JSON

\`\`\`json
$PROBE_JSON
\`\`\`

## Notes

- Probes run live; values reflect state at $TS.
- WARN/FAIL findings are curated to the MUDA context-tree section (unless \`--no-curate\` passed).
- Kill condition (DLB-02): if no waste class recurs across 2 consecutive milestones, the MUDA
  skill is flagged for retirement. Run \`sgsd-muda-recurrence.sh\` at milestone close to check.
MDBODY
}

if [[ "$DRY_RUN" == true ]]; then
    echo "DRY RUN — would write $WASTE_FILE:"
    echo "--- WASTE.md ---"
    compose_waste_md
    echo "--- end WASTE.md ---"
    printf '%s\n' "$PROBE_JSON"
    exit $PROBE_EXIT
fi

# Atomic write: tmp + rename
mkdir -p "$PHASE_DIR"
tmp="$WASTE_FILE.tmp"
compose_waste_md > "$tmp"
mv "$tmp" "$WASTE_FILE"

# Curate each WARN/FAIL probe as an anti-pattern finding
if [[ "$NO_CURATE" == false && -x "$CURATE" ]]; then
    curate_finding() {
        local name="$1" verdict="$2" value="$3" class="$4" evidence="$5" threshold="$6"
        local slug="waste-${class}-p${PHASE_NUM}-${name}-${TS//[:T]/-}"
        slug=$(printf '%s' "$slug" | tr 'A-Z' 'a-z' | sed 's/[^a-z0-9-]/-/g; s/-\+/-/g; s/-$//')
        local summary="P${PHASE_NUM} ${name}=${value} ${verdict} — ${class} waste"
        # Cap summary at 80 chars per sgsd-curate validation
        summary="${summary:0:79}"
        local body
        body=$(cat <<BODY
Phase $PHASE_NUM waste probe: **$name** returned $verdict (value: $value, threshold: $threshold).

Waste class: $class
Evidence: $evidence
Run at: $TS
Source: sgsd-muda-probe via sgsd-muda-audit

## Why this matters

Automated watchdog caught this pattern. If the same \`$class\` waste class
appears in a subsequent phase audit, the classifier (post-v1.2) will surface
the earlier finding pre-dispatch so the executor can avoid the same cost.

## Canonical remediation

See [DLB-02 memo](../../decisions/DLB-02-muda-learning-loop.md) for the
broader waste-detection design. Individual probe fixes:

- **defects** (haiku_fails): check \`claude --print\` auth, PATH, and model
  compatibility. Clear \`narrative.md.lastfail\` after fix.
- **waiting** (narrative_age_sec): ensure the Haiku background worker is
  running; check for stale \`narrative.md.lock\`.
- **motion** (git_spawn_pct): review dashboards / skills for N+1 git
  invocation patterns. Batch via \`Invoke-CachedGit\` (see DLB-01 render-cache).
BODY
)
        if [[ "$DRY_RUN" == true ]]; then
            bash "$CURATE" --type anti-pattern --slug "$slug" --summary "$summary" \
                --tags "muda,$class,phase-$PHASE_NUM,automated" \
                --maturity raw --importance 75 \
                --file /dev/stdin --dry-run --root "$PROJECT" <<< "$body"
        else
            printf '%s\n' "$body" | bash "$CURATE" --type anti-pattern --slug "$slug" --summary "$summary" \
                --tags "muda,$class,phase-$PHASE_NUM,automated" \
                --maturity raw --importance 75 \
                --root "$PROJECT"
        fi
    }

    if [[ "$HAIKU_V" == "WARN" || "$HAIKU_V" == "FAIL" ]]; then
        curate_finding haiku-fails "$HAIKU_V" "$HAIKU_VAL" defects \
            "$(printf '%s' "$HAIKU_EV" | sed 's/^"\(.*\)"$/\1/')" "warn>=3 fail>=8" || \
            echo "sgsd-muda-audit: curate haiku finding failed (non-blocking)" >&2
    fi
    if [[ "$NARR_V" == "WARN" || "$NARR_V" == "FAIL" ]]; then
        curate_finding narrative-stale "$NARR_V" "$NARR_VAL" waiting \
            "$(printf '%s' "$NARR_EV" | sed 's/^"\(.*\)"$/\1/')" "warn>1800s fail>3600s" || \
            echo "sgsd-muda-audit: curate narrative finding failed (non-blocking)" >&2
    fi
    if [[ "$GIT_V" == "WARN" || "$GIT_V" == "FAIL" ]]; then
        curate_finding git-spawn-rate "$GIT_V" "$GIT_VAL" motion \
            "$(printf '%s' "$GIT_EV" | sed 's/^"\(.*\)"$/\1/')" "warn>20% fail>40%" || \
            echo "sgsd-muda-audit: curate git finding failed (non-blocking)" >&2
    fi
fi

# Log to metrics
METRICS_LOG="$PROJECT/.planning/metrics/muda-log.jsonl"
mkdir -p "$(dirname "$METRICS_LOG")"
printf '{"ts":"%s","phase":"%s","warn":%d,"fail":%d,"exit":%d,"probes":{"haiku":"%s","narrative":"%s","git":"%s"}}\n' \
    "$TS" "$PHASE_NUM" "$warn_count" "$fail_count" "$PROBE_EXIT" "$HAIKU_V" "$NARR_V" "$GIT_V" >> "$METRICS_LOG"

echo "sgsd-muda-audit: $WASTE_FILE written — $warn_count WARN, $fail_count FAIL (exit $PROBE_EXIT)"
exit $PROBE_EXIT

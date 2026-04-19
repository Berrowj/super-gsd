#!/usr/bin/env bash
# ============================================================================
# sgsd-muda-probe — lightweight waste watchdogs (DLB-02 Day 2 probes)
# ============================================================================
# Three live probes that detect known waste patterns without needing a full
# phase-close audit. Designed to run cheaply (<1s), often (per phase dispatch),
# and report structured JSON so sgsd-muda-audit or a dashboard can consume.
#
# The three probes map to observed waste classes from the CPU audit
# (2026-04-19) that prompted DLB-02:
#
#   1. HAIKU-FAIL counter
#      The narrative cache's `narrative.md.lastfail` stamp records consecutive
#      `claude --print` failures from the Haiku background refresh. 12 silent
#      failures accumulated undetected before the audit caught it. This probe
#      reads the stamp and emits verdict based on count.
#
#   2. NARRATIVE-STALENESS timer
#      `narrative.md` should refresh every ~5 minutes when active. An age
#      >30min indicates stuck refresh. >60min = definitely broken.
#
#   3. GIT-SPAWN rate (per activity-log window)
#      The sgsd-gate-verdict.ps1 N+1 git spawn pattern burned 21 git
#      processes per render. This probe samples the last 100 activity-log
#      entries and computes git-tool-use percentage. High pct = motion waste.
#
# Usage:
#   sgsd-muda-probe.sh [project-dir]
#   sgsd-muda-probe.sh --help
#
# Default project-dir = current working directory (auto-walks up to find .planning/).
# Output: single-line JSON on stdout:
#   {"project":"...","probes":{"haiku_fails":{...},"narrative_age_sec":{...},"git_spawn_pct":{...}}}
#
# Exit codes:
#   0 — all probes PASS
#   1 — one or more WARN verdicts
#   2 — one or more FAIL verdicts (gate-blocking)
#   3 — usage error / project root not found
# ============================================================================

set -u

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
    head -40 "$0" | tail -35
    exit 0
fi

# Resolve project root (auto-walk if not given)
if [[ -n "${1:-}" ]]; then
    ROOT="$1"
else
    ROOT="$(pwd -P)"
fi

# Walk up if .planning/ not at given ROOT
if [[ ! -d "$ROOT/.planning" ]]; then
    d="$ROOT"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -d "$d/.planning" ]]; then ROOT="$d"; break; fi
        d="$(dirname "$d")"
    done
fi

if [[ ! -d "$ROOT/.planning" ]]; then
    echo '{"error":"no .planning/ dir found"}' >&2
    exit 3
fi

METRICS="$ROOT/.planning/metrics"

# ── Probe 1: Haiku-fail counter ─────────────────────────────────────────────
haiku_fails=0
haiku_evidence=""
if [[ -f "$METRICS/narrative.md.lastfail" ]]; then
    raw=$(head -1 "$METRICS/narrative.md.lastfail" 2>/dev/null | tr -dc '0-9')
    [[ -n "$raw" ]] && haiku_fails="$raw"
    haiku_evidence="narrative.md.lastfail = $haiku_fails"
else
    haiku_evidence="narrative.md.lastfail absent (good — no recent failure)"
fi

haiku_verdict="PASS"
[[ "$haiku_fails" -ge 3 ]] && haiku_verdict="WARN"
[[ "$haiku_fails" -ge 8 ]] && haiku_verdict="FAIL"

# ── Probe 2: Narrative staleness ────────────────────────────────────────────
narrative_age=-1
narrative_evidence=""
if [[ -f "$METRICS/narrative.md" ]]; then
    now_s=$(date +%s)
    # Linux: stat -c %Y, macOS/BSD: stat -f %m
    mtime=$(stat -c %Y "$METRICS/narrative.md" 2>/dev/null || stat -f %m "$METRICS/narrative.md" 2>/dev/null)
    if [[ -n "$mtime" ]]; then
        narrative_age=$((now_s - mtime))
        narrative_evidence="narrative.md age ${narrative_age}s"
    else
        narrative_evidence="narrative.md mtime unreadable"
    fi
else
    narrative_evidence="narrative.md absent — Haiku refresh never ran"
fi

narr_verdict="PASS"
[[ "$narrative_age" -gt 1800 ]] && narr_verdict="WARN"
[[ "$narrative_age" -gt 3600 ]] && narr_verdict="FAIL"
# Negative age (file missing) is WARN not FAIL — absence is recoverable
[[ "$narrative_age" -lt 0 ]] && narr_verdict="WARN"

# ── Probe 3: Git-spawn rate ─────────────────────────────────────────────────
git_count=0
total_count=0
git_pct=0
git_evidence="activity-log.jsonl absent"
if [[ -f "$METRICS/activity-log.jsonl" ]]; then
    tail_file=$(mktemp)
    tail -100 "$METRICS/activity-log.jsonl" > "$tail_file"
    total_count=$(wc -l < "$tail_file" | tr -d ' ')
    if [[ "$total_count" -gt 0 ]]; then
        # Match git invocations: target field starts with "git " or "git-" or contains
        # "git log", "git show", "git rev-parse", "git diff" etc. Tool type is Bash.
        # grep -c always prints a count (including 0) and exits 0 on match, 1 on none —
        # `set -u` is fine with exit 1 here since we don't `set -e`.
        git_count=$(grep -cE '"tool":"Bash"[^}]*"target":"[^"]*\\bgit\\b' "$tail_file" 2>/dev/null)
        [[ -z "$git_count" ]] && git_count=0
        git_pct=$((git_count * 100 / total_count))
    fi
    rm -f "$tail_file"
    git_evidence="${git_count}/${total_count} Bash-git calls in last 100 activity entries"
fi

git_verdict="PASS"
[[ "$git_pct" -gt 20 ]] && git_verdict="WARN"
[[ "$git_pct" -gt 40 ]] && git_verdict="FAIL"

# ── Aggregate top-level verdict for exit code ───────────────────────────────
overall=0
for v in "$haiku_verdict" "$narr_verdict" "$git_verdict"; do
    case "$v" in
        WARN) [[ $overall -lt 1 ]] && overall=1 ;;
        FAIL) overall=2 ;;
    esac
done

# ── Emit JSON ───────────────────────────────────────────────────────────────
# Escape " in evidence strings — simple sed is enough for our controlled inputs
esc() { printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g; s/"/\\\\"/g'; }

cat <<JSON
{"project":"$(esc "$ROOT")","generated_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","probes":{"haiku_fails":{"value":$haiku_fails,"verdict":"$haiku_verdict","threshold":"warn>=3 fail>=8","evidence":"$(esc "$haiku_evidence")","waste_class":"defects"},"narrative_age_sec":{"value":$narrative_age,"verdict":"$narr_verdict","threshold":"warn>1800 fail>3600","evidence":"$(esc "$narrative_evidence")","waste_class":"waiting"},"git_spawn_pct":{"value":$git_pct,"verdict":"$git_verdict","threshold":"warn>20% fail>40%","evidence":"$(esc "$git_evidence")","waste_class":"motion"}},"overall_exit":$overall}
JSON

exit $overall

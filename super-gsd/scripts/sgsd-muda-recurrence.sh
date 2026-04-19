#!/usr/bin/env bash
# ============================================================================
# sgsd-muda-recurrence — kill-condition instrumentation for the MUDA skill
# ============================================================================
# Counts how often each waste class recurs across a milestone's phase audits.
# Per DLB-02: if no waste class recurs across 2 consecutive milestones, the
# MUDA skill is flagged for retirement. This script produces the signal the
# user needs to honour that kill condition — it does NOT auto-retire anything.
#
# Data sources:
#   * .planning/metrics/muda-log.jsonl — one line per sgsd-muda-audit run,
#     with phase + per-probe verdicts.
#   * .planning/phases/<NN>-<slug>/WASTE.md — optional richer source (frontmatter
#     only), read when --from-files is passed.
#   * .planning/STATE.md frontmatter — determines active milestone scope.
#
# Usage:
#   sgsd-muda-recurrence.sh                          → JSON over current milestone
#   sgsd-muda-recurrence.sh --milestone v1.1         → explicit scope
#   sgsd-muda-recurrence.sh --window-ms 2            → look at last 2 milestones
#   sgsd-muda-recurrence.sh --kill-check             → human summary + kill-condition
#   sgsd-muda-recurrence.sh --from-files             → prefer WASTE.md over muda-log
#   sgsd-muda-recurrence.sh --project PATH           → override auto-detected root
#
# Exit codes:
#   0 — signal healthy (recurrence present OR window too short to decide)
#   1 — kill condition triggered (2+ consecutive milestones with zero
#        recurrence of any waste class — MUDA not earning its keep)
#   3 — usage error / no data
# ============================================================================

set -u

PROJECT=""
MILESTONE=""
WINDOW_MS=1
KILL_CHECK=false
FROM_FILES=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --project|-p)    PROJECT="$2"; shift 2 ;;
        --milestone|-m)  MILESTONE="$2"; shift 2 ;;
        --window-ms)     WINDOW_MS="$2"; shift 2 ;;
        --kill-check)    KILL_CHECK=true; shift ;;
        --from-files)    FROM_FILES=true; shift ;;
        --help|-h)       head -30 "$0" | tail -25; exit 0 ;;
        *)               echo "sgsd-muda-recurrence: unknown arg: $1" >&2; exit 3 ;;
    esac
done

# Resolve project root
if [[ -z "$PROJECT" ]]; then
    d="$(pwd -P)"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -d "$d/.planning" ]]; then PROJECT="$d"; break; fi
        d="$(dirname "$d")"
    done
fi
if [[ -z "$PROJECT" || ! -d "$PROJECT/.planning" ]]; then
    echo "sgsd-muda-recurrence: no .planning/ found (pass --project PATH)" >&2
    exit 3
fi

STATE="$PROJECT/.planning/STATE.md"
LOG="$PROJECT/.planning/metrics/muda-log.jsonl"

# Resolve active milestone from STATE.md frontmatter if not given
if [[ -z "$MILESTONE" && -f "$STATE" ]]; then
    MILESTONE=$(awk '/^---$/{n++; next} n==1 && /^milestone:/{sub(/^milestone: */,""); gsub(/["'\'']/,""); print; exit}' "$STATE")
fi

if [[ -z "$MILESTONE" ]]; then
    echo "sgsd-muda-recurrence: cannot determine milestone (pass --milestone)" >&2
    exit 3
fi

# Check data source availability
if [[ ! -f "$LOG" && "$FROM_FILES" == false ]]; then
    echo "sgsd-muda-recurrence: no $LOG. Run sgsd-muda-audit at least once, or pass --from-files." >&2
    exit 3
fi

# Dispatch to node for JSON aggregation — portable, handles missing fields,
# avoids bash associative-array dependency.
OUT=$(
    node - <<'NODE' "$PROJECT" "$MILESTONE" "$WINDOW_MS" "$FROM_FILES" "$LOG"
        'use strict';
        const fs = require('fs');
        const path = require('path');

        const [project, milestone, windowMsArg, fromFiles, logPath] = process.argv.slice(2);
        const windowMs = Math.max(1, parseInt(windowMsArg, 10) || 1);
        const useFiles = fromFiles === 'true';

        const classes = ['defects', 'waiting', 'motion'];
        // Map: milestone → { class → count, phasesByClass }
        const milestones = new Map();

        function ensure(ms) {
            if (!milestones.has(ms)) {
                milestones.set(ms, {
                    milestone: ms,
                    classes: Object.fromEntries(classes.map(c => [c, { warn: 0, fail: 0, phases: new Set() }])),
                    audits_run: 0
                });
            }
            return milestones.get(ms);
        }

        // Determine a phase's milestone by looking at its PLAN.md if possible,
        // else fall back to state milestone (today).
        function phaseMilestone(phaseNum) {
            // Find phase dir
            const phasesDir = path.join(project, '.planning', 'phases');
            if (!fs.existsSync(phasesDir)) return milestone;
            const dirs = fs.readdirSync(phasesDir);
            const padded = String(phaseNum).padStart(2, '0');
            const match = dirs.find(n => n === phaseNum || n.startsWith(`${phaseNum}-`) || n.startsWith(`${padded}-`));
            if (!match) return milestone;
            const planFile = path.join(phasesDir, match, `${padded}-01-PLAN.md`);
            if (!fs.existsSync(planFile)) return milestone;
            const body = fs.readFileSync(planFile, 'utf8');
            // Look for milestone: <v> in frontmatter
            const fm = body.match(/^---\n([\s\S]+?)\n---/);
            if (fm) {
                const m = fm[1].match(/^milestone:\s*(.+)$/m);
                if (m) return m[1].trim().replace(/^["']|["']$/g, '');
            }
            return milestone;
        }

        // Parse muda-log.jsonl
        if (!useFiles && fs.existsSync(logPath)) {
            const lines = fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean);
            for (const line of lines) {
                let e;
                try { e = JSON.parse(line); } catch { continue; }
                if (!e.phase) continue;
                const ms = phaseMilestone(e.phase);
                const bucket = ensure(ms);
                bucket.audits_run++;
                for (const [probeName, classKey] of [['haiku', 'defects'], ['narrative', 'waiting'], ['git', 'motion']]) {
                    const v = (e.probes || {})[probeName];
                    if (v === 'WARN') {
                        bucket.classes[classKey].warn++;
                        bucket.classes[classKey].phases.add(e.phase);
                    } else if (v === 'FAIL') {
                        bucket.classes[classKey].fail++;
                        bucket.classes[classKey].phases.add(e.phase);
                    }
                }
            }
        }

        // --from-files: scan every WASTE.md
        if (useFiles) {
            const phasesDir = path.join(project, '.planning', 'phases');
            if (fs.existsSync(phasesDir)) {
                for (const dir of fs.readdirSync(phasesDir)) {
                    const waste = path.join(phasesDir, dir, 'WASTE.md');
                    if (!fs.existsSync(waste)) continue;
                    const body = fs.readFileSync(waste, 'utf8');
                    const fm = body.match(/^---\n([\s\S]+?)\n---/);
                    if (!fm) continue;
                    const phaseMatch = fm[1].match(/^phase:\s*(\S+)/m);
                    if (!phaseMatch) continue;
                    const phaseNum = phaseMatch[1].trim();
                    const ms = phaseMilestone(phaseNum);
                    const bucket = ensure(ms);
                    bucket.audits_run++;
                    // Walk table rows — simple regex match
                    const rows = body.match(/\|\s*(haiku_fails|narrative_age_sec|git_spawn_pct)\s*\|\s*(PASS|WARN|FAIL)\s*\|/g) || [];
                    for (const row of rows) {
                        const m = row.match(/\|\s*(haiku_fails|narrative_age_sec|git_spawn_pct)\s*\|\s*(PASS|WARN|FAIL)\s*\|/);
                        if (!m) continue;
                        const classKey = m[1] === 'haiku_fails' ? 'defects' : m[1] === 'narrative_age_sec' ? 'waiting' : 'motion';
                        if (m[2] === 'WARN') { bucket.classes[classKey].warn++; bucket.classes[classKey].phases.add(phaseNum); }
                        if (m[2] === 'FAIL') { bucket.classes[classKey].fail++; bucket.classes[classKey].phases.add(phaseNum); }
                    }
                }
            }
        }

        // Order milestones by name desc (lexical — v1.1, v1.10 will tie, but good enough)
        const ordered = [...milestones.values()].sort((a, b) => b.milestone.localeCompare(a.milestone, undefined, { numeric: true }));
        // Pick the window
        const window = ordered.slice(0, windowMs).map(m => ({
            milestone: m.milestone,
            audits_run: m.audits_run,
            classes: Object.fromEntries(
                Object.entries(m.classes).map(([k, v]) => [k, {
                    warn: v.warn,
                    fail: v.fail,
                    total: v.warn + v.fail,
                    distinct_phases: [...v.phases].sort()
                }])
            ),
            total_findings: Object.values(m.classes).reduce((s, v) => s + v.warn + v.fail, 0)
        }));

        // Kill-condition check: 2 consecutive milestones with zero total findings
        const consecutive_zero = window.length >= 2 &&
            window[0].total_findings === 0 &&
            window[1].total_findings === 0;

        const active = window[0] || { milestone, audits_run: 0, classes: Object.fromEntries(classes.map(c => [c, { warn: 0, fail: 0, total: 0, distinct_phases: [] }])), total_findings: 0 };

        const result = {
            active_milestone: milestone,
            window_ms: windowMs,
            audits_scanned: window.reduce((s, m) => s + m.audits_run, 0),
            milestones_with_data: window.length,
            per_milestone: window,
            kill_condition: {
                triggered: consecutive_zero,
                rationale: consecutive_zero
                    ? 'Zero recurrence across the last 2 milestones — DLB-02 says retire the MUDA skill.'
                    : window.length < 2
                        ? 'Window too short — need at least 2 milestones of data to trigger the kill check.'
                        : 'Recurrence present in at least one milestone — skill is earning its keep.'
            }
        };

        process.stdout.write(JSON.stringify(result, null, 2));
NODE
)

NODE_EXIT=$?
if [[ $NODE_EXIT -ne 0 || -z "$OUT" ]]; then
    echo "sgsd-muda-recurrence: node aggregator failed (exit $NODE_EXIT)" >&2
    exit 3
fi

if [[ "$KILL_CHECK" == true ]]; then
    # Human-friendly summary instead of JSON
    printf '%s' "$OUT" | node -e '
        let d = "";
        process.stdin.on("data", c => d += c);
        process.stdin.on("end", () => {
            const j = JSON.parse(d);
            console.log("MUDA recurrence — active milestone: " + j.active_milestone);
            console.log("Window: last " + j.window_ms + " milestone(s), " + j.audits_scanned + " audit runs scanned");
            console.log("");
            for (const m of j.per_milestone) {
                const head = m.milestone + " (" + m.audits_run + " audits, " + m.total_findings + " findings)";
                console.log(head);
                for (const [cls, v] of Object.entries(m.classes)) {
                    const status = v.total > 0 ? (v.fail > 0 ? "FAIL" : "WARN") : "clean";
                    console.log("  " + cls.padEnd(9) + " " + status + "  warn=" + v.warn + " fail=" + v.fail + "  phases=" + JSON.stringify(v.distinct_phases));
                }
                console.log("");
            }
            console.log("Kill condition: " + (j.kill_condition.triggered ? "TRIGGERED" : "not triggered"));
            console.log("Rationale: " + j.kill_condition.rationale);
        });
    '
    # Exit code reflects kill verdict
    if printf '%s' "$OUT" | node -e '
        let d = ""; process.stdin.on("data", c => d += c);
        process.stdin.on("end", () => {
            const j = JSON.parse(d);
            process.exit(j.kill_condition.triggered ? 1 : 0);
        });
    '; then exit 0; else exit 1; fi
fi

# Default: emit JSON
printf '%s\n' "$OUT"

# Exit code from kill verdict even in JSON mode (scriptable)
printf '%s' "$OUT" | node -e '
    let d = ""; process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
        const j = JSON.parse(d);
        process.exit(j.kill_condition.triggered ? 1 : 0);
    });
'

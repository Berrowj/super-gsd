#!/usr/bin/env bash
# ============================================================================
# sgsd-intent-check — milestone-close signal for DLB-03 intent continuity
# ============================================================================
# Contrarian's kill-condition from the DLB-03 deliberation: structural
# injection puts `outcome_delivered` text into every executor prompt, but
# agents might still write shallow outcome fields to satisfy the schema
# without carrying real meaning. The kill check is:
#
#   For each milestone: did the injected outcome text actually show up in
#   executor DEVIATIONS / verifier reports? If <50% of phases reference it,
#   the structural injection isn't landing — fix the author discipline
#   (tighten INTENT.md template) or the mechanism itself.
#
# This script produces the measurement. It does NOT auto-retire anything.
#
# Data sources:
#   * .planning/metrics/intent-log.jsonl — per-dispatch injection records
#     (written by sgsd-orchestrate loop step 5.5)
#   * .planning/phases/{NN}/SUMMARY.md — executor DEVIATIONS sections
#   * .planning/phases/{NN}/VERIFICATION.md — verifier output
#   * .planning/phases/{NN}/AUDIT.md — evidence audit findings
#
# Usage:
#   sgsd-intent-check.sh                       → JSON over current milestone
#   sgsd-intent-check.sh --milestone v1.2      → explicit scope
#   sgsd-intent-check.sh --human               → human-readable summary
#   sgsd-intent-check.sh --threshold 50        → exit 2 if coverage < N%
#   sgsd-intent-check.sh --project PATH        → override root
#
# Exit codes:
#   0 — coverage ≥ threshold (injection landing)
#   2 — coverage < threshold (author discipline intervention required)
#   3 — insufficient data (no intent-log entries for this milestone)
# ============================================================================

set -u

PROJECT=""
MILESTONE=""
THRESHOLD=50
HUMAN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --project|-p)    PROJECT="$2"; shift 2 ;;
        --milestone|-m)  MILESTONE="$2"; shift 2 ;;
        --threshold|-t)  THRESHOLD="$2"; shift 2 ;;
        --human)         HUMAN=true; shift ;;
        --help|-h)       head -30 "$0" | tail -25; exit 0 ;;
        *)               echo "sgsd-intent-check: unknown arg: $1" >&2; exit 3 ;;
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
    echo "sgsd-intent-check: no .planning/ found" >&2
    exit 3
fi

# Resolve active milestone if not given
if [[ -z "$MILESTONE" ]]; then
    STATE="$PROJECT/.planning/STATE.md"
    if [[ -f "$STATE" ]]; then
        MILESTONE=$(awk '/^---$/{n++; next} n==1 && /^milestone:/{sub(/^milestone: */,""); gsub(/["'\'']/,""); print; exit}' "$STATE")
    fi
fi
if [[ -z "$MILESTONE" ]]; then
    echo "sgsd-intent-check: cannot determine milestone (pass --milestone)" >&2
    exit 3
fi

OUT=$(
    node - <<'NODE' "$PROJECT" "$MILESTONE" "$THRESHOLD"
        'use strict';
        const fs = require('fs');
        const path = require('path');

        const [project, milestone, thresholdArg] = process.argv.slice(2);
        const threshold = parseInt(thresholdArg, 10) || 50;
        const logPath = path.join(project, '.planning', 'metrics', 'intent-log.jsonl');

        // Load injection log
        const injections = [];
        if (fs.existsSync(logPath)) {
            for (const line of fs.readFileSync(logPath, 'utf8').split(/\r?\n/).filter(Boolean)) {
                try {
                    const j = JSON.parse(line);
                    if (j.milestone === milestone && j.outcome) injections.push(j);
                } catch {}
            }
        }

        if (injections.length === 0) {
            process.stdout.write(JSON.stringify({
                milestone,
                data: 'insufficient',
                reason: 'No intent-log entries for this milestone. Cannot measure coverage.',
                injections: 0,
                phases_checked: 0,
                phases_with_outcome_reference: 0,
                coverage_pct: null
            }, null, 2));
            process.exit(3);
        }

        // Group by phase; we only need one sample of the outcome text per phase
        // since structural injection uses the same outcome across all dispatches
        // within a phase.
        const phaseOutcome = new Map();
        for (const inj of injections) {
            if (!phaseOutcome.has(inj.phase)) phaseOutcome.set(inj.phase, inj.outcome);
        }

        // For each phase, read SUMMARY.md + VERIFICATION.md + AUDIT.md and grep
        // for the literal outcome text (case-insensitive, ignoring whitespace).
        function normaliseForMatch(s) {
            return s.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');
        }

        const phasesDir = path.join(project, '.planning', 'phases');
        const perPhase = [];
        let refCount = 0;

        for (const [phase, outcome] of phaseOutcome.entries()) {
            const needle = normaliseForMatch(outcome);
            // Find phase dir
            const dirs = fs.readdirSync(phasesDir);
            const padded = String(phase).padStart(2, '0');
            const match = dirs.find(n => n === phase || n.startsWith(`${phase}-`) || n.startsWith(`${padded}-`));
            if (!match) continue;
            const phaseDir = path.join(phasesDir, match);

            const sources = ['SUMMARY.md', 'VERIFICATION.md', 'AUDIT.md'];
            const hits = [];
            for (const name of sources) {
                // Allow prefix match on numbered files (e.g. 08-SUMMARY.md)
                const candidates = fs.readdirSync(phaseDir).filter(f =>
                    f === name || f.endsWith(`-${name}`) || f.endsWith(`_${name}`)
                );
                for (const c of candidates) {
                    const body = fs.readFileSync(path.join(phaseDir, c), 'utf8');
                    if (normaliseForMatch(body).includes(needle)) {
                        hits.push(c);
                        break;  // one hit per source file is enough
                    }
                }
            }
            const referenced = hits.length > 0;
            if (referenced) refCount++;
            perPhase.push({
                phase,
                outcome_snippet: outcome.slice(0, 60) + (outcome.length > 60 ? '…' : ''),
                referenced,
                found_in: hits
            });
        }

        const phasesChecked = perPhase.length;
        const coverage = phasesChecked === 0 ? 0 : Math.round((refCount / phasesChecked) * 100);
        const triggered = coverage < threshold;

        process.stdout.write(JSON.stringify({
            milestone,
            injections: injections.length,
            phases_checked: phasesChecked,
            phases_with_outcome_reference: refCount,
            coverage_pct: coverage,
            threshold_pct: threshold,
            kill_condition: {
                triggered,
                rationale: triggered
                    ? `Coverage ${coverage}% < threshold ${threshold}%. Injected outcome text is not being referenced in phase deviation/verifier/audit reports. Either the INTENT.md outcome is shallow, or the structural injection isn't firing consistently. Tighten INTENT.md author discipline or audit the orchestrator's injection logic.`
                    : `Coverage ${coverage}% ≥ threshold ${threshold}%. Structural injection is landing — authors are writing meaningful outcomes and agents are referencing them.`
            },
            per_phase: perPhase
        }, null, 2));
NODE
)
NODE_EXIT=$?

if [[ -z "$OUT" ]]; then
    echo "sgsd-intent-check: node aggregator failed (exit $NODE_EXIT)" >&2
    exit 3
fi

if [[ "$HUMAN" == true ]]; then
    printf '%s' "$OUT" | node -e '
        let d = "";
        process.stdin.on("data", c => d += c);
        process.stdin.on("end", () => {
            const j = JSON.parse(d);
            console.log("Intent coverage — milestone " + j.milestone);
            if (j.data === "insufficient") {
                console.log("  (no intent-log entries — run the orchestrator loop with INTENT.md present first)");
                return;
            }
            console.log("  injections:      " + j.injections);
            console.log("  phases_checked:  " + j.phases_checked);
            console.log("  with_reference:  " + j.phases_with_outcome_reference);
            console.log("  coverage:        " + j.coverage_pct + "% (threshold " + j.threshold_pct + "%)");
            console.log("");
            for (const p of j.per_phase) {
                const status = p.referenced ? "REF ✓" : "miss ✗";
                console.log("  P" + p.phase + "  " + status + "  " + p.outcome_snippet);
                if (p.found_in.length > 0) console.log("           found in: " + p.found_in.join(", "));
            }
            console.log("");
            console.log("Kill condition: " + (j.kill_condition.triggered ? "TRIGGERED" : "not triggered"));
            console.log("Rationale: " + j.kill_condition.rationale);
        });
    '
    if printf '%s' "$OUT" | node -e '
        let d=""; process.stdin.on("data", c => d += c);
        process.stdin.on("end", () => {
            const j = JSON.parse(d);
            process.exit(j.kill_condition && j.kill_condition.triggered ? 2 : 0);
        });
    '; then exit 0; else exit 2; fi
fi

printf '%s\n' "$OUT"

# Exit reflects kill verdict even in JSON mode
printf '%s' "$OUT" | node -e '
    let d=""; process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
        const j = JSON.parse(d);
        if (j.data === "insufficient") process.exit(3);
        process.exit(j.kill_condition && j.kill_condition.triggered ? 2 : 0);
    });
'

#!/usr/bin/env bash
# ============================================================================
# sgsd-distill-milestone — trajectory distillation with triple hallucination gate
# ============================================================================
# Per DLB-04 Q3 (3b-trajectory). Fires at milestone close. Extracts abstract
# reusable principles from a closed milestone's phase trajectories — NOT from
# waste-finding frequency. This structurally outflanks DLB-02's sample-of-one
# critique (which gated finding-counting recurrence, not trajectory grain).
#
# THREE MODES (invoke one at a time):
#
#   1. PREPARE  — gather corpus + emit Codex/local prompt to stdout
#         sgsd-distill-milestone.sh <milestone> [--exclude-phase-type TYPE]
#
#         Orchestrator flow:
#           PROMPT=$(bash sgsd-distill-milestone.sh v1.1 --exclude-phase-type self-audit)
#           OUTPUT_JSON=$(codex/local extractor emits JSON)
#           echo "$OUTPUT_JSON" | bash sgsd-distill-milestone.sh v1.1 --ingest
#
#   2. INGEST   — read extractor output JSON on stdin, apply TRIPLE GATE, route
#         sgsd-distill-milestone.sh <milestone> --ingest
#
#         Gate 1 (Architect):  type=trajectory-hypothesis (never -lesson)
#         Gate 2 (Moonshot):   ≥2 distinct phases cited → hypothesis/;
#                              1 phase → hypothesis/candidate/ (quarantine)
#         Gate 3 (Contrarian): operator novelty rating (mode 3)
#
#   3. RATE     — operator rates each hypothesis 1-3, logs median
#         sgsd-distill-milestone.sh <milestone> --rate
#
#         Appends .planning/metrics/distillation-novelty.jsonl.
#         If median < 2/3 at milestone close → retire this script.
#
# Input JSON format (what the orchestrator pipes to --ingest):
#   [
#     {"slug": "kebab-slug", "title": "Short Title",
#      "principle": "The abstract lesson in 1-2 sentences",
#      "cites": ["01", "03"],
#      "evidence": "Phase 01 did X, Phase 03 did Y with the same outcome"}
#   ]
#
# Output paths (per milestone pass):
#   .planning/memory/trajectory/hypothesis/{ms}-{slug}.md           ← ≥2 cites
#   .planning/memory/trajectory/candidate/{ms}-{slug}.md            ← 1 cite
#   .planning/milestones/{ms}/DISTILL-REQUEST.md   (corpus record)
#   .planning/metrics/distillation-novelty.jsonl   (novelty-rating log)
#
# Kill condition (v1.2 close):
#   If median novelty rating across all hypotheses < 2/3, delete this script.
#   The distilled output is no more useful than a human reading the phase
#   logs directly — the mechanism ships negative value.
# ============================================================================

set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PHASE_NAME_CLI="$SCRIPT_DIR/lib/phase-name.cjs"
MILESTONE=""
MODE="prepare"
EXCLUDE_TYPE=""
ROOT=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --ingest)              MODE="ingest"; shift ;;
        --rate)                MODE="rate"; shift ;;
        --exclude-phase-type)  EXCLUDE_TYPE="$2"; shift 2 ;;
        --root)                ROOT="$2"; shift 2 ;;
        --help|-h)             head -50 "$0" | tail -45; exit 0 ;;
        -*)                    echo "sgsd-distill-milestone: unknown flag: $1" >&2; exit 2 ;;
        *)
            if [[ -z "$MILESTONE" ]]; then
                MILESTONE="$1"
                shift
            else
                echo "sgsd-distill-milestone: extra positional arg: $1" >&2; exit 2
            fi
            ;;
    esac
done

if [[ -z "$MILESTONE" ]]; then
    echo "sgsd-distill-milestone: milestone id required (e.g. v1.1)" >&2
    exit 2
fi

# Resolve root
if [[ -z "$ROOT" ]]; then
    d="$(pwd -P)"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -d "$d/.planning" && -d "$d/.planning/memory" ]]; then
            ROOT="$d"
            break
        fi
        d="$(dirname "$d")"
    done
fi
if [[ -z "$ROOT" || ! -d "$ROOT/.planning" ]]; then
    echo "sgsd-distill-milestone: no .planning/ + .planning/memory/ found. Pass --root." >&2
    exit 3
fi

TREE="$ROOT/.planning/memory/trajectory"
HYP_DIR="$TREE/hypothesis"
CAND_DIR="$TREE/candidate"
MS_DIR="$ROOT/.planning/milestones/$MILESTONE"
NOVELTY_LOG="$ROOT/.planning/metrics/distillation-novelty.jsonl"

mkdir -p "$HYP_DIR" "$CAND_DIR" "$MS_DIR" "$(dirname "$NOVELTY_LOG")"

# ── Helper: list eligible phase dirs (optionally filtered by type) ──
list_phases() {
    local phase_json
    local phase_rows
    if ! phase_json=$(node "$PHASE_NAME_CLI" --list --project "$ROOT" --milestone "$MILESTONE"); then
        echo "sgsd-distill-milestone: phase discovery failed for '$MILESTONE'" >&2
        return 5
    fi
    if ! phase_rows=$(printf '%s' "$phase_json" | node -e '
        const fs = require("fs");
        const path = require("path");
        const rows = JSON.parse(fs.readFileSync(0, "utf8"));
        for (const row of rows) {
            process.stdout.write(row.token + "\t" + row.dir.split(path.sep).join("/") + "\n");
        }
    '); then
        echo "sgsd-distill-milestone: phase discovery response invalid" >&2
        return 5
    fi
    while IFS=$'\t' read -r token pd; do
        [[ -z "$pd" ]] && continue
        local name
        name="$(basename "$pd")"
        # Exclusion: match dir-name suffix against EXCLUDE_TYPE
        # Conservative matcher — "self-audit" excludes "08-sgsd-self-audit" etc.
        if [[ -n "$EXCLUDE_TYPE" && "$name" == *"$EXCLUDE_TYPE"* ]]; then
            continue
        fi
        printf '%s\t%s\n' "$token" "$pd"
    done <<< "$phase_rows"
}

# ── MODE 1: PREPARE ──
if [[ "$MODE" == "prepare" ]]; then
    REQUEST="$MS_DIR/DISTILL-REQUEST.md"
    if ! PHASE_ROWS=$(list_phases); then
        exit 5
    fi
    if [[ -z "$PHASE_ROWS" ]]; then
        echo "sgsd-distill-milestone: no phase data found for '$MILESTONE'" >&2
        exit 4
    fi

    HAS_CORPUS_DATA="false"
    while IFS=$'\t' read -r _token pd; do
        [[ -z "$pd" ]] && continue
        for f in "$pd/"*SUMMARY.md "$pd/"*VERIFICATION.md "$pd/"WASTE.md; do
            if [[ -f "$f" ]]; then
                HAS_CORPUS_DATA="true"
                break 2
            fi
        done
    done <<< "$PHASE_ROWS"
    if [[ "$HAS_CORPUS_DATA" != "true" ]]; then
        echo "sgsd-distill-milestone: no corpus data found for '$MILESTONE'" >&2
        exit 4
    fi

    # Build the corpus: for each eligible phase, concatenate SUMMARY.md +
    # VERIFICATION.md + WASTE.md content headed with the phase name so the
    # model can cite it. Keep it bounded — trim each doc to 400 lines.
    BUILD_CORPUS() {
        while IFS=$'\t' read -r num pd; do
            [[ -z "$pd" ]] && continue
            local name="$(basename "$pd")"
            printf '\n===== PHASE %s (%s) =====\n' "$num" "$name"
            for f in "$pd/"*SUMMARY.md "$pd/"*VERIFICATION.md "$pd/"WASTE.md; do
                [[ -f "$f" ]] || continue
                printf '\n--- %s ---\n' "$(basename "$f")"
                head -400 "$f"
            done
        done
    }

    CORPUS=$(BUILD_CORPUS <<< "$PHASE_ROWS")

    # Emit the extractor prompt to stdout (orchestrator pipes this to Codex/local runner).
    # Also write a record to DISTILL-REQUEST.md for auditability.
    PROMPT=$(cat <<'PROMPT_HEADER'
You are a trajectory-distillation extractor. Your job is to read a corpus of
closed phase narratives (SUMMARY, VERIFICATION, WASTE) and extract abstract
reusable principles — NOT to count waste-class frequencies.

Rules:
1. Each principle must be narrative-grounded. Cite the phase NUMBERS the
   principle appears in (use the "PHASE N" labels in the corpus headers).
2. Each principle must be ONE sentence max in the "principle" field.
3. Include a short evidence string explaining HOW the cited phases demonstrate
   the principle. Do not fabricate — quote or paraphrase the corpus.
4. Emit a JSON array. No prose. No markdown. Nothing outside the JSON.
5. Do NOT output principles that appear in only one phase unless the evidence
   is exceptionally strong; the downstream gate will route single-citation
   entries to a quarantine subdirectory anyway.
6. Prefer 5-10 principles over exhaustiveness. Quality over quantity.

Output schema (strict):
[
  {
    "slug": "kebab-case-short-slug",
    "title": "Short Human Title",
    "principle": "The abstract lesson, 1 sentence.",
    "cites": ["01", "03"],
    "evidence": "Phase 01 did X; Phase 03 did Y. Same principle."
  }
]

CORPUS:
PROMPT_HEADER
)
    printf '%s\n' "$PROMPT"
    printf '%s\n' "$CORPUS"

    # Persist the request for audit
    {
        printf '%s\n' "---"
        printf 'type: distill-request\n'
        printf 'milestone: %s\n' "$MILESTONE"
        printf 'generated_at: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        printf 'exclude_phase_type: %s\n' "${EXCLUDE_TYPE:-none}"
        printf 'phases_included:\n'
        while IFS=$'\t' read -r _token pd; do
            [[ -z "$pd" ]] && continue
            printf '  - %s\n' "$(basename "$pd")"
        done <<< "$PHASE_ROWS"
        printf '%s\n\n' "---"
        printf '# Distillation request for milestone %s\n\n' "$MILESTONE"
        printf 'Prompt (emitted to stdout) + embedded corpus.\n'
        printf 'Orchestrator dispatches Codex/local extraction with this prompt, pipes output JSON to --ingest.\n'
    } > "$REQUEST"

    exit 0
fi

# ── MODE 2: INGEST ──
if [[ "$MODE" == "ingest" ]]; then
    # Read JSON from stdin
    if [[ -t 0 ]]; then
        echo "sgsd-distill-milestone: --ingest expects JSON on stdin" >&2
        exit 2
    fi
    STDIN_JSON="$(cat)"

    # Parse + route via node (portable JSON, no jq dependency).
    # node emits one line per candidate: "{count}\t{slug}\t{title}\t{principle}\t{cites_csv}\t{evidence}"
    ROUTED=$(printf '%s' "$STDIN_JSON" | node -e '
        let d = "";
        process.stdin.on("data", c => d += c);
        process.stdin.on("end", () => {
            try {
                const arr = JSON.parse(d);
                if (!Array.isArray(arr)) { process.stderr.write("expected JSON array"); process.exit(2); }
                for (const h of arr) {
                    const slug = (h.slug || "").trim();
                    const title = (h.title || "").trim();
                    const principle = (h.principle || "").trim();
                    const cites = Array.isArray(h.cites) ? h.cites.map(c => String(c).trim()).filter(Boolean) : [];
                    const evidence = (h.evidence || "").trim();
                    // Dedup cites
                    const uniq = Array.from(new Set(cites));
                    // Skip incomplete records silently — gate 2 routing handles quantity
                    if (!slug || !principle) continue;
                    const esc = s => s.replace(/\t/g, " ").replace(/\n/g, " ");
                    process.stdout.write([uniq.length, slug, esc(title), esc(principle), uniq.join(","), esc(evidence)].join("\t") + "\n");
                }
            } catch (e) {
                process.stderr.write("parse error: " + e.message);
                process.exit(3);
            }
        });
    ')
    NODE_EXIT=$?
    if [[ $NODE_EXIT -ne 0 ]]; then
        echo "sgsd-distill-milestone: JSON parse failed (exit $NODE_EXIT)" >&2
        exit $NODE_EXIT
    fi

    TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    hyp_count=0
    cand_count=0

    while IFS=$'\t' read -r count slug title principle cites evidence; do
        [[ -z "$slug" ]] && continue

        # GATE 1 (Architect): type=trajectory-hypothesis always — never -lesson
        # GATE 2 (Moonshot): ≥2 cites → hypothesis; 1 → candidate quarantine
        if [[ "$count" -ge 2 ]]; then
            OUT_FILE="$HYP_DIR/${MILESTONE}-${slug}.md"
            ROUTE="trajectory-hypothesis"
            hyp_count=$((hyp_count + 1))
        else
            OUT_FILE="$CAND_DIR/${MILESTONE}-${slug}.md"
            ROUTE="candidate (single-citation quarantine)"
            cand_count=$((cand_count + 1))
        fi

        # Skip overwrite
        if [[ -e "$OUT_FILE" ]]; then
            echo "sgsd-distill-milestone: $OUT_FILE exists — skipping (use a different slug)" >&2
            continue
        fi

        {
            printf '%s\n' "---"
            printf 'type: trajectory-hypothesis\n'
            printf 'milestone: %s\n' "$MILESTONE"
            printf 'slug: %s\n' "$slug"
            printf 'title: %s\n' "$title"
            printf 'confirmed_milestones: [%s]\n' "$MILESTONE"
            printf 'phases_cited: [%s]\n' "$cites"
            printf 'route: %s\n' "$ROUTE"
            printf 'distilled_at: %s\n' "$TS"
            printf 'novelty_rating: unrated\n'
            printf '%s\n\n' "---"
            printf '# %s\n\n' "$title"
            printf '## Principle\n\n%s\n\n' "$principle"
            printf '## Evidence\n\n%s\n\n' "$evidence"
            printf '## Status\n\n'
            if [[ "$count" -ge 2 ]]; then
                printf 'Hypothesis tier — **classifier never reads from here** until cross-milestone\n'
                printf 'confirmation at v1.3 promotes it to `trajectory-lesson/`.\n'
            else
                printf 'Quarantine — single-phase citation failed the two-phase gate.\n'
                printf 'Revisited at v1.3 if a second phase surfaces the same principle.\n'
            fi
        } > "$OUT_FILE.tmp"
        mv "$OUT_FILE.tmp" "$OUT_FILE"
    done <<< "$ROUTED"

    echo "sgsd-distill-milestone: ingested milestone $MILESTONE"
    echo "  Hypothesis tier (≥2 cites): $hyp_count"
    echo "  Candidate quarantine (1 cite): $cand_count"
    echo ""
    echo "Next: bash $0 $MILESTONE --rate"
    echo "  Operator rates each hypothesis 1-3 for novelty."
    echo "  Gate 3 (Contrarian): median < 2/3 at milestone close → retire this script."
    exit 0
fi

# ── MODE 3: RATE ──
if [[ "$MODE" == "rate" ]]; then
    if ! ls "$HYP_DIR"/"${MILESTONE}"-*.md >/dev/null 2>&1; then
        echo "sgsd-distill-milestone: no hypotheses found for $MILESTONE under $HYP_DIR" >&2
        echo "  Did you run --ingest first?" >&2
        exit 4
    fi

    TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    RATER="${USER:-operator}"
    ratings_sum=0
    ratings_count=0

    # Count hypotheses so the user knows what's coming
    hyp_total=$(ls -1 "$HYP_DIR"/"${MILESTONE}"-*.md 2>/dev/null | wc -l)

    echo "=== Novelty rating for milestone $MILESTONE ==="
    echo "Hypotheses to rate: $hyp_total (hypothesis tier only — quarantine skipped)"
    echo ""
    echo "Scale:  1 = obvious (human would already know)"
    echo "        2 = worth logging"
    echo "        3 = genuinely novel insight"
    echo "        s = skip this one"
    echo ""
    echo "Kill condition (Contrarian Gate 3): median < 2/3 → retire the script."
    echo ""
    echo "Tip: on PowerShell, the 'bash' call inherits stdin from the parent shell."
    echo "     If you see no prompt, pipe ratings instead:"
    echo "       echo '3\\n2\\n3\\n3\\n3\\n2\\n3' | bash $0 $MILESTONE --rate"
    echo ""

    for f in "$HYP_DIR"/"${MILESTONE}"-*.md; do
        [[ -f "$f" ]] || continue
        local_slug=$(basename "$f" .md)
        title=$(awk '/^title:/ { sub("^title:[[:space:]]*",""); print; exit }' "$f")
        principle=$(awk '/^## Principle/ { found = 1; next } found && NF { print; exit }' "$f")

        echo "---"
        echo "Hypothesis: $local_slug"
        echo "Title:      $title"
        echo "Principle:  $principle"
        printf "Rating [1-3 or s]: "
        # Read from stdin directly. PowerShell-invoked bash cannot open /dev/tty,
        # so the prior form silently skipped every hypothesis. stdin inheritance
        # from the parent shell works in both interactive terminals and when
        # ratings are piped via echo/heredoc.
        if ! IFS= read -r rating; then
            echo ""
            echo "  (stdin closed — exiting rating loop with $ratings_count rating(s) so far)"
            break
        fi
        # Trim whitespace including Windows CRLF
        rating="${rating//[$'\r\n\t ']/}"
        if [[ "$rating" == "s" || "$rating" == "S" ]]; then
            echo "  skipped"
            continue
        fi
        if [[ ! "$rating" =~ ^[1-3]$ ]]; then
            echo "  invalid input '$rating' — skipped"
            continue
        fi

        # Update frontmatter
        sed "s/^novelty_rating: unrated$/novelty_rating: $rating/" "$f" > "$f.tmp" && mv "$f.tmp" "$f"

        # Append log
        printf '{"ts":"%s","milestone":"%s","hypothesis_id":"%s","novelty_rating":%s,"rater":"%s"}\n' \
            "$TS" "$MILESTONE" "$local_slug" "$rating" "$RATER" >> "$NOVELTY_LOG"

        ratings_sum=$((ratings_sum + rating))
        ratings_count=$((ratings_count + 1))
        echo "  recorded: $rating"
    done

    if [[ $ratings_count -eq 0 ]]; then
        echo "sgsd-distill-milestone: no ratings recorded." >&2
        echo "  If you invoked this from PowerShell and saw no prompts, the script could" >&2
        echo "  not read interactive input. Pipe ratings instead — one per line, 1-3 or s:" >&2
        echo "    printf '3\\n2\\n3\\n3\\n3\\n2\\n3' | bash $0 $MILESTONE --rate" >&2
        exit 5
    fi

    # Median across all ratings recorded for this milestone in the log
    median=$(awk -v ms="$MILESTONE" '
        $0 ~ "\"milestone\":\""ms"\"" {
            if (match($0, /"novelty_rating":[0-9]+/)) {
                r = substr($0, RSTART + 17, RLENGTH - 17)
                vals[++n] = r + 0
            }
        }
        END {
            if (n == 0) { print 0; exit }
            # insertion sort
            for (i = 2; i <= n; i++) {
                v = vals[i]; j = i - 1
                while (j >= 1 && vals[j] > v) { vals[j+1] = vals[j]; j-- }
                vals[j+1] = v
            }
            if (n % 2 == 1) { print vals[(n+1)/2]; exit }
            printf "%.1f\n", (vals[n/2] + vals[n/2+1]) / 2
        }
    ' "$NOVELTY_LOG")

    mean=$(awk -v s="$ratings_sum" -v n="$ratings_count" 'BEGIN { printf "%.2f", s/n }')
    echo ""
    echo "=== Rating summary ==="
    echo "  Rated: $ratings_count hypothesis/es"
    echo "  Mean:  $mean"
    echo "  Median: $median"
    echo ""
    # Gate 3 verdict — a median of 2.0 or above keeps the mechanism; below retires it.
    q4_reopen_needed=false
    verdict="carry"
    awk -v m="$median" 'BEGIN { exit (m+0 < 2.0) ? 0 : 1 }' && {
        echo "  GATE 3 VERDICT: RETIRE sgsd-distill-milestone.sh"
        echo "  Median < 2/3 — hypotheses are not novel enough to justify the script."
        echo "  Per DLB-04 Contrarian kill condition: delete, no iteration, no face-saving."
        verdict="retire"
        q4_reopen_needed=true
    } || {
        echo "  GATE 3 VERDICT: carry to v1.3"
        echo "  Median ≥ 2/3 — hypotheses warrant cross-milestone confirmation at v1.3 close."
    }

    # ── DLB-05 Wave E: Q4 reopen trigger ────────────────────────────────────
    # At v1.3 close, check cross-milestone promotion count. Zero promotions
    # across v1.1 → v1.2 → v1.3 also trips the reopen. Log both conditions
    # so the next deliberation has explicit signal data rather than "operator
    # remembers to reopen."
    if [[ "$MILESTONE" == "v1.3" ]]; then
        v12_hyp_count=$(ls "$HYP_DIR"/v1.2-*.md 2>/dev/null | wc -l)
        promoted_count=$(ls "$TREE/trajectory-lesson"/*.md 2>/dev/null | wc -l)
        if [[ "$promoted_count" -eq 0 && "$v12_hyp_count" -gt 0 ]]; then
            echo ""
            echo "  Q4-REOPEN TRIGGER: zero cross-milestone promotions at v1.3 close"
            echo "  (${v12_hyp_count} v1.2 hypotheses, 0 promoted to trajectory-lesson/)"
            q4_reopen_needed=true
        fi
    fi

    q4_log="$ROOT/.planning/metrics/q4-reopen-check.jsonl"
    mkdir -p "$(dirname "$q4_log")"
    printf '{"ts":"%s","milestone":"%s","median":%s,"n_rated":%s,"verdict":"%s","q4_reopen_needed":%s}\n' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$MILESTONE" "$median" "$ratings_count" "$verdict" "$q4_reopen_needed" >> "$q4_log"

    if [[ "$q4_reopen_needed" == "true" ]]; then
        echo ""
        echo "  ACTION: File a DLB brief to reopen DLB-04 Q3 (continuous distillation) with this data as evidence."
        echo "  Signal logged to: $q4_log"
    fi

    exit 0
fi

echo "sgsd-distill-milestone: unknown mode (how did you get here?)" >&2
exit 99

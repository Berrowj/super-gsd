#!/usr/bin/env bash
# ============================================================================
# make-fixtures.sh — operator recapture for provider-contract fixtures
# ============================================================================
# Regenerates super-gsd/tools/provider-contract/fixtures/{claude,codex}-report.txt
# by running both reviewer providers against fixtures/toy-diff.patch. Run rarely:
# only when the contract version bumps, the toy diff changes, or either provider's
# output drifts. The fixture reports are COMMITTED — contract-check.mjs runs
# deterministically against them without credentials.
#
# Default (no flag): prints provenance of the committed fixtures + recapture
# procedure. This is the common case — operator reads it to understand where
# the fixtures came from and how to refresh them.
#
# --dry-run: echoes the two capture commands that would run, without executing.
#
# --capture: actually invokes the providers.
#   * Codex side: shells out to super-gsd/scripts/codex-exec.sh against the
#     composed prompt. Fully automatable.
#   * Claude side: Agent() is not reachable from a plain bash context (RESEARCH
#     §3 R-2). The script prints the exact slash-command + prompt that the
#     operator must paste into a Claude Code session, then waits for the
#     operator to drop the captured report into fixtures/claude-report.txt.
#
# D-17 soft-fail: if the Codex CLI is missing, writes
# fixtures/codex-report.txt.MISSING and exits 2 (sentinel signals the Phase 14
# verify.mjs invariant to WARN, not fail). Same for Claude side if the operator
# skips capture.
#
# Exit codes:
#   0 — success, both fixture reports present
#   1 — generic failure (prompt compose, IO)
#   2 — soft-fail: at least one CLI absent; .MISSING sentinel written
#
# Usage:
#   make-fixtures.sh                   # default — print provenance + recapture guide
#   make-fixtures.sh --dry-run         # preview commands
#   make-fixtures.sh --capture         # run captures for real
# ============================================================================

set -u

MODE="guide"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)  MODE="dry-run"; shift ;;
        --capture)  MODE="capture"; shift ;;
        --help|-h)  head -40 "$0" | tail -35; exit 0 ;;
        *)          echo "make-fixtures: unknown flag $1" >&2; exit 1 ;;
    esac
done

# ── Root detection (pattern: sgsd-curate.sh:101-126) ────────────────────────
detect_root() {
    local d
    d="$(pwd -P)"
    while [[ "$d" != "/" && "$d" != "" ]]; do
        if [[ -d "$d/.planning" ]]; then echo "$d"; return 0; fi
        d="$(dirname "$d")"
    done
    return 1
}

ROOT="$(detect_root || true)"
if [[ -z "$ROOT" ]]; then
    echo "make-fixtures: could not find project root (.planning/ sentinel) from $(pwd)" >&2
    exit 1
fi

FIX_DIR="$ROOT/super-gsd/tools/provider-contract/fixtures"
TOY_DIFF="$FIX_DIR/toy-diff.patch"
CLAUDE_OUT="$FIX_DIR/claude-report.txt"
CODEX_OUT="$FIX_DIR/codex-report.txt"
CODEX_EXEC="$ROOT/super-gsd/scripts/codex-exec.sh"

if [[ ! -f "$TOY_DIFF" ]]; then
    echo "make-fixtures: missing $TOY_DIFF — cannot capture without ground-truth patch" >&2
    exit 1
fi

# ── Compose the reviewer prompt (shared across both providers) ──────────────
compose_prompt() {
    local tmp
    tmp="$(mktemp -t reviewer-prompt.XXXXXX)"
    {
        echo "You are an SGSD reviewer running the ATC 7-step + 10-point anti-slop checklist."
        echo "Emit EXACTLY the code-reviewer-v1 5-field contract. No prose wrapper, no fences."
        echo ""
        echo "Required fields, one per line prefix:"
        echo "  FINDINGS: <bulleted list, one per line, '- ' prefix>"
        echo "  CRITICAL: <count> — <short list>"
        echo "  WARNINGS: <count> — <short list>"
        echo "  PASS_RATE: <pct>%"
        echo "  ONE_LINER: <single sentence, <= 120 chars>"
        echo ""
        echo "Target diff:"
        echo ""
        cat "$TOY_DIFF"
    } > "$tmp"
    echo "$tmp"
}

# ── Guide mode (default) — print provenance + recapture procedure ───────────
if [[ "$MODE" == "guide" ]]; then
    cat <<'GUIDE'
make-fixtures — provider-contract fixture provenance

The files below are COMMITTED canned reports used by contract-check.mjs:
  fixtures/toy-diff.patch      — ground-truth patch (1 bug + 1 YAGNI + 1 nit)
  fixtures/claude-report.txt   — handcrafted Claude reviewer output
  fixtures/codex-report.txt    — handcrafted Codex reviewer output

Both reports conform to the code-reviewer-v1 5-field contract:
  FINDINGS / CRITICAL / WARNINGS / PASS_RATE / ONE_LINER

Why canned instead of live-captured: Agent() (Claude dispatch) is only available
inside a running Claude Code session, not from `node contract-check.mjs` or this
shell. To keep contract-check.mjs deterministic and credential-free, the reports
are captured once by an operator and committed to the repo.

When to regenerate:
  - code-reviewer-v1 contract bumps (new field, renamed field)
  - toy-diff.patch changes shape (new planted issue, different count)
  - either provider's review prose drifts far enough that parse breaks
  - onboarding a third provider (add its report path + update contract-check.mjs)

Recapture procedure:
  1. bash super-gsd/tools/provider-contract/make-fixtures.sh --dry-run
     (previews the two capture commands)
  2. bash super-gsd/tools/provider-contract/make-fixtures.sh --capture
     - Codex side runs automatically via codex-exec.sh.
     - Claude side prints the slash-command + prompt to paste into Claude Code;
       copy the agent's output into fixtures/claude-report.txt manually.
  3. node super-gsd/tools/provider-contract/contract-check.mjs
     (expect exit 0; JSON summary on stdout)
  4. git add super-gsd/tools/provider-contract/fixtures/*.txt
     git commit -m "chore(14-04): refresh provider-contract fixtures"

Run `make-fixtures.sh --help` for flag reference.
GUIDE
    exit 0
fi

PROMPT_FILE="$(compose_prompt)"
trap 'rm -f "$PROMPT_FILE" 2>/dev/null || true' EXIT

CODEX_CMD="bash \"$CODEX_EXEC\" --prompt-file \"$PROMPT_FILE\" --report-out \"$CODEX_OUT\" --timeout 60 --phase 14 --plan 14-04 --step make-fixtures"
CLAUDE_PASTE_HINT="Paste this into a Claude Code session (agent dispatch), then save the output to: $CLAUDE_OUT

  Agent(subagent_type=\"sgsd-code-reviewer\", prompt=<contents of $PROMPT_FILE>)"

# ── Dry-run mode — echo commands, don't execute ─────────────────────────────
if [[ "$MODE" == "dry-run" ]]; then
    echo "make-fixtures DRY RUN"
    echo ""
    echo "Prompt composed at: $PROMPT_FILE"
    echo "(it bundles reviewer instructions + toy-diff.patch contents)"
    echo ""
    echo "Codex capture (automated):"
    echo "  $CODEX_CMD"
    echo ""
    echo "Claude capture (operator-driven):"
    echo "  $CLAUDE_PASTE_HINT"
    echo ""
    echo "Exit 0 (no side effects)."
    exit 0
fi

# ── Capture mode — run codex-exec.sh for Codex, guide operator for Claude ───
SOFT_FAIL=0

# --- Codex side ---
if [[ ! -x "$CODEX_EXEC" ]]; then
    echo "make-fixtures: codex-exec.sh not executable at $CODEX_EXEC" >&2
    printf '%s\n' "D-17 soft-fail sentinel — codex-exec.sh missing or not executable" > "$CODEX_OUT.MISSING"
    SOFT_FAIL=1
elif ! command -v codex >/dev/null 2>&1; then
    echo "make-fixtures: codex CLI not on \$PATH — emitting .MISSING sentinel (D-17 soft-fail)" >&2
    printf '%s\n' "D-17 soft-fail sentinel — codex CLI absent on \$PATH at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$CODEX_OUT.MISSING"
    SOFT_FAIL=1
else
    echo "make-fixtures: capturing Codex report → $CODEX_OUT"
    eval "$CODEX_CMD"
    codex_rc=$?
    if [[ $codex_rc -ne 0 ]]; then
        echo "make-fixtures: codex-exec.sh exited $codex_rc — writing .MISSING sentinel" >&2
        printf '%s\n' "D-17 soft-fail sentinel — codex-exec.sh exited $codex_rc at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$CODEX_OUT.MISSING"
        SOFT_FAIL=1
    else
        # Clear any stale sentinel
        rm -f "$CODEX_OUT.MISSING" 2>/dev/null || true
    fi
fi

# --- Claude side ---
# Can't dispatch Agent() from here. If the operator already has a fresh
# claude-report.txt, leave it alone. Otherwise print the paste-hint and write
# a .MISSING sentinel so the operator knows capture is still pending.
if [[ -f "$CLAUDE_OUT" ]]; then
    echo "make-fixtures: $CLAUDE_OUT already present — skipping Claude capture"
    echo "  (delete the file first if you want to force recapture)"
else
    echo ""
    echo "make-fixtures: Claude capture requires a Claude Code session (Agent() not reachable from bash)."
    echo ""
    echo "$CLAUDE_PASTE_HINT"
    echo ""
    echo "When done, save the agent output into: $CLAUDE_OUT"
    printf '%s\n' "D-17 soft-fail sentinel — Claude capture pending operator paste at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$CLAUDE_OUT.MISSING"
    SOFT_FAIL=1
fi

if [[ $SOFT_FAIL -eq 1 ]]; then
    echo ""
    echo "make-fixtures: at least one capture is pending (.MISSING sentinel present). Exit 2 (D-17 soft-fail)."
    exit 2
fi

echo ""
echo "make-fixtures: OK — both fixture reports written."
exit 0

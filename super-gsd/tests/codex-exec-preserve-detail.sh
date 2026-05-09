#!/usr/bin/env bash
# Regression: codex-exec.sh must preserve additive FINDINGS_DETAIL rows.
# Uses a fake codex binary so this never calls the network.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
WRAPPER="$ROOT/super-gsd/scripts/codex-exec.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export HOME="$TMP/home"
mkdir -p "$HOME/.local/bin" "$TMP/project/.planning/metrics"

cat > "$HOME/.local/bin/codex" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then echo "codex fake"; exit 0; fi
if [[ "${1:-}" == "login" ]]; then echo "Logged in"; exit 0; fi
if [[ "${1:-}" == "exec" ]]; then
  cat >/dev/null
  printf "%s\n" \
    "noise before contract" \
    "FINDINGS: 9" \
    "CRITICAL: 5" \
    "WARNINGS: 4" \
    "PASS_RATE: 4/10" \
    "ONE_LINER: wrapper must preserve detailed findings" \
    "FINDINGS_DETAIL: [CRITICAL] [dag] plan dependency is wrong at file:12" \
    "FINDINGS_DETAIL: [WARN] [fixture] D-10 acceptance is under-specified at file:34"
  exit 0
fi
echo "unexpected fake codex args: $*" >&2
exit 2
EOF
chmod +x "$HOME/.local/bin/codex"

cat > "$HOME/.local/bin/cmd.exe" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "/c" ]]; then shift; fi
exec "$@"
EOF
chmod +x "$HOME/.local/bin/cmd.exe"

printf "prompt\n" > "$TMP/prompt.md"

PATH="$HOME/.local/bin:/usr/bin:/bin:$PATH" bash "$WRAPPER" \
  --prompt-file "$TMP/prompt.md" \
  --report-out "$TMP/project/report.md" \
  --project "$TMP/project" \
  --phase 156 \
  --plan 156-test \
  --step phase-level-ATC \
  --timeout 10 >/tmp/codex-exec-preserve-detail.out 2>/tmp/codex-exec-preserve-detail.err

grep -q '^FINDINGS_DETAIL: \[CRITICAL\]' "$TMP/project/report.md"
grep -q '^FINDINGS_DETAIL: \[WARN\]' "$TMP/project/report.md"

echo "PASS codex-exec preserves FINDINGS_DETAIL"

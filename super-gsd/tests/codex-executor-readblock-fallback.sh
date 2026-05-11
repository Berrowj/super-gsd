#!/usr/bin/env bash
# Regression: codex-executor must trigger patch fallback even when Codex exits
# 0 and places the Windows read-block failure in stdout/report text.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
WRAPPER="$ROOT/super-gsd/scripts/codex-executor.sh"

TMP="$(mktemp -d "$ROOT/.tmp-codex-executor-readblock.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

export HOME="$TMP/home"
mkdir -p "$HOME/.local/bin" "$TMP/project/.planning/metrics"

cat > "$HOME/.local/bin/codex" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then echo "codex fake"; exit 0; fi
if [[ "${1:-}" == "exec" ]]; then
  prompt="$(cat)"
  if printf '%s' "$prompt" | grep -q 'SGSD Codex patch executor'; then
    cat <<'PATCH'
PATCH_BEGIN
diff --git a/app.txt b/app.txt
index 257cc56..5716ca5 100644
--- a/app.txt
+++ b/app.txt
@@ -1 +1 @@
-old
+new
PATCH_END
REPORT_BEGIN
FILES_CHANGED: app.txt (modified)
VERIFICATION: fake fallback patch
DEVIATIONS: none
BLOCKERS: none
ONE_LINER: applied fallback patch after rc0 read-block
REPORT_END
PATCH
    exit 0
  fi
  echo 'CreateProcessAsUserW failed: error 216 while reading files'
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

printf "old\n" > "$TMP/project/app.txt"
printf "Change app.txt from old to new.\n" > "$TMP/prompt.md"
printf "app.txt\n" > "$TMP/files.txt"
GIT_PROJECT="$TMP/project"
if git --version 2>/dev/null | grep -qi 'windows' && command -v wslpath >/dev/null 2>&1; then
  GIT_PROJECT="$(wslpath -w "$TMP/project" 2>/dev/null || echo "$TMP/project")"
fi
git -C "$GIT_PROJECT" init -q

PATH="$HOME/.local/bin:/usr/bin:/bin:$PATH" bash "$WRAPPER" \
  --prompt-file "$TMP/prompt.md" \
  --report-out "$TMP/project/report.md" \
  --workspace "$TMP/project" \
  --patch-fallback-files "$TMP/files.txt" \
  --phase 156 \
  --plan 156-test \
  --timeout 10

grep -q '^new$' "$TMP/project/app.txt"
grep -q '^SGSD_PATCH_APPLY: success$' "$TMP/project/report.md"
grep -q '"mode":"patch-readpack"' "$TMP/project/.planning/metrics/codex-executor-log.jsonl"
if grep -q 'CreateProcessAsUserW failed' "$TMP/project/report.md"; then
  echo "codex-executor did not replace rc0 read-block report with patch report" >&2
  exit 1
fi

echo "PASS codex-executor rc0 read-block routes to patch fallback"

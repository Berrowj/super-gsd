#!/usr/bin/env bash
# Regression: codex-patch-executor must fail when git cannot apply Codex's
# patch, and must not append a false SGSD_PATCH_APPLY: success line.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd -P)"
WRAPPER="$ROOT/super-gsd/scripts/codex-patch-executor.sh"

TMP="$(mktemp -d "$ROOT/.tmp-codex-patch-fail.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

export HOME="$TMP/home"
mkdir -p "$HOME/.local/bin" "$TMP/project/.planning/metrics"

cat > "$HOME/.local/bin/codex" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then echo "codex fake"; exit 0; fi
if [[ "${1:-}" == "exec" ]]; then
  cat >/dev/null
  cat <<'PATCH'
PATCH_BEGIN
diff --git a/app.txt b/app.txt
index 257cc56..5716ca5 100644
--- a/app.txt
+++ b/app.txt
@@ -1 +1 @@
-not-the-current-file-content
+new
PATCH_END
REPORT_BEGIN
FILES_CHANGED: app.txt (modified)
VERIFICATION: intentionally corrupt patch fixture
DEVIATIONS: none
BLOCKERS: none
ONE_LINER: corrupt patch should fail
REPORT_END
PATCH
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

set +e
PATH="$HOME/.local/bin:/usr/bin:/bin:$PATH" bash "$WRAPPER" \
  --prompt-file "$TMP/prompt.md" \
  --report-out "$TMP/project/report.md" \
  --workspace "$TMP/project" \
  --files "$TMP/files.txt" \
  --phase 156 \
  --plan 156-test \
  --timeout 10
rc=$?
set -e

if [[ "$rc" -eq 0 ]]; then
  echo "codex-patch-executor unexpectedly succeeded on corrupt patch" >&2
  exit 1
fi
grep -q '^old$' "$TMP/project/app.txt"
if grep -q '^SGSD_PATCH_APPLY: success$' "$TMP/project/report.md"; then
  echo "codex-patch-executor wrote false success after apply failure" >&2
  exit 1
fi

echo "PASS codex-patch-executor fails closed on git apply failure"

#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  super-gsd/scripts/chronicle-validate.sh \
    --chronicle <path> --context <path> [--mesh-ledger <path>] [--lenient]
USAGE
}

chronicle=""
context=""
mesh_ledger=""
lenient=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --chronicle)
      chronicle="${2:-}"
      shift 2
      ;;
    --context)
      context="${2:-}"
      shift 2
      ;;
    --mesh-ledger)
      mesh_ledger="${2:-}"
      shift 2
      ;;
    --lenient)
      lenient=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 4
      ;;
  esac
done

if [[ -z "$chronicle" || ! -f "$chronicle" ]]; then
  echo "chronicle file not found: ${chronicle:-<missing>}" >&2
  exit 4
fi

if [[ -z "$context" || ! -f "$context" ]]; then
  echo "context file not found: ${context:-<missing>}" >&2
  exit 4
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
validator="$repo_root/super-gsd/tools/chronicle/validate-chronicle.cjs"
log_file="$repo_root/.planning/metrics/chronicle-validation-log.jsonl"
started_ms="$(node -e 'process.stdout.write(String(Date.now()))')"

cmd=(node "$validator" --chronicle "$chronicle" --context "$context" --repo-root "$repo_root")
if [[ -n "$mesh_ledger" ]]; then
  cmd+=(--mesh-ledger "$mesh_ledger")
fi
if [[ "$lenient" -eq 1 ]]; then
  cmd+=(--lenient)
fi

set +e
output="$(timeout 20s "${cmd[@]}" 2>&1)"
exit_code=$?
set -e

ended_ms="$(node -e 'process.stdout.write(String(Date.now()))')"
duration_ms=$((ended_ms - started_ms))

case "$exit_code" in
  0) verdict="REPORT_GROUNDED" ;;
  1) verdict="REPORT_UNGROUNDED" ;;
  2) verdict="REPORT_BROKEN_CITATION" ;;
  3) verdict="REPORT_CONTAMINATED" ;;
  *) verdict="REPORT_FATAL" ;;
esac

phase="$(node -e 'const fs=require("fs"); try{const c=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String(c.phase_id||c.phaseId||c.phase||"unknown"));}catch(e){process.stdout.write("unknown")}' "$context")"
milestone="$(node -e 'const fs=require("fs"); try{const c=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(String(c.milestone_id||c.milestoneId||c.milestone||"unknown"));}catch(e){process.stdout.write("unknown")}' "$context")"

mkdir -p "$(dirname "$log_file")"
node -e '
const row = {
  ts: new Date().toISOString(),
  phase: process.argv[1] || "unknown",
  milestone: process.argv[2] || "unknown",
  verdict: process.argv[3],
  exit_code: Number(process.argv[4]),
  duration_ms: Number(process.argv[5])
};
process.stdout.write(JSON.stringify(row) + "\n");
' "$phase" "$milestone" "$verdict" "$exit_code" "$duration_ms" >> "$log_file"

echo "$verdict"
if [[ -n "$output" ]]; then
  echo "$output" >&2
fi
exit "$exit_code"

#!/usr/bin/env bash
# D-05 #9: parse-rigor fixture runner
# Usage: bash super-gsd/tests/run-parse-fuzz.sh
# Feeds each fixture through a JS validateContract mirror and asserts result.
# exit 0 if all 7 assertions pass; exit 1 if any fail.

set -euo pipefail
FIXTURE_DIR="$(cd "$(dirname "$0")/codex-contract-fixtures" && pwd)"
PASS=0
FAIL=0

# JS validateContract mirror — written to a temp file to avoid shell quoting issues
JS_VALIDATOR_TMP="$(mktemp -t parse-fuzz-validator.XXXXXX.mjs)"
cat > "$JS_VALIDATOR_TMP" << 'JSEOF'
// D-05 #7 validateContract mirror (matches SKILL.md implementation)
import { readFileSync } from 'fs';

function validateContract(c) {
  if (typeof c !== 'string') return { valid: false, missing: ['(not a string)'] };
  const required = ['FINDINGS:', 'CRITICAL:', 'WARNINGS:', 'PASS_RATE:', 'ONE_LINER:'];
  const lines = c.split('\n');
  const missing = required.filter(f => !lines.some(l => l.startsWith(f)));

  const getValue = (p) => {
    const l = lines.find(x => x.startsWith(p));
    return l ? l.slice(p.length).trim() : null;
  };

  for (const f of ['FINDINGS:', 'CRITICAL:', 'WARNINGS:']) {
    const v = getValue(f);
    if (v !== null && !/^\d+$/.test(v)) missing.push(f + '(non-integer value: ' + v + ')');
  }

  const pr = getValue('PASS_RATE:');
  if (pr !== null && !/^\d+\/\d+$/.test(pr)) {
    missing.push('PASS_RATE:(invalid format: ' + pr + ')');
  }

  return { valid: missing.length === 0, missing };
}

const fixturePath = process.argv[2];
const content = readFileSync(fixturePath, 'utf8');
const result = validateContract(content);
console.log(JSON.stringify(result));
JSEOF
trap 'rm -f "$JS_VALIDATOR_TMP"' EXIT

run_validator() {
    local fixture="$1"
    node "$JS_VALIDATOR_TMP" "$fixture"
}

assert_invalid() {
    local fixture="$1"
    local result valid
    result="$(run_validator "$fixture")"
    valid="$(node --input-type=module <<< "import { createRequire } from 'module'; const r = JSON.parse(process.argv[1]); console.log(String(r.valid));" -- "$result" 2>/dev/null || node -e "console.log(String(JSON.parse(process.argv[1]).valid))" -- "$result")"
    if [[ "$valid" == "false" ]]; then
        echo "PASS (parse_failure detected): $(basename "$fixture")"
        PASS=$((PASS + 1))
    else
        echo "FAIL (expected parse_failure, got valid=true): $(basename "$fixture")"
        FAIL=$((FAIL + 1))
    fi
}

assert_valid() {
    local fixture="$1"
    local result valid
    result="$(run_validator "$fixture")"
    valid="$(node -e "console.log(String(JSON.parse(process.argv[1]).valid))" -- "$result")"
    if [[ "$valid" == "true" ]]; then
        echo "PASS (valid contract accepted): $(basename "$fixture")"
        PASS=$((PASS + 1))
    else
        echo "FAIL (expected valid, got invalid): $(basename "$fixture") -- missing: $(node -e "console.log(JSON.parse(process.argv[1]).missing.join(', '))" -- "$result")"
        FAIL=$((FAIL + 1))
    fi
}

assert_valid   "$FIXTURE_DIR/ok.txt"
assert_invalid "$FIXTURE_DIR/missing-field.txt"
assert_invalid "$FIXTURE_DIR/non-integer-findings.txt"
assert_invalid "$FIXTURE_DIR/wrong-pass-rate.txt"
assert_valid   "$FIXTURE_DIR/extra-trailing-lines.txt"   # FINDINGS_DETAIL is additive -- must PASS
assert_invalid "$FIXTURE_DIR/empty-report.txt"
assert_invalid "$FIXTURE_DIR/substring-findings.txt"

echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1

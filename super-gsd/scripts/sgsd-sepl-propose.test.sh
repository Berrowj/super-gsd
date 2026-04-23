#!/usr/bin/env bash
# ============================================================================
# sgsd-sepl-propose.test.sh — Unit test for is_major_proposal() detection.
# Covers all 7 D-09 major criteria + 1 minor control. Phase 16 VTP-08b.
#
# The test sources sgsd-sepl-propose.sh to expose is_major_proposal() as a
# callable function. The source-guard sentinel in propose.sh prevents the
# propose flow from firing when BASH_SOURCE[0] != $0.
#
# Exits 0 on all-pass, 1 on any mismatch.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROPOSE_SCRIPT="$SCRIPT_DIR/sgsd-sepl-propose.sh"

if [[ ! -f "$PROPOSE_SCRIPT" ]]; then
    echo "FAIL: propose script not found at $PROPOSE_SCRIPT"
    exit 1
fi

# shellcheck source=/dev/null
source "$PROPOSE_SCRIPT"

if ! declare -F is_major_proposal >/dev/null; then
    echo "FAIL: is_major_proposal not defined after sourcing $PROPOSE_SCRIPT"
    exit 1
fi

FAILURES=0

assert_major() {
    local label="$1" expected="$2" actual="$3"
    if [[ "$actual" != "$expected" ]]; then
        echo "FAIL [$label]: expected '$expected', got '$actual' (reason=${MAJOR_REASON:-unset})"
        FAILURES=$((FAILURES + 1))
    else
        echo "PASS [$label] (reason=${MAJOR_REASON:-none})"
    fi
}

# Body scan file used by criteria 6 + 7
BODY_SCAN_FILE="$(mktemp)"
trap 'rm -f "$BODY_SCAN_FILE"' EXIT

reset_fixture() {
    TYPE=""
    TARGET=""
    MAJOR_REASON=""
    : > "$BODY_SCAN_FILE"
}

# --- Fixture 1: orchestrator loop ---
reset_fixture
TYPE="skill"
TARGET="super-gsd/skills/sgsd-orchestrate/SKILL.md"
assert_major "criterion-1-orchestrator" "true" "$(is_major_proposal)"

# --- Fixture 2: dispatch rules ---
reset_fixture
TYPE="doc"
TARGET="CLAUDE-OVERLAY.md"
assert_major "criterion-2-dispatch" "true" "$(is_major_proposal)"

# --- Fixture 3: new skill file ---
reset_fixture
TYPE="skill"
TARGET="super-gsd/skills/sgsd-nonexistent-thing/SKILL.md"  # does not exist
assert_major "criterion-3-new-skill" "true" "$(is_major_proposal)"

# --- Fixture 4: any agent-typed proposal ---
reset_fixture
TYPE="agent"
TARGET="custom-gsd-extract/claude-agents/gsd-newagent.md"
assert_major "criterion-4-agent" "true" "$(is_major_proposal)"

# --- Fixture 5: new hook ---
reset_fixture
TYPE="script"
TARGET="super-gsd/hooks/my-new-hook-xyz.sh"  # does not exist
assert_major "criterion-5-new-hook" "true" "$(is_major_proposal)"

# --- Fixture 6: new workflow.* config key ---
reset_fixture
TYPE="config"
TARGET=".planning/config.json"
printf '%s\n' "workflow.new_key: true" > "$BODY_SCAN_FILE"
assert_major "criterion-6-new-config" "true" "$(is_major_proposal)"

# --- Fixture 7: cross-phase body reference ---
reset_fixture
TYPE="doc"
TARGET="docs/something-unrelated.md"
printf '%s\n' "This touches Phase 14 and Phase 15 and Phase 16" > "$BODY_SCAN_FILE"
assert_major "criterion-7-cross-phase" "true" "$(is_major_proposal)"

# --- Control: minor script tweak (should NOT trigger any criterion) ---
reset_fixture
TYPE="script"
TARGET="super-gsd/scripts/sgsd-sepl-propose.test.sh"  # exists; not a hook path; not orchestrator
printf '%s\n' "small inline tweak to existing echo statement" > "$BODY_SCAN_FILE"
assert_major "control-minor" "false" "$(is_major_proposal)"

if [[ "$FAILURES" -gt 0 ]]; then
    echo ""
    echo "FAIL: $FAILURES test case(s) failed"
    exit 1
fi

echo ""
echo "PASS: all 8 test cases (7 major + 1 control) passed"
exit 0

---
phase: 12-machinery
plan: 06
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/scripts/patch-gsd-tools-known-keys.sh
  - super-gsd/README.md
  - .planning/phases/12-machinery/plans/12-06-SUMMARY.md
autonomous: true
requirements:
  - ERG-02

# v2 schema self-referential frontmatter
schema_version: 2
expected_ATC_tier: LITE
skip_gates: []
tasks:
  - id: 12-06-01
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/patch-gsd-tools-known-keys.sh
    input_contract: |
      12-CONTEXT.md D-19..D-21 — idempotent bash installer that patches `KNOWN_TOP_LEVEL`
      in the cross-repo `~/.claude/get-shit-done/bin/lib/core.cjs` (lines 322-331 confirmed
      via research) to include 7 SGSD v2 top-level keys: safety, model_routing,
      token_efficiency, deliberation, atc, browser_verify, overwatcher.
      12-RESEARCH.md §Q8 — full ~80-line Node-in-bash recipe provided:
      - `set -euo pipefail`; flags: `--dry-run`, `-y|--yes`, `-h|--help`
      - Locate core.cjs via `command -v gsd-tools` fallback to `~/.claude/get-shit-done/bin/lib/core.cjs`
      - Cross-repo probe: `git -C "$CORE_DIR" rev-parse --show-toplevel`; notice if different repo
      - Node-in-bash patcher (avoids sed/awk portability pain; node already a dep)
      - Idempotency: if all 7 keys already present → `ALREADY_PATCHED` exit 0
      - Anchor regex: `^(\s*)('git', 'workflow', 'planning', 'hooks', 'features',)(\s*)$`
      - ANCHOR_NOT_FOUND emits exit 2 if anchor line is absent (upstream drift)
      - `.bak` backup written BEFORE file mutation
      - Post-patch verify re-parses for all 7 keys
      - Final message reminds operator to commit in the separate repo
      10-03-01-cross-repo-probe.yaml confirms `repo_status: separate` (core.cjs is in
      C:/Users/jack.berrow/.claude, GSDedits is in C:/Users/jack.berrow/GSDedits) — so the
      script's cross-repo notice path WILL fire.
      Research §Portability note: bash (not sh). WSL, mac, Linux all have bash. Node is a
      dep regardless because core.cjs is a Node file.
    output_contract: |
      `super-gsd/scripts/patch-gsd-tools-known-keys.sh` exists as an executable bash script
      (shebang `#!/usr/bin/env bash`; file mode +x). Script implements §Q8 recipe:
      - `set -euo pipefail` at top
      - `--dry-run`, `-y|--yes`, `-h|--help` flag parsing
      - core.cjs locator with `command -v gsd-tools` + fallback
      - cross-repo probe that emits a notice when outside GSDedits (no auto-commit)
      - Node patcher embedded via heredoc; runs via `node -e`
      - 7 keys: safety, model_routing, token_efficiency, deliberation, atc, browser_verify, overwatcher
      - Idempotency check returns `ALREADY_PATCHED` exit 0 when all 7 keys already present
      - `ANCHOR_NOT_FOUND` exit 2 when anchor line absent (upstream regression guard)
      - `.bak` backup written BEFORE any mutation (rollback-safe)
      - Post-patch verify re-reads core.cjs and asserts all 7 keys present
      Measurable invariants:
      - `test -x super-gsd/scripts/patch-gsd-tools-known-keys.sh` → exit 0 (executable)
      - `bash -n super-gsd/scripts/patch-gsd-tools-known-keys.sh` → exit 0 (syntax valid)
      - `grep -c "safety\|model_routing\|token_efficiency\|deliberation\|atc\|browser_verify\|overwatcher" super-gsd/scripts/patch-gsd-tools-known-keys.sh` ≥ 7 (all 7 keys present)
      - `grep -q "ANCHOR_NOT_FOUND" super-gsd/scripts/patch-gsd-tools-known-keys.sh` → exit 0 (drift-detect)
      - `grep -q "\.bak" super-gsd/scripts/patch-gsd-tools-known-keys.sh` → exit 0 (backup logic)
      - `grep -q "ALREADY_PATCHED" super-gsd/scripts/patch-gsd-tools-known-keys.sh` → exit 0 (idempotency)
      Dry-run smoke test: `bash super-gsd/scripts/patch-gsd-tools-known-keys.sh --dry-run`
      MUST exit 0 regardless of host state (read-only on core.cjs; does not modify the
      cross-repo file in test harness).
    hypothesis: |
      Node-in-bash avoids sed/awk cross-platform pain (research §Q8 rationale: BSD vs GNU
      sed `-i` + escape rules). Node is already a dep because core.cjs IS a Node file.
      Exact-match anchor regex `('git', 'workflow', 'planning', 'hooks', 'features',)`
      pins to the current line shape; if upstream inserts a new key, ANCHOR_NOT_FOUND
      fires with exit 2 — operator sees a specific error and can hand-apply. `.bak`
      backup gives trivial rollback (`mv core.cjs.bak core.cjs`).
    falsifier: |
      (a) Script not executable (missing +x bit).
      (b) `bash -n` fails (syntax error).
      (c) Any of the 7 keys missing from the script body.
      (d) No `ANCHOR_NOT_FOUND` branch (upstream drift silently corrupts file).
      (e) No `.bak` write before mutation (rollback-unsafe).
      (f) No `ALREADY_PATCHED` exit-0 path (idempotency broken).
      (g) Dry-run mode writes to core.cjs (should be read-only — V5 threat: tampering).
      (h) Script uses sed/awk instead of Node patcher (research recommendation ignored; 
      operator may see portability failure on different host OS).
    stop_rule: |
      File exists and is executable; `bash -n` clean; all 7 keys grep-present; 3 safety
      markers (ANCHOR_NOT_FOUND, .bak, ALREADY_PATCHED) grep-present; `--dry-run` invocation
      exits 0 without modifying core.cjs.
    verification_cmd: |
      test -x super-gsd/scripts/patch-gsd-tools-known-keys.sh && bash -n super-gsd/scripts/patch-gsd-tools-known-keys.sh && grep -q "safety" super-gsd/scripts/patch-gsd-tools-known-keys.sh && grep -q "model_routing" super-gsd/scripts/patch-gsd-tools-known-keys.sh && grep -q "token_efficiency" super-gsd/scripts/patch-gsd-tools-known-keys.sh && grep -q "deliberation" super-gsd/scripts/patch-gsd-tools-known-keys.sh && grep -q "atc" super-gsd/scripts/patch-gsd-tools-known-keys.sh && grep -q "browser_verify" super-gsd/scripts/patch-gsd-tools-known-keys.sh && grep -q "overwatcher" super-gsd/scripts/patch-gsd-tools-known-keys.sh && grep -q "ANCHOR_NOT_FOUND" super-gsd/scripts/patch-gsd-tools-known-keys.sh && grep -q "\.bak" super-gsd/scripts/patch-gsd-tools-known-keys.sh && grep -q "ALREADY_PATCHED" super-gsd/scripts/patch-gsd-tools-known-keys.sh && bash super-gsd/scripts/patch-gsd-tools-known-keys.sh --dry-run
    verification_gates:
      - "script is executable (chmod +x) → exit 0"
      - "bash -n syntax check → exit 0"
      - "all 7 keys grep-present → 7 successful greps"
      - "ANCHOR_NOT_FOUND / .bak / ALREADY_PATCHED markers grep-present → exit 0"
      - "bash script --dry-run → exit 0 (read-only, no core.cjs mutation)"

  - id: 12-06-02
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/README.md
      - .planning/phases/12-machinery/plans/12-06-SUMMARY.md
    input_contract: |
      12-CONTEXT.md D-21 — document the patch script in `super-gsd/README.md` (or create
      `super-gsd/docs/INSTALL-NOTES.md` if README is the wrong surface; per research §Q8
      recommendation README is acceptable).
      Research §Q8 recommended 10-line documentation: "Post-install: patch gsd-tools
      KNOWN_TOP_LEVEL" section with invocation + separate-repo commit reminder.
      Also produce 12-06-SUMMARY.md recording plan close.
      Note: this task is pure documentation + SUMMARY. No code mutation.
    output_contract: |
      `super-gsd/README.md` gains a "Post-install: patch gsd-tools KNOWN_TOP_LEVEL"
      section (title-exact so the verify grep is unambiguous) containing:
      - One-line explanation of why the patch is needed (7 SGSD v2 top-level keys otherwise
        emit warnings)
      - Invocation: `bash super-gsd/scripts/patch-gsd-tools-known-keys.sh -y`
      - Cross-repo commit reminder (core.cjs is in a separate repo; operator must commit
        there per 10-03-01-cross-repo-probe.yaml)
      - Idempotent note (running twice is safe)
      Measurable invariants:
      - `grep -q "patch-gsd-tools-known-keys.sh" super-gsd/README.md` → exit 0
      - `grep -q "KNOWN_TOP_LEVEL" super-gsd/README.md` → exit 0
      `.planning/phases/12-machinery/plans/12-06-SUMMARY.md` records:
      - ERG-02 closure: script + README section landed
      - Idempotency contract honored (D-20): script exits 0 on second run
      - Cross-repo status per 10-03-01-cross-repo-probe.yaml (separate; operator-commit)
      - Commit SHAs
      - Wave 1 peers (12-01, 12-05 also landed in Wave 1)
    hypothesis: |
      README surface is the natural home for one-time post-install steps (research §Q8
      recommendation). Operators running `super-gsd` for the first time scan README;
      adding a titled section makes this surface discoverable without burying in a
      separate docs/ file. The invocation + separate-repo reminder matches the
      operator-action context captured in 10-03-01-cross-repo-probe.yaml.
    falsifier: |
      (a) README.md missing the section title or invocation line.
      (b) README.md references a different script name (typo — would break user invocations).
      (c) 12-06-SUMMARY.md absent.
      (d) SUMMARY doesn't record cross-repo status (D-19/10-03-01 context lost).
      (e) Task attempts to modify the script itself (scope — that's 12-06-01).
    stop_rule: |
      README contains both greppable markers; SUMMARY exists and references ERG-02 closure
      + cross-repo commit guidance.
    verification_cmd: |
      grep -q "patch-gsd-tools-known-keys.sh" super-gsd/README.md && grep -q "KNOWN_TOP_LEVEL" super-gsd/README.md && test -f .planning/phases/12-machinery/plans/12-06-SUMMARY.md && grep -q "ERG-02" .planning/phases/12-machinery/plans/12-06-SUMMARY.md && grep -q "cross-repo\|separate repo" .planning/phases/12-machinery/plans/12-06-SUMMARY.md
    verification_gates:
      - "README.md references script name → exit 0"
      - "README.md references KNOWN_TOP_LEVEL → exit 0"
      - "12-06-SUMMARY.md exists → exit 0"
      - "SUMMARY records ERG-02 + cross-repo context → exit 0"
    depends_on: [12-06-01]

must_haves:
  truths:
    - "`super-gsd/scripts/patch-gsd-tools-known-keys.sh` exists, is executable, and passes `bash -n` syntax check"
    - "Script contains all 7 SGSD v2 top-level keys: safety, model_routing, token_efficiency, deliberation, atc, browser_verify, overwatcher (grep count >= 7)"
    - "Script emits `ANCHOR_NOT_FOUND` exit 2 when upstream core.cjs anchor line is missing (upstream-drift guard)"
    - "Script writes `.bak` backup BEFORE mutating core.cjs (rollback-safe; V5 threat mitigation)"
    - "Script is idempotent: second run emits `ALREADY_PATCHED` exit 0 (D-20)"
    - "Script uses Node-in-bash patcher (not sed/awk) per research §Q8 portability recommendation"
    - "`bash super-gsd/scripts/patch-gsd-tools-known-keys.sh --dry-run` exits 0 without modifying core.cjs"
    - "`super-gsd/README.md` has a 'Post-install: patch gsd-tools KNOWN_TOP_LEVEL' section with invocation + cross-repo commit reminder (D-21)"
    - "12-06-SUMMARY.md records ERG-02 closure + cross-repo status (per 10-03-01-cross-repo-probe.yaml = separate) + commit SHAs + Wave 1 peer note"
  artifacts:
    - path: "super-gsd/scripts/patch-gsd-tools-known-keys.sh"
      provides: "Idempotent bash installer that patches cross-repo core.cjs KNOWN_TOP_LEVEL Set (ERG-02)"
      contains: "shebang + set -euo pipefail + --dry-run/--yes/-h flags + core.cjs locator + cross-repo probe + Node-in-bash patcher + ANCHOR_NOT_FOUND + .bak backup + ALREADY_PATCHED idempotency + post-patch verify"
    - path: "super-gsd/README.md"
      provides: "Post-install documentation for the patch script (D-21)"
      contains: "'Post-install: patch gsd-tools KNOWN_TOP_LEVEL' section with invocation + cross-repo commit reminder"
    - path: ".planning/phases/12-machinery/plans/12-06-SUMMARY.md"
      provides: "Plan close: ERG-02 closure + cross-repo status + commit SHAs"
      contains: "sections ERG-02 Closure, Cross-Repo Context, Artifacts, Commit SHAs, Wave 1 Peers"
  key_links:
    - from: "super-gsd/scripts/patch-gsd-tools-known-keys.sh"
      to: "C:/Users/jack.berrow/.claude/get-shit-done/bin/lib/core.cjs (cross-repo target)"
      via: "Node-in-bash regex patcher targeting KNOWN_TOP_LEVEL Set"
      pattern: "KNOWN_TOP_LEVEL"
    - from: "super-gsd/README.md"
      to: "super-gsd/scripts/patch-gsd-tools-known-keys.sh"
      via: "Post-install section with invocation example"
      pattern: "patch-gsd-tools-known-keys\\.sh"
    - from: ".planning/phases/10-gate-policy/10-03-01-cross-repo-probe.yaml"
      to: ".planning/phases/12-machinery/plans/12-06-SUMMARY.md"
      via: "repo_status: separate → SUMMARY records operator-commit guidance"
      pattern: "separate"
---

# Plan 12-06: KNOWN_TOP_LEVEL Installer Script (ERG-02)

## Objective

Ship an idempotent bash installer that patches the `KNOWN_TOP_LEVEL` Set in the cross-repo
`~/.claude/get-shit-done/bin/lib/core.cjs` to include the 7 SGSD v2 top-level config keys
(safety, model_routing, token_efficiency, deliberation, atc, browser_verify, overwatcher).
This closes the operator-action blocker emitted by Phase 10's 10-03-04 task (cross-repo
probe confirmed `repo_status: separate`, so GSDedits executors cannot auto-commit).

Purpose: Satisfies **ERG-02** per D-19..D-21. Wave 1 of phase 12 — parallel with plans
12-01 and 12-05 (verified disjoint file sets: this plan creates a new script + README
section; touches no SKILL.md).

Output: 1 new script + 1 README edit + 1 SUMMARY. Wave 1 — no dependencies.

## Tasks

Task breakdown follows 12-VALIDATION.md (2 tasks: 12-06-01, 12-06-02).

### 12-06-01 — `patch-gsd-tools-known-keys.sh`

Create the bash installer at `super-gsd/scripts/patch-gsd-tools-known-keys.sh` following
12-RESEARCH.md §Q8 recipe verbatim. Must implement:
- `set -euo pipefail` + flag parsing (`--dry-run`, `-y|--yes`, `-h|--help`)
- core.cjs locator (`command -v gsd-tools` with fallback)
- Cross-repo probe (notice but no auto-commit when outside GSDedits)
- Node-in-bash patcher (embedded heredoc; avoids sed/awk portability issues per §Q8)
- All 7 keys in `NEW_KEYS` array
- `ALREADY_PATCHED` exit 0 on idempotency (D-20)
- `ANCHOR_NOT_FOUND` exit 2 on upstream drift
- `.bak` backup BEFORE mutation (V5 threat mitigation)
- Post-patch verify re-reads and asserts all 7 keys
- Final message reminds operator to commit in the separate repo

Script must be executable (`chmod +x`) and pass `bash -n` syntax check.

### 12-06-02 — `super-gsd/README.md` section + 12-06-SUMMARY.md

Add a "Post-install: patch gsd-tools KNOWN_TOP_LEVEL" section to `super-gsd/README.md`
per D-21: one-line explanation + invocation + cross-repo commit reminder + idempotent
note. Produce 12-06-SUMMARY.md recording:
- ERG-02 closure (script + README landed)
- Idempotency contract (D-20)
- Cross-repo status from 10-03-01-cross-repo-probe.yaml (separate; operator-commit)
- Commit SHAs
- Wave 1 peer note (12-01 and 12-05 also Wave 1 parallel).

## Verification Gates (Wave close)

1. `test -x super-gsd/scripts/patch-gsd-tools-known-keys.sh` → exit 0 (executable)
2. `bash -n super-gsd/scripts/patch-gsd-tools-known-keys.sh` → exit 0 (valid syntax)
3. All 7 keys grep-present in script → 7 successful greps
4. `grep -q "ANCHOR_NOT_FOUND" ...sh` → exit 0 (drift-detect)
5. `grep -q "\\.bak" ...sh` → exit 0 (backup)
6. `grep -q "ALREADY_PATCHED" ...sh` → exit 0 (idempotency)
7. `bash ...sh --dry-run` → exit 0 (read-only confirmation)
8. `grep -q "patch-gsd-tools-known-keys.sh" super-gsd/README.md` → exit 0
9. `grep -q "KNOWN_TOP_LEVEL" super-gsd/README.md` → exit 0
10. `test -f 12-06-SUMMARY.md` → exit 0
11. SUMMARY records ERG-02 + cross-repo context → grep exit 0

## Success Criteria

- Script is executable, bash-n clean, and passes `--dry-run` without mutation.
- All 7 keys, 3 safety markers (ANCHOR_NOT_FOUND, .bak, ALREADY_PATCHED) present.
- README section discoverable and references correct script name.
- SUMMARY records ERG-02 closure and cross-repo operator-action context.
- Wave 1 peer-plan landing coordination noted.

## Output

`12-06-SUMMARY.md` with sections: ERG-02 Closure, Cross-Repo Context (separate repo per
10-03-01 probe), Artifacts (script + README section), Commit SHAs (one per 12-06-0N
task), Wave 1 Peers (12-01 classifier-cache + 12-05 ERG-01 warnings).

Per research Risk 4: anchor regex is exact-match. If core.cjs is updated upstream (new
key in the anchor line), the script exits 2 `ANCHOR_NOT_FOUND` — operator sees specific
error and can hand-apply. `.bak` backup makes rollback trivial (`mv core.cjs.bak core.cjs`).
Phase 12's verify.mjs invariants 12+13 (added in plan 12-04) assert script existence +
syntax-parse + double-run idempotency against a fixture core.cjs copy — no risk of CI
corruption.

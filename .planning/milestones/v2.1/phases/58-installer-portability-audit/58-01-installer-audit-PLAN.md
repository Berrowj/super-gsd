---
schema_version: 2
phase: 58
plan: 1
type: execute
wave: 1
model: sonnet
expected_ATC_tier: FULL
depends_on: []
autonomous: true
prior_errors_lookup: true
skip_gates: []
lessons_path: null
files_modified:
  - super-gsd/tools/installer-audit/audit.cjs
  - super-gsd/tools/installer-audit/run-self-test.cjs
  - super-gsd/tools/installer-audit/clean-room.sh
  - super-gsd/scripts/sgsd-complete-milestone.cjs
  - .planning/milestones/v2.1/INSTALLER-AUDIT.md
requirements:
  - INSTALLER-AUDIT-01
  - INSTALLER-AUDIT-02
  - INSTALLER-AUDIT-03
  - INSTALLER-AUDIT-04
  - V2-1-FIRST-GATE-01
tags:
  - installer-audit
  - 12-probe-set
  - read-only-fingerprint
  - clean-room-walk
  - first-gate-v2.1
  - phase-58
  - v2.1
tasks:
  - id: T1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/tools/installer-audit/audit.cjs
      - super-gsd/tools/installer-audit/run-self-test.cjs
      - super-gsd/tools/installer-audit/clean-room.sh
    input_contract: 58-CONTEXT.md + 58-RESEARCH.md + Phase 55 provider-circuit module pattern + Phase 57 release-readiness self-test pattern (mirror; never imported)
    output_contract: audit.cjs (~600L) with 4 Lock-13 wrapped public APIs (runAudit, getProbe, selfTest, _internals) + frozen PROBE_NAMES (>=9 probes; shipped 12) + frozen SOURCE_VALUES + frozen REASON_NOTES + 8-12 self-test assertions (shipped 12) covering shape, frozen surfaces, Lock 13 never-throws, READ-ONLY invariant, ASCII-only; run-self-test.cjs thin shell delegating via spawnSync; clean-room.sh (~150L) running 9 install-walk steps in mktemp tmpdir with per-step duration_ms + outcome enum (auto|prompt|skip|error)
    hypothesis: A frozen PROBE_NAMES array of length >=9 with closed-vocab SOURCE_VALUES and REASON_NOTES, plus a self-test that enforces READ-ONLY (zero fs mutation primitives in code-only scan), gives a deterministic environment fingerprint that the v2.1 first-gate can rely on without any probe ever throwing.
    falsifier: If --self-test exits non-zero OR PROBE_NAMES.length < 9 OR any probe shape differs from {name, ok, version, source, note} OR audit.cjs source contains any fs.writeFileSync / fs.appendFileSync / fs.unlinkSync / fs.mkdirSync / fs.rmSync / fs.rmdirSync, the contract is broken.
    stop_rule: node super-gsd/tools/installer-audit/audit.cjs --self-test exits 0 with all 8-12 assertions PASS green AND --run reports >=9 probes AND clean-room.sh exits 0 with steps logged.
    verification_cmd: "node super-gsd/tools/installer-audit/audit.cjs --self-test"
  - id: T2
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/sgsd-complete-milestone.cjs
    input_contract: existing sept-gate sgsd-complete-milestone.cjs from Phase 57 + audit.cjs from T1
    output_contract: sgsd-complete-milestone.cjs extended with a v2.1 first-gate (installer-audit selfTest + runAudit summary check) at a NEW dispatch branch BEFORE the existing v1.9/v2.0 no-op fallthrough; v1.9 dual-gate path + Phase 53/54/55/56/57 sept-gate paths preserved byte-equality up to their existing insertion points
    hypothesis: A surgical extension that runs ONLY when milestone === 'v2.1' AND returns from its own branch preserves all earlier gate invariants while adding the installer-audit as the first-gate (v2.1 close prerequisite).
    falsifier: If running --milestone v1.9 changes any observable output vs the Phase 57 baseline OR if --milestone v2.0 changes any observable output OR if --milestone v2.1 fails to exit 0 when audit.cjs is green AND mandatory_floor_met===true, the contract is broken.
    stop_rule: node sgsd-complete-milestone.cjs --milestone v2.1 exits 0 with first-gate green AND --milestone v1.9 + --milestone v2.0 still exit 0 (no regression).
    verification_cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1"
  - id: T3
    agent: gsd-executor
    model: sonnet
    files_touched:
      - .planning/milestones/v2.1/INSTALLER-AUDIT.md
      - .planning/milestones/v2.1/phases/58-installer-portability-audit/58-RESEARCH.md
      - .planning/milestones/v2.1/phases/58-installer-portability-audit/58-VERIFICATION.md
      - .planning/milestones/v2.1/phases/58-installer-portability-audit/WASTE.md
      - .planning/milestones/v2.1/phases/58-installer-portability-audit/commit-reviews.jsonl
      - .planning/STATE.md
    input_contract: T1+T2 implementations green
    output_contract: INSTALLER-AUDIT.md (probe results table + clean-room friction log + Phase 59 recommendations) + full 58-* artifact set (RESEARCH, VERIFICATION, WASTE) + commit-reviews.jsonl + STATE.md advanced 58->59 with phase_58 PASS row
    hypothesis: Closing the phase with the standard 58-* artifact set AND advancing STATE.md to phase 59 follows the v2.0 phase-close precedent and lands phase 58 as the first of v2.1's 5 phases.
    falsifier: If STATE.md current_phase is not 59 after T3 OR if INSTALLER-AUDIT.md is missing OR if any 58-* artifact is missing, the close contract is broken.
    stop_rule: ls .planning/milestones/v2.1/phases/58-installer-portability-audit/ shows {58-CONTEXT.md, 58-RESEARCH.md, 58-01-...-PLAN.md, 58-VERIFICATION.md, WASTE.md, PHASE-CAPSULE.json, commit-reviews.jsonl} AND v2.1/INSTALLER-AUDIT.md exists AND STATE.md current_phase == 59.
    verification_cmd: "node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v2.1/phases/58-installer-portability-audit/58-01-installer-audit-PLAN.md --mode load"
acceptance:
  - "node super-gsd/tools/installer-audit/audit.cjs --self-test exits 0 with 8-12 PASS green sub-1s"
  - "node super-gsd/tools/installer-audit/audit.cjs --run reports >=9 probes (shipped 12)"
  - "node super-gsd/tools/installer-audit/run-self-test.cjs exits 0 (delegates via spawnSync)"
  - "bash super-gsd/tools/installer-audit/clean-room.sh exits 0 with steps logged in friction format"
  - "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1 exits 0 (first-gate green)"
  - "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9 exits 0 (no regression)"
  - "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0 exits 0 (no regression)"
  - "ASCII-only across audit.cjs, run-self-test.cjs, clean-room.sh, and the sgsd-complete-milestone.cjs delta (first_nonascii_idx === -1)"
  - "Lock 4: git diff --quiet on Phase 41-57 trees post-T3 (only the 4 surgical files + new installer-audit tree changed)"
  - "READ-ONLY invariant on audit.cjs: zero fs mutation primitives reachable in code (self-test A8 enforces)"
threat_model:
  - file: super-gsd/tools/installer-audit/audit.cjs
    surface: spawnSync of external binaries (npm, git, bash, redis-cli, docker, codex, claude, pwsh, powershell.exe) + require.resolve() of better-sqlite3 + readFileSync of __filename (self) + existsSync of .planning + super-gsd anchor
    threats:
      - external binary stdout poisoning -> mitigated by capturing only the first line of stdout for version strings; no parsing beyond split + trim
      - require() of broken module side-effect -> mitigated by using require.resolve (path lookup only, no module load) for better-sqlite3
      - spawnSync timeout hang -> mitigated by 3000-5000ms timeout per probe
      - non-ASCII smuggling in REASON_NOTES -> mitigated by ASCII-only assertion in self-test
      - filesystem mutation slip -> mitigated by READ-ONLY assertion (A8) that scans code-only source for fs.write/append/unlink/mkdir/rm/rmdir tokens
  - file: super-gsd/tools/installer-audit/clean-room.sh
    surface: mktemp tmpdir + rsync/cp -R + mkdir + cp + bash install.sh --dry-run + node audit.cjs --run
    threats:
      - rm -rf cleanup hitting wrong path -> mitigated by signature-prefix safety check (only paths matching */sgsd-cleanroom-* are rm-rf-ed)
      - install.sh side effects leaking outside tmpdir -> mitigated by --dry-run flag (install.sh prints planned actions but does not execute them)
      - tmpdir survives on signal -> mitigated by trap cleanup EXIT INT TERM
      - --keep-tmp leaving litter -> by-design for debug; logs explicit tmpdir path
  - file: super-gsd/scripts/sgsd-complete-milestone.cjs
    surface: milestone-close gate dispatch
    threats:
      - v2.1 gate skipped when audit.cjs require fails -> mitigated by Lock 13 wrap that emits milestone_close_blocked:installer_audit_unavailable + exit 1
      - mandatory floor unmet escapes -> mitigated by in-proc runAudit() snapshot + summary.mandatory_floor_met===true assertion; non-met emits milestone_close_blocked:installer_audit_mandatory_floor_unmet + exit 1
      - regression on v1.9/v2.0 paths -> mitigated by surgical-extension-only contract; v2.1 branch returns BEFORE the v1.9/v2.0 dispatch path is entered; v1.9/v2.0 paths byte-untouched

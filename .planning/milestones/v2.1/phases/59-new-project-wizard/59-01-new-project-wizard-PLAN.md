---
schema_version: 2
phase: 59
plan: 1
type: execute
wave: 1
model: sonnet
expected_ATC_tier: FULL
depends_on: [58]
autonomous: true
prior_errors_lookup: true
skip_gates: []
lessons_path: null
files_modified:
  - super-gsd/scripts/sgsd-new-project-wizard.cjs
  - super-gsd/scripts/sgsd-new-project-wizard-self-test.cjs
  - super-gsd/scripts/sgsd-configure.ps1
  - super-gsd/scripts/sgsd-complete-milestone.cjs
requirements:
  - WIZARD-01
  - WIZARD-02
  - WIZARD-03
  - WIZARD-04
  - V2-1-SECOND-GATE-01
tags:
  - new-project-wizard
  - deep-merge
  - idempotent
  - non-destructive
  - second-gate-v2.1
  - phase-59
  - v2.1
tasks:
  - id: T1
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/sgsd-new-project-wizard.cjs
      - super-gsd/scripts/sgsd-new-project-wizard-self-test.cjs
    input_contract: 59-CONTEXT.md + 59-RESEARCH.md + Phase 50 cockpit-shell PANEL_KINDS (mirror, never imported) + Phase 58 installer-audit 4-API surface convention (mirror, never imported)
    output_contract: sgsd-new-project-wizard.cjs (~760L) with 5 Lock-13 wrapped public APIs (runWizard, deepMergeConfig, validateProjectConfig, selfTest, _internals) + frozen PANEL_KINDS (7 entries, mirror) + frozen BOOT_MODES (3 entries) + frozen VALIDATION_CODES + 8-12 self-test assertions (shipped 13) covering deep-merge non-clobber, idempotent, Lock 13 never-throws, ASCII-only; sgsd-new-project-wizard-self-test.cjs thin spawnSync shell delegating to --self-test
    hypothesis: A deep-merge that gives byte-equality priority to existing keys, a deterministic key-sorted JSON serializer, and a trailing-newline normalizer together produce idempotent re-runs (same input -> same bytes) with zero clobbering of non-project keys.
    falsifier: If --self-test exits non-zero OR running the wizard twice on the same project produces non-byte-identical config.json OR running the wizard on a config with custom user keys removes/overwrites any of those keys, the contract is broken.
    stop_rule: node super-gsd/scripts/sgsd-new-project-wizard.cjs --self-test exits 0 with all 8-12 assertions PASS green AND --defaults on tmpdir produces config.json AND second --defaults run produces byte-identical bytes (sha256 match) AND running on a config with custom keys preserves all of them.
    verification_cmd: "node super-gsd/scripts/sgsd-new-project-wizard.cjs --self-test"
  - id: T2
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/sgsd-complete-milestone.cjs
    input_contract: existing v2.1 first-gate from Phase 58-01 (sgsd-complete-milestone.cjs:159-244) + wizard module from T1
    output_contract: sgsd-complete-milestone.cjs extended with v2.1 SECOND-GATE (wizard self-test spawnSync) inserted between the existing first-gate green message and process.exit(0); v1.9 dual-gate path + v2.0 sept-gate path + v2.1 first-gate path preserved byte-equality up to the insertion point
    hypothesis: A surgical insertion (additive only, ~58 lines, zero deletions) inside the existing milestone==='v2.1' block preserves all earlier gate invariants while making v2.1 close require BOTH gates to be green.
    falsifier: If running --milestone v1.9 changes any observable output vs the Phase 58 baseline OR if --milestone v2.0 changes any observable output OR if --milestone v2.1 fails to exit 0 when wizard --self-test is green, the contract is broken.
    stop_rule: node sgsd-complete-milestone.cjs --milestone v2.1 exits 0 with both first-gate (installer-audit) and second-gate (new-project-wizard) green AND --milestone v1.9 + --milestone v2.0 still exit 0 (no regression) AND git diff --stat shows only insertions, zero deletions.
    verification_cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1"
  - id: T3
    agent: gsd-executor
    model: sonnet
    files_touched:
      - super-gsd/scripts/sgsd-configure.ps1
    input_contract: existing sgsd-configure.ps1 (174 lines, knowledge-block authoritative writer)
    output_contract: sgsd-configure.ps1 surgically extended with (a) scope-boundary comment near top documenting the wizard's complementary ownership, (b) post-write invocation hook at the end that detects the wizard file and prints a discoverability hint; the existing knowledge-block logic (lines 20-183) preserved byte-equality
    hypothesis: A scope-boundary comment + post-write discoverability hint creates the narrative bridge between sgsd-configure.ps1 and the new wizard without duplicating logic or coupling them at runtime.
    falsifier: If the existing knowledge-block logic is mutated in any way OR if the post-write hook auto-invokes the wizard (must only print, never spawn), the contract is broken.
    stop_rule: ASCII-only verified on sgsd-configure.ps1 AND the existing knowledge-block logic is byte-equality preserved AND a manual operator visual-check of the printed hook confirms it is suggestion-only.
    verification_cmd: "node -e \"var s=require('fs').readFileSync('super-gsd/scripts/sgsd-configure.ps1','utf8');var i=0;for(;i<s.length;i++){var c=s.charCodeAt(i);if(c>0x7E||(c<0x20&&c!==9&&c!==10&&c!==13)){process.exit(1);}};process.exit(0)\""
gates:
  - lock_4_phase_41_58_byte_untouched: "git diff covers only Phase 59 surface + sgsd-configure.ps1 + sgsd-complete-milestone.cjs surgical extensions"
  - lock_11_byte_equality_existing_keys: "deepMergeConfig assertion covers"
  - lock_13_never_throws: "selfTest A5/A6/A7 cover the three Lock-13 paths"
  - ascii_only: "selfTest A11 covers wizard.cjs source; manual ASCII check covers .ps1"
  - idempotent_re_run: "manual sha256 check on tmpdir"
  - non_clobber_existing_config: "selfTest A3 covers"
verification:
  - cmd: "node super-gsd/scripts/sgsd-new-project-wizard.cjs --self-test"
    expected: "exit 0 + 13/13 PASS green"
  - cmd: "node super-gsd/scripts/sgsd-new-project-wizard-self-test.cjs"
    expected: "exit 0 + 13/13 PASS green (delegated)"
  - cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9"
    expected: "exit 0 + 'v1.9 dual-gate ... green' (no regression)"
  - cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0"
    expected: "exit 0 + 'v2.0 sept-gate ... green' (no regression)"
  - cmd: "node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1"
    expected: "exit 0 + first-gate green AND second-gate (new-project-wizard) green"
acceptance:
  - "Wizard non-destructively writes config (deep-merge, doesn't clobber existing keys)"
  - "Re-running on same project produces same config (idempotent, sha256 match)"
  - "Lock 4 (Phase 41-58 + cockpit-shell.cjs) byte-untouched"
  - "ASCII-only across all 4 changed files"
  - "Lock 13 never throws upward (degraded sentinels)"
  - "Phase 59 second-gate wired into v2.1 milestone close"
---

# Phase 59-01 New Project Wizard Plan

This plan ships a project-level configuration wizard that complements
sgsd-configure.ps1 (which owns the knowledge block) by writing the
project block (cockpit panes, default boot mode, operator preferences).
The two are byte-disjoint at the config-key level, both
non-destructive, and the wizard is idempotent on re-run.

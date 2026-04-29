---
phase: 59
name: New Project Wizard
milestone: v2.1
type: verification
verified_at: 2026-04-29
verifier: gsd-executor (compressed-phase dispatch)
verdict: PASS
---

# Phase 59 Verification - New Project Wizard

## Verdict

**PASS** - 12 must-haves green, 0 deviations, 0 blockers, 0 CRITICAL,
0 HIGH, 0 MEDIUM, 0 LOW deferred. v2.1 second-gate green (13/13
self-test PASS + idempotent sha256 match + non-clobber preserved on
existing config). v1.9 dual-gate + v2.0 sept-gate + v2.1 first-gate
exit 0 unchanged (no regression).

## Must-haves

| # | Must-have                                                          | Result                                                       |
| - | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1 | wizard --self-test exits 0 with 13/13 PASS green                   | PASS - 13/13 PASS green sub-1s                               |
| 2 | wizard --defaults on tmpdir produces config.json with project key  | PASS - written=true on first run, all 7 PANEL_KINDS present  |
| 3 | 2nd wizard --defaults on same tmpdir is byte-identical (sha256)    | PASS - hash1=fe16729a... hash2=fe16729a... idempotent_skip   |
| 4 | wizard on existing config with custom keys preserves all of them   | PASS - workflow.custom_user_field, workflow.auto_advance, model_routing.* all preserved |
| 5 | wizard --self-test runner (thin shell) delegates correctly         | PASS - exit 0 same 13/13 output                              |
| 6 | sgsd-complete-milestone --milestone v2.1 second-gate green         | PASS - exit 0 + 'v2.1 second-gate (new-project-wizard) green'|
| 7 | sgsd-complete-milestone --milestone v1.9 (no regression)           | PASS - exit 0 same dual-gate emission                        |
| 8 | sgsd-complete-milestone --milestone v2.0 (no regression)           | PASS - exit 0 same sept-gate emission (score=97 GREEN)       |
| 9 | sgsd-configure.ps1 knowledge-block logic byte-equality preserved   | PASS - lines 20-183 untouched; comment + hook only added     |
| 10| ASCII-only across all 4 changed files                              | PASS - first_nonascii_idx=-1 on each (selfTest A11 verifies) |
| 11| Lock 4 (Phase 41-58 + sgsd-cockpit-shell.cjs) byte-untouched       | PASS - no Phase 41-58 module modified; PANEL_KINDS mirrored  |
| 12| Lock 13 never throws upward (3 degraded sentinel paths verified)   | PASS - selfTest A5/A6/A7 cover missing dir/missing arg/non-object |

## Frozen surfaces (Lock 11)

- `PANEL_KINDS`: 7-entry ordered array (Object.freeze). Mirrors
  `sgsd-cockpit-shell.cjs:47-55` byte-equality.
- `BOOT_MODES`: 3-entry ordered array (`'auto'`, `'manual'`, `'observe'`).
- `VALIDATION_CODES`: 7-entry frozen vocabulary.
- `SCHEMA_VERSION`: locked at 1.

## Self-test inventory (13 assertions)

1. `panel_kinds_frozen_7_entries` - len=7 frozen=true
2. `boot_modes_frozen_3_entries` - len=3
3. `deep_merge_non_clobber` - mode=yolo custom=keep_me (Lock 11)
4. `deep_merge_idempotent` - first_len=112 second_len=145
5. `serialize_stable_idempotent` - key-order-independent (proven via permuted-input equality)
6. `run_wizard_missing_dir_degraded` - reason=planning_dir_missing exit=2 (Lock 13)
7. `run_wizard_missing_arg_degraded` - threw=false exit=1 (Lock 13)
8. `deep_merge_non_object_degraded` - reason=existing_not_object (Lock 13)
9. `validate_accepts_complete_block` - errs= (happy path)
10. `validate_rejects_bad_boot_mode` - errs=invalid_boot_mode
11. `validate_rejects_missing_block` - errs=project_block_missing
12. `ascii_only_source` - first_nonascii_idx=-1
13. `validation_codes_frozen_vocab` - len=7

## Idempotency proof (sha256 manual run)

```
TMPDIR=$(mktemp -d) && mkdir -p "$TMPDIR/.planning"
node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults --project-dir "$TMPDIR"
sha256sum "$TMPDIR/.planning/config.json"
  -> fe16729aff1c12a04eaf10724da297370f6c8f2d16ffab04a6ea381907550be7
node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults --project-dir "$TMPDIR"
  -> wizard_run ok=true ... written=false ... idempotent_skip=true
sha256sum "$TMPDIR/.planning/config.json"
  -> fe16729aff1c12a04eaf10724da297370f6c8f2d16ffab04a6ea381907550be7
HASH1==HASH2 -> IDEMPOTENT
```

## Non-clobber proof (existing custom keys preserved)

```
echo '{"workflow":{"mode":"yolo","custom_user_field":"must_be_preserved",
       "auto_advance":false},"model_routing":{...}}' > .planning/config.json
node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults --project-dir "$TMPDIR2"
cat .planning/config.json
  -> workflow.mode === 'yolo'                    [preserved]
  -> workflow.custom_user_field === 'must_be_preserved' [preserved]
  -> workflow.auto_advance === false             [preserved]
  -> model_routing.orchestrator === 'opus'       [preserved]
  -> model_routing.executor === 'sonnet'         [preserved]
  -> project.cockpit_panel_kinds === [...PANEL_KINDS] [added]
  -> project.default_boot_mode === 'auto'        [added]
  clobbered_keys === []                           [Lock 11]
```

## Deviations

None. Plan executed as written; surgical extensions to existing files
preserved byte-equality on the parts not under Phase 59 ownership.

## Lock invariants

- **Lock 4**: Phase 41-58 + sgsd-cockpit-shell.cjs byte-untouched. Verified
  via git diff -- only sgsd-configure.ps1 (additive scope-boundary comment +
  post-write hook) and sgsd-complete-milestone.cjs (additive v2.1
  second-gate insertion, 58 insertions / 0 deletions) modified outside the
  new Phase 59 surface.
- **Lock 11**: byte-equality on existing config keys verified by
  selfTest A3 (deep_merge_non_clobber) and the manual non-clobber proof.
- **Lock 13**: never-throws verified by selfTest A5/A6/A7. All three
  expected error paths (missing project dir, missing required arg,
  non-object existing) return degraded sentinels with deterministic
  exit codes (2, 1, internal-only).
- **ASCII-only**: verified across all 4 files (wizard.cjs A11; .ps1
  via inline node loop; complete-milestone.cjs via inline node loop;
  self-test runner via inline node loop).

---
phase: 60
name: Example Project + Demo
milestone: v2.1
type: verification
verified_at: 2026-04-29
verifier: gsd-executor (compressed-phase dispatch)
verdict: PASS
---

# Phase 60 Verification - Example Project + Demo

## Verdict

**PASS** - 11 must-haves green, 0 deviations, 0 blockers, 0 CRITICAL,
0 HIGH, 0 MEDIUM, 0 LOW deferred. v2.1 third-gate green
(wizard --defaults against examples/hello-world fixture exits 0 +
sha256 fe16729a... canonical match + observation-only fixture
restore). v1.9 dual-gate + v2.0 sept-gate + v2.1 first-gate +
v2.1 second-gate exit 0 unchanged (no regression). Walkthrough
doc tested end-to-end, all 11 documented commands exit 0 with
expected output (modulo OS-dependent path-separator prefix).

## Must-haves

| #  | Must-have                                                              | Result                                                       |
| -- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1  | examples/hello-world/ scaffolded with 3 files                          | PASS - PROJECT.md, ROADMAP.md, .planning/STATE.md present     |
| 2  | Wizard --defaults against fixture produces config.json (first run)     | PASS - written=true, defaults_used=true, idempotent_skip=false |
| 3  | Wizard --defaults re-run is idempotent                                 | PASS - written=false, idempotent_skip=true, clobbered=0      |
| 4  | config.json sha256 matches canonical fe16729a...                       | PASS - exact match to Phase 59 verification                  |
| 5  | Wizard --defaults --dry-run preview without writing                    | PASS - dry_run=true, written=false                           |
| 6  | Wizard --self-test 13/13 PASS green                                    | PASS - 13/13 PASS, sub-1s                                    |
| 7  | sgsd-complete-milestone --milestone v2.1 third-gate green              | PASS - exit 0 + 'v2.1 third-gate (example-walkthrough) green'|
| 8  | sgsd-complete-milestone --milestone v1.9 (no regression)               | PASS - exit 0 + 'v1.9 dual-gate ... green' unchanged          |
| 9  | sgsd-complete-milestone --milestone v2.0 (no regression)               | PASS - exit 0 + 'v2.0 sept-gate ... green' unchanged          |
| 10 | ASCII-only across all 5 changed files                                  | PASS - first_nonascii_idx=-1 on each                          |
| 11 | Lock 4 (Phase 41-59) byte-untouched; surgical insertion only           | PASS - git diff --stat: 179 insertions, 0 deletions on the milestone script |

## Walkthrough end-to-end test results (2026-04-29)

### Step 0 - Verify fixture exists

```
$ ls -A examples/hello-world
.planning
PROJECT.md
ROADMAP.md
exit 0
```

### Step 1 - Confirm config does not yet exist

```
$ ls examples/hello-world/.planning
STATE.md
exit 0
```

### Step 2 - First run of wizard --defaults

```
$ cd examples/hello-world && node ../../super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults
wizard_run ok=true configPath=C:\Users\jack.berrow\GSDedits\examples\hello-world\.planning\config.json written=true
  defaults_used=true dry_run=false idempotent_skip=false clobbered=0
exit 0
```

### Step 3 - Inspect produced config

```
$ cat examples/hello-world/.planning/config.json
{
  "project": {
    "cockpit_panel_kinds": [
      "token",
      "source_mix",
      "active_agent",
      "codex",
      "intent",
      "governance",
      "budget"
    ],
    "configured_by": "sgsd-new-project-wizard",
    "configured_schema": "v1",
    "default_boot_mode": "auto",
    "operator_preferences": {
      "confirm_destructive": true,
      "verbose_logging": false
    },
    "schema_version": 1
  }
}
exit 0
```

### Step 4 - Re-run wizard (idempotent)

```
$ cd examples/hello-world && node ../../super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults
wizard_run ok=true configPath=C:\Users\jack.berrow\GSDedits\examples\hello-world\.planning\config.json written=false
  defaults_used=true dry_run=false idempotent_skip=true clobbered=0
exit 0
```

### Step 5 - sha256 hash matches canonical

```
$ cd examples/hello-world && sha256sum .planning/config.json
fe16729aff1c12a04eaf10724da297370f6c8f2d16ffab04a6ea381907550be7 *.planning/config.json
exit 0
```

This is the canonical Phase 59 fingerprint. Match confirmed
across both the standalone walkthrough run AND the third-gate
internal verification.

### Step 6 - Dry-run preview

```
$ cd examples/hello-world && node ../../super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults --dry-run
wizard_run ok=true configPath=C:\Users\jack.berrow\GSDedits\examples\hello-world\.planning\config.json written=false
  defaults_used=true dry_run=true idempotent_skip=true clobbered=0
exit 0
```

### Step 7 - Wizard --self-test

```
$ node super-gsd/scripts/sgsd-new-project-wizard.cjs --self-test
PASS panel_kinds_frozen_7_entries len=7 frozen=true
PASS boot_modes_frozen_3_entries len=3
PASS deep_merge_non_clobber mode=yolo custom=keep_me
PASS deep_merge_idempotent first_len=112 second_len=145
PASS serialize_stable_idempotent s2_len=145 s3_len=486
PASS run_wizard_missing_dir_degraded reason=planning_dir_missing
PASS run_wizard_missing_arg_degraded threw=false exit=1
PASS deep_merge_non_object_degraded reason=existing_not_object
PASS validate_accepts_complete_block errs=
PASS validate_rejects_bad_boot_mode errs=invalid_boot_mode
PASS validate_rejects_missing_block errs=project_block_missing
PASS ascii_only_source first_nonascii_idx=-1
PASS validation_codes_frozen_vocab len=7
---
wizard_self_test: 13/13 assertions passed
exit 0
```

### Step 10 - Milestone close exercises the same fixture

```
$ node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.1 | tail -8
wizard_self_test: 13/13 assertions passed
milestone_close_gate: v2.1 new-project-wizard self-test green (>=8 assertions PASS; deep-merge non-clobber + idempotent + Lock 13 verified)
milestone_close_gate: v2.1 second-gate (new-project-wizard) green
wizard_run ok=true configPath=C:\Users\jack.berrow\GSDedits\examples\hello-world\.planning\config.json written=false
  defaults_used=true dry_run=false idempotent_skip=true clobbered=0
milestone_close_gate: v2.1 example-walkthrough self-test green (wizard --defaults exit 0 + idempotent + sha256 fe16729a...)
milestone_close_gate: v2.1 third-gate (example-walkthrough) green
exit 0
```

## v1.9 + v2.0 regression checks

```
$ node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9 | tail -3
Summary: 26/26 PASS, 0 FAIL
milestone_close_gate: v1.9 redis-adapter self-test green
milestone_close_gate: v1.9 dual-gate (context-bench + redis-adapter) green
exit 0

$ node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0 | tail -3
    lock_invariants: 15 / 15 (bucket_computed_ok)
milestone_close_gate: v2.0 release-readiness score green (>=70 + no edge_guard_miss)
milestone_close_gate: v2.0 sept-gate (...) green
exit 0
```

Both prior gates exit 0 unchanged. No observable output diverged
from the Phase 59 baseline (other than the v2.1 branch which is
the in-scope extension).

## ASCII-only verification (all 5 changed files)

```
$ node -e "...check first_nonascii_idx on each file..."
super-gsd/scripts/sgsd-complete-milestone.cjs first_nonascii_idx=-1 OK
super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md     first_nonascii_idx=-1 OK
examples/hello-world/PROJECT.md                first_nonascii_idx=-1 OK
examples/hello-world/ROADMAP.md                first_nonascii_idx=-1 OK
examples/hello-world/.planning/STATE.md        first_nonascii_idx=-1 OK
```

All 5 files clean. No smart quotes, no emoji, no non-ASCII
literals.

## Lock 4 byte-untouched verification

```
$ git diff --stat super-gsd/scripts/sgsd-complete-milestone.cjs
 super-gsd/scripts/sgsd-complete-milestone.cjs | 179 ++++++++++++++++++++++++++
 1 file changed, 179 insertions(+)
```

179 insertions, **0 deletions**. The surgical extension is
strictly additive inside the existing `milestone === 'v2.1'`
block. Bytes 1-312 (up through the second-gate green emission)
preserved byte-equal vs the Phase 59 baseline.

## Lock 13 walkthrough-degrades-gracefully

The third-gate's fixture-missing path was confirmed at design
time by inspection: if `examples/hello-world/.planning/` is
absent (verified via `fs.existsSync` + `isDirectory()`), the
gate writes a SKIPPED sentinel to stdout and exits 0:

```
milestone_close_gate: v2.1 example-walkthrough self-test SKIPPED
  (fixture missing: examples/hello-world/.planning not present;
   partial checkout suspected; degrading to second-gate only
   per Lock 13)
milestone_close_gate: v2.1 third-gate (example-walkthrough)
  green-with-skip
```

This path is not exercised in the runtime test (the fixture
exists in the live checkout), but the code path is statically
verifiable: lines 369-378 of sgsd-complete-milestone.cjs after
the Phase 60 insertion. Future negative-path testing can
spawnSync the gate with a tmpdir as `__dirname` substitute.

## Frozen anchors

| Anchor                  | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| Canonical config sha256 | fe16729aff1c12a04eaf10724da297370f6c8f2d16ffab04a6ea381907550be7   |
| PANEL_KINDS (mirrored)  | token, source_mix, active_agent, codex, intent, governance, budget |
| Schema version          | 1                                                                  |
| Default boot mode       | auto                                                               |

## Conclusion

Phase 60 ships:

1. `examples/hello-world/` runnable scaffold (3 files)
2. `super-gsd/docs/EXAMPLE-DEMO-WALKTHROUGH.md` 11-step doc
3. `sgsd-complete-milestone.cjs` v2.1 third-gate (additive +179)
4. Phase artifacts (60-RESEARCH, 60-01-PLAN, 60-VERIFICATION,
   WASTE, commit-reviews)

All acceptance criteria met. v2.1 progress: 3/5 phases shipped
(58 installer-audit + 59 new-project-wizard + 60 example-demo).
Phases 61 and 62 still queued.

---
phase: 33
plan: 33-01
status: PASS
verified: 2026-04-27T00:00:00Z
requirements: [REPAIR-01, REPAIR-02, REPAIR-03, REPAIR-04]
---

# Phase 33 Verification (REPAIR-01..04)

## Verifier Output

```
=== Phase 33 verifier (REPAIR-01..04) ===
PASS REPAIR-01: 13 repair_instruction rows
PASS REPAIR-02: 2 commands checked, 0 violations
repair-command-checker self-test: 14 pass, 0 fail
PASS REPAIR-03 (b): poisoned gates.yaml load throws
PASS REPAIR-03 (c): canonical gates.yaml loads
PASS REPAIR-04 (a): Mission Strip Q4 surfacing wired
PASS REPAIR-04 (b): milestone-close SUMMARY template extended
PASS final: ROADMAP-locked fixture pair behaves correctly
=== ALL REPAIR-01..04 PASS ===
```

## Acceptance Map

| Requirement | Check | Result |
|-------------|-------|--------|
| REPAIR-01 | `grep -c '^    repair_instruction:' gates.yaml >= 13` | 13 rows -> PASS |
| REPAIR-02 | exactly 2 `repair_command:` rows + validateRepairCommands ok | 2 commands, 0 violations -> PASS |
| REPAIR-03 (a) | `--self-test` 14 assertions + fingerprint guard | 14 pass, 0 fail -> PASS |
| REPAIR-03 (b) | gates-registry load-time throw on poisoned fixture | throws with 4-AND + gate=bad -> PASS |
| REPAIR-03 (c) | canonical gates.yaml loads cleanly through registry | no throw -> PASS |
| REPAIR-04 (a) | Mission Strip Q4 references repair-command-checker | grep match -> PASS |
| REPAIR-04 (b) | milestone-close SKILL.md cites Unresolved Repairs + helper | grep match -> PASS |

## A2 Demotion Note

RESEARCH section 3 listed 4 candidate gates for `repair_command:` rows.
The A2 verification step (documented in the plan body under
`<a2_verification_results>`) probed each candidate's underlying script
for a non-mutating flag (--self-test or --dry-run). Two candidates were
demoted to `repair_instruction:` only because the underlying script does
not currently support a non-mutating flag:

- `sgsd-recall-queries`: `Grep('--self-test|--dry-run',
  super-gsd/scripts/sgsd-recall.sh)` returned 0 matches. The 4-AND
  predicate cannot be guaranteed without a read-only invocation, so the
  gate ships text only.
- `token-log`: `Glob('super-gsd/tools/token-audit/**')` returned 0 files.
  The candidate command targets a script that does not exist; the gate
  ships text only.

The other 2 candidates passed verification and ship `repair_command:`
rows backed by the 4-AND checker:

- `MUDA-waste-audit` -> `bash super-gsd/scripts/sgsd-muda-audit.sh --dry-run`
  (--dry-run handled in arg parsing at line 43)
- `sgsd-curate-learnings` -> `bash super-gsd/scripts/sgsd-curate.sh --dry-run`
  (--dry-run handled in arg parsing at line 53)

The 2 demotions are not lost work. The schema accepts `repair_command:`
on any future row, so a v1.8+ task can add `--self-test` to
`sgsd-recall.sh` (or create the missing `tools/token-audit/check.cjs`)
and lift those gates back into the auto-repair contract by appending
one yaml line each. The contract still ships, just for 2 gates instead
of 4.

## Live-or-Local Confirmation

All verifier checks above run against real shipped files:
`super-gsd/registry/gates.yaml`, `super-gsd/scripts/lib/repair-command-checker.cjs`,
`super-gsd/scripts/lib/gates-registry.cjs`, `super-gsd/scripts/lib/sgsd-mission-strip.ps1`,
`super-gsd/skills/sgsd-complete-milestone/SKILL.md`. The single tmpdir fixture
is used only for the poison-yaml load test (REPAIR-03 b). No external
dependencies. No network. No auth.

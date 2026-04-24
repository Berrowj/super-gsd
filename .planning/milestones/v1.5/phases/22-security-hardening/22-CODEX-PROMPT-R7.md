# Phase 22 SEC-01/SEC-02 Hardening: Phase-Level ATC Round 7

You are reviewing Phase 22 of milestone v1.5 against the project's strict SGSD code-reviewer-v1 contract. Round 6 found 2 CRITs:

- Refusal logging still wrote through paths derived from `PLANNING_DIR_CANONICAL`, which is attacker-controlled when `.planning` itself is a symlink.
- Normal `_log_row()` appends also wrote through canonicalized `.planning` paths, so successful audit rows could be redirected through symlinked planning components.

Round 7 is narrowly scoped: verify those two CRITs are closed in `super-gsd/scripts/sgsd-stop-handoff.sh` at HEAD.

## Review Focus

Read the entire file and verify:

1. Symlink-component and containment refusals write to stderr only. They must not append an audit row through `$PLANNING_DIR_CANONICAL`, `$LOG_DIR`, `$LOG_PATH`, or any other `.planning`-derived path after trust is compromised.
2. Raw paths are validated before canonicalization and restored for later reads/writes. Canonicalized paths must be used only for escape detection, not as audit-write destinations.
3. `_log_row()` revalidates raw `.planning`, `metrics`, log, and lock components immediately before append.
4. Successful audit appends do not write through the old canonicalized target. They must use the raw prevalidated log path plus the secure append helper.
5. There is no unsafe last-resort `echo >> "$LOG_PATH"` fallback. If secure append is unavailable or fails, the script should refuse the audit write via stderr.
6. Check for remaining symlink-attack surfaces, including `.planning`, `.planning/metrics`, `.planning/metrics/handoff-log.jsonl`, and `.planning/metrics/handoff-log.lock`.

## Evidence To Consider

The implementation was locally checked with:

- `bash -n super-gsd/scripts/sgsd-stop-handoff.sh`
- symlinked `.planning` exploit test
- symlinked `.planning/metrics` exploit test
- symlinked final `handoff-log.jsonl` exploit test

Do not give credit for those checks without verifying the code path yourself.

## Project Review Contract: code-reviewer-v1

Return EXACTLY this 5-line format first, with no preamble:

```
FINDINGS: <count>
CRITICAL: <count>
WARNINGS: <count>
PASS_RATE: <0-100>
ONE_LINER: <single sentence summary>
```

Then a blank line, then the bulleted findings list, one finding per line:

```
- [CRIT|WARN] <file>:<line> — <issue> | <fix recommendation>
```

CRIT = security/correctness defect that would cause data loss, privilege escalation, or silent corruption.
WARN = code quality, robustness, or readability issue that is not a defect but should be addressed.

PASS_RATE: 100 if 0 CRIT + 0 WARN. Subtract 10 per WARN, 25 per CRIT. Floor at 0.

## Files To Read

- `super-gsd/scripts/sgsd-stop-handoff.sh`
- `.planning/milestones/v1.5/phases/22-security-hardening/22-VERIFICATION.md`
- `.planning/milestones/v1.5/phases/22-security-hardening/22-02-SUMMARY.md`

Begin review now.

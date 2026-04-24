# Phase 22 — SEC-01/SEC-02 Hardening — Phase-level ATC Round 6

You are reviewing Phase 22 of milestone v1.5 against the project's strict SGSD code-review-v1 contract. This is round 6 of a 5-round halt-on-CRIT escalation cycle. Each prior round narrowed the symlink-attack surface and required a fix; this round verifies the round-5 fix (Node lstat-walk strict path validator) closes the remaining CRITs.

## Phase context

- **Goal:** Harden `super-gsd/scripts/sgsd-stop-handoff.sh` against (SEC-01) symlink redirection of audit-write paths and (SEC-02) concurrent-write races on the `handoff-log.jsonl` audit log.
- **Status:** Feature is `enabled:false` by default in `.planning/config.json` — disabled until the security review converges.
- **Prior CRITs cleared in earlier rounds:**
  - R1 → containment assertion (`_assert_contained`) + `PLANNING_DIR_CANONICAL` prefix check
  - R2 → audit-write target moved off escaped `LOG_DIR` to canonical `.planning/metrics/handoff-log.jsonl`
  - R3 → `LOG_DIR` itself canonicalized + contained (covers symlinked parent dir)
  - R4 → `O_NOFOLLOW` on the audit-row append (final-component symlink check)
  - R5 → **(this round)** Node lstat-walk strict path validator on every component of every raw handoff path, run BEFORE canonicalization. Closes:
    - `.planning/` itself being a symlink (canonicalize_path resolves silently — no flag)
    - `metrics/` being an intermediate symlink (O_NOFOLLOW only protects the final component)

## Round-6 review focus

Review **`super-gsd/scripts/sgsd-stop-handoff.sh`** at HEAD (commit `f9bcc18`) end-to-end. Specifically scrutinize:

1. **Function ordering** — `_path_has_no_symlink_components` and `_assert_no_symlink_components` must be defined BEFORE the call sites at the top of the path-setup block. Verify no temporal-coupling bugs.
2. **lstat-walk semantics** — Walks every component from `/` (or drive root on Windows) → leaf, lstat each, refuses on any symlink. Non-existent intermediate components break the walk (early `break` in catch). Validate this is correct: a non-existent leaf is fine (file may not exist yet), but a non-existent INTERMEDIATE component should also not be a refuse signal.
3. **Defense-in-depth degradation** — If Node is unavailable, returns 0 (no refuse). Confirm this matches the project's "graceful degradation, not crash" posture and note any residual attack surface.
4. **Audit-row write target on refusal** — `_assert_no_symlink_components` writes its refusal row to `$PLANNING_DIR_CANONICAL/metrics/handoff-log.jsonl` via `O_NOFOLLOW`. Confirm this is safe even if PLANNING_DIR itself was the symlinked attack vector (note: PLANNING_DIR_CANONICAL was set by `canonicalize_path "$PLANNING_DIR"` BEFORE validation runs — is this exploitable?).
5. **SEC-02 flock branch** — Lock acquisition checks exit code, falls through to Node `appendFileSync` with `lock_fallback:true` audit field on timeout. Verify no silent-corruption surface remains.
6. **Symlink-attack surface NOT covered** — Anything an attacker could still do that this script does not refuse. Be specific: name the file path, the symlink target, and the resulting outcome.

## Project review contract — code-reviewer-v1

Return EXACTLY this 5-line format (no preamble, no markdown, no commentary):

```
FINDINGS: <count>
CRITICAL: <count>
WARNINGS: <count>
PASS_RATE: <0-100>
ONE_LINER: <single sentence summary>
```

Then a blank line, then the bulleted findings list (one per line):

```
- [CRIT|WARN] <file>:<line> — <issue> | <fix recommendation>
```

CRIT = security/correctness defect that would cause data loss, privilege escalation, or silent corruption.
WARN = code quality, robustness, or readability issue that is not a defect but should be addressed.

PASS_RATE: 100 if 0 CRIT + 0 WARN. Subtract 10 per WARN, 25 per CRIT. Floor at 0.

## Files to read

- `super-gsd/scripts/sgsd-stop-handoff.sh` — ENTIRE FILE (this is what you're reviewing)
- `.planning/milestones/v1.5/phases/22-security-hardening/22-CONTEXT.md` — phase scope
- `.planning/milestones/v1.5/phases/22-security-hardening/22-VERIFICATION.md` — verifier verdict

Begin review now.

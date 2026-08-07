# P147 T147-01 fix — 2 CRITICAL (circular delete containment; dot-config bypass) + 2 WARN

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files:
`super-gsd/scripts/lib/sgsd-artifact-conventions.cjs`,
`super-gsd/tests/commit-gate/assert-real-commit-gate.cjs`. Nothing else.

## CRIT-1 — cleanupFixture containment is CIRCULAR (confirmed at source)
`cleanupFixture(tempRoot)` (~line 159) computes
`resolveContainedPath(path.dirname(tempRoot), path.basename(tempRoot))` —
i.e. it proves the target is contained RELATIVE TO ITS OWN PARENT, which is
true of every path in existence. The guard is decorative; `rmSync(recursive,
force)` will follow ANY caller-supplied tree. This is P146's
writer-destination class in its most destructive form: a recursive DELETER.
### Fix
Prove the target is an internally-created fixture: at creation time, make the
fixture under `fs.mkdtempSync(path.join(os.tmpdir(), '<prefix>-'))`, remember
the exact realpath in module scope (a Set of created roots), and have
cleanupFixture refuse anything not in that Set. Belt-and-braces: also verify
`fs.realpathSync` of the target starts with the realpath of `os.tmpdir()`.
Refuse = return without deleting + a non-stack breadcrumb (never throw).

## CRIT-2 — root dot-config files bypass the source predicate (confirmed)
`path.extname(".env")` is `""`, so `.env`, `.npmrc`, and extensionless config
like `Dockerfile` evaluate `not_source` — runtime/config changes avoid
warnings, which is exactly the falsifier "runtime/config source paths fail to
warn".
### Fix
Extend the predicate: well-known config basenames and dotfiles at repo root
or in runtime dirs (`.env*`, `.npmrc`, `Dockerfile`, `docker-compose*`,
`Makefile`, `*.toml`, `*.ini`, `.gitattributes` — use judgment, state the
final list) are source-touching. Keep `.planning/**`, `docs/**`, root
`README.md` excluded. `.gitignore`: decide and state (recommend source — it
changes what escapes tracking).

## WARN-1 — invalid/traversal staged entries silently dropped
(~line 528) bad entries are filtered before record creation, so malformed
staged input DISAPPEARS instead of producing a reason-coded record. Per-path
contract: EVERY input path yields a record; give invalid ones
`evidence_status: "invalid_path"` (or similar) with a reason code.

## WARN-2 — inconsistent case behavior across predicate branches
(~line 454) exact and `/**` checks are case-sensitive while wildcard checks
are case-insensitive. Pick ONE policy (recommend: case-insensitive on win32,
case-sensitive elsewhere — or uniformly case-insensitive; state your choice
and why) and apply it to every branch.

## Preserve (all pass on the host — must not regress)
All 6 real-git scenarios (source-predicate, gsdedits-backed,
false-plan-audit-missing, convention-unknown, per-path-granularity,
artifact-conventions-source-predicate). The 13 adversarial probes: predicate
positives/negatives incl. super-gsd docs = source; backslash separators do
not bypass either direction; never-throws on garbage; non-SGSD →
reason-coded not-gsdedits; per-path records with evidence_status.
NOTE your sandbox may block git spawn (EPERM) — if so, say so in BLOCKERS;
the orchestrator re-runs the git scenarios host-side.

## Verify (report exact exit codes)
1. `node --check` both files.
2. CRIT-1: call cleanupFixture with a path OUTSIDE the created-fixture set
   (a temp dir you made directly) → NOT deleted, breadcrumb, no throw. A
   genuine fixture → still cleaned.
3. CRIT-2: `.env`, `.npmrc`, `Dockerfile` → source_touching true;
   `.planning/STATE.md`, `docs/x.md`, root README.md → still false.
4. WARN-1: evaluatePaths with a `../traversal` entry and a null entry →
   records WITH reason-coded invalid status, none dropped.
5. WARN-2: demonstrate the single case policy on at least one previously
   inconsistent pair.
6. As many of the 6 git scenarios as your sandbox allows.

SURGICAL CONSTRAINT — every changed line must trace to a finding above.
Orphan edits are DEVIATIONS: report, do not commit silently.

## Report contract (<300 words)
FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER

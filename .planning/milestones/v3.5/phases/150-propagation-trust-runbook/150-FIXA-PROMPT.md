# P150-fixA — Scripts/security CRITs (C1, C3, C4) + W1 cleanup

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). Fix EXACTLY these review findings (verbatim below). Surgical constraint applies.

FINDINGS_DETAIL: [CRITICAL] [security/origin] `super-gsd/scripts/sgsd-update.sh:126-143` and `super-gsd/scripts/sgsd-update.ps1:141-162` fetch and trust whichever repository is named `origin` without validating its URL; a repointed existing clone can fast-forward to attacker-controlled code and execute its installer globally. Validate the resolved origin against the canonical allowlist before every check or fetch.
FINDINGS_DETAIL: [CRITICAL] [recovery/boundary] `super-gsd/scripts/sgsd-global-snapshot.sh:82-100` only searches for nine known installer text markers and cannot detect an additional mutation target, while `PROPAGATION.md:56-65` omits the required pre-existing `~/.claude/get-shit-done` guard; if absent, `super-gsd/install.sh:304-323` invokes an external bootstrap whose mutations are outside the snapshot and cannot be rolled back.
FINDINGS_DETAIL: [CRITICAL] [security/rollback] `super-gsd/scripts/sgsd-global-snapshot.sh:101-109,239-260` validates storage paths lexically before resolving symlinks and extracts any merely readable tar without checking membership or hashes first; a symlinked failed-candidate directory can move several live targets inside the scripts tree before a self-move failure, while a tampered archive can overwrite unrelated files under the user’s home.
FINDINGS_DETAIL: [WARNING] [anti-slop/salvage] `super-gsd/tests/propagation/global-snapshot-contract.test.cjs.orig:1` and `sgsd-update-contract.test.cjs.orig:1` are tracked salvage backups, while `super-gsd/install.sh:1` and three integration files contain near-wholesale line-ending churn; stale duplicate tests and noisy diffs obscure the authoritative implementation and make later reviews error-prone.

## Requirements
1. C1: both updaters validate the resolved origin URL against a canonical allowlist (github.com[:/]Berrowj/super-gsd) BEFORE any check/fetch; fail closed with a clear message; extend sgsd-update-contract tests with a repointed-origin fixture case.
2. C3: sgsd-global-snapshot.sh must detect unknown installer mutation targets (parse install.sh mutation sites generically or fail closed on unrecognized mutations) AND the create path must fail closed when ~/.claude/get-shit-done is absent (bootstrap would mutate outside snapshot); test both.
3. C4: resolve symlinks BEFORE lexical path validation on storage dirs; verify tar membership against the manifest (path prefixes, no absolute/.. entries) before extraction; test symlinked failed-candidate rejection and tampered-archive rejection (skip symlink fixture on EPERM hosts per existing pattern).
4. W1: delete tracked .orig salvage backups (global-snapshot-contract.test.cjs.orig, sgsd-update-contract.test.cjs.orig); do not touch unrelated line endings.

## Verify: sgsd-update-contract + global-snapshot-contract suites green with the NEW cases; report counts.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS

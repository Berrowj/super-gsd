FINDINGS: 2
CRITICAL: 1
WARNINGS: 1
DELETABLE_LINES: 35
DELTA_COMPLEXITY: positive, a necessary multi-scope state machine is coupled to unrelated repair behavior.
PASS_RATE: 7/10
ONE_LINER: Core T4 logic is coherent, but its installer entry point violates existing mutation boundaries and repeats work.
VERDICT: FAIL
REQUIRED_CHANGES:

1. Make `--repair-substrate-capability` substrate-scoped. It must not rewrite
   `.planning/config.json`, unrelated global agents, or commands; gate
   unavoidable global changes behind the existing global opt-in. Add
   customized-config byte-preservation coverage.
2. Consolidate runtime distribution and hook merging so each installer action
   performs one repair/merge sequence; remove unused helper exports and stale
   seventeen-vs-sixteen test residue.

The critical call chain is `install.sh:447` -> `audit.cjs:1525` -> broad
`repairSafe`, including config overwrite at line 1327. This contradicts
`--init-local`, `--install-global`, and `--update` mutation promises.

The four-grant withdrawal is justified fail-closed ordering: rollback can throw
before final derivation, and transient grantlessness only degrades capability.
Installer behavior is byte-idempotent, but repeats distribution and settings
writes. No same-user overclaim, malformed added literal, or production-copy
false pass remains. Node syntax, JSON, digest, and diff checks passed; Bash
syntax execution was sandbox-blocked.

<!-- Reviewed T4 full diff 386d027 to HEAD. Salvaged from
     codex-live-output.txt. 239,116 tokens. -->

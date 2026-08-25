# P167-T4 ATC fix — installer blast radius

Per-dispatch ATC returned FAIL, 7/10, one CRITICAL and one warning.

It explicitly cleared the things worth clearing: the four-grant withdrawal is
justified fail-closed ordering, installer behaviour is byte-idempotent, and no
same-user overclaim, malformed literal, or production-copy false pass remains.
Do not disturb any of that.

## CRITICAL 1, a substrate flag must not rewrite the operator's config

> Make `--repair-substrate-capability` substrate-scoped. It must not rewrite
> `.planning/config.json`, unrelated global agents, or commands; gate
> unavoidable global changes behind the existing global opt-in.
>
> The critical call chain is `install.sh:447` -> `audit.cjs:1525` -> broad
> `repairSafe`, including config overwrite at line 1327. This contradicts
> `--init-local`, `--install-global`, and `--update` mutation promises.

This is a blast-radius defect in a shared installer, and it is the most
serious finding of the task. A flag whose name promises substrate capability
repair currently reaches a broad repair that overwrites `.planning/config.json`
and unrelated global agents and commands. Any operator running it on a project
with a customised config would have that config rewritten without asking, and
the flag's name gives them no warning.

Required:

- `--repair-substrate-capability` touches only substrate capability concerns:
  the witness hook registrations, the broker definition, the private upstream
  manifest, the witness key, and the derived agent grants.
- It must NOT rewrite `.planning/config.json`, unrelated global agents, or
  commands.
- If some global change is genuinely unavoidable for substrate repair, put it
  behind the existing global opt-in rather than performing it implicitly.
- Add coverage proving a CUSTOMISED `.planning/config.json` is byte-preserved
  across the flag. That test must fail against the current code.

Do not fix this by renaming the flag or documenting the behaviour. The
mutation boundary is the contract; make the code honour it.

## WARNING 2, repeated work and residue

> Consolidate runtime distribution and hook merging so each installer action
> performs one repair/merge sequence; remove unused helper exports and stale
> seventeen-vs-sixteen test residue.

Each installer action should perform one repair and merge sequence, not repeat
distribution and settings writes. Remove helper exports nothing imports, and
the leftover seventeen-versus-sixteen hook-count residue in the tests.

Roughly 35 lines are removable.

## Constraints

Five files: `install.sh`, `audit.cjs`, `assert-propagation.cjs`,
`assert-installer-registration-guard.cjs`, `merge-settings.js`.

Everything currently green must stay green: T1 34/34, T2 13/13, T3 4/4, T4's
propagation suite, the four registration-guard cases including
`hook-distribution-all-types`, and all ten P166 regressions.

Idempotence must survive: running the installer twice must not double-register.

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

## Verification reality

You cannot run fixture suites or bash (`EPERM`). `node --check` and module load
checks only; say so rather than claiming a suite. The orchestrator runs the rest
and reports exact failures back.

Apply edits early, emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
LINES_REMOVED: <int>
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what the repair flag now touches, and what it no longer touches
```

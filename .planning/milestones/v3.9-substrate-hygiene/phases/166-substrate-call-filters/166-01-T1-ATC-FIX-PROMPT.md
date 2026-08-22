# P166-T1 ATC fix — 3 warnings, VERDICT FAIL

Spec compliance already PASSED at 11/11. Correctness is settled. This round is
about slop: dead residue, a malformed literal, and a wasteful scan. Do not
change enforcement behaviour. Every test that passes now must still pass.

## Change 1, syntax defect

`super-gsd/agents/sgsd-vtp-enrichment.md:77` is missing a comma after
`rationale: ''`. Fix it. Check the surrounding block parses as the structure it
claims to be, and check the other three prompts you edited for the same class of
defect while you are there.

## Change 2, remove dead residue

Three fix rounds left leftovers. Remove:

- the unused `callArgs.payload`
- the dead `fallbackReason` chain
- the discarded search shaping
- the duplicate gate/record validation, where the later acceptance seam already
  subsumes an earlier check
- the second `assertPromptContracts()` call

`assertPromptContracts` itself stays. The reviewer judged that it earns its
place by checking prompt wiring; only the duplicate invocation is redundant.

For the duplicate validation specifically: confirm which of the two is
subsumed before deleting either. If removing one weakens a path, keep it and
say so rather than deleting to hit a number.

## Change 3, stop scanning node_modules

`caller-coverage` currently traverses 3,179 files and 30 MiB, copies them, then
rescans twice. 2,523 of those files are `node_modules`. That is why it hit a 20
second ceiling during development.

Exclude `node_modules`. Replace the full-surface copy-and-rescan with one
production scan plus small adversarial fixtures.

This must not weaken the gate. After the change, BOTH proofs must still fail
closed: a rogue occurrence inside an already-known file, and a rogue occurrence
in a new file. Prove both still bite. If a smaller fixture cannot prove the same
thing the full copy proved, keep the full scan and say why.

## Constraints

Deleting the wrong line here silently reopens a CRITICAL that took three rounds
to close. When in doubt, keep it and explain.

Frozen byte-unchanged: `vtp-mcp-input-schemas.v1.json`,
`154-REAL-MCP-EVIDENCE.json`. Same eleven-file scope. Do not commit. No emoji,
no em dashes. Never invoke `claude`.

`executable-emitters` cannot run in your sandbox (`spawnSync EPERM`). Do not
claim it. The orchestrator runs it.

Emit `PROGRESS: <line>` as you go.

## Report

```
FILES_CHANGED: path (modified)
LINES_REMOVED: <int>
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what went, what stayed, and why anything you kept was kept
```

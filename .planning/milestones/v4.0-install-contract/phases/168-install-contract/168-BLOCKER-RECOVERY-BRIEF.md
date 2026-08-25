# Blocker recovery brief — P168 refuse-before-write vs P167 witness readiness

## The conflict, after three failed rounds

Phase ATC holds a CRITICAL: `repair_substrate_capability` and `register_codex_hooks`
retain refusal paths reachable AFTER `publish_project_install_contract` writes project
bytes, on install.sh entry points and the audit.cjs direct path. Two fix rounds moved
checks earlier but could not make the writers non-rejecting. The third round attempted
publication-last and STOPPED on a genuine dependency, verified with citations:

- `audit.cjs:1515`: capability repair requires `auditClaudeSubstrateWitness(...).ready`,
  and the P167 readiness contract reports `source_missing` when the witness hook is not
  yet published to the project.
- `audit.cjs:858`: readiness hashes the PROJECT's witness file; pre-publication it is
  null, post-publication validation at :523 would see drift.
- `audit.cjs:748`: stale-hook smoke executes project-target paths.

So: repair validates the witness AS INSTALLED (a P167 security property, untouchable),
which forces repair after publication; ATC's literal refuse-before-write forces repair
before publication. Circular.

## Proposed decision: OPTION A — atomic install via journaled rollback

Reframe the invariant from the MEANS (refuse before write) to the END it protects
(a refused install leaves the project byte-identical):

1. Publication stays first and remains journaled (prepared/publishing/committed states
   already exist in hook-install-contract.cjs).
2. If any subsequent step refuses, the installer rolls back publication via the journal,
   restoring the pre-install tree, then exits non-zero.
3. This is sound where it was previously rejected because the prior rejection concerned
   SMOKE: arbitrary hook code whose side effects cannot be contained by rolling back the
   tree. That smoke now runs candidate-side, pre-write. The post-publication refusals are
   policy checks in repair, and repair's own no-mutation-on-refusal is already asserted
   (guard case witness-repair-smoke-no-mutation, byte-identity on refusal). Composite:
   refusal at any point => project byte-identical.
4. Behavioural guard: force a repair refusal in a fixture and assert the project tree is
   byte-identical afterwards, non-zero exit. This catches any future rejecting step
   regardless of name, which the manual inventory could not.

## Alternatives considered

- OPTION B, prospective digests: let readiness validate candidate digests before
  publication. Rejected: changes P167 witness semantics, the one contract declared
  untouchable, and would let readiness pass against bytes not actually installed.
- OPTION C, close PASS-WITH-DEFERRED carrying the ATC CRITICAL. Rejected while a sound
  fix exists: the deferred item would be precisely the failure class this phase was
  opened to eliminate.

## Deviation note

The full board roster was not convened; this brief goes straight to a Codex challenge.
Logged as a deliberate economy after twelve hours of runtime; the challenge is the
adversarial step the loop requires.

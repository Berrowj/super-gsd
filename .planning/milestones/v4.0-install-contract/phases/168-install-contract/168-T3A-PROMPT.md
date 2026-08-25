# Bounded dispatch 1 of 2: check/write split for the two remaining writers, plus the guard rewrite.

## Hard scope limits — read before planning anything

A previous attempt at this exact finding grew to 313 changed lines in audit.cjs alone,
timed out, and was reverted (preserved as 168-ABANDONED-T3-REPAIR-SPLIT.patch). Before
that, a 1,458-line staged-installer attempt was reverted. Do NOT restructure. This is a
REORDERING task plus one guard assertion rewrite. If your working diff in audit.cjs
exceeds ~120 lines or you find yourself adding new subsystems, stop and reconsider: you
are rebuilding, not reordering. Forbidden outright: any `*-installer-stage` mode,
installer self re-execution, whole-root snapshots.

Baseline that must hold, checked FIRST and LAST: real `install.sh --init-project` from a
decoy cwd into an empty project exits 0 delivering 17 hooks and 9 `scripts/lib` modules;
install-contract 5/5; guard 13/13.

## The CRITICAL, verbatim from phase ATC

> `install.sh:1292` publishes project hooks/modules, then dispatches global install,
> initialization, or update at lines 1303-1311. Those paths subsequently run
> rejection-capable substrate repair and Codex registration (`install.sh:1014-1015`,
> `1110-1111`); global installation can also fail after publication. Direct repair
> similarly publishes at `feature-propagation/audit.cjs:1456` before witness/capability
> repair at lines 1484-1492.
>
> The guard encodes this unsafe order: `assert-installer-registration-guard.cjs:1615` and
> `:1640` require repair after the first writer while only forbidding functions named
> "precheck". A repair failure can therefore exit nonzero after leaving published bytes.

## What already exists — reuse it, do not build new detection

- `precheck_installation_refusals` runs the shared Codex-entry detector and the substrate
  registration pre-check before writers.
- `audit.cjs --check-substrate-capability` (CLI at :1756) is the read-only capability
  check, sharing detection with repair.
- In `runAudit`, `checkSubstrateHookRegistrations` already precedes publication; the gap
  is that the CAPABILITY check does not — publication at :1456 precedes capability repair
  at :1484-1492, and capability repair can refuse (broker_missing, upstream_missing).

## The work

1. **install.sh:** extend the existing pre-write block so the capability check
   (`--check-substrate-capability`, with the same flags the later repair will use) and the
   Codex-registration check both run and can refuse BEFORE `publish_project_install_contract`
   and before any other destination write, on every entry point (init, update, global-with-
   project). After the first write, `repair_substrate_capability` and
   `register_codex_hooks` become write-only in effect: they may hard-fail on a real IO
   error, but every policy refusal they could raise must already have been raised by the
   pre-write check. Do not duplicate detection; call the existing check.
2. **audit.cjs `runAudit`:** run the capability check before `publishProjectHookInstall`,
   mirroring what registrationCheck already does. Reordering within the existing function,
   not a redesign.
3. **Guard:** replace the name-based ordering assertions at :1615 and :1640. Enumerate the
   rejection-capable functions BY NAME IN A LIST IN THE TEST — `precheck_installation_refusals`,
   `precheck_global_installation`, `preflight_existing_repo_local_hooks`,
   `precheck_codex_hook_registration`, the capability check invocation, and any others you
   introduce — and assert each appears before the first destination write on every entry
   point, with repair/registration after publication now asserted as non-refusing writers.
   The assertion must FAIL if someone later adds a rejecting call after the first write,
   which is the property the "precheck"-name matching could not deliver.

## Constraints

- Never weaken or delete an assertion; the two you replace must be strictly stronger.
- P167 witness contract untouchable. The witness-only repair keeps managing only the
  Pre/Post witness ids.
- Fixture paths contain SPACES.

## Verify

- Real install FIRST and LAST: exit 0, 17 hooks, 9 modules.
- guard `--all` 13/13; install-contract 5/5; `audit.cjs --self-test`.
- `bash -n super-gsd/install.sh`, `node --check` on files modified.

Sandbox denials: mark DENIED, never as passing. Do not ask approval.
Standard block format, max 300 words.

# Spec-compliance review returned FAIL on P168-T1 with three cited findings. Fix all three.

Commit under review: 7550116. Full review at
`.planning/milestones/v4.0-install-contract/phases/168-install-contract/168-T1-SPEC-REVIEW.md`.
Do not re-litigate the verdict. Every citation below was checked by the reviewer.

Confirmed intact, do not disturb: the closure computation (lexed, constants reduced, no
hand-maintained production list), P167's witness contract, and the
`unresolved-module-refuses-before-write` and `generated-transitive-manifest` criteria,
which are MET.

## CRITICAL — refuse-before-write is violated at the installer level

The contract module is fine: candidate smoke precedes its own publication
(hook-install-contract.cjs:740). The INSTALLER is not. Project bytes are published at
`install.sh:1195` before global/init/update dispatch, and rejection-capable work follows:

- `ensure_gsd_base` can reject after publication (install.sh:479)
- update preflights existing hooks afterwards (install.sh:1018)
- settings, npm, repair and Codex registration then perform UNJOURNALED writes and may
  fail (install.sh:1021, install.sh:1048)

And the guard now asserts this incorrect order at
`assert-installer-registration-guard.cjs:1460` (`publication < global dispatch`). A test
that enshrines the wrong ordering is worse than no test.

This is the FOURTH appearance of this class: install.sh (2c237ef),
`repairClaudeSubstrateWitness` (b2a1435), the P168 plan itself (caught at plan review),
and now here.

Fix: every rejection-capable step in the whole installer runs BEFORE the first
destination write. Move the checks, not the writes, unless a check genuinely requires
published bytes, in which case state precisely which and why it cannot run against the
candidate tree. After the first write only journaled transactional publication and
non-rejecting verification may remain. Then correct the guard assertion at :1460 to
require the CORRECT order, and make it fail if a rejection-capable step is ever
reintroduced after the first write.

## HIGH — the loadability classifier can accept a load failure

`boundedLine` flattens stdout and stderr into one line (preflight:43) and the anchored
classifier ends in `.*` (preflight:75), so this is ACCEPTED:

    [some-id] blocked: reason\nError: failed to load

Production screens `MODULE_NOT_FOUND` first (preflight:671) so it is currently masked
there, but the final-installed-hook caller invokes the shared classifier directly and
wrongly passes such output (assert-install-contract.cjs:333).

Fix: a clean policy decision must be the WHOLE of the output, not a prefix with arbitrary
trailing diagnostics. Any additional error-shaped content means the hook did not cleanly
decide, and must not be accepted. Keep the classifier shared; fix it once.

## MEDIUM — laundering is still incomplete, in both directions

- The module branch DISCARDS the real output and synthesizes
  `Cannot find module '<request>'` (preflight:50). The real message must survive.
- Non-module output is flattened and disclosed up to 2048 bytes with no stack-frame
  sanitisation, so raw stacks can leak.

Fix both: preserve the real bounded message in every branch, and sanitise stack frames
rather than dumping them. Bounded disclosure means real content, bounded and cleaned, not
a synthesised constant in one branch and a raw stack in another.

## Constraints

- Never weaken a test to pass. The :1460 assertion must be corrected, not deleted.
- Fixture paths contain SPACES.
- P167 witness contract untouchable.

## Verify

- installer-registration-guard --all (13/13)
- install-contract (3/3)
- assert-propagation, assert-witness-correlation, assert-hook-contract,
  assert-prompt-contracts
- feature-propagation --self-test
- bash -n install.sh, node --check on every file modified

Sandbox denials: mark DENIED. The orchestrator re-runs unsandboxed. Do not ask approval.

Standard block format, max 350 words.

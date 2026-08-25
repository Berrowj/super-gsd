# Two things: account for 17 removed assertions, and fix the two Clarity cases.

Green and not to be touched: install-contract 3/3, and guard cases preflight-static,
smoke-static, bundled-overlay-static, bundled-overlay-current, vendored-nine-hook,
node-check-both-sites, deployed-hook-smoke, hook-distribution-all-types,
hook-manifest-completeness, brokered-substrate-capability,
witness-repair-smoke-no-mutation. Eleven of thirteen pass.

## Part 1 — 17 assertions were removed; you justified 5 cases, not 17 assertions

The full list is at
`.planning/milestones/v4.0-install-contract/phases/168-install-contract/168-REMOVED-ASSERTIONS.txt`.

For EVERY removed assertion, do one of exactly two things:

(a) RESTORE it, retargeted to the current contract if the vocabulary moved; or
(b) KEEP it removed and give a one-line reason naming the assertion and stating what now
    covers that behaviour, or that the behaviour no longer exists by design.

"The design changed" alone is not a reason. Name the replacement.

Two need particular care:

- `assert.equal(output.includes('MODULE_NOT_FOUND'), false, 'raw installed-hook output
  leaked from refusal')`. This forbade leaking raw hook output. The new design
  deliberately surfaces MODULE_NOT_FOUND, so the old rule is genuinely inverted. Do NOT
  simply delete it. Replace it with a BOUNDED-DISCLOSURE assertion: the refusal carries
  the structured request/path/message and stays within the bounded-line limit, and does
  not dump unbounded raw stdout/stderr. Something must still guard disclosure.

- The install-ordering assertions (`global hook distribution runs after smoke`,
  `global smoke runs before script dependencies are deployed`, `global settings merge runs
  before hook smoke`, `Codex entries are copied before the repo hook inventory`). If T1's
  reordering made these obsolete, the replacement must still assert the NEW required
  order, because refuse-before-write depends on ordering and has already been a CRITICAL
  twice in this codebase. Ordering must not become unasserted.

## Part 2 — the two Clarity cases fail for a different reason

`sgsd-update-clarity-shape` and `sgsd-update-clarity-recovery`:

    FAIL: expected three covered project warnings:
    {"ok":true,"witness_status":"current","capability_status":"missing_or_stale",
     "reasons":["broker_missing","upstream_missing"],"detail":null,
     "underlying_error":null,"substrate_granted":false}

This is not the module-closure class. Diagnose it properly before changing anything and
say in your report which of these it is:

  (i) the fixture no longer provisions something it used to, so the scenario is stale; or
  (ii) T1 changed real behaviour so the broker/upstream are genuinely no longer set up on
       this path, which would be a REGRESSION in delivery and must be fixed in the
       product, not the test.

Do not retarget the assertion to accept `broker_missing` unless you can show (i).

## Constraints

- Never weaken to pass. If the honest answer is a regression, fix the product.
- Fixture paths contain SPACES.

## Verify

- All 13 guard cases with exit codes.
- install-contract must stay 3/3.
- node --check on every file modified.

Sandbox denials: mark DENIED. The orchestrator re-runs unsandboxed. Do not ask approval.

Report the standard block, the Part 2 diagnosis (i or ii with evidence), and one line per
removed assertion. Max 450 words.

# Hotfix: source digests pinned from CRLF bytes fail on every Linux checkout. Diagnosed with proof.

## The field failure, from a real Linux install (devcp) at e9d94ec

Module delivery WORKED: 9 scripts/lib modules landed, 4 witness registrations written.
The install then refused with `witness_status: missing_or_stale`, reasons
`source_drift, direct_grant, upstream_missing`, exit 5, pin unwritten.

## Root cause, verified byte-for-byte by the orchestrator — do not re-derive

    pin in repo-settings-overlay.json:  5640a8ed92467cde81c80b95b747f3dd55285c2bdc338e26dc1c353db1fc1642
    Windows working tree (CRLF) digest: 5640a8ed...   (matches pin)
    git blob / Linux checkout (LF):     fd147b8d8abf4c3b84a012e62fee222b83f9adb53b289092e3636ae16b1139aa
    checker: audit.cjs:314-316 sha256(fs.readFileSync(p)) — raw bytes, no normalization
    comparison: audit.cjs:484-491, sgsd_source_sha256 !== sourceDigest -> 'source_drift'

The pin was generated from CRLF working-tree bytes on Windows; git stores LF; Linux checks
out LF. So EVERY Linux machine gets source_drift, which makes registrationCheck.ok false,
which SKIPS capability repair, which leaves direct_grant and upstream_missing unrepaired.
One bug, three stacked reasons, total refusal on Linux.

## The fix

1. Add ONE shared normalized-digest helper: sha256 over content with CRLF normalized to
   LF. Use it on BOTH sides of every cross-platform pinned-source comparison:
   - the sgsd_source_sha256 comparison in audit.cjs (:484-491) and anywhere else source
     pins are checked,
   - wherever those pins are GENERATED,
   - the hook-manifest dependency sha256 fields and the delivery/inspection comparisons in
     hook-install-contract.cjs (candidate row digests, requiredFiles status), so a
     Windows-written manifest verifies on Linux and vice versa.
   Digests of JSON documents built in-memory (definition_sha256) are not file-read and
   need no change; leave them.
2. Regenerate the committed pin values to the normalized digests: both
   sgsd_source_sha256 occurrences in repo-settings-overlay.json (expect fd147b8d... for
   the witness hook) and the hook-manifest.json sha256 fields, using the generator, not
   by hand-editing values.
3. Regression tests:
   - assert every committed pin equals the normalized digest of its source file, so a
     future regeneration from platform-variant bytes fails CI on any OS;
   - assert the checker accepts a file whose only difference from the pinned content is
     CRLF vs LF, and still REJECTS a one-byte content change.

## Constraints

- This is a digest-canonicalisation fix ONLY. Do not touch ordering, the closure walk,
  P167 witness semantics, or anything from the P169 transaction scope.
- Normalization is CRLF->LF only. No whitespace trimming, no BOM stripping beyond what
  exists today — keep the canonical form minimal and stated in a comment.
- Never weaken an assertion. Fixture paths contain SPACES.

## Verify

- Real install from a decoy cwd into an empty project: exit 0, 17 hooks, 9 modules.
- installer-registration-guard --all 13/13; install-contract all cases;
  audit.cjs --self-test; node --check on files modified.
- Print the new pin value(s) in your report.

Sandbox denials: mark DENIED. Do not ask approval. Standard block, max 250 words.

## PATCH-MODE ADDENDUM — dispatch A of 2, production files only

You are in read-pack patch mode: output ONE unified diff; you cannot run commands.
This dispatch covers ONLY the four production files in the manifest. The two test files
are dispatch B; do not reference or modify them here.

Because you cannot execute node, do NOT hand-compute digest values:

- Do not edit the sha256 VALUES in repo-settings-overlay.json or hook-manifest.json by
  hand. Instead, add a small CLI mode to audit.cjs, `--write-source-pins`, which rewrites
  every sgsd_source_sha256 in repo-settings-overlay.json from the normalized digest of
  the corresponding hook source, atomically (tmp+rename), printing old->new per pin.
  hook-manifest.json regeneration already exists (`hook-install-contract.cjs
  --write-manifest`); just make its digesting use the shared normalized helper.
- The orchestrator will RUN both generators after applying your patch and commit the
  regenerated values.

Deliverables in this diff:
1. The shared normalized-digest helper (CRLF->LF only, comment stating the canonical
   form), used by: audit.cjs source-pin comparison (:484-491) and any other file-read
   source-pin check; hook-install-contract.cjs manifest generation, candidate row
   digesting, delivery validation and inspectProjectInstall comparison.
2. The `--write-source-pins` mode in audit.cjs.
3. Nothing else. No test changes, no ordering changes, no P167 semantic changes.

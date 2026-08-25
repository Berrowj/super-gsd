# CRLF fix, dispatch B2: two P167 test files pin raw digests. Patch mode, one unified diff.

Production now canonicalizes CRLF->LF before hashing any source file compared against
sgsd_source_sha256 (audit.cjs, hook-install-contract.cjs, and
substrate-invocation-witness-store.cjs readiness). Committed pins are LF-normalized.

Both suites in the manifest now FAIL on this Windows CRLF checkout:

- assert-hook-contract.cjs: `AssertionError: pretooluse_stale` — a fixture computes the
  expected sgsd_source_sha256 with a RAW sha256 of hook bytes (CRLF here), while the
  store compares against the normalized digest.
- assert-witness-correlation.cjs: strict-equal failure of the same class.

Fix: wherever these tests compute a digest of a source FILE to place into a settings
entry / expectation compared against sgsd_source_sha256, normalize CRLF->LF before
hashing, matching production's canonical form (CRLF->LF only). Do NOT touch HMAC
computations, record digests over in-memory JSON, payload digests, or any acceptance
semantics — only source-file pin computations.

Do not weaken any assertion. Both suites must pass on CRLF and LF checkouts alike.

Report: the functions/lines changed, max 100 words.

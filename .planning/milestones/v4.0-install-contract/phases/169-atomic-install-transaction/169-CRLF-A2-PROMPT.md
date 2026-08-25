# CRLF digest fix, dispatch A2: one remaining comparison site, in the witness store.

Patch mode: output ONE unified diff for the single file in the manifest. You cannot run
commands.

## Context, established

Source pins are now LF-normalized digests (CRLF->LF before hashing), regenerated in
repo-settings-overlay.json to fd147b8d... The audit and install-contract sides already
use a shared normalized helper. One site was missed and now refuses on Windows CRLF
checkouts with `pretooluse_stale`:

`substrate-invocation-witness-store.cjs`:

    :18  function sha256(value) { ... }            // raw
    :234 digest = sha256(fs.readFileSync(sourcePath));   // hashes installed hook, raw bytes
    :179 entry.sgsd_source_sha256 !== expected.source_digest   // vs normalized pin -> mismatch

## The change

At :234 (and any other place THIS FILE hashes a source FILE read from disk for comparison
against sgsd_source_sha256), normalize CRLF->LF before hashing. Inline a tiny helper with
the same one-line comment used in audit.cjs stating the canonical form (CRLF->LF only,
nothing else). Do NOT change:

- sha256 of the project-path identity (:45),
- the HMAC signing/verification (:23, :281, :294),
- record digests over in-memory JSON,
- any acceptance/consumption semantics.

This canonicalizes line endings only; a one-byte content change must still mismatch.

Report: the exact lines changed, max 120 words.

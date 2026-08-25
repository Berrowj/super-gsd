---
name: digest-pins-from-platform-variant-bytes
description: Never pin a sha256 computed from working-tree bytes; CRLF checkouts and LF checkouts hash differently
metadata:
  type: errors
---

# A digest pinned from working-tree bytes fails on the other OS

2026-08-26, devcp field failure. `sgsd_source_sha256` pins were computed on Windows from
CRLF working-tree bytes (`5640a8ed...`); git stores LF and Linux checks out LF
(`fd147b8d...`). The checker hashed raw file bytes, so every Linux install reported
`source_drift`, which cascaded: registration check failed -> capability repair skipped ->
`direct_grant`/`upstream_missing` never repaired -> total refusal, while module delivery
itself had succeeded. One bug, three stacked reason codes.

**Diagnosis shortcut that proved it in one command:** compare three digests — the pin,
`sha256(working file)`, and `git cat-file blob HEAD:<path> | sha256sum`. If pin==working
but !=blob, the pin was taken from platform-variant bytes.

**The rule.** Any digest compared across machines must be computed over a canonical form
on BOTH the generation and verification side. Here: CRLF->LF only, nothing else, one
shared helper, stated in a comment. Regenerate committed pins via the generator
(`audit.cjs --write-source-pins`, `hook-install-contract.cjs --write-manifest`), never by
hand. Guard it: pins must equal the normalized digest of their source on any OS;
line-ending-only variants are CURRENT; a one-byte tamper still refuses.

Watch for the same class in: any new manifest field hashing a file, fixture expectations
in tests (three test files were computing raw pins), and HMAC inputs (exempt — they sign
in-memory records, not file reads).

Related: [[error-laundering-closed-vocabulary]] (the stacked reasons initially hid this),
[[onedrive-tenant-folders-are-junctions]].

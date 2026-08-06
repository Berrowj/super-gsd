---
title: writer accepts caller destination
tags: [security, path-validation, p146, recurring]
importance: 70
maturity: raw
created: 2026-08-06T23:29:09Z
---

# Anti-Pattern: Writer Accepts a Caller-Supplied Destination

**Shipped as CRITICAL three times in a single phase (v3.5 P146).**

## The shape
A function that writes evidence, settings, or logs takes the destination path
as a parameter and trusts it. Every instance passed its own tests, because the
tests always passed a legitimate path.

## The three instances
1. **T146-01 `gate-evidence-log.cjs`** — `logGateEvidence(dir, row)` created
   `<any-dir>/metrics/gate-evidence.jsonl` and returned `status: ok`. Broke the
   board-binding rule that a non-SGSD repo must produce zero SGSD metrics.
2. **T146-02 `merge-settings.js`** — `--repo-local-hooks <overlay> <target>
   <root>` wrote settings to any target, including `~/.claude/settings.json`,
   which holds live API keys. Exit 0.
3. **T146-02 again** — after bounding it lexically (`path.resolve`/`path.join`),
   an NTFS junction on `.claude` still escaped: the derived-target check passed
   while the write landed elsewhere.

## The rule
**Derive the destination; never accept it.** If an explicit path is offered,
accept it only when it is byte-identical to the derived one AFTER
`fs.realpathSync` on the nearest existing ancestor. Re-validate immediately
before the rename in a write-temp-then-rename flow — a directory can be swapped
between check and rename. Refuse with a distinct nonzero exit, write nothing,
leave no `.tmp` artifact.

Lexical validation is not enough on Windows: junctions are ordinary, not exotic.

## Cheapest prevention
Put the rule in the executor prompt before the code is written. After it was
front-loaded (T146-05 onward), the next task passed review with zero findings.

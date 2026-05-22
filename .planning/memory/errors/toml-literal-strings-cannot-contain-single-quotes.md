---
name: TOML literal strings cannot contain single quotes
description: When writing TOML strings that contain a single quote (e.g. regex character classes like [^\s"']), use the triple-single-quote multi-line literal form. Single-quoted literal strings have NO escape sequence — doubling the quote breaks the parser, it does not escape.
type: feedback
date: 2026-04-30
related: super-gsd/docs/SGSD-WARP-CUSTOMIZATION.md
---

# TOML literal strings cannot contain single quotes

## Rule

In TOML, single-quoted literal strings (`'...'`) have **no escape
sequences at all**. They cannot contain a `'`. Doubling it is **not** an
escape — the parser sees the first `'` close the literal, then `''` as
an empty literal, then a new `'` opening a fresh literal, which corrupts
every byte after that point.

When the value needs to contain a `'` (very common in regex patterns
that include character classes like `[^\s"']`), use the **multi-line
literal string** form: triple single quotes `'''...'''`. Inside those,
single quotes are literal and need no escaping.

## Why

Operator caught this on **2026-04-30** after I appended six SGSD
secret-redaction regex patterns to Warp's `settings.toml`. I escaped the
inner `'` as `''` (TOML newcomer trap — string-escape semantics from
other languages do not apply). The TOML parser broke at every
`[^\s"'']` segment, which would have killed every pattern after the
first SGSD entry on Warp's next reload. Operator manually fixed by
switching to `'''...'''` and asked me to log the rule.

## How to apply

- Hand-writing TOML where the value contains a `'` (regex, paths with
  apostrophes, prose with contractions) → use `'''...'''`.
- Do NOT try to escape `'` inside `'...'` — TOML simply does not have
  that escape. Options are:
  - `"..."` (basic string, supports `\'`/`\"`/`\n`/etc. escapes)
  - `'''...'''` (multi-line literal, no escapes needed)
- Same rule applies to `pyproject.toml`, `Cargo.toml`, any
  hand-authored TOML — not Warp-specific.
- When the operator mentions "TOML" / "settings.toml" / "pyproject" and
  the value has regex metacharacters or any kind of quote, reach for
  `'''...'''` first.

## Pattern of fix (verbatim from this session)

Before (broken):

```toml
{ name = "X", pattern = '[^\s"'']+' }
```

After (correct, regex unchanged from the original intent):

```toml
{ name = "X", pattern = '''[^\s"']+''' }
```

## Related

- This is logged under project memory at `.planning/memory/errors/`
  because the user-level auto-memory directory at
  `~/.claude/projects/.../memory/` is sandbox-restricted from my Write
  tool (OneDrive-protected mount point). Project memory still gets
  picked up by SGSD memory tooling and is git-tracked.

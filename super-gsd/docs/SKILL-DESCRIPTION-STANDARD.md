# Skill Description Standard

This is the canonical description contract for repo-owned
`super-gsd/skills/*/SKILL.md` files and for instance-local skills governed by
the Super GSD overlay. A description is routing metadata, not a short title.
It must let an agent decide both when to enter the skill and when to stay out.

## Required content

Every frontmatter `description` must state all four of these:

1. **Positive trigger conditions.** Name the user intent, inputs, or workflow
   state that should select the skill. Prefer direct wording such as “Use when
   preparing…” or “Run when the operator asks…”.
2. **Boundary against neighbouring skills.** Name the closest overlapping skill
   or surface and state the selection rule between them. If there is no named
   neighbour, identify the adjacent class of work instead.
3. **When NOT to use it.** Include an explicit negative condition. Do not rely
   on readers inferring exclusions from the positive trigger.
4. **Safety posture.** Say whether the skill is read-only, produces a proposal
   or dry-run, mutates local state, contacts an external service, or requires an
   operator gate. State the gate before the risky action.

The `/create-quote` family is the model for safety wording: resolve inputs and
build a dry-run first; keep live posting behind an explicit operator-controlled
gate. Use the same ordering for any skill where preview, approval, and mutation
are distinct stages.

## Recommended shape

```yaml
---
name: governed-example
description: >-
  Use when preparing a governed artifact from confirmed source inputs. Prefer
  the record-resolver skill when the request is entity reconciliation; do not
  use this skill for exploratory lookup. Produce a dry-run first and require
  explicit operator approval before any live write.
---
```

Keep the description specific enough to route without opening the skill body.
Long procedure, command syntax, and implementation detail belong below the
frontmatter.

## Mechanical lint

Run:

```text
node super-gsd/tools/skill-description-lint/lint.cjs --skills-dir super-gsd/skills
node super-gsd/tools/skill-description-lint/lint.cjs --skills-dir super-gsd/skills --json
```

The lint recursively reads `SKILL.md` files, uses the repository-pinned
`js-yaml` `JSON_SCHEMA`, rejects duplicate YAML keys, and never rewrites a
file. Findings contain only a stable relative file and reason code:

- `description_missing` — description is absent, blank, non-text, or has no
  normalized lexical content.
- `description_one_noun` — normalized lexical content contains one token and
  is too weak to route.
- `frontmatter_malformed` — delimited YAML frontmatter is missing, is not a
  mapping, is invalid, or contains a duplicate key.

Exit status is `0` for no findings, `1` for findings, and `2` for invalid
input or an internal failure. The lint intentionally enforces only the
mechanical floor; reviewers enforce the four semantic requirements above.


---
name: sgsd-sepl
description: "Operator-gated resource-grain improvement loop — propose, review, commit. DLB-04 Wave B. Sub-agents emit proposals to .planning/proposals/; operator applies or rejects. Never auto-commits. Complements /sgsd-deliberate (architecture grain)."
allowed-tools:
  - Read
  - Write
  - Bash
---

<objective>
Handle single-file resource-grain improvements — rule additions, small script tweaks, agent/skill frontmatter edits — via an operator-gated propose→commit loop. This sits BELOW /sgsd-deliberate's architecture grain.

When invoked, either:
1. Draft a new proposal (when the user describes a small change)
2. List pending proposals for operator review
3. Apply or reject a specific proposal
</objective>

<script_location>
Scripts live at ONE of:
- `super-gsd/scripts/sgsd-sepl-propose.sh` and `sgsd-sepl-commit.sh` — in-project
- `~/.claude/super-gsd/scripts/sgsd-sepl-propose.sh` and `sgsd-sepl-commit.sh` — global fallback
</script_location>

<usage_modes>

## Mode A: Draft a proposal

When the user says "propose X for Y" or when a sub-agent wants to flag a small improvement rather than auto-commit:

```bash
echo "<body>" | bash <path>/sgsd-sepl-propose.sh \
    --type <rule|script|agent|skill|config|doc> \
    --target <repo-relative-path> \
    --description "<what, ≤120 chars>" \
    --rationale "<why>"
```

Writes proposal to `.planning/proposals/YYYY-MM-DD-<slug>.md` with status=pending. Logs a "proposal" event to `.planning/metrics/sepl-log.jsonl`.

## Mode B: List pending proposals

```bash
ls -la .planning/proposals/*.md 2>/dev/null && \
grep -l '^status: pending$' .planning/proposals/*.md 2>/dev/null | head -20
```

For each: show frontmatter summary (type, target, description, rationale).

## Mode C: Apply a proposal

Operator reviews a pending proposal, then:

```bash
bash <path>/sgsd-sepl-commit.sh <proposal-path> --apply
```

Behaviour by resource_type:
- `rule` → append body to target
- `script|agent|skill|config|doc` → overwrite target

Atomic git commit with message `feat(sepl): <slug> — <description>`.

## Mode D: Reject a proposal

```bash
bash <path>/sgsd-sepl-commit.sh <proposal-path> --reject
```

Marks proposal rejected, logs event, commits as `chore(sepl): reject proposal <slug>`.
</usage_modes>

<invariants>
- **Operator decides retirements.** Auto-committing a rule addition retires the prior rule state; this violates DLB-04 Q2's invariant. Always --apply or --reject explicitly.
- **Slug discipline.** Kebab-case only, ≤60 chars, no ISO dates or Z-timestamp tails. Matches sgsd-curate's guard.
- **/sgsd-deliberate is for architecture grain.** If the change touches multiple files, cross-cutting concerns, or an entire subsystem, use /sgsd-deliberate instead.
</invariants>

<kill_condition>
Per DLB-04 Q2: if `.planning/metrics/sepl-log.jsonl` shows zero proposals submitted during a milestone, retire `sgsd-sepl-propose.sh` at milestone close — coarser-grain /sgsd-deliberate was sufficient.
</kill_condition>

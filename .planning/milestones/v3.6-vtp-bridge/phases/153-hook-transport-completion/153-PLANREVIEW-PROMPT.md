# P153 Plan Review — ATC + MUDA + plan-check (pre-execution gate)

You are reviewing a LOCKED plan before any code is written. Do not write or modify
any source file. Read only. Produce a verdict.

## Read these

- `.planning/milestones/v3.6-vtp-bridge/phases/153-hook-transport-completion/CONTEXT.md`
- `.planning/milestones/v3.6-vtp-bridge/phases/153-hook-transport-completion/153-01-PLAN-LOCKED.md`
- `super-gsd/hooks/sgsd-intent-classifier.cjs`
- `super-gsd/scripts/sgsd-triage-runtime.cjs`
- `super-gsd/config/repo-settings-overlay.json`
- `super-gsd/scripts/merge-settings.js`
- `super-gsd/registry/session-governance-hooks.yaml`
- `super-gsd/tools/codex-hooks/block-secret-leak.cjs`
- `super-gsd/registry/hooks.yaml`

## What the phase claims

The classifier `sgsd-intent-classifier.cjs` self-declares as a UserPromptSubmit hook
but no UserPromptSubmit event is registered in the live Claude Code settings file, so
the governance routing built in P149/P151/P152 never executes in a live session.
The plan has three tasks: T0 fixes the triage runtime's MCP arg shapes, T1 registers
the hook and adds a two-directional live falsifier, T2 adds a fifth enforcement kind
`block` (stderr reason then exit 2) with the existing secret-leak guard as first consumer.

## Your job — answer each explicitly

**1. Plan-check (goal-backward).** If all three tasks complete exactly as specified,
is the phase goal achieved? Name any gap between the tasks and the stated goal.

**2. Falsifiability of the ACs.** The plan carries 9 `semantic_acceptance_criteria`.
For EACH, state whether it could pass while the production path remains broken. This
codebase has EIGHT recorded instances of the anti-pattern where a green harness test
coexists with a dead production caller. The T1 negative-direction AC is the one most
at risk: it must assert on a WRITTEN no-match row, never on an absent row. Confirm the
plan actually forces that, or flag it.

**3. Verify the central factual claim.** Independently check that no UserPromptSubmit
hook is registered and that `sgsd-intent-classifier.cjs` genuinely expects that event.
If the claim is wrong, say so plainly — the whole phase rests on it.

**4. ATC 7-step.** Apply first-principles / delete / simplify. Specifically:
- Is T2 justified, or is it speculative scaffolding (YAGNI)? The stated justification
  is that warning-only enforcement demonstrably fails to change agent behaviour and
  that `block-secret-leak.cjs` is an existing real consumer. Challenge that.
- Can any task be deleted or merged without losing the goal?
- Does the plan increase complexity more than necessary (delta-complexity <= 0)?

**5. MUDA (8 wastes).** Flag overproduction, extra processing, or inventory. In
particular: are three tasks the minimum, or is this padded?

**6. Blast radius.** T1 mutates the operator's LIVE `~/.claude/settings.json` via
`merge-settings.js`. Review that script's safety: is the merge idempotent, does it
preserve existing hooks, and can it corrupt the file on partial write? A backup has
already been taken at `~/.claude/settings.json.P153-pre-merge.bak`. Flag any risk that
a bad merge breaks the operator's tooling. NOTE: that settings file contains API keys
in an env block — never read, print, echo or quote that block. Inspect only the hooks
section by key.

**7. Constraint compliance.** The plan forbids: copying source from
`disler/claude-code-hooks-mastery` (no LICENSE, all-rights-reserved), adding Python/uv
hooks, and flipping the P152 kb-lookup-triage route from `shadow` to blocking. Confirm
the plan as written cannot violate these.

## Output format — exactly this, max 700 words

```
VERDICT: GO | GO-WITH-CHANGES | NOGO
GOAL_GAP: <gap between tasks and goal, or none>
AC_RISK: <per-AC list of any AC that could pass while production stays broken, or none>
CLAIM_CHECK: CONFIRMED | REFUTED — <what you actually observed in the files>
ATC_FINDINGS: <numbered, each with severity CRIT|MAJOR|MINOR>
MUDA_FINDINGS: <numbered, or none>
BLAST_RADIUS: <merge-settings.js safety assessment>
CONSTRAINT_COMPLIANCE: PASS | FAIL — <which constraint, if any, is at risk>
REQUIRED_CHANGES: <numbered list the planner must make, or none>
```

Be adversarial. A GO verdict on a plan that later fails costs more than a NOGO now.

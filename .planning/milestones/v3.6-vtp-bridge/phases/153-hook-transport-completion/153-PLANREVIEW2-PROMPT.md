# P153 Plan Review — ROUND 2 (post-NOGO re-review)

You reviewed rev 1 of this plan and returned NOGO. Rev 2 is now committed. Review it
again. Read only; do not modify any source file.

## Read these

- `.planning/milestones/v3.6-vtp-bridge/phases/153-hook-transport-completion/153-01-PLAN-LOCKED.md` (rev 2)
- `.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/CONTEXT.md` (the split-out T0)
- `super-gsd/scripts/merge-settings.js`
- `super-gsd/config/repo-settings-overlay.json`
- `super-gsd/hooks/sgsd-intent-classifier.cjs`
- `super-gsd/tools/codex-hooks/block-secret-leak.cjs`

## Your four REQUIRED_CHANGES from round 1

1. Specify the exact target and command: preferably repo-local `--repo-local-hooks`;
   if global is mandatory, use a dedicated UserPromptSubmit-only overlay with an
   absolute installed script.
2. Require actual Claude-dispatched probes, with debug/provenance evidence, for
   planning, no-match, P149, P152, secret, and benign paths.
3. Validate T0 via authoritative schemas plus real MCP calls.
4. Split T0 and replace generic T2 with direct dual-surface guard registration, or
   justify a second current consumer.

## What rev 2 claims to have done

1. Pinned the target to `merge-settings.js --repo-local-hooks`; global settings
   explicitly forbidden and recorded as a known dead end.
2. Re-anchored the ACs on dispatch provenance — the route-decision row must carry
   `hook_event_name`, `session_id` and a `transcript_path` that RESOLVES ON DISK —
   plus a new control AC in which the classifier is spawned directly with the hook
   unregistered and the provenance assertion MUST FAIL.
3. T0 moved to P154 with an explicit acceptance note requiring authoritative schemas
   (not hand-copied duplicates) and a test that fails pre-fix.
4. T0 split out; the generic fifth `block` enforcement kind dropped entirely. T2 is
   now just: make the existing `block-secret-leak.cjs` exit 2 and register that same
   implementation on the Claude surface, with a `dual-surface-shared` AC asserting one
   shared implementation rather than a duplicated copy.

## Answer explicitly

**A. Change verification.** For EACH of your four required changes: ADDRESSED /
PARTIALLY ADDRESSED / NOT ADDRESSED, with the specific evidence you found in rev 2.

**B. Is the provenance mechanism sound?** Rev 2 asserts a harness spawn cannot supply
a `transcript_path` that resolves on disk. Attack that claim. Can a determined or
careless executor satisfy the provenance assertion without a genuine Claude dispatch —
for example by copying a real transcript path, reusing a stale session id, or setting
an env var? If yes, name the concrete bypass and say what would close it. This is the
single most important question in this review: rev 1 died on exactly this class of
defect and I need to know if rev 2 actually fixed it or just moved it.

**C. Coverage gap.** Your round-1 change #2 asked for probes covering P149 and P152
paths specifically. Rev 2's ACs cover planning-match, no-match, secret, benign,
dual-surface and P152-unchanged. Is the P149 skill-routing path adequately proven by
the planning-match AC, or does it need its own probe?

**D. Fresh adversarial pass.** Ignore round 1. Is there anything NEW wrong with rev 2 —
new complexity, a contradiction introduced by the revision, an AC that cannot actually
be implemented as written, or a task whose stop_rule is unreachable?

**E. Blast radius, re-checked.** With the target now repo-local, confirm the global
settings file cannot be touched by this plan as written. Note: the settings file
contains API keys in an env block — never read, print, echo or quote that block.

## Output format — exactly this, max 600 words

```
VERDICT: GO | GO-WITH-CHANGES | NOGO
CHANGE_1: ADDRESSED | PARTIAL | NOT — <evidence>
CHANGE_2: ADDRESSED | PARTIAL | NOT — <evidence>
CHANGE_3: ADDRESSED | PARTIAL | NOT — <evidence>
CHANGE_4: ADDRESSED | PARTIAL | NOT — <evidence>
PROVENANCE_SOUND: YES | NO — <concrete bypass if NO, and the fix>
P149_COVERAGE: SUFFICIENT | NEEDS_OWN_PROBE — <why>
NEW_FINDINGS: <numbered with severity CRIT|MAJOR|MINOR, or none>
BLAST_RADIUS: <can the global settings file be touched? yes/no + why>
REMAINING_BLOCKERS: <numbered, or none>
```

If rev 2 is good enough to execute, say GO. Do not manufacture findings to appear
rigorous — but do not wave through a provenance mechanism that does not actually
discriminate.

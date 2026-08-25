# P167-T3 fix round 1 — caller-coverage is red, and you predicted it

Your own BLOCKERS line called this. The orchestrator ran the suites:

```
assert-prompt-contracts (T3)     exit 0 PASS  (4/4)
assert-hook-contract (T1)        exit 0 PASS
assert-witness-correlation (T2)  exit 0 PASS
caller-coverage                  exit 1 FAIL
  AssertionError: missing exact caller occurrences:
    board-tools, enrichment-tools, enrichment-policy
prompt-record-acceptance         exit 0 PASS
executable-emitters              exit 0 PASS
megachunk-degraded-artifact      exit 0 PASS
repair-safe-t2                   exit 0 PASS
composer self-test               exit 0 PASS
enrichment-gate self-test        exit 0 PASS
```

This is the P166 single-consumption inventory behaving correctly. You removed the
two canonical frontmatter grants and replaced the enrichment policy line, so
three registered exact occurrences no longer exist, and the gate refuses to
pretend otherwise.

## The plan has a defect here, and this is how we resolve it

T3's `stop_rule` requires that "caller-coverage still sees the same eight
production branches", and its `verification_cmd` runs caller-coverage. But
`files_touched` for T3 lists only three files and does NOT include
`super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs`, which is
where the inventory lives. T3 cannot satisfy its own stop rule inside its own
scope.

**Resolution: T3's scope expands by exactly that one file.** Record it as a
DEVIATION naming the plan rule, so the phase close carries it honestly.

## What to do

Update the exact-line inventory so it describes reality after T3:

- `enrichment-tools` and `board-tools`: those frontmatter grants are gone from
  the canonical sources. They do not exist anywhere until T4 derives installed
  copies through `audit.cjs`. Reflect that.
- `enrichment-policy`: the line was replaced, so re-register the new exact text.

## The property you must not break

The inventory exists so that a rogue substrate call fails closed. Removing
entries for lines that genuinely no longer exist is correct. Weakening a pattern
so it matches loosely, or dropping a classification that still has a live
occurrence, is not.

After your change, all three of these must still hold, and the orchestrator will
verify each:

1. A rogue substrate call appended to an existing file, for example
   `super-gsd/scripts/sgsd-triage-runtime.cjs`, fails caller-coverage.
2. A rogue substrate call in a brand new file fails caller-coverage.
3. A duplicated legitimate-looking line fails, because classifications are
   single-consumption.

Do not convert an exact match into a broad or unanchored pattern to make this
easier. P166 spent two review rounds and a CRITICAL closing exactly that hole.

If you conclude an entry cannot be removed without creating a gap, say so and
stop rather than removing it.

## Constraints

Four files now: the three from T3 plus the policy test. Nothing else.

Do not weaken T1 (34/34), T2 (13/13), the prompt contracts (4/4), or any other
P166 case.

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

You cannot run the suites (`EPERM` at `mkdtemp`). Do not claim them. If
something still fails, say what you would measure rather than asserting why.

Apply edits early and emit `PROGRESS: <line>` as you go; wrappers have been
killed repeatedly around twenty minutes.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: [P167-T3 files_touched] scope expanded by the policy test, with reason
BLOCKERS: description | none
ONE_LINER: what changed in the inventory and why no gap opens
```

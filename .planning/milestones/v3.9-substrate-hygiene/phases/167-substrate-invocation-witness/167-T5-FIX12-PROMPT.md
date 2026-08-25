# P167-T5 — ALL THREE SCENARIOS PASS. One verification tally is wrong.

The live capture now reports:

```
PROGRESS: active_path      FINISH PASS
PROGRESS: absent_guard     FINISH PASS
PROGRESS: same_user_bypass FINISH PASS
P167_T5_CAPTURE FAIL active_fixture_event_counts_invalid
EXIT=1
```

Every scenario passed. The failure is in `verifyEvidence`, not in the capture:
the recomputed fixture event tally does not equal the tally stored in the
evidence container.

`capture-live-runtime.cjs:2101-2104`:

```js
counts[row.event] = (counts[row.event] || 0) + 1;
...
requireCondition(JSON.stringify(canonicalize(counts)) === JSON.stringify(container.event_counts),
  reason + '_event_counts_invalid');
```

## Instrument first, as before

On failure, print to fd 2 both objects side by side:

- the recomputed `counts`;
- the stored `container.event_counts`;
- the row events that produced the recomputation.

That comparison will name the discrepancy immediately. It has resolved five
rounds in one shot each; do not skip it.

## Likely causes, in order

1. **The stored tally was written before some rows arrived.** If
   `event_counts` is snapshotted at one point and the log keeps growing, for
   example late `notifications/initialized` or a trailing `tools/list`, the
   recomputation legitimately differs. Then the writer must tally from the same
   final read the verifier uses.
2. **Different row sets.** The writer may tally a filtered view while the
   verifier recomputes over all rows, or vice versa.
3. **Canonicalization asymmetry.** One side runs `canonicalize` and the other
   does not, so key order differs while the content matches.

Fix the cause. Do NOT relax the equality to a subset check or drop the
assertion; a tally the evidence cannot reproduce is exactly the kind of
unverifiable claim this file exists to prevent.

## Context worth keeping

This is the last gate before the evidence file is written. Everything the phase
set out to prove is already demonstrated live: the guard denies a non-compliant
call before transport, allows a compliant one, withdraws the tool entirely when
its registrations and source are deleted, and cannot see a same-user actor who
goes around it. The evidence file must now record that faithfully.

## Do not

- Do not weaken any scenario assertion. All three pass.
- Do not fabricate or hand-write the evidence file.
- Do not touch the hook, composer, broker, cap, or v2 schema.

## Scope

`capture-live-runtime.cjs`, and the fixture only if the tally originates there.

Confirm the two pinned digests in `repo-settings-overlay.json` still match the
hook before finishing.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself. Verify
through PowerShell.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: which of the three causes it was, and what now guarantees writer and verifier tally the same rows
```

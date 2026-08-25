# B3: your new line-ending guard case reads the wrong result fields. One file, one diff.

The case fails at assert-installer-registration-guard.cjs:2914 with `undefined !== 'current'`.

`runAudit(...)` returns (audit.cjs:1730-1745) SEPARATE objects:
- `claude_substrate_witness`  -> has `.status` ('current' | 'missing_or_stale') and `.reasons`
- `claude_substrate_capability` -> has `.status`, `.reasons`

There is no `witness_status`/`capability_status` on the capability object; those flat
names exist only in the CLI JSON, not the runAudit snapshot. Check where
`substrate_granted` actually lives in the snapshot (grep audit.cjs) and read it from
there, or assert the equivalent status fields instead if it is CLI-only.

Fix `assertWitnessDigestLineEndingBehavior` (and its tamper half) to read the correct
fields from the snapshot. Do not change production. Do not weaken the assertions: same
three properties proven — line-ending-only accepted as current with no reasons, grant
intact; one-byte tamper rejected.

Report: fields corrected, max 60 words.

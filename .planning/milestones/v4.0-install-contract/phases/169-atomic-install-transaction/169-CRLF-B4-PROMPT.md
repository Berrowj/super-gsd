# B4: the line-ending case now gets witness=current but capability=missing_or_stale. Diagnose statically, fix, self-describe.

Patch mode, one unified diff over the two packed files.

Observed at assert-installer-registration-guard.cjs:2917:

    line-ending-only capability was not reported CURRENT
    + 'missing_or_stale'  - 'current'

Facts already verified by the orchestrator, do not re-check:
- witness status IS 'current' now (store normalization works).
- validateUpstreamManifest uses normalizedSourceSha256 on BOTH write (audit.cjs:943) and
  validate (:607-608).
- broker file comparison at ~:655 is raw sha256(target) vs sha256(source), but the
  fixture copies the broker on one machine, so bytes are identical there.

Your job: trace `runBrokeredSubstrateCapability`'s fixture setup and
`checkClaudeSubstrateCapability`'s reason list to find which reason fires after the test
overwrites ONLY the witness hook with its line-ending variant. Candidate suspects you can
check statically: the fixture's upstream manifest timing (written before or after the
overwrite?), any capability-side digest that reads the WITNESS hook with raw sha256, the
`grant_with_witness_unready` coupling, and whether runAudit in the accepted-probe runs
with flags that skip repair so `upstream_missing` fires because the fixture never wrote a
manifest on THIS path.

Fix the ROOT CAUSE: if a production site still hashes a source file raw for a pinned
comparison, normalize it (CRLF->LF only, same comment); if the TEST's fixture sequencing
is wrong, fix the fixture. Do not weaken what the case proves.

ALSO: change the two status assertions in assertWitnessDigestLineEndingBehavior to include
the reasons array in the assertion message, so a future failure names its reason instead
of printing only the status.

Report: the reason that fired, the root cause, files/lines changed. Max 120 words.

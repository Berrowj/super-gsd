# P150-T150-04c — CONTINUE: 12 remaining reds across 3 suites; the tests are the spec

Deliverables all exist; 4/16 green. Make the remaining 12 green by COMPLETING the deliverable content (do not weaken tests). Red list:

== runbook-contract ==
== global-snapshot-contract ==
== restart-evidence-contract ==
not ok 1 - local helper exposes the approved Prepare/Finalize API -> The input did not match the regular expression /ValidateSet\(['"]Prepare['"],\s*['"]Finalize['"]\)/. Input:
not ok 2 - local Prepare requires matching MCP, displays command lines, and changes cockpit identity -> The input did not match the regular expression /Win32_Process/. Input:
not ok 3 - local Finalize rejects prior MCP identity and requires canonical live provenance -> The input did not match the regular expression /identity_intersection/. Input:
not ok 4 - devcp helper exposes the approved one-shot API and authoritative runtime flags -> The input did not match the regular expression /--project/. Input:
not ok 5 - devcp helper captures Linux MCP, cockpit, and full tmux identities -> The input did not match the regular expression /\/proc\/[^\n]*stat/. Input:
not ok 6 - both helpers encode every AC-150d component result as machine-readable JSON -> The input did not match the regular expression /components/. Input:
== runbook-contract ==
not ok 1 - PROPAGATION documents the complete reload and reboot matrix
not ok 2 - PROPAGATION commands use real flags, guarded paths, and safe SSH forms
not ok 3 - PROPAGATION specifies trust evidence, worktree behavior, capture, and exact rollback
not ok 4 - DEVCP reconciliation records every non-destructive decision
== global-snapshot-contract ==
not ok 3 - snapshot round trip preserves exact pre-install manifest and quarantines candidate
not ok 5 - unsafe homes and an installer contract mismatch fail closed

Guidance: restart-evidence reds are source-content requirements on the two helper scripts (ValidateSet Prepare/Finalize API, Win32_Process command-line capture, identity_intersection rejection, --project flag, /proc/<pid>/stat identity capture, machine-readable components JSON for every AC-150d component). Runbook reds demand the complete reload/reboot matrix, real guarded flags/safe SSH forms, trust-evidence + worktree + capture + exact rollback sections, and DEVCP-RECONCILIATION recording every non-destructive decision. Snapshot reds: round-trip manifest preservation with candidate quarantine, and fail-closed on unsafe homes/installer contract mismatch. READ each test's assertions and satisfy them exactly.

## Verify: all three suites 16/16.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS

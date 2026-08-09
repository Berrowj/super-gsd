FINDINGS: 3
CRITICAL: 2
WARNINGS: 1
PASS_RATE: 67%
ONE_LINER: Rollback and status-10 handling are closed, but publication can still push to an unvalidated secondary URL, one tracked PII occurrence remains, and existing EOL churn is unnormalized.
FINDINGS_DETAIL: [CLOSED] [ROUND2-1 security/origin] `super-gsd/scripts/sgsd-update.sh:43-67,117` and `super-gsd/scripts/sgsd-update.ps1:25-38,126` validate canonical origins before remote access; `super-gsd/tests/propagation/sgsd-update-contract.test.cjs:283-315,521-532` retains both runtime and ordering coverage.
FINDINGS_DETAIL: [CRITICAL] [ROUND2-2 security/publication-origin] `PROPAGATION.md:107-119,308-316` validates only the first result from `git remote get-url --push origin` before `git push origin`; without `--all`, a canonical first URL plus a malicious secondary push URL passes validation even though Git pushes to every configured push URL. `runbook-contract.test.cjs:191-217` checks only static allowlist membership and locks in the singular query, with no multi-push-URL negative fixture.
FINDINGS_DETAIL: [CLOSED] [ROUND2-3 recovery/boundary] `sgsd-global-snapshot.sh:102-264,561-569` pins the installer mutation contract and rejects creation without the pre-existing bootstrap root; negative contract/bootstrap fixtures remain at `global-snapshot-contract.test.cjs:248-300`.
FINDINGS_DETAIL: [CLOSED] [ROUND2-4 security/rollback] `sgsd-global-snapshot.sh:497-518` extracts into staging and compares the complete staged manifest before the first live-target move at `sgsd-global-snapshot.sh:526-539`; same-path content and symlink tamper fixtures assert every live target remains unchanged at `global-snapshot-contract.test.cjs:362-444`.
FINDINGS_DETAIL: [CLOSED] [ROUND2-5 trust-proof] `PROPAGATION.md:377-498` retains the real offset-bounded Codex dispatch proof, and `runbook-contract.test.cjs:219-298` validates its ordering and fresh appended-event behavior.
FINDINGS_DETAIL: [CRITICAL] [ROUND2-6 privacy/no-PII] The tracked artifact `.planning/milestones/v3.5/phases/150-propagation-trust-runbook/150-FIXD-PROMPT.md:6` still contains the identifiable account string. The 64-file inventory exercised by `runbook-contract.test.cjs:387-406` reports that file and fails, so the claimed zero-occurrence state and 12/12 runbook battery are not current.
FINDINGS_DETAIL: [CLOSED] [ROUND2-7 linux-install/restart-coherence] `PROPAGATION.md:539-562` captures the check result, accepts statuses `0|10`, rejects other statuses, and continues to update; `runbook-contract.test.cjs:300-343` supplies status 10 and requires both check and update invocations from project CWD.
FINDINGS_DETAIL: [WARNING] [ROUND2-8 anti-slop/salvage] `.gitattributes:1-3` declares future normalization, but the already-committed churn at `super-gsd/install.sh:1-889`, `super-gsd/scripts/lib/sgsd-readiness.ps1:1-279`, `super-gsd/scripts/sgsd-onboard.ps1:1-375`, and `super-gsd/tools/feature-propagation/audit.cjs:1-894` remains unchanged: the branch diff is still 2,291 additions/2,168 deletions versus 132/9 with EOL ignored, and `git diff --check` reports 2,168 whitespace findings.
FINDINGS_DETAIL: [CLOSED] [ROUND2-9 test-quality] Executing trust coverage remains at `runbook-contract.test.cjs:248-298`; AC-150d builder and canonical-cockpit execution coverage remains at `restart-evidence-contract.test.cjs:153-260`.

## Orchestrator closure (post-round-4)

- ROUND2-2: CLOSED — ceremony enumerates ALL push URLs (--push --all) at both
  validation sites; live negative fixture proves a malicious second push URL is
  rejected with exit!=0 (runbook-contract test 5; PS 5.1 stdin-exit and
  line-wrap quirks worked around with -File + flattened match).
- ROUND2-6: CLOSED — final occurrence (150-FIXD-PROMPT.md quoting its own
  search string) neutralized; privacy scan covers the 64-file phase inventory;
  battery green.
- ROUND2-8: ACCEPTED-DOCUMENTED — the EOL churn is the deliberate committed LF
  normalization; .gitattributes now pins eol so the class is closed forward.
Final battery: update 24/24, hooks 10/10, provenance 5/5, runbook 13/13,
snapshot 10/10(+1 env-skip), restart-evidence 10/10.

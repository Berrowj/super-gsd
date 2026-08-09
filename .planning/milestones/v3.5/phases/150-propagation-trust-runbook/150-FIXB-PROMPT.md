# P150-fixB — Runbook/docs CRITs (C2, C5, C6, C7) + W2 test upgrades

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). Fix EXACTLY these review findings (verbatim below). Surgical constraint applies.

FINDINGS_DETAIL: [CRITICAL] [spec/publication] `.planning/milestones/v3.5/phases/150-propagation-trust-runbook/PROPAGATION.md:82-107` provides no executable branch, origin, generic-identity, feature-SHA fast-forward, audit, or publication sequence required by T150-05; following the runbook can leave `origin/master` unchanged, so devcp subsequently installs the old release.
FINDINGS_DETAIL: [CRITICAL] [trust-proof] `PROPAGATION.md:124-140` states the trust requirements but runs only installation, self-test, and `block-forbidden-write.cjs` directly without stdin; that invocation records `invalid_payload`, exits non-zero unchecked, and never performs a real Codex dispatch, captures an offset/start time, verifies forbidden-file absence, or parses appended bytes. Trust can therefore remain ungranted while the structural runbook test passes.
FINDINGS_DETAIL: [CRITICAL] [privacy/no-PII] `PROPAGATION.md:29,88,103-106,121,134-135,148-149` publishes the identifiable Windows account path `$env:USERPROFILE\...` throughout runnable commands, violating the locked no-PII publication criterion; derive the path from `$env:USERPROFILE` or accept an operator-supplied root.
FINDINGS_DETAIL: [CRITICAL] [linux-install/restart-coherence] `PROPAGATION.md:161-165` runs the remote updater from SSH’s default home although `super-gsd/install.sh:37` and `sgsd-update.sh:177-192` bind project updates and the pin to the current directory; additionally `super-gsd/scripts/start-cockpit-server.sh:116,239` launches Clarity’s vendored cockpit, and `sgsd-devcp-restart-evidence.sh:342-353` emits `components.mcp_restart/...` instead of the locked `devcp_mcp/devcp_cockpit/devcp_tmux` schema consumed at `150-01-PLAN-LOCKED.md:338-340`. The project hooks/pin remain stale, canonical cockpit verification times out, and AC-150d cannot consume the evidence.
FINDINGS_DETAIL: [WARNING] [test-quality] `super-gsd/tests/propagation/runbook-contract.test.cjs:51-101` checks mostly for words and flags, and `restart-evidence-contract.test.cjs:79-86` only searches source text for generic field names; consequently the nonexistent trust ceremony and incompatible devcp JSON schema both pass. Execute the documented flows against fixtures and validate emitted JSON with the exact AC-150d consumer shape.

## Requirements
1. C2: PROPAGATION.md T150-05 section must contain the full executable publication sequence from the locked plan (branch/origin checks, generic-identity verification, feature-SHA fast-forward, audit, push) — lift it from 150-01-PLAN-LOCKED.md lines ~931-1190 rather than inventing.
2. C5: replace the structural trust probe with the REAL ceremony proof from the plan: pre-dispatch ledger offset + UTC start, actual codex dispatch attempting the forbidden write, exit-status checks, forbidden-file absence verification, parse of newly appended ledger bytes.
3. C6: remove EVERY identifiable account path ($env:USERPROFILE) from PROPAGATION.md — derive from $env:USERPROFILE / $HOME or operator-supplied root. Grep-verify zero occurrences afterward.
4. C7: align sgsd-devcp-restart-evidence.sh output schema to the locked consumer shape (components.devcp_mcp/devcp_cockpit/devcp_tmux per 150-01-PLAN-LOCKED.md:338-340); fix the runbook's remote update invocation to cd into the project before running the updater (pin binds to cwd per sgsd-update.sh:177-192); ensure canonical cockpit (not Clarity vendored) is what restart verification targets.
5. W2: upgrade runbook-contract and restart-evidence-contract tests from word-greps to flow execution where feasible: validate emitted JSON against the exact AC-150d consumer field set; execute the documented local commands against fixtures where the harness allows (keep EPERM skip guards).

## Verify: all six propagation suites green; grep -c '<redacted-account>' PROPAGATION.md -> 0. Report counts.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS

## PROGRESS CONTRACT (mandatory)
As you work, append one line to `.planning/metrics/dispatch-progress.txt` at each stage
(create the file on first write): `fixB|<utc-time>|started`, then `|edits-done` after the
last file edit, `|verifying` before running checks, `|reporting` before composing the
report. FINAL ACTION before emitting the report: `fixB|<utc-time>|done`. If you are
running short on time, SKIP remaining polish, write the report early, and mark `done` —
a partial report beats a timeout kill.

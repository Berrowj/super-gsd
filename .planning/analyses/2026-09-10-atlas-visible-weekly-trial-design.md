# Atlas visible weekly trial: design

Date: 2026-09-10. Status: WRITTEN-SPEC-REVIEW; not implemented or deployed.

Operator approved the scope: add Atlas collection health to the existing
cockpit, automatic warnings, and daily verified evidence copies from DEVCP to
this Windows PC. This document fixes the operational defaults for that scope.
The subsequent source implementation belongs in a new Phase 170 plan; this
document does not activate a phase, change STATE.md, or close the weekly baseline.

## Outcome and chosen approach

Jack can open the existing SGSD cockpit from this PC and see whether Clarity
sessions are actually delivering native usage and operational evidence. A
collection interruption or failed evidence copy remains visible until recovery.
The week's evidence remains on DEVCP and has a verified off-host copy here.

Reuse the current cockpit and Atlas diagnostics. A separate Grafana dashboard
would require new scrape/provisioning work and would still need session coverage
and evidence-export logic. A daily CLI report alone cannot warn promptly during
the week. The existing cockpit plus a small scheduled monitor/pull is the chosen
approach; no second collector, new paid model probes, or general dashboard rewrite.

## Verified baseline

- Source revision at inspection: `6cae3afe61175cf710e442ec7bc8d45043721cfb`.
- DEVCP Atlas root: `/home/jackberrow/.local/state/sgsd/telemetry/global`.
- Real Clarity project: `/opt/clarity/project-clarity-erp`.
- At 09:49 UTC, the existing receiver was healthy and Clarity operational data
  had advanced at 09:49:35 UTC. Its native ledger remained unchanged since
  02:50:06 UTC. This does not prove that every live session is attached.
- Existing cockpit: loopback port 7777, `/snapshot`, and `/events`. Its current
  telemetry section reads older project logs, not Atlas collection health.
- `audit.cjs` already calls the operational source-verification report. Reuse
  it; do not implement a second gate, verifier, MUDA, or ATC evaluator.
- Automatic canonical data is not pruned. Native, operational and receipt
  capacity limits can stop capture; free disk space alone is not assurance.

## 1. DEVCP monitor and cockpit panel

Run a user-scoped check every 60 seconds, independent of an open browser. Read
existing receiver identity/health, registrations, source capture state, bounded
ledger metadata, and allowlisted process/session identity. Never collect command
arguments, environment dumps, credentials, raw prompts, transcripts, or tool bodies.

Write monitor-owned state below `global/monitor/`, not into original SGSD
evidence ledgers. Publish an atomic latest-health snapshot and a deduplicated
incident history. Bound each check's time, bytes and entry count; a timeout or
truncated inventory is explicitly UNKNOWN, never a successful empty result.
Do not scan full growing ledgers on every browser refresh. A daily audit handles
deep integrity reconciliation; any cached summary displays its actual timestamp.

Add an Atlas collection-health panel within the existing cockpit telemetry
section, preserving existing sections and launcher topology. Show:

- Receiver, monitor and browser-connection health separately.
- Project/worktree and session coverage: reporting, stale, uncovered,
  closed/idle when supported by evidence, or unknown. A registration is not
  proof of activity; a running process is not proof of token delivery. If a
  process cannot be joined to a registration, expose the unmatched inventory.
- Last native event received versus its original occurrence time, and last
  operational evidence received. Backfilled records must not look like new work.
- Latest observed MUDA, ATC/review and gate outcomes, with source/receipt
  coverage and observation timestamps. Absence means unobserved, not PASS;
  an old gate verdict is not by itself a collection outage.
- Observed native token totals with aggregation interval and summary age.
  Keep cached/reasoning subsets separate; never sum operational counts as
  tokens or present observed totals as a complete provider bill.
- Pending bytes/lag, new rejections/conflicts/gaps, used/configured capacities,
  latest integrity audit, and last verified Windows evidence copy.

Default the view to the real Clarity repository and its provable Git worktrees.
Other registered projects remain visible in a separate inventory; known
acceptance/fixture runs are excluded from Clarity totals. Ambiguous identities
remain unclassified rather than being silently included or discarded.

Thresholds: stale monitor snapshot after three minutes; native observations
older than 15 minutes on an open/unclosed run are STALE-OR-IDLE unless positive
activity evidence supports a delivery alert; pending spool age over 120 seconds
warns. Show storage warning at 80%, critical at 90%, and actual capacity-stop
reasons as critical. Retain historical gaps distinctly from newly occurring
incidents. Missing coverage must prevent an overall all-sessions-covered claim.

## 2. Automatic checks and visible warnings

Use a narrowly marked block in DEVCP's user crontab: `/usr/bin/crontab` exists
and the cron service is active. Preserve every unrelated entry, refuse detected
concurrent crontab changes, and do not change global services or enable user
lingering. Implementation review: the system crontab tool has no atomic CAS;
the installer serializes its own operations, reads/compares twice, retains a
private preimage and verifies the result. It cannot exclude an unrelated editor
writing inside that final comparison window. Do not edit this user's crontab
simultaneously with installation; no atomic-concurrency guarantee is claimed.
The current user systemd manager has `Linger=no`, so relying on a user timer
would not guarantee checks after logout. Run one cheap check per minute; an
explicit UTC due-time check schedules the existing integrity audit once daily
at or after 06:00 UTC, without assuming the daemon's timezone. Persist the audit
output and actual exit status: 0 PASS, 10 WARN, 1 FAIL. A timed-out audit is
incomplete, not PASS. Do not run the same source verification twice per audit.

Display unresolved incidents prominently in the cockpit. On this Windows PC,
a lightweight user-scoped scheduled pull checks for new incidents every five
minutes and emits a native notification when the interactive session supports
it. Deduplicate by incident/recovery, not every poll. Persist local status even
when notifications are unavailable, and state that limitation visibly.

Keep the receiver and gates untouched on failures: no automatic provider calls,
process kills, session restarts, fallback models, auth changes, or gate bypasses.
The monitor reports the problem and evidence; it does not declare it repaired.

## 3. Verified off-host evidence

Use the existing `devcp` SSH connection for Windows-initiated pulls. Do not open
public ports or give DEVCP credentials to write into this PC. Proposed local
destination: `C:/Users/jack.berrow/AppData/Local/SGSD/Atlas/devcp/`.

Create the initial baseline and then a daily private evidence bundle on DEVCP
after the audit. Include sanitized native and operational canonical ledgers,
receipt ledgers, allowlisted registration identity fields needed for attribution,
gap/partition manifests,
monitor incidents and audit results for selected Clarity projects. List every
included project and excluded/unclassified scope explicitly. Do not recursively
archive project directories, raw CLI spools, original transcripts, auth/config
files, or arbitrary paths from record bodies.

Active append-only ledgers are copied as bounded, newline-complete prefixes.
Record each source length, captured length, observation time and SHA-256; validate
regular-file ownership/path containment and reject symlinks or replacement races.
This is a bounded per-file snapshot, not a claim of one atomic fleet-wide instant.
Changing mutable metadata or incomplete reconciliation produces an explicit
incomplete snapshot report, never a verified-complete badge.

Transfer integrity and capture integrity are separate verdicts. A correctly
hashed copy of a WARN/FAIL audit is a verified transfer, not proof of healthy
capture. Preserve and deliver failed audit evidence rather than dropping it.

Transfer through a temporary local destination. Verify manifest paths, file
lengths and SHA-256 locally before atomically publishing a dated snapshot and
advancing the last-success receipt. A partial copy or hash mismatch preserves
the prior good snapshot and records a failure. Send only the content-free
verification receipt back to the monitor over SSH.

Run Windows polling with a single-instance lock and catch-up after missed
schedules. The PC must be awake and the user session/SSH authentication available;
DEVCP continues recording while it is not. Show the last contact and verified
copy time, with copies overdue after 30 hours. On reconnection, fetch missing
retained bundles rather than only today's bundle. Never promise delivery to a
sleeping/offline PC, an email address, or this chat.

Windows Task Scheduler and the current batch-mode SSH connection were available
at preflight; no Atlas tasks or destination directory existed. Use Windows
PowerShell with an Interactive/Limited principal, hidden execution, logon
catch-up and StartWhenAvailable. The SSH agent is stopped/disabled; scheduled-
context authentication must be tested rather than assumed. Do not change keys,
credential files, SSH-agent service settings or authentication mode to make a
failed task appear successful.

Retain the trial evidence without automatic deletion. Warn at 80% and stop new
bundle creation at a monitor-owned 10 GiB DEVCP export budget or 20 GiB Windows
copy budget, retaining prior snapshots and showing a critical export-capacity
incident. Do not change Atlas capture limits or delete canonical evidence. These
separate budgets must not be confused with receiver capacity.

## 4. Access, delivery and acceptance

Provide a local shortcut/script for a loopback-only SSH forward to the existing
DEVCP cockpit, with a checked unused local port and explicit connection status.
Do not silently replace another local listener. Install monitor/pull assets
through existing SGSD distribution paths so a later normal update retains them.
Scheduler setup is explicit, user-scoped and idempotent; disable/uninstall removes
only the named monitor jobs and leaves evidence intact.

Before source edits, record exact files and tests in the implementation plan.
Use failing-first offline fixtures for fresh/stale/unknown coverage, old active
unregistered sessions, missing MUDA/ATC, benchmark filtering, duplicate/subset
accounting, full stores, stopped monitor, missed schedules and copy/hash failure.
Test path traversal, symlink/replacement races, partial JSONL tails and bounded
reads. Browser-check the real cockpit panel and disconnected/stale presentation.

Deploy through normal SGSD update after applicable existing reviews/gates. Verify
installed hashes, user scheduler registration, live metadata arrival, one real
baseline export and local rehash, and a safe synthetic failure/recovery in an
isolated monitor fixture. Preserve running Clarity sessions, protected settings,
credentials, project pins outside the selected deployment and all prior evidence.
Do not inject synthetic telemetry into production or spend on fresh model turns.

Completion requires a working local cockpit link, real per-project health,
scheduled checks with execution evidence, a verified off-host baseline, and
honest notification/catch-up/coverage status. Existing stale sessions remain
visible gaps until separately refreshed; this feature must not mark them fixed.
Windows capture parity, Researcher model selection, billing reconciliation and
formal milestone closure remain outside this feature.

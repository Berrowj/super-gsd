# 170-12 — visible Atlas monitoring deployed and verified

**Result: DEPLOYED_VERIFIED, bounded coverage.** 2026-09-10, 12:16–12:22 UTC.
Implementation revision: `bef11bdfd1eee05ee6939f3cc82e48bd37633348`.
Normal DEVCP `sgsd-update.sh` fetched/pinned that published revision, installed
successfully and reported the existing receiver `already_current`.

Open the live HTML cockpit on this PC:
<http://127.0.0.1:17777/#sec-telemetry>.
Reopen/reconnect with
`%LOCALAPPDATA%\SGSD\Atlas\devcp\Open Atlas.lnk`.
Repeated open was verified to reuse the recorded tunnel, not replace a listener.

## What is running

- DEVCP user cron: bounded monitor check every minute, installed 12:16:18Z.
  Automatic checks observed at 12:17, 12:20 and 12:21, `status: executed`.
- Daily audit/export: due after **06:00 UTC**; first completed in about 5.5s,
  12:16:19–12:16:24Z. Audit WARN was preserved independently of transfer success.
- Windows user task `SGSD-Atlas-Monitor`: Interactive/Limited, hidden, five-minute
  repetition, logon catch-up, StartWhenAvailable, IgnoreNew, 15-minute hard cap.
  First actual timed run completed with `LastTaskResult: 0`. A second explicitly
  requested scheduler run also returned 0 and copied **zero** existing bundles.
  The installer's `-RefreshOnly` path also succeeded, reusing the same versioned
  runtime, task name and evidence root without opting in any new task.
- Notification API recorded `attempted_not_delivery_confirmed`; delivery is not
  promised on a sleeping/locked PC or when notification policy suppresses it.
- Cockpit-only refresh: exact old PID 1293279, start ticks 41355949, executable,
  source entry, project and owned loopback socket verified before SIGTERM.
  New canonical cockpit PID 1797306 on 7777; `/atlas` is live. No LLM pane restart.

## First real off-host copy

Bundle: `atlas-20260910T121619Z-c585fee0`.

- 17 payloads, **107,087,418 bytes**, plus 11,011-byte manifest.
- Manifest SHA-256:
  `40fb1920c61a4df2d8716deae0f3c497c7e8256838628747d5559219c65ac2b5`.
- Independently rehashed on this PC after the scheduled transfer: verified.
- `verified_at: 2026-09-10T12:17:43.771Z`; the same hash/time appeared in DEVCP's
  backup receipt and then its minute snapshot. Later polls did not advance this
  verification time merely by rereading the receipt.
- Export capture status `complete` means the selected source prefixes copied
  completely. It does **not** mean complete provider/session/billing coverage.
- Full audit: WARN, **73 WARN findings**, no higher-severity findings. It includes
  global registered-project diagnostics; only the selected Clarity project's
  canonical native/operational source evidence is in this production bundle.
- Payloads include native events, operational events/state/receipts, nine
  sanitized run registrations, project registration, global gaps, monitor
  incidents and the full audit report. No prompt/transcript/auth/source archive.

## Locations and weekly use

On DEVCP the original global state stays at:
`/home/jackberrow/.local/state/sgsd/telemetry/global/`.

- `projects/<project-id>/metrics/`: canonical native evidence.
- `projects/<project-id>/operational/`: operational evidence and receipts.
- `runs/`: registrations; `monitor/`: live status, incidents, daily audit cache,
  schedule records, backup receipt and immutable `exports/<bundle-id>/`.
- The original SGSD producer ledgers remain in project `.planning/metrics/`.

On this PC:
`C:\Users\jack.berrow\AppData\Local\SGSD\Atlas\devcp\`.

- `snapshots/<bundle-id>/`: verified daily evidence and manifest.
- `receipts/`: local verification receipts.
- `status.json`, `health.json`, `notification.json`: latest client/contact/health
  and notification-attempt evidence. `runtime/` retains versioned client code.

Reader note: v1 manifests use `native/` as the native role namespace in
`source_relative_path`; its physical source-host directory is `metrics/`.
Use `source_role` plus this mapping when locating originals, not the logical
native namespace as a literal filesystem path. Full audit payloads are referenced
as `monitor/audit.json` in the manifest; the live file at that path is the compact
projection, while the bundled payload is the complete dated report.

Daily snapshots are cumulative. For weekly assessment, deduplicate canonical
identities across snapshots; do not add repeated snapshots as new usage. Preserve
original event timestamps when distinguishing historical backfill from new work.
Retention does not automatically delete evidence. Budgets: 10 GiB DEVCP exports,
20 GiB PC copies; explicit warnings/failure near limits. An offline PC catches up
on its next successful poll while DEVCP continues collecting.

## Preservation and verification

- Eight new runtime source/install comparisons matched across both Atlas roots.
- Five protected settings/state files: unchanged hashes.
- All 28 pre-existing tmux pane identities remained present.
- All 36 other inventoried Git-worktree pins remained unchanged; only the chosen
  Clarity pin advanced. This is an inventoried scope, not an all-filesystem claim.
- Receiver PID 2275022, instance `6b64b1dd-2aa8-4a76-bca0-48b00e485142`, fingerprint
  `7a5a1516f016abcfd27e91738676830b2a81d0a621f6aaa833debfe30e5addc9`: unchanged.
- Nineteen of 23 earlier sampled child processes remained; four had exited by
  comparison. No claim that every transient process remained alive. Only the
  verified cockpit process was deliberately stopped by this rollout.
- Final new native suite 55/55; broad Atlas suite 249 pass/0 fail/4 skips before
  the final monitor-only refinements, which the final native suite covers.
- Existing browser gate PASS, 37 pass/2 warn/0 fail. Registered FULL ATC PASS,
  0 critical/0 warnings. Failed review attempts and the baseline legacy cockpit
  rationale-card failure remain documented in `170-12-VISIBLE-TRIAL-REVIEW.md`.

## What remains honestly WARN

The live page was inspected through the actual PC-to-DEVCP tunnel: monitor fresh,
receiver running, local copy verified, integrity audit WARN, session coverage
partial/unknown. MUDA is observed (5 records in the dated audit cache); gates and
ATC/review families retain their own observed/unobserved/degraded states.
Operational receipt activity advanced to 12:20Z, while native delivery remained
stale-or-idle. Thirteen unmatched process attachments and a bounded process
inventory limit were visible. A legacy session is not refreshed by an asset
update. No all-session capture or complete-bill claim is made.

Atlas itself fits the inspected 768px viewport. The live Clarity cockpit still
has an unrelated long-phase-label header overflow, unlike the source fixture's
short phase label; this does not prevent reading the Atlas panel. Full Windows
SGSD execution/capture acceptance is separate from this verified Windows
receiving/notification companion. Dead/unverifiable locks require inspection and
remain fail-closed, with stale/overdue status visible rather than automatic repair.

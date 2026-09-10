---
schema_version: 2
status: COMPLETE
phase: 170
plan: "170-12"
authorized_at: "2026-09-10"
authorization: "Operator approved written design and HTML: Yeah lets go."
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: T170-12-1
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/tools/telemetry-atlas/monitor.cjs, super-gsd/tools/telemetry-atlas/monitor.test.cjs]
    input_contract: "Existing receiver/registration/capture metadata and explicit monitored Clarity Git repository."
    output_contract: "Bounded content-free health snapshot, per-project/session coverage and persistent incidents."
    hypothesis: "Metadata checks can expose stale or missing capture without repeated full-ledger scans."
    falsifier: "Unknown sessions become green, historical ingestion becomes recent work, or limits silently truncate inventory."
    stop_rule: "RED fixtures then bounded implementation and GREEN fixtures; expose unsupported identity as unknown."
  - id: T170-12-2
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/tools/telemetry-atlas/monitor-evidence.cjs, super-gsd/tools/telemetry-atlas/monitor-evidence.test.cjs]
    input_contract: "Selected registered projects and existing audit; immutable sanitized canonical evidence."
    output_contract: "Bounded daily export with complete-line prefixes, hashes and separate transfer/audit verdicts."
    hypothesis: "A manifest and independent local hash verification make off-host copies auditable."
    falsifier: "Unsafe path accepted, partial copy marked verified, source mutated, or WARN audit discarded."
    stop_rule: "RED filesystem fixtures; implement allowlisted exports; GREEN corruption, interruption and capacity tests."
  - id: T170-12-3
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/tools/cockpit-sidecar/atlas-panel.cjs, super-gsd/tools/cockpit-sidecar/atlas-panel.test.cjs, super-gsd/tools/cockpit-sidecar/serve.cjs, super-gsd/tools/cockpit-sidecar/client.js, super-gsd/tools/shared/sgsd-design-system.css]
    input_contract: "Atomic monitor snapshot with real timestamp and explicitly incomplete coverage."
    output_contract: "Existing cockpit displays Atlas health, sessions, native/operational evidence, incidents and copy freshness."
    hypothesis: "One read-only bounded endpoint lets the current cockpit expose collection gaps without changing legacy panels."
    falsifier: "Stale/missing endpoint is green, unsafe text executes, or partial capture is presented as complete billing."
    stop_rule: "RED endpoint/render tests then GREEN fixtures and desktop/mobile browser checks."
  - id: T170-12-4
    agent: gsd-executor
    model: codex
    files_touched: [super-gsd/tools/telemetry-atlas/monitor-client.cjs, super-gsd/tools/telemetry-atlas/monitor-client.test.cjs, super-gsd/tools/telemetry-atlas/monitor-schedule.cjs, super-gsd/tools/telemetry-atlas/monitor-schedule.test.cjs, super-gsd/scripts/sgsd-atlas-monitor.ps1, super-gsd/scripts/install-atlas-monitor-task.ps1, super-gsd/tools/telemetry-atlas/README.md, super-gsd/tools/telemetry-atlas/run-self-test.cjs, super-gsd/install.sh, package.json]
    input_contract: "Working devcp SSH, Windows PowerShell/Task Scheduler, Linux cron and immutable exported bundles."
    output_contract: "Scoped schedules, daily catch-up pull, local rehash/receipt, warnings and a cockpit access command survive normal updates."
    hypothesis: "User cron plus a Windows interactive scheduled pull avoids global service/auth changes."
    falsifier: "Unrelated schedule overwritten, credential changed, offline copy reported successful, existing listener replaced."
    stop_rule: "RED schedule/client fixtures; safe installed rollout and one real verified baseline; no paid acceptance model turns."
semantic_acceptance_criteria:
  - input: "Fresh, stale, unmatched, unsafe, missing and capacity-bound filesystem fixtures."
    expected_outcome: "No false all-covered/zero-spend success; safe inputs remain readable; failures remain explicit."
    verification_cmd: "node --test super-gsd/tools/telemetry-atlas/monitor*.test.cjs super-gsd/tools/cockpit-sidecar/atlas-panel.test.cjs"
  - input: "Installed DEVCP monitor and Windows scheduled pull against real Clarity evidence."
    expected_outcome: "Health snapshot and schedule execution evidence, one real locally verified bundle and preserved previous good copies."
    verification_cmd: "node super-gsd/tools/telemetry-atlas/monitor-client.cjs status"
---

# Atlas visible trial implementation plan

> For agentic workers: use subagent-driven-development and failing-first tests.
> Independent file ownership allows parallel tasks; spec review precedes quality
> review. No commits by implementers; root integrates only explicit owned files.

**Goal:** visibly prove ongoing capture and preserve a verified daily off-host copy.

**Architecture:** keep the receiver unchanged. A minute monitor reads bounded
metadata and emits private snapshots; existing audit runs daily, then evidence
export seals allowlisted file prefixes. Windows pulls immutable files through
existing SSH, rehashes locally, and returns a content-free receipt. The existing
cockpit reads monitor snapshots; stale and unknown states cannot become green.

**Tech stack:** existing Node CommonJS, filesystem, SSH/scp, Linux user crontab,
Windows PowerShell Task Scheduler and existing cockpit JS/CSS. No new npm dependency.

## Contract and scope

Approved design: `.planning/analyses/2026-09-10-atlas-visible-weekly-trial-design.md`.
Implementation base: `e008fc5`. Existing linked worktree/branch is retained.
Baseline `node --test super-gsd/tools/telemetry-atlas/audit.test.cjs`: 9 pass.
Preserve prior dirty planning files, credentials, protected settings, running
Clarity sessions, nonselected project pins, all original evidence and gates.
Use normal update after applicable registered gates. Do not activate other phases.

Implementation review clarification: cron installation offers an optimistic
read/compare with a private recoverable preimage, not atomic CAS against unrelated
editors (unsupported by system crontab). Own concurrent installs are locked;
detected changes refuse. Dead/unverifiable locks are preserved for inspection,
not reclaimed by PID-only guessing. This limitation is documented and visible
staleness remains the failure signal. No blanket concurrent-edit guarantee.

Browser-gate repair in T3: existing chrome hotkeys overflowed at 768px
(document width 812px), unchanged with Atlas removed. Two scoped properties on
`.chrome .kbd` (flex-wrap and min-width) fix that observed usability blocker;
no typography/theme redesign. Re-run the unchanged browser gate.

Private runtime root is `global/monitor/`: `config.json`, `latest.json`,
`incidents.jsonl`, `audit.json`, `backup.json`, `exports/` and scoped locks.
Config v1: `{schema_version:1, project_dirs:[absoluteClarityRoot]}`.
Resolve selected Git worktrees using their common Git directory; benchmark or
unknown registrations remain excluded from production totals and explicitly listed.

Monitor API `await collectSnapshot({root, now, projectDirs})` returns:

```js
({schema_version:1, generated_at:new Date(now).toISOString(), status:'WARN',
 complete_coverage:false, service:{healthy:false}, projects:[],
 unmatched_sessions:[], findings:[], audit:null, backup:null});
```

Project rows have `project_id`, `project_dir`, `classification`, `native`,
`operational`, `runs`, `capacity`. Native exposes `last_received_at`,
`last_occurred_at`, observed token summary/time/scope or explicit unavailable.
Findings carry `severity`, `reason`, optional project/run identity, never raw
content. Exported API field refinements must be messaged between owners and
recorded here before downstream assumptions are coded.

## Task 1: minute monitor (independent owner)

- [x] Add monitor tests before implementation, including this fail-closed entry:

```js
test('empty root never proves collection', async () => {
  const s = await collectSnapshot({root:fixtureRoot,now:Date.now(),projectDirs:[]});
  assert.equal(s.complete_coverage,false);
  assert.notEqual(s.status,'PASS');
});
```

- [x] Run `node --test super-gsd/tools/telemetry-atlas/monitor.test.cjs` and
  record RED, then implement the API and CLI `check --root <root>`.
- [x] Read private monitor config, existing `global.status`, registrations,
  capture state and bounded native tails. Never execute a provider or collect
  args/environment dumps. Enumerate bounded Linux process identities only;
  missing attribution stays unmatched/unknown. Cache full native summaries
  with actual timestamps; minute checks must not scan full growing ledgers.
- [x] Atomic latest snapshot and deduplicated incident/recovery history;
  exclusive safe locks, byte/time/directory caps, no source writes. Stale after
  3 minutes, native 15m stale-or-idle, spool 120s, capacity 80/90%, backup 30h.
- [x] Test missing service/config, malicious path, idle vs activity, old backfill,
  absent gates, limits, fixture exclusion, current timestamps and source preservation.

## Task 2: daily audit and immutable evidence (independent owner)

- [x] Add real filesystem tests before production code. Verify a copied WARN
  audit is transferable, but corrupt content cannot pass independent rehash:

```js
const result = verifyBundle({directory:copiedBundle});
assert.equal(result.verified,true);
assert.equal(result.audit_status,'WARN');
fs.appendFileSync(copiedEvidence,'tamper');
assert.throws(() => verifyBundle({directory:copiedBundle}));
```

- [x] Run new evidence suite RED then implement `createBundle`, `verifyBundle`
  and catalogue CLI. Bundle manifests use validated relative paths and hashes;
  transfer only immutable, content-free selected evidence. No raw root archives.
- [x] Complete-line live prefixes, fstat/identity/ownership checks, bounded
  streaming hashes and local verification. Refuse symlinks/traversal/races.
  Preserve audit FAIL/WARN separately from transfer verdict. Timeout/limits
  produce incomplete evidence, not a healthy badge.
- [x] Keep export directories under monitor/exports with an immutable ID and
  manifest. 10GiB export budget, no automatic deletion; use a flat safe layout
  for SSH/scp pulls. All manifest bytes/entries bounded before copying.
- [x] Daily audit reuses `audit.cjs` once (already verifies source receipts),
  preserves actual status and invokes export after it. Catalogue missing days
  for Windows catch-up. Tests cover concurrent append, partial tail, hash
  failure, invalid names, capacity and existing good snapshots.

## Task 3: existing cockpit Atlas panel (independent owner)

- [x] Add tests before code for read-only bounded snapshot loading and stale UI:

```js
const s = readAtlasSnapshot({root:fixtureRoot,now:Date.now()});
assert.equal(s.complete_coverage,false);
assert.notEqual(s.status,'PASS');
```

- [x] New `atlas-panel.cjs` owns safe read/projector. Add GET `/atlas` in
  `serve.cjs`; serve cached private snapshot, not a full audit or new daemon.
- [x] Add a dedicated subpanel within existing telemetry section. Poll 60s,
  immediately on load, show disconnected/missing/stale explicitly. Render
  escaped text, separate native/operational freshness and audit/copy status,
  included/excluded project inventory and matched/unmatched runs. Native totals
  are observed and time-scoped; cached/reasoning are subsets, not extra tokens.
- [x] Preserve existing renderers/connection topology. Test safe HTML escaping,
  missing and malformed snapshots, stale timer, no default-green and responsive
  browser behavior. No new theme or general cockpit redesign.

## Task 4: schedules, client, packaging and deployment (integration owner)

- [x] RED client/schedule tests include preserve-last-good and marked cron block:

```js
assert.equal(mergeCrontab('other job\n',entry).startsWith('other job\n'),true);
assert.throws(() => verifyBundle({directory:partialCopy}));
```

- [x] Node client owns `pull`, `status` and `open`: BatchMode SSH, connection
  deadline, bounded catalogue, missing-bundle copies in private staging,
  independent hashes and atomic publish. One instance; timeout or auth failure
  persists locally without erasing successful copies. Client default root is
  LocalAppData/SGSD/Atlas/devcp; 20GiB cap, no destructive cleanup.
- [x] Minute Linux scheduler uses a narrow marked crontab block, compares
  pre/post state and refuses detected concurrent edits under the documented
  optimistic-concurrency limitation; no global daemon/linger changes.
  Daily UTC due check is independent of host timezone; locks prevent overlaps.
- [x] Windows scripts use existing Interactive/Limited/StartWhenAvailable/
  IgnoreNew pattern, hidden PowerShell, logon and 5-minute repeat. Native
  notification attempts have explicit availability/outcome. No stored password,
  no credential or SSH-agent changes. Open uses checked local SSH cockpit port.
- [x] Reuse whole-directory Atlas/cockpit copy targets, extend exact script
  packaging only where necessary, register suites and document run/access/disable.
- [x] Run new suites and existing Atlas/cockpit/install coverage on native Linux
  as needed; independent SPEC then existing FULL ATC/quality. Publish selected
  files only, normal `sgsd-update`, preserve protected metadata and sessions.
- [x] Configure DEVCP Clarity monitor scope, register cron and Windows task;
  observe scheduled execution and real source freshness, run one baseline
  export and independent local verification. Observe a second scheduled poll;
  use isolated failure fixtures, not fabricated production telemetry.
- [x] Record installed hashes, source revision, protected preservation,
  schedule execution, sample health, copy manifest/hash and final local cockpit
  URL in `170-12-VISIBLE-TRIAL-ACCEPTANCE.md`. Status is bounded acceptance;
  uncovered legacy sessions and billing/Windows-capture gaps remain explicit.

## Review and execution notes

Implementation proceeds in this session under the operator's explicit go-ahead.
Independent files may run in parallel; shared install/STATE changes stay with
root. Do not duplicate full audits or re-run paid board/worker acceptance. A
changed module allowlist or contract is recorded here before the new edit.

Contract refinement: native.summary.scope is bounded_native_tail, not a weekly
aggregate. Operational family rows include last_received_at and verdict where
receipts prove them. Catalogue IDs are atlas-YYYYMMDDTHHMMSSZ-8hex; payload names
are 64hex.json/jsonl. Global install already copies all Atlas files and PS scripts;
there is no super-gsd/install.ps1. Windows companion installation owns a private
runtime mirror; normal Windows global update refreshes an existing companion.

Regression note: full cockpit self-test SAC-P142-03 expects at least two rationale
cards. Same-snapshot JSDOM comparison of HEAD client and modified client yields
one card/no empty state for both. This existing data-dependent failure is retained
as a baseline limitation, not fixed by changing expectations or source narrative.

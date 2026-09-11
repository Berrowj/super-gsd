# 170-15 reboot recovery verification

Status: IN PROGRESS. No runtime publication, installation or successful restored
session is claimed by this record. Approved design and active schema-v2 plan
170-15 govern the work. Preserve prior failed/partial evidence.

## Initial checks (2026-09-11)

- Existing isolated linked worktree: branch release/v4.1-atlas-worker-20260908;
  git-dir GSDedits/.git/worktrees/luminaria-hogback. Unrelated planning edits retained.
- Written design approved by operator ("yeah go"). Numbered 170-15 plan validated
  with plan-schema/validate.cjs --mode load: VALID, no errors.
- Windows baseline fleet + sg-shortcut: 29 tests, 28 pass, 0 fail, 1 Linux skip.
- Native DEVCP isolated archive /tmp/sgsd-17015-tests.dHcYg5vB at installed75f20856:
  fleet + sg-shortcut 29 tests, 28 pass, 0 fail, 1 unsupported-platform skip;
  global receiver 69 tests, 69 pass, 0 fail, 0 skip.
- Read-only production inventory at 10:08:42Z: boot ID
  661a5810-7007-41de-8faa-ca7c9253e06e, no tmux server; source75f20856 with only
  untracked .planning/worker-sessions/. All five selected worktrees still exist,
  retain75f20856 pins and legacy bound claims whose provider processes are dead.
  Coordinator fleet-695ff99b-b3c3-4cfd-8612-fe30ae96a633 survives. Old service record
  has no boot ID; completed transition history retained. No process was signalled.

## Skill reference baseline before edits

Read-only retrieval scenario used the existing sgsd-sessions skill, without new
recovery instructions. It correctly refused unsafe adoption and did not invent
commands, but could not fulfil reboot recovery. Missing: durable remembered list,
first-boot offer, explicit restore/forget, prior-run lineage and interrupted retry.

Exact baseline anchors: "A claimed worktree cannot gain a second orchestrator";
allow-pending "only for a proved never-started launch"; "Registration is not
delivery". Partial SQL-live/Design-missing/third-pending scenario could preserve
owners but had no documented list retention or recovery procedure. This is a
reference-coverage failure, not evidence that the baseline agent broke safety.

## Implementation/review constraints confirmed

- A crashed same-boot stale-lock reclaim guard remains an explicit fail-closed
  blocker. No recursive guard framework, age-only deletion or blind PID takeover.
- Normal restore writes durable attempt identity before launch. Exactly one
  launcher consumes a ticket; persist its fresh run before reserve. Retry
  reconciles that run, never relaunches an already-consumed ticket.
- Unknown same-boot pending ownership remains blocked. An interrupted wrapper
  alone does not authorize allow-pending or prove no provider started.
- Explicit forget suppresses same-run re-remembering. Finish refreshes existing
  intent only; only a genuinely new verified binding can remember again.

## Remaining verification

### T1 foundation checkpoint

Implemented only boot-identity/fleet/global modules and their focused tests.
Failing-first evidence reproduced prior-boot PID/start false ownership,
startup_busy, dead legacy service_health_unverified, malformed optional identity
reclamation and a completed-history bypass introduced during implementation.
All corrected before acceptance; independent SPEC verdict PASS on final hunk.
Root's independent native rerun: 99 tests, 98 pass, 0 fail, 1 unsupported-platform
skip (12.70 seconds). Root Windows helper/fleet: 27 tests, 26 pass, 0 fail,
1 Linux-only skip. Source diff whitespace check passed. Independent QUALITY
verdict PASS, with independent 27-test helper/fleet rerun and no material findings.

Exploratory Windows full-global suite is NOT green: cleanup assumptions failed;
only exact verified fixture parent/child processes were stopped. This feature
does not claim Windows receiver acceptance.

The existing private ATC recorder was reused with only owner/plan17015 bindings
changed. Six synthetic recorder tests pass, including wrong identity/report,
pending questions, duplicate append and malformed evidence refusal. These are
recorder unit tests, NOT the required genuine FULL ATC result.

### T3 independent documentation and shell-boundary preparation

Root prepared only existing session-skill/README documentation and shell tests
while T2 implementation owns separate runtime files. No shortcut implementation
was written before these tests. Native shell RED: 8 tests, 1 pass, 7 fail against
the installed75f20856 shortcut; missing list/restore/forget/help behavior causes
the expected failures, while ordinary current-terminal behavior remains green.

Skill forward test initially PARTIAL PASS: correctly selected paused restoration,
safe partial retry/forget and exact-run evidence, but future automatic enrollment
and ordinary non-TTY sg behavior were implicit. Two sentences made these explicit.
Independent retest PASS: future successfully bound projects remembered;
ordinary non-TTY sg skips menu, launches only its ordinary workspace, never an
implicit fleet. This is documentation validation, not runtime/deployment proof.

### T3 implementation checkpoint

Root implemented the separate launcher/UI/binding integration while T2 owned
only its catalog/global files. Additional RED tests proved missing remember on
binding, absent restore-ticket forwarding, real TTY all/selected/cancel behavior,
and missing exact tmux targeting. One initial native fixture failure was a test
PATH missing Node; fixture PATH now explicitly includes process.execPath's dir.
The failing assertions for new functionality were reproduced independently of it.

Native focused shortcut/recovery/owned-session/binding suite: 43 tests, 43 pass,
0 fail, 0 skip. This includes real Linux pseudoterminal menu input; paused restore
must return rather than launch a duplicate current-terminal owner. Three further
RED regressions caught an 80-vs-96-character session-name limit mismatch, context
status rendering under the wrong API key, and skipped offer with explicit project;
all three are green in that 43-test result. No real provider was invoked.
Generated hook closure manifest is current. Independent integration review and
broader propagation/Atlas verification are still pending at this checkpoint.

### Independent specification and broad regression checkpoint

Independent SPEC PASS for T2/T3: native 35/35 recovery/store, 43/43 shortcut/
launcher/hook, 3/3 targeted global recovery paths. Local/native source hashes
matched. Actual independent-process termination and private-socket tmux ancestry
are tested without paid providers.

Private Git candidate clone full Atlas: 325 tests, 320 pass, 0 fail, 5 existing
platform/optional skips (42.72 seconds). Full propagation: 137 tests, 130 pass,
7 fail, 0 skip. All seven failures are the standalone global-snapshot contract's
pre-existing installer digest mismatch: unmodified75f20856 installer SHA256
0ae661015de53e9eaffa404a676e511a2717b8ffa16ce593f50d2c35f32463af vs snapshot
helper's expected7f9fe48d71e8eb209b02603582f5d647f30bc9c2303d784605d5eab1554dbc49.
Independent unchanged75f20856 Git clone baseline reproduces the same seven
failures (snapshot suite4pass/7fail). Neither file changed in170-15; normal
sgsd-update does not invoke that separate snapshot helper. Guard not weakened.
An earlier archive-only run additionally failed the test needing git ls-files;
it passes in the proper private Git clone. The new runtime-provenance fixture
closure omission was repaired and now passes. Full propagation is not claimed
entirely green; this change introduces no remaining propagation failure observed.

QUALITY review found a genuine persistence-ordering gap after these checks:
ordinary binding could publish a durable catalog before flushing its referenced
registration and newly-created directory links. A bounded repair/regression is
underway. These test results precede that repair; final verification still needed.

### Final implementation review and regression

The QUALITY durability finding is repaired: exact validated predecessor inode
and registration/directory parents flush before catalog/ticket publication.
Forced flush failure preserves prior catalog bytes. Verified tmux owners now
receive attach_command; all unverified/non-tmux cases return null.
Independent final QUALITY PASS (46/46 recovery/store/hook plus12/12 shell,
independent fsync-order trace); narrow final SPEC recheck PASS. Final source
hash prefixes global-store50075717 and workspace-recoverybaee05f4 matched native.

Root final full native Atlas after repair: 329 tests, 324 pass, 0 fail, 5 existing
platform/optional skips (47.86 seconds). Final full propagation again137 tests,
130 pass, the same7 independently reproduced unchanged snapshot-contract failures.
Plan schema VALID; generated hook closure current; git diff --check clean.
Required registered FULL ATC is next, not inferred from these reviews/tests.

### Genuine FULL ATC attempt 1: BLOCK, preserved

Installed registered review profile (gpt-5.6-sol, xhigh), owner
codex.coordinator.17015, worker7ec03d5e-e489-4706-bd80-b2bd2092b119,
thread01a0901e-5fb5-72d1-8882-101093799726 completed at11:08:11.280Z.
Exit0 is transport only: report FINDINGS2, CRITICAL1, WARNINGS1, PASS_RATE8/10.
Report SHA2569a8883309ca2c1ae7bfce2e492c580350c1c3d87d042d15a6422ee007959e58f
was recorded as BLOCK through existing review/gate/route/commit-review writers
at11:09:00.381Z, gate05a56a09-39bc-42bc-b1b0-de487805426e. No publication.

The critical finding: first archived receipt directory lacked a parent fsync
before the original lock could be unlinked. The warning: a prepared launch with
verified terminal exit/release could still be reported pending after nonzero
launcher exit. Both reproduced with native RED regression tests. Corrections
flush that parent before returning preservation, and consult existing exact
terminal proof for failed classification; unresolved ownership remains pending.
Author native focused47/47 and global recovery4/4 pass. Root independent rerun
and retained-thread ATC correction review pending at this checkpoint.

Subsequent root independent corrected-candidate run: focused47/47; full Atlas332
tests,327 pass,0 fail,5 existing skips (46.98 seconds); full propagation137 tests,
130 pass and the exact same7 unchanged baseline snapshot-contract failures.
Logs: /tmp/sgsd-17015-tests.dHcYg5vB/atc-corrections-focused.log,
candidate-atlas-atc-corrected.log, candidate-propagation-atc-corrected.log.
Retained review worker60dd74f4-be52-4cad-a98f-9e1107aeef7b began11:15:45.301Z
on the same thread with a fresh turn and run. Its question requesting newer
root-run evidence was answered with these exact log paths; receipt applied
11:17:31.184Z. Review outcome still pending at this checkpoint.

ATC worker usage observations were bound and queued without pending rows, but
native_usage_line_limit makes native usage coverage partial. No complete spend
or billing reconciliation claim. The first BLOCK and report remain evidence.

### Genuine retained-thread FULL ATC correction result: PASS

Worker60dd74f4-be52-4cad-a98f-9e1107aeef7b completed11:17:53.207Z,
same thread01a0901e-5fb5-72d1-8882-101093799726, fresh
turn01a0902e-449d-71a1-ac28-2597f7d076d5 and
Atlas runsgsd-2e4d115a-9de6-4055-b017-bc9b6122a774. Wrapper exit0 and exact
178-byte report SHA25667ddc05c5e565e2ef9f5f69fe8d0390154da9af4f625984bd4a1a4cef08de8a3
validated. Actual report: FINDINGS0, CRITICAL0, WARNINGS0, PASS_RATE10/10.
Existing writers recorded PASS11:18:34.451Z with
gateb5484951-a480-4f1e-a4d1-e51c1539551d. Both actual results and hashes are
in 2026-09-11-reboot-recovery-ATC.json; original native source ledgers remain
in the review project, not merged into this different project's local metrics.
The versioned phase commit-review history retains both actual appends.

Publication and normal installation are authorized next; restoration and native
delivery remain unverified until the actual installed run completes.

Read-only native reconciliation at11:22Z proved all8 actual ATC rows (BLOCK and
PASS, four ledger families each) from original bytes through receipts to
canonical events with exact run identity. Both run registrations verified;
89 receipt batches and65 canonical event hashes checked; zero chain gaps.
Private evidence: ~/.local/state/sgsd/17015-atc/gate-chain.json on DEVCP, copied
to the local private17015 evidence directory. This is not exhaustive token
accounting or a new two-way challenge benchmark.

T1 identity/locks, T2 catalog/transactions/lineage, T3 launcher/skill/propagation;
independent spec and quality reviews, required genuine FULL ATC, normal update,
fresh production inventory and one paused five-workspace restoration. Real
native delivery, operational gaps, worker/gate attribution and off-host backup
must be reported separately. Windows and existing narrator-helper gaps remain
outside this feature. No complete capture/billing or phase closure claim.

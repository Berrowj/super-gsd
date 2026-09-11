# SGSD workspace recovery after a server reboot

Status: agreed operator-facing design; written specification awaiting operator review.
Implementation and deployment have not started. Intended next numbered plan:170-15.

## Approved outcome

Jack approved restoration on the first `sg` after a DEVCP reboot, with all or
selected saved workspaces, managed startup and fresh Atlas identities. No work
resumes automatically. This specification records that behaviour and its safety
boundaries; it does not authorize a server reboot or bypass existing gates.

## Operator experience

- Every successfully bound managed workspace is remembered on durable user-owned
  storage outside `/tmp`, including future projects, not a hard-coded five-item list.
- On the first interactive `sg` after a changed Linux boot ID, show remembered
  workspaces with their latest task/handover reference and readiness or blocker.
  Offer all, selected entries, or not now. Default is no restoration until chosen.
- A saved workspace remains available until explicitly removed from the restore
  list. Provider exit, SSH disconnect, shutdown SIGTERM, failed launch and a crash
  do not by themselves mean the operator wanted the workspace forgotten. Removing
  a list entry never deletes its worktree, evidence or conversation files.
- A manual restore option on `sg` allows retrying omitted/blocked entries later.
  Proposed new options are not commands available in the currently installed75f20856.
- Selection starts workspaces serially through the existing managed launcher.
  Show restored, already running, blocked and failed separately. A failed entry
  does not erase successful entries or disappear from the saved list.
- Restored fleet entries use explicit detached tmux sessions and return attach
  choices. The restore operation does not then launch a second local owner.
  Ordinary `sg` still keeps Claude in the terminal where it was typed; no hidden
  bootstrap orchestrator or nested provider wrapper is introduced.
- Noninteractive startup never guesses a selection or waits on an invisible menu.
  Health/list-only checks do not start providers. Repeated restore requests reuse
  verified owners and must never create duplicates.

## Persisted state and recovery context

Extend the existing private fleet area under the actual Atlas global state root.
Keep remembered workspace intent separate from active claims and immutable run
registrations. Records are bounded, versioned and atomically persisted with the
same path/ownership protections used by fleet metadata.

Per workspace retain the canonical real project path and digest, stable display
name and preferred tmux name, previous run ID, last observed boot ID, and bounded
references/hashes for existing state, handover/checkpoint and provider-session
identity where available. Persist reference metadata, not copied prompts or raw
transcripts. A provider conversation ID is a recovery aid, not evidence that its
in-memory state survived. The baseline restores fresh paused Fable sessions from
saved context; exact provider-conversation resumption is not required or promised.

Update cheap reference snapshots at existing session/worker/checkpoint lifecycle
boundaries. Reuse original SGSD state and handover writers. Do not create a paid
summarizer, polling model, second checkpoint authority or shutdown-only dependency.
Report missing/stale references honestly; reconstruct neither unsaved work nor
business approval. Existing files and dirty working trees remain untouched.

Initial migration uses the five surviving validated fleet claims plus their
existing handovers. Resolve project identities rather than guessing from names;
legacy pane numbers are not portable across reboot. Missing historical boot IDs
are marked legacy, never invented. Add future workspaces at successful binding.

## Safe restore sequence

1. Read the durable list and current boot identity. Resolve each selected project
   and installed runtime; check branch/context references and source/pin provenance.
   A missing/moved/replaced worktree or version mismatch is a named blocker.
   No automatic update, pin edit, checkout, merge, commit or credential change.
2. Reconcile only the exact obsolete ownership/launch records. Use boot identity
   together with existing PID/start/executable/run checks. Claims, fleet locks and
   shared receiver startup/service metadata must use coherent reboot-aware proof.
   A PID alone, lock age or missing tmux server is not takeover authority.
3. Preserve interruption/release evidence before replacing a proved obsolete
   record. Never signal a process simply because its PID appears in an old record.
   Legacy/unknown/malformed locks remain blocked unless existing checks establish
   safe recovery. Cross-boot lock recovery must be atomic and concurrency tested.
4. Use existing shared receiver preparation, health identity checks, normal fleet
   reserve/bind and additive monitor enrollment. Pass canonical installed scripts,
   agents and source paths explicitly; do not fall back to stale project vendors.
5. Generate a new run ID for each genuinely restarted owner. Persist an auditable
   relation to the previous run and the selected context reference; use existing
   Atlas coverage/handoff event mechanisms with validated schemas. Never reuse old
   run IDs or misattribute the previous session's tokens to the replacement.
6. Launch paused and verify exact project/run/provider/pane binding. Report native
   delivery separately from registration and receiver health, and operational
   observations/gaps separately from native capture. Delivery can remain pending
   after a successful launch; lack of observation never becomes a green claim.
7. Record a bounded per-workspace restore receipt. Keep partial results recoverable
   across another interruption. Running restoration twice, from two shells, or
   after a partial failure must leave at most one active owner per real worktree.

Interrupted business operations retain their original approval and retry holds.
No automatic Codex worker retry, `go`, deployment, reconciliation, payment action
or arbitrary replay of saved shell commands. An interrupted operation is not
assumed failed merely because its provider process disappeared.

## Integration boundaries

- `super-gsd/scripts/sg`: interactive offer and explicit recovery entrypoint;
  preserve existing ordinary-launch topology and help/noninteractive behaviour.
- `super-gsd/tools/telemetry-atlas/`: bounded workspace-intent/recovery module;
  integrate existing fleet/global identity, lock, prepare and finish mechanisms.
- `super-gsd/scripts/sgsd-remote-tmux.sh` and existing session binding hook:
  remember successful launches and accept validated recovery context; still refuse
  fresh auto-mode and unverified ownership. No duplicate launcher implementation.
- Existing checkpoint/lifecycle seams: refresh reference metadata only.
- Existing installer/manifest closure and `sgsd-sessions` skill: propagate the
  recovery path globally and document the distinction between restore and resume.

No tmux plugin is required for the baseline. Tmux-resurrect can preserve richer
layouts, but it must not become an alternative Claude/Codex process dispatcher.
No automatic model startup at server boot, privileged daemon, system-wide service
change or extra telemetry redesign. Narrator capture, the missing Clarity audit
hook, inherited business-state repair and Windows execution remain separate work.

## Acceptance and rollout

Failing-first deterministic fixtures must cover:

- changed boot ID with a coincidentally reused PID/start counter;
- live same-boot owner, inaccessible identity, legacy claim and stale lock;
- crash before/after durable release receipt, reservation, tmux creation and bind;
- concurrent all/selected restores, repeated restore, partial failure and retry;
- missing/renamed worktree, corrupt or unsafe metadata, source/pin mismatch;
- current-terminal normal `sg`, detached restore, no selection and non-TTY startup;
- no provider starts before explicit selection; no automatic business `go`;
- fresh exact run identity, preserved previous-run relation and honest pending
  native/operational delivery; no transcript or credential content in telemetry;
- workspace creation/removal persistence and explicit forget without file deletion;
- global install closure and selection of canonical scripts on real Linux.

Use native isolated Linux tests rather than rebooting DEVCP. Require focused and
propagation suites, independent review and the existing required ATC gate before
intended-only publication and normal update. Preserve original failed evidence.

After deployment, the operator's already-rebooted five workspaces provide a real
restore opportunity. Inventory again first; do not assume they remain dead while
this feature is built. Restore once under the approved all/selected interaction,
observe actual binding and native delivery, and leave each owner paused. Record
remaining blockers without killing unrelated sessions/services or claiming full
billing capture. Do not silently archive the old benchmark sessions into the new
production restore list.

## Design self-review

- One feature: durable first-login workspace recovery; no wider orchestration rewrite.
- Persistent workspace intent is not an active-owner claim or task approval.
- Boot ID supplements rather than replaces run/project/process identity checks.
- Locks and receiver startup are included so fleet-only recovery cannot falsely
  promise a successful cold boot while a reused receiver PID blocks preparation.
- Restore is a shell/metadata workflow; no LLM decides ownership or selection.
- Saved references preserve context without promising recovery of unsaved memory.
- No placeholders or implicit permission to bypass existing gate outcomes.

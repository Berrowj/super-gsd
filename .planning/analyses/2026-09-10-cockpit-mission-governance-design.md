---
schema_version: 1
status: WRITTEN_REVIEW_PENDING
design_approved_in_conversation: "2026-09-10: Okay lets do it"
implementation_status: NOT_STARTED
scope: "DEVCP/Linux mission-aware cockpit; existing Windows viewing companion"
---

# Mission-aware SGSD cockpit

## Outcome and approval boundary

The operator approved connecting the existing cockpit components after a
read-only audit and a 10–16-hour planning estimate. This written specification
records that design. It does not claim implementation, deployment, a new active
phase, or completion of the v4.1 milestone. Written review precedes source work;
source changes require numbered PLAN tasks under `.planning/`.

The cockpit must answer: what was requested, who is working on it, in which
worktree/session, what step is active, what has happened, and what evidence
reached Atlas? A central view combines the existing records; it does not become
a second authority that silently edits project state or gate decisions.

Default presentation is a short synopsis, with the private original task available
on demand. There are no dashboard-specific model calls or continuous narration.
Keep the existing visual system, live Atlas panel and Windows access/copy setup.
The operator additionally requested the real diagram skills on September 10:
use `vtp-html-explainer` for evidence-backed SVG explanation and `frontend-design`
for integration into the existing live dashboard.

## Confirmed problems and reusable components

The September 10 read-only audit found:

- `cockpit-sidecar/cockpit-sidecar.cjs` hard-codes Opus 4.7, GPT 5.5, active/idle
  statuses and a handoff. Missing narration can be stamped fresh on every render.
- The live Clarity page reads an empty mission and a legacy phase scalar with an
  inline comment. The existing state resolver reports a conflicting newer phase
  from directories with confidence 0.7; that inference is not a confirmed mission.
- `cockpit-sidecar/client.js` includes fixed green test counts and validation
  nodes. Some gate colours depend on filenames, not gate results.
- Architecture includes a fixed cockpit diagram; memory uses one hard-coded
  Windows project slug; lineage is a static chain. None establishes current use.
- Milestone discovery excludes descriptive milestone slugs and derives dependencies
  from numeric adjacency instead of explicit roadmap declarations.

Reuse `tools/fleet-cockpit/` for cached Git-worktree discovery and lane snapshots;
`tools/cockpit-state/adapter.cjs` and the state resolver for existing read paths;
orchestrator live events, worker state and Atlas registrations for identities;
the existing review, gate-value, gate-evidence, MUDA and mesh-lineage readers for
evidence. These readers need scope/freshness checks before reuse. Fleet currently
discovers one Git repository's worktrees, not every independent project/session.

All paths in this paragraph are under `super-gsd/`. No gate is reimplemented or
bypassed. Existing false assumptions in snapshot/browser tests must be replaced
with assertions for actual evidence, not preserved as compatibility guarantees.

## Identity and authority contract

Every selected view has explicit host, registered project, canonical worktree,
session and run identities. Mission and task IDs link work to that scope. A
worktree may have multiple sessions; a shared branch name or reused task ID does
not join them. Missing identities remain unassigned, not merged heuristically.

Source records stay authoritative. Each derived value carries its source,
original timestamp, evidence reference and availability. Separate:

- declared intent/configuration;
- observed runtime activity;
- inferred legacy state, with confidence and conflicts;
- missing, stale, unsupported or malformed evidence.

An old event cannot become fresh because the server rendered it again. A current
heartbeat proves contact, not that every mission field or gate result is current.
Completion closes the corresponding dispatch/run; earlier progress cannot keep
it running. Query parameters select discovered IDs, never arbitrary filesystem
paths. The server validates containment and rejects symlinks/traversal to private
files outside the selected authorized scope.

## Delivery 1 — truthful existing displays

This is independently useful and can ship before fleet/mission expansion.

1. Use role labels **Orchestrator** and **Executor/Worker**. Show requested model
   and observed model separately when evidence exists; otherwise show unknown.
2. Remove fabricated test successes, handoffs, memory claims and causal edges.
   Static documentation may remain only when labelled as a reference, not live.
3. Missing narration remains missing. Preserve real timestamps and stale states.
4. Artifact presence means an artifact exists. It is not a gate pass, completed
   previous step, elapsed execution duration or proof of active work.
5. Keep the verified Atlas panel unchanged. Explain that collection health and
   task correctness are separate results.

Primary source boundary: `tools/cockpit-sidecar/{cockpit-sidecar.cjs,client.js,
stage-pipeline.cjs}` and their focused tests. Avoid an unrelated renderer rewrite.

## Delivery 2 — per-worktree/session missions

Extend existing fleet discovery with the registered DEVCP project inventory;
group tabs by project/worktree and then session. Explicitly list excluded,
unregistered, stale and unreachable entries. No blind filesystem scan or inferred
claim that all running processes are SGSD sessions.

The selected mission shows original task reference, concise goal, current task,
milestone/phase/plan, last outcome, next action and blockers. The synopsis is a
bounded local template populated from those records. It never claims an inferred
directory is the operator's current intent.

Use existing `run_started.data.user_command` and `session_id` when valid. Capture
new task/mission changes at supported request/lifecycle boundaries; a resume keeps
mission identity, a new request records its relation to the previous mission.
Original task records are immutable; later scope changes append history rather
than overwrite the original request. Unsupported paths are clearly identified.
Do not scrape old transcripts to invent historical missions.

Original prompt content stays in the private worktree/session store and is not
included in Atlas content-free events, global tab lists, notifications or daily
exports. The selected local view may reveal it on demand through an ID-checked,
bounded endpoint. Uncaptured originals say unavailable. No credentials or broader
conversation history are collected.

The private store must be untracked/ignored and excluded from Git publication,
install packaging and generic artifact/handover serving. This applies equally to
derived synopsis text, mission titles and worker questions/replies, which may
repeat original prompt content. Fleet inventory and Atlas/export/notification
surfaces use an explicit content-free metadata allowlist (opaque IDs, role, stage,
status, timing and counts); private mission content is fetched only for the
selected authorized view. Verify these boundaries with sentinel-content tests.

Active workflow steps come from scoped lifecycle/dispatch events. Declared plan
stages and artifact presence remain available separately. Show context/research,
enrichment, plan, execute, verify and close, including skipped-with-reason, retry,
blocked and unknown. Highlight activity without equating it with a green pass.

The tools view distinguishes available, requested, invocation observed and result
observed. Configuration alone never counts as usage. Display existing worker
questions/replies with matching ownership/identities; this is not a new worker
control transport or a permission change.

Primary source boundary: existing fleet transport/cache and cockpit adapter,
focused mission/session projection and capture modules, supported lifecycle hook
integration, installation of their dependency closure and corresponding tests.
Numbered implementation tasks must identify each touched path before editing.

## Diagram skills and live rendering contract

Apply the VTP explainer's source-backed explanation rules to embedded live SVG,
adapting its static-report default to the operator's request for dashboard
diagrams. Keep the cockpit's existing theme and map the skill's semantic colours
onto its tokens; no replacement theme or separate report is required for this
delivery. The skill/theme files were read; VTP retrieval tools are not available
in this session, so project code and `.planning/` are the current evidence sources.
Do not imply a book/research retrieval was performed.

- Label responsibilities, nodes and connections; every view includes a compact
  legend and a plain-language explanation of what the selected mission is doing.
- Distinguish observed, declared/inferred and recommended content in text and
  line styles as well as colour. An optional declared path is not a witnessed
  interaction. Show a static SGSD reference map separately from the live map.
- Nodes/edges with evidence open a bounded source-detail view containing the
  matching scope, record/reference and original timestamp. An unsupported
  connection remains unknown or absent, never a decorative causal arrow.
- Architecture, lifecycle, gate/receipt flow and memory lineage use the same
  selected worktree/session identity. No hard-coded previous-phase examples.
- Use local deterministic SVG layout; update on changed evidence. No image
  generation, external diagram service or model call during refresh/tab changes.
- Keep labels legible at narrow widths. Provide a text/list equivalent, keyboard
  access to details and reduced-motion support; animation never conveys status
  without a textual state. Check dense graphs and long names, not just tiny demos.

The implementation plans must name these skills on the diagram tasks, reuse
relevant existing diagram/theme assets, and include source-ledger/legend checks.

## Delivery 3 — connect evidence to the selected mission

- Architecture: render declared plan/context component relationships with source
  links; overlay only observed interactions with witnessed identities. The fixed
  SGSD reference map is separate. No invented code dependency edges or automatic
  model-generated architecture on page refresh.
- Milestone map: read explicit roadmap dependencies, including not-yet-created
  phase directories and descriptive slugs. Validate missing targets/cycles and
  expose conflicts. Do not impose sequential progress by numeric phase order.
- Memory/enrichment: show retrieval, worker-context inclusion, citations and
  validation as distinct evidence. Existing optional VTP availability degrades
  gracefully. Do not mark an indexed claim validated or equate retrieval with
  meaningful consumption. Real lineage requires referenced parents and verdicts.
- Gates: show scoped ATC, MUDA, verifier and other registered gate outcomes with
  timestamps, applicability, evidence and retained failure/retry history.
  Unknown, not run, skipped, running, failed and passed remain distinct.
- Atlas: show original producer evidence, receipt and canonical observation as
  separate linked stages. Match available run/task/record identities and hashes;
  unmatched or legacy records remain explicitly partial. Never count operational
  events as tokens or add cached/reasoning subsets to total usage.
- Feature usage: distinguish used, not observed, disabled, broken and unsupported.
  Hiding an empty panel does not remove its feature. Actual removal requires
  evidence, dependency review and the operator's decision; protected gates stay.

Primary source boundary: focused evidence/graph projections, existing readers,
cockpit rendering and relevant Atlas operational mappings only if needed for new
content-free mission references. No receiver/accounting rewrite or model changes.

## Resource and failure rules

No automatic narrative generator is added or invoked by the new views. Reuse
existing cached discovery and bounded concurrent reads; reuse unchanged source
projections. A tab switch must not rerun gates, full audits or model calls.
Read only selected scope details; retain clear inventory/row/byte/time truncation
signals. Choose concrete limits in the implementation plans and test both sides
of each limit. Record measured CPU/RSS/read cost before and after on DEVCP.

If a source is unavailable, only that section degrades. Preserve the last known
record with its original timestamp; never relabel it current. Page reconnection
and cached data freshness are separate. Render all task/source content as text.
Retain loopback-only access over the existing SSH connection; do not add a public
listener, stored secrets or an unauthenticated fleet control API.

## Acceptance and rollout

Each delivery gets numbered PLAN tasks, failing-first regression tests,
independent review and the applicable existing SGSD gates before publication.
Do not silently activate P171/P172, close P170, or rewrite Clarity's stale state.

Required falsification cases:

1. Empty fixture has no green tests, fabricated model, live mission or lineage.
2. A verification/capsule filename without a verdict does not pass a gate.
3. Old progress plus newer completion does not leave a worker active.
4. Two sessions reuse a task ID without sharing mission, spend or gate results.
5. Switching worktree tabs changes all panels; a failed fetch cannot leave the
   previous worktree's content under the newly selected worktree's heading.
6. Requested and observed models disagree without one silently replacing the other.
7. Descriptive milestone slugs and explicit nonnumeric dependencies render;
   absent phase directories do not erase declared roadmap nodes.
8. A memory entry with no consumption/validation receipt remains unproven.
9. Real gate failure remains failed even if Atlas successfully captured it;
   missing/corrupt/foreign receipt evidence cannot become reconciled.
10. Resuming a mission retains its original request; changed task history remains
    linked. Unregistered/legacy sessions show unknown rather than invented intent.
11. Prompt-like HTML is escaped; unsafe IDs/paths cannot expose another scope or
    private files. Original prompt content never enters exports/notifications.
12. Fixture/API/browser checks verify no model/gate invocation on polling, refresh
    or tab selection; measure bounded read overhead against the prior baseline.
13. Every live SVG uses the selected scope, labels edge meaning and links real
    evidence only; declared/inferred paths cannot appear observed. Verify text
    alternatives, keyboard detail access, long-label layout and reduced motion.

Use isolated fixtures for failures. Native Linux tests and actual installed
snapshot/browser checks must supplement Windows unit tests. Preserve prior
unrelated dirty files and failed evidence. Record baseline failures separately.

Publish only reviewed owned changes and use normal `sgsd-update` on DEVCP. Verify
source/install hashes and preserve settings, gates, credentials, receiver, other
project pins and existing agent panes. Refresh only an exactly identified cockpit
process if needed; do not restart agent sessions without further authority.
Check that automatic Atlas health checks, daily export and Windows verified copies
still operate. Record implementation revision separately from observation time.

## Explicit exclusions

Full Windows SGSD execution/capture acceptance; wholesale cockpit/theme rebuild;
new orchestration engine; automatic milestone repair; agent permission/model
changes; complete provider billing reconciliation; retrospective prompt recovery;
automatic feature/gate deletion; continuously narrated reasoning.

The first delivery estimate is 2–3 hours; the whole approved scope is estimated
at 10–16 focused hours, subject to source integration and verification findings.
These are estimates, not guarantees or evidence of completed work.

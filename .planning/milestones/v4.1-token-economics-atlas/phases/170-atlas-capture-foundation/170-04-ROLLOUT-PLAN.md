---
phase: 170
plan: "170-04"
status: ACTIVE
authorized_by: operator
authorized_at: 2026-09-08
deployed: false
formal_phase_close: NOT_CLAIMED
---

# Worker and automatic Atlas publication and DEVCP rollout plan

> For agentic workers: use subagent-driven-development for the bounded reconciliation task, with independent specification and quality review before publication. The operator's 2026-09-08 "yes" authorizes publication to origin/master, DEVCP update and a fresh separate benchmark session. It supersedes the earlier source-only restriction for this rollout, not unrelated work.

**Goal:** Publish the already implemented worker/automatic Atlas bundle, install it on DEVCP, and start the approved bounded acceptance benchmark without disturbing existing panes.

**Architecture:** Reconcile the local implementation with the currently published Fable revision, preserving remote fixes and local user work. Use the existing guarded updater and normal SGSD remote launcher. Benchmark evidence determines readiness; no phase/release gate is replaced by installation or process health.

**Tech Stack:** Git, Node 22+ built-in tests, native Linux Bash/Codex, SGSD updater/installer, tmux and local Atlas telemetry.

## Task 1: Reconcile a publishable release candidate

Files: the existing 170-02 automatic Atlas and 170-03 worker source/config/instruction/test changes; `package.json`; the three 2026-09-08 worker analyses and HTML explainer; their phase plans/reports; this plan. Include required missing model-routing tests and the v4.1 planning/design prerequisites from the local feature history. Do not publish unrelated phase-169 edits or `.planning/tmp` contents.

- [ ] Record current branch, dirty-file inventory and local/published SHAs. Preserve the harness-owned worktree; no recursive cleanup, reset, forced checkout or force push.
- [ ] Preserve the local work on a recoverable branch/commit before integration. Construct the release candidate on the fetched `origin/master`, preserving its CEO/Contrarian Fable selection, model-routing schema and payload-cwd Codex hook fixes. Resolve overlaps semantically; never replace all published files with an older tree.
- [ ] Keep `.planning/config.json` operator choices from the published revision unless a change is strictly required and separately explained. Do not resurrect obsolete live checkpoints. Preserve local-only historical work on its original branch.
- [ ] Correct the benchmark's ambiguous board helper reference to `super-gsd/scripts/lib/board-dispatch.cjs` and append the new observed clean `f9f5d0d2` baseline without erasing the earlier observation. Do not claim the benchmark passed.
- [ ] Review the candidate diff for missing runtime dependencies, ignored/untracked release files, secrets, evidence dumps and unrelated changes. Commit with a bounded release message; do not publish yet.

## Task 2: Verify and review the exact candidate

Test existing source suites, not new duplicate gates. Commands from candidate root:

```bash
npm run test:codex-worker
npm run test:board-dispatch
npm run test:atlas
node --test super-gsd/tests/model-routing/model-routing-contract.test.cjs super-gsd/tests/model-routing/model-routing-resolution.test.cjs super-gsd/tests/propagation/model-routing-propagation.test.cjs
node super-gsd/tools/codex-pro/run-self-test.cjs
git diff --check origin/master..HEAD
```

- [ ] Run the Windows baseline and native Linux/WSL candidate suites. Record pass/fail/skip totals. Require the isolated global-install and Bash wrapper tests to actually run on Linux. Do not run an unbounded repository-wide test discovery or any paid worker probe.
- [ ] Validate changed Bash syntax, JSON/config parsing and the existing hook-manifest verification command. Check any changed hook tests using existing tooling.
- [ ] Independently review specification compliance, then code quality/integration. Fix only concrete release blockers under this plan, with regression evidence; unresolved failures prevent publication.
- [ ] Record exact evidence and limitations in `170-04-EXECUTOR-REPORT.md`. Confirm the source and benchmark are present in the committed release tree. Recheck upstream immediately before a normal fast-forward push; if it moved, reconcile and reverify affected paths. Never force push or bypass hooks.

## Task 3: Deploy through the guarded updater

Files: no new production source edits; updater-managed installation paths on DEVCP only. Preserve all existing sessions, project-local operator configuration and telemetry evidence.

- [ ] Record DEVCP source cleanliness, source/install pins and live pane identities before deployment. Resolve the real native Node/Codex environment and the intended existing SGSD project. Refuse unapproved dirty-source reconciliation or process replacement.
- [ ] Publish the verified candidate to `origin/master`; verify the remote SHA.
- [ ] Run the installed `sgsd-update.sh` from the approved DEVCP project, using its normal canonical-source/global-install path. Require successful exit and matching `source_sha`/`project_pin`. Do not bulk-update 37 worktrees or relabel their pins.
- [ ] Verify all B0 artifacts, actual resolved runtime paths and source/install hashes. Check native Codex App Server initialize-only capability without opening a thread or issuing a paid turn. A CLI incompatibility is a blocker; no global toolchain/auth/model changes are authorized here.
- [ ] Verify that pre-existing panes/processes remain intact. Installation alone is not rollout completion or proof of native telemetry coverage.

## Task 4: Launch a separate benchmark and observe its result

Use `.planning/analyses/2026-09-08-devcp-worker-acceptance-benchmark.md`. At most five live Codex wrapper attempts and a 20-minute live benchmark window; no retries or extra model probes. The fresh Fable supervisor may execute the approved benchmark and nothing outside it.

- [ ] Resolve the existing `sgsd-remote-tmux.sh` launcher options and select a unique, absent benchmark session name. Preserve the normal Fable/cockpit topology. Never reset or send commands into existing panes.
- [ ] Start one new normal SGSD Fable session with the published benchmark instructions. If the launcher requires trust/interaction or unsupported configuration, stop and report it; do not silently bypass guards.
- [ ] Observe B0 first; allow B1-B7 only if their prerequisites pass. Record actual worker/model/owner/receipt evidence and before/after Atlas audits. The benchmark's explicit failure tests remain failures in telemetry, not successful tasks.
- [ ] Report WORKER_BRIDGE, ATLAS_OBSERVED_CAPTURE and DEVCP_ROLLOUT separately, with the new session/evidence location. Preserve pre-existing worktree/pane limitations and missing exhaustive coverage. Do not mark phase 170 or a milestone closed.

Rollback boundary: if installation or benchmark fails, preserve source/history/evidence and existing panes. Do not automatically revert the published branch, delete telemetry or kill unrelated processes. Report the exact failure and the smallest next action.

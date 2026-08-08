# P150 PLANNING — Propagation + Trust + Runbook (self-contained; may read only files research cites)

<intent milestone="v3.5">SGSD governance must be a runtime mechanism, not prose — the whole substrate propagates to every SGSD install (local + devcp).</intent>

You are the Codex planner (gpt-5.6-sol/xhigh). Emit ONLY the plan file content (YAML frontmatter schema_version: 2 + body) to stdout. Budget ~5 minutes. Task shape per task: id, type, agent: codex, model: codex, files_touched (string array), input_contract, output_contract, hypothesis, falsifier, stop_rule, verification.commands. Plan-level semantic_acceptance_criteria: array of {id, input, expected_outcome, verification_cmd} with REAL-DATA probes (SCHEMA-09/DLB-07).

## CONTEXT.md (verbatim)
---
phase: "150"
slug: propagation-trust-runbook
milestone: v3.5
status: PENDING
design_ref: ".planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md#p150"
depends_on: ["145", "146", "147", "148", "149"]
---

# P150 Context — Propagation + Trust Grant + Reboot Runbook

## Goal

Every SGSD install gets the v3.5 substrate: push to origin (Berrowj/super-gsd),
local installer re-run, devcp `/sgsd-update`, interactive Codex hook-trust
ceremony on both machines, and a PROPAGATION.md runbook distinguishing
live-updatable pieces from reboot-required pieces with exact commands.

## Targets

- **Local (this machine):** GSDedits worktrees + any repo with super-gsd
  junction. Installer re-run refreshes skills/scripts/registries/hooks.
- **devcp:** SSH host `devcp`, `/opt/clarity/project-clarity-erp`, native-Linux
  codex under WSL-equivalent env. `/sgsd-update` = pull origin/master +
  installer re-run.

## Live-update vs reboot (to be verified, seed expectation)

- Live (next session pickup): skills, scripts, registries, agents, hook script
  bodies.
- Reboot required: PowerShell profile functions (sg/sgsd), MCP server processes
  (stale-child memory: source edit does nothing for spawned child), running
  Claude sessions (need restart to re-read settings.json hook registrations).
- Runbook must include: Windows (`. $PROFILE` vs new terminal; killing stale
  MCP children), devcp (session restart command), and cockpit relaunch.

## Trust ceremony (operator-present, board item 1)

Interactive approval of .codex/hooks.json hooks on BOTH machines; no
`--dangerously-bypass-hook-trust`. Verification probe: dispatch attempting a
forbidden-path write → `block-forbidden-write.cjs` fires (AC-150c).

## Constraints

- Push targets `origin master` after merge from working branch; no PII in
  commits (operator identity rule).
- devcp update must not interrupt in-flight devcp work: check for running
  sessions/uncommitted state before pulling; coordinate or defer.
- PROPAGATION.md commands must be actually executed once as verification
  (AC-150d), not just written.

## devcp reconciliation facts (discovered 2026-08-05, planning-push session)

- `~/GSDedits` on devcp is a FORK: 883 local commits not on GitHub / 1,152
  behind. **Commit authors carry real name + two real emails (googlemail +
  johncullenlighting) — MUST NOT be pushed to GitHub without author rewrite
  (no-PII rule).** Local backup branch created: `devcp-fork-backup-2026-08-05`.
- `~/.claude/super-gsd/source` fast-forwarded cleanly to `d1d95fb` and
  `.super-gsd-version` pinned; but the INSTALLED layer
  (`~/.claude/super-gsd/scripts`) had 43 drifted/extra files, including
  fork-only libs (`board-runner.cjs`, `execution-authority.sh`,
  `concurrency-policy.cjs`, `decision-registry.cjs`) that may depend on fork
  versions of shared libs — blanket sync deferred to this phase.
- Targeted sync done 2026-08-05: `codex-exec.sh`, `codex-executor.sh`,
  `codex-patch-executor.sh` copied from source (timeout fix verified present).
  Full-tree backup: `~/.claude/super-gsd/scripts-backup-2026-08-05.tgz`.
- devcp default codex model is `gpt-5.6-sol` (pinned in clarity config.json —
  wrapper-default overwrite is behavior-safe there; do not regress their pin).
- `/opt/clarity/project-clarity-erp/super-gsd` is VENDORED inside the clarity
  repo (origin = Berrowj/project-clarity-erp), 339 dirty files, branch
  `feat/launch-guide-gate` — out of scope for framework propagation; clarity
  project's own flow governs it.
- P150 must decide: fork author-rewrite + reconcile strategy for the 883
  commits, and the 43-file installed-layer reconciliation.

## Acceptance criteria

AC-150 (a)(b)(c)(d) from the design spec.

## RESEARCH (verbatim)
---
phase: "150"
artifact: RESEARCH
provider: openai-codex (gpt-5.6-sol/xhigh)
---

## Findings

1. **`super-gsd/install.sh` is the canonical installer; the other scripts are wrappers/scaffolders.**

   - `install.sh --install-global` copies Claude agents, skills/commands, Claude hooks, templates, workflows, model-routing config, and top-level scripts plus `scripts/lib` and `scripts/watchdogs` into `~/.claude` (`super-gsd/install.sh:323-449`).
   - `--update` refreshes npm dependencies, the project agent registry, memory taxonomy, and repo-local Claude hook registrations without overwriting `CLAUDE.md` or `.planning/config.json` (`super-gsd/install.sh:629-692`). This preserves devcp’s `gpt-5.6-sol` pin.
   - `sgsd-onboard.ps1` is first-install scaffolding: it creates a `super-gsd` junction only when the path is absent and otherwise leaves it untouched (`super-gsd/scripts/sgsd-onboard.ps1:87-96`). It is not the propagation refresh mechanism.
   - PowerShell functions are installed separately by `Install-SgsdShortcut.ps1 -Force`, which rewrites marked blocks in both user profile variants (`super-gsd/scripts/Install-SgsdShortcut.ps1:45-78,361-402`).
   - Therefore the presently correct local refresh is:

     ```powershell
     bash super-gsd/install.sh --update --install-global
     powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\super-gsd\scripts\Install-SgsdShortcut.ps1 -Force
     . $PROFILE   # or open a new terminal
     ```

2. **The current `/sgsd-update` implementation does not fulfill its documented propagation contract.**

   - Both wrappers pull with unguarded `git pull origin master`, then pass only `--init-project` when `.planning/` exists (`super-gsd/scripts/sgsd-update.sh:81-103`; `super-gsd/scripts/sgsd-update.ps1:84-113`).
   - They never pass `--install-global`, never refresh profile functions, and contain no clean-worktree or fast-forward-only guard.
   - This contradicts the skill’s claim that it propagates “every skill, agent, hook, and script” (`super-gsd/skills/sgsd-update/SKILL.md:9-10,29-33`).
   - P150 must repair the wrappers before treating `/sgsd-update` as the exact devcp command.

3. **Codex hook configuration currently has no installer path.**

   - Project hook registration exists at `.codex/hooks.json:1-52`, with `block-forbidden-write.cjs` registered at lines 14-25.
   - Command evidence: `rg -n '\.codex|hooks\.json|codex-hooks' super-gsd/install.sh super-gsd/scripts/sgsd-update.* super-gsd/scripts/sgsd-onboard.ps1` returns no matches.
   - Consequently, a repo containing only a `super-gsd` junction does not receive root `.codex/hooks.json`; neither onboarding nor `/sgsd-update` makes the devcp target trust-ready.
   - The hook installer must safely create/merge project `.codex/hooks.json` before AC-150c can be claimed on every installation.

4. **Trust is interactive and persisted outside the repo configuration.**

   - Repository evidence records the ceremony: run `codex` interactively once in the target repo, approve the hooks, and trust persists in `~/.codex/state_5.sqlite` (`.planning/milestones/v3.5/phases/144-chronicle-host-shell-boundary/HANDOVER.md:70-78`).
   - Installed `codex-cli 0.146.0` command evidence exposes `--dangerously-bypass-hook-trust` but no trust-grant subcommand; its help describes persisted trust. Thus the exact legitimate commands are:

     ```powershell
     codex -C C:\Users\jack.berrow\GSDedits
     ```

     ```bash
     cd /opt/clarity/project-clarity-erp
     codex
     ```

     The operator must select approval in each interactive prompt. No bypass flag.

   - Mechanical probe after approval:

     ```text
     codex exec -C <repo> --sandbox workspace-write --ask-for-approval never --json \
       "Attempt exactly one apply_patch write to secrets/p150-trust-probe.env containing SHOULD_NOT_EXIST. Do not use a shell command; report the hook denial."
     ```

     Then assert the file is absent and `.planning/metrics/codex-tool-events.jsonl` contains `hook:"block-forbidden-write"`, `decision:"block"`, `reason:"forbidden_path"`, and `path:"secrets/p150-trust-probe.env"`. The hook’s forbidden roots and evidence append are implemented at `super-gsd/tools/codex-hooks/block-forbidden-write.cjs:10-15,28-30,65-105`.

5. **The live/reboot seed is mostly correct, with two important qualifications.**

   - Skills/agents and hook registrations: new client session. SGSD explicitly prohibits mid-session update mutation (`super-gsd/skills/sgsd-update/SKILL.md:63-68`).
   - Hook script bodies: live on the next hook event because registrations spawn `node <script>` (`.codex/hooks.json:14-25`; `super-gsd/config/repo-settings-overlay.json:18-43`).
   - Registries: new process/session, not universally live. `gates-registry.cjs` is a process singleton and requires cache reset or restart (`super-gsd/scripts/lib/gates-registry.cjs:3-12,23-39`); skill routing also caches (`super-gsd/scripts/lib/skill-routing-registry.cjs:45,657-672`).
   - PowerShell functions: `. $PROFILE` or a new terminal; the shortcut installer explicitly recommends a new PowerShell window (`super-gsd/scripts/Install-SgsdShortcut.ps1:402-405`).
   - MCP: restart the owning Claude/Warp session or kill a verified child PID. MCP children load their module graph once (`.planning/memory/workflow/feedback/feedback_stale_mcp_process_diagnosis.md:7-25`).
   - Cockpit: explicit sidecar restart is required. Both start scripts reuse an already-healthy process (`super-gsd/scripts/start-cockpit-server.ps1:97-108`; `super-gsd/scripts/start-cockpit-server.sh:218-229`). Kill the verified PID in `.planning/runtime/cockpit-server.pid`, then run `sgsd-refresh -SkipPreflight`.
   - Devcp full session restart command, only after coordination:

     ```bash
     bash ~/.claude/super-gsd/scripts/sgsd-remote-tmux.sh \
       --project /opt/clarity/project-clarity-erp \
       --session clarity-sgsd --reset --greet
     ```

     `--reset` kills the existing tmux session (`super-gsd/scripts/sgsd-remote-tmux.sh:215-217`).

6. **Existing GSDedits worktrees do not propagate automatically.**

   - Command evidence `git worktree list --porcelain` shows six independent checked-out branches/HEADs; updating or pushing `master` does not move the other branch worktrees.
   - This checkout’s `super-gsd` is a normal directory, not a junction (`Get-Item super-gsd | Select Attributes,LinkType,Target`).
   - PROPAGATION.md must say: junction-backed repos receive source changes from their junction target; existing Git worktrees require a clean-state check and operator-coordinated merge/rebase. Never install from a stale worktree merely to “refresh” it.

7. **devcp has a runtime-provenance conflict that can make AC-150 falsely green.**

   - The Clarity `super-gsd` is vendored, dirty, and explicitly out of framework-propagation scope (`CONTEXT.md:69-72`).
   - The devcp launcher prefers `$PROJECT_DIR/super-gsd/scripts` over the refreshed global install (`super-gsd/scripts/sgsd-remote-tmux.sh:127-141`), and even an explicit `--scripts-dir` does not override the cockpit source when the vendored start script exists.
   - Project registry sync also reads `$PROJECT/super-gsd/agents`, not canonical source (`super-gsd/scripts/sgsd-registry-sync.sh:36-49,74-78`).
   - P150 must either make an explicit canonical-source override authoritative and verify its SHA, or record that Clarity remains separately governed. A smoke against the stale vendored tree cannot prove devcp propagation.

8. **Safe devcp preflight and bootstrap sequence.**

   ```bash
   tmux list-sessions
   pgrep -af 'claude|codex|sgsd-remote-tmux|sgsd-(mission-control|codex-monitor|narrative|autopilot-watchdog)'
   git -C /opt/clarity/project-clarity-erp status --short --branch
   git -C ~/.claude/super-gsd/source status --porcelain=v1 --branch
   git -C ~/GSDedits status --short --branch
   ```

   If any relevant session is running, coordinate or defer. If canonical source is dirty/diverged, stop. Do not pull, reset, merge, or push `~/GSDedits`.

   Current safe bootstrap, before the repaired `/sgsd-update` is installed:

   ```bash
   git -C ~/.claude/super-gsd/source fetch origin master
   test -z "$(git -C ~/.claude/super-gsd/source status --porcelain)"
   git -C ~/.claude/super-gsd/source merge --ff-only origin/master
   bash ~/.claude/super-gsd/source/super-gsd/install.sh --install-global
   ```

   Project-local installation into dirty Clarity must remain an operator decision. After P150 repairs the guard and installer arguments, execute `/sgsd-update` from `/opt/clarity/project-clarity-erp` and verify `git -C ~/.claude/super-gsd/source log -1 --format='%H %s'`.

9. **The 43-file drift cannot be fully enumerated from repository evidence.**

   - CONTEXT records 43 drifted/extra files, four named fork-only components, three reconciled wrappers, and a backup (`CONTEXT.md:58-66`).
   - No analysis, decision, or checked-in manifest contains the other filenames. Therefore the exact remaining count/set is unprovable locally.
   - P150 should produce a fresh `diff -qr`/hash manifest, take a new timestamped archive, inspect dependencies of the four fork-only files, and run a non-deleting install with rollback proof.
   - Defer wholesale rewriting of the 883-commit fork. Preserve it and its backup branch; never push it. If fork-only capabilities are valuable, extract reviewed patches onto a clean `origin/master` branch with `operator <operator@users.noreply.github.com>` identity (`.planning/memory/feedback_no_pii_in_repo.md:14-24`).

## AC-150 verbatim

> **AC-150:** (a) `git log` on devcp shows the pushed HEAD; (b) both machines pass  
> a post-update smoke (`sgsd -NoOpen` preflight + hook self-test); (c) Codex hook  
> trust verified granted on both (probe: dispatch touches a forbidden path →  
> `block-forbidden-write.cjs` fires); (d) PROPAGATION.md reboot commands verified  
> by running them.

Source: `.planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md:159-163`.

## Risks

- `/sgsd-update` currently gives a misleading success without updating global assets.
- `.codex/hooks.json` is not propagated, so trust may be granted against no hooks.
- Clarity’s vendored runtime can mask a successfully updated global devcp installation.
- Blanket installed-layer sync could break fork-only tools through overwritten shared libraries.
- `git pull` without clean/fast-forward guards can merge or conflict in canonical source.
- Linux lacks a literal `sgsd -NoOpen` entrypoint; the plan must add parity or obtain explicit acceptance of an equivalent command.
- Existing worktrees and long-lived registry/cockpit/MCP processes can remain stale despite a successful push.

## Recommended plan shape

1. **Repair updater contract.**  
   `files_touched`: `super-gsd/scripts/sgsd-update.sh`, `sgsd-update.ps1`, `super-gsd/skills/sgsd-update/SKILL.md`, propagation tests. Add clean-source, fetched-SHA and `--ff-only` guards; call `--update --install-global`; preserve project config.

2. **Make Codex hooks installable.**  
   `files_touched`: `.codex/hooks.json`, new canonical hook template, `super-gsd/install.sh`, `sgsd-onboard.ps1`, `scripts/lib/sgsd-readiness.ps1`, installer audit/tests. Safely merge rather than overwrite user hooks.

3. **Close Linux/runtime-provenance gaps.**  
   `files_touched`: `super-gsd/scripts/sgsd-boot.sh`, `sgsd-remote-tmux.sh`, related tests. Add a true no-open smoke and make explicit canonical-source overrides authoritative; print/verify framework HEAD.

4. **Document reconciliation decision and runbook.**  
   `files_touched`: phase `PROPAGATION.md`, a devcp reconciliation decision/manifest. Record “quarantine/defer 883 history,” non-deleting 43-file reconciliation, rollback, live/restart matrix, and exact commands.

5. **OPERATOR-PRESENT — merge, PII gate, push, local propagation.**  
   `files_touched`: source history plus runtime `$PROFILE`, `~/.claude`, project settings. Verify every outgoing commit uses the generic operator identity before `git push origin master`.

6. **OPERATOR-PRESENT — local trust and AC-150b/c/d.**  
   `files_touched`: `~/.codex/state_5.sqlite` and ignored metrics. Approve interactively, run `sgsd -NoOpen`, hook self-test, forbidden-write probe, MCP/profile/cockpit restart commands.

7. **OPERATOR-PRESENT — devcp reconciliation/update/trust/reboot.**  
   `files_touched`: devcp canonical/global install and ignored evidence only. Run safety checks, fresh backup/inventory, guarded `/sgsd-update`, HEAD proof, trust probe, tmux/MCP/cockpit restart, then capture outputs in `150-VERIFICATION.md`.


## VTP enrichment
---
phase: "150"
artifact: VTP-ENRICHMENT
status: success
vtp_available: true
tools_run: [vtp_search_substrate, vtp_search_research]
hits: 1
empty_hit: false
---

# P150 VTP Enrichment

One applicable hit: shadow deployment (doc:daadab474432, Designing Machine
Learning Systems) — deploy the candidate in parallel, keep serving the
existing system until the candidate is verified. Maps directly to the devcp
update posture: backup branch + guarded --ff-only + verify HEAD/self-tests
BEFORE switching anything live; never destructive reconciliation of the
43-file drift. Other hits (SmartVector staleness, Shift-Up guardrails) are
background only. Planner: cite shadow-deployment posture in the devcp task.

## Plan constraints
- Follow the research recommended shape: tasks 1-4 automatable (updater contract repair, hooks installable via safe merge, boot/provenance gaps, PROPAGATION.md + reconciliation decision), tasks 5-7 OPERATOR-PRESENT (merge/PII-gate/push + local trust + devcp ceremony). Mark operator-present tasks with type: operator-present and give each an exact operator script (commands to paste) plus the mechanical post-checks the orchestrator runs afterward.
- devcp task must cite shadow-deployment posture: backup + --ff-only + verify before switching; nothing destructive; 883 PII commits never pushed.
- No gates.yaml predicate duplication; reuse existing wrappers/scripts where research cites them.
- Source Audit section: CONTEXT / RESEARCH / VTP / design-spec rows.

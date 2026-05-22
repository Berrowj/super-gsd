# Brief: DLB-06 — Central Distribution (HTTP Source of Truth)

## Situation

Super-GSD is currently distributed per-machine: each developer clones `github.com/Berrowj/super-gsd` locally and runs `bash super-gsd/install.sh --init-project` in each target project. The installer copies agents, skills, hooks, and scripts into `~/.claude/commands/`, `~/.claude/agents/`, `~/.claude/hooks/`, and `~/.claude/super-gsd/scripts/`. Updates require `git pull` in the source tree followed by a re-run of `install.sh` on every machine that has super-gsd.

Vio's EVA/GSD 2.0 work (surfaced in the operator↔Rolla chat log, 2026-04-20) takes a different approach: a Go harness proxy acts as the HTTP+MCP source of truth, and downstream projects read skills/agents/MD content from the network rather than carrying local copies. Claim: *"you do not need to install GSD BMAD or anything else on your comp."* This works in Vio's stack because he controls the harness layer — his proxy decides complexity, spawns agents, routes to local or cloud LLMs. Claude Code users do NOT have that layer: Claude Code natively loads skills from `~/.claude/commands/` on disk. We cannot intercept its skill-lookup to go HTTP-native without forking Claude Code itself.

The realistic "HTTP source of truth" for super-gsd is therefore **centralised distribution with auto-sync**: one canonical source (either the existing git repo or a served HTTP mirror), plus a sync mechanism that keeps every machine's local installation up-to-date automatically. The sync writes files to disk — Claude Code still reads from disk — but the files arrive from one authoritative source rather than manual git-pull-then-install cycles.

Today's state has three specific pain points: (a) **version drift** across machines — the operator’s laptop has DLB-04 shipped, another machine might still be at pre-DLB-04 if `install.sh` wasn't re-run; (b) **update friction** — shipping a new skill requires every machine to manually re-run `install.sh`; (c) **no shared learning** — each project's `.brv/context-tree/` or `.planning/memory/` is disconnected from every other project's, even though many projects would benefit from shared patterns/anti-patterns (the Bulletproof Data Architecture patterns, SAP quirks, etc.).

DLB-01 explicitly deferred the shared-memory problem: *"cross-project wisdom emerges only if users opt into a shared git remote."* DLB-06 can revisit that within the distribution question, but memory-sharing is semantically distinct from skill/agent distribution and deserves its own key-question.

## Stakes

**Adopted well:** one `super-gsd update` command keeps every machine + every project in sync with the canonical source. Shipping a new skill is a single commit-to-master + wait-for-sync. Multi-machine developers (the operator runs super-gsd on at least two machines) get deterministic state. Optional: shared memory tier across projects unlocks cross-project pattern reuse, closing the last DLB-01 deferral.

**Adopted poorly:** we add a sync daemon that breaks when GitHub rate-limits or when the user is offline. We introduce a moving-target dependency — machines auto-update in the middle of an active session, causing undefined state. We centralise a thing that didn't need centralising (DLB-01 already solved memory discipline; shared memory across projects may not be the actual need — cross-*milestone* within one project might matter more). We build a proxy layer that re-invents what `git pull` already does.

**Ignored:** version drift accumulates silently. A machine that doesn't have DLB-04 shipped runs `/sgsd-muda-audit` differently from one that does — hard-to-debug inconsistency. the operator does the work on laptop A, comes back to laptop B, and the sharpening he made yesterday isn't there until he remembers to reinstall. Multi-machine + multi-project + fast iteration is exactly where drift bites.

## Constraints

* Must work within Claude Code's skill-loading model — skills live in `~/.claude/commands/` on disk, loaded at session start. No HTTP-native skill lookup available in Claude Code today.
* Must respect DLB-01 invariant: git-native, no external paid infra, no new always-on servers unless the sync is strictly local filesystem.
* Must preserve DLB-02/03/04/05 kill-condition discipline: any new mechanism ships with a retirement trigger.
* Must not break existing per-machine installs during transition. Current users on manual `install.sh` should keep working throughout.
* Must not introduce silent auto-update during active sessions — the canonical reason scientists ship their own Python environments: unbounded upstream change mid-work breaks reproducibility. Sync on session start, not mid-session.
* Must respect GitHub rate limits (60 req/hr unauthenticated, 5000/hr authenticated). Sync frequency bounded.
* Offline-safe: if the canonical source is unreachable, the machine continues to work with its last-known-good local copy.

## Key Questions

Five structured questions. Answers must form a coherent stance.

### Q1. Distribution mechanism — what IS the "source of truth"?

* **(a) Git-repo authoritative, `super-gsd update` does the pull + install.** Existing `github.com/Berrowj/super-gsd` remains the source. New `super-gsd/scripts/sgsd-update.ps1` and `.sh` run `git pull` in a canonical clone (e.g. `~/.claude/super-gsd/source/`) then re-run `install.sh`. One command replaces the manual flow.

* **(b) Symlinked-install from a tracked source.** Clone once to `~/.claude/super-gsd/source/`. Install script creates symlinks (or Windows junctions) from `~/.claude/commands/*` to that source. `git pull` in the source IS the update — no re-install step needed.

* **(c) HTTP mirror with local sync daemon.** Run a lightweight HTTP server (github-pages, user's own host, or local on LAN) mirroring the repo content. Clients pull via HTTP on session start. Adds a server dependency but enables non-git transport.

* **(d) Status quo: manual git pull + install.sh.** Defer centralisation entirely. User does the two commands when they remember.

### Q2. Update cadence — when does sync happen?

* **(a) Manual-only, explicit command.** `super-gsd update` runs on-demand. Never automatic. Guarantees no surprise mid-session.

* **(b) On every Claude Code session start.** The existing session-start hook fires `sgsd-update --check`; if upstream has new commits, prompts "X new commits since last sync — pull? (y/N)". Keeps session immutable but catches drift fast.

* **(c) Time-based daemon.** Background task runs `sgsd-update --check` every N hours, updates silently if nothing is in-session. Least friction, highest foot-gun potential.

### Q3. Version pinning — how do projects target a specific super-gsd version?

* **(a) No pinning — everyone tracks master.** Simplest; highest drift risk during active development.

* **(b) Project `.super-gsd-version` file pinning a git SHA or tag.** Each project commits the SHA it was last known to work under; `sgsd-update` in that project pins to that version. New projects default to latest-master.

* **(c) Tagged releases only.** Super-GSD emits semantic version tags (`v1.2.0`, `v1.3.0`); `sgsd-update` fetches the latest tag by default; projects can pin to a specific tag.

### Q4. Shared memory tier across projects — revisit DLB-01's deferral?

DLB-01 explicitly deferred cross-project memory: *"clarity-memory remains project-local to clarity for domain knowledge."* Now that we have consolidated `.planning/memory/` with semantic taxonomy, cross-project sharing is technically cleaner — but is it wanted?

* **(a) Share `architecture/` subfolder across projects.** Cross-project framework-wisdom store. `architecture/patterns/` and `architecture/anti-patterns/` sync from a shared git remote. Project-specific `domain/`, `workflow/`, `project/` stay local. Vio-inspired: core knowledge centralised, project-specific knowledge local.

* **(b) Keep everything local, per DLB-01.** Cross-project wisdom emerges only through explicit `sgsd-curate` in each project, not automatic sync. DLB-01's trade-off stands.

* **(c) Read-only sync from super-gsd repo's seed library.** Each project's `architecture/` pulls from super-gsd's curated seed set (the `brv-seed/domains/` files), but local curation stays local. Shared read, not shared write.

### Q5. Scope boundary — what does this NOT include?

* VTP-style semantic search / MCP server for memory retrieval (DLB-01 40-file tripwire still gates this)
* Local-LLM routing for trivial tasks (explicitly skipped per operator instruction)
* Go harness proxy (not buildable within Claude Code's architecture)
* Any mechanism that bypasses Claude Code's on-disk skill loading

Answers must be coherent. A stance that picks (1c HTTP mirror) + (2c silent daemon) + (3a no pinning) signals "centralise hard, trust upstream" — maximising version consistency but abandoning the reproducibility invariant that has protected every DLB since DLB-01. A stance that picks (1a command) + (2a manual) + (3b SHA pinning) signals "centralise the plumbing but preserve operator control" — the DLB-lineage-consistent answer.

## Additional Context

* **Prior DLB dependencies:**
  - DLB-01 memory topology — Q4 reopens its cross-project deferral
  - DLB-05 just shipped (2026-04-20) — DLB-06 depends on DLB-05's scripts having been built (especially Wave A/B, which will need to be synced across machines)

* **Existing infrastructure to reuse:**
  - `github.com/Berrowj/super-gsd` is already the canonical git repo
  - `install.sh` already handles the copy-to-disk step
  - `sgsd-boot.ps1` already probes for tool presence
  - `~/.claude/super-gsd/scripts/` was created by DLB-04's Wave A globalization — a natural home for a sync-tracked source clone

* **What makes this different from DLB-01:**
  - DLB-01 asked "how do we store memory?" (answer: git-native filesystem)
  - DLB-06 asks "how do we distribute super-gsd itself?" (not the memory — the orchestrator skills and agents)
  - Q4 bridges the two: does distributing super-gsd ALSO distribute some memory? Only the framework-wisdom subset, if at all.

* **Vio-inspired but differently shaped:**
  - Vio's proxy is a runtime router (decides complexity, spawns agents)
  - Super-GSD's "HTTP source" would be a *distribution* mechanism (keeps skill files up-to-date on every machine)
  - These are not the same architectural move; the brief must not conflate them

* **Contrarian pre-bait (expected critiques):**
  - "What failure does this fix?" — Version drift is real but how often has it actually caused a problem? Concrete incidents: zero known. This could be infrastructure-in-search-of-a-problem.
  - "Silent auto-update violates DLB discipline." — Any cadence other than (2a) manual will be attacked.
  - "Q4 reopens DLB-01 without new evidence." — True; the new thing is "memory tier is now consolidated v1.2 taxonomy with clear subfolder semantics." Whether that constitutes sufficient new evidence is arguable.
  - "This is a distribution problem, not an architectural one." — Maybe. But DLB-01's version-drift-ignorance was the first surface of DLB-05's 'cap never fired'-style blind spot.

* **Waves for any eventual plan:**
  - Wave A (Q1 + Q2 implementation) — sgsd-update script + session-start check-and-prompt flow
  - Wave B (Q3 pinning) — `.super-gsd-version` file + update respect + new-project defaults
  - Wave C (Q4 shared architecture/) — new git remote for seed sync + sgsd-curate shared/local split
  - Wave D (docs + rollout) — README, ARCHITECTURE.html, per-machine migration guide

## Termination

phases_affected: 5
max_rounds: 2
gate_score: pending

<!-- 5 = install.sh (distribution mechanism), sgsd-update (new), brief/sgsd-boot
     (version pinning awareness), memory tier (Q4 shared subfolder), docs
     (README/ARCHITECTURE). Max_rounds 2 per precedent; Contrarian will likely
     hammer Q4 and the cadence options. -->

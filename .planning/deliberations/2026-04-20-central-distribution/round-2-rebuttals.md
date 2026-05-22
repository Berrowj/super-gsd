# DLB-06 — Round 2 Rebuttals

Brief: `.planning/briefs/2026-04-20-central-distribution.md`
Date: 2026-04-20

## Round 2 Summary — convergence on narrow scope + UNANIMOUS meta

| Agent | R1 | R2 Final | Movement |
|---|---|---|---|
| Architect | (1a, 2a, 3b, 4b) | (1a, **2b**, **3a-deferred**, 4b) | Conceded 2a→2b on laptop-B refutation; 3b→3a-deferred on DLB-05 sequencing; acknowledged Contrarian's cost-ratio has "real weight" |
| Pragmatist | (1a, 2b, 3a, 4b) | (1a, 2b, 3a-hold, 4b-hold) | Committed to 2b after Moonshot's incident; declared Architect's "in-the-record value" as post-hoc rationalisation; aligned with Contrarian on meta |
| Contrarian | REJECT FRAMING | **REJECT FRAMING HOLDS** + (C) laptop-B verdict + **DELIBERATION-FLOOR proposal** | Hardened position with meta-governance proposal: floor rule for future briefs |
| Moonshot | (1b+fallback, 2b, 3b, 4c) | (**1a**, 2b, 3b, 4c) | Conceded 1b entirely ("30+ symlink ops is install surface, not feature"); held (4c) as the ONE 10x move; 70%-agreed with Contrarian's reject-framing |

## Architect — R2

FINAL POSITION: (1a, 2b, 3a-deferred, 4b).

WHERE YOU MOVED: Q2 — conceded to Pragmatist's (2b). Moonshot's laptop-B incident is not speculation but a pending event that will materialise the next time the operator opens ERP on a second machine. "Manual-only assumes operator remembers every time across machines" is not a design assumption; it is a maintenance burden being laundered as user discipline. A `git fetch --dry-run` check in the existing session-start hook costs ~200ms and zero new infrastructure. The check does not mutate state mid-session. That distinction — check vs apply — is the entire safety property. My (2a) held one invariant that (2b) also holds; I was wrong to treat them as meaningfully different.

Q3 — Concede to Contrarian and Pragmatist. DLB-05's 5 Waves aren't shipped. Master is mid-flight. Pinning a SHA to a moving, unvalidated master is not version discipline — it is false precision creating unpin-repin friction with no stability benefit. (3b) before DLB-05 closes is dishonest. Defer pinning to a follow-on brief filed after DLB-05 Wave A ships.

WHERE YOU HELD: Q1 (1a). Symlinks fail on Windows without Developer Mode for individual files. `~/.claude/commands/` contains non-super-gsd skills that cannot be junctioned wholesale. The gradient detection Moonshot proposes adds per-OS branching logic that outlasts any time saving. Git pull plus install.sh is proven, auditable, and requires no new detection code.

Q4 (4b). (4c) read-only seed sync introduces a coupling point: when the seed set changes, every project's `architecture/` diverges from what was curated locally. That is the same drift problem we are trying to solve, re-introduced at the memory layer. DLB-01's deferral stands.

META: Contrarian's cost-ratio argument has real weight and I will not paper over it. The shell script itself does not warrant a board deliberation. What does: Q2's cadence choice affects behaviour on every session start across every machine — getting that into the record as a deliberated invariant, not a default someone picked in an install script, is the legitimate governance value. Q3's defer is itself a scoped decision with lineage implications. If this brief were Q1 only, Contrarian would be correct to reject it. As scoped across Q1-Q4 touching multi-machine behaviour and a DLB-01 deferral revisit, the filing is marginal but defensible.

ONE RESERVED OBJECTION: (2b) session-start prompt adds a `git fetch` network call on every cold start. If GitHub is unreachable — VPN, corporate proxy, offline travel — the hook must timeout gracefully or users will face a 30-second hang before their session loads. The brief's offline-safe constraint covers this in principle, but the implementation must hardcode a short fetch timeout (2-3 seconds, fail-open) or (2b) degrades into a reliability hazard that makes users disable the hook entirely, returning us to (2a) by attrition.

## Pragmatist — R2

FINAL POSITION: (1a, 2b, 3a-hold, 4b-hold). Deliberation scope should narrow: Q1+Q2 are settled, Q3+Q4 are deferred, not decided.

LAPTOP-B VERDICT: Moonshot's incident lands. ERP overlay written today on laptop A is a live, same-day gap — not theoretical future drift. That is exactly the failure mode (2b) session-start prompt prevents that (2a) misses. Architect's (2a) assumes disciplined manual execution across machines the user doesn't consistently enforce. The incident proves the assumption is already broken before the feature even ships. I move to (2b). The latency cost of a session-start check is ~200 tokens per session. That is not a real argument against it given the alternative is a silently stale overlay running live on a separate machine.

WHERE YOU MOVED: R1 (2b conditional, flagged overhead) to R2 (2b committed). The laptop-B incident removes the "overhead may not be worth it" hedge. Everything else holds.

MONDAY MORNING (revised): First commit belongs to DLB-05. Specifically: DLB-05 Wave A close commit. DLB-06 (1a) script cannot ship until `install.sh` target state is stable — you cannot write an update wrapper around a moving install surface. No change from R1. The laptop-B incident is urgent-feeling but the correct response is a 2-line README note or manual sync today, not shipping DLB-06 ahead of DLB-05.

SEQUENCING RULE: DLB-05 Wave A + Wave B must commit before DLB-06 (1a) ships. Reason: sgsd-update wraps install.sh. If install.sh is mid-refactor when the wrapper ships, every future pull on either machine runs a stale interface. One broken update script is worse than no update script. DLB-06 is a 1-hour task that cannot be un-broken cheaply once distributed. Wait.

On Architect's meta-claim ("getting 2a+3b in the record is the value"): that is post-hoc rationalisation. A 1-paragraph decision note captures the same lineage at zero DLB overhead. A 15k-token deliberation to lock in "manual-only" and "SHA file" is not proportionate to the decision weight. **Contrarian is right on the meta.**

On Q4 (4c Moonshot seed sync): noise concern partially addressed. A curated canonical seed from super-gsd is not project-specific curation — it would not carry SAP anti-patterns. But syncing it into clarity-erp's architecture/ creates a maintenance surface: when super-gsd updates the seed, the project copies drift silently. That is a new class of the exact problem DLB-06 is trying to solve. (4b) holds until there is a sync mechanism. (4c) is premature.

## Contrarian — R2

FINAL POSITION: **Hold reject-framing with one narrowed unlock**: this deliberation fires legitimately ONLY for Q3+Q4, provided Wave A of DLB-05 ships first — the install/sync question (Q1a) is still a shell script, and until DLB-05's next-action checklist clears at least Wave A, sequencing forbids opening a new DLB.

LAPTOP-B VERDICT: **(C) Wrong problem class.** Moonshot named a real event but mis-assigned it. ERP's CLAUDE.md is a per-project file in a per-project repo on laptop A. super-gsd is not responsible for ERP's CLAUDE.md state across machines — it never has been. Correct fix is "the operator runs same Add-Content on laptop B, or ERP's repo tracks CLAUDE.md in git and the operator pulls." Operator behavior and git hygiene, not super-gsd distribution failure. Framing it as super-gsd drift conflates two distinct things: super-gsd's canonical distribution (one problem) and per-project CLAUDE.md drift across machines (different problem that a symlink or install script does NOT solve — laptop B still needs a pull). I concede factual point that the event happened. I hold that it belongs to a different problem class.

WHERE YOU MOVED: Nowhere on framing rejection. I am now more precise: laptop-B evidence, even accepting it fully, points to "per-project CLAUDE.md should be git-tracked and pulled" — not to "super-gsd needs a sync mechanism." A sync mechanism would not have prevented the incident unless ERP's CLAUDE.md was symlinked before the Add-Content ran, which is the circular assumption Moonshot's gradient-with-Dev-Mode-detection relies on.

WHERE YOU HELD HARDEST: Deliberation cost ratio attack survives entirely. DLB-05 cost 185k tokens to ADOPT A SOFT-WARN LOG and two guessed-threshold MUDA probes. Wave A of DLB-05 — the actual output — is a 30-minute task that remains unbuilt. Board is now proposing to open DLB-06 before DLB-05's simplest wave ships. That is the inventory waste I named in R1: decisions accumulating faster than their implementations. The scaling law breaks exactly here: when the decision backlog outpaces the build backlog by more than one DLB, the deliberation process has become its own MUDA category — overproduction of governance artifacts.

META PROPOSAL: **Yes, and it must be explicit: any brief whose Q1 implementation estimate is under 2 hours and reversible via git revert is below the deliberation floor.** Ship it, retrospect it at milestone close, reopen if the retrospective surfaces a real decision. The floor is not "is this worth thinking about" — it is "does this require a board to resolve a genuine disagreement that cannot be settled by building it and observing." DLB-06's Q1a fails that test. File `DELIBERATION-FLOOR.md` with that rule, reference it as a kill-condition pre-check before any future brief enters the DLB queue.

## Moonshot — R2

FINAL POSITION: (1a, 2b, 3b, 4c). Ship the thin wrapper now, keep the session-start prompt and SHA pinning, defer symlink ambition to a purpose-built DLB.

THE ONE 10X MOVE: (4c) read-only seed sync. Here is why it compounds differently than everything else. The symlink gradient is a distribution mechanic — it solves "how does the file get there." The seed sync is a knowledge mechanic — it solves "what does every project know about the framework by default." Cross-project framework-wisdom inheritance means every new project starts with opinionated defaults about token efficiency, ATC tiers, and dispatch patterns without any operator action. That is the flywheel. (1b) symlinks are the delivery pipe; (4c) is what flows through the pipe. Pipe without content is infrastructure theater.

WHERE YOU MOVED: Concede (1b) symlinks entirely. Architect and Pragmatist's attack lands — per-file symlinks at 30+ operations with Dev Mode detection is an install surface, not a feature. The thin wrapper (1a) ships today. Symlink gradient gets its own DLB when the install tooling exists to justify it.

WHERE YOU HELD: Laptop-B incident is not operator error and the board should not let Contrarian's (C) stand. The ERP CLAUDE.md overlay IS super-gsd content. When DLB-05 ships a new overlay version, every machine that manually appended the old version is now silently stale. Distribution problem by definition. "Just re-run Add-Content" is the exact failure mode centralized distribution exists to prevent. Incident is structural, not behavioral.

On (4c) noise: Pragmatist's attack does not apply. Seed library lives in super-gsd's canonical brv-seed/domains/ — no SAP anti-patterns, no project-local noise. Read-only direction means no cross-project contamination by construction. The attack was aimed at bidirectional sync, which (4c) is not.

META: Contrarian's "reject framing" lands at 70%. The deliberation-to-build ratio is real. Moonshot meta-move: close DLB-06 in this round, ship DLB-05 Waves by end of day, let (4c) compound over next two sessions before DLB-07 opens. Accelerating deliberation cadence without accelerating build cadence is the anti-pattern.

## Convergence Map

- **4/4 on Q1a** thin `sgsd-update` wrapper (Contrarian rejects framing but agrees on substance)
- **4/4 on Q2b** session-start drift-check prompt (laptop-B incident decisive)
- **3/1 on Q3 defer** until DLB-05 Waves commit (Moonshot dissents on 3b now)
- **3/1 on Q4 local** per DLB-01 (Moonshot dissents on 4c; Contrarian rejects reopening entirely)
- **3/4 explicit endorsement + 1 at 70% of Contrarian's META proposal**: adopt DELIBERATION-FLOOR.md as governance pre-check
- **4/4 sequencing acknowledgement**: DLB-05 Waves must commit before DLB-06 Q1a ships

## The Meta Decision

Three of four agents explicitly acknowledged Contrarian's cost-ratio critique:
- **Architect R2**: "Contrarian's cost-ratio argument has real weight and I will not paper over it."
- **Pragmatist R2**: "Contrarian is right on the meta."
- **Moonshot R2**: "Contrarian's reject framing lands at 70%."

This is not a split vote on a technical question — it is a unanimous process-level observation. The board self-corrects: it identified that it was firing too often relative to build cadence AND proposed a governance kill condition that would have prevented this deliberation from firing.

CEO synthesis: adopt the technical narrow-scope resolution AND adopt `DELIBERATION-FLOOR.md` as the decisive process output. Future briefs below the floor never reach the board; retrospectives at milestone close catch any false-negatives.

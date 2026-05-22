# DLB-06 — Round 1 Positions

Brief: `.planning/briefs/2026-04-20-central-distribution.md`
Date: 2026-04-20

## Round 1 Summary

| Agent | Position | One-liner |
|---|---|---|
| Architect | (1a, 2a, 3b, 4b) | Thin `super-gsd update` wrapper, manual-only, SHA pinning per project, no cross-project memory |
| Pragmatist | (1a, 2b, 3a, 4b) | Same wrapper, session-start check-prompt, no pinning until DLB-05 Waves close, memory local |
| Contrarian | **REJECT FRAMING** | "Q1a is a shell script. Filing a board costs more than the script costs to write and revert. 700k tokens across 6 DLBs in 48 hours. DLB-05's 5 Waves aren't built." |
| Moonshot | (1b + 1a fallback, 2b, 3b, 4c) | Symlink gradient with Dev Mode detection, session-start prompt, SHA pinning, read-only seed sync from super-gsd canonical seeds |

## Architect — Full Response

POSITION: MODIFY (1a, 2a, 3b, 4b). Thin `super-gsd update` wrapper over git pull + install.sh, manual-only cadence, SHA pinning per project, no cross-project memory.

TECHNICAL RISK: Symlink option (1b) has concrete Windows portability trap — junction points work on directories, mklink file-symlinks require Developer Mode or admin elevation on Windows 11, `~/.claude/commands/` contains non-super-gsd skills that cannot be junctioned wholesale. Risk is bounded but real and wastes 4-8h debugging. Naive path rejected — (1c) HTTP mirror + sync daemon has unacceptable operational surface: 60 req/hr unauthenticated ceiling fails a team of 3 doing concurrent session starts; authenticated tokens mean secret management; LAN server violates DLB-01 no-always-on-servers invariant.

KEY ARGUMENT: Option 1a is 60-90 min of shell work: `super-gsd update` script that does `git -C ~/.claude/super-gsd/source pull origin master`, re-runs install.sh, writes pulled SHA to `.super-gsd-version`. This is not architecture — it is a wrapper over two commands that already exist. Board cost of DLB-06 exceeds the implementation cost of 1a. Reason it earns deliberation is specifically the Q2/Q3/Q4 combo: silent auto-update (2c) + no pinning (3a) creates mid-session undefined state violating every DLB-05 discipline invariant. Getting 2a+3b locked in the record is the actual value of this deliberation, not the distribution mechanism itself.

IMPLEMENTATION SKETCH: Three files. `sgsd-update.sh` — git pull + install.sh re-run + SHA write. `sgsd-version-check.sh` — reads `.super-gsd-version`, compares to upstream via `git ls-remote` (single read, no rate-limit risk), prints drift warning only. Session-start hook calls version-check but NOT auto-update. Project-level `.super-gsd-version` is gitignored by default, opt-in to track. Effort: 2-3h including Windows testing.

BLIND SPOTS: (1) DLB-05's 5 Waves being unbuilt is a sequencing objection the brief surfaces but underweights — `sgsd-update.sh` will ship a distribution mechanism for an unstabilised codebase, meaning pinning (3b) is not optional but load-bearing; if board approves 3a instead, defer the whole brief until Waves land. (2) The brief frames Q4 as "v1.2 taxonomy makes subfolder sharing cleaner" — same DLB-01 pressure in new clothing. The `architecture/` subfolder split does not constitute new empirical evidence; it constitutes better organisation of the same unanswered question. 4b holds.

## Pragmatist — Full Response

POSITION: (1a, 2b, 3a, 4b). Ship `sgsd-update` wrapping `git pull + install.sh`, prompt on session-start, no pinning until DLB-05 Waves close, keep memory local.

EXECUTION RISK: Medium. Session-start hook latency (1-3s on populated repo) tolerable but must be measured. Real risk: DLB-05's 5 Waves aren't shipped. `sgsd-update` deployed today would sync a partially-built system and confuse machines that receive Wave A without Wave B context. Sequencing is the install-blocker, not the mechanism.

KEY ARGUMENT: Distribution problem is `git pull + install.sh` with one fewer manual step, nothing more. Option 1a delivers in ~1 hour by adding `sgsd-update.sh` that does `git -C ~/.claude/super-gsd/source pull && bash install.sh`. The 2b session-start check-and-prompt is not a daemon — it is a `git fetch --dry-run` check in the existing hook, adding latency only when upstream has new commits. Q4 cross-project memory share is a scope expansion with no new evidence since DLB-01; the SAP anti-pattern noise scenario is the default outcome of undifferentiated sync.

MONDAY MORNING: Do not touch DLB-06 until DLB-05 Wave A and Wave B are committed. Those waves define what `sgsd-update` will be syncing. Once Wave B is committed, first commit is `~/.claude/super-gsd/scripts/sgsd-update.sh` (40 lines). Second commit adds session-start hook check-and-prompt. Total: <1h, no new concepts. Q3 pinning via `.super-gsd-version` is a Wave B follow-on only after DLB-05 closes.

BLIND SPOTS: Architect will argue 1b symlinks are cleaner than re-running install.sh on every pull — true in principle, but Windows junction-per-skill-subdir conflicts with non-super-gsd commands sharing `~/.claude/commands/`, and individual-file symlinks require Developer Mode. Real blocker, not theoretical. Contrarian will ask for concrete incident count on version drift (brief admits zero known) and challenge whether this is infrastructure in search of a problem. Fair challenge; answer must be "first incident is when the operator returns to machine B after shipping DLB-05 Wave C — not hypothetical much longer." Moonshot will push for 4c read-only seed sync as cheap cross-project win; I would accept 4c over 4a only if strictly additive and seed library already exists — it does not yet.

## Contrarian — Full Response

POSITION: REJECT FRAMING — this deliberation should not have been filed. If Q1a is in scope, it is a shell script. If Q4 is in scope, it requires new evidence. Neither condition is met.

WHY THE CONSENSUS IS WRONG: The brief pre-baits every obvious critique and frames them as "pre-surfaced," implying they have been considered and neutralised. They have not — they have been named. There is no new evidence on Q4 beyond "the taxonomy has semantic subfolders," which is an artefact of DLB-01 architecture, not new signal about cross-project memory safety. Calling taxonomy refactoring "new evidence" to reopen unanimous 4/4 DLB-01 decision is the pattern DLB-05 Q4 disciplined: two sources agreeing is still literature, not operational evidence.

Sequencing problem more serious than brief acknowledges. DLB-05 shipped 5 Waves NOT BUILT. Board has now deliberated ~700k tokens across 6 sessions in 48 hours. DLB-06 filed before a single Wave of DLB-05 implementation is committed. Structural failure: board is running ahead of the build and gap is widening. Inventory waste in MUDA taxonomy board itself adopted in DLB-02.

Deliberation cost ratio is the kill signal. Q1a — `super-gsd update` wrapping `git pull && bash install.sh` — is an hour of work. Filing board deliberation to decide whether to write that script costs more in governance than the script costs to write AND throw away if wrong.

EVIDENCE NEEDED: One documented instance where super-gsd version drift across machines caused a measurable bad outcome. Not theorised risk. One timestamped event with real cost. Without it, infrastructure-in-search-of-a-problem — the test that held on DLB-05 Q4 and DLB-01 ranking infra.

KILL CONDITION: One of two must happen before this deliberation is worth the tokens: (1) DLB-05 Wave A ships AND version drift incident documented in activity-log.jsonl, OR (2) board agrees Q1a (shell script) does not require deliberation and scopes brief to Q3 + Q4 only — at which point Q4 requires same DLB-01 unlock condition that held in DLB-05: operational evidence, not taxonomy shape.

WHERE YOU MIGHT BE WRONG: Multi-machine drift is genuinely invisible until it causes a failure. Absence of documented incidents may reflect absence of visibility rather than absence of drift. If the operator is silently working from stale installs on a second machine and not noticing, the activity log would not capture it. "Zero documented incidents" test assumes incidents would be detectable — assumption may be wrong for this specific failure class.

## Moonshot — Full Response

POSITION: MODIFY (1b symlinks + 1a fallback gradient, 2b session-start prompt, 3b SHA pinning, 4c read-only seed sync). Symlinked install makes `git pull` the full update mechanism, session-start prompt catches drift without mid-session mutation, SHA pinning preserves reproducibility, seed-sync delivers Q4 value without reopening DLB-01's write-shared-memory debate.

THE 10X QUESTION: What if updating super-gsd on any machine automatically propagated every DLB decision — not just skill files — to every active project on every machine, compounding framework wisdom the way EFI compounded combustion efficiency?

KEY ARGUMENT: The laptop-B drift is NOT hypothetical — the gsd-executor overlay the operator Add-Content'd this morning on laptop A via `Add-Content` does not exist on laptop B. Open ERP on laptop B tomorrow and the gap we closed at 09:00 silently reopens. Concrete pending incident, not zero-incidents infrastructure-search. Symlink mechanism (1b) closes this class of incident permanently: `git pull` in source IS the update, no reinstall, every project symlinked to source picks up next session.

MOONSHOT ALTERNATIVE: Symlinked install (1b) with Developer Mode detection at install time — if Dev Mode on, true symlinks; if off, junctions for dirs + degraded copy-with-hash-check for files. Gradient, not either-or. Combined with (3b) SHA pinning via `.super-gsd-version`: one `git pull` propagates to all projects instantly on next session start, but each project can pin to tested SHA when stability matters. First step: modify `install.sh` to detect junction support and emit the right link type — ~40 lines, one Wave A script.

WHY NOT BIGGER: Q4 shared write is the overreach ceiling. v1.2 taxonomy's `architecture/` subfolder IS cleaner right-to-share boundary than DLB-01 had — genuinely new evidence, not pattern-matching. But shared-write memory needs conflict-resolution story (two projects curate contradictory anti-patterns to same `architecture/patterns/` remote — which wins?). (4c) read-only seed sync from super-gsd's curated seed library delivers 80% of cross-project value with zero conflict surface. Push (4a) write-shared to future DLB once read-only adoption proves demand is real.

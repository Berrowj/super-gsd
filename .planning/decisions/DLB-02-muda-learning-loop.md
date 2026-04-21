---
type: deliberation-memo
date: 2026-04-19
brief: .planning/briefs/2026-04-19-muda-learning-loop.md
board: [architect, pragmatist, contrarian, moonshot]
rounds: 2
vote: "CONVERGENT (4/4 on write-path-only + kill condition); split 2-2 on automation cadence resolved in favour of conditional phase-close"
decision: "Ship narrow write path + 3 watchdog probes; no seed library, no two-tier, no fold; install-blockers first; kill if no recurrence across 2 milestones."
---

# DLB-02: MUDA Learning Loop — Write-Path-First with Kill Condition

## Recommendation

Ship a **narrow write path only** plus **3 targeted watchdog probes** as a parallel detection layer. Do NOT build the seed library, do NOT build the two-tier promotion mechanism, do NOT fold `sgsd-token-audit` yet. Fix the install blockers (FINDING-17, FINDING-18 from Phase 8 self-audit) before any of it — seeding a broken pipe ships zero value. Accept an explicit **kill condition**: if no waste class recurs across the next 2 milestones, abandon the MUDA skill and rely on the 3 watchdog probes alone. The read path (classifier consults memory pre-dispatch) is deferred until 2 milestones of real dispatch data exist — premature wiring against an unvalidated corpus risks training false confidence into the classifier.

## Board Stances

| Agent | Final Position | Key Insight |
|---|---|---|
| Architect | Accepted kill condition. Conditional phase-close (file/diff gate). Defer fold. Held no-op read stub preference. | "Seed library eliminates empty-read-store risk" — but Moonshot withdrew the seed library in R2, so this concession was superseded |
| Pragmatist | Shifted toward Contrarian. Write-path only. Fix install blockers first. Total ~6h ship. | **Discovered FINDING-18**: brv-curate install is broken — seeding into a broken pipe is zero-value inventory waste |
| Contrarian | Softened from OPPOSE to "narrow build with kill condition." | **Decisive insight**: today's 12 audit findings are INSTALL DEFECTS, not dispatch-pattern waste — you cannot train a classifier on install-time typos and expect it to flag runtime waste |
| Moonshot | Stripped seed library, stripped two-tier, kept twice-per-phase write stub only. | "The ambitious version is a loop that self-corrects without human curation — preserved by write path being always-on, not by pre-population" |

## Unanimous positions (4/4)

1. **Write path first**; read path deferred
2. **Fix install blockers (FINDING-17, FINDING-18) before any skill work** — referenced in `.planning/phases/08-sgsd-self-audit/scratch-findings.md`
3. **Do not fold sgsd-token-audit this week** — regression risk on dispatch path exceeds marginal refactor value
4. **Kill condition is real** — tie skill's existence to demonstrable recurrence in next 2 milestones

## Strong consensus (3/4)

5. **No seed library** — the 12 audit findings are install defects, not dispatch-pattern waste; seeding with them trains false signal
6. **Flat single-tier storage for now** — two-tier promotion is premature infrastructure; flat + kill condition together reveal whether tiering is needed
7. **Build the 3 watchdog probes** (Haiku-fail detector, git-process counter, narrative-staleness timer) as a parallel detection layer — Contrarian's one-afternoon alternative becomes an accepted floor, not a replacement

## Residual tension — automation cadence

Board was 2-2 split on when `sgsd-muda-audit` runs:

- **Architect**: conditional phase-close (gate on file count / diff magnitude)
- **Pragmatist**: milestone-close only (cheaper, coarser)
- **Moonshot**: twice per phase (cheap pre-flight + deep close)
- **Contrarian**: softened toward milestone-close but not adamant

**Resolution**: conditional phase-close (Architect's position) wins on architectural grounds — milestone-close produces findings too coarse to act on (waste is already locked into the committed history by the time the milestone closes), and twice-per-phase adds Haiku tax without a store yet worth querying. The conditional gate (4+ files OR 100+ diff lines, with `type: refactor` phases suppressed) pays cost only when change magnitude justifies it.

## Trade-offs Accepted

- **No seed library** means the store is empty on day one — the classifier consults nothing useful initially. Accepted because seeded with install-defect findings would be worse than empty.
- **Read path deferred** means the machinery to inject lessons into the classifier is not built this phase. Accepted because DLB-01's `sgsd-recall` already provides the retrieval primitive — only the classifier wire-up is deferred, not the interface.
- **No two-tier promotion** means any finding is any finding — no distinction between one-off flukes and repeated patterns. Accepted because Contrarian's "one data point isn't a pattern" argument applies regardless of tier mechanism; tiering without data just adds overhead.
- **3 watchdog probes live alongside MUDA** — small duplication (probes detect Haiku fails + git N+1 + narrative staleness; MUDA also covers these in its taxonomy). Accepted because the probes are ~60 lines total and provide live signal that post-hoc audit cannot.
- **Kill condition tied to recurrence**: if two milestones pass with no waste class recurring, MUDA is abandoned and the 3 probes become the canonical solution. This is a real kill — no lingering half-built skill.

## Risks Acknowledged

- **FINDING-18 blocks everything.** The deliberation surfaced that `brv-curate` install is broken (Pragmatist cited). Until fixed, any curation-based loop ships zero value. *Mitigation*: Day 1 is dedicated to FINDING-17 + FINDING-18 fixes, not MUDA work.
- **Recurrence measurement is itself infrastructure.** To validate the kill condition we need to detect "same waste class appeared twice across milestones." That detection mechanism doesn't exist either. *Mitigation*: each write MUST include a `class` tag; a trivial shell script counts class recurrence across milestone boundaries — ~20 lines.
- **Contrarian's sample-of-one fallacy could still apply.** If the 3 watchdog probes catch nothing in the next milestone (because their patterns don't recur), MUDA's kill condition forces abandonment correctly — but the probes themselves may have been premature too. *Mitigation*: the kill condition applies to MUDA; the 3 probes are independently useful as live watchdogs regardless.
- **"Conditional phase-close" heuristic misfires on refactor phases.** Architect flagged this in R1. *Mitigation*: `type: refactor | docs | config` phases skip the audit; explicit tag in PLAN.md frontmatter.
- **DLB-01's `sgsd-recall` wrapper does not exist yet.** DLB-01 prescribes it but implementation is pending. *Mitigation*: the MUDA write path can use plain `Write` to `.brv/context-tree/waste-findings/` with filename conventions until `sgsd-curate` is built; `sgsd-recall` is only needed for the deferred read path.

## Next Actions

### Pre-requisite (Day 1, ~2h)
- [ ] Fix FINDING-17 (settings-overlay never merged by installer) — see `.planning/phases/08-sgsd-self-audit/scratch-findings.md`
- [ ] Fix FINDING-18 (brv-curate broken install) — critical blocker for any curation-based loop
- [ ] Execute DLB-01's next actions in parallel: remove dead `brv` from `.mcp.json`, write `INDEX.md`, build `sgsd-recall` wrapper

### MUDA build (Day 2, ~4h)
- [ ] Write `super-gsd/skills/sgsd-muda-audit/SKILL.md` — the write-path skill
- [ ] Define the 8-waste taxonomy in the skill prompt (defects, overproduction, waiting, non-utilized talent, transportation, inventory, motion, extra-processing)
- [ ] Output contract: `WASTE.md` in phase dir + individual finding files at `.brv/context-tree/waste-findings/<phase>-<class>-<slug>.md` with frontmatter `class`, `severity`, `phase`, `milestone`, `evidence_path`
- [ ] Wire phase-close hook in `sgsd-orchestrate` — conditional on `files_changed >= 4 OR diff_lines >= 100` AND `phase_type NOT IN (refactor, docs, config)`
- [ ] Write the 3 watchdog probes as shell scripts in `super-gsd/scripts/watchdogs/` — Haiku-fail detector, git-process counter, narrative-staleness timer
- [ ] Wire the 3 probes into the existing dashboard heartbeat (they append alerts to metrics/heartbeat.jsonl)

### Kill-condition instrumentation
- [ ] `sgsd-muda-recurrence.sh` — ~20 line shell script that greps `.brv/context-tree/waste-findings/` by `class` across milestones and reports recurrence counts
- [ ] At milestone close: run the recurrence script; if all classes have `count < 2` for two consecutive milestones, flag the MUDA skill for retirement

### Deferred (milestone 2 decision)
- [ ] Read-path wiring into classifier — only if recurrence demonstrates pattern signal
- [ ] Two-tier promotion mechanism — only if read path is live and flat tier proves too noisy
- [ ] Fold `sgsd-token-audit` — only if overlap is demonstrated in next milestone's findings
- [ ] Seed library — NOT planned; the 12 install-defect findings are not dispatch-pattern waste

## Deliberation Metadata

- Agents: Architect, Pragmatist, Contrarian, Moonshot (all Sonnet)
- Rounds: 2
- Estimated cost: ~121k tokens across both rounds
- Phases affected: 6 (sgsd-orchestrate dispatch + every future phase-close + classifier + verifier + gsd-plan-phase + sgsd-token-audit-adjacent)
- Depends on: DLB-01 (memory topology — `sgsd-curate` interface for finding writes); Phase 8 install-blocker fixes
- Blocks: Brief 3 (intent continuity) partially — the intent program also writes to memory; its memo must be consistent with DLB-01's interface and DLB-02's finding schema.

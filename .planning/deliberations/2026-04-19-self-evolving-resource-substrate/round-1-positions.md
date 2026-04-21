# DLB-04 — Round 1 Positions

Brief: `.planning/briefs/2026-04-19-self-evolving-resource-substrate.md`
Date: 2026-04-19

## Round 1 Summary

| Agent | Position | One-liner |
|---|---|---|
| Architect | (1c, 2a, 3c, 4b) | Manifest-only, operator-gated, defer distillation, borrow vocab. Blind spot: registry without Wave D consumer = write-only trap. |
| Pragmatist | (1c, 2a, 3c, 4b) | Same synthesis as Architect. FINDING-18 curate pipe unverified — Day 0 blocker. `/sgsd-deliberate` + git = already propose→assess→commit at architecture grain. |
| Contrarian | REJECT framing | Do nothing on RSPL/SEPL/distillation. No named failure, no production RSPL/SEPL, sample-of-one on distillation. Ship DLB-02 recurrence data first. |
| Moonshot | (1b, 2b, 3b-trajectory, 4b) | Agents+Tools+Memory registry, auto-commit on PASS, distill TRAJECTORIES (EvolveR-style) not findings. 60-line MVP, 3h. |

## Architect — Full Response

POSITION: MODIFY — (1c, 2a, 3c, 4b). Minimum-viable registry as plain manifest, operator-gated proposals only, distillation deferred entirely, borrow RSPL/SEPL vocabulary without AGP schema conformance.

TECHNICAL RISK: Recommended path — filesystem manifest without lifecycle state is only useful if something reads it. If the registry becomes write-only ceremony (like MUDA's write path nearly did), adds overhead with zero return. Rejected path — full 5-resource state machine with typed rollback and auto-commit proposals on a 3-day-old protocol spec is research-grade integration work with no proven return; the "assess" step in any automated SEPL loop needs a ground-truth signal, and SGSD has none.

KEY ARGUMENT: SGSD already has the functional equivalent of RSPL for Memory and Tools — git-versioned files with atomic commits are a lifecycle model. Formalising Agents into the same manifest costs ~30 lines of JSONL. Prompts and Environments have no observed use case. The propose→assess→commit loop already exists at coarser grain: `/sgsd-deliberate` is propose, the DLB board is assess, the decision commit is commit. Building SEPL as a separate automated layer duplicates this without adding a validated assessment signal.

IMPLEMENTATION SKETCH: Wave A only, ~2h. `.planning/resource-registry.jsonl` — `{type, id, path, sha, mtime, status}`. Types: agent (SKILL.md files), tool (scripts), memory (INDEX.md entries). `sgsd-registry-sync.sh` walks those directories, computes sha via git hash-object, writes records. Wire into install.sh post-install hook. 1 script, 1 JSONL, 1 hook line. Proposals stay in `.planning/proposals/` as markdown; operator runs `sgsd-commit-proposal`. No auto-commit.

BLIND SPOTS: Registry useful only if classifier reads it pre-dispatch. Without Wave D wiring, this IS the write-only trap DLB-02 nearly fell into. Legitimate push-back: why build the registry vs. relying on `ls + git log`? Counter is forward-looking (Wave D wiring), which is YAGNI. If board cannot commit to Wave D within v1.2, manifest has no justification and collapses to 1c-as-no-op.

## Pragmatist — Full Response

POSITION: MODIFY (1c, 2a, 3c, 4b) — manifest-only, operator-gated, defer distillation to v1.3+, borrow vocab. Two-file registry, single SEPL gate script. Nothing else this week.

EXECUTION RISK: High. Install chain breaks first. FINDING-17 landed in install.sh but FINDING-18 (brv-curate broken) has no evidence of verified fix — `sgsd-curate.sh` exists but no test harness confirms the pipe works end-to-end. Any Wave A/B/C work that relies on curate is building on an unconfirmed foundation. A SEPL "assess→commit" loop writing lineage via `sgsd-curate` will silently no-op if FINDING-18 is still live.

KEY ARGUMENT: DLB-02 said fix install blockers BEFORE any curation loop. That's not resolved by writing three new briefs — it's resolved by running `sgsd-curate` and confirming the write lands. 80% version: one RESOURCE-MANIFEST.md, one `sgsd-sepl-propose.sh` that writes proposal file, and git-commit as the commit step — because `/sgsd-deliberate` + git commit IS already propose→assess→commit at architecture grain. Resource-grain gap is narrow.

SIMPLER ALTERNATIVE: `super-gsd/config/resource-manifest.json` — flat JSON listing each resource (Tools, Memory, Agents, Prompts) with `version`, `status`, `owner`. No state machine. No protocol schemas. Readable by shell + jq. ~45 min. Rollback is git revert. Satisfies 1c + 4b without AGP overhead.

MONDAY MORNING: First: `bash super-gsd/scripts/sgsd-curate.sh "test-entry"` and confirm record in `.brv/`. If fails, that's the only task. If passes: resource-manifest.json (45 min, ~30 lines). Then wire outcome_delivered injection (DLB-03, 90 min). Two commits. No new frameworks. Wave A full state machine + Wave B lineage = v1.3 candidates.

## Contrarian — Full Response

POSITION: OPPOSE — reject all four questions as framed; do nothing on RSPL/SEPL/distillation until the DLB-02 kill condition is resolved.

WHY THE CONSENSUS IS WRONG: The brief is performing a vocabulary substitution on infrastructure that hasn't earned its keep yet. RSPL names five resource types; SGSD already has two working — but the memory tier has a broken write path (FINDING-18), and the MUDA write path that would generate the corpus for any future distillation hasn't shipped. The proposal asks the board to decide how to close the propose→assess→commit loop at single-resource grain — but `/sgsd-deliberate` already IS that loop at decision grain, with auditable lineage in `.planning/decisions/DLB-*.md`. Nobody has named a concrete gap where the coarser grain demonstrably fails. "A three-day-old arXiv formalises what we built piecemeal" is not a gap — it's naming ceremony. The EvolveR distillation argument is the exact sample-of-one fallacy DLB-02 already closed.

EVIDENCE NEEDED (absent): (1) A named SGSD failure where the absence of Agents/Prompts/Environments as typed resources caused a measurable bad outcome. (2) At least two milestones of MUDA recurrence data. (3) One production system running RSPL/SEPL — not a preprint, not a survey.

KILL CONDITION: If two milestones of MUDA data show zero recurrence across waste classes (DLB-02's already-agreed kill condition), abandon both MUDA and this entire brief.

WHERE YOU MIGHT BE WRONG: If the Agents/Prompts resource gap causes the next milestone's phase-readiness probes to silently drift — something a typed lifecycle would catch — then the ⚠️ in the alignment matrix is load-bearing. The Architect will make this argument and it isn't trivially wrong.

## Moonshot — Full Response

POSITION: (1b, 2b, 3b-trajectory, 4b) — Agents+Tools+Memory registry only, auto-commit on PASS, distill on recurrence-gate BUT from trajectories not findings, borrow AGP vocab. Ambitious play is trajectory distillation as the compounding loop's keystone, not the registry.

THE 10X VISION: Every milestone SGSD runs on is also a training set that makes the next milestone measurably faster — with evidence in the git log.

MECHANISM UNLOCK: Board is debating the registry because it's most structurally novel. Wrong fight. The registry NAMES resources; EvolveR-style trajectory distillation is what actually UPDATES BEHAVIOUR. RSPL without distillation is a labelling exercise. Distillation without a resource model is already what MUDA writes — lacks only the retrieval trigger. Unlock: wire milestone-close to a distillation pass converting ~16 phase trajectories into retrievable abstract principles before v1.3 planning. One milestone's patterns = next milestone's dispatch priors. That is the compounding loop closing.

CHEAP MVP: At milestone-close, run `sgsd-distill-milestone` — a 60-line shell, single Haiku pass over all phase WASTE.md + verifier reports for the closed milestone, extracts abstract patterns into memory tier with `type=trajectory-lesson`. Orchestrator's pre-dispatch query already hits memory tier. Wire read path with ≥2-recurrence gate across milestones (not findings). ~3h.

WHERE OVERREACHING: With one closed milestone (v1.1), zero recurrence evidence. ≥2-milestone gate means read path returns nothing for at least one full milestone. Mechanism unverifiable until v1.3. Honest exposure: counter is ship now so v1.2's trajectories feed the first real retrieval hit at v1.3 close. Cost of waiting = one more milestone of compounding deferred.

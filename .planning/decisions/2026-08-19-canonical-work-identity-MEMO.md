---
type: deliberation-memo
date: 2026-08-19
brief: .planning/briefs/2026-08-19-canonical-work-identity.md
board: [architect, contrarian]
rounds: 1
vote: "VOTE_TIE"
signed_sum: 0
tiebreaker_applied: true
raw_votes: [{position: modify, confidence: 0.78}, {position: modify, confidence: 0.72}]
decision: "Kill the milestone. Ship one phase fixing the shipped default and four blind resolvers. No registry, no renumber. Coverage 100 percent, artifact volume tiered on existing ATC tiers."
---

# Decision

**The milestone is killed. One phase replaces it.**

Neither ASK survived contact with the evidence in the form it was proposed, and the board
found a live defect that neither ASK named.

## What the framing got wrong

The brief presented phases 14 and 15 existing in two trees as an identity collision.
Measured: `.planning/phases/14` holds `WASTE.md` and `commit-reviews.jsonl`;
`.planning/phases/15` holds those plus two per-dispatch-ATC files. Six files of gate
exhaust, zero planning artifacts. That is a writer-accepts-caller-destination defect,
already recorded 3x CRIT at P146, where MUDA and ATC tooling still writes to the pre-SGSD
root. It is not an identity crisis, and phase IDs are already globally unique 09 to 153.

The counter-framing, that archiving the legacy tree is an hour of tidy-up, is also wrong
and more dangerous. `super-gsd/install.sh:572` still runs
`mkdir -p "$PROJECT_DIR/.planning/phases"` on every fresh install. The divergence is the
SHIPPED DEFAULT, not legacy residue. Deleting the tree fixes one repo and regenerates the
split in every new clone.

## The defect nobody asked about

Four tools resolve phase directories ONLY under the legacy root, so they have been
silently blind to every phase from 09 to 153, the entire SGSD era:

- `super-gsd/scripts/sgsd-conformance-check.sh:61` exits 3 when the directory is absent
- `super-gsd/scripts/sgsd-agent-dashboard.sh:208` finds phase dirs under that root only
- `super-gsd/scripts/sgsd-distill-milestone.sh:101` sets `PHASES_DIR` to that root only
- `super-gsd/tools/phase-verifier/phase-verifier.mjs:157` resolves the same way

The fix pattern already exists and is copyable: `super-gsd/tools/phase-folder-audit/audit.cjs:4`
walks both roots.

## Recommendation

Ship ONE phase, not a milestone:

1. Fix `install.sh` so new projects do not ship the divergent layout.
2. Rewire the four single-root resolvers using the existing dual-root pattern.
3. Add one namespace-prefix field for cross-instance IDs (M038, v30-06.8). Defer any
   further cross-instance work until artifacts demonstrably merge.
4. Land the resolver-to-orchestrator wiring FIRST. Both seats agree registry-before-routing
   is backwards.

No canonical registry. No alias map. No renumber.

On ASK 2, coverage survives and ceremony does not. 100 percent of work units get a ledger
row with no exceptions; artifact volume is tiered; the tier is derived mechanically from the
existing ATC SKIP/LITE/FULL/GATE thresholds rather than a new parallel taxonomy; the
operator can escalate any unit upward. The tier is never a discretionary model call.

## Risks Acknowledged

- Three split brains, not two: STATE.md projection, state-resolver derived truth, and a
  proposed registry whose alias map would have no `projection_stale` analogue, while the
  orchestrator reads the stalest of the three.
- Physical renumber permanently desynchronises resolver tier 4 (phase folders) from tier 5
  (`feat(pNN)` commit messages), because commits are immutable and folders are not.
- A hand-maintained registry is a new hand-kept table that drifts from the filesystem it
  describes: the tenth harness-production-seam instance.
- Archiving the legacy tree breaks conformance-check immediately and three consumers
  silently, with no test coverage to catch it.
- Inventing WORK-TIER-1..4 alongside ATC SKIP/LITE/FULL/GATE creates a 4x4 mapping nobody
  holds in their head, the 68-interlocking-parts failure, self-inflicted from the very
  evidence cited to justify tiering.
- A model-assigned tier rebuilds silent bypass at the routing layer. "Too small to record"
  is the same decision shape as "exit 0 means the work happened".
- Starting identity work while P153 is OPEN under GATE_AUTO_HALT means authoring against a
  state nobody has verified.

## Dead Ends / Paths Ruled Out

- Physical renumbering of historical phases. It is a strict cost superset: it still needs
  the alias map, because commits and ledger rows are immutable, PLUS 63-consumer
  propagation, PLUS 83 capsule rewrites of `source_commits` and `supersedes_id`.
- Delete or archive `.planning/phases/` as a standalone sub-hour tidy-up. Breaks four
  consumers, and `install.sh` regenerates it.
- A standalone canonical registry above the resolver. Duplicates derived-truth machinery
  that already exists and is unwired.
- A WORK-TIER taxonomy parallel to ATC tiers.
- Registry-before-routing as originally sequenced.
- Treating M038 and v30-06.8 as in scope now, absent any demonstrated artifact merge.
- Blanket per-fix PLAN.md folders. Ruled out on artifact volume, NOT on coverage.

## Falsifier

Produce one concrete instance where an identifier resolved to the WRONG work unit: a
capsule `supersedes_id`, memory entry, or ledger row that a tool actually read against the
wrong phase. Or show that M038 and v30-06.8 artifacts already merge into a shared substrate
with luminaria-hogback IDs. Either finding makes identity genuinely ambiguous, the registry
earns its keep, and this decision is withdrawn.

Conversely, if fixing `install.sh` plus the four single-root resolvers plus one
namespace-prefix field closes every observed symptom, the milestone stays dead.

Architect variant: a repo-wide scan showing zero live read paths that join an immutable
identifier to a folder-derived phase ID would make the alias map disposable and flip the
cost argument toward renumbering. Resolver tier 5 currently falsifies that.

## Tiebreak Rationale

Both seats returned `modify`, so the signed sum is 0 and the vote is a formal tie. The tie
is procedural, not substantive. The seats converge on every actionable point: no physical
renumber, no registry above the resolver, resolver-to-orchestrator wiring first, tiers
reusing existing ATC thresholds rather than a new taxonomy, and split-brain multiplication
as the governing risk.

They differ only in residual scope. The architect would place a `normaliseWorkId()` choke
point inside `resolve.cjs`, generated from filesystem and git and regenerated in CI. The
contrarian holds that even that is unwarranted until an identity failure is demonstrated,
and that the observed symptoms are fully explained by the shipped default plus four blind
resolvers.

Tiebreak goes to the narrower scope, on evidence rather than preference: every one of the
contrarian claims was verified against source this session, and the architect own falsifier
requires a demonstrated join between immutable and folder-derived IDs that nobody has
produced. Under the evidence-before-machinery discipline, the narrower change ships first.
The `normaliseWorkId()` choke point is retained as the designated next step if and only if
the falsifier is met.

## Post-Synthesis Reflection

Round 2 was not run. Step 4 prescribes groupthink pressure when all members share a
position, and both returned `modify`. I judged this not to be groupthink, because the two
rationales conflict materially on scope and each supplied a distinct falsifier. That was an
orchestrator judgement call against the letter of the skill, and it is recorded here rather
than left implicit.

The orchestrator brief mis-stated its own central premise, calling gate exhaust an identity
collision. The board corrected it. That is the deliberation working as intended, and it is
the second time in this session that a converged position between two models was wrong in
the same direction: both accepted a framing without checking what the colliding directories
actually contained.

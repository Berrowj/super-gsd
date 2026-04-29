# SGSD Code Review Integration Guide (Warp)

How to inspect SGSD-generated changes using Warp's Code Review panel +
the SGSD artifact index. Bridges the mechanical SGSD gates (ATC / verifier /
MUDA / release-readiness) and the human review surface.

## The two-layer review model

| Layer | Tool | What it catches |
|---|---|---|
| Mechanical gates | ATC, verifier, MUDA, release-readiness, edge-guard | Anti-slop, READ-ONLY violations, regression, structural drift |
| Human review (this guide) | Warp Code Review panel + SGSD artifacts | Design intent, naming clarity, surprises, taste |

Mechanical gates produce the EVIDENCE. Human review consumes the
evidence + diff and decides whether to ship.

## Daily review routine (post-phase-close)

```
1. Run workflow: SGSD: Current Phase Artifacts
   -> Lists files in active phase folder
   -> Open the ATC-REVIEW + VERIFICATION the last close produced

2. Open Warp Code Review panel (Cmd+Shift+R or palette)
   -> See uncommitted changes (or recent commits if all atomic)
   -> Inspect diff visually

3. Cross-reference:
   -> {NN}-ATC-REVIEW.md anti-slop checklist findings
   -> {NN}-VERIFICATION.md goal-backward check
   -> {NN}-WASTE.md (if MUDA fired)
   -> .planning/metrics/crit-backlog.jsonl (any new debt rows?)

4. If finding new concerns: leave inline comments in Warp Code Review.
   Send batch to Warp Agent (or Claude Code) for response.
   Re-dispatch fix via /sgsd-orchestrate go if needed.

5. If clean: phase commit is already on master from auto-mode.
   No further action.
```

## Locating review artifacts via MCP

```
sgsd_artifact_links → per-phase file presence map (atc_review,
verification, waste, context paths).
sgsd_current_phase → active phase + close_commit hash.
sgsd_gate_status → latest gate verdicts (which gate fires the warn/fail).
```

These three MCP calls give the operator everything they need to find
the right files in <2 seconds.

## Workflow shortcut

```
SGSD: Open Review Artifacts
```

(Phase 84 ships this workflow alongside this guide — see
`.warp/workflows/sgsd-open-review-artifacts.yaml`.)

The workflow:
1. Reads STATE.md to find active milestone + phase.
2. Resolves phase folder.
3. Lists ATC-REVIEW / VERIFICATION / WASTE / CONTEXT / latest PLAN files.
4. Lists last 5 commits affecting the phase folder.

Operator opens the listed files in Warp's editor, then opens Code
Review panel for the diff.

## When to override mechanical gates

Almost never. AGENTS.md hard rule 2 forbids re-implementing or
bypassing gates. The only legitimate "override":

1. Mechanical gate fires WARN (not FAIL) on a finding.
2. Operator inspects WASTE.md / ATC-REVIEW.md and confirms the finding
   is cosmetic / documented / has a future-fix plan.
3. Operator accepts the deferral; the phase ships PASS-WITH-DEFERRED-N.

Never override:

- ATC CRIT findings without an in-loop fix.
- Edge-guard misses (these force CANDIDATE-WITH-DEBT).
- Release-readiness score < 70 with `edge_guard_miss > 0`.

## Warp Code Review panel features

Warp's Code Review panel offers (per atlas Layer 2):

- File-tree view of uncommitted / staged / recent-commit changes
- Inline diff with syntax highlighting + collapsed unchanged blocks
- Inline comment threads
- Batch send-to-agent (sends accumulated comments to Warp Agent or
  Claude Code as a single context message)
- Revert per file or per hunk

**Recommended use**: post-phase, before committing major work. Since
SGSD auto-mode commits per-task atomically, post-phase usually has
nothing to inspect (already on master). The Code Review panel still
helps for:
- Pre-merge of a feature branch
- Inspecting external operator parallel work (e.g., the ongoing
  cockpit-shell.cjs / mission-control.ps1 modifications)
- Reviewing a phase's CUMULATIVE diff via `git diff <phase-start>..HEAD`

## Cumulative phase diff trick

```powershell
cd C:\Users\jack.berrow\GSDedits

# Find the phase's first commit:
$phase = "76"  # adjust
$firstCommit = git log --oneline --all --grep="feat(p${phase}" | tail -1 | ForEach-Object { $_.Split(' ')[0] }

# Full phase diff:
git diff "${firstCommit}^..HEAD" -- super-gsd/

# Open Warp Code Review against this diff (manual; Warp's panel
# defaults to working-tree but supports range diffs via the toolbar).
```

## Hard rules carried over

- AGENTS.md hard rule 2: Don't duplicate SGSD gates.
- AGENTS.md hard rule 5: No source mutations without an active phase plan.
- AGENTS.md hard rule 1: Read state from `.planning/`, not scrollback.

Code Review is a read+comment+suggest surface. Mutations happen via
the orchestrator dispatching to a fix.

## Related

- `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md` § Code Review (operator routine).
- `super-gsd/docs/SGSD-WARP-WORKFLOWS.md` (workflow catalogue).
- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` (sgsd_artifact_links / sgsd_gate_status / sgsd_current_phase).
- `.agents/skills/sgsd-gate-triage/SKILL.md` — explain a gate failure.
- `.agents/skills/sgsd-cockpit-review/SKILL.md` — review cockpit completeness.

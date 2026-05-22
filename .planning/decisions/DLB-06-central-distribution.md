---
type: deliberation-memo
date: 2026-04-20
brief: .planning/briefs/2026-04-20-central-distribution.md
board: [architect, pragmatist, contrarian, moonshot]
rounds: 2
vote: "3-1 ADOPT narrow scope (Q1a + Q2b; defer Q3+Q4) + UNANIMOUS adoption of Contrarian's meta-proposal (DELIBERATION-FLOOR.md)"
decision: "Ship sgsd-update wrapper + session-start drift-check prompt. Defer SHA pinning until DLB-05 Waves close. Keep memory local per DLB-01. Adopt DELIBERATION-FLOOR.md governance rule: any brief with Q1 impl <2h + reversible via git revert ships without board deliberation."
---

# DLB-06: Central Distribution — Narrow Scope + Governance Floor

## Recommendation

Adopt the coherent stance **(1a, 2b, 3-deferred, 4b)** plus a **UNANIMOUS meta-decision** drawn from Contrarian's R2 critique: file `DELIBERATION-FLOOR.md` as a governance pre-check for future briefs.

The deliberation's honest signal: **three of four board members explicitly acknowledged Contrarian's "reject framing" cost-ratio critique has real weight.** Architect R2: *"Contrarian's cost-ratio argument has real weight and I will not paper over it."* Pragmatist R2: *"Contrarian is right on the meta."* Moonshot R2: *"Contrarian's reject framing lands at 70%."* The technical answers (Q1a ship `sgsd-update`, Q2b session-start prompt, Q3 defer, Q4 local) are a narrow synthesis; the meta-decision to establish a deliberation floor is the deliberation's most important output.

**Q1 + Q2 substantive unanimity:** All four agents converged on Q1a (thin `sgsd-update` wrapper) and Q2b (session-start drift-check prompt), driven by Moonshot's factual refutation of the "zero incidents" attack — the operator’s Add-Content on laptop A this morning has already created a concrete pending drift event when the next session opens on laptop B. Contrarian's (C)-verdict that this belongs to "per-project CLAUDE.md git hygiene" rather than "super-gsd distribution" is logged as a legitimate framing dispute, but the operational effect is the same either way: session-start check-and-prompt prevents the silent regression regardless of which distribution-vs-hygiene frame you pick.

**Q3 (pinning) deferred by unanimous sequencing logic:** DLB-05's 5 Waves are unbuilt. Pinning a project to a SHA on a mid-flight master is false precision. Revisit after Wave A + B commit. Architect moved 3b→3a-deferred; Pragmatist held 3a-deferred; Contrarian rejects; only Moonshot holds 3b. 3/1 defer.

**Q4 (cross-project memory) stays local per DLB-01:** Architect + Pragmatist held (4b). Contrarian rejects Moonshot's (4c read-only seed sync) as reopening DLB-01 via narrower framing without new operational evidence. Moonshot conceded the broader (1b) symlink ambition but held (4c) as the single 10x compounding move. The board's 3/1 holds the DLB-01 deferral intact; Moonshot's (4c) is preserved as a candidate for a future DLB with evidence.

## Board Stances — R1 → R2 Evolution

| Agent | R1 | R2 Final | Key Movement |
|---|---|---|---|
| **Architect** | (1a, 2a, 3b, 4b) | **(1a, 2b, 3a-deferred, 4b)** | **2a→2b** conceded to Moonshot's laptop-B refutation: "manual-only assumes operator remembers every time across machines — maintenance burden laundered as user discipline." **3b→3a-deferred**: "Pinning a SHA to a moving, unvalidated master is not version discipline; it is false precision creating unpin-repin friction." Acknowledged Contrarian's cost-ratio critique as having "real weight." |
| **Pragmatist** | (1a, 2b, 3a, 4b) | (1a, 2b, 3a-hold, 4b-hold) | Committed to (2b) after Moonshot's concrete incident. Declared Architect's "getting 2a+3b in the record is the actual value of this deliberation" as "post-hoc rationalisation." Held that a 1-paragraph decision note captures the same lineage at zero DLB overhead. Declared the correct Monday-morning first commit belongs to DLB-05, not DLB-06. |
| **Contrarian** | REJECT FRAMING | **REJECT FRAMING HOLDS** with narrowed unlock + META PROPOSAL | (C)-verdict on laptop-B: wrong problem class (per-project CLAUDE.md ≠ super-gsd distribution scope). Held cost-ratio attack: *"DLB-05 cost 185k tokens to adopt a soft-warn log. The board is now proposing to open DLB-06 before DLB-05's simplest Wave ships. That is inventory waste — decisions accumulating faster than their implementations."* **Proposed DELIBERATION-FLOOR.md** as a process pre-check: any Q1 impl <2h + reversible via git revert ships without board. |
| **Moonshot** | (1b + fallback, 2b, 3b, 4c) | **(1a, 2b, 3b, 4c)** | **Conceded (1b) symlinks entirely**: "30+ symlink ops at install with Dev Mode detection is install surface, not feature." Held (4c) as the single 10x compounding move (read-only seed sync delivers cross-project framework-wisdom inheritance by construction). Acknowledged "deliberation cadence outpacing build cadence" as the anti-pattern the board itself should name. |

### Unanimous in R2

1. **Q1a** — thin `sgsd-update` wrapper is the distribution mechanism (Contrarian agrees on substance; rejects the need for a deliberation to decide it).
2. **Q2b** — session-start drift-check with prompt, no mid-session mutation. Moonshot's laptop-B concrete incident is the operational evidence Contrarian demanded in R1.
3. **DELIBERATION-FLOOR.md** — adopt Contrarian's meta-proposal as a governance pre-check. 3/4 agents explicitly endorsed; Moonshot at 70%.

### Strong consensus (3/1) in R2

4. **Q3 defer** — pinning before DLB-05 stabilises is false precision. Moonshot dissents on (3b now).
5. **Q4 local (per DLB-01)** — no cross-project memory sync without new operational evidence. Moonshot dissents on (4c read-only seed).

## Unresolved Tensions

### The laptop-B incident — is it "drift" or "operator hygiene"?

Moonshot's factual refutation: the operator Add-Content'd the super-gsd overlay to ERP's CLAUDE.md on laptop A this morning. Laptop B doesn't have it. Opening ERP on laptop B tomorrow silently reopens the gsd-executor gap that was fixed 8 hours ago.

Contrarian's (C)-verdict: wrong problem class. ERP's CLAUDE.md is per-project and per-machine; super-gsd's distribution scope doesn't include content that operators manually appended to project-local files. The fix is git-tracking ERP's CLAUDE.md and pulling, not super-gsd sync.

**Resolution:** both are partially right. The incident is genuine (Moonshot wins "zero incidents is wrong"). The class-assignment matters less than the operational effect: the session-start drift-check prompt (Q2b) catches this regardless of which distribution frame you pick, because the check reads upstream and compares to local regardless of whether the content is "super-gsd's" or "super-gsd content embedded in a per-project file." The (Q2b) mechanism is general enough to cover both framings. Contrarian's class-assignment argument is a correct architectural distinction but doesn't block the operational fix.

### Q4 — Moonshot's (4c) vs DLB-01's original deferral

Moonshot argues v1.2 taxonomy's semantic subfolder split (architecture / workflow / project / domain / reference) is the right-to-share boundary DLB-01 lacked, and read-only seed sync from super-gsd's canonical seed library is narrower than DLB-01's rejected "cross-project wisdom propagation."

Contrarian counters: v1.2 taxonomy is an artifact of DLB-01 architecture, not new operational evidence. Architect concurs: "(4c) introduces a coupling point — when the seed set changes, every project's architecture/ diverges from what was curated locally. That is the same drift problem we are trying to solve, re-introduced at the memory layer."

**Resolution:** (4b) holds. Moonshot's (4c) is preserved as a future DLB candidate when either (a) the seed library's evolution patterns are stable enough that drift is bounded, OR (b) operational evidence of cross-project wisdom loss surfaces concretely. Neither condition is met today.

### The meta — is this DLB-level at all?

Pragmatist + Contrarian both flag: Q1a is a 1-hour shell script. Filing a board deliberation for a 1-hour script costs more in governance than the script costs to write and revert.

Architect's defense: "Getting 2a+3b locked in the record as a deliberated invariant, not a default someone picked in an install script, is the legitimate governance value." Pragmatist called this "post-hoc rationalization." Moonshot agreed at 70%.

**Resolution:** the meta-critique is correct. Adopt `DELIBERATION-FLOOR.md`. Future briefs with Q1 impl <2h + reversible via git revert ship without board; retrospect at milestone close; reopen if retrospective surfaces real disagreement that building didn't settle. The floor is not "is this worth thinking about" — it is "does this require a board to resolve a genuine disagreement that cannot be settled by building and observing."

## Trade-offs Accepted

- **Ship Q1a without a symlink ambition.** Moonshot conceded (1b) entirely. Per-file symlinks need Developer Mode; junction-ing `~/.claude/commands/` wholesale conflicts with non-super-gsd skills. `sgsd-update` as a simple git-pull + install.sh wrapper is the honest scope.

- **Session-start check is read-only network, not state mutation.** Architect's reserved objection: if GitHub is unreachable (VPN, corporate proxy, offline travel), the hook must timeout gracefully in 2-3 seconds fail-open, or users will disable the hook entirely and regress to (2a) by attrition. Hardcode a short fetch timeout as an implementation invariant.

- **No SHA pinning this week.** Waiting until DLB-05 Wave A + B commit + main stabilises before introducing `.super-gsd-version`. Pre-close pinning creates unpin-repin friction with no stability benefit.

- **No cross-project memory sync.** (4b) local holds. Moonshot's (4c) read-only seed sync is preserved as a candidate for a future DLB when either (a) seed-library evolution patterns stabilise or (b) operational cross-project-wisdom-loss evidence surfaces.

- **Adopt a meta-governance rule.** `DELIBERATION-FLOOR.md` captures the "Q1a is a shell script" principle. Any brief whose primary implementation is <2h + reversible via git revert does not require board deliberation. Process-level kill condition: if the floor rule mis-fires (ships a 1-hour script that turns out to need deliberation, causing measurable harm), revisit the rule. Until then, trust the floor.

## Risks Acknowledged

- **Q2b offline failure mode.** If session-start fetch hangs, users disable the hook. *Mitigation*: 2-3s fetch timeout with fail-open semantics (if fetch fails, continue session silently; log to `drift-check-log.jsonl`; prompt next time). The hook never blocks session start.

- **Adopting DELIBERATION-FLOOR.md risks under-governance.** Some "1-hour" decisions surface real architectural tensions only after shipping. *Mitigation*: the floor rule is not "skip documentation" — it is "skip formal board deliberation." A 1-paragraph decision note in `.planning/decisions/` is still required, and milestone-close retrospective scans for shipped-under-floor items that should have been deliberated.

- **Laptop-B incident wasn't prevented by today's deliberation.** The actual fix (append overlay to ERP's CLAUDE.md) was done manually before this brief was even written. DLB-06 addresses the general pattern, not this specific incident. the operator still needs to manually append on laptop B or git-track ERP's CLAUDE.md. *Mitigation*: the Next Actions include a README note about multi-machine overlay maintenance until Q1a ships.

- **Moonshot's (4c) may be right eventually.** By deferring, we accept the risk that cross-project framework-wisdom never compounds (DLB-03 combustion-engine framing stays unresolved at the inter-project grain). *Mitigation*: v1.3 milestone close retrospective explicitly checks whether framework-wisdom drift across projects has surfaced concretely; if yes, reopen with evidence.

- **DLB-06 itself is the kind of deliberation DELIBERATION-FLOOR.md would skip.** Self-referential: adopting the floor rule RETROACTIVELY judges DLB-06 as borderline. The board acknowledges this and treats it as a feature, not a bug — the floor rule emerged from this deliberation because the deliberation exposed its own marginal value.

## Next Actions

### Pre-requisite (blocking)
- [ ] **DLB-05 Wave A + B commit before shipping DLB-06 Q1a.** Pragmatist's install-blocker discipline: you cannot write `sgsd-update` as a wrapper around `install.sh` if install.sh is mid-flight. Sequencing invariant.

### Wave A — Q1a + Q2b ship together (~1.5h, after DLB-05 stabilises)
- [ ] Ship `super-gsd/scripts/sgsd-update.sh` + `sgsd-update.ps1` — `git -C ~/.claude/super-gsd/source pull origin master` then `bash install.sh`. Canonical clone at `~/.claude/super-gsd/source/` (install.sh creates on first run if missing).
- [ ] Extend session-start hook: `git -C ~/.claude/super-gsd/source ls-remote origin HEAD` with 2-3s timeout; compare to local HEAD; if upstream has new commits, emit one-line prompt at session start: `[SUPER-GSD] N commits upstream. Run 'sgsd-update' to sync. (y/N)`. If user says no, record dismissal timestamp; don't re-prompt for 24h.
- [ ] Log all checks to `.planning/metrics/drift-check-log.jsonl`: `{ts, upstream_sha, local_sha, drift: bool, action: pulled|dismissed|timeout}`.
- [ ] Offline-safe: if `ls-remote` fails (network, VPN, timeout), log `action: timeout` and continue session silently. No blocking.

### Wave B — `/sgsd-update` skill (~30m)
- [ ] Create `super-gsd/skills/sgsd-update/SKILL.md` wrapping `sgsd-update.sh` with: inline recall of drift state, invocation of the shell, confirmation of new sha written.
- [ ] Re-install via `install.sh` so `/sgsd-update` appears as a slash command.

### Wave C — DELIBERATION-FLOOR.md (~15m)
- [ ] File `.planning/decisions/DELIBERATION-FLOOR.md` with the rule:
    ```
    Any brief whose primary Q1 implementation is <2h AND reversible via git revert
    does NOT require board deliberation. Ship it; file a 1-paragraph decision note;
    retrospect at milestone close; reopen only if retrospective surfaces real
    disagreement that building didn't settle.
    ```
- [ ] Reference `DELIBERATION-FLOOR.md` in `/sgsd-deliberate` SKILL.md Step 0 (gate check) as a pre-check: if Q1 impl estimate <2h and changes are fully git-revertable, emit "Below deliberation floor per DELIBERATION-FLOOR.md. Ship directly." and exit.
- [ ] Kill condition: if 2 floor-rule dispatches ship and retrospectively needed board review, revisit the threshold (raise to 3h or add reversibility complexity rubric).

### Deferred
- [ ] **Q3 SHA pinning** — `.super-gsd-version` file + update respect + new-project defaults. Revisit after DLB-05 Waves commit + main stabilises.
- [ ] **Q1b symlink gradient** — Moonshot's Dev-Mode-detection fallback. Revisit if per-file update performance becomes a complaint.
- [ ] **Q4 cross-project memory sync** — (4c read-only seed) preserved as future DLB candidate when seed-library evolution patterns stabilise OR operational cross-project-wisdom-loss evidence surfaces.
- [ ] **HTTP mirror + sync daemon** — non-goal per Q5 scope boundary. Violates DLB-01's no-always-on-servers unless strictly local.

## Deliberation Metadata

- Agents: Architect, Pragmatist, Contrarian, Moonshot (all Sonnet)
- Rounds: 2
- **Estimated total: ~80k tokens** (ironic: well below the 80k soft-warn threshold Q1a targets)
- Phases affected: 5 (install.sh, sgsd-update script, session-start hook, `/sgsd-update` skill, DELIBERATION-FLOOR governance doc)
- Depends on: DLB-01 (cross-project deferral preserved), DLB-05 (Wave A + B must commit before DLB-06 Q1a ships)
- Blocks: nothing; enables future `super-gsd update` one-command flow

## Pattern observed — the board self-corrects

DLB-06 is the sixth deliberation in 48 hours. Four of its four agents explicitly named the deliberation-cost-ratio problem. That is not a failure of the deliberation process — it is the process functioning as designed. When the board itself surfaces the "decisions outpacing builds" anti-pattern and proposes a governance-level kill condition (DELIBERATION-FLOOR.md) that would have prevented this deliberation from firing, the system demonstrates the same discipline DLB-02 asked of MUDA (kill conditions must be real), DLB-03 asked of intent injection (structure over ceremony), DLB-04 asked of SEPL (operator-decides retirements), and DLB-05 asked of every activation (evidence before machinery).

The meta-decision is the decisive output. If DELIBERATION-FLOOR.md ships, DLB-06 retroactively judges itself as borderline — and that's the feature. Future briefs below the floor never reach the board.

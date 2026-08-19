# P153 Plan Review — ROUND 3 (narrow: probe soundness + execution readiness)

You returned NOGO twice. Rev 3 is committed. This review is deliberately NARROW.
Do not re-litigate settled points. Read only; modify nothing.

## Read

- `.planning/milestones/v3.6-vtp-bridge/phases/153-hook-transport-completion/153-01-PLAN-LOCKED.md` (rev 3)
- `.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/CONTEXT.md`
- `super-gsd/scripts/merge-settings.js`
- `super-gsd/hooks/sgsd-intent-classifier.cjs`

## Your five round-2 blockers and what rev 3 did

1. **Forgeable provenance.** Replaced entirely. The probe now launches a REAL headless
   Claude session with a fresh random nonce
   (`claude -p '<nonce> ...' --debug hooks --debug-file <tmp>`) and passes only when
   Claude's OWN debug record shows a UserPromptSubmit dispatch AND a new ledger row
   correlates to it by nonce and session_id. A `forged-spawn-must-fail` control asserts
   a direct stdin spawn with forged fields does NOT pass.
2. **P149/P152 probes.** Added as their own ACs, with the plan stating explicitly that
   the P146 compatibility `planning-triage` route is not coverage for the P149 registry.
3. **Overlay contradiction.** New dedicated `super-gsd/config/claude-ups-overlay.json`
   declaring ONLY UserPromptSubmit. `repo-settings-overlay.json` is now a known dead end.
4. **Full merge command** stated verbatim in T1's input_contract.
5. **P154** now requires successful post-fix REAL MCP calls, not just a pre-fix-failing test.

## Answer ONLY these

**A. Attack the causal probe.** This is the whole review. Rev 3 claims a direct spawn
cannot cause Claude to emit a hook-dispatch debug record, so the forged-spawn control
fails by construction. Is that TRUE? Consider concretely:
- Can an executor satisfy the probe without a genuine dispatch — by writing the debug
  file itself, reusing a debug file from an earlier genuine run, replaying a stale
  nonce, or having the test spawn `claude -p` but assert on something that would pass
  even if the hook never fired?
- Does `claude -p` with repo-local `.claude/settings.json` actually load and dispatch
  repo-local hooks? If it does NOT, the entire probe is unimplementable and this is a
  CRIT that must be caught now, before code is written.
- Is `--debug hooks` a real filter that emits a machine-parseable dispatch record, or
  is the plan assuming an output format that may not exist?
If any of these break the mechanism, say so plainly and name what would replace it.

**B. Nonce freshness.** Does the plan actually force a FRESH nonce per run, and would
a stale-nonce replay be caught? If not, name the fix.

**C. Execution readiness.** Ignoring style: is there anything in rev 3 that makes a task
unimplementable as written, or a stop_rule unreachable? Answer only if concrete.

**D. Residual risk if we execute now.** One paragraph: what is most likely to go wrong
during execution, given the executor is Codex gpt-5.6-sol with workspace-write on a repo
whose hook config is being modified?

## Output format — exactly this, max 450 words

```
VERDICT: GO | GO-WITH-CHANGES | NOGO
PROBE_SOUND: YES | NO — <the strongest concrete bypass or breakage you found, and the fix>
CLAUDE_P_DISPATCHES_REPO_LOCAL_HOOKS: YES | NO | UNVERIFIABLE — <evidence or what would settle it>
DEBUG_FORMAT_ASSUMPTION: SAFE | RISKY — <why>
NONCE_FRESHNESS: ENFORCED | NOT_ENFORCED — <fix if not>
BLOCKING_ISSUES: <numbered, or none>
RESIDUAL_RISK: <one paragraph>
```

If rev 3 is executable, say GO. Three NOGOs on a two-task phase would itself be a
finding about the review loop, so only withhold GO for something that would actually
break execution or produce a false pass.

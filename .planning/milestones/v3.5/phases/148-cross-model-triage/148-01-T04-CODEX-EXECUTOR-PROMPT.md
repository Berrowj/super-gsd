# P148 T148-04 — SKILL.md two-model prose + installer sync

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T148-04 of 5).
DONE / DONE_WITH_CONCERNS / BLOCKED.

## Files
- super-gsd/skills/sgsd-triage/SKILL.md (the main surface — prose consumed by
  Claude at triage time)
- super-gsd/install.sh (ONLY if the dry-run check exposes a missing sync path
  for the sgsd-triage skill; minimal change)
- super-gsd/scripts/sgsd-triage-runtime.cjs (READ-ONLY reference; do not edit)

## Output contract (locked plan)
Rewrite the relevant SKILL.md steps so the PROSE drives the RUNTIME rather
than describing manual tool calls:
- Step 0: invoke `node super-gsd/scripts/sgsd-triage-runtime.cjs` (exact CLI
  incl. how the raw query is passed BY FILE — never inline shell-quoted; state
  the temp-file pattern) for VTP enrichment with automatic fallback; the skill
  no longer calls mcp__vtp-kb__* directly in Step 0;
- Step 0.5 (NEW): Codex second opinion — only when the trigger source is the
  P146 planning-triage route; the runtime handles gating/dispatch/validation;
  the skill passes trigger source honestly and renders degradation notes when
  the runtime reports single-model;
- Step 3: pass Claude's classification WITH rationale to the runtime's
  reconciliation (closed A-D vocab + non-empty rationale — the runtime
  refuses otherwise; the prose must say so);
- Step 4: render the reconciliation object VERBATIM shape: agreement one-liner
  with both rationales; disagreement three-line block (Claude path+why, Codex
  path+why+risk_flags/missed_context/recommended_skills, recommendation+why)
  ending in an operator decision question. NEVER auto-fire on disagreement.
Keep every current trigger/exclusion rule, DELIBERATION-FLOOR reference, and
the existing Step 1/2 flow intact. Prose stays CONCISE — this file is loaded
into context on every triage; do not bloat it (P146's ATC flagged contract
bloat as an always-on tax; same applies here).

## Installer check
Run/inspect the install path for skills sync (install.sh); if
`sgsd-triage/SKILL.md` is already covered by the existing skills copy, change
NOTHING and say so. Only patch minimally if it is genuinely missed.

## Verify (report exact exit codes)
1. bash -n install.sh (if touched); the SKILL.md has no verification command —
   instead assert structural invariants via grep: runtime invocation present
   in Step 0; "planning-triage" gate named in Step 0.5; rationale requirement
   stated in Step 3; "never auto" language in Step 4; no direct mcp__vtp-kb__
   call remaining in Step 0 (grep -c).
2. Full 16-scenario suite still green (no runtime edits — should be a no-op;
   run it to prove the read-only rule held).
SURGICAL CONSTRAINT. <250-word report.

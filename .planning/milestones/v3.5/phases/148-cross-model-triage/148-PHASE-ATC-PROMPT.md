# P148 PHASE-LEVEL ATC — Cross-Model Triage (tier: GATE)

Review the ENTIRE phase as one unit. ATC 7-step + anti-slop. You MUST read
the files listed. Do NOT run anything — 28/28 scenarios + all-runner pass
host-side; sandbox spawn EPERM. Emit the 5 contract lines FIRST.

## Phase surface
- super-gsd/scripts/sgsd-triage-runtime.cjs (~1000 lines, the phase core)
- super-gsd/scripts/lib/triage-verdict-schema.cjs
- super-gsd/scripts/lib/vtp-context-composer.cjs (contained-writes update)
- super-gsd/scripts/codex-exec.sh (triage-verdict-v1 + SGSD_CODEX_COMMAND only)
- super-gsd/skills/sgsd-triage/SKILL.md
- super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs (28 scenarios)

## Review history (do NOT re-litigate)
Per-dispatch: CRIT test-isolation (real dispatches burned in tests) fixed via
SGSD_CODEX_COMMAND + leakage marker. Phase-verify: 5 gaps closed (CLI
structured output closing a harness-satisfied AC; route-failure plan-invariant
restore — an ORCHESTRATOR-prompt-caused deviation; toggle consumption; latency
line; reason-code rename). Probes 1-7 clean throughout.

## Judge the phase as a WHOLE
1. Coherence with the milestone's contracts: containment
   (resolveContainedPath, independent roots), envelope-v1 degradation rows,
   __dirname resource resolution, closed-vocab validation both sides. Fork or
   conform?
2. The two defect classes (18 CRITICALs milestone-wide): structurally immune
   or patched? Any writer not routing through containment; any degraded path
   without a row; any silent-success residue (esp. the new CLI JSON output —
   can it be empty/absent while exit 0?).
3. Delete/simplify: runtime ~1000 lines. Dead exports? Duplicated validation
   between schema lib and runtime? Test file ~1500+ lines — fixture-helper
   duplication with the commit-gate suite worth consolidating (or is
   cross-suite reuse premature)?
4. Interactive cost honesty: double-dispatch per planning triage (Claude +
   gpt-5.5/xhigh at up to 300s). Is the gating (planning-only + skip rows)
   sufficient cost control? Is anything dispatched twice unnecessarily?
5. Security: prompt-injection framing + closed vocab + no-auto-fire — any
   path where a hostile query or hostile verdict influences behavior beyond
   the A-D letter?
6. Anti-slop 1-10; mass-delete candidates.

## Report contract (exact — 5 lines FIRST)
FINDINGS: / CRITICAL: / WARNINGS: / PASS_RATE: / ONE_LINER:
FINDINGS_DETAIL: [severity] [dimension] <description>

SALVAGE RECORD (both gapfix4 dispatches timed out at 1200s before reporting; combined implementation verified complete host-side)
FILES_CHANGED: orchestrator-hooks.cjs (input derivation, gate-producer validation, warn-mapping, sampling integration, dispatch-less tolerance), skill-routing-registry.cjs (availability enforcement 18/18), skill-routing.yaml (producer-corrected gate refs), sgsd-orchestrate SKILL.md (consult command passes/derives inputs)
VERIFICATION (host): hooks self-test 18/19 — 8/8 gapfix4 assertions GREEN incl. forged-gate rejection + no-input derivation; sole fail = pre-existing Phase-87 A1. registry 18/18; classifier 8/8. Live no-flag consult derives gate_context files_changed_count=378 diff_lines=73134 input_source=git_phase_first_commit.
DEVIATIONS: chronicle fixture polluted a 3rd time during codex session; reverted; chore ticket stands
ONE_LINER: consult derives inputs from git evidence, rejects forged gate rows, honors sampling/availability, tolerates dispatch-less moments
STATUS: DONE (salvaged)

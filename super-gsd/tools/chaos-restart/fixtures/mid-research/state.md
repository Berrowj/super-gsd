---
gsd_state_version: 1.0
milestone: v2.0-chaos-test
current_phase: 99
current_phase_name: Chaos Restart Test (mid-research)
status: IN_PROGRESS
killed_at_step: mid-research
last_artifact_partial: 99-RESEARCH.md
---

# Synthetic STATE.md - mid-research fixture

The phase 99 state advances synthetically through the chaos harness without
touching the real project STATE.md. The harness writes this file into a
tmpdir per-scenario to verify resume logic.

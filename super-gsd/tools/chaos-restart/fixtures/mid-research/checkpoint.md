---
checkpoint: chaos-restart-mid-research
created: 2026-04-29
session: opus-4.7-1m
mode: autonomous
emergency_halt: false
controlling_principle: Autonomy continues; evidence tells the truth.
next_unit: |
  Resume from mid-research kill point. Researcher subprocess was killed after
  partial RESEARCH.md write at section 3 (token-attribution baseline). Resume
  must:
    1. Detect partial RESEARCH.md (synthesize complete or restart researcher).
    2. Continue planner dispatch.
    3. Reach phase close synthetically (test-only).
killed_at_step: mid-research
phase: 99
plan: 01
---

# Synthetic Checkpoint - mid-research kill

This is a chaos-restart test fixture. The "phase" here is a fake phase 99
used only by the harness to verify that resume logic can read the manifest,
detect the killed-at-step, and complete the synthetic close path.

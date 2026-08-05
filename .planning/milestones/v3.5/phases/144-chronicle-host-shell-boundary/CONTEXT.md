---
phase: "144"
slug: chronicle-host-shell-boundary
milestone: v3.5
status: PENDING
synthesized_by: "sgsd-orchestrate auto (2026-08-05) from HANDOVER.md + 2026-08-02 board memo + design spec — no operator discussion existed; auto-mode CONTEXT synthesis per dispatch rule 6.a"
design_ref: ".planning/analyses/2026-08-05-always-on-orchestration-DESIGN.md"
depends_on: []
---

# P144 Context — Chronicle Host-Shell Boundary (handover-pack automation)

## Goal

Automate the `sgsd-handover-pack/v1` context-handover flow whose reference
instance was hand-written on 2026-08-02 (this phase's HANDOVER.md). When a
session approaches a natural boundary (phase close, milestone close, operator
pause), the orchestrator writes a schema-conformant handover pack
mechanically instead of by hand, so the next session resumes from evidence
rather than prose memory.

## Scope

1. Handover-pack writer (schema `sgsd-handover-pack/v1`, fields per the
   reference instance frontmatter: trigger, git_head, source_artifacts,
   resume block) — validating writer + `--self-test`.
2. Wire-in at natural boundaries: phase close (after Step 6.6.i), milestone
   close, and checkpoint protocol. NOT on context-percentage triggers —
   ruled out by the 2026-04-27 incident and the board memo dead-ends list.
3. Resume consumption: session-start path reads the newest pack for the
   active phase and enters at `resume.next_action` (complements, does not
   replace, ORCHESTRATOR-CHECKPOINT.md).

## Superseded ACs — binding correction

HANDOVER.md's "Binding Acceptance Criteria" (edit-seam hard-block on
Write/Edit without PLAN/AUDIT) are **superseded** by the 2026-08-02 board
memo (no edit-seam blocking; the gate substrate went report-only to P146 and
commit-seam to P147). This phase is ONLY handover automation.

## Constraints

- `PreCompact` hook may not exist in this runtime (board dead-ends list) —
  trigger only on the three natural boundaries above.
- Phase resolution reads STATE.md frontmatter + real `{NN}-*` globs, never
  prose regex (killed the watchdog).
- Writer failure never blocks phase advance (Lock-13 style: log + continue).

## Acceptance criteria

(a) At phase close the pack is written and validates against the schema;
(b) a synthetic resume test enters at `resume.next_action` from a fresh
session context; (c) writer `--self-test` green; (d) hand-written reference
instance still validates (schema is backward-compatible with it).

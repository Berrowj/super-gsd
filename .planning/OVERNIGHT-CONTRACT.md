# Overnight run contract — 2026-08-20, operator asleep

Directive: close out P154, P156, P157, P158, P159 by morning. No operator questions
available. Remote control enabled; push at every phase terminal verdict.

Rules for this run:
1. Per phase: Codex plan -> validate -> ONE review round -> (one fix round max) ->
   execute -> spec review -> per-dispatch ATC (one fix round max) -> commit -> WASTE
   (direct POSIX invocation, known D2 workaround) -> capsule -> SUMMARY.
2. Revision cap: a SECOND NOGO/CRITICAL at any gate = phase closes
   BLOCKED-WITH-GAP-PLAN, loop moves to the next phase. Honest statuses beat fake
   green; morning summary carries the gaps.
3. Operator-only calls: take the safest documented option, record the decision inline
   (gap-plan option-3 precedent). Never relax a falsifier to pass.
4. Quota discipline: no claude -p live probes unless a phase's ACs strictly require
   them; prefer executor-safe modes. If account quota exhausts, phases close on
   executor-safe evidence with live probes recorded as morning follow-ups.
5. Final act: squash-merge to master, PII gate (0 name/email added lines; username
   paths = baseline class), FF push. If the PII scan fails, DO NOT push; leave the
   squash staged and report. Push failure of any kind = stop, not force.
6. Push notifications: one per phase terminal verdict, one at milestone close or stop.

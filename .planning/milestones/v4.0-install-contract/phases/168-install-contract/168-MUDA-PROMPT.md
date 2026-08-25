# MUDA audit — phase 168 Install Contract. Read-only, do not edit.

Scope: commits from `c01baa7` to HEAD on branch luminaria-hogback.

For each of the 8 wastes give OK or WARN with concrete evidence: file:line, commit, or a
counted figure. No waste may be marked OK without a stated reason.

1. Overproduction — code, tests or artifacts beyond the locked plan.
2. Waiting — serialized dispatches that could have been parallel; time lost to
   sandbox-denied commands the orchestrator then re-ran unsandboxed.
3. Transport — context repackaged between agents more than necessary.
4. Over-processing — rework rounds. This phase ran roughly 20 executor dispatches.
   Identify the root causes and say which rounds were avoidable, with evidence. Note in
   particular: one dispatch built a 1,458-line transactional installer that ended with
   `install.sh` exiting 0 delivering nothing and was reverted wholesale; three dispatches
   were killed mid-implementation (two timeouts, one by a wrapper false positive that
   greps stderr for "auth").
5. Inventory — half-finished work, dead scaffolding, uncommitted state, orphaned fixtures
   or temp dirs. Two abandoned patches are deliberately retained as evidence
   (`168-ABANDONED-STAGED-INSTALLER.patch`, `168-SPECFIX-WIP.patch`); judge whether
   keeping them is evidence or clutter.
6. Motion — repeated navigation, re-reading, suites re-run without change.
7. Defects — bugs that escaped into a commit and were fixed later in the same phase.
   Count them and name the ones that reached production code.
8. Unused talent — work given to the wrong model or tool.

Then answer two questions directly:

- The spec-compliance gate FAILed twice before passing, and the plan review NOGOed once.
  Was that gate spend justified by what it caught, or was it rework the plan should have
  prevented? Be concrete about what each gate actually caught.
- This phase's single most expensive mistake was scope over-reach by an executor. What is
  the smallest process change that would have caught it within the first dispatch rather
  than after four?

End with exactly `MUDA VERDICT: PASS` or `MUDA VERDICT: WARN`. Max 500 words.

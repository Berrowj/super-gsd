# MUDA audit — P167 Substrate Invocation Witness

Audit the phase against the 8 wastes. Read-only. Do not edit files.

Scope: commits 2be8f85..HEAD on branch luminaria-hogback.

For each waste give a verdict of OK or WARN with concrete evidence (file:line, commit,
or a counted figure). No waste may be marked OK without a stated reason.

1. Overproduction — code, tests, artifacts, or abstraction built beyond the locked
   plan's scope. The phase produced a large dispatch trail under the phase directory;
   judge whether the SOURCE is overproduced, and separately whether the artifact trail
   is evidence or clutter.
2. Waiting — serialized dispatches that could have been parallel; time lost to
   sandbox-denied commands that the orchestrator then had to re-run unsandboxed.
3. Transport — data or context moved between agents more than necessary.
4. Over-processing — rounds of rework. This phase took roughly fourteen fix rounds on
   T5 alone plus two on the installer guard. Say what the root cause of the rework was
   and which of those rounds were avoidable, with evidence.
5. Inventory — half-finished work, dead scaffolding, uncommitted state, or files left
   behind. Check for orphaned fixtures, temp dirs, and unused exports.
6. Motion — repeated navigation or re-reading, tests re-run without change.
7. Defects — bugs that escaped into a commit and were fixed later in the same phase.
   Count them and name the two that reached production code
   (the parseMcpDomain array-shape rejection, and the deferred install refusal).
8. Unused talent — work given to the wrong model or the wrong tool.

Then answer one question directly: this phase regressed five installer guard cases
and nobody noticed until phase close, because the guard suite was not run between
P161 and now. State the smallest process change that would have caught it at the
first offending commit rather than at close.

End with a line that is exactly `MUDA VERDICT: PASS` or `MUDA VERDICT: WARN`.
Max 500 words.

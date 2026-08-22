---
name: orchestrator-runs-spawn-bound-suites
description: Codex sandboxes cannot spawn nested processes; the orchestrator must own those suites and say so in the prompt
metadata:
  type: pattern
---

# The orchestrator owns spawn-bound suites, and the prompt must say so

Codex runs under a Windows sandbox that returns `spawnSync EPERM` for nested
Node processes and sometimes refuses temp-directory creation. Any suite that
shells out, copies a tree, or spawns a CLI cannot run there.

Across P166 (2026-08-22) this hit `executable-emitters` and
`staged-vtp-oversized-response` in every dispatch, and blocked two reviewer runs
from re-executing writable suites at all.

**The working division:** Codex writes files. The orchestrator runs the full
battery unsandboxed and reports exit codes back.

**Put it in the prompt explicitly**, naming the suites and the reason: "you
cannot run X, its sandbox returns spawnSync EPERM, do not claim it, the
orchestrator runs it." Every P166 dispatch that carried this line came back with
an honest BLOCKERS row naming the limitation instead of a fabricated pass. The
one dispatch that did not carry it was cut off mid-run and reported nothing.

**Corollary for reviewers:** a reviewer that could not re-run suites is auditing
your evidence, not producing its own. Ask it to say which, and record that in
the audit. Two P166 reviewers did exactly this and their verdicts are weaker for
it, which is worth knowing.

Related: [[codex-dispatch-edits-first-division]], [[codex-dispatch-progress-contract]].

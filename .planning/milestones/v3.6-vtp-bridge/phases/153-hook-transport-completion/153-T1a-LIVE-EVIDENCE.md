# P153-T1a — Live dispatch evidence (first genuine firing)

Captured 2026-08-18 by the orchestrator, not the executor.

Command:
    claude -p "how should we architect the retry layer" --setting-sources project \
      --output-format stream-json --verbose --include-hook-events

Observed stream-json hook lifecycle:

    {"type":"system","subtype":"hook_started","hook_name":"UserPromptSubmit",
     "hook_id":"f3a6a7a1-...","session_id":"a29859f1-..."}
    {"type":"system","subtype":"hook_progress","hook_name":"UserPromptSubmit",
     "stdout":"SGSD directive: /sgsd-triage\n"}
    {"type":"system","subtype":"hook_response","hook_name":"UserPromptSubmit",
     "exit_code":0,"outcome":"success","stdout":"SGSD directive: /sgsd-triage\n"}

## What this proves

The repo-local UserPromptSubmit hook DISPATCHES and the classifier RUNS. It matched
the planning-triage route and injected its directive. This is the first time the
P149/P151/P152 governance mechanism has executed in a live session.

## Refuted concern

The installed entry uses {"command":"node","args":["<abs path>"]} rather than the
{"command":"node \"<abs path>\""} string form used by the known-working global hooks.
The orchestrator flagged this as a possible dead-registration seam. The live run
REFUTES it: Claude Code honours the args array. merge-settings.js:281 supports this
shape by design in repo-local mode.

## Findings that change T1b's design

1. stream-json hook events carry hook_name, hook_id, session_id, exit_code, outcome
   and the hook's stdout — but NOT the hook command. So the round-3 requirement to
   "identify the exact classifier command" is NOT satisfiable from these events.

2. The combination attack (another UserPromptSubmit hook's genuine dispatch paired
   with a forged ledger row) is closed STRUCTURALLY instead: assert that exactly ONE
   UserPromptSubmit hook is registered (assert-registration.cjs already proves
   events_added=1 commands=1) AND run probes with --setting-sources project so global
   hooks are not loaded. Under those two conditions a UserPromptSubmit hook_response
   can only be this classifier.

3. Do NOT have the classifier echo a nonce marker on stdout for correlation: a
   UserPromptSubmit hook's stdout is injected into the model's prompt context, so a
   correlation token would pollute production prompts.

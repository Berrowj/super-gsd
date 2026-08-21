# P161-T3F — global enumeration must not fail project preflight; support args-form launches

File ONLY: super-gsd/scripts/lib/hook-registration-preflight.cjs. Edits-first;
no spawns; do NOT commit.

## Pinpointed root cause (orchestrator probes)

preflightProjectManagedRegistrations line ~342 runs
enumerateHookRegistrations(globalSettings) BEFORE the project-descriptor
try/catch. The recovery fixture's broken-phase (oldSha) global settings register
hooks in the `{ type:'command', command:'node', args:[<script>] }` form (see the
test's fixture overlay ~line 949). The enumerator treats command:'node' without
an inline script as hook_registration_launch_invalid and THROWS immediately —
one issue, exactly what the live diagnostic shows
(issue_codes=["hook_registration_launch_invalid"] issues_length=1) — while my
direct repro without that global file yields the correct 3x missing.

## Fix (both halves)

1. enumerateHookRegistrations: support the args-array launch form — a command of
   'node'/'bash' with args[0] as the script path is a legitimate Claude Code
   registration shape; produce a normal descriptor (scriptPath from args[0],
   interpreter from command). Apply everywhere descriptors are parsed so the
   same shape works for project rows too.
2. Defence regardless: in preflightProjectManagedRegistrations, a malformed
   GLOBAL row must never fail the PROJECT preflight — enumerate global settings
   tolerantly (skip-and-record unparseable rows as non-coverage); only project
   rows may produce refusals there.

Static verify: reproduce the exact live shape — project rows realized against a
spaced path + globalSettings containing an args-form row — must throw exactly
3x hook_registration_missing; and an args-form GLOBAL row whose script EXISTS
must count as live coverage (warn path).

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 100 words.

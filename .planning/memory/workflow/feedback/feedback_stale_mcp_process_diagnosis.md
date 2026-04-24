---
name: Diagnose stale MCP child when tool still shows pre-fix behavior — restart, don't declare the fix missing
description: MCP servers are long-lived. Source edit + dist rebuild does nothing for an already-spawned child; symptoms match pre-fix behavior. Check session age before declaring a bug unfixed.
type: feedback
originSessionId: 39d662a6-0be0-46ff-a860-d76f3345e292
---
When an MCP tool returns results consistent with pre-fix behavior after the source was (supposedly) patched, **the MCP child process is almost certainly stale — not the fix missing.** MCP servers are subprocesses spawned by the Claude/GSD client at session start; they load their module graph once and hold it. Editing the source on disk or rebuilding the dist has **zero effect** on an already-running Node process.

**Why:** 2026-04-24 incident, Phase 15 setup. vtp-kb MCP was returning ENOENT on `kb-data/substrate/chunks.jsonl` under the GSDedits cwd + empty project list. I diagnosed this as "upstream fix hasn't landed locally" and wrote a VTP-EVIDENCE bypass stub with that narrative. Operator corrected: the fix was landed in both `Voice-Text-Plan/src/mcp/project-root.ts` source AND the rebuilt `dist/cli.js` — but the Claude session was still talking to an MCP child spawned *before* the rebuild. The transcript was consistent with a stale process, not a failed fix. I burned tokens writing the wrong diagnosis and had to rewrite the stub.

**How to apply:**

1. **Before declaring an MCP bug unfixed**, ask two questions:
   - When was this MCP child spawned? (usually: at Claude/GSD session start)
   - When did the claimed fix land? (check `git log` on the MCP project's source/dist)
   - If fix-mtime > session-start → the child is stale, not broken.

2. **Symptom pattern that flags staleness (not a missing fix):**
   - Tool error references the *old* code path (e.g. old filename, old cwd assumption)
   - Behavior matches what you'd expect *before* the recent fix
   - Other tools on the same MCP server are also affected (whole process is old, not a single tool)

3. **Resolution (in order of preference):**
   - **Restart the Claude/GSD session** — client respawns the MCP child with fresh code. This is the safe default.
   - **Kill the old MCP child process manually** — client reconnects. Faster than a full session restart but requires knowing the PID.
   - **Do NOT** spend tokens writing a "fix hasn't landed" bypass stub before checking session age first.

4. **Hardening suggestion to offer the operator** (not required for this session — a durable improvement):
   - Add an env-var override (e.g. `VTP_KB_ROOT`) at the top of the MCP's root-resolution logic.
   - Resolution preference: explicit env var → module-relative → `process.cwd()` fallback.
   - Rationale: gives an escape hatch that survives launcher quirks. Restart still works, but isn't the only path out.

5. **Document-bypass protocol** (when you can't restart mid-session and must proceed):
   - Write the bypass file with the *correct* diagnosis — "running process pre-dates the fix" not "fix not in source".
   - Preserve the intended query verbatim so it can be replayed once the MCP is fresh.
   - Flag both immediate resolution (restart) AND durable hardening (env override) in the operator follow-up section.

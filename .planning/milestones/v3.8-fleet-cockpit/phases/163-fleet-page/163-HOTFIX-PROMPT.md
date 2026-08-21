# P163 hotfix — production git discovery never wired (live dogfood finding)

Files: super-gsd/tools/fleet-cockpit/{server.cjs,fleet.cjs,run-self-test.cjs}.
Edits-first; no nested spawns in verification beyond in-process listen; do NOT
commit.

## Live evidence (orchestrator, first real run)

`node server.cjs --root <real checkout> --port 7788` serves /healthz ok but
discovered_lanes=0, skipped=[], last_discovery_error=null — while
`git worktree list` in that checkout reports 5+ worktrees (clean \n output,
no CRLF). Root cause: fleet.cjs consumes an injectable porcelain FRAME and
"never spawns a process"; server.cjs never supplies a real frame. Production
discovery does not exist. Harness-production seam: every discovery test fed a
fixture frame.

## Fix

1. Production discovery adapter: child_process.execFileSync('git',
   ['-C', root, 'worktree', 'list', '--porcelain']) (bounded timeout, stderr
   captured; failure => last_discovery_error populated, never a crash), wired as
   the DEFAULT frame source in server.cjs each cache cycle; the injectable frame
   remains for tests.
2. Guard case (production-discovery): build a REAL fixture git repo with 2+
   worktrees, start the PRODUCTION server path against it, assert
   discovered_lanes matches git and lanes appear in /api/fleet. The prior
   frame-fed cases stay.
3. node:child_process is an allowed builtin for exactly this adapter; keep the
   read-only contract (git list is read-only).

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 120 words.

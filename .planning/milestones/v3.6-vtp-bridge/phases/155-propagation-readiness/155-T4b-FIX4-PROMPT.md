# P155 live-fire fix — nested legacy keys hijack the frontmatter reader

Fresh context. Do NOT commit. Found by running the finished work on THIS repo, not by
a reviewer. Do not touch T4's new files; this is resolver frontmatter parsing.

## The live failure, reproduced

`node super-gsd/tools/state-resolver/resolve.cjs --project . --json` on this repo
returns milestone v2.2, phase 67, confidence 0.7 — ground truth is v3.6-vtp-bridge/155.

Cause: `.planning/STATE.md` line 3 has top-level `milestone: v3.6-vtp-bridge` and
line 4 `current_phase: "153"`, but lines 206-207, INDENTED inside a legacy progress
block, carry `current_milestone: v2.2` and `current_phase: complete`. The frontmatter
reader line-scans for `current_milestone:`/`current_phase:` anywhere, so the nested
legacy pair is mistaken for `roadmap_run` fields; correct roadmap_run-beats-top-level
precedence then promotes the ghost. Phase `complete` parses to null, folder discovery
scopes to v2.2, newest there is 67. Even the conflict block lies (`milestone_b: v2.2`).

## Required fix, in resolve.cjs's frontmatter reader (phase-name.cjs only if shared)

1. Read ONLY the first `---`-delimited frontmatter block.
2. Top-level keys are indentation-zero lines only. An indented `current_milestone:` or
   `current_phase:` is NOT a top-level or roadmap_run field.
3. `roadmap_run.*` values may be taken ONLY from lines nested under an actual
   `roadmap_run:` mapping key, tracked by indentation, not from any indented line that
   happens to share a field name.
4. Keep the comment-stripping and precedence rules exactly as they are.

## Required fixture

Add a SEDIMENT case to assert-state-resolver.cjs: a STATE.md modelled on this repo's
shape — correct top-level milestone/current_phase, plus 100+ lines of legacy blocks
containing indented `current_milestone:`, `current_phase:`, `milestone:` decoys and a
giant single-line prose value. Assert the reader returns the top-level values, the
resolved milestone/phase are the v-scheme truth, and the conflict block, when present,
names the TRUE state values.

Verify what the sandbox allows:
    node super-gsd/tests/propagation-readiness/assert-state-resolver.cjs --case all
    node super-gsd/tools/state-resolver/resolve.cjs --self-test

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 120 words.

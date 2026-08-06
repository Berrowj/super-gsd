# Step 9.4 Spec-Compliance + Step 9.5 ATC (combined) — P146 T146-02 repo-local installer

Two reviews in one pass over the same diff. You MUST read the files listed
(use whatever read command your environment provides — reading is required).
Do NOT run self-tests, benchmarks, node, or bash. Do NOT read any other file.
Emit the 5 contract lines FIRST, then FINDINGS_DETAIL, then stop.

## Files to read
- super-gsd/scripts/merge-settings.js  (modified — main surface)
- super-gsd/config/repo-settings-overlay.json (new)
- super-gsd/install.sh (modified — register_repo_local_hooks)

## PART A — spec compliance (did it implement the locked task?)
T146-02 output_contract: install SessionStart, UserPromptSubmit and PostToolUse
entries into repo-local `.claude/settings.json` using `command: "node"` with
install-time ABSOLUTE target-repo script paths in `args`. Preserve
merge-settings idempotency (dedupe by command + matcher) but target
`<repo>/.claude/settings.json` ONLY. T146-02 owns those entries + overlay config.

falsifier — the task FAILS if any holds:
 (a) the installer writes `~/.claude/settings.json`;
 (b) it copies env keys from a home settings fixture;
 (c) it emits hardcoded machine paths from source;
 (d) it duplicates hook entries;
 (e) it omits any of the three hook events.

stop_rule: self-test installs into a temp target, proves home settings
untouched, proves no env sentinel copied, confirms all hook args resolve under
the target repo.

## PART B — ATC (7-step + anti-slop + security) on the same diff
1. SECURITY (highest priority): trace EVERY read/write path. Can any code path
   — including error/fallback branches, env var expansion, or the install.sh
   wiring — read, copy, log, or write `~/.claude/settings.json` or any value
   from its env block? The self-test sets process.env.HOME/USERPROFILE to a
   temp fixture; is that redirection restored afterwards, and can it leak if an
   assertion throws mid-test?
2. Does `--repo-local-hooks` validate its arguments, or can a bad invocation
   write settings to an arbitrary path? (Compare with the T146-01 lesson: a
   writer that accepts any directory was a CRITICAL.)
3. Idempotency: is dedupe genuinely by command+matcher? What happens if an
   entry exists with the same command but a DIFFERENT matcher, or the same
   matcher with different args (e.g. repo moved / path changed)? Stale
   absolute paths from a previous install location — detected or silently kept?
4. Does it clobber or reorder unrelated pre-existing keys / other tools' hooks?
5. Anti-slop: any exported flag, option, or branch with no caller? Duplication
   with the existing home-merge logic that should have been shared?
6. install.sh: is register_repo_local_hooks safe when node is missing, overlay
   missing, DRY_RUN set, or PROJECT_DIR unset/relative?

## Context the reviewer should assume (already verified by the orchestrator; do not re-run)
node --check + bash -n pass. Self-test passes incl. a target path containing
SPACES, and idempotency (3 added → 0 added / 3 already-present). A live merge
into this repo produced 3 correct entries with absolute paths and matcher
`Edit|Write|NotebookEdit`. Home settings md5 identical before/after.
`.claude/` is gitignored, so generated settings are machine-local by design.
The three hook SCRIPTS do not exist yet (T146-03/04/05 build them) — wiring
ahead of bodies is intended, not a defect.

## Report contract (exact — 5 lines FIRST)
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<m>
ONE_LINER: <SPEC_VERDICT pass|fix_required|blocked + ATC summary>
FINDINGS_DETAIL: [severity] [dimension] <description>  (one per CRIT/WARN)

FINDINGS: 4
CRITICAL: 2
WARNINGS: 2
PASS_RATE: 0/4
ONE_LINER: Commit ordering is coherent, but hook activation and stale-worktree propagation remain incomplete.
FINDINGS_DETAIL: [CRITICAL] [propagation] The practical first break is existing-project hook provenance; `sgsd-update` refreshes canonical/global assets, but `merge-settings.js` resolves T1 classifier/guard commands into `<project>/super-gsd`, while devcp’s vendored tree is explicitly outside propagation. The 42-stale-worktree fleet is therefore the weakest segment: its branches and hook bodies do not advance.
FINDINGS_DETAIL: [CRITICAL] [coherence] T4 copies `gsd-session-state.sh`, but `config/settings-overlay.json` still registers only `gsd-session-start.js`. Its test executes the copied file directly, so it misses that fresh global installs never activate the derived-state hook.
FINDINGS_DETAIL: [WARNING] [leftovers] `CLAUDE-OVERLAY.md` still repeatedly instructs raw STATE.md reads, and `sgsd-agent-dashboard.sh` still reads raw STATE plus root `.planning/ROADMAP.md`; the deprecated authority surface remains operational.
FINDINGS_DETAIL: [WARNING] [goal-backward] Live execution returns `source: state_md_legacy`, `confidence: 0.4`, and no conflict. Consequently stale worktrees receive no corrective signal until a v3.6 ROADMAP table exists.

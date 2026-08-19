# P155-T4 spec-compliance review (GATE tier) — includes the live-fire parser fix

Read only. Two work units in this diff, review both against their contracts:
(a) task P155-T4 in `155-01-PLAN-LOCKED.md` — decision-state adapter, resolver-backed
SessionStart hook, orchestrator READ STATE rewiring, installer deployment,
execution-proven consumer test; (b) the fix4 live-fire addendum — nesting-aware
frontmatter reading + SEDIMENT fixture (contract in `155-T4b-FIX4-PROMPT.md`).

Raw evidence: `155-T4-DIFF.txt` (phase dir) spot-checked against the working tree;
executor reports `155-T4-REPORT.md` and `155-T4b-FIX4-REPORT.md`; orchestrator
verification: assert-decision-state-consumers 28/0 unsandboxed INCLUDING the isolated
real-installer case that executes the installed hook; assert-state-resolver 83/0 with
SEDIMENT 8/8; dual-root matrix 309/0; live render on this very repo now
v3.6-vtp-bridge/153 conf 0.4 source state_md_legacy (truthful: no v3.6 ROADMAP, folder
ordering abstains, STATE genuinely says 153).

T4 falsifier clauses to check in the diff:
- raw frontmatter driving either consumer anywhere; warnings hidden; consumers diverge
- deployment inferred from repo bytes/config text instead of executing the installed hook
- the adapter or hook WRITING STATE.md or anything else
- SKILL.md edits beyond the two READ STATE sites
- the T2-T3 installer layout hunk disturbed
- env block read anywhere

Fix4 clauses: only first frontmatter block read; indentation-zero keys only at top
level; roadmap_run fields only from a real nested roadmap_run mapping; comment
stripping and precedence preserved.

Output, contract lines first, then max 200 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
SPEC_VERDICT: pass|fix_required|blocked
MISSING_REQUIREMENTS: none|<list>
EXTRA_SCOPE: none|<list>
STATE_WRITE_SAFE: yes|no
DEPLOYMENT_PROOF: execution|inference — <evidence>
```

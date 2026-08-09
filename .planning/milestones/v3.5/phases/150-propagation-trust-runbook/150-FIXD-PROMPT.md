# P150-fixD — PII scrub (operator-approved: scrub current + test forward)

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). Operator ruling: scrub identifiable Windows account paths from CURRENT tracked files; extend the privacy test to cover newly published artifacts; existing pushed history stays. 40-min window; PROGRESS CONTRACT applies (fixD stage lines to .planning/metrics/dispatch-progress.txt; report early if pressed).

## Scope
1. In every tracked file under .planning/milestones/v3.5/phases/150-propagation-trust-runbook/ containing '<operator-account>' (23 files: plans, research, prompts, reports, reviews): replace the account-path prefix contextually — 'C:\Users\<operator-account>' -> '$env:USERPROFILE' inside PowerShell blocks, 'C:/Users/<operator-account>' -> '$HOME' in bash/MSYS contexts, and '%USERPROFILE%' or a neutral '<redacted-home>' ONLY in pure prose where no execution happens (PROPAGATION.md itself is already clean — do not regress it; its test forbids <...> placeholders in COMMANDS only).
2. Run git grep for the username across ALL tracked files (excluding .jsonl metrics) and scrub remaining occurrences with the same context rules — EXCEPT .planning/memory/ files where the path is part of a factual incident record (leave those, list them in DEVIATIONS).
3. Extend the runbook-contract privacy test: scan ALL tracked files under the phase dir (not just PROPAGATION.md) for the username and fail on any occurrence; keep it fast (git ls-files + read).
4. Locked plan caution: 150-01-PLAN-LOCKED.md task ids/hypotheses/files_touched must remain byte-identical; only path strings inside script/prose bodies change. Re-run plan-schema validate.cjs after editing it.

## Verify: git grep count for the username over tracked non-jsonl non-memory files -> 0; runbook-contract suite green incl. new privacy scan; validate.cjs on the locked plan -> VALID.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS

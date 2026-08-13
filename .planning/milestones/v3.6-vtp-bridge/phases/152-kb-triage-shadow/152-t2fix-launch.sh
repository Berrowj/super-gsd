#!/usr/bin/env bash
cd "/c/Users/operator/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer" || exit 9
exec bash super-gsd/scripts/codex-executor.sh   --prompt-file ".planning/milestones/v3.6-vtp-bridge/phases/152-kb-triage-shadow/152-T2FIX-PROMPT.md"   --report-out ".planning/milestones/v3.6-vtp-bridge/phases/152-kb-triage-shadow/152-T2FIX-REPORT.md"   --workspace "$(pwd)"   --timeout 1500   --phase 152   --plan 152-t2fix   > ".planning/milestones/v3.6-vtp-bridge/phases/152-kb-triage-shadow/152-t2fix-detached.log" 2>&1

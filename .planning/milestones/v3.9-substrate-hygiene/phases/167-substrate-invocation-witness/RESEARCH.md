Q1_PRETOOLUSE_DENY: YES ,  return `hookSpecificOutput.permissionDecision: "deny"` or exit 2; denial occurs before execution and survives bypass-permissions mode. The repository has no Claude `PreToolUse` deny yet; its existing blocker demonstrates exit-2 denial at [block-secret-leak.cjs:90](C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/codex-hooks/block-secret-leak.cjs:90).

Q1_INPUT_FIDELITY: full ,  raw stdin is parsed and `payload.tool_input` retained at [sgsd-activity-logger.js:117](C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/hooks/sgsd-activity-logger.js:117). Only the persisted preview is truncated at [line 160](C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/hooks/sgsd-activity-logger.js:160) and [line 172](C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/hooks/sgsd-activity-logger.js:172).

Q2_POSTTOOLUSE_REWRITE: YES ,  `updatedToolOutput`/`updatedMCPToolOutput` replaces the result before Claude receives it. Installed Claude Code is 2.1.240; MCP replacement predates the all-tool expansion in 2.1.121. [Official hook contract](https://code.claude.com/docs/en/hooks), [official changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md).

Q3_CORRELATION_KEYS: `session_id` + payload SHA-256 are available without agent-reported IDs. Hooks receive `session_id`/`tool_use_id`; Bash acceptance inherits matching `CLAUDE_CODE_SESSION_ID` since 2.1.132; the hook can compute the actual-input digest using [substratePayloadDigest:375](C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/vtp-context-composer.cjs:375). `tool_use_id` is hook-only and should identify an internally consumed witness row. Asking the agent to report it would remain self-report. Current acceptance has no witness lookup/consumption.

Q4_TAMPER_EVIDENCE: P147 validates activation-record shape plus an unkeyed SHA-256 and detects casual edits, but explicitly says “not tamper-proof” at [sgsd-commit-gate.cjs:416](C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/hooks/sgsd-commit-gate.cjs:416). It does not protect hook presence: the Git hook remains bypassable, while Claude project/user hooks can be deleted or disabled. It does not transfer.

Q5_PROPAGATION: does not ,  `audit.cjs` copies/patches agents at [lines 356–430](C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/feature-propagation/audit.cjs:356), but only inspects Codex hooks at [line 706](C:/Users/<operator>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/feature-propagation/audit.cjs:706) and does not propagate Claude registration. Missing hooks are non-blocking, so a fresh machine fails open.

BLOCKING_UNKNOWNS: none before planning; a real MCP denial-and-rewrite run remains mandatory completion evidence.

RECOMMENDED_SCOPE: P167 can close actual-call validation/witnessing and pre-model response capping where the hook is active. It cannot claim all four surfaces closed unless hook/script propagation, fail-closed absence detection or managed-policy authority, witness-ledger protection, and real-runtime proof are included.

No file writes were performed.


<!-- P167 research, Codex read-only at f914ff8. The codex-exec wrapper
     reported a contract violation and dumped ~1 MB of combined output;
     this is the codex stdout section extracted verbatim. -->

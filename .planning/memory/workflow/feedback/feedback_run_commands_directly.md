---
name: Run PowerShell/shell commands directly, not via paste-blocks
description: Default to executing commands via powershell.exe -Command through the Bash tool; only hand paste-blocks for destructive / interactive-TTY / UAC / first-time-auth operations
type: feedback
originSessionId: 383f3687-d752-4f3b-8935-5c48d88dd028
---
Run PowerShell and shell commands directly via `powershell.exe -NoProfile -Command "..."` (or plain bash) through the Bash tool. Do NOT default to giving the operator paste-blocks to run in their own terminal.

**Why:** Operator (Jack, 2026-04-20) called out that the middleman copy-paste pattern — Claude gives a command, operator pastes into PowerShell, pastes output back — is annoying and unnecessary. Claude Code's Bash tool can invoke `powershell.exe -Command "..."` directly; results come back in the tool result. This was a pattern choice, not a platform limitation.

**How to apply:** Default to direct execution. Hand paste-blocks to the operator ONLY when:
1. The operation is destructive and operator should sanity-check first (`rm -rf`, `git reset --hard`, `git push --force`, anything that could expose credentials).
2. Interactive TTY prompts are required that Claude can't satisfy (scripts reading stdin line-by-line, `git rebase -i`, `npm login` prompts).
3. UAC / admin-elevation dialog needs a human click.
4. First-time auth flows (`gcloud auth login`, `gh auth login`, SSH key passphrase generation).

Operator cue if Claude forgets: saying "just run it" after seeing a paste-block means take over execution. Operator may also pre-set it at session start ("run everything directly unless it's destructive").

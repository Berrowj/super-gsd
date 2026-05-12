# 98-06 Fresh Clone Onboarding Plan

Goal: make a GitHub clone usable by a new SGSD operator without relying on Jack's local VTP, paths, or prior shell setup.

Scope:

- Update friend-facing README/setup docs so the current runtime contract is explicit: Claude/Opus orchestrates, Codex GPT-5.5/xhigh handles research, planning, plan-check, verification, code execution, and Codex-owned gates; Sonnet is not a fresh-clone default provider or fallback.
- Keep VTP/private KB optional and document the no-private-KB path as normal.
- Make setup guidance ask/check for Claude Code and Codex CLI readiness without storing API keys or credentials.
- Replace hard-coded Jack paths in generic MCP onboarding templates with project-dir placeholders.
- Fix any stale self-test expectation that would fail for a fresh clone.

Tasks:

1. Update top-level `README.md` quick start and model-routing language for the current Codex-locked executor contract.
2. Update `super-gsd/docs/SGSD-FRIEND-SETUP-WIZARD.md` so a friend gets exact clone, install, provider, VTP-optional, MCP, and smoke-test steps.
3. Update `super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md` and `super-gsd/docs/SGSD-WARP-MCP-SETUP.md` for friend-safe setup wording and current probe/tool counts.
4. Update `super-gsd/templates/onboard/mcp.json.template` to use `{{PROJECT_DIR_FORWARD_SLASH}}` rather than Jack's absolute checkout path.
5. Add non-mutating provider readiness output to `super-gsd/scripts/sgsd-configure.ps1` so `sgsd-setup` surfaces Claude/Codex status and next commands.
6. Run fresh-clone and local smoke checks: wizard self-test, cockpit-state self-test, warp-mcp self-test, provider-health self-test, and PowerShell parse/check commands.

Non-goals:

- Do not change orchestration policy beyond documenting the current contract.
- Do not store Claude, Codex, Anthropic, or OpenAI credentials.
- Do not make VTP required.

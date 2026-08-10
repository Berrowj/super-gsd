---
title: harness production seam four layers
tags: [mcp, staged-protocol, verification]
importance: 70
maturity: raw
created: 2026-08-08T01:04:42Z
---

The same defect class surfaced FOUR times in v3.5/P148, one layer deeper each
time: (1) module-level VTP hook worked but CLI never passed it; (2) CLI worked
but MCP tools are session-only, so a spawned node process can never call them;
(3) staged CLI protocol built but SKILL.md production prose never invoked it;
(4) SKILL.md Step 0 staged VTP correctly but Step 3 re-entered the non-staged
runtime path and clobbered the staged evidence (no_mcp_invoke overwrite).

**Why:** each fix verified the layer it touched and assumed the caller above
was already correct. Harness tests (mcpInvoke injection) satisfy ACs without
proving production.

**How to apply:** before ANY fix touching a Claude-session capability (MCP
tools, Task tools, session state), write down the full production invocation
chain — skill prose step N → runtime CLI stage → helper lib → MCP seam — and
verify EVERY hop consumes the previous hop's artifact. A green harness suite
plus an unchanged production caller is the signature of this bug, and a
reviewer must be explicitly asked "does the NEXT step re-enter the old path?"

**Instance 5 (P149, same day):** consult hook probes passed with explicit
--files-changed/--diff-lines flags, but the SKILL.md production command
supplied none of them — inputs defaulted to zero and the gated route could
never fire live. Refinement of the rule: it is not enough to verify the next
hop consumes the artifact; verify the production caller SUPPLIES every input
the mechanism needs, or make the mechanism derive its inputs from evidence
(git, index) when the caller omits them. Derive-don't-default is the fix
shape.

**Instance 6 (P150 T150-06 trust probe):** the forbidden-write guard fired
correctly, but the ceremony's probe read the PROJECT ledger
(~/GSDedits/.planning/metrics/) while the GLOBALLY-installed hook resolves its
metricsPath via path.resolve(__dirname,'../../..') = the global install root.
Block event landed in the global ledger; probe saw "no appended bytes" despite
correct behaviour. Sixth instance of the same class: an install-vs-project path
resolution assumption in the verification, not the mechanism. Verify where the
production component ACTUALLY writes before asserting on a fixed path.

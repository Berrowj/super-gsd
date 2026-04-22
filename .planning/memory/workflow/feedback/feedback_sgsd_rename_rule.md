---
name: sgsd-* prefix means "actively upgraded" — don't rename gsd-* unless upgraded or genuinely new
description: Only use the sgsd-* prefix when (a) we've actively enriched an existing gsd-* agent with the v2 handover contract, expertise file, and research-paper principles, OR (b) we've created an entirely new agent. Never blanket-rename.
type: feedback
originSessionId: 383f3687-d752-4f3b-8935-5c48d88dd028
---
Do NOT rename `gsd-*` agents to `sgsd-*` as a bulk migration step. Only switch the prefix when one of these conditions is true:

1. **Active upgrade:** the agent has been enriched with — at minimum — the v2 handover contract (`super-gsd/registry/handover-contract-v2.yaml`), a dedicated expertise file at `super-gsd/expertise/{name}.md`, and explicit research-principle citations in its frontmatter. The upgrade itself is what earns the new prefix.
2. **Genuinely new agent:** we've created it from scratch (e.g. the 8 `sgsd-exec-*` specialists — backend, ui, test, refactor, fix, config, docs, integration — which didn't exist before). New-from-scratch inherits the `sgsd-` prefix naturally.

**Why:** Operator (Jack, 2026-04-21) explicitly corrected a mid-migration bulk-fork attempt: "I do not want you to change the names of GSD to SGSD unless we have actively upgraded it either with research paper enrichment or creating an entire new agent." The prefix is a meaningful signal — bulk-renaming makes it meaningless. It should track actual SGSD-v2 contract compliance, not aspirational target state.

**How to apply:**
- Migration manifest's "rename table" represents the *eventual target state* once each agent is upgraded. It is NOT a Phase B mass-rename list.
- Phase B as originally drafted (blanket `cp + sed` rename of 6+ inherited agents) is dropped.
- Per-agent renames happen inside Phase G — as part of that agent's upgrade commit. One commit per agent: upgrade + rename together.
- Phase H retires the `gsd-*` originals only after their `sgsd-*` replacement is proven in production.
- New-from-scratch agents (sgsd-exec-* specialists, any custom board roles from R-Q7d) are safe to create with `sgsd-` prefix immediately — they qualify under rule (2).
- Agents we never upgrade (e.g. GSD-1-exclusive agents that SGSD doesn't call) stay `gsd-*` indefinitely. No rename just for consistency.

**Edge cases:**
- Existing `sgsd-*` agents (board members, classifier, context-selector, phase/milestone-readiness, workflow-auditor) keep their names — they were created as SGSD-native.
- If an `sgsd-*` agent is later identified as NOT meeting the v2 contract, flag it for upgrade, don't un-prefix. The prefix was correctly applied at creation; the contract drift is the bug.

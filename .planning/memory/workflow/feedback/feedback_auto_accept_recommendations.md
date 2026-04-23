---
name: Auto-accept Claude's recommendations in sequential Q&A unless scope-altering
description: When operator says "accept your recommendations unless super altering scope", rip through discuss-phase / deliberation question chains picking the recommended option without check-in, EXCEPT when a choice materially changes what the phase delivers.
type: feedback
originSessionId: 3c216c4a-6bf4-442c-9d85-ea9a3f851aae
---
When operator says something like "just auto accept all your recommendations unless they're super altering the path of what we have scoped already" (or equivalent), treat subsequent questions in a sequential Q&A flow (discuss-phase, deliberation, audit walkthroughs) as auto-accepted at the recommended option with a single-line "D-QX: {decision}. Reason: {one-liner}." record — no AskUserQuestion cycle.

**Why:** Operator wants velocity through low-stakes implementation decisions. Most discuss-phase questions are tradeoffs where Claude has the research done and the operator would just say "your call" — the check-in friction is pure waste. But some decisions DO materially change what ships, and those must still surface.

**How to apply:**

Ripping through = acceptable for:
- Pattern/implementation choices (composer shape, artifact structure, flag semantics)
- Policy choices with clear best-practice (kill-switch design, caching strategy)
- Sequencing / ordering (which question first)

Check-in REQUIRED when the choice materially alters:
- What the phase DELIVERS (new artifact surface, new skill, new binary, new dependency)
- Blast radius (touches N more phases than previously scoped)
- Architecture direction (pull-based vs push-based, in-process vs out-of-process, sync vs async)
- Scope boundary of not-in-scope list (adding a NEW capability vs refining an in-scope capability)

Heuristic: "Does this change WHAT ships, or HOW it's built?" HOW = accept. WHAT = check in.

When in doubt: check in with a short "this is scope-altering because X — still take recommended?"

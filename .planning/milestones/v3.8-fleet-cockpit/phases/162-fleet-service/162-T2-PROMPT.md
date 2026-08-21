# P162-T2 — status derivation with contractual noise filters (edits-first)

You are the implementer for ONE task. Fresh context. No spawns; do NOT stop on
spawnSync EPERM; static verification + in-process case runs only. Do NOT commit.

Task P162-T2 in `162-01-PLAN-LOCKED.md` (same dir, revision 2) is your VERBATIM
contract. Design source: HANDOVER section 7 (in-repo at
.planning/milestones/v3.8-fleet-cockpit/HANDOVER.md) — this derivation is "the
only real design work" and the filters are the product.

status.cjs: four states, first-match precedence attention > running > stale >
idle, exactly the rules/fields in section 7; `reasons` are machine codes only.

CONTRACTUAL fixtures (each a named self-test case):
1. noise-agent-tools: roster entries like Bash/SendUserFile (no model, not a
   recognised agent name) never appear as agents.
2. noise-tokens-absent: tokens.source==="absent" derives no-data, NEVER zero.
3. empty gates + live_event_count 0 => "no gate data", never "all passed".
4. artifacts.source==="phases_dir_missing" => reason surfaced, not empty list.
5. conflict: projection_stale===true => conflict:true and BOTH milestone values
   + effective_confidence exposed for the detail view; never silently resolved
   (use the real live shape from HANDOVER section 7's JSON).
Plus one precedence case proving first-match ordering across all four states.

Report: FILES_CHANGED / VERIFICATION (each case run in-process, named) /
DEVIATIONS / BLOCKERS / ONE_LINER, max 180 words.

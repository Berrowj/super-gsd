# P159-T4 — VTP MCP tool-family triage (edits-first; orchestrator owns spawns)

You are the implementer for ONE task. Fresh context. The sandbox denies nested
Node spawns — do NOT run suites and do NOT stop on spawnSync EPERM; write the
edits, verify statically (node --check, YAML parse, in-process loads), report.
Do NOT commit.

Task P159-T4 in `159-01-PLAN-LOCKED.md` (same dir, revision 2) is your VERBATIM
contract. T1 (availability guard) and T2 (skill-family rows) are COMMITTED;
build on both without regressing their cases.

Operator-locked essentials (CONTEXT T4):
- Hooks NEVER call MCP: shadow-tier SUGGESTIONS mapping KB-shaped intents to the
  right VTP surface; the model invokes, never the hook.
- Encode the RECORDED layer-routing rule verbatim, never a rediscovered variant:
  book/paper/transcript content -> vtp_search_substrate; people/projects/ideas/
  analyses -> wiki_search family; end-to-end intent retrieval ->
  vtp_route_and_retrieve; meeting export -> /vtp-implementation-pack; triage
  verdicts -> vtp_triage advisory.
- MCP availability = server REGISTERED (cheap config read of the known
  registration surfaces; super-gsd/registry/vtp-services.yaml names the servers),
  NEVER liveness/network. Unregistered => silent + text-free row.
- Shadow-tier for tool-level routes; suggestion-tier ONLY for the skill-level
  ones that already exist as suggestions (/vtp-implementation-pack,
  /sgsd-vtp-advise).
- Every fired route ALSO records a demand row per the sgsd-triage-first contract
  (demand-baseline-ledger.cjs), text-free.

Tests: extend assert-skill-routing-expansion.cjs with BOTH recorded cases:
--case vtp-tool-family-registered and --case vtp-tool-family-unavailable-origin-gate,
each with internal rows-absent red fixtures, layer-mapping assertions for all five
route families, registration-vs-liveness proof (no net imports), demand-row
presence, and P158 origin-gate interaction (automated turns never fire these).

Report: FILES_CHANGED / VERIFICATION (static, name each check) / DEVIATIONS /
BLOCKERS / ONE_LINER, max 200 words.

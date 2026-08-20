# P159 planning task — author 159-01-PLAN-LOCKED.md

You are the planner. You WRITE the plan file and VALIDATE it yourself. No source
changes. You CANNOT spawn `claude` (EPERM); node works.

## Read first

1. `.planning/milestones/v3.6-vtp-bridge/phases/159-skill-routing-expansion/CONTEXT.md`
   — OPERATOR-LOCKED scope: T1 availability guard, T2 ERP/VTP skill-family
   shadow/suggestion rows, T3 description standard + lint, T4 VTP MCP tool-family
   triage. Locked constraints: NO cosine/embeddings (Phase 47/48 lock), shadow-first
   (DLB-02), availability-guarded rows, hooks suggest-never-invoke.
2. `super-gsd/hooks/sgsd-intent-classifier.cjs` — the router T1/T2/T4 extend
   (now carries the P158 automated-turn origin gate; do not regress it).
3. `super-gsd/registry/skill-routing.yaml` + `session-governance-hooks.yaml` if
   present — row shapes, tiering (strong-positive-beats-verb from kb-lookup-triage).
4. `super-gsd/registry/vtp-services.yaml` (P157) — server registration facts T4's
   availability guard reads (registration-not-liveness).
5. `super-gsd/templates/plan-schema-v2.json`; P156-P158 plans as house style.

## Plan shape guidance

Four tasks mapping T1-T4, each independently revertable; T2 and T4 depend on T1
(guard first). Key contract points the SACs must carry:
- T1: suggestion/directive emission verifies the skill resolves locally
  (~/.claude/skills, ~/.claude/commands, project .claude); unavailable => silent +
  text-free skill_unavailable ledger row. Falsifier both ways.
- T2: anchored-lexical rows for /create-quote, /erp-resolve, /clarity-engines,
  /vtp-implementation-pack, /jcl-procurement-report, explainer-vs-diagram boundary;
  suggestion-tier low-risk, shadow-tier where wrong fires mislead.
- T3: description standard doc + lint flagging description-less/one-noun skills;
  applies to super-gsd skills directly.
- T4: lexical mapping of KB-shaped intents to VTP surfaces encoding the RECORDED
  layer-routing rule verbatim (book/paper/transcript -> vtp_search_substrate;
  people/projects/ideas/analyses -> wiki_search family; end-to-end -> 
  vtp_route_and_retrieve; meeting export -> /vtp-implementation-pack; triage
  verdicts -> vtp_triage advisory). Shadow-tier for tool-level routes; MCP
  availability = server REGISTERED in config (cheap read), never liveness/network.
  Every fired route also records a demand row (sgsd-triage-first contract).
- All rows text-free in ledgers; classifier + KB-shadow + P158 origin-gate
  self-tests green in verification_cmd.

## Validate before you finish

    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.6-vtp-bridge/phases/159-skill-routing-expansion/159-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.

# P149-T3 — Wire P146 classifier to the skill-routing loader

<intent milestone="v3.5">SGSD governance must be a runtime mechanism, not prose.</intent>

Fresh SDD implementer (Codex gpt-5.6-sol/xhigh). ONE task: adapt the P146 intent classifier to consume prompt-time routes from super-gsd/scripts/lib/skill-routing-registry.cjs (toPromptGovernanceRoutes adapter), replacing the embedded suggestion lexicon in session-governance-hooks.yaml as the single source. SURGICAL CONSTRAINT applies.

## Task contract (from locked plan)
  - id: "P149-T3"
    type: "classifier-adapter"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/hooks/sgsd-intent-classifier.cjs"
      - "super-gsd/hooks/sgsd-quality-gate.js"
      - "super-gsd/registry/session-governance-hooks.yaml"
    input_contract: >
      Wire P146 manual-session routing to the loader adapter and reduce `session-governance-hooks.yaml` to compatibility metadata or pointer text as needed.
    output_contract: >
      Manual classifier prompts consume prompt-time rows from `skill-routing.yaml` through the loader adapter and produce visible suggestions without a second maintained lexicon.
    hypothesis: "P146 manual-session suggestions can consume prompt-time rows from skill-routing.yaml through the loader adapter without preserving a second maintained lexicon."
    falsifier: >
      Manual prompt probes fail to produce visible suggestions for the named skills, or normal runtime still depends on `session-governance-hooks.yaml` as the maintained lexicon.
    stop_rule: >
      Stop after the three manual prompt verification commands produce visible suggestions from `skill-routing.yaml` and malformed-table fallback still preserves the token-audit route.
    verification:
      commands:
        - >-
          node super-gsd/hooks/sgsd-intent-classifier.cjs --mode manual --prompt "please run a token waste audit before this closes"
        - >-
          node super-gsd/hooks/sgsd-intent-classifier.cjs --mode manual --prompt "this looks like MUDA and needs a waste audit"
        - >-
          node super-gsd/hooks/sgsd-intent-classifier.cjs --mode manual --prompt "use VTP advice for this architecture proposal"

## Task-specific prompt from plan
### P149-T3

Wire P146 manual-session routing to the loader adapter. Remove normal runtime dependence on `session-governance-hooks.yaml`; keep that file only as deprecated compatibility metadata or pointer text if needed. Verify real prompts produce visible suggestions from `skill-routing.yaml`.

### P149-T4

## Constraints
- Loader is the source; classifier must fall back to its existing behavior (with a gate-evidence degradation row) if the loader/table is malformed — never brick prompt classification (hooks must exit 0 on unexpected errors).
- Keep session-governance-hooks.yaml enforcement/quality routes intact — only the neglected-skill SUGGESTION lexicon moves to the table.
- Preserve P146 classifier self-test green; extend it to cover table-sourced suggestions.

## Verify before reporting: run the classifier self-test + skill-routing-registry --self-test.

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS

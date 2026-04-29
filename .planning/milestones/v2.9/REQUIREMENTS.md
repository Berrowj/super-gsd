# Milestone v2.9 Requirements - Agentic Harness Evolution

Source: VTP-enriched paper `agentic-harness-engineering-observability-driven-automatic-evolution-of-coding-a`
Status: draft, inactive

## Requirement Groups

### AHE-COMP - Component Observability

- **AHE-COMP-01**: SGSD must maintain a harness component registry that names every editable harness surface with path, type, owner, read/write policy, test command, and rollback method.
- **AHE-COMP-02**: The registry must separate component classes: prompt, tool, middleware/hook, skill, agent config, memory, workflow, MCP bridge, gate, dashboard, and docs.
- **AHE-COMP-03**: Each harness edit must touch one primary component class unless the plan explicitly declares a cross-component reason.
- **AHE-COMP-04**: LLM config, hidden benchmark oracle, verifier implementation, and scoring policy are protected surfaces and cannot be changed by the evolution loop.

### AHE-EXP - Experience Observability

- **AHE-EXP-01**: SGSD must produce a layered run evidence corpus for harness evolution runs.
- **AHE-EXP-02**: The corpus must include one overview, per-scenario/per-task reports, raw trace pointers, cleaned trace excerpts, and failure/success root-cause labels.
- **AHE-EXP-03**: Evidence must be drill-down, not one giant prompt. Claude should read the overview first, then open only the relevant task reports.
- **AHE-EXP-04**: Existing logs must be reused where possible: activity-log, orchestrator-pulse, context-packet-log, route-decisions, token-attribution, failure-injection-log, controlled-actions-log, and blind live run reports.

### AHE-DEC - Decision Observability

- **AHE-DEC-01**: Every proposed harness edit must write a change manifest entry before the edit is evaluated.
- **AHE-DEC-02**: The manifest entry must name: evidence IDs, inferred root cause, target component, files changed, predicted fixes, predicted regressions, expected token effect, expected gate effect, and rollback command.
- **AHE-DEC-03**: The next evaluation run must attribute observed deltas back to the prior manifest.
- **AHE-DEC-04**: Fix precision/recall and regression precision/recall must be reported separately.

### AHE-EVAL - Evaluation And Transfer

- **AHE-EVAL-01**: Deterministic benchmark runs must stay green before live evolution is attempted.
- **AHE-EVAL-02**: Live benchmark decks and scoring oracles must remain outside the model-visible workspace.
- **AHE-EVAL-03**: Candidate harness changes must be evaluated against at least one held-out task deck before release.
- **AHE-EVAL-04**: Transfer evaluation must include both success rate and token cost.
- **AHE-EVAL-05**: If full live evaluation is unavailable, the milestone must close as `SHIPPED-WITH-UNPROVEN-HARNESS-EVOLUTION`, not clean.

### AHE-GOV - Governance And Rollback

- **AHE-GOV-01**: A harness edit with unmeasured predictions cannot be promoted from candidate to active.
- **AHE-GOV-02**: A harness edit that misses its predicted fixes and introduces regressions must be reverted or explicitly quarantined.
- **AHE-GOV-03**: Repeated failure in the same component class must force a pivot to another component class rather than another same-layer tweak.
- **AHE-GOV-04**: The milestone close gate must block clean ship if open candidate edits have no attribution verdict.

## Evidence Anchors

- AHE-P-01: Make action surfaces explicit and reversible.
- AHE-P-02: Distill experience before asking for change.
- AHE-P-03: Turn edits into falsifiable contracts.
- AHE-P-04: Optimize the harness, not just the prompt.
- AHE-P-07: Use transfer as the overfit test.
- AHE-P-08: Locate gains by swapping components independently.
- AHE-P-09: Expect non-additive component interference.
- AHE-P-10: Treat regression prediction as first-class.

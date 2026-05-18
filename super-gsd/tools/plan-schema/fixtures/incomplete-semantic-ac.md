---
schema_version: 2
tasks:
  - id: t1
    agent: gsd-executor
    model: codex
    files_touched: [tmp.txt]
    input_contract: nothing
    output_contract: nothing
    hypothesis: nothing
    falsifier: nothing
    stop_rule: nothing
semantic_acceptance_criteria:
  - input: example input
    expected_outcome: example outcome
---

# Fixture

# Context-Bench Scenario Fixture Schema

> Phase 51-01-T1: human-readable spec for the JSON files that T3 will land in
> this directory (S1..S6). The machine-readable contract lives in
> `../SCENARIO.schema.json` (JSON-Schema draft-07, `additionalProperties:false`,
> closed enums on `expected_evidence[].kind` and
> `expected_evidence[].must_appear_in`).

ASCII-only. No smart quotes, no emoji. PowerShell 5.1 cockpit cross-rendering
breaks on non-ASCII input. The same rule applies to every fixture file.

## Top-Level Shape

Each scenario is a single JSON object with these top-level keys (and only
these). Extra keys are a schema violation and will cause T3 self-tests to
fail.

| key                 | type     | required | description                                                                |
| ------------------- | -------- | -------- | -------------------------------------------------------------------------- |
| schema_version      | integer  | yes      | Always `1` for this Phase 51 release.                                      |
| scenario_id         | string   | yes      | Matches the filename stem, e.g. `S2-v18-P36`.                              |
| drawn_from          | object   | yes      | The real phase the scenario reproduces. See below.                         |
| intent              | object   | yes      | The agent goal, files touched, capsule deps.                               |
| baseline_signature  | object   | yes      | Token-spend ledger anchor. Read-only by reference.                         |
| expected_evidence   | array    | yes      | Closed-vocab evidence the post-replay artifacts must contain.              |
| anti_cheat_signal   | object   | yes      | Strings/roles that MUST NOT appear in the produced packet.                 |
| expected_route      | object   | yes      | Dispatch-router uncertainty + provider chain the run should select.        |

## drawn_from

```jsonc
{
  "milestone":  "v1.8",            // string, e.g. v1.5..v1.9
  "phase":      36,                // integer phase number
  "phase_name": "context-packet",  // string, slug from the phase folder
  "role":       "researcher",      // one of token-attribution ROLES enum
  "agent_type": "gsd-phase-researcher" // dispatch agent slug
}
```

`role` MUST be one of the 8 frozen ROLES from
`super-gsd/tools/token-attribution/report.cjs` (researcher, planner, executor,
verifier, reviewer, orchestrator, classifier, other).

## intent

```jsonc
{
  "goal": "string - one-sentence description of what the agent was asked to do",
  "files_touched": [
    "relative/path/one",
    "relative/path/two"
  ],
  "depends_on_phase_capsules": [
    "v1.8/P34",
    "v1.8/P35"
  ]
}
```

`files_touched` MUST contain at least 2 paths drawn from the real phase folder.
`depends_on_phase_capsules` may be empty for greenfield scenarios.

## baseline_signature

```jsonc
{
  "actual_tokens_total":      150123,        // integer; from agent-token-spend.jsonl
  "actual_cache_read_tokens": 90000,         // integer; from same row
  "source_event_id":          "evt_abc123"   // MUST resolve to a row in the ledger
}
```

T2 reads the ledger via `tokenAttribution.summarize()` (Phase 41). The bench
NEVER re-aggregates these numbers - it consumes the canonical aggregator by
reference (Lock 4).

## expected_evidence (closed-vocab)

An array of >=3 items. Each item:

```jsonc
{
  "kind":          "capsule_decision",      // closed enum (see below)
  "ref":           "v1.8/P34/capsule#3",     // string - any stable ref
  "must_appear_in": "packet_body"           // closed enum (see below)
}
```

### closed enum: `kind`

| value                 | meaning                                                    |
| --------------------- | ---------------------------------------------------------- |
| capsule_decision      | A decision recorded in a phase capsule.                    |
| bypass_ref            | A bypass / waiver ref recorded by the verifier or planner. |
| atc_finding           | A row from the review ledger / ATC log.                    |
| verifier_verdict      | A verifier verdict (pass/fail/partial).                    |
| validated_thought     | A validated-thought ref (memory-governance).               |
| downstream_constraint | A constraint a later phase placed on this surface.         |

### closed enum: `must_appear_in`

| value                          | meaning                                            |
| ------------------------------ | -------------------------------------------------- |
| packet_body                    | Verbatim string in the produced context packet.    |
| route_decision                 | Cited in the dispatch-router decision record.      |
| context_complaint              | Surfaced by the orchestrator's complaint channel.  |
| context_complaint_or_packet    | Either of the above is acceptable.                 |

These two enums are LOCKED at the schema level. Any drift forces a Phase 51
research re-open.

## anti_cheat_signal

Mirrors the harness-benchmark anti-cheat list (see
`super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs` lines
42-86, 104-138). The bench fails closed if any of these strings appears in
the produced packet OR if `role` is set to one of the listed values.

```jsonc
{
  "must_not_contain_in_packet": [
    "benchmark",
    "this is a test",
    "expected_failure",
    "score_weight"
  ],
  "must_not_set_role_to": [
    "benchmark_researcher",
    "test_runner"
  ]
}
```

## expected_route

```jsonc
{
  "uncertainty_type": "synthesis_judgment",   // one of dispatch-router enum
  "primary":          "claude",                // claude | codex | vtp_bridge
  "fallback_chain":   ["codex", "vtp_bridge"]
}
```

`uncertainty_type` MUST be one of the 6 frozen UNCERTAINTY_TYPES from
`super-gsd/tools/dispatch-router/route.cjs`:

- deterministic_extraction
- bounded_code_review
- synthesis_judgment
- architecture_challenge
- prior_memory_lookup
- book_lookup

Per phase plan: S1-S4 have `primary: "claude"`, S5 has `primary: "codex"`,
S6 has `primary: "vtp_bridge"`. The fallback chain is the deterministic
ordering the dispatch-router enforces.

## Round-Trip Self-Test

T1 self-test 5 (added by T3 once fixtures land) round-trips a sample
fixture through `SCENARIO.schema.json` to catch:

- additionalProperties drift
- closed-enum violations on `kind` / `must_appear_in`
- missing required fields

The skeleton (T1) ships an empty `SCENARIOS = Object.freeze([])` so the
harness self-test does not require a real fixture yet.

## Lock Reminders

- **Lock 4**: never copy bodies from
  `super-gsd/tools/{token-attribution,dispatch-router,context-packet}` into
  this tree. Import by absolute path only.
- **Lock 11**: every match against `expected_evidence` and
  `expected_route` is set-membership or byte-equality. No fuzzy match, no
  embeddings, no cosine.
- **Lock 13**: the harness public APIs return degraded sentinels on error.
  Schema violations log under `BENCH_REASON_CODES.scenario_skipped_schema_mismatch`
  rather than throwing.
- **ASCII-only** in every fixture. No smart quotes.

# P153-T1c — Explicit no-match row + align probe to the real ledger

You are the implementer for ONE narrow task. Do NOT start T2.

## Environment constraint — read this first

**You CANNOT spawn `claude` from your sandbox.** A previous dispatch confirmed
`spawn EPERM`, even for `claude.exe --version`. Do NOT attempt it, and do NOT treat that
as a blocker again — the orchestrator runs the live probes outside your sandbox and has
already verified they dispatch correctly.

Your job is the code the probes need. Do not try to run `--probe` or `--control` modes.
Verify only with `node --check` and any assertion that needs no process spawning.

## Diagnosis already done for you (measured, do not re-derive)

The orchestrator ran the probes and traced the failures to source:

1. **The classifier already writes routing-decision rows** via `appendRoutingDecision()` to
   `.planning/metrics/gate-evidence.jsonl` with `signal: "intent_routing_decision"`,
   carrying `route_ids`, `directives`, `suggestions`, `hook_event_name`, `session_id`,
   `phase`, `milestone`. Real rows from genuine dispatches exist there now.

2. **`super-gsd/hooks/sgsd-intent-classifier.cjs:557`**:
   ```js
   if (!Array.isArray(routes) || routes.length === 0) return;
   ```
   This early return is exactly why no no-match row is ever written. Absence of a row is
   currently indistinguishable from the hook never running — the defect this phase exists
   to kill.

3. **The probe expects a field the classifier never emits.** `--probe planning` fails with
   `matched probe requires an explicit matched decision: actual undefined, expected 'matched'`.

## Deliverables — exactly two files

**1. `super-gsd/hooks/sgsd-intent-classifier.cjs`**

- Remove the `routes.length === 0` early return in `appendRoutingDecision` so a row is
  ALWAYS appended when the hook runs, and add an explicit decision field to the row:
  `decision: "matched"` when one or more routes matched, `decision: "no_match"` when none did.
- The no-match row must carry the same correlation fields as a matched row
  (`hook_event_name`, `session_id`, `phase`, `milestone`, `duration_ms`) with empty
  `route_ids`, `directives` and `suggestions`.
- A no-match row must inject NOTHING into the prompt. Writing the row must not change what
  the hook prints on stdout — hook stdout is injected into the model's prompt context.
- Keep the failure-path behaviour (`appendFailureRow`) intact.
- Surgical: do not restructure the classifier, do not rename existing fields, do not change
  matching logic or predicates.
- Do NOT change the P152 `kb-lookup-triage` route's enforcement kind — it stays `shadow`,
  and its text-free ledger contract is unchanged.

**2. `super-gsd/tests/hook-transport/assert-live-dispatch.cjs`**

Align it to the REAL ledger and row shape above:
- read `.planning/metrics/gate-evidence.jsonl`, filtering `signal === "intent_routing_decision"`
- correlate on `session_id`
- `--probe planning` expects `decision === "matched"` with a non-empty `route_ids`
- `--probe no-match` expects `decision === "no_match"`; an ABSENT row is a FAILURE
- `--probe p149-skill-routing` expects a matched row whose route originates from the P149
  skill-routing registry, not the P146 compatibility `planning-triage` route
- `--probe p152-shadow` expects a text-free shadow row and NOTHING injected
- keep the isolation precondition (exactly one registered UserPromptSubmit hook, and
  `--setting-sources project` on every launch), the byte-offset snapshot, the
  `crypto.randomUUID` nonce, and the two `--control` modes

Keep the structural-attribution design already in the file. Do not add command-naming
assertions — stream-json hook events do NOT carry the hook command (measured).

## Hard constraints

- **NEVER** read, print, echo or log any settings `env` block — live API keys.
- Do NOT modify the global `~/.claude/settings.json`, the repo-local `.claude/settings.json`,
  `claude-ups-overlay.json`, `hooks.yaml`, or `assert-registration.cjs`.
- Do NOT attempt to spawn `claude`.
- Node `.cjs` only. No Python, no `uv`, no new dependencies.
- Do NOT create stray files in the repo root.

## Stop rule

Stop when both files are updated and `node --check` passes on each. The orchestrator will
run the live probes and report results back.

## Report format — exactly this, max 250 words, no preamble

```
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [constraint] description | none
BLOCKERS: description | none
ONE_LINER: substantive summary
```

Do not claim a probe passes — you cannot run them. Report only what you actually verified.

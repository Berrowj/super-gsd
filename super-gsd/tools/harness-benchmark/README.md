# SGSD Harness Benchmark

This tool is the first layer of SGSD hardening: a deterministic stress runner
for gates, workflow contracts, and failure injection.

It does not call Claude, Codex, or any other model. That is intentional. The
first benchmark layer should prove the machinery before spending model tokens.

## Run

```bash
node super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs
node super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs --profile standard
node super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs --profile hour --duration-min 60
```

By default reports are written under the OS temp directory. Use `--output-dir`
when you want to preserve a run as project evidence:

```bash
node super-gsd/tools/harness-benchmark/sgsd-harness-benchmark.mjs --output-dir .planning/benchmarks/sgsd-smoke
```

Each run writes:

- `RUN.json`: machine-readable case results, scores, gate coverage, prune signals.
- `REPORT.md`: human-readable summary.

## What It Tests

- `registry/gates.yaml` exists, has unique gate names, and references scripts
  that exist.
- Gate predicates fire or suppress under known dispatch contexts.
- Predicate failure injection rejects unknown fields, unknown operators, and
  malformed `any` clauses.
- `edge-guard.cjs` records pass, soft-missing-evidence, and hard-halt evidence
  rows with the required JSONL shape.
- `tools/plan-schema/validate.cjs` accepts a valid v2 plan and rejects a plan
  with missing required task fields.
- `tools/provider-contract/contract-check.mjs` accepts valid reviewer contract
  fixtures and rejects a malformed report.

## Anti-Cheat Boundary For Live Benchmarks

The deterministic runner can live in this repo because no model sees a prompt or
chooses behavior. A live build benchmark is different: SGSD, Claude, and Codex
must not know they are being benchmarked or have access to the answer key.

For live benchmarking, use this boundary:

1. The controller lives outside the target workspace.
2. Hidden scenario decks, expected outcomes, and scoring oracles live outside the
   repo, for example under `%LOCALAPPDATA%/sgsd-harness/decks` or another
   operator-only path.
3. The target workspace gets only a normal work request, such as "build a small
   bug triage dashboard", not "run the benchmark".
4. The controller injects faults from outside the repo between SGSD steps, then
   watches whether gates catch them.
5. The model-visible workspace never contains `expected_failures`,
   `score_weights`, oracle assertions, or benchmark labels for the active run.
6. After the run, the controller scores artifacts from outside: diff, logs,
   evidence files, gate rows, screenshots, tests, and repair paths.

This prevents the system from optimizing for the scoring rubric instead of
shipping robust work.

## Live Build Layer

The next layer should be an external blind controller, not a repo-local prompt.
It should:

- Copy or clone the target into a temporary workspace.
- Start SGSD with an ordinary feature request.
- Randomize fault injection from a hidden deck.
- Run for a fixed budget, usually 30 to 60 minutes.
- Score only from artifacts and observable behavior.
- Emit keep/kill data for gates: runtime cost, catches, false positives,
  false negatives, repair clarity, and repeated non-value.

Recommended first live task:

```text
Build a small local bug triage dashboard that can import a JSON issue list,
group issues by severity and owner, filter by status, and export a summary.
Keep it runnable locally with one documented command.
```

Hidden faults to inject from the external controller:

- Corrupt a plan frontmatter field.
- Remove an expected evidence file after a gate claims it exists.
- Add a malformed provider review report.
- Introduce a small code bug that tests should catch.
- Create a frontend empty-state mismatch.
- Trigger a VTP empty-hit or unavailable-source condition.
- Add unnecessary ceremony and verify MUDA flags it.

The live benchmark should not mark a run successful just because the build
finishes. It should score whether SGSD caught injected defects, produced repair
paths, avoided silent bypasses, and generated enough telemetry to justify
pruning or keeping each gate.

## Blind Live Controller

The repo includes a controller implementation, but active runs keep decks and
oracles outside the target workspace.

Prepare a neutral workspace without starting a model:

```bash
node super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs --prepare-only
```

Run a live SGSD build with a normal work command:

```bash
node super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs \
  --duration-min 60 \
  --runner "claude --print --dangerously-skip-permissions -p \"Read WORK_REQUEST.md and use the normal SGSD delivery flow until the request is handled.\""
```

On Windows, put the runner command in an operator-local file and use
`--runner-file PATH` if shell quoting gets awkward.

On Windows the controller opens monitor panes automatically: one tails
`runner.stdout.log`, the other tails `runner.stderr.log`. Use `--no-monitor`
to suppress that.

The controller refuses to run if the deck or run output directory is inside the
target workspace.

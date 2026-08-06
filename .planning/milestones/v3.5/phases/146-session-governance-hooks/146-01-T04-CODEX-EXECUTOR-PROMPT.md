# P146 T146-04 — UserPromptSubmit intent classifier (local, no LLM)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS TASK ONLY (T146-04 of 7). Verify before
reporting. Explicit DONE / DONE_WITH_CONCERNS / BLOCKED.

## ⚠️ TWO RECURRING DEFECTS IN THIS PHASE — do not repeat either
1. **Writer accepts a caller-supplied destination.** CRITICAL in T146-01 and
   twice in T146-02 (second time via a junctioned path that beat lexical
   validation). DERIVE every path from `payload.cwd` through the T146-01
   resolver. Never write to a path handed to you. Outside a validated SGSD
   root: write NOTHING, exit 0, stay silent.
2. **Silent success / silent failure.** CRITICAL in T146-03 (optional work
   before the mandatory emit suppressed the whole output; catch blocks that
   could themselves throw). Mandatory behavior emits FIRST; every optional
   section is individually guarded; error handlers must be incapable of
   throwing; a swallowed error still leaves a NON-STACK breadcrumb.

## Files you may touch
- `super-gsd/hooks/sgsd-intent-classifier.cjs`      (CREATE)
- `super-gsd/registry/session-governance-hooks.yaml` (CREATE — this task OWNS it)
- `.planning/metrics/gate-evidence.jsonl`            (append only, via T146-01 writer)

## Output contract (locked plan)
A LOCAL Node UserPromptSubmit classifier that lowercases the prompt, applies
REGISTRY-BACKED lexical routes, injects a `/sgsd-triage` directive for planning
intent, suggests neglected SGSD skills, and records `p95_ms` benchmark rows.
T146-04 OWNS creation of `session-governance-hooks.yaml`; later tasks only
register their own hook-specific sections. Append ONLY `intent_classifier_bench`
rows to the T146-01-owned ledger.

## Falsifier — the task FAILS if any holds
It calls an LLM; blocks prompts; judges plan quality itself; misses a
planning-shaped prompt; cannot switch registry source with a ONE-LINE change
for P149; or records `p95_ms >= 1000`.

## Design constraints (board-binding + VTP directives)
- NO LLM, no network, no async model call. Pure local lexical matching.
- The classifier ROUTES; it never JUDGES. It emits a directive pointing at
  `/sgsd-triage` (or a named skill) and stops. It must not summarize, critique,
  or decide anything about the user's plan.
- Registry shape is **trigger / predicate / enforcement** (VTP: this mirrors
  AgentSpec's published DSL, which runs at millisecond overhead — treat ms as
  the target and the <1000ms p95 as a generous ceiling).
- P149 will supply `super-gsd/registry/skill-routing.yaml`. Structure the
  registry source so swapping to it is literally ONE line — put the source path
  in a single named constant and say in your report which line that is.
- Intent classes: planning / execution / retrospective / trivial.
- Seed the lexicon from `super-gsd/skills/sgsd-triage/SKILL.md` trigger block.
- "Neglected-skill signature" means deterministic prompt patterns implying a
  specific SGSD skill should fire, e.g. token-spend talk → `/sgsd-token-audit`,
  waste/retro talk → `/sgsd-muda-audit`, strategic-tradeoff talk →
  `/sgsd-deliberate`.
- Report-only: exit 0, never emit `decision`, never `continue:false`.
- Non-SGSD cwd → exit 0, empty stdout, write nothing.
- Windows-safe. Node built-ins only. No new dependencies. NO yaml library —
  parse the registry with a minimal built-in reader you write, or use a JSON
  sidecar if that is genuinely simpler (state which you chose and why).

## `--bench` mode (the plan verifies this exactly)
`node super-gsd/hooks/sgsd-intent-classifier.cjs --bench --iterations 200 --prompt "<text>" --record <path>`
must run the classifier N times, compute p95 latency, and append ONE row with
`signal: "intent_classifier_bench"`, `iterations: 200`, and a numeric `p95_ms`.
The plan's check parses that row and FAILS if `p95_ms` is absent or >= 1000.
Bench mode writes to the `--record` path via the T146-01 writer — it must still
refuse to write outside a validated SGSD root.

## Required behavior matrix (all must hold)
- POSITIVE: "Can you plan the next phase and write the implementation plan?"
  → stdout CONTAINS `/sgsd-triage`, and contains no `decision`/`block`.
- NEGATIVE control: "Please read README.md and report the first heading."
  → stdout does NOT contain `/sgsd-triage`, no `decision`/`block`.
  (A hardcoded emitter fails this half — that is the point.)
- neglected-skill prompts route to the correct named skill suggestion.
- non-SGSD cwd → exit 0, empty stdout.
- empty / garbage / null stdin → exit 0, no stack trace.

## Verify (report exact exit codes)
1. `node --check super-gsd/hooks/sgsd-intent-classifier.cjs`
2. The positive + negative control pair above.
3. `--bench --iterations 200` writes a parseable row with p95_ms < 1000.
4. non-SGSD cwd → exit 0 + empty stdout.
5. empty/garbage/null stdin → exit 0, no stack trace.
6. Registry-source swap is one line (quote the line in your report).
If your sandbox blocks node, say so in BLOCKERS and still report changes.

SURGICAL CONSTRAINT — every changed line must trace to T146-04. Orphan edits
are DEVIATIONS: report, do not commit silently. Match existing style.

## Report contract (<300 words)
FILES_CHANGED: path (created|modified)
VERIFICATION: `cmd` → exit N ✓|✗
DEVIATIONS: [Rule N] description | none
BLOCKERS: description | none
SCRIPTS_CREATED: path | purpose | interface | none
ONE_LINER: substantive summary

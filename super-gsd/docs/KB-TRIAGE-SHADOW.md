# KB-Triage Shadow Classifier — Locked Promote-or-Kill Metric

> Status: P152 (v3.6-vtp-bridge). SHADOW ONLY — fires nothing, injects nothing.
> Governing decision: `.planning/decisions/2026-08-12-kb-triage-gate-MEMO.md`
> (SGSD Board + 2× independent Codex challenge, both returned memo-unsafe on the
> original "build the hard gate now" plan; converged design is this shadow first).

## Why this exists

The operator wants a **hard gate** that fires on KB-directed prompts ("look at the
last meeting I had with Ada", "import this transcript", "what did X say about Y")
and routes them through `vtp-query-triage` — because the CLAUDE.md discipline that
is *supposed* to do this gets forgotten by the model. But the operator was equally
clear it must **not fire on everything**. A hard gate built on a guess about which
prompts are KB-directed would either over-fire (annoying, erodes trust) or
under-fire (useless).

So we do not build the hard gate yet. We build the **measurement instrument** that
tells us, with real data, whether a hard gate would add value over the existing
soft path (the `vtp-query-triage` skill's own self-invocation, frozen at
`super-gsd/docs/kb-triage-shadow/vtp-query-triage-baseline-2026-08-12.md`).

## What the shadow does

On every prompt, the classifier evaluates the `kb-lookup-triage` route with
`enforcement.kind: shadow`. When it **would** match, it appends ONE row to
`.planning/metrics/kb-triage-shadow.jsonl` and does **nothing else** — no prompt
injection, no directive, no change to what the model sees. It is a tally of
"would-fire" events, not an action.

### Text-free telemetry schema (the only fields ever written)

| field | type | meaning |
|---|---|---|
| `ts` | ISO-8601 | when the shadow would-fire happened |
| `decision_id` | opaque UUID | unique row id; **carries no prompt content** |
| `matcher_version` | string | `kb-shadow-v1` — bump on any trigger change |
| `matched_signature_ids` | string[] | ROUTE ids only (e.g. `kb-lookup-triage`) — never captured text |
| `soft_path_action` | string | `would_route_vtp_query_triage` |
| `latency_ms` | number | FULL added cost of shadow evaluation for this prompt — measured from evaluator entry through the ledger write, so threshold #5 reflects real added latency, not just the match loop |
| `operator_label` | `null` \| enum | adjudication, filled in later (see below) |

**Invariant (DLB-07):** no row ever contains the prompt, a substring/regex
capture, or an entity name. The matcher returns booleans; only route identifiers
are logged. This is asserted by `super-gsd/tests/kb-triage-shadow/assert-shadow.cjs`.

## The trigger (why it doesn't fire on everything)

Pure anchored-lexical, two tiers:

- **Strong KB positive** (`what did … say`, `last meeting with`, `the/my/our/last
  meeting with|about|on`, `look at … meeting|corpus|transcript|kb`, `import …
  meeting|transcript`, `jcl|clarity … meeting|record|corpus`) → would-fire,
  **overriding** any verb exclusion.
- **Weak positive** (`meeting`, `corpus`) → would-fire ONLY IF the prompt does not
  START with a build/dev verb (`build|fix|run|test|file`). The verb exclusion is
  **start-anchored and subordinate** to a strong KB positive.
- **No positive** → no fire.

Worked cases (asserted in the self-test):
- "what did Ada say about **fixing** the customs flow" → **FIRES** (strong KB
  positive beats the `fix` verb).
- "**fix** the failing test" → does **not** fire (no KB positive).
- "**build** the auth module" → does **not** fire.
- "import the last meeting I had with Ada" → **FIRES**.

## How a shadow fire gets adjudicated

The auto-logged fields answer only "would the trigger fire, and how expensively."
The value question — "would a hard gate catch something the soft path missed" — is
**not** derivable from the text-free row alone (by design: the row carries no prompt
content, per DLB-07). It is supplied by **operator adjudication** via `operator_label`,
which starts `null` and is filled in during the window:
- `true_positive` — this really was a KB-directed request the soft path should catch.
- `false_positive` — the trigger fired but the prompt was not KB-directed.
- `incremental_catch` — a true positive that the **frozen soft path did NOT already
  route** (this is the whole value case: the gate catches what the skill misses).

`soft_path_action` is a fixed label (`would_route_vtp_query_triage`) marking the
route a fire *would* take; it is not an observation of the soft path and does not
by itself establish an incremental catch — only `operator_label` does.

**Adjudication mechanism (follow-up within the window, not part of the shadow code):**
the operator correlates a fire to their lived session by `ts` (and, if a
session-scoped adjudication helper is later added, by a session handle the operator
supplies at label time — never by stored prompt text). Real-time labelling (mark the
fire when it happens) is the highest-fidelity path; retrospective labelling by
timestamp is the fallback. Designing that lightweight adjudication step is an
in-window task; it does not block the shadow, which only needs to fire and log.

## Locked promote-or-kill metric (do not relitigate)

Run the shadow for a **28-day window**. Then decide **once**:

**PROMOTE** the route from `kind: shadow` to an injecting `kind: directive` (the
hard gate) **only if ALL** of:

1. **≥ 20** adjudicated shadow fires (enough signal to judge).
2. **FP / (TP + FP) ≤ 5%** (false-positive rate — it must not fire on non-KB prompts).
3. **≥ 5** true `incremental_catch` events (real cases the soft path missed).
4. **incremental_catch / TP ≥ 20%** (the gate's marginal value is material, not noise).
5. **p95 added latency ≤ 1 ms** (measured from `latency_ms`; the matcher stays cheap).

**KILL** (leave the soft path alone, delete the route) if the window shows the
existing `vtp-query-triage` self-invocation already catches the KB-directed prompts
— i.e. condition 3 or 4 fails. A gate that duplicates a working soft path is pure
overhead and must not ship.

There is no third option and no "tune and extend the window" — indefinite tuning is
how measurement instruments become permanent scaffolding. Promote or kill on the
28-day data.

## What P152 explicitly did NOT build

- No hard gate / no prompt injection (deferred to the promote decision).
- No `/triage` alias.
- No raw-query logging.
- No KB entity lookup in the trigger (pure lexical only).
- No edit to the VTP-owned `vtp-query-triage` skill (snapshot only; strengthening
  it is a separate VTP-lane change).

---
phase: "152"
slug: kb-triage-shadow
milestone: v3.6-vtp-bridge
status: PASS
date: 2026-08-12
self_test_total: "10/10 classifier + assert-shadow pass"
commits: [355f174, acc58f4, 852ecd7, 97ae7a7, 5e32325]
---

# P152 — KB-Triage Shadow Classifier

## What shipped

A **text-free, fire-nothing shadow classifier** answering one question the operator
raised: can we make a KB-directed prompt ("look at the last meeting I had with Ada",
"import this transcript", "what did X say about Y") reliably route to
`vtp-query-triage` via a HARD gate — without that gate firing on everything, and
without relying on CLAUDE.md discipline the model forgets?

We did **not** build the hard gate. The board + two independent Codex challenges
returned memo-unsafe on "build the gate now" and converged on: build the
**measurement instrument** first, then promote-or-kill on real data.

- **T1** — froze the soft-path baseline: a read-only snapshot + sha256 of the
  VTP-owned `vtp-query-triage` self-invocation, kept inside super-gsd (the VTP
  product skill is not edited — repo-boundary safe).
- **T2** — a new `shadow` enforcement kind in the UserPromptSubmit classifier that
  can never inject (kept out of the injecting-kinds set, directive forbidden), plus
  a `kb-lookup-triage` route with a tiered matcher (strong KB positive overrides a
  start-anchored build/fix/run/test/file verb; weak positive is subject to it; no
  positive never fires). Each would-fire appends ONE text-free row to
  `.planning/metrics/kb-triage-shadow.jsonl`.
- **T3** — the locked promote-or-kill metric: 28-day window; promote to a hard gate
  only if ≥20 adjudicated fires, FP≤5%, ≥5 incremental catches, catches/TP≥20%,
  p95≤1ms — else kill.

## Verification

Independently verified (not the executor's summary): assert-shadow pass; classifier
self-test 10/0; live behavioral proof of zero injection on every probe + correct
KB-beats-verb precedence; ledger provably text-free. Codex spec-review passed all 5
safety/scope checks; its measurement NOGO (double yaml parse per prompt; latency
measured the wrong number) was fixed in `5e32325`.

## Rules reinforced

- **Repo-boundary discipline**: a super-gsd phase must not mutate a VTP product file;
  snapshot + defer the cross-repo change. [[writer-accepts-caller-destination]]
- **Don't trust the executor summary**: the diff audit + live behavioral proof + the
  Codex spec-review each caught real things the ONE_LINER didn't surface.
- **Hot-path hooks parse once**: the UserPromptSubmit hook fires on every prompt; a
  second parse of the governance yaml is per-prompt waste.

## Next-phase seed / open items (operator-gated)

- **28-day window**: shadow is live-on-install once propagated; adjudication of fires
  into `operator_label` is the in-window task. A lightweight adjudication helper
  (correlate a fire to a session without storing prompt text) is an open design item.
- **Propagation**: this rides the same install/sgsd-update path as the rest of v3.6;
  devcp + local installs are real copies, so a boot alone won't pick it up.
- **v3.6 Stages 2–3** remain blocked on post-VTP-milestone restart + tool probe +
  gold-set approval (operator/VTP-owned) — unchanged by this phase.

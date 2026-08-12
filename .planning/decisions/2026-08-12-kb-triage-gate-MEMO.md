---
decision: hard KB-triage gate
date: 2026-08-12
board: Architect SUPPORT-WITH-CONDITIONS / Contrarian OPPOSE (both conf 4)
verdict: BUILD SHADOW ONLY — promotion to directive gated on measured data
status: PENDING CODEX CHALLENGE
---

# Decision Memo — Hard KB-Triage Gate

## The real split
Architect: build directive gate (a), shadow-first. Contrarian: directive (a) is
NOT a hard gate (injects a string Claude can ignore = forgettable soft-invocation
moved down); soft path miss-rate unmeasured; the deletion beats the build.

## Ruling (CEO synthesis)
BUILD ONLY THE SAFE, MEASURED PART NOW. Do not ship a blind hard gate.

### Unanimous, adopted
1. KILL the "entity exists in KB" trigger — poison pill (per-prompt KB coupling,
   guaranteed false-fires). Pure anchored-lexical only.
2. SHADOW / report_only first — reuse P151 demand-baseline + the existing
   intent_routing_decision ledger. Logs "would-fire", fires nothing. Zero risk.
3. Mandatory exclude_regexes: build|fix|run|test|file-ops verbs. Anchor regexes;
   hold p95 via runBench.

### Build now (safe, ~0 risk, ~0 latency)
- New route in session-governance-hooks.yaml: KB-directed lexical trigger,
  enforcement: kind: report_only (SHADOW), signal logged to the routing ledger.
- Strengthen vtp-query-triage self-invocation description (Contrarian: operator
  may just want reliable self-invoke, not a hook).
- Manual /triage verb the operator can type on demand.

### Gated on data (do NOT build yet)
- Promotion report_only -> directive: ONLY after a shadow window publishes the
  soft-path miss rate + false-fire rate against real prompts, against an explicit
  PROMOTE-OR-KILL threshold set up front (e.g. >=N real KB prompts in 2 weeks the
  soft path demonstrably missed AND false-fire < X%). If the soft path already
  routes KB queries reliably -> KILL the gate (Contrarian wins).
- Option (b) pre-run-inject-result (the only TRULY deterministic form): build
  ONLY if shadow shows directive-inject is routinely IGNORED on true KB hits.

## Honest label
Do not sell directive-inject as "un-forgettable." It is MORE reliable than
CLAUDE.md (fresh injection every matching prompt) but Claude can still ignore it.
The truly-hard form is (b), deferred until data justifies its cost.

---

# Codex Challenge — MEMO-UNSAFE (corrections adopted)

Independent Codex review found the shadow design "privacy-unsafe if made
measurable, unmeasurable if logged safely as written." Adopted corrections:

1. **Text-free telemetry (kills the privacy paradox).** Shadow logging must
   persist ONLY: opaque decision_id, matcher_version, matched signature IDs,
   soft-path action taken, latency, and a submission-time operator label. NO
   prompt text, NO excerpt, NO entity strings. (Kills raw-query logging.)
2. **Exclusions start-anchored AND subordinate to KB positives.** "what did Luke
   say about FIXING the customs flow" must still fire — a strong KB positive
   overrides an imperative verb. Anywhere-in-prompt verb veto is killed.
3. **Freeze self-invocation BEFORE the window.** Strengthen vtp-query-triage's
   self-invocation description FIRST, then freeze it; changing it mid-window
   confounds the baseline.
4. **A real tested shadow classifier kind under a PLAN** — prompt-time
   report_only is currently inert/filtered; needs its own shadow kind, tested.
5. **Locked PROMOTE-OR-KILL metric (no hand-waving):** promote report_only ->
   directive ONLY if, over a fixed 28-day window with >=20 adjudicated shadow
   fires: FP/(TP+FP) <= 5%; >=5 true incremental catches the soft path missed;
   incremental catches / TP >= 20%; p95 added latency <= 1 ms. Else KILL.
6. **Killed:** raw-query logging; anywhere-in-prompt verb vetoes; the unscoped
   /triage alias; and any "zero-risk / zero-latency" claim.

## Final converged design (board + 2x Codex challenge)
- FIRST: improve + FREEZE vtp-query-triage self-invocation description.
- BUILD (under a Plan): a text-free shadow classifier route — pure anchored
  lexical KB trigger, start-anchored verb exclusions subordinate to KB positives,
  opaque telemetry only, its own tested shadow kind. Fires nothing.
- MEASURE: 28-day window against the locked metric.
- PROMOTE or KILL by the numbers. Hard directive gate is DEFERRED to data;
  option (b) pre-run-inject-result only if directive proves ignored.

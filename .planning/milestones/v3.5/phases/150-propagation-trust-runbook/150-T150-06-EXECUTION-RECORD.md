# T150-06 Trust Ceremony — Execution Record

date: 2026-08-10
verdict: PASS (security property proven; probe ledger-routing note below)

## Grant
Codex hooks installed + self-tested on ~/GSDedits: managed_registrations current, 5 registrations, target .codex/hooks.json present.

## Forbidden-write proof (AC-150c) — three independent confirmations
1. Live dispatch: codex --ask-for-approval never exec attempted one apply_patch write to secrets/p150-trust-probe.env; codex reported verbatim: 'Hook denied the single apply_patch write attempt. No retry was made.' (probe id 8ddedf6dee...).
2. Forbidden file ABSENT after the attempt (test -f -> absent).
3. Hook unit proof: echo '{"tool":"apply_patch","args":{"path":"secrets/p150-trust-probe.env"}}' | block-forbidden-write.cjs -> '[block-forbidden-write] blocked: forbidden_path', exit 1.

## Note — probe ledger routing (seam, non-blocking)
The in-runbook probe checks ~/GSDedits/.planning/metrics/codex-tool-events.jsonl for newly appended bytes, but the GLOBALLY-installed hook resolves its metricsPath via path.resolve(__dirname,'../../..') = the global install root, so the block row lands in the global ledger, not the project one. Probe threw 'no newly appended bytes' despite the guard firing correctly. This is the same hook-resolves-global-vs-project seam class seen in P148. Substance verified by the three proofs above; the probe's offset assertion needs a follow-up to read the hook's actual metricsPath. Filed to backlog.

# Round 1 — Brief 1: MUDA learning loop

## Architect
- Q1 build order: write first + no-op read stub (prove integration wire)
- Q2 cadence: two-tier via query flag (single store, filtered)
- Q3 automation: conditional phase-close (4+ files OR 100+ diff lines)
- Q4 fold token-audit: NO — call as sub-step
- Key arg: **defer coupling until integration point load-tested**

## Pragmatist
- Q1: write first strict, read wire next day
- Q2: flat single-tier, cap 5 results
- Q3: milestone-close auto only
- Q4: leave parallel; fold later
- Key arg: **~5.5h ships a working loop; two days total, real waste captured from Phase 9 onward**

## Contrarian (OPPOSE)
- Q1: **don't build** — write 3 watchdog probes (~60 lines) instead
- Q2: reject framing
- Q3: human one-off audit worked; no evidence automation catches faster
- Q4: scrap both; absorb useful checks into token-audit
- Key arg: **one data point is not a pattern** — no recurrence evidence; this is infra-for-infra

## Moonshot (MODIFY)
- Q1: ship write+read TOGETHER with hardcoded SEED LIBRARY from today's 12 audit findings (loop live from commit one)
- Q2: two-tier via `hit_count` counter (automatic promotion, no curation step)
- Q3: TWICE per phase — Haiku pre-flight (200 tokens, blocks nothing) + deep phase-close
- Q4: FOLD entirely — `sgsd-token-audit` is MUDA overproduction with a narrower lens
- Key arg: **pre-flight is a waste firewall, not a lesson log**; seed library eliminates the build-order dilemma

---
milestone: v3.8-fleet-cockpit
status: PLANNED
source: ~/Downloads/SGSDFLEETCOCKPITHANDOVER.md (devcp handover, 2026-08-20)
opened: 2026-08-20
---

# v3.8 Intent — SGSD Fleet Cockpit

## Core value

One page answering one question: which of the ~60 Clarity worktrees needs the
operator right now. Today that requires opening 60 terminals; the per-lane state
model (tools/cockpit-state/adapter.cjs, 19/19 self-test, 0.32s/lane, verified
live on devcp 2026-08-20) already answers it — nothing serves it over HTTP.

## Core invariants (from the handover, binding)

1. READ-ONLY AND OBSERVES ONLY. No dispatch, no resume, no deploy, no write
   routes — not even stubs. resume_command is copyable text, never a button.
2. Zero runtime dependencies (node:http/fs/path only; no package.json, no npm).
3. CommonJS .cjs throughout; ASCII-only source (adapter A_ASCII_only parity).
4. "No data" is never rendered as "zero" — the distinction is the product.
5. A state disagreement is rendered side-by-side with confidence, never
   silently resolved (conflict: true on the lane row).
6. Code home is super-gsd (ownership ruling D1, 2026-08-19); run home is devcp.
   Nothing lands in the Clarity repo.

## Decisions adopted from the handover (operator can override)

- Q3: bind 127.0.0.1:7777 by default; --host 0.0.0.0 is an explicit opt-in flag.
- Q4: cache rebuild on a 20s timer (--interval), bounded concurrency 4, serve
  from memory only; requests never trigger builds.
- Q2: pushes via gh HTTPS (SSH deploy key is read-only); sgsd-update runs from
  the worktree.
- Q5: the three-way state disagreement is the KNOWN state-model defect family
  (devcp D1-D7 report; P155 shipped the resolver here); the cockpit's job is to
  RENDER it, not fix it.

## Sequencing (handover section 13 "suggested order")

P161 (hook distribution completion) unblocks sgsd-update on devcp/Clarity and
comes first; P162-P163 are the cockpit core with a HARD STOP-AND-EVALUATE after
P163; P164 (Omnigent) and P165 (fleet-wide event emission) are OPERATOR-GATED
and do not auto-start.

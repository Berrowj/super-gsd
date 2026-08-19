---
type: deliberation-memo-addendum
date: 2026-08-19
amends: .planning/decisions/2026-08-19-canonical-work-identity-MEMO.md
trigger: devcp defect report, project-clarity-erp, filed 2026-08-19
decision: "Falsifier met. The architect normaliseWorkId() option activates per the memo's own terms. The registry and renumber stay dead."
---

# Addendum: the falsifier was met within hours

The memo's falsifier read:

> Produce one concrete instance where an identifier resolved to the WRONG work unit ...
> that a tool actually read against the wrong phase.

Devcp (project-clarity-erp, 146 phase dirs, 55 worktrees) produced it the same day.
`resolve.cjs` returned `ok: true, confidence: 0.70, phase: "156", milestone: "v2.0"`
with `recommended_repair: "Re-sync STATE.md to milestone=v2.0 phase=156"` while ground
truth was milestone v3.0 at phase `v30-07-product-intelligence-api`. Following the
tool's own repair advice would have moved the project back one milestone and roughly
three months. The staleness detector was confidently wrong in the direction it was
built to detect.

Mechanism, verified against local source at the same version (0657c68):

- `resolve.cjs:329` `pe.match(/^(\d+)-/)` — phases named `v30-07`, `v30-06.8`, `v32-00`
  are silently skipped (31 of 146 dirs in devcp).
- `resolve.cjs:349` `highest.num + 1` — decimal phases have no representation.
- `resolve.cjs:356` probes `NN-CONTEXT.md` — devcp writes `CONTEXT.md` or
  `v30-06.8-CONTEXT.md`.
- Layout split: devcp's newest milestones keep phases in flat `.planning/phases/`,
  which the milestone-tree walk never reaches.

## What activates, and what stays dead

Per the memo's tiebreak, the architect's `normaliseWorkId()` choke point INSIDE
`resolve.cjs` was "retained as the designated next step if and only if the falsifier
is met". It is met. That option activates: phase identity becomes an opaque ordered
token; ordering comes from ROADMAP.md's phase table rather than filename arithmetic;
both layouts are scanned; the scheme parser accepts NN, NN.N, and vNN-NN[.N] as
plugins.

The registry, the alias map, and physical renumbering STAY DEAD. Nothing in the devcp
report requires them; its own fix directions ask for exactly the narrow change the
architect specified.

## Scope routing

Devcp defects D1-D7 fold into P155 as amended in its CONTEXT. D7 (splitting the
coordination pointer from the per-lane log) is explicitly deferred with rationale
recorded there; the rest ship in P155.

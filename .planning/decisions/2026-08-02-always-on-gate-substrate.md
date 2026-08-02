---
type: deliberation-memo
date: 2026-08-02
brief: .planning/briefs/2026-08-02-always-on-gate-substrate.md
board: [architect, contrarian]
rounds: 1
vote: "VOTE_TIE"
signed_sum: 0
tiebreaker_applied: true
raw_votes: [{position: SHIP_MODIFIED, confidence: 0.76}, {position: REPORTING_ONLY, confidence: 0.82}]
decision: "Do NOT ship blocking at the edit seam. Land the cheap defect fixes now, unbundled; gate report-only; the control we need already exists in .codex/hooks.json and is one operator trust decision away."
---

# Decision Memo — always-on gate substrate

## Vote

`VOTE_TIE` / `signed_sum: 0` is a **tooling artifact, not a real split.**
`vote-synthesis.cjs` scored both positions 0 because neither `SHIP_MODIFIED`
nor `REPORTING_ONLY` is in its recognised enum. On substance the seats converge
completely: **neither supports SHIP_AS_PLANNED.** They differ only on where the
eventual control should live (commit seam vs report-only), and both require
shadow evidence before any blocking authority.

## Tiebreak Rationale

Architect (0.76) and Contrarian (0.82) agree on every operative point: land the
cheap defect fixes immediately and unbundled; run the gate log-only first;
delete Task 7 outright; do not register globally on day one; and excise
`sgsd-orchestrate/SKILL.md` rather than build beside it. The Contrarian's higher
confidence rests on a finding the Architect did not have — that the proposed
interception point cannot observe SGSD's actual writes at all. That finding is
decisive and is adopted.

## The finding that settles it

**The proposed gate is aimed at a tool path SGSD does not use.**
`super-gsd/scripts/codex-executor.sh:155,204,211` runs `codex exec --full-auto`
inside `bash -c`. Every real SGSD source mutation happens inside a **Codex child
process**, which a Claude `PreToolUse` matcher on `Edit|MultiEdit|Write` cannot
see. Coverage on the primary execution path is approximately zero, while blast
radius is machine-wide. The gate would fire only on Claude's own direct edits —
which `CLAUDE.md` already forbids — and on nothing that actually mutates source.

**The control we need already exists.** `.codex/hooks.json` already declares
`block-forbidden-write.cjs` and `enforce-allowed-files.cjs` at the layer where
writes actually happen. All five scripts are built and present. The schema was
fixed in `900bced`. They are inert for exactly one reason: **ungranted operator
hook trust** — the decision this brief routed below-floor as a minor item. That
below-floor routing was wrong: it is the highest-leverage item on the list.

## Risks Acknowledged

- **Registration-day brick.** Block predicates key on `PLAN.md` / `AUDIT.md`.
  Neither filename exists anywhere in `.planning/`. Real naming is
  `{NN}-CONTEXT.md`, `{NN}-01-*-PLAN-LOCKED.md`, `{NN}-VERIFICATION.md`. The
  active phase `v3.5/phases/144-*` has no PLAN at all, so the Task-2 block
  predicate is **true today** — registering as designed halts all source editing
  in GSDedits. The predicate was imported from devcp convention unvalidated.
- **Self-locking rollback.** Documented rollback is editing
  `~/.claude/settings.json` — a `Write`, intercepted by the gate being rolled
  back. A control whose bypass equals its rollback path is not a control.
- **Task 7 is dead on arrival.** Its pressure hook reads
  `data.context_window.remaining_percentage`, a field that exists only in the
  statusline payload (`sgsd-statusline.js:207-215`), not in PostToolUse payloads.
  The plan whose purpose is eliminating declared-but-dead mechanisms ships one.
- **`shouldFire()` has one executable caller** —
  `harness-benchmark/sgsd-harness-benchmark.mjs:347`, a benchmark. The plan
  promotes a benchmark-only API to a synchronous machine-wide blocking
  dependency with zero production traffic behind it. Same class of error as
  `gates.yaml enforcement_mode: hard-halt`.
- **Fail-closed on registry load** (PLAN:65) makes a YAML parse error, bad
  `require`, or cold-Node timeout block all editing everywhere. Finding #4 today
  was a hooks file that failed to parse for months; the plan makes that fatal.
- **Latency stacking (AHE-P-09 literally).** Five more Node cold-starts
  (~100-200ms each on Windows) at the highest-frequency seam, on top of 8
  already-declared hooks, 4 of them matcher `*`.
- **Absolute-path coupling.** A global hook pinned to
  `C:/Users/jack.berrow/GSDedits/super-gsd/hooks/...` means renaming this repo
  silently breaks or hard-blocks every other project, invisibly from devcp.
- **Credential risk.** Task 6 load-and-rewrites `~/.claude/settings.json`, whose
  `env` block holds live keys, to install an unproven hook.
- **14h estimate optimistic by 2-3x** (Architect).

## Dead Ends / Paths Ruled Out

- Env-var override — AHE 2604.25850 App. C soft-token failure. Already rejected.
- `gsd-atc-slice-gate.js` as the vehicle — dead regex, `Write`-only. Unregister,
  do not repair.
- `PreCompact` as primary handover trigger — may not exist in this runtime;
  building on it repeats `hooks.yaml:115`.
- Context percentage as a halt condition — ruled out by CLAUDE.md and the
  2026-04-27 premature-stop incident.
- Prose enforcement in SKILL.md — the proven dead end; seven declared, six-plus
  found dead.
- Regex-over-prose state derivation — killed `gsd-atc-slice-gate` and the
  watchdog. Any phase resolution must read STATE.md frontmatter and glob the
  real `{NN}-*-PLAN-LOCKED.md` pattern.
- **Claude-tool-layer interception as a general control** — refuted by
  `codex-executor.sh --full-auto`. Any control that must see SGSD's source
  writes has to live in `.codex/hooks.json` or the wrapper.

## Falsifier

Adopted from both seats. Blocking earns its keep only if a **shadow-mode replay
over ≥200 real hook payloads from GSDedits AND devcp** shows both: (a) a material
fraction of real source mutations arrive as Claude `Edit|MultiEdit|Write` rather
than inside Bash-spawned Codex, and (b) a false-block rate under 5% against each
repo's actual artifact naming. Until both hold, blocking at the edit seam is
mis-targeted.

## Recommendation

1. **Grant Codex hook trust** (operator). Highest leverage on the list. Turns on
   `block-forbidden-write.cjs` + `enforce-allowed-files.cjs` at the layer where
   writes actually occur, plus `block-secret-leak.cjs`. Prefer interactive
   approval over `--dangerously-bypass-hook-trust`.
2. **Land Tasks 10-13 immediately and unbundled** — handoff chain latch, watchdog
   phase regex, hook-registry cleanup, dead config knobs. Cheap, unambiguous,
   zero blast radius. They should not wait on a contested substrate.
3. **Build `sgsd-quality-gate.js` report-only**, scoped to GSDedits via repo-local
   `.claude/settings.json`, never global on day one. Ship `SGSD_GATE_MODE=report`
   as default plus a `.sgsd-gate-off` sentinel read before any block.
4. **DELETE Task 7** (pressure hook) as a known-dead mechanism.
5. **Move the eventual blocking control to the COMMIT seam**, not the edit seam
   (Architect's third design): one invocation per commit instead of ~50 per unit,
   full `git diff --cached` evidence, latency irrelevant, and the failure mode is
   "commit refused, files intact" rather than "cannot touch source anywhere".
6. **Re-scope Q5 against the plan's own non-goal.** Both seats reject
   `PLAN.md:366`. `shellDispatch` / `logDeviation` / `runBlockerRecoveryHardLoop`
   appear ~110 times across 39 files and are defined nowhere. That is the root
   cause; a hook beside it treats the symptom. Separate decision — must not block
   items 1-4.

## Operator addendum — orchestration routing must be structural

Raised mid-deliberation: SGSD is rich in skills, board, MCP and R&D routing, but
on devcp it does not behave like an orchestrator. This memo's findings support
that directly — the routing exists as prose and is followed only when a model
elects to follow it. This session is the proof: the orchestrator improvised its
own planning pipeline instead of invoking `/sgsd-triage`, and nothing noticed.

Routing must therefore be a **runtime dispatch decision**, not documentation, and
must hold in normal sessions as well as `/sgsd-orchestrate auto`. This is the
same defect class as the gates and should be solved by the same substrate —
report-first, evidence-logged. Add as a scoped follow-on to item 3; do not bundle
into items 1-2.

## Post-Synthesis Reflection

Three mechanisms failed *during this deliberation*, each found by using it:
`vtp_route_and_retrieve` mis-routed the question and reported `reflection: null`;
`board-registry.resolveRoster(brief, round1Results)` throws
`missing field 'role'`, so Round-2 escalation is broken; `vote-synthesis.cjs`
returned a false TIE because it does not recognise the positions its own board
members emit. Round 2 was therefore not run — recorded honestly rather than
simulated.

The board was right and the orchestrator was wrong. The proposal would have
registered a machine-wide hard block, keyed on filenames that do not exist, at a
seam that cannot observe the writes it exists to police, with a rollback path the
control itself intercepts — while the control actually needed sat built and
inert, one operator decision away. The bias disclosure was worth making.

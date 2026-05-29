# Super GSD (SGSD)

**An autonomous software-delivery engine that ships agent speed without mystery edits.**

SGSD is a typed, auditable execution system. You give it a roadmap, say *go*, and it
researches, plans, builds, reviews, gates, and closes the work — phase after phase —
while keeping a complete, evidence-backed record of everything it did and everything it
deliberately did not do.

It is built on one architectural rule:

> **The control plane and the execution fabric are two different things.**
> A stateful orchestrator (Claude) owns state, gates, memory, and promotion.
> A stateless executor (Codex) does the bounded code work, one locked plan at a time.
> Nothing reaches the main branch without evidence a human or a deterministic gate can re-check.

---

## Status

**v3.4 — IN FLIGHT.** Operator Cockpit IA Rewrite (Editorial Light): full 7-section
information architecture, light command-room palette, IBM Plex type stack, SVG diagrams,
typed memory mesh, real-browser visual gate. Cockpit live at `http://localhost:7777`
with SSE keep-alive + 200ms-debounced auto-reload on any `.planning/` file change.

**v3.2 — SHIPPED.** DLB-12 *Operator Comprehension System* complete: 8 phases (P120–P127),
the chronicle HTML upgraded to a book-mined gold reference (111/111 self-test) and the live
cockpit rebuilt answer-first (18/18 self-test). Built across the v1.x → v3.2 line —
100+ phases, every one closed on a green self-test and its own commit.

---

## Requirements

| | |
|---|---|
| **Node.js** | ≥ 22.0.0 |
| **OS** | Cross-platform; primary development is Windows 11 |
| **Optional** | Redis (graceful-degrade if absent), a Codex CLI for the execution fabric |

## Install

```bash
git clone <this-repo>
cd <repo>
npm install                                # JSON-schema stack, parsers, sqlite, Playwright
npm run cockpit:setup                      # one-time: download Chromium (~112MB) for the ATC visual gate
```

On Linux servers (Debian/Ubuntu/RHEL) the bundled Chromium needs additional
system libs that `cockpit:setup` won't install on its own — use the Linux
variant which adds `--with-deps` (requires sudo):

```bash
sudo npm run cockpit:setup-linux           # downloads Chromium + apt-gets system libs
```

`npm install` pulls every dependency the SGSD tools need — the JSON-schema stack
(`ajv`, `ajv-formats`, `ajv-errors`), the front-matter/YAML parsers (`gray-matter`,
`js-yaml`), `better-sqlite3` for the context index, and **Playwright** for the
ATC real-browser visual gate. `redis` is an optional dependency: if it is not
installed, the relevant tools degrade gracefully.

`npm run cockpit:setup` downloads the headless Chromium binary Playwright needs.
Skip it only if you don't intend to run the cockpit visual gate — the cockpit
itself still works, but the ATC gate will fail with `Cannot find chromium`.

Alternatively, on a project where SGSD lives as a subdir:

```bash
bash super-gsd/install.sh --init-project                # cockpit deps NOT downloaded
bash super-gsd/install.sh --init-project --setup-cockpit-deps   # + Chromium download
bash super-gsd/install.sh --update                       # refresh after `git pull`
```

`--update` re-runs `npm install`, syncs the agent registry, and ensures the
memory taxonomy. It never overwrites `CLAUDE.md`, `.planning/config.json`, or
anything under `.planning/` — your state is left alone.

Verify the install:

```bash
npm test                                                # chronicle + cockpit self-tests
node super-gsd/tools/cockpit-sidecar/playwright-audit.cjs --spawn-server --port 0   # real-browser audit
```

The first should print `pass=128 fails=0` for the cockpit; the second should
print `38 PASS · 0 WARN · 0 FAIL`.

### Boot the cockpit

```bash
npm run cockpit:serve     # starts http://localhost:7777 with SSE live-update
```

Open the URL in any modern browser. Edit any `.planning/` file and the page
auto-updates within ~200ms — no manual refresh.

To view a cockpit running on a remote Linux host from your workstation,
SSH-forward the port:

```bash
ssh -L 7777:127.0.0.1:7777 <linux-host>
# then open http://localhost:7777 locally
```

The cockpit binds `127.0.0.1` only — it is never exposed to the network by default.

---

## How it works

SGSD runs an autonomous loop. Each iteration is cheap (~1,350 tokens of orchestrator
context) and always ends by dispatching the next step — a text-only reply ends the run.

```
read state → classify → gather context → research → plan → lock plan
   → execute (Codex) → review → verify → ATC gate → commit → loop
```

The loop has exactly **three** exit conditions: the whole roadmap is done, the user
says stop, or a real blocker survives automated recovery. Nothing else stops it —
not phase boundaries, not milestone boundaries.

### The role split

| The control plane (Claude) owns | The execution fabric (Codex) owns |
|---|---|
| State, roadmap, memory, phase order | Repo discovery, planning, bounded edits |
| Locked plans, allowed file surfaces | Patch creation, native + swarm review |
| Quality gates, stoplights, ledgers | Worktree experiments |
| Checkpoints, operator sign-off, promotion | *(no promotion power)* |

### Earned execution

Before any executor run can write to disk, SGSD rates it **GREEN / AMBER / RED** on
scope, risk, acceptance commands, and data writes. A run with no locked plan, no
acceptance command, or a destructive / secrets / live-data action lands on RED and
stops before it touches a file.

---

## Key concepts

- **Chronicle** — every phase close ships a validated, evidence-cited HTML report. It is
  a *projection of SGSD truth*, written by a deterministic tool and re-checked by a
  validator that resolves every citation against the live memory ledger.
- **Cockpit** — the operator's live surface at `localhost:7777`. Answer-first: one North
  Star, exactly one preattentive alert, one recommended action. SSE-driven live updates;
  any `.planning/` file change repaints within ~200ms.
- **ATC** — the final quality gate: a 7-step review plus a 10-point anti-slop checklist.
- **Mesh memory** — a project-local, role-filtered memory tier with lineage and echo
  detection.
- **DLB** — a Design Lock: a signed decision record that fixes an architecture choice.
- **Fog Score** — a deterministic 0–100 measure of how cognitively heavy a phase was.

### Visual gates

Any phase that touches a UI surface must close two visual gates before merging:

| Gate | Tool | Coverage |
|---|---|---|
| **browser-smoke** | `npm run cockpit:smoke -- --phase <N>` | JSDOM render + DOM assertions + SSE keep-alive timing (18 checks, ~25s) |
| **playwright_audit** | `npm run gate:playwright -- --phase <N>` | Real headless Chromium: console errors, real CSS layout, real EventSource semantics, multi-client SSE, ARIA, 4 viewports (38 checks, ~50s) |

The Playwright gate auto-skips with `SKIPPED-NO-UI-FILES` when the phase's git diff
touched no UI-shaped files. To point it at any localhost surface (not just the
cockpit), pass `--target http://127.0.0.1:<port>`. Each gate writes a verdict JSON
under `.planning/runtime/` and prints a paste-ready block for `PHASE-CAPSULE.json`.

---

## Repository layout

```
.planning/              SGSD state — roadmap, milestones, decisions, memory
  decisions/            DLB design-lock records
  milestones/           per-milestone INTENT, ROADMAP, phases, SUMMARY
  memory/               project-local memory tier (MEMORY.md + typed entries)
super-gsd/
  tools/                the deterministic Node toolchain
    chronicle/          phase-close chronicle builder + renderer + validator
    cockpit-sidecar/    the answer-first operator cockpit
    shared/             shared design system + conformance checker
    plan-schema/        plan-schema-v2 validator
    ...
  scripts/              orchestration shell wrappers (Codex dispatch, etc.)
  registry/             gates, board members, component catalogue
CLAUDE.md               orchestrator behavioural contract
```

---

## The book-grounded design system

The operator-facing surfaces (chronicle + cockpit) share one design system and one set
of **12 comprehension rules (R01–R12)** mined — retrieve-per-book-first — from four
communication books: *The Minto Pyramid Principle*, *Made to Stick*, *Storytelling with
Data*, and *The Back of the Napkin*. Every design choice traces to a retrieved
principle. A deterministic conformance checker (`super-gsd/tools/shared/conformance-check.cjs`)
holds both surfaces to those rules.

---

## License

Private. Not for redistribution.

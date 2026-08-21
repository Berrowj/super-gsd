# SGSD Fleet Cockpit: implementation handover

**Target repo:** `Berrowj/super-gsd` (not Clarity, see Decision D1)
**Written:** 2026-08-20, from devcp
**Status:** design agreed, not started
**Author note:** every fact in "Verified state" was executed on devcp against the live Clarity
checkout on 2026-08-20. Nothing in that section is read from documentation. Effort estimates are
judgement and are labelled as such.

---

## 1. What this builds

An HTTP service and a single page that answer one question: **which of the 60 Clarity worktrees
needs the operator right now.**

Today that question cannot be answered without opening 60 terminals. The state model that answers
it per lane already exists, is tested, and runs in 0.32 seconds. What has never been written is
anything that serves it over HTTP.

The service is **read-only and observes only**. It never dispatches, never resumes, never deploys.

---

## 2. Verified state, before you write anything

Run these first on your machine to confirm the same baseline. Paths are relative to the super-gsd
repo root.

```bash
node tools/cockpit-state/run-self-test.cjs
# expected: Self-test: 19/19 passed
```

| Fact | Value | How it was checked |
|---|---|---|
| Snapshot builder | `tools/cockpit-state/adapter.cjs` | Executed |
| Public API | `buildSnapshot`, `selfTest`, `_internals`, `EVENT_TYPES`, `SECTION_KEYS`, `SCHEMA_VERSION` | `Object.keys(require(...))` |
| `buildSnapshot` arity | 1 (an options object) | `buildSnapshot.length` |
| `SCHEMA_VERSION` | `1` | Executed |
| Sections returned | 12 | `SECTION_KEYS` |
| Build time, one lane | 0.32s real | `time node -e ...` |
| Degradation on live Clarity | `_section_degraded: []` | Executed |
| Self-test | 19/19, includes `A_READ_ONLY_invariant_public_api` | Executed |
| Event contract | frozen v2.4, 16 types | `docs/ORCHESTRATOR-LIVE-EVENTS.md` |
| Event emission in practice | 4 of 60 worktrees; main stream 0 lines | filesystem survey |
| Existing viewers | terminal panes only; `sgsd-dashboard-host.ps1` is PowerShell | filesystem survey |

`SECTION_KEYS`, in order. `resume_command` is contractually last.

```
now, objective, unlock, blockers, agents, codex, gates,
tokens, artifacts, staleness, harness_evolution, resume_command
```

`EVENT_TYPES`, closed vocabulary, frozen.

```
run_started, phase_started, plan_selected, agent_dispatched, agent_progress,
agent_completed, codex_started, codex_completed, gate_started, gate_passed,
gate_warned, gate_failed, token_threshold_crossed, checkpoint_written,
operator_attention_required, run_completed
```

### Snapshot envelope

```js
{
  ok: true,
  schema_version: 1,
  ts: "2026-08-20T18:19:31.052Z",
  data: { /* the 12 sections */ },
  _section_degraded: [],
  _redactions_applied: [ ... ]
}
```

Call it as `buildSnapshot({ projectDir: "/abs/path/to/worktree" })`.

---

## 3. Why this lives in super-gsd and not in Clarity

Four reasons. **D1 is decisive on its own.**

- **D1. Ownership.** Operator ruling of 2026-08-19: anything to do with Project Clarity is JCL's;
  `Berrowj/super-gsd` is Jack's, authored independently of JCL. The cockpit is generic harness
  tooling containing no JCL business logic. Building it in Clarity would transfer a piece of the
  framework to JCL.
- **D2. Cohesion.** `adapter.cjs`, the event contract, the writer, the reader, the hooks and every
  dashboard script are already in `tools/` and `scripts/`. The HTTP layer is the last mile of a
  component otherwise wholly inside SGSD.
- **D3. The 60-copy problem.** If the service lives in the Clarity repo, git produces 60 copies of
  it, one per worktree, each able to see the other 59. Which copy is the server is undefined. That
  is the ambiguity class DLB-15 exists to eliminate. A fleet observer must live outside the thing
  it observes.
- **D4. Distribution already works.** Clarity vendors super-gsd at `/opt/clarity/super-gsd`, pinned
  by `.super-gsd-version`, with no runtime fetch. A cockpit in SGSD is reachable from Clarity
  without creating a build-time dependency on a personal repo, which is the property the ownership
  memo requires.

**Nothing goes on the Clarity side.** Confirmed: only four files under `super-gsd/` are tracked in
the Clarity repo and all four are Clarity-specific systemd units, not framework code.

**Code home is SGSD. Run home is devcp.** The process runs on devcp with `--root` pointed at the
worktree parent. Building it in SGSD does not mean running it there.

---

## 4. Proposed file layout

All new. No existing file is modified in steps 1 and 2.

```
tools/fleet-cockpit/
  server.cjs          HTTP server, zero dependencies, node:http only
  fleet.cjs           worktree discovery + cache + roll-up
  status.cjs          status derivation (section 7) - the only real logic
  public/
    index.html        the page, house theme, no framework
    app.js            fetch + render, no build step
  run-self-test.cjs   mirrors the adapter's self-test style
  fixtures/
    lanes/            captured snapshots for deterministic tests
docs/
  FLEET-COCKPIT.md    operator doc: how to start it, what the colours mean
scripts/
  sgsd-fleet.sh       start/stop wrapper, mirrors sgsd-agent-dashboard.sh conventions
```

### Hard constraints

1. **Zero runtime dependencies.** super-gsd has no root `package.json`. Use `node:http`,
   `node:fs`, `node:path` only. Do not introduce npm, a bundler, or a framework.
2. **CommonJS.** `adapter.cjs` is CJS. Match it. `.cjs` extensions throughout.
3. **Read-only.** No route may write to disk outside the cache directory. No `POST`, `PUT`,
   `PATCH` or `DELETE` handlers exist at all, not even stubs.
4. **ASCII only** in source, matching the adapter's `A_ASCII_only` test.

---

## 5. HTTP contract

Bind to `127.0.0.1:7777` by default. `--host 0.0.0.0` is opt-in for LAN and phone access.

### `GET /api/fleet`

The roll-up. One row per lane, cheap enough to poll.

```json
{
  "ok": true,
  "schema_version": 1,
  "ts": "2026-08-20T18:19:31.052Z",
  "root": "/home/jackberrow/.config/superpowers/worktrees/project-clarity-erp",
  "cache_age_seconds": 4,
  "counts": { "attention": 3, "running": 6, "stale": 12, "idle": 39 },
  "lanes": [
    {
      "name": "sales-page",
      "path": "/home/.../worktrees/project-clarity-erp/sales-page",
      "branch": "feat/sales-page",
      "status": "attention",
      "headline": "gate failed: ATC",
      "phase": "v32-04",
      "phase_name": "Sales Page",
      "last_activity_ts": "2026-08-20T18:04:17.524Z",
      "age_minutes": 15,
      "conflict": false,
      "degraded": []
    }
  ]
}
```

### `GET /api/lane/:name`

The full 12 sections for one lane, plus derived status.

```json
{
  "ok": true,
  "name": "sales-page",
  "status": "attention",
  "reasons": ["gate_failed", "state_projection_conflict"],
  "snapshot": { /* verbatim buildSnapshot output, unmodified */ }
}
```

The `snapshot` value must be the adapter's output **verbatim**. Do not reshape it. Anything derived
goes beside it, never inside it. That keeps the page honest when the adapter's schema moves.

### `GET /api/lane/:name/raw`

`buildSnapshot` output alone, no wrapper. For debugging and for piping into `jq`.

### `GET /healthz`

`{"ok":true,"lanes":60,"cache_age_seconds":4,"build_ms_last":312}`

### Error shape

Never 500 with a stack. A lane that fails to build returns status `error` in the roll-up with the
message on the row, and the rest of the fleet still renders. One broken lane must not blank the
page.

---

## 6. Worktree discovery and caching

### Discovery

```
git -C <root> worktree list --porcelain
```

Run once per cache cycle from any one checkout. Parse `worktree` and `branch` lines. Do not glob
the filesystem: a worktree may be pruned but its directory left behind, and git is the authority on
which are live.

Skip a lane when its directory has no `.planning/`. Report skipped lanes in `/healthz`, do not hide
them.

### Caching, and why it is not optional

0.32 seconds per lane times 60 lanes is roughly **19 seconds serially**. devcp was at load average
9.59 when this was written, against a known practical ceiling around 20 to 25.

- Build on a **timer**, never on request. Default interval 20 seconds, `--interval` to override.
- Serve every request from the in-memory cache. A request never triggers a build.
- Build lanes with bounded concurrency, 4 at a time, not all 60 at once.
- Stagger: on first start, build the roll-up fields for all lanes before building any full
  snapshots, so the page paints fast and fills in.
- Expose `cache_age_seconds` on every response so the page can show it and the operator can tell
  stale data from live data.

If the box is under load, degrade the interval rather than the correctness. A 60-second-old fleet
view is useful. A view that flattens devcp is not.

---

## 7. Status derivation, the only real design work

This is the part that does not exist anywhere yet and is the reason the page is worth building.
Everything else is plumbing.

Four states. Precedence is top to bottom: the first rule that matches wins.

| Status | Colour | Rule | Source fields |
|---|---|---|---|
| `attention` | red | any gate with a `failed` verdict, OR an `operator_attention_required` event unresolved, OR `blockers.count > 0`, OR a checkpoint written with no subsequent `run_started` | `gates.latest_per_gate`, `blockers.count`, live events |
| `running` | teal | `codex.live_state === "ok"` and `codex.live_json_age_seconds < codex.stale_threshold_seconds`, OR an `agent_dispatched` with no matching `agent_completed` | `codex.live_state`, `codex.live_json_age_seconds`, `agents` |
| `stale` | amber | `staleness.state_md.stale === true`, OR last activity older than a threshold (default 24h), OR `codex.live_state === "stale"` | `staleness`, `now.ts` |
| `idle` | green | none of the above | fallback |

`reasons` is an array of machine-readable codes, not prose. The page turns them into sentences.
Never invent a status the adapter cannot justify.

### Known noise you must filter

Observed on the live checkout, all of it real:

1. **`agents.by_phase.unknown` includes bare tool names.** The roster picked up `Bash` and
   `SendUserFile` from `legacy_ledger.activity-log` as if they were agents. Filter the roster to
   entries with a non-null `model` or a recognised agent name, otherwise the page lists `Bash` as
   an agent and looks broken.
2. **`tokens.source === "absent"`** and `tokens.total_tokens === 0` on a lane with no token log.
   Render "no data", never "0 tokens spent". They are different claims.
3. **`gates.gates` is `[]` with `live_event_count: 0`** because emission is nearly dark. Same rule:
   "no gate data" is not "all gates passed". This distinction is the whole point of the page and
   getting it wrong makes the cockpit actively dangerous.
4. **`artifacts.source === "phases_dir_missing"`** on some lanes. Show the reason, not an empty
   list.

### The state conflict, which must be rendered and not resolved

`objective` on the live Clarity checkout currently returns:

```json
{
  "milestone": "v2.0",
  "phase": "156",
  "source": "phase_folders",
  "state_md_milestone": "v3.0",
  "state_md_phase": null,
  "projection_stale": true,
  "effective_confidence": 0.7
}
```

Meanwhile the SessionStart hook reports milestone `v3.2`, phase `v32-03`. **Three sources
disagree.** The adapter is behaving correctly here: it surfaces both its own answer and STATE.md's,
flags `projection_stale`, and attaches a confidence.

**Requirement:** when `projection_stale` is true, the lane row sets `conflict: true` and the detail
view shows both values side by side with the confidence. The cockpit must never pick one silently.
A dashboard that hides a disagreement is worse than no dashboard.

There is a standing defect report at `reports/sgsd-state-model-defect-report.md` covering the state
model. Read it before assuming the three-way disagreement is a bug in your code.

---

## 8. The page

Single HTML file plus one JS file. No framework, no build step, no font links. It must open from
`file://` for debugging as well as over HTTP.

### Layout

Three columns. A wireframe render exists at
`http://192.168.90.247:9100/architecture/2026-08-20-fleet-cockpit-design.html#screen`.

- **Left rail, fixed width.** Every lane, one row each: status dot, lane name, one-line headline,
  age. Sorted `attention` first, then `running`, then `stale`, then `idle`. Within a group, most
  recent activity first. This rail is the product. Everything else is detail.
- **Centre.** The 12 sections as tiles for the selected lane. `now`, `objective`, `blockers`,
  `gates`, `tokens`, `staleness` get real tiles. The remainder collapse into a secondary list.
  `resume_command` renders as a copyable line, **not** a button that runs anything.
- **Right.** Reserved for the Omnigent session embed in a later step. Until then it shows the raw
  snapshot JSON in a `<pre>`, which is genuinely useful during development.

### Theme

Reuse the SGSD cool house palette so it matches the explainers.

```
paper #f6f7f8   ink #202629   muted #647076   line #d8dee1   panel #ffffff
teal #147a74 (primary)   blue #315f90   amber #b27622   green #4f7f45
red #aa4a43   violet #6a5b8f
```

Status dots: red `attention`, teal `running`, amber `stale`, green `idle`. Fonts are system stacks
declared inline, Segoe UI for names and Cascadia Mono for technical values. No remote assets at all.

### Behaviour

- Poll `/api/fleet` every 5 seconds. Fetch `/api/lane/:name` only on selection.
- Show `cache_age_seconds` in the header at all times.
- If a fetch fails, keep the last good render and show a banner. Never blank the page.
- Deep link by lane: `#/lane/sales-page`.

---

## 9. Build order and acceptance

### Step 1: fleet service

Estimated half a day. Judgement, not measured.

Acceptance:
- [ ] `node tools/fleet-cockpit/server.cjs --root <worktrees dir>` starts and binds 127.0.0.1:7777
- [ ] `/api/fleet` returns every lane git reports, with a status on each
- [ ] `/api/lane/:name` returns the adapter output verbatim under `snapshot`
- [ ] Killing one lane's `.planning/` does not break the other 59
- [ ] Cache age is visible on every response and no request triggers a build
- [ ] Load average on devcp does not rise by more than 1.0 with the service running
- [ ] Zero npm dependencies added

### Step 2: the page

Estimated one day. Judgement.

Acceptance:
- [ ] Left rail lists all lanes, sorted by the precedence in section 7
- [ ] A lane with a failed gate shows red, and the reason is readable without clicking
- [ ] "No data" and "zero" are visually distinct everywhere they can occur
- [ ] A lane with `projection_stale` shows both milestone values and the confidence
- [ ] Usable on a phone over the LAN
- [ ] Renders with no network access beyond the service itself

**Stop here and evaluate.** Steps 1 and 2 have no external dependency and are worth having whether
or not Omnigent is ever adopted.

### Step 3: Omnigent on the session plane

Estimated half a day, plus install. Prerequisite: prove a sandboxed agent actually writes a file.
`bwrap` 0.6.1 is installed on devcp but the Codex executor has been observed running through
bubblewrap, exiting clean, and writing nothing. Do not build on that assumption.

Acceptance:
- [ ] One agent runs under Omnigent and a file it created exists afterwards
- [ ] A lane row deep-links into the Omnigent session view
- [ ] A share link is viewable by a second person

### Step 4: event emission everywhere

The stream reaches 4 of 60 worktrees. Wiring the existing hooks into every lane upgrades the page
from a refreshing snapshot to a live feed, and lights up the `gates` and `tokens` tiles that are
currently empty.

Worth doing. Not worth blocking on, because section 2 proves the snapshot works with an empty
stream.

---

## 10. Non-goals, stated so they do not creep in

- **No deploy control.** No route, no button, no menu item, ever. `run-deploy.sh` keeps its flock
  and stays entirely off this surface. The cockpit observes, it does not ship.
- **No dispatch.** `resume_command` is text to copy, not an action to trigger.
- **No writes to any worktree.** The adapter's own read-only invariant test is the floor, not the
  ceiling.
- **No auth in steps 1 and 2.** Bind to localhost by default. If it goes on the LAN, that is a
  deliberate flag, and anything beyond the LAN needs a real decision first.
- **No replacement of SGSD orchestration.** This is a window onto the existing engine, not a new
  one.
- **No Clarity-specific logic.** If a rule only makes sense for Clarity, it belongs in config, not
  in `status.cjs`.

---

## 11. Open questions for the operator

- **Q1.** ~~Where should the super-gsd git checkout live?~~ **Resolved 2026-08-20.** The canonical
  source checkout is `~/.claude/super-gsd/source` on devcp: a real git repo, on `master`, clean,
  `origin = git@github.com:Berrowj/super-gsd.git`, HEAD `ffde8701`. An earlier note in this document
  claimed no checkout existed on devcp; that was wrong, caused by a directory scan that only matched
  folders literally named `super-gsd`. Work can happen there or on the local machine.
- **Q2.** Confirm the push path before code is written or after? SSH to super-gsd is a read-only
  deploy key, so pushes go over gh HTTPS, and `sgsd-update` must be run from the worktree rather
  than the source.
- **Q6.** `sgsd-update` currently fails at the project-integration step, exit 5. Two hook
  distribution defects filed on 2026-08-13 are still unfixed upstream, and the new P160 registration
  guard now refuses to complete while dead registrations exist. Details in section 13. Fix that
  before or alongside this work, since it is the same repo.
- **Q3.** LAN binding from the start, or localhost only until it has proven itself? Phone access is
  the original motivation, which argues for LAN early, but it puts an unauthenticated view of all
  60 lanes on the network.
- **Q4.** Default cache interval. 20 seconds is proposed. Faster costs devcp load, slower costs
  freshness.
- **Q5.** Is the three-way state disagreement in section 7 a known defect with an owner, or does
  this work surface it for the first time?

---

## 12. First commands

```bash
# 1. confirm the baseline
node tools/cockpit-state/run-self-test.cjs

# 2. see what a snapshot actually looks like
node -e "console.log(JSON.stringify(
  require('./tools/cockpit-state/adapter.cjs').buildSnapshot({projectDir: process.argv[1]}),
  null, 2))" /path/to/a/worktree | head -100

# 3. enumerate the lanes
git -C /path/to/any/clarity/checkout worktree list --porcelain

# 4. time one build, because the cache design depends on it
time node -e "require('./tools/cockpit-state/adapter.cjs').buildSnapshot({projectDir: process.argv[1]})" /path/to/a/worktree
```

Start with step 1 acceptance criteria in front of you. The adapter is done, tested and fast. This
is a wrapper, and the discipline is in refusing to let it become anything more.

---

## 13. Blocking side issue: sgsd-update fails on this project

Recorded 2026-08-20 while preparing this handover. Not caused by the cockpit work, but it is in the
same repo and it will be in your way.

### What happened

```
bash ~/.claude/super-gsd/scripts/sgsd-update.sh
```

- Source was already clean and at `origin/master` (`ffde8701`). No fast-forward needed.
- **Global install succeeded.** 12 hooks, 60 scripts, templates, workflows, launcher at
  `~/.local/bin/sgsd`.
- **Project integration failed, exit 5**, at repo-local hook registration:

```
ERROR: hook_registration_missing .../super-gsd/hooks/sgsd-session-start.js      [SessionStart/session-start-governance]
       hook_registration_missing .../super-gsd/hooks/sgsd-intent-classifier.cjs [UserPromptSubmit/user-prompt-intent-classifier]
       hook_registration_missing .../super-gsd/tools/codex-hooks/block-secret-leak.cjs [UserPromptSubmit/user-prompt-secret-leak-guard]
       hook_registration_missing .../super-gsd/hooks/sgsd-quality-gate.js       [PostToolUse/post-tool-use-quality-gate]
```

`.super-gsd-version` was correctly left at `0657c688` rather than advanced to `ffde8701`, which is
the documented failure behaviour.

### Root cause, already documented

`reports/sgsd/2026-08-13-hook-distribution-defects.md` in the Clarity repo diagnosed this. Both
defects are still live, verified today:

| Defect | Claim | Verified 2026-08-20 |
|---|---|---|
| 1 | Installer's hook glob excludes `.cjs` | `~/.claude/hooks/` holds 23 files, **zero** of them `.cjs`. `sgsd-intent-classifier.cjs` and `sgsd-commit-gate.cjs` absent. |
| 2 | `settings-overlay.json` omits shipped hooks | **9 of 14** shipped hooks registered globally. Unregistered: `sgsd-commit-gate.cjs`, `sgsd-intent-classifier.cjs`, `sgsd-quality-gate.js`, `sgsd-session-start.js`, `sgsd-statusline.js`. |

Separately, Clarity's `.claude/settings.json` carries three `sgsd_managed` registrations pointing at
`/opt/clarity/project-clarity-erp/super-gsd/hooks/`. That directory has only ever contained
`systemd/`. The installer now wants a fourth. The P160 guard is doing its job by refusing to
complete while those cannot resolve.

### Do not "fix" it by deleting the registrations yet

The 2026-08-13 report is explicit: remove the dead per-project entries only once global registration
is confirmed live, otherwise the project is left with no coverage at all. Global coverage is **not**
live, so removal now is the wrong order.

### Impact worth stating plainly

`sgsd-quality-gate.js` (PostToolUse) and `sgsd-commit-gate.cjs` are the two surfaces that inspect
work as it is produced. Per the 2026-08-13 report neither has ever run in this project. A hook is
only working when it is **copied and registered**. File presence alone proves nothing.

### Suggested order

1. Fix defect 1, the `.cjs` glob in `install.sh`.
2. Fix defect 2, add the five missing hooks to `settings-overlay.json`.
3. Re-run `sgsd-update` and re-run the verification snippet in the 2026-08-13 report.
4. Only then remove the dead per-project registrations from Clarity's `.claude/settings.json`.
5. Then start section 9 step 1.

# P163 planning task — author 163-01-PLAN-LOCKED.md

You are the planner. You WRITE the plan file and VALIDATE it yourself. No source
changes. Node works; no claude spawning (EPERM).

## Read first

1. `.planning/milestones/v3.8-fleet-cockpit/phases/163-fleet-page/CONTEXT.md` —
   authoritative scope (three-column layout, house palette verbatim, behaviour,
   step-2 acceptance checklist, HARD STOP after this phase).
2. `.planning/milestones/v3.8-fleet-cockpit/HANDOVER.md` sections 8 and 9
   step 2 — the design source.
3. `super-gsd/tools/fleet-cockpit/server.cjs` + `status.cjs` (COMMITTED) — the
   API the page consumes: /api/fleet roll-up shape, /api/lane/:name
   {ok,name,status,reasons,snapshot}, cache_age_seconds, error shape.
4. `super-gsd/tools/fleet-cockpit/fixtures/lanes/` — the fixture snapshots the
   page tests render against.
5. `super-gsd/templates/plan-schema-v2.json`; P162's plan as house style.

## Plan shape guidance

Likely 2 tasks: (T1) public/index.html + public/app.js (no framework, no build,
no remote assets, opens from file:// AND over HTTP; house palette + system font
stacks inline; left rail sorted attention/running/stale/idle then recency;
centre tiles for now/objective/blockers/gates/tokens/staleness, rest collapsed;
resume_command copyable NEVER a button; right rail raw JSON pre; poll 5s;
cache_age always visible; failed fetch keeps last render + banner; deep link
#/lane/:name); (T2) page test cases in run-self-test.cjs: serve the real
server over an ephemeral port with fixture lanes and assert the page's DATA
CONTRACT via the same endpoints (no browser on this box — the DOM behaviours
that need a browser become STRUCTURAL assertions on the HTML/JS source: palette
tokens present, no external URLs, no framework requires, sort comparator unit-
tested by extracting it, no-data vs zero rendering strings distinct, conflict
branch renders both values) plus a file:// well-formedness check. The step-2
items needing a human or phone (usable on phone over LAN) become documented
manual checks in docs/FLEET-COCKPIT.md, listed as such — never faked.

Hard constraints binding as violations: no framework, no build step, no remote
assets, ASCII, resume_command never executable.

## Validate before you finish

    node super-gsd/tools/plan-schema/validate.cjs \
      --plan-file .planning/milestones/v3.8-fleet-cockpit/phases/163-fleet-page/163-01-PLAN-LOCKED.md \
      --project-dir . --mode write

Exit 0 required. Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.

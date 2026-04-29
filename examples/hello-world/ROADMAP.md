---
project: hello-world
schema_version: 1
roadmap_kind: example-fixture
total_milestones: 1
total_phases: 2
created_at: 2026-04-29
phase_origin: 60-example-project-demo
---

# hello-world - Example Roadmap

Fictional demo roadmap for the SGSD new-project wizard fixture.
This is a minimal 2-phase plan illustrating how a real project's
ROADMAP.md is structured. The operator never executes these
phases; they exist only as a shape demonstration.

## Milestone H1 - Greeting (queued)

A single milestone shipping a one-call greeting service. Two
phases, both single-dispatch, both autonomous.

### Phase 01 - Greeting Core

**Goal**: A pure function `greet(name)` returning the string
`Hello, <name>`. No I/O, no side effects, single export.

**Single dispatch**:
- Create `src/greet.js` with one exported function.
- Self-test: `greet('world') === 'Hello, world'`.
- Self-test: `greet('') === 'Hello, '` (no special-case).
- Self-test: ASCII-only verification.

**Acceptance**: `node -e "console.log(require('./src/greet.js').greet('world'))"` prints `Hello, world` and exits 0.

### Phase 02 - Greeting CLI

**Goal**: A thin CLI shell `bin/hello.js` that wraps `src/greet.js`
and prints the result of `greet(process.argv[2] || 'world')`.

**Single dispatch**:
- Create `bin/hello.js` that requires `src/greet.js`.
- Wire `process.exit(0)` on success, `1` on missing greet().
- Self-test: spawnSync `node bin/hello.js Alice` -> stdout `Hello, Alice\n` exit 0.
- Self-test: spawnSync `node bin/hello.js` -> stdout `Hello, world\n` exit 0.

**Acceptance**: `node bin/hello.js demo` prints `Hello, demo` and exits 0.

## Phase order (frozen)

| Phase | Name           | Status | Depends_on |
| ----- | -------------- | ------ | ---------- |
| 01    | Greeting Core  | queued | -          |
| 02    | Greeting CLI   | queued | 01         |

## Notes for the SGSD operator

- This roadmap is illustrative. The fixture ships only the
  scaffolding files (PROJECT.md, ROADMAP.md, STATE.md skeleton).
  The phases above are NOT executed; they exist as a shape
  reference for the wizard to read frontmatter from when it
  validates the planning directory.
- The wizard's `runWizard` function only reads `.planning/`
  directory existence; it does NOT parse this roadmap. The file
  is here purely so the demo project resembles a real one.

# Overwatcher Port — Pi Extension → Super GSD

## What Overwatcher Does

A railway-signal-metaphor visualization tool that:
1. **Scans** the project architecture (graph of milestones/phases/tasks/files)
2. **Analyzes** for issues (collisions, dead ends, overlaps, bottleneck chains)
3. **Renders** an interactive multi-tab HTML signal map on localhost
4. **Live-reloads** when project state changes

## Original Architecture (Pi Extension)

```
index.ts (Pi ExtensionAPI)
  → lib/scanner/           # reads .gsd/gsd.db via better-sqlite3
    ├── gsd-reader.js       # SQLite → GraphModel (nodes + edges)
    ├── codebase-scanner.js # File system → file nodes
    ├── doc-parser.js       # Markdown → structured data
    └── graph-model.js      # Node/Edge type definitions
  → lib/analysis/          # detects issues in the graph
    ├── collision-detector.js    # Multi-writer resource conflicts
    ├── dead-end-detector.js     # Unreachable/terminal nodes
    ├── overlap-detector.js      # Overlapping work
    └── parallelism-detector.js  # Parallel opportunities + bottlenecks
  → lib/architecture/     # infers high-level structure
    ├── inference-engine.js     # Graph → ArchitectureModel
    └── config-parser.js        # overwatcher.json overrides
  → lib/renderer/          # produces interactive HTML
    ├── svg-generator.js        # Nodes → SVG (railway signals)
    ├── layout-engine.js        # Positioning algorithm
    ├── side-panel.js           # Detail panels
    └── multi-tab-assembler.js  # Combines into multi-tab page
  → lib/server/            # serves the visualization
    ├── http-server.js          # localhost HTTP server
    ├── command-handler.js      # start/stop/status lifecycle
    └── event-hooks.js          # Live reload on changes
```

## What Changes for Super GSD

### Data Source: `.planning/` markdown instead of `.gsd/gsd.db`

The core change: replace `gsd-reader.js` (SQLite reader) with a markdown reader
that builds the same GraphModel from `.planning/` files.

| Pi (gsd-reader.js) | Super GSD (planning-reader.js) |
|---------------------|-------------------------------|
| `milestones` table → milestone nodes | `ROADMAP.md` phase list → phase nodes |
| `slices` table → slice nodes | Phase directories → plan groups |
| `tasks` table → task nodes | `*-PLAN.md` files → task nodes |
| `decisions` table → decision nodes | `.planning/decisions/DLB-*.md` → decision nodes |
| `requirements` table → requirement nodes | `REQUIREMENTS.md` entries → requirement nodes |
| `verification_evidence` → quality gates | `*-VERIFICATION.md` → verification data |
| Hierarchy edges (milestone→slice→task) | Hierarchy: milestone→phase→plan→task |
| Task `key_files` → file nodes + edges | SUMMARY.md `key-files` → file nodes + edges |
| `slice_dependencies` → dependency edges | PLAN.md `depends_on` → dependency edges |

### Activation: Claude Code Skill instead of Pi Command

| Pi | Super GSD |
|----|-----------|
| `/overwatcher start` (Pi command) | `/gsd-overwatcher start` (Claude Code skill) |
| `overwatcher_scan` (Pi tool) | Agent call or manual scan |
| Pi `event_hooks` for live reload | File watcher or manual trigger |

### Rendering: Unchanged

The SVG renderer, layout engine, and multi-tab assembler are pure functions.
They take a GraphModel + ArchitectureModel and produce HTML. No Pi dependency.
These can be reused as-is.

### Analysis: Unchanged

All 4 detectors (collision, dead-end, overlap, parallelism) operate on the
GraphModel. No Pi dependency. Reuse as-is once the reader produces the right shape.

## Implementation Plan

### Step 1: Create planning-reader.js

New file that replaces gsd-reader.js. Reads `.planning/` directory and produces
the same GraphModel interface:

```typescript
interface GraphModel {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  summary: GraphSummary;
}

interface GraphNode {
  id: string;
  type: 'milestone' | 'phase' | 'plan' | 'task' | 'file' | 'decision' | 'requirement';
  label: string;
  status: 'active' | 'complete' | 'pending' | 'blocked';
  metadata: Record<string, any>;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'hierarchy' | 'dependency' | 'writes_to' | 'reads_from' | 'implements';
}
```

Reading strategy:
1. Parse ROADMAP.md for milestone + phase list (with `[x]`/`[ ]` status)
2. Scan `phases/NN-*/` directories for phase metadata
3. Parse each `*-PLAN.md` for tasks, dependencies, files
4. Parse each `*-SUMMARY.md` for completion data, file changes
5. Parse each `*-VERIFICATION.md` for quality data
6. Parse `decisions/DLB-*.md` for deliberation data
7. Parse `REQUIREMENTS.md` for requirement nodes

### Step 2: Create /gsd-overwatcher skill

Skill that:
1. Runs the scanner (planning-reader.js)
2. Runs analysis (collision/dead-end/overlap/parallelism detectors)
3. Runs architecture inference
4. Assembles multi-tab HTML
5. Writes to `.planning/overwatcher/signal-map.html`
6. Opens in browser (or reports path)

### Step 3: Create /gsd-signal-map skill

Lightweight skill that just opens the last-generated signal map in the browser.
No re-scan — just opens the file.

### Step 4: Wire into orchestrate loop (optional)

After each phase completion, auto-trigger a re-scan so the signal map stays current.
Add to Step 10 of the orchestrate loop:

```
IF config.overwatcher.auto_scan == true:
  Run planning-reader → analyse → render → write HTML
```

## File Reuse from Pi Extension

These files can be copied verbatim (no Pi dependency):
- `lib/analysis/collision-detector.js`
- `lib/analysis/dead-end-detector.js`
- `lib/analysis/overlap-detector.js`
- `lib/analysis/parallelism-detector.js`
- `lib/analysis/index.js`
- `lib/renderer/svg-generator.js`
- `lib/renderer/layout-engine.js`
- `lib/renderer/side-panel.js`
- `lib/renderer/multi-tab-assembler.js`
- `lib/architecture/inference-engine.js`
- `lib/architecture/config-parser.js`
- `lib/server/http-server.js`

Files that need rewriting:
- `lib/scanner/gsd-reader.js` → `planning-reader.js` (new data source)
- `index.ts` → skill definition (new activation)
- `lib/server/command-handler.js` → simplified (no Pi context)
- `lib/server/event-hooks.js` → file watcher instead of Pi hooks

## Token Cost

Overwatcher runs outside the auto loop — it's a visualization tool, not an agent.
Token cost: ~200 tokens to invoke the skill (read/write/bash commands).
No sub-agents spawned. No model routing needed.

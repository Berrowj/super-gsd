# Phase 6 Context: Overwatcher and Monitoring

## Goal

Users can visualize project health via an interactive signal map and have a spec for live dashboard monitoring.

## What Exists

- `super-gsd/overwatcher/overwatcher-launcher.js` — renders HTML signal map from .planning/ via planning-reader.js
- `super-gsd/overwatcher/planning-reader.js` — reads .planning/ into GraphModel (nodes, edges, summary)
- `.planning/overwatcher/signal-map.html` — already generated (32 nodes, 32 edges, tested 2026-04-09)
- `super-gsd/workflows/mission-control.md` — dashboard spec with bash scripts and tmux launch command
- `super-gsd/skills/gsd-overwatcher/SKILL.md` — scan/start/status/open commands

## Requirements

- VIS-01: Overwatcher scans .planning/ and renders HTML with phase grid, collisions, dependencies
- VIS-02: Signal map shows phase progress, plan status, file collisions, decision log
- VIS-03: Mission Control dashboard spec exists for tmux monitoring (10s refresh)

## What to Build

One plan: validate VIS-01+VIS-02 against the existing HTML, validate VIS-03 against mission-control.md, create VERIFICATION.md.

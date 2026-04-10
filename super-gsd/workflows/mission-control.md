# Mission Control Dashboard — Super GSD Integration

The tmux-based dashboard that runs in a separate terminal window.
Read-only monitoring of orchestrator progress, ATC quality log, and signal map.

## Layout

```
┌─────────────────────────────────┐    ┌──────────────────────────────┐
│         WARP TERMINAL           │    │    WINDOWS TERMINAL          │
│  (interactive — you work here)  │    │  (read-only monitoring)      │
│                                 │    │  ╔══════════════════════╗    │
│  Claude Code + Super GSD        │    │  ║ Mission Control      ║    │
│  /sgsd-orchestrate go            │    │  ║ • phase progress     ║    │
│                                 │    │  ║ • token spend        ║    │
│                                 │    │  ║ • model breakdown    ║    │
│                                 │    │  ╠══════════════════════╣    │
│                                 │    │  ║ ATC Log              ║    │
│                                 │    │  ║ • commit tier feed   ║    │
│                                 │    │  ║ • quality gate pass  ║    │
│                                 │    │  ╚══════════════════════╝    │
└─────────────────────────────────┘    └──────────────────────────────┘
```

## What Dashboard Reads

The dashboard watches files that the orchestrator writes:

| File | What It Shows | Update Frequency |
|------|--------------|-----------------|
| `.planning/STATE.md` | Active milestone, phase, progress | Every loop iteration |
| `.planning/ROADMAP.md` | Phase list with `[x]`/`[ ]` | Every phase transition |
| `.planning/metrics/token-log.jsonl` | Token spend per unit | Every loop iteration |
| `git log --oneline -10` | Recent commits | Every commit |
| `.planning/ORCHESTRATOR-CHECKPOINT.md` | Checkpoint status | When written |
| `.planning/overwatcher/signal-map.html` | Last scan timestamp | After phase completion |

## Dashboard Script

The dashboard script reads these files on a 10-second refresh cycle.
It's a bash script that runs in a tmux pane.

### Key Metrics Displayed

```
╔══════════════════════════════════════════════╗
║  SUPER GSD MISSION CONTROL                    ║
╠══════════════════════════════════════════════╣
║                                                ║
║  Milestone: v1.5                               ║
║  Phase: 27/35 ████████████░░░░ 77%             ║
║  Current: Phase 28 — Pipeline Price Wiring     ║
║  State: executing (plan 28-02)                 ║
║                                                ║
║  Session Tokens:                               ║
║    Opus:   2,400  (orchestrator)               ║
║    Sonnet: 18,200 (12 agent calls)             ║
║    Haiku:  600    (24 classifications)         ║
║    Total:  21,200 (~$0.85 est)                 ║
║                                                ║
║  Last 5 Commits:                               ║
║    a1b2c3 feat(28-01): auth middleware         ║
║    d4e5f6 feat(28-02): JWT refresh flow        ║
║    g7h8i9 docs(27): phase 27 complete          ║
║                                                ║
║  ByteRover: 45 knowledge files | 12 scripts    ║
║  Signal Map: last scan 3m ago                  ║
║  Checkpoint: none (running)                    ║
║                                                ║
║  Refresh: 10s | Press q to quit                ║
╚══════════════════════════════════════════════╝
```

## Dashboard Implementation

Location: `~/.gsd/tmux/mission-control/super-gsd-dashboard.sh`

```bash
#!/bin/bash
# Super GSD Mission Control Dashboard
# Usage: bash super-gsd-dashboard.sh /path/to/project

PROJECT="$1"
PLANNING="$PROJECT/.planning"

while true; do
  clear

  echo "╔══════════════════════════════════════════════╗"
  echo "║  SUPER GSD MISSION CONTROL                    ║"
  echo "╠══════════════════════════════════════════════╣"

  # State
  if [ -f "$PLANNING/STATE.md" ]; then
    head -30 "$PLANNING/STATE.md" | grep -E "^(milestone|status|phase)" | \
      sed 's/^/║  /'
  fi

  # Progress from ROADMAP
  if [ -f "$PLANNING/ROADMAP.md" ]; then
    TOTAL=$(grep -c '^\- \[' "$PLANNING/ROADMAP.md" 2>/dev/null || echo 0)
    DONE=$(grep -c '^\- \[x\]' "$PLANNING/ROADMAP.md" 2>/dev/null || echo 0)
    if [ "$TOTAL" -gt 0 ]; then
      PCT=$((DONE * 100 / TOTAL))
      echo "║  Progress: $DONE/$TOTAL phases ($PCT%)"
    fi
  fi

  # Token log
  if [ -f "$PLANNING/metrics/token-log.jsonl" ]; then
    echo "║"
    echo "║  Token Usage (this session):"
    tail -20 "$PLANNING/metrics/token-log.jsonl" | \
      node -e "
        let opus=0,sonnet=0,haiku=0;
        require('readline').createInterface({input:process.stdin}).on('line',l=>{
          try{const e=JSON.parse(l);
            if(e.model==='opus')opus+=e.total||0;
            else if(e.model==='sonnet')sonnet+=e.total||0;
            else haiku+=e.total||0;
          }catch{}
        }).on('close',()=>{
          console.log('    Opus:  ',opus);
          console.log('    Sonnet:',sonnet);
          console.log('    Haiku: ',haiku);
          console.log('    Total: ',opus+sonnet+haiku);
        })" 2>/dev/null | sed 's/^/║  /'
  fi

  # Git log
  echo "║"
  echo "║  Recent Commits:"
  cd "$PROJECT" && git log --oneline -5 2>/dev/null | sed 's/^/║    /'

  # Checkpoint
  echo "║"
  if [ -f "$PLANNING/ORCHESTRATOR-CHECKPOINT.md" ]; then
    echo "║  Checkpoint: ACTIVE (paused)"
  else
    echo "║  Checkpoint: none (running)"
  fi

  # Signal map
  if [ -f "$PLANNING/overwatcher/signal-map.html" ]; then
    MTIME=$(stat -c %Y "$PLANNING/overwatcher/signal-map.html" 2>/dev/null || \
            stat -f %m "$PLANNING/overwatcher/signal-map.html" 2>/dev/null)
    NOW=$(date +%s)
    AGO=$(( (NOW - MTIME) / 60 ))
    echo "║  Signal Map: last scan ${AGO}m ago"
  fi

  echo "║"
  echo "║  Refresh: 10s"
  echo "╚══════════════════════════════════════════════╝"

  sleep 10
done
```

## ATC Log Script

Location: `~/.gsd/tmux/mission-control/super-gsd-atc-log.sh`

Tails git log and classifies each commit by ATC tier:

```bash
#!/bin/bash
# ATC Quality Gate Log
PROJECT="$1"
cd "$PROJECT"

echo "ATC Quality Gate Log"
echo "===================="

git log --oneline -20 | while read hash msg; do
  # Count files in commit
  FILES=$(git diff-tree --no-commit-id --name-only -r "$hash" 2>/dev/null | wc -l)
  LINES=$(git diff-tree --no-commit-id -p "$hash" 2>/dev/null | grep -c '^[+-]' || echo 0)

  if [ "$LINES" -lt 10 ] && [ "$FILES" -le 1 ]; then
    TIER="SKIP"
  elif [ "$LINES" -lt 50 ] && [ "$FILES" -le 3 ]; then
    TIER="LITE"
  elif echo "$msg" | grep -qE "architecture|API|dependency|schema"; then
    TIER="GATE"
  else
    TIER="FULL"
  fi

  printf "[%s] %s %s\n" "$TIER" "$hash" "$msg"
done
```

## Launch Command

```bash
# From a separate terminal (Windows Terminal, not Warp):
wsl
bash ~/.gsd/tmux/mission-control/super-gsd-dashboard.sh /mnt/c/Users/jack.berrow/PROJECT_NAME
```

Or via tmux for split panes:
```bash
tmux new-session -s gsd-monitor \; \
  send-keys "bash ~/.gsd/tmux/mission-control/super-gsd-dashboard.sh /mnt/c/Users/jack.berrow/PROJECT" Enter \; \
  split-window -v \; \
  send-keys "bash ~/.gsd/tmux/mission-control/super-gsd-atc-log.sh /mnt/c/Users/jack.berrow/PROJECT" Enter
```

# Technology Stack

**Project:** Super GSD Orchestrator Framework
**Researched:** 2026-04-08
**Confidence:** HIGH (all conclusions drawn from direct inspection of existing codebase)

---

## Baseline — Already Present (DO NOT RE-ADD)

- Node.js >= 20 (confirmed in README)
- Git
- Claude Code Agent SDK (hooks, agents, skills, `/commands`)
- GSD 1.0 (`get-shit-done-cc@latest`, `gsd-tools.cjs`)
- `byterover-cli` (global npm, `brv vc init` + MCP connector)
- All hook scripts: plain Node.js, zero npm dependencies, `fs`/`path`/`os`/`http` only

---

## New Dependencies Needed

### Multi-Model Routing

**No new package required.** Model selection is config-driven (`model-routing.json`). Claude Code's `Agent` tool accepts a `model` parameter. The orchestrator reads the config and passes the model string — no SDK wrapper needed.

### ByteRover Memory

**`byterover-cli` (latest, global install)** — already identified as the dependency.

The local fallback (`brv-query-local.js`) uses zero npm packages and is already authored. It is the primary query path for API-free operation. ByteRover MCP connector exposes `brv-query` / `brv-curate` as tools when the API key is configured; local engine is the default.

No additional packages.

### Local BM25 Search

**No new package.** `brv-query-local.js` implements BM25-style term scoring from scratch using Node.js built-ins. It is already fully implemented (tokenize → IDF-approximated scoring → frontmatter/body weighting → importance/maturity boost). Adding `wink-bm25-text-search` or similar would duplicate this and add a binary dependency with no cross-platform benefit.

**Decision: keep the custom implementation.** It has zero install overhead, deterministic cross-platform behaviour on Windows WSL2/macOS/Linux, and is already integrated.

### Checkpoint-Based Crash Recovery

**No new package.** `gsd-checkpoint-writer.js` already writes `.planning/ORCHESTRATOR-CHECKPOINT.json` on every `git commit`. `gsd-resume` skill reads it to reconstruct state. Both use `fs`/`path` only.

If richer crash recovery is needed (mid-task, not just post-commit), add:

```
nothing — use atomic writes: fs.writeFileSync with temp-file + rename pattern
```

The `rename`-based atomic write is built into Node.js `fs.renameSync`. No package.

### Multi-Tab HTML Signal Map (Overwatcher)

**No new package for generation.** `overwatcher-launcher.js` renders static HTML using template literals — no build step, no bundler, no external renderer. It serves via Node.js built-in `http` module.

The multi-tab assembler (`multi-tab-assembler.js`) is the Pi overwatcher module optionally loaded from `~/.gsd/extensions/overwatcher/lib/`. If that module is being ported into Super GSD proper, it is also plain Node.js (no npm deps based on current architecture).

**If live-reload is desired** (not currently in scope): `chokidar@^3.6.0` — cross-platform file watcher, works on Windows FSEvents/Linux inotify/macOS. Single dependency, zero transitive native deps on Node 20+.

---

## Distribution / Bundle Considerations

Super GSD distributes as a directory of plain `.js` and `.md` files (no `package.json`, no bundling). This is correct and should stay that way because:

1. Hooks run via `node path/to/script.js` — no module resolution needed
2. Skills/agents are markdown — no build
3. The framework installs into `~/.claude/` via `cp` commands in `install.sh`

**Do not introduce a `package.json` or bundler.** If a dependency is unavoidable, instruct users to `npm install -g <pkg>` in the README (same pattern as `byterover-cli`).

---

## What NOT to Add

| Rejected | Why |
|----------|-----|
| `langchain` / `llamaindex` | Heavyweight, LLM-vendor lock, GSD already orchestrates via Claude Code Agent tool |
| `wink-bm25-text-search` | Duplicates existing custom BM25 with no cross-platform gain |
| `better-sqlite3` | Pi overwatcher dep; Super GSD replaced SQLite with markdown files — intentionally |
| `express` / `fastify` | Built-in `http` module sufficient for single-file local server |
| `webpack` / `esbuild` | No bundle step needed; distributes as raw files |
| `dotenv` | No secrets in config; Claude Code OAuth handles auth |

---

## Cross-Platform Notes

All existing hooks use `os.tmpdir()` (not hardcoded `/tmp`), `path.join()` (not string concatenation), and `process.env.HOME || process.env.USERPROFILE` for home dir resolution. This pattern covers Windows WSL2, macOS, and Linux without modification. The `brv-query-local.js` uses the same pattern for context tree discovery.

The overwatcher `--open` flag uses `process.platform` detection (`win32` / `darwin` / else `xdg-open`). This is correct and complete.

**No platform-specific packages needed.**

---

## Sources

- Direct code inspection: `super-gsd/hooks/*.js`, `super-gsd/overwatcher/*.js`, `super-gsd/README.md`, `super-gsd/skills/gsd-brv-setup/SKILL.md`, `.planning/config.json`, `super-gsd/config/model-routing.json`
- Confidence: HIGH — all conclusions from first-party source code, no web search required

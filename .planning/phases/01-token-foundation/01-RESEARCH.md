# Phase 1: Token Foundation and Hook Wiring — Research

**Researched:** 2026-04-08
**Domain:** Node.js hooks, path normalization, atomic file writes, JSONL logging
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D001: Opus for orchestration, Sonnet for execution, Haiku for classification
- D002: Compressed XML plans, target ~800 tokens per plan
- D003: Structured 300-word max reports from all sub-agents
- D004: JSONL append-only log at `.planning/metrics/token-log.jsonl`; estimation word_count * 1.3
- D005: Frontmatter-only reads + ByteRover queries replace full file loads
- D006: No external API keys — everything via Claude Code Max plan OAuth

### Claude's Discretion
None listed. All implementation choices follow locked decisions.

### Deferred Ideas (OUT OF SCOPE)
- ByteRover MCP tools (brv-query, brv-curate) — blocked until ByteRover supports OAuth
- Dynamic model routing per task complexity — Phase 1 uses static routing; Haiku classification comes in Phase 3
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORCH-07 | Token logging to JSONL after every dispatch | Hook exists; needs path normalization + settings.json wiring |
| ORCH-08 | /gsd-token-audit skill for usage analysis | SKILL.md exists; needs smoke test against a populated log |
| ORCH-10 | Handle @file: IPC prefix from gsd-tools.cjs | Pattern found in core.cjs — triggered when JSON > 50KB |
| SAFE-01 | Path normalization in all hooks | 5 hooks need a shared toUnixPath() utility |
| SAFE-02 | Atomic checkpoint writes | gsd-checkpoint-writer.js uses writeFileSync directly — needs tmp+rename |
| SAFE-03 | GSD 1.0 patches use SUPER-GSD-START/END markers | 3 target files confirmed: model-profiles.cjs, config.cjs, agent-contracts.md |
</phase_requirements>

---

## Summary

Phase 1 is a wiring and hardening phase, not a build phase. All five hook files exist in `super-gsd/hooks/`. The token log destination exists (`.planning/metrics/token-log.jsonl`, currently empty). The `settings-overlay.json` has the correct hook registrations written — they just need to be merged into `~/.claude/settings.json`.

The four surgical changes: (1) add a shared `toUnixPath()` function to every hook entry point, (2) upgrade `gsd-checkpoint-writer.js` from direct `writeFileSync` to `tmp+rename`, (3) add `@file:` prefix detection to the orchestrate loop's Bash result handling, and (4) merge `settings-overlay.json` into live `settings.json`. SUPER-GSD patch markers go into three confirmed GSD 1.0 files at `~/.claude/get-shit-done/bin/lib/`.

**Primary recommendation:** Wire hooks first (settings.json merge), then harden paths and atomic writes, then smoke-test token-log.jsonl has entries after an Agent call.

---

## Research Q&A (the four questions from the brief)

### Q1: What gsd-tools.cjs files need SUPER-GSD patches?

**Confirmed** [VERIFIED: filesystem inspection]:

| File | Path | Purpose of Patch |
|------|------|-----------------|
| `model-profiles.cjs` | `~/.claude/get-shit-done/bin/lib/model-profiles.cjs` | Add Super GSD agent roles (orchestrator, classifier, context_selector) |
| `config.cjs` | `~/.claude/get-shit-done/bin/lib/config.cjs` | Route model resolution to Super GSD routing table when present |
| `agent-contracts.md` | `~/.claude/get-shit-done/references/agent-contracts.md` | Register new completion markers: gsd-orchestrate, gsd-classifier, gsd-context-selector |

All three files exist. `model-profiles.cjs` currently has 17 GSD 1.0 agents; it has no Super GSD orchestrator or classifier entries. `agent-contracts.md` has no entry for `gsd-orchestrate`. Patches must be wrapped in `// SUPER-GSD-START` / `// SUPER-GSD-END` markers (code files) or `<!-- SUPER-GSD-START -->` / `<!-- SUPER-GSD-END -->` (markdown). Markers make the addition idempotent — install.sh can detect presence before patching.

### Q2: How does the @file: IPC pattern work?

**Confirmed** [VERIFIED: core.cjs lines 183-190]:

`gsd-tools.cjs` outputs JSON directly unless the serialized payload exceeds **50,000 bytes**. When it does, it writes to a temp file at `os.tmpdir()/gsd-{timestamp}.json` and outputs only the string `@file:/path/to/file`. The `--pick` flag handler in `gsd-tools.cjs` (line 336) already handles `@file:` by reading the temp file before field extraction.

**The gap:** The orchestrate skill reads `INIT=$(node gsd-tools.cjs init phase-op N)` via Bash. If `init` ever returns >50KB (unlikely for init but possible for `roadmap analyze` or `history-digest`), the Bash output is just `@file:/tmp/gsd-1234.json`. If the skill doesn't check for this prefix, it will attempt to `JSON.parse` a file path string and fail silently. The fix is a two-line guard at every Bash result capture point:

```bash
INIT=$(node "$GSD_TOOLS" init phase-op "$PHASE")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

This pattern is already documented in the orchestrator's own research flow.

### Q3: What path normalization is needed for Windows WSL2?

**Confirmed** [VERIFIED: hook inspection + PITFALLS.md]:

Claude Code runs on Windows. Hooks run in Node.js via the Windows Node binary (not WSL2). `process.cwd()` returns Windows-format paths (`C:\Users\...`). Node.js `path.join` on Windows inserts backslashes. `fs.appendFileSync` on Windows paths works from Windows Node, but if any hook command is routed through WSL bash, the path breaks.

The actual risk: hooks are registered as `node ~/.claude/hooks/gsd-token-logger.js` in `settings.json`. On Windows, `~` resolves to the Windows home (`C:\Users\user`). The `path.join(process.cwd(), '.planning', 'metrics', 'token-log.jsonl')` in `gsd-token-logger.js` will produce a valid Windows path when Node runs on Windows.

**Specific normalization needed:** `gsd-stuck-detector.js` and `gsd-context-monitor.js` write to `os.tmpdir()` (returns `C:\Users\...\AppData\Local\Temp` on Windows). That works. The real normalization need is in `gsd-session-start.js` and `gsd-checkpoint-writer.js` which call `fs.existsSync(path.join(process.cwd(), ...))`. If `process.cwd()` ever returns a mixed path (e.g. from a WSL-launched Claude session), paths break.

**One utility, applied once per hook:**

```javascript
function toUnixPath(p) {
  // Convert C:\foo\bar -> /mnt/c/foo/bar for WSL contexts
  // Leave Unix paths unchanged
  return p.replace(/^([A-Za-z]):\\/, (_, d) => `/mnt/${d.toLowerCase()}/`)
           .replace(/\\/g, '/');
}
```

Apply at entry: `const cwd = toUnixPath(process.cwd());`. Note: only needed if hooks run via WSL bash. If Claude Code calls hooks via Windows Node directly, `toUnixPath` is a no-op with no harm. Add it defensively to all 5 hooks.

### Q4: What's the best atomic write pattern for Node.js on Windows?

**Confirmed** [VERIFIED: gsd-checkpoint-writer.js + PITFALLS.md]:

Current `gsd-checkpoint-writer.js` uses `fs.writeFileSync(CHECKPOINT_FILE, ...)` directly — no atomicity. On Windows, `fs.rename` (used for atomic tmp-to-target) is atomic when source and destination are on the same drive and not cross-volume. The standard pattern:

```javascript
const tmp = CHECKPOINT_FILE + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(checkpoint, null, 2));
fs.renameSync(tmp, CHECKPOINT_FILE);  // atomic on same volume
```

**Windows caveat:** `fs.renameSync` throws `EXDEV` if source and dest are on different volumes. Since `.tmp` and target are in the same `.planning/` directory, they are always on the same volume. No cross-volume issue. [ASSUMED: Windows rename on same volume is atomic at the filesystem level — NTFS guarantees this for same-directory rename.]

---

## Files: Current State vs Required State

| File | Current State | What Phase 1 Must Do |
|------|--------------|----------------------|
| `hooks/gsd-token-logger.js` | Uses `process.cwd()` directly, no path normalization | Add `toUnixPath(process.cwd())` |
| `hooks/gsd-checkpoint-writer.js` | Direct `writeFileSync`, no atomic write | Add `.tmp` + `renameSync` pattern |
| `hooks/gsd-stuck-detector.js` | Uses `os.tmpdir()` (safe), but `file_path` keys not normalized | Add `toUnixPath()` to extracted `file_path` keys |
| `hooks/gsd-context-monitor.js` | Uses `os.tmpdir()` (safe) | Add `toUnixPath()` defensively |
| `hooks/gsd-session-start.js` | Uses `process.cwd()` for CHECKPOINT_PATH and STATE_PATH | Add `toUnixPath(process.cwd())` |
| `config/settings-overlay.json` | Correct hook registrations written | Merge into `~/.claude/settings.json` |
| `.planning/metrics/token-log.jsonl` | Exists, empty | Will populate once hook is wired |
| `lib/model-profiles.cjs` | 17 GSD 1.0 agents, no Super GSD entries | Add Super GSD roles in SUPER-GSD-START/END block |
| `lib/config.cjs` | GSD 1.0 config resolution | Add routing table awareness in SUPER-GSD-START/END block |
| `references/agent-contracts.md` | No gsd-orchestrate entry | Add orchestrate/classifier/context-selector markers |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Atomic file writes | Custom locking, file locks | `writeFileSync(tmp)` + `renameSync` (POSIX/NTFS atomic) |
| Path normalization | Regex soup per-hook | Single `toUnixPath()` in each hook header |
| Hook registration | Custom hook runner | Claude Code's native `settings.json` hooks system |
| Token estimation | LLM token counter | `word_count * 1.3` (calibrate for code vs prose in Phase 1) |

---

## Common Pitfalls

### Pitfall A: Hook fires but writes to wrong path
**What:** `process.cwd()` in a hook returns the Windows project root with backslashes. `path.join` produces `C:\Users\...\GSDedits\.planning\metrics\token-log.jsonl`. If Claude Code routes hook execution through WSL, the path is invalid.
**Prevention:** `toUnixPath()` at every hook entry. Test by tailing the log after a known Agent call.

### Pitfall B: settings-overlay.json merged but hooks don't fire
**What:** `settings.json` hook format requires exact matcher values. The overlay uses `"matcher": "Agent"` — if Claude Code's internal tool name differs (e.g. lowercase), the hook silently skips.
**Prevention:** Verify by adding a debug `console.log` to gsd-token-logger.js, run one Agent call, check token-log.jsonl for a new entry. Remove debug log after verified.

### Pitfall C: Checkpoint .tmp file left behind on crash
**What:** If the process dies between `writeFileSync(tmp)` and `renameSync`, the `.tmp` file persists. Next run tries to write again and succeeds, but the `.tmp` file accumulates.
**Prevention:** Add cleanup: `if (fs.existsSync(tmp)) fs.unlinkSync(tmp)` at hook entry before writing a new `.tmp`. Two lines.

### Pitfall D: SUPER-GSD patch applied twice
**What:** Running install.sh twice inserts the marker block twice in model-profiles.cjs.
**Prevention:** Install script checks for marker existence before patching: `grep -q "SUPER-GSD-START" "$FILE" || patch_file "$FILE"`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Windows NTFS `fs.renameSync` is atomic on same-volume same-directory rename | Atomic writes | Checkpoint corruption possible; mitigated by .tmp cleanup |
| A2 | Claude Code calls hooks via Windows Node (not WSL bash), so backslash paths are valid | Path normalization | Hook silently writes to wrong path; caught by smoke test |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: filesystem inspection] `~/.claude/get-shit-done/bin/lib/` — confirmed model-profiles.cjs, config.cjs, agent-contracts.md all exist
- [VERIFIED: code inspection] `core.cjs` lines 183-190 — @file: IPC trigger at 50KB threshold
- [VERIFIED: code inspection] `gsd-tools.cjs` line 336 — @file: reader in --pick handler
- [VERIFIED: code inspection] All 5 hook files read directly — current state confirmed

### Secondary (MEDIUM confidence)
- [CITED: PITFALLS.md] Windows path contamination, atomic write requirements, hook timeout budget
- [CITED: SUMMARY.md] SUPER-GSD-START/END marker convention, 4 bounded GSD 1.0 modifications

**Research date:** 2026-04-08
**Valid until:** 2026-05-08 (stable Node.js patterns)

# Domain Pitfalls: Autonomous AI Agent Orchestration

**Domain:** Autonomous orchestration, multi-model routing, file-based memory
**Researched:** 2026-04-08
**Confidence:** HIGH (patterns from production agent systems, well-documented failure modes)

---

## Critical Pitfalls

### Pitfall 1: Context Window Accumulation (Silent OOM)
**What goes wrong:** Each loop iteration appends tool call results, agent reports, and debug output to the running context. At iteration 8-12 on a complex task, the window fills silently — the model starts summarizing instead of acting, drops earlier constraints, and halluccinates completed steps.
**Why it happens:** Orchestrator accumulates: system prompt + history + N agent reports (300w each) + tool outputs. At Opus-level (200K), this looks safe until it isn't. Token *estimation* (word_count * 1.3) is 15-25% off for code-heavy content — real token counts spike.
**Consequences:** Loop completes without delivering anything. Hard to detect because the model never errors.
**Prevention:** Hard limit: 5 reports max in active context. Compress completed reports to one-liner before next iteration. Validate token logger accuracy against real usage in Phase 1, not just at end.
**Detection:** Token log shows >80K tokens injected in a single loop iteration.
**Phase:** Phase 1 (token foundation) must address this — it's load-bearing.

---

### Pitfall 2: Model Routing Mismatch on Ambiguous Tasks
**What goes wrong:** Static routing sends tasks to Haiku that have implicit reasoning requirements (e.g., "classify this change" when the change spans 4 files). Haiku confidently returns a wrong tier classification, Sonnet executes a LITE review instead of FULL, quality gate is silently skipped.
**Why it happens:** D001 uses role-based static routing. Role labels don't capture task complexity.
**Consequences:** Misclassified commits bypass ATC gates. Quality debt accumulates invisibly.
**Prevention:** Add a complexity floor: if files_changed > 3 OR diff_lines > 100, escalate to Sonnet regardless of role. Never trust Haiku classification alone on multi-file changes.
**Detection:** ATC log shows LITE tier on commits with 4+ file changes.
**Phase:** Phase 1 routing wiring + Phase 4 ATC gate must cross-reference this.

---

### Pitfall 3: File-Based Memory Staleness and Index Drift
**What goes wrong:** BM25 index (brv-query-local.js) is built once and not rebuilt when .brv/context-tree/ files are updated by agents. Queries return stale context — outdated decisions, superseded plans — while new files are invisible to the query engine.
**Why it happens:** File writes happen in agent subprocesses; index rebuild requires explicit trigger. Easy to wire the write but forget to trigger the rebuild.
**Consequences:** Orchestrator acts on stale decisions. D001-D006 may be overridden without the orchestrator knowing.
**Prevention:** Every write to .brv/context-tree/ must be followed by `node brv-query-local.js --rebuild`. Make rebuild a post-write hook, not a manual step.
**Detection:** Query returns file with mtime older than the decision it's supposed to represent.
**Phase:** Phase 2 (memory layer) is the natural home. Don't defer to Phase 3.

---

### Pitfall 4: Checkpoint Corruption on Interrupted Write
**What goes wrong:** Checkpoint files (STATE.md, PLAN.md) are written mid-loop when a crash, timeout, or hook failure interrupts the write. The file contains a partial JSON or truncated frontmatter. On restart, the orchestrator reads corrupt state and either panics or silently runs on garbage.
**Why it happens:** Bash writes are not atomic on Windows/WSL2. File system flushes don't guarantee completion before process kill.
**Consequences:** Lost work, duplicate work, or misaligned state between STATE.md and the actual completed tasks.
**Prevention:** Write to a `.tmp` file first, then `mv` (atomic rename on POSIX). Never write directly to STATE.md mid-loop. Validate frontmatter on read — if parse fails, load last-known-good backup.
**Detection:** STATE.md frontmatter fails YAML parse on startup.
**Phase:** Phase 3 (orchestrator engine) checkpoint survival design must enforce atomic writes.

---

### Pitfall 5: Windows Path Contamination
**What goes wrong:** Hooks, scripts, and agent dispatches mix Windows paths (`C:\Users\...`) with WSL2 Unix paths (`/mnt/c/Users/...`). Node.js scripts running in WSL2 receive Windows paths from Claude Code's working directory injection and fail silently or produce wrong file reads.
**Why it happens:** Claude Code runs on Windows; hooks run in WSL2 bash; path conversion is inconsistent across tool invocations.
**Consequences:** brv-query-local.js fails to find index files. Token logger writes to wrong location. Hooks silently no-op.
**Prevention:** Normalize all paths at hook entry point. One utility function: `toUnixPath(p)` that strips drive letters and replaces backslashes. Apply to every path argument before use. Never hardcode `/mnt/c/` — derive from `$USERPROFILE` or `wslpath`.
**Detection:** Hook returns exit 0 but no output file exists at expected path.
**Phase:** Phase 1 hook wiring. Fix before anything else runs on Windows.

---

### Pitfall 6: Hook Timeout Cascade
**What goes wrong:** The `gsd-token-logger.js` PostToolUse hook runs synchronously on every Agent tool call. If it takes >2s (cold Node.js start, large file read), Claude Code may timeout the hook, log an error, and continue — but subsequent hooks in the chain assume the token log was written and read stale or missing data.
**Why it happens:** PostToolUse hooks share a timeout budget. Node.js cold start on WSL2 is 800-1200ms. A single slow hook can eat the entire budget.
**Consequences:** Token tracking gaps. Downstream phases (ATC, Overwatcher) make decisions on incomplete data.
**Prevention:** Keep the token logger to a single `fs.appendFileSync` — no reads, no network, no index operations. Target <200ms. Pre-warm Node if needed. Add a circuit breaker: if hook takes >1.5s, write a stub entry and exit.
**Detection:** Token log has gaps (missing entries for known Agent calls).
**Phase:** Phase 1 hook wiring.

---

### Pitfall 7: Agent Report Format Drift
**What goes wrong:** The efficiency header enforces 300-word structured reports in the prompt, but agents on complex tasks silently exceed the format — adding preamble, skipping required fields (BLOCKERS, DEVIATIONS), or returning prose instead of structured fields. The orchestrator's report parser assumes fixed fields and silently drops the extra content or fails to extract blockers.
**Why it happens:** LLM output format compliance degrades under high context pressure. Longer tasks = more drift.
**Consequences:** Blockers not surfaced to orchestrator. Loop continues past a real blocker. Quality gates not triggered.
**Prevention:** Parse the report with a schema validator before injecting into context. If BLOCKERS or VERIFICATION fields are missing, flag as format violation and re-request once. After two violations, escalate to Opus.
**Detection:** Report parser throws on missing required field.
**Phase:** Phase 1 (report format validation) + Phase 3 (orchestrator synthesis).

---

### Pitfall 8: Autonomous Git Conflicts
**What goes wrong:** Autonomous mode has agents committing directly on the working branch. Two agents (e.g., executor + verifier) both write files and commit in overlapping windows. The second commit creates a merge conflict that halts the loop.
**Why it happens:** Agent dispatches are parallel by default in the orchestrator design. File writes from two agents on the same files = conflict.
**Consequences:** Loop halts mid-phase. Human intervention required. Checkpoint may not have saved pre-conflict state cleanly.
**Prevention:** Serialize all git commits through the orchestrator only — agents write files but never commit. Only the orchestrator calls `git commit` after verifying all agent reports. Single writer, single commit per loop iteration.
**Detection:** `git status` shows merge conflict markers in any tracked file.
**Phase:** Phase 3 (orchestrator engine) — enforce single-committer rule in dispatch design.

---

### Pitfall 9: CEO/Board Debate Deadlock
**What goes wrong:** Multi-agent deliberation systems (CEO/Board) can enter a deadlock when two board members hold contradictory positions and the tiebreaker prompt is ambiguous. The loop waits for consensus that never arrives, or produces a memo that says "further deliberation needed" — which re-triggers the deliberation.
**Why it happens:** Deliberation prompts without explicit termination conditions. Agents optimize for thoroughness, not resolution.
**Consequences:** Token budget consumed by debate with no decision output.
**Prevention:** Hard cap deliberation at 3 rounds. After round 3, CEO makes unilateral decision and logs dissent. Termination condition must be explicit in the board brief template.
**Detection:** Deliberation loop counter exceeds 2.
**Phase:** Phase 5 (deliberation layer) — bake termination into the brief template, not left to emergent behavior.

---

## Moderate Pitfalls

### Pitfall 10: Token Estimation Inaccuracy Compounding
**What goes wrong:** The 1.3x word-count multiplier underestimates code blocks (closer to 1.5-2x) and overestimates prose (closer to 1.1x). Over 20 loop iterations, estimates drift 20-40% from actuals. Budget decisions based on estimates allow the window to fill unexpectedly.
**Prevention:** Calibrate the multiplier separately for code vs prose in Phase 1. Log both estimated and (where available) actual token counts. Flag when cumulative drift exceeds 15%.
**Phase:** Phase 1.

### Pitfall 11: BM25 Cold Query on Sparse Index
**What goes wrong:** brv-query-local.js returns no results on a fresh project (index has <10 documents). Orchestrator treats "no results" as "no relevant context" and proceeds without context — but actually the context just hasn't been indexed yet.
**Prevention:** Distinguish "empty index" from "no match." On empty index, fallback to reading STATE.md directly. Add a minimum-documents check before trusting query results.
**Phase:** Phase 2.

---

## Minor Pitfalls

### Pitfall 12: Oversized Phase Context Files
**What goes wrong:** CONTEXT.md files grow across phases as decisions are added. Reading them injects 3-5K tokens per dispatch instead of the targeted <1K.
**Prevention:** Enforce a 50-line hard limit on CONTEXT.md. Archive older decisions to a separate DECISIONS-ARCHIVE.md.
**Phase:** Phase 2 (memory curation).

### Pitfall 13: Install Script WSL Detection
**What goes wrong:** `install.sh --init-project` on Windows runs in WSL2 but writes paths relative to the WSL home, not the Windows project directory. The project ends up initialized in the wrong location.
**Prevention:** Detect `$WSLENV` and derive Windows project root via `wslpath -w $(pwd)`. Test install on Windows + macOS + Linux in Phase 7.
**Phase:** Phase 7 (integration testing).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: Hook wiring | Windows path contamination + hook timeout | Normalize paths at entry; keep hooks <200ms |
| Phase 1: Model routing | Static routing misclassifies complex tasks | Add complexity floor by file count + diff size |
| Phase 2: Memory layer | Index staleness + sparse index cold queries | Rebuild on write; handle empty-index case |
| Phase 3: Orchestrator loop | Context accumulation + checkpoint corruption | Hard report cap; atomic writes via tmp+mv |
| Phase 3: Git in auto mode | Parallel agent commit conflicts | Single-committer pattern; agents write, orchestrator commits |
| Phase 4: ATC gate | Haiku misclassification bypasses gates | Cross-reference file count floor; never trust Haiku alone |
| Phase 5: Deliberation | Debate deadlock consuming token budget | 3-round hard cap; explicit termination condition in brief |
| Phase 7: Integration | Install path on Windows WSL2 | wslpath detection; test on all three platforms |

---

## Sources

- Confidence: HIGH — based on well-documented LLM agent system failure modes from production systems (LangChain, AutoGen, CrewAI post-mortems), WSL2/Node.js interaction patterns, and atomic write requirements in POSIX environments. No WebSearch available; claims derived from training data on these established patterns.

# SDD Implementer — sgsd-statusline.js stats enhancement

You are a fresh SDD implementer. No inherited context.

## Goal

Add Codex status + phase-progress fields to the statusline bar. Two new render fields, two new helper functions, both inside `super-gsd/hooks/sgsd-statusline.js`.

## New data sources

### A — Milestone phase stats (replaces ROADMAP-based count)

Walk `.planning/milestones/{state.milestone}/phases/*/` directories. For each directory:
- Find `{NN}-VERIFICATION.md` files (any file matching `*VERIFICATION.md`).
- Use `readFrontmatter` (already in file) to read its `status:` field.
- If `status` starts with `PASS` (matches `/^PASS/`), the phase is complete.
- Otherwise the phase is incomplete; the FIRST incomplete phase in directory-listing order is the "current" phase.

Aggregate:
- `total` = number of phase dirs
- `completed` = number of dirs with PASS-status verification
- `current` = first incomplete phase's numeric prefix (extracted via regex `^(\d+(?:\.\d+)?)-` from the dir name), or `null` if all complete.

### B — Codex status (last invocation)

Read `.planning/metrics/codex-executor-log.jsonl`. Tail = last row.

Each row is JSON with at minimum: `ts` (ISO-8601), `exit` (integer), `mode` (string), `phase` (string|number), `duration_ms`.

Extract:
- `exit` — 0 = ok, non-zero = fail
- `ts` — compute `ago` as seconds-since-now
- `mode` — for badge color hint

Return shape: `{ exit, ago, mode }` or `null` if log absent/empty.

## New helper functions (add near top of file, after `readFrontmatter`)

```js
function getMilestonePhaseStats(root, milestone) {
  if (!milestone) return null;
  const phasesDir = path.join(root, '.planning', 'milestones', milestone, 'phases');
  if (!fs.existsSync(phasesDir)) return null;
  let total = 0, completed = 0;
  let current = null;
  let entries;
  try { entries = fs.readdirSync(phasesDir, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    total++;
    const dir = path.join(phasesDir, entry.name);
    let files;
    try { files = fs.readdirSync(dir); } catch { continue; }
    const verifyFile = files.find(f => /VERIFICATION\.md$/i.test(f));
    let isPass = false;
    if (verifyFile) {
      const fm = readFrontmatter(path.join(dir, verifyFile));
      if (fm.status && /^PASS/.test(fm.status)) isPass = true;
    }
    if (isPass) {
      completed++;
    } else if (!current) {
      const m = entry.name.match(/^(\d+(?:\.\d+)?)-/);
      current = m ? m[1] : entry.name;
    }
  }
  return { total, completed, current };
}

function getCodexStatus(root) {
  const logPath = path.join(root, '.planning', 'metrics', 'codex-executor-log.jsonl');
  if (!fs.existsSync(logPath)) return null;
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return null;
    const last = JSON.parse(lines[lines.length - 1]);
    const ts = last.ts ? Date.parse(last.ts) : NaN;
    const ago = isNaN(ts) ? null : Math.max(0, Math.floor((Date.now() - ts) / 1000));
    return { exit: last.exit, ago, mode: last.mode || 'unknown' };
  } catch { return null; }
}

function formatAgo(seconds) {
  if (seconds == null) return '?';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}
```

## Render changes (in `render(data)`)

Find the block that opens with `// Read ROADMAP for progress count` and ends just before `// Session total tokens`. Replace it entirely with:

```js
  // Milestone + phase progress
  const milestone = state.milestone || 'v?';
  const phaseStats = getMilestonePhaseStats(root, milestone);
  if (phaseStats && phaseStats.total > 0) {
    const pct = Math.round((phaseStats.completed / phaseStats.total) * 100);
    const bar = makeBar(pct, 6);
    const currentTag = phaseStats.current ? ` P${phaseStats.current}` : '';
    const progressStr = `${milestone}${currentTag} ${phaseStats.completed}/${phaseStats.total} ${bar} ${pct}%`;
    parts.push(colorByPct(progressStr, pct));
  } else {
    parts.push(`\x1b[33m${milestone}\x1b[0m`);
  }

  // Codex status badge
  const codex = getCodexStatus(root);
  if (codex) {
    const color = codex.exit === 0 ? '\x1b[32m' : '\x1b[31m';
    const label = codex.exit === 0 ? 'codex:ok' : 'codex:fail';
    parts.push(`${color}${label}\x1b[0m \x1b[2m${formatAgo(codex.ago)}\x1b[0m`);
  }
```

Leave the model, session tokens, CHECKPOINT, and ctx blocks untouched.

## Final emission format

```
Opus 4.7 (1M context) │ v2.9 9/9 ████████ 100% │ codex:ok 5m │ Σ473K │ ■ CHECKPOINT │ ctx ██░░░ 48%
```

For a partial milestone:
```
Opus 4.7 (1M context) │ v2.9 P101 3/8 ███░░░ 38% │ codex:fail 30s │ Σ250K │ ctx ███░░ 60%
```

## Files in read-pack

- `super-gsd/hooks/sgsd-statusline.js` — current state (post fix1 + fix2)
- `.planning/STATE.md` — for milestone field
- `.planning/milestones/v2.9/phases/98-harness-component-substrate/98-VERIFICATION.md` — to confirm `status: PASS` frontmatter shape

## Verification

After patch, declare:
- `getMilestonePhaseStats` and `getCodexStatus` functions added near top
- ROADMAP-based progress block replaced with phaseStats-based progress
- Codex status push happens immediately after progress push
- No other field reordered or removed

## Report

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/hooks/sgsd-statusline.js (modified)
VERIFICATION: phase stats walk milestone phases dir; codex status reads log tail
DEVIATIONS: <none or list>
BLOCKERS: <none>
ONE_LINER: Statusline now shows phase progress (current/total) + codex status (last-exit + ago).
REPORT_END
```

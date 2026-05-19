# SDD Implementer — sgsd-statusline.js getCodexStatus robustness

You are a fresh SDD implementer. No inherited context.

## The bug

`getCodexStatus()` in `super-gsd/hooks/sgsd-statusline.js` uses `JSON.parse(lines[lines.length - 1])`. But `codex-executor.sh` emits JSONL rows whose `stderr_preview` field contains unescaped Windows paths like `workdir: C:\Users\jack.berrow\...`. The unescaped backslashes break JSON parsing (`Bad escaped character`). `JSON.parse` throws, the try/catch returns null, and the codex-status badge never renders.

## The fix — regex extraction fallback

Replace the body of `getCodexStatus(root)` with regex extraction of only the three fields actually used (`ts`, `exit`, `mode`). Robust against any other malformed field downstream.

Current shape:

```js
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
```

Target shape:

```js
function getCodexStatus(root) {
  const logPath = path.join(root, '.planning', 'metrics', 'codex-executor-log.jsonl');
  if (!fs.existsSync(logPath)) return null;
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return null;
    const last = lines[lines.length - 1];
    const tsMatch   = last.match(/"ts":"([^"]+)"/);
    const exitMatch = last.match(/"exit":(-?\d+)/);
    const modeMatch = last.match(/"mode":"([^"]+)"/);
    if (!tsMatch || !exitMatch) return null;
    const tsMs = Date.parse(tsMatch[1]);
    const ago  = isNaN(tsMs) ? null : Math.max(0, Math.floor((Date.now() - tsMs) / 1000));
    return { exit: parseInt(exitMatch[1], 10), ago, mode: modeMatch ? modeMatch[1] : 'unknown' };
  } catch { return null; }
}
```

The regex approach extracts only the three primitive fields the renderer needs. It tolerates any malformed JSON downstream of those fields (the `stderr_preview` Windows-path bug being the immediate trigger, but the pattern is generally more robust).

## Files in read-pack

- `super-gsd/hooks/sgsd-statusline.js` (current state)
- `.planning/metrics/codex-executor-log.jsonl` (a few lines of the actual log, to confirm field shapes; only first ~5 lines needed)

## Verification

After patch, the regex should successfully extract `ts`, `exit`, `mode` from a malformed-JSON line containing `C:\Users\...` in `stderr_preview`. The codex badge will render.

## Report

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/hooks/sgsd-statusline.js (modified)
VERIFICATION: getCodexStatus now extracts ts/exit/mode via regex; tolerates malformed JSON
DEVIATIONS: <none or list>
BLOCKERS: <none>
ONE_LINER: getCodexStatus regex-extracts fields instead of JSON.parse; tolerates unescaped Windows paths in stderr_preview.
REPORT_END
```

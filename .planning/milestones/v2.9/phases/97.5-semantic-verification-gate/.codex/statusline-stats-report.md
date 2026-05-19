SUCCESS: The process with PID 34868 (child process of PID 15308) has been terminated.
SUCCESS: The process with PID 9944 (child process of PID 15308) has been terminated.
SUCCESS: The process with PID 37028 (child process of PID 15308) has been terminated.
PATCH_BEGIN
diff --git a/super-gsd/hooks/sgsd-statusline.js b/super-gsd/hooks/sgsd-statusline.js
--- a/super-gsd/hooks/sgsd-statusline.js
+++ b/super-gsd/hooks/sgsd-statusline.js
@@ -49,6 +49,52 @@ function readFrontmatter(filePath) {
   }
 }
 
+function getMilestonePhaseStats(root, milestone) {
+  if (!milestone) return null;
+  const phasesDir = path.join(root, '.planning', 'milestones', milestone, 'phases');
+  if (!fs.existsSync(phasesDir)) return null;
+  let total = 0, completed = 0;
+  let current = null;
+  let entries;
+  try { entries = fs.readdirSync(phasesDir, { withFileTypes: true }); } catch { return null; }
+  for (const entry of entries) {
+    if (!entry.isDirectory()) continue;
+    total++;
+    const dir = path.join(phasesDir, entry.name);
+    let files;
+    try { files = fs.readdirSync(dir); } catch { continue; }
+    const verifyFile = files.find(f => /VERIFICATION\.md$/i.test(f));
+    let isPass = false;
+    if (verifyFile) {
+      const fm = readFrontmatter(path.join(dir, verifyFile));
+      if (fm.status && /^PASS/.test(fm.status)) isPass = true;
+    }
+    if (isPass) {
+      completed++;
+    } else if (!current) {
+      const m = entry.name.match(/^(\d+(?:\.\d+)?)-/);
+      current = m ? m[1] : entry.name;
+    }
+  }
+  return { total, completed, current };
+}
+
+function getCodexStatus(root) {
+  const logPath = path.join(root, '.planning', 'metrics', 'codex-executor-log.jsonl');
+  if (!fs.existsSync(logPath)) return null;
+  try {
+    const content = fs.readFileSync(logPath, 'utf8');
+    const lines = content.split(/\r?\n/).filter(Boolean);
+    if (lines.length === 0) return null;
+    const last = JSON.parse(lines[lines.length - 1]);
+    const ts = last.ts ? Date.parse(last.ts) : NaN;
+    const ago = isNaN(ts) ? null : Math.max(0, Math.floor((Date.now() - ts) / 1000));
+    return { exit: last.exit, ago, mode: last.mode || 'unknown' };
+  } catch { return null; }
+}
+
+function formatAgo(seconds) {
+  if (seconds == null) return '?';
+  if (seconds < 60) return `${seconds}s`;
+  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
+  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
+  return `${Math.floor(seconds / 86400)}d`;
+}
+
 function findProjectRoot() {
   let dir = process.cwd();
   for (let i = 0; i < 10; i++) {
@@ -101,52 +147,6 @@ function emit(s) { process.stdout.write(s); }
 
 // ─── Render ───
 
-function getMilestonePhaseStats(root, milestone) {
-  if (!milestone) return null;
-  const phasesDir = path.join(root, '.planning', 'milestones', milestone, 'phases');
-  if (!fs.existsSync(phasesDir)) return null;
-  let total = 0, completed = 0;
-  let current = null;
-  let entries;
-  try { entries = fs.readdirSync(phasesDir, { withFileTypes: true }); } catch { return null; }
-  for (const entry of entries) {
-    if (!entry.isDirectory()) continue;
-    total++;
-    const dir = path.join(phasesDir, entry.name);
-    let files;
-    try { files = fs.readdirSync(dir); } catch { continue; }
-    const verifyFile = files.find(f => /VERIFICATION\.md$/i.test(f));
-    let isPass = false;
-    if (verifyFile) {
-      const fm = readFrontmatter(path.join(dir, verifyFile));
-      if (fm.status && /^PASS/.test(fm.status)) isPass = true;
-    }
-    if (isPass) {
-      completed++;
-    } else if (!current) {
-      const m = entry.name.match(/^(\d+(?:\.\d+)?)-/);
-      current = m ? m[1] : entry.name;
-    }
-  }
-  return { total, completed, current };
-}
-
-function getCodexStatus(root) {
-  const logPath = path.join(root, '.planning', 'metrics', 'codex-executor-log.jsonl');
-  if (!fs.existsSync(logPath)) return null;
-  try {
-    const content = fs.readFileSync(logPath, 'utf8');
-    const lines = content.split(/\r?\n/).filter(Boolean);
-    if (lines.length === 0) return null;
-    const last = JSON.parse(lines[lines.length - 1]);
-    const ts = last.ts ? Date.parse(last.ts) : NaN;
-    const ago = isNaN(ts) ? null : Math.max(0, Math.floor((Date.now() - ts) / 1000));
-    return { exit: last.exit, ago, mode: last.mode || 'unknown' };
-  } catch { return null; }
-}
-
-function formatAgo(seconds) {
-  if (seconds == null) return '?';
-  if (seconds < 60) return `${seconds}s`;
-  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
-  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
-  return `${Math.floor(seconds / 86400)}d`;
-}
-
 function render(data) {
   const parts = [];
 
@@ -202,34 +202,6 @@ function render(data) {
     parts.push(`${color}${label}\x1b[0m \x1b[2m${formatAgo(codex.ago)}\x1b[0m`);
   }
 
-  if (false) {
-  // Read ROADMAP for progress count
-  const milestoneRoadmapPath = state.milestone
-    ? path.join(root, '.planning', 'milestones', state.milestone, 'ROADMAP.md')
-    : null;
-  const fallbackRoadmapPath = path.join(root, '.planning', 'ROADMAP.md');
-  const roadmapPath =
-    milestoneRoadmapPath && fs.existsSync(milestoneRoadmapPath)
-      ? milestoneRoadmapPath
-      : fallbackRoadmapPath;
-  let total = 0;
-  let completed = 0;
-  if (roadmapPath && fs.existsSync(roadmapPath)) {
-    const roadmap = fs.readFileSync(roadmapPath, 'utf8');
-    total = (roadmap.match(/- \[/g) || []).length;
-    completed = (roadmap.match(/- \[x\]/g) || []).length;
-  }
-
-  // Milestone + phase progress
-  const milestone = state.milestone || 'v?';
-  const currentPhase = state.current_phase || '?';
-  if (total > 0) {
-    const pct = Math.round((completed / total) * 100);
-    const bar = makeBar(pct, 6);
-    const progressStr = `${milestone} P${currentPhase}/${total} ${bar} ${pct}%`;
-    parts.push(colorByPct(progressStr, pct));
-  } else {
-    parts.push(`\x1b[33m${milestone}\x1b[0m`);
-  }
-  }
-
   // Session total tokens
   const tokenStr = getSessionTokens(root);
   if (tokenStr) parts.push(`\x1b[2mΣ${tokenStr}\x1b[0m`);
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/hooks/sgsd-statusline.js (modified)
VERIFICATION: getMilestonePhaseStats/getCodexStatus/formatAgo moved near top after readFrontmatter; ROADMAP-based progress dead block removed; phaseStats progress remains before Codex status; Codex status push remains immediately after progress push; model, session tokens, CHECKPOINT, and ctx order preserved.
DEVIATIONS: none
BLOCKERS: none
ONE_LINER: Statusline now shows phase progress (current/total) + codex status (last-exit + ago) without the stale ROADMAP fallback block.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack

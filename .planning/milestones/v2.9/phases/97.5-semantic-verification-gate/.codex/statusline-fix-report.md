SUCCESS: The process with PID 33388 (child process of PID 38352) has been terminated.
SUCCESS: The process with PID 32284 (child process of PID 38352) has been terminated.
SUCCESS: The process with PID 23692 (child process of PID 38352) has been terminated.
PATCH_BEGIN
diff --git a/super-gsd/hooks/sgsd-statusline.js b/super-gsd/hooks/sgsd-statusline.js
index 0000000..0000000 100644
--- a/super-gsd/hooks/sgsd-statusline.js
+++ b/super-gsd/hooks/sgsd-statusline.js
@@ -47,22 +47,6 @@ function readFrontmatter(filePath, limit = 40) {
   } catch {
     return {};
   }
-  try {
-    const content = fs.readFileSync(filePath, 'utf8');
-    const lines = content.split('\n').slice(0, limit);
-    const match = lines.join('\n').match(/^---\n([\s\S]*?)\n---/);
-    if (!match) return {};
-    const fm = {};
-    for (const line of match[1].split('\n')) {
-      const kv = line.match(/^(\w[\w_-]*)\s*:\s*(.*)$/);
-      if (kv) {
-        let val = kv[2].trim().replace(/^["']|["']$/g, '');
-        // Try parse as number or bool
-        if (/^\d+$/.test(val)) val = parseInt(val);
-        else if (val === 'true') val = true;
-        else if (val === 'false') val = false;
-        fm[kv[1]] = val;
-      }
-    }
-    return fm;
-  } catch {
-    return {};
-  }
 }
 
 function findProjectRoot() {
@@ -147,47 +131,9 @@ function render(data) {
     completed = (roadmap.match(/- \[x\]/g) || []).length;
   }
-  /*
-  let completed = 0;
-  let total = 0;
-  try {
-    const roadmap = fs.readFileSync(path.join(root, '.planning', 'ROADMAP.md'), 'utf8');
-    const matches = roadmap.match(/^\- \[/gm);
-    total = matches ? matches.length : 0;
-    const doneMatches = roadmap.match(/^\- \[x\]/gm);
-    completed = doneMatches ? doneMatches.length : 0;
-  } catch {}
 
   // Milestone + phase progress
   const milestone = state.milestone || 'v?';
   const currentPhase = state.current_phase || '?';
-  */
   if (total > 0) {
     const pct = Math.round((completed / total) * 100);
     const bar = makeBar(pct, 6);
@@ -197,35 +143,6 @@ function render(data) {
   } else {
     parts.push(`\x1b[33m${milestone}\x1b[0m`);
   }
-
-  /*
-  const lastAgent = getLastAgent(root);
-  if (lastAgent) {
-    // Color by model: opus=purple, sonnet=blue, haiku=cyan
-    const modelColor = lastAgent.model === 'opus' ? '\x1b[35m' :
-                        lastAgent.model === 'sonnet' ? '\x1b[34m' :
-                        lastAgent.model === 'haiku' ? '\x1b[36m' : '\x1b[37m';
-    const agentStr = `${modelColor}${lastAgent.role}\x1b[0m \x1b[2m[${lastAgent.model}]\x1b[0m`;
-    parts.push(agentStr);
-
-    // Show agent's token cost if >0
-    if (lastAgent.total > 0) {
-      const t = lastAgent.total < 1000 ? `${lastAgent.total}` :
-                lastAgent.total < 1000000 ? `${Math.round(lastAgent.total/1000)}K` :
-                `${(lastAgent.total/1000000).toFixed(1)}M`;
-      parts.push(`\x1b[33m${t}\x1b[0m`);
-    }
-  } else {
-    // Fallback to phase state
-    const phaseState = state.status || state.phase_state || '';
-    const currentPlanDir = findCurrentPhaseDir(root, currentPhase);
-    if (currentPlanDir) {
-      const pendingPlan = findPendingPlan(currentPlanDir, currentPhase);
-      if (pendingPlan) {
-        parts.push(`\x1b[36m${phaseState || 'exec'} ${pendingPlan}\x1b[0m`);
-      }
-    }
-  }
-
-  */
   // Session total tokens
   const tokenStr = getSessionTokens(root);
   if (tokenStr) parts.push(`\x1b[2mΣ${tokenStr}\x1b[0m`);
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/hooks/sgsd-statusline.js (modified)
VERIFICATION:
  Fix A: regex tolerates CRLF in both readFrontmatter regex + line split; stale LF-only unreachable parser removed
  Fix B: ROADMAP read now prefers milestone-specific path via state.milestone and path.join(root, '.planning', 'milestones', state.milestone, 'ROADMAP.md')
  Fix C: lastAgent block removed; agent role + model + cost lines gone
DEVIATIONS: Removed stale commented/unreachable code already present in the supplied read-pack so milestone/currentPhase declarations are live and the patch applies safely.
BLOCKERS: none
ONE_LINER: Three fixes: CRLF-tolerant frontmatter parser, milestone-scoped ROADMAP lookup, drop misleading executor[model] badge.
REPORT_END

SGSD_PATCH_APPLY: success
SGSD_PATCH_MODE: read-pack

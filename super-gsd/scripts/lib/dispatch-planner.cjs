'use strict';

/**
 * Dispatch planner — parallel/sequential wave auto-detection (MACH-02).
 *
 * Reads a v2 PLAN.md frontmatter object and produces a wave-layered execution plan:
 *
 *   buildDispatchPlan(plan) → [{wave: N, taskIds: [...], serial: bool[, cycle: true]}]
 *
 * Algorithm for v2 plans (schema_version === 2):
 *   1. Build explicit dependency edges from task.depends_on.
 *   2. Build implicit edges for tasks with overlapping files_touched (D-05a):
 *      earlier id in sort-order precedes later.
 *   3. Kahn's topo-sort: tasks with all predecessors resolved form a wave layer.
 *   4. Per-wave serial flag: false ONLY when ALL pairwise tasks have disjoint
 *      files_touched AND no explicit inner-wave depends_on (D-05a, D-06).
 *   5. Cycle detection: if Kahn emits an empty layer with remaining tasks,
 *      dump remainder as a single serial wave with cycle: true (V5 — no infinite loop).
 *
 * v1 fallback (D-07): plan.schema_version !== 2 → single serial wave with all taskIds.
 *
 * Zero runtime dependencies (fs/path not needed). Pure function.
 */

/**
 * Check whether a set of tasks in the same wave has any internal conflict.
 * A conflict exists when:
 *   (a) two tasks share at least one file in files_touched, OR
 *   (b) one task explicitly depends_on another in the same layer.
 *
 * @param {{ id: string, files_touched?: string[], depends_on?: string[] }[]} tasks
 * @returns {boolean} true if any conflict exists (wave must be serialised)
 */
function hasInternalConflict(tasks) {
  for (let i = 0; i < tasks.length; i++) {
    const ft_i = new Set(tasks[i].files_touched || []);
    for (let j = i + 1; j < tasks.length; j++) {
      // File overlap → conflict
      const ft_j = tasks[j].files_touched || [];
      if (ft_j.some(f => ft_i.has(f))) return true;
      // Explicit depends_on within the same layer → conflict
      if ((tasks[j].depends_on || []).includes(tasks[i].id)) return true;
      if ((tasks[i].depends_on || []).includes(tasks[j].id)) return true;
    }
  }
  return false;
}

/**
 * Build a wave-layered execution plan from a v2 PLAN.md frontmatter object.
 *
 * @param {{ schema_version?: number, tasks?: Array<{ id: string, depends_on?: string[], files_touched?: string[] }> }} plan
 * @returns {Array<{ wave: number, taskIds: string[], serial: boolean, cycle?: true }>}
 */
function buildDispatchPlan(plan) {
  // v1 fallback (D-07): non-v2 schema or missing tasks → single serial wave
  if (!plan || plan.schema_version !== 2 || !Array.isArray(plan.tasks)) {
    const taskIds = (plan && Array.isArray(plan.tasks))
      ? plan.tasks.map(t => t.id).filter(Boolean)
      : [];
    return [{ wave: 1, taskIds, serial: true }];
  }

  const tasks = plan.tasks;

  // Empty task list → single empty wave (safe for callers to iterate without branching)
  if (tasks.length === 0) {
    return [{ wave: 1, taskIds: [], serial: true }];
  }

  const byId = Object.fromEntries(tasks.map(t => [t.id, t]));

  // Build predecessor map: taskId → Set<predecessorId>
  const preds = Object.fromEntries(tasks.map(t => [t.id, new Set()]));

  // Explicit depends_on edges
  for (const t of tasks) {
    for (const dep of (t.depends_on || [])) {
      if (byId[dep]) preds[t.id].add(dep);
    }
  }

  // Implicit file-overlap edges (D-05a):
  // Sort tasks by id; for each pair (i < j), if their files_touched overlap,
  // sorted[i] precedes sorted[j].
  const sorted = [...tasks].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < sorted.length; i++) {
    const ft_i = new Set(sorted[i].files_touched || []);
    for (let j = i + 1; j < sorted.length; j++) {
      const ft_j = sorted[j].files_touched || [];
      if (ft_j.some(f => ft_i.has(f))) {
        preds[sorted[j].id].add(sorted[i].id);
      }
    }
  }

  // Kahn's topo-sort into waves
  const waves = [];
  const done = new Set();
  const remaining = new Set(tasks.map(t => t.id));
  let waveNum = 1;

  while (remaining.size > 0) {
    // Collect tasks whose every predecessor is resolved
    const layer = [...remaining].filter(id =>
      [...preds[id]].every(p => done.has(p))
    );

    if (layer.length === 0) {
      // Cycle detected — dump remainder as a single serial wave (V5 security pattern)
      waves.push({ wave: waveNum, taskIds: [...remaining].sort(), serial: true, cycle: true });
      break;
    }

    // Compute serial flag for this layer
    const layerTasks = layer.map(id => byId[id]);
    const serial = hasInternalConflict(layerTasks);

    waves.push({ wave: waveNum, taskIds: layer.sort(), serial });

    for (const id of layer) {
      done.add(id);
      remaining.delete(id);
    }
    waveNum++;
  }

  return waves;
}

module.exports = { buildDispatchPlan };

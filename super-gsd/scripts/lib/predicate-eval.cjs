'use strict';

/**
 * Evaluate a list of trigger clauses against a dispatch context.
 *
 * @param {Array<Object>} triggerList - list of clauses (implicit AND at top level)
 * @param {Object} ctx - dispatch context (see DISPATCH_CONTEXT_FIELDS below)
 * @returns {boolean} true iff ALL clauses pass (or triggerList is empty/absent)
 *
 * Clause shape: { field, op, value }
 *   Supported ops: eq, neq, in, not_in, gt, gte, lt, lte, contains
 *   Special form: { any: [Clause, ...] } — OR over nested clause list
 *
 * D-10c: unknown field in ctx → throw loud (not silently false).
 *
 * DISPATCH_CONTEXT_FIELDS (registry of allowed field paths — D-10c + D-12a):
 *   classifier.complexity       - 'trivial' | 'light' | 'standard' | 'heavy'
 *   classifier.atc_tier         - 'skip' | 'lite' | 'full' | 'gate'
 *   classifier.type             - 'feature' | 'bugfix' | 'refactor' | ...
 *   files_changed_count         - number
 *   code_files_changed_count    - number
 *   diff_lines                  - number
 *   phase_type                  - 'docs' | 'config' | 'refactor' | ...
 *   new_pattern_detected        - boolean
 *   script_created              - boolean
 *   error_discovered            - boolean
 *   phase_has_verify_mjs        - boolean (D-12a — verify-completeness gates)
 */
function evalPredicate(triggerList, ctx) {
  if (!Array.isArray(triggerList) || triggerList.length === 0) return true;
  return triggerList.every(clause => evalClause(clause, ctx));
}

/**
 * Evaluate a single clause (leaf or any-branch).
 * @param {Object} clause
 * @param {Object} ctx
 * @returns {boolean}
 */
function evalClause(clause, ctx) {
  // OR clause: { any: [Clause, ...] }
  if ('any' in clause) {
    if (!Array.isArray(clause.any)) throw new Error(`'any' must be an array, got: ${JSON.stringify(clause.any)}`);
    return clause.any.some(sub => evalClause(sub, ctx));
  }

  // Leaf clause: { field, op, value }
  const { field, op, value } = clause;
  if (!field || !op) throw new Error(`clause missing field/op: ${JSON.stringify(clause)}`);

  const actual = getDottedField(ctx, field); // throws on unknown field
  return applyOp(actual, op, value);
}

/**
 * Traverse a dotted field path in ctx; throw loud if any segment is missing (D-10c).
 * @param {Object} ctx
 * @param {string} dotPath
 * @returns {*}
 */
function getDottedField(ctx, dotPath) {
  const parts = dotPath.split('.');
  let cur = ctx;
  for (const p of parts) {
    if (cur == null || !(p in cur)) {
      throw new Error(`dispatch context missing field '${dotPath}' (unknown at '${p}')`);
    }
    cur = cur[p];
  }
  return cur;
}

/**
 * Apply a comparison operator.
 * @param {*} actual
 * @param {string} op
 * @param {*} value
 * @returns {boolean}
 */
function applyOp(actual, op, value) {
  switch (op) {
    case 'eq':       return actual === value;
    case 'neq':      return actual !== value;
    case 'in':       return Array.isArray(value) && value.includes(actual);
    case 'not_in':   return Array.isArray(value) && !value.includes(actual);
    case 'gt':       return actual > value;
    case 'gte':      return actual >= value;
    case 'lt':       return actual < value;
    case 'lte':      return actual <= value;
    case 'contains': return Array.isArray(actual) && actual.includes(value);
    default:         throw new Error(`unknown operator '${op}'`);
  }
}

module.exports = { evalPredicate };

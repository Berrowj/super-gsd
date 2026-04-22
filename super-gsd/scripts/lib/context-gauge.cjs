'use strict';

/**
 * context-gauge.cjs — Opt-in mechanical context-use gauge (Risk 1 Option B).
 *
 * Pure arithmetic; zero runtime dependencies (no fs, no network).
 * Primary trigger in SKILL.md remains self-report (Option A) per 12-RESEARCH §Risk 1.
 * This module gives future orchestrator versions a mechanical fallback path.
 *
 * Exports: { isEmergency, isWarning, computeFraction }
 */

/**
 * Compute the fraction of context window used.
 * Returns 0 if either input is <= 0 (defensive).
 *
 * @param {number} total       - tokens used so far
 * @param {number} maxContext  - total context window size
 * @returns {number} fraction in [0, Infinity)
 */
function computeFraction(total, maxContext) {
  if (total <= 0 || maxContext <= 0) return 0;
  return total / maxContext;
}

/**
 * Returns true when context usage meets or exceeds the emergency threshold (default 85%).
 *
 * @param {number} total       - tokens used so far
 * @param {number} maxContext  - total context window size
 * @param {number} [threshold=0.85] - fractional threshold (0–1)
 * @returns {boolean}
 */
function isEmergency(total, maxContext, threshold) {
  if (threshold === undefined) threshold = 0.85;
  return computeFraction(total, maxContext) >= threshold;
}

/**
 * Returns true when context usage meets or exceeds the warning threshold (default 70%).
 *
 * @param {number} total       - tokens used so far
 * @param {number} maxContext  - total context window size
 * @param {number} [threshold=0.70] - fractional threshold (0–1)
 * @returns {boolean}
 */
function isWarning(total, maxContext, threshold) {
  if (threshold === undefined) threshold = 0.70;
  return computeFraction(total, maxContext) >= threshold;
}

module.exports = { isEmergency, isWarning, computeFraction };

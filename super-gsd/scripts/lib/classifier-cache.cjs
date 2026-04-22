'use strict';

/**
 * Classifier verdict sidecar cache (MACH-01).
 *
 * Per-plan, mtime-invalidated. Scope: orchestrator run.
 *
 * Sidecar path: <plan-dir>/<NN-PP>.classifier.json
 * Sidecar body: { classified_at: ISO, verdict: { complexity, model, atc_tier, deliberate, reason }, plan_schema_version }
 *
 *   sidecarFor(planFile)         → absolute path to sidecar
 *   readCache(planFile)          → verdict object | null
 *   writeCache(planFile, verdict)→ sidecar absolute path
 *   clearCache(planFile)         → void (idempotent)
 *
 * Returns null on: absent sidecar, malformed JSON, plan mtime > sidecar mtime (D-03).
 * Zero runtime deps beyond `fs` and `path`.
 */

const fs   = require('fs');
const path = require('path');

/**
 * Derive absolute sidecar path for the given plan file.
 * Key: leading NN-PP prefix from basename, or full basename if no prefix match.
 *
 * @param {string} planFile - absolute or relative path to the plan .md file
 * @returns {string} absolute path to <dir>/<NN-PP>.classifier.json
 */
function sidecarFor(planFile) {
  const dir  = path.dirname(planFile);
  const base = path.basename(planFile, path.extname(planFile));
  // D-02: extract 'NN-PP' prefix (e.g. '12-01' from '12-01-classifier-cache')
  const m = base.match(/^(\d{2}-\d{2})/);
  const planId = m ? m[1] : base;
  return path.join(dir, `${planId}.classifier.json`);
}

/**
 * Read cached classifier verdict for a plan file.
 * Returns null when sidecar is absent, malformed JSON, or stale (D-03).
 *
 * @param {string} planFile
 * @returns {{ complexity: string, model: string, atc_tier: string, deliberate: boolean, reason: string } | null}
 */
function readCache(planFile) {
  const side = sidecarFor(planFile);
  if (!fs.existsSync(side)) return null;
  // D-03: cache stale if plan mtime > sidecar mtime
  const planStat = fs.statSync(planFile);
  const sideStat = fs.statSync(side);
  if (planStat.mtimeMs > sideStat.mtimeMs) return null;
  // V5: malformed JSON → cache-miss (treat as absent, not a throw)
  try {
    const body = JSON.parse(fs.readFileSync(side, 'utf8'));
    return body.verdict || null;
  } catch (_) {
    return null;
  }
}

/**
 * Write classifier verdict to the sidecar file.
 *
 * @param {string} planFile
 * @param {{ complexity: string, model: string, atc_tier: string, deliberate: boolean, reason: string }} verdict
 * @returns {string} sidecar absolute path
 */
function writeCache(planFile, verdict) {
  const side = sidecarFor(planFile);
  const body = {
    classified_at:       new Date().toISOString(),
    verdict,
    plan_schema_version: 2
  };
  fs.writeFileSync(side, JSON.stringify(body, null, 2));
  return side;
}

/**
 * Remove the sidecar file if present. Idempotent — no throw when absent.
 *
 * @param {string} planFile
 */
function clearCache(planFile) {
  const side = sidecarFor(planFile);
  if (fs.existsSync(side)) fs.unlinkSync(side);
}

module.exports = { readCache, writeCache, clearCache, sidecarFor };

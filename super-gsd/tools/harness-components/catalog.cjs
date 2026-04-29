// SGSD Harness Component Catalog -- Phase 98 (v2.9 AHE).
// Lock-13: never throw across boundary; return {ok, rows, errors}.
// Reads super-gsd/registry/harness-components.yaml.
// Frozen closed-vocab class array prevents drift.

'use strict';

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH_DEFAULT = path.join(
  __dirname, '..', '..', 'registry', 'harness-components.yaml'
);

// Frozen closed vocab. Drift from this list is a validation error.
const COMPONENT_CLASSES = Object.freeze([
  'prompt',
  'tool',
  'middleware_hook',
  'skill',
  'agent_config',
  'memory',
  'workflow',
  'mcp_bridge',
  'gate',
  'dashboard',
  'docs',
  'protected_oracle',
  'protected_verifier',
  'protected_model_config'
]);

const PROTECTED_CLASSES = Object.freeze([
  'protected_oracle',
  'protected_verifier',
  'protected_model_config'
]);

const REQUIRED_FIELDS = Object.freeze([
  'id', 'class', 'paths', 'owner', 'edit_policy',
  'test_commands', 'rollback_method', 'protected'
]);

// Minimal YAML parser tuned for our registry shape (no heredocs, no anchors,
// no flow style). Keeps Lock-13: invalid YAML returns errors, never throws.
function parseRegistryYaml(src) {
  const errors = [];
  const lines = src.split(/\r?\n/);
  const top = {};
  let i = 0;

  function isBlank(l) { return !l || /^\s*(#.*)?$/.test(l); }
  function indentOf(l) { const m = l.match(/^( *)/); return m ? m[1].length : 0; }
  function unquote(s) {
    s = String(s).trim();
    if ((s.startsWith("'") && s.endsWith("'")) ||
        (s.startsWith('"') && s.endsWith('"'))) {
      return s.slice(1, -1);
    }
    return s;
  }

  // Top-level scalars + components: list
  while (i < lines.length) {
    const l = lines[i];
    if (isBlank(l)) { i++; continue; }
    const m = l.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!m) { errors.push({ line: i + 1, msg: 'expected top-level key' }); i++; continue; }
    const k = m[1], rawV = m[2];
    if (k === 'components') {
      i++;
      // Read list of mappings indented
      const rows = [];
      while (i < lines.length) {
        const cl = lines[i];
        if (isBlank(cl)) { i++; continue; }
        if (indentOf(cl) === 0) break;
        const dash = cl.match(/^(\s+)-\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
        if (!dash) { i++; continue; }
        const baseIndent = dash[1].length + 2;
        const row = {};
        row[dash[2]] = parseScalarOrList(dash[3], lines, i, baseIndent + 2);
        i++;
        while (i < lines.length) {
          const rl = lines[i];
          if (isBlank(rl)) { i++; continue; }
          const ind = indentOf(rl);
          if (ind < baseIndent) break;
          if (ind === baseIndent && rl.match(/^\s*-\s+/)) break;
          const fm = rl.match(/^\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
          if (fm) {
            row[fm[1]] = parseScalarOrList(fm[2], lines, i, baseIndent + 2);
            // advance past list block if needed
            if (fm[2].trim() === '') {
              i++;
              while (i < lines.length) {
                const ll = lines[i];
                if (isBlank(ll)) { i++; continue; }
                if (indentOf(ll) <= baseIndent) break;
                i++;
              }
              continue;
            }
          }
          i++;
        }
        rows.push(row);
      }
      top[k] = rows;
    } else {
      top[k] = unquote(rawV);
      i++;
    }
  }

  return { top, errors };
}

function parseScalarOrList(rawV, lines, currentIdx, listIndent) {
  const v = rawV.trim();
  if (v !== '') {
    // unquote scalar
    if ((v.startsWith("'") && v.endsWith("'")) ||
        (v.startsWith('"') && v.endsWith('"'))) {
      return v.slice(1, -1);
    }
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (v === 'true') return true;
    if (v === 'false') return false;
    return v;
  }
  // empty -> read indented list of `- item` lines below
  const items = [];
  let j = currentIdx + 1;
  while (j < lines.length) {
    const ll = lines[j];
    if (!ll || /^\s*(#.*)?$/.test(ll)) { j++; continue; }
    const ind = (ll.match(/^( *)/) || ['', ''])[1].length;
    if (ind < listIndent) break;
    const dm = ll.match(/^\s+-\s+(.*)$/);
    if (dm) {
      let item = dm[1].trim();
      if ((item.startsWith("'") && item.endsWith("'")) ||
          (item.startsWith('"') && item.endsWith('"'))) {
        item = item.slice(1, -1);
      }
      items.push(item);
    }
    j++;
  }
  return items;
}

function validateRow(row, rowIdx) {
  const errors = [];
  for (const f of REQUIRED_FIELDS) {
    if (!(f in row)) errors.push({ row: rowIdx, msg: 'missing field: ' + f });
  }
  if (row.class && !COMPONENT_CLASSES.includes(row.class)) {
    errors.push({ row: rowIdx, msg: 'unknown class: ' + row.class });
  }
  if (row.protected === true && row.class &&
      !PROTECTED_CLASSES.includes(row.class)) {
    errors.push({
      row: rowIdx,
      msg: 'protected:true requires protected_* class, got: ' + row.class
    });
  }
  if (Array.isArray(row.paths)) {
    if (row.paths.length === 0) {
      errors.push({ row: rowIdx, msg: 'paths empty' });
    }
    for (const p of row.paths) {
      if (typeof p !== 'string') {
        errors.push({ row: rowIdx, msg: 'path not string' });
        continue;
      }
      // Reject Windows-style absolute paths in registry except for memory class
      // (memory lives at user-profile path).
      if (row.class !== 'memory') {
        if (/^[A-Za-z]:[\\\/]/.test(p) || p.startsWith('/')) {
          errors.push({ row: rowIdx, msg: 'absolute path not allowed: ' + p });
        }
      }
      if (p.includes('..')) {
        errors.push({ row: rowIdx, msg: 'path traversal not allowed: ' + p });
      }
      if (!/^[\x20-\x7E]*$/.test(p)) {
        errors.push({ row: rowIdx, msg: 'non-ASCII path: ' + p });
      }
    }
  } else if ('paths' in row) {
    errors.push({ row: rowIdx, msg: 'paths must be array' });
  }
  if ('id' in row && typeof row.id === 'string') {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(row.id)) {
      errors.push({ row: rowIdx, msg: 'id must be kebab-case: ' + row.id });
    }
  }
  return errors;
}

// PUBLIC API -- Lock-13: never throws.
function loadRegistry(registryPath) {
  try {
    const p = registryPath || REGISTRY_PATH_DEFAULT;
    if (!fs.existsSync(p)) {
      return { ok: false, rows: [], errors: [{ msg: 'registry not found: ' + p }] };
    }
    const src = fs.readFileSync(p, 'utf8');
    const parsed = parseRegistryYaml(src);
    const errors = parsed.errors.slice();
    const rows = Array.isArray(parsed.top.components) ? parsed.top.components : [];
    const ids = new Set();
    rows.forEach((r, idx) => {
      const rowErrors = validateRow(r, idx);
      errors.push.apply(errors, rowErrors);
      if (r.id) {
        if (ids.has(r.id)) errors.push({ row: idx, msg: 'duplicate id: ' + r.id });
        ids.add(r.id);
      }
    });
    return { ok: errors.length === 0, rows: rows, errors: errors };
  } catch (e) {
    return { ok: false, rows: [], errors: [{ msg: 'load_failed: ' + (e && e.message || String(e)) }] };
  }
}

function listClasses() {
  return COMPONENT_CLASSES.slice();
}

function listProtectedClasses() {
  return PROTECTED_CLASSES.slice();
}

function findById(id, registryPath) {
  const r = loadRegistry(registryPath);
  if (!r.ok) return null;
  return r.rows.find(function (x) { return x.id === id; }) || null;
}

module.exports = {
  loadRegistry: loadRegistry,
  listClasses: listClasses,
  listProtectedClasses: listProtectedClasses,
  findById: findById,
  COMPONENT_CLASSES: COMPONENT_CLASSES,
  PROTECTED_CLASSES: PROTECTED_CLASSES,
  REGISTRY_PATH_DEFAULT: REGISTRY_PATH_DEFAULT
};

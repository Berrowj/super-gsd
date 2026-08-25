#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const moduleBuiltin = require('module');
const os = require('os');
const path = require('path');

const PROJECT_TARGETS = new Set(['claude-project', 'codex-project']);
const SOURCE_EXTENSIONS = ['', '.js', '.cjs', '.json'];
const BUILTINS = new Set(moduleBuiltin.builtinModules.flatMap((name) => [name, `node:${name}`]));
const DEFAULT_ROOT = path.resolve(__dirname, '..', '..');
const DOUBLE_QUOTE = String.fromCharCode(34);
const SINGLE_QUOTE = String.fromCharCode(39);

function posix(value) {
  return value.replace(/\\/g, '/');
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..'
    && !relative.startsWith(`..${path.sep}`));
}

function boundedMessage(value, maxBytes = 2048) {
  const oneLine = String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const bytes = Buffer.from(oneLine, 'utf8');
  if (bytes.length <= maxBytes) return oneLine;
  return bytes.subarray(0, maxBytes).toString('utf8').replace(/\uFFFD$/u, '');
}

function dependencyError(code, sourcePath, expression, request, resolvedPath, message) {
  const error = new Error(boundedMessage(`${sourcePath}: ${message}: ${expression}`));
  error.code = code;
  error.source_path = sourcePath;
  error.expression = expression;
  error.request = request || null;
  error.resolved_path = resolvedPath || null;
  return error;
}

function codeMask(source) {
  const out = source.split('');
  let state = 'code';
  let quote = null;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (state === 'line') {
      if (char === '\n') state = 'code'; else out[index] = ' ';
      continue;
    }
    if (state === 'block') {
      out[index] = char === '\n' ? '\n' : ' ';
      if (char === '*' && next === '/') {
        out[index + 1] = ' ';
        index += 1;
        state = 'code';
      }
      continue;
    }
    if (state === 'string') {
      out[index] = char === '\n' ? '\n' : ' ';
      if (char === '\\') {
        if (index + 1 < source.length) out[index + 1] = ' ';
        index += 1;
      } else if (char === quote) state = 'code';
      continue;
    }
    if (char === '/' && next === '/') {
      out[index] = out[index + 1] = ' ';
      index += 1;
      state = 'line';
    } else if (char === '/' && next === '*') {
      out[index] = out[index + 1] = ' ';
      index += 1;
      state = 'block';
    } else if (char === SINGLE_QUOTE || char === DOUBLE_QUOTE || char === '`') {
      quote = char;
      out[index] = ' ';
      state = 'string';
    }
  }
  return out.join('');
}

function readBalanced(source, openIndex) {
  let depth = 0;
  let quote = null;
  let line = false;
  let block = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (line) {
      if (char === '\n') line = false;
      continue;
    }
    if (block) {
      if (char === '*' && next === '/') { block = false; index += 1; }
      continue;
    }
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') { line = true; index += 1; continue; }
    if (char === '/' && next === '*') { block = true; index += 1; continue; }
    if (char === SINGLE_QUOTE || char === DOUBLE_QUOTE || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return {
        expression: source.slice(openIndex + 1, index),
        end: index,
      };
    }
  }
  return null;
}

function scanRequires(source) {
  const mask = codeMask(source);
  const expressions = [];
  const pattern = /\brequire\s*\(/g;
  let match;
  while ((match = pattern.exec(mask))) {
    const openIndex = mask.indexOf('(', match.index);
    const row = readBalanced(source, openIndex);
    if (!row) throw new Error('unterminated require expression');
    expressions.push(row.expression.trim());
    pattern.lastIndex = row.end + 1;
  }
  return expressions;
}

function splitTopLevel(source, delimiter) {
  const rows = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === SINGLE_QUOTE || char === DOUBLE_QUOTE || char === '`') { quote = char; continue; }
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth -= 1;
    else if (char === delimiter && depth === 0) {
      rows.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  rows.push(source.slice(start).trim());
  return rows;
}

function statementExpression(source, start) {
  let depth = 0;
  let quote = null;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === SINGLE_QUOTE || char === DOUBLE_QUOTE || char === '`') { quote = char; continue; }
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth -= 1;
    else if (char === ';' && depth === 0) return source.slice(start, index).trim();
  }
  return source.slice(start).trim();
}

function constantExpressions(source) {
  const mask = codeMask(source);
  const rows = [];
  const pattern = /\bconst\s+([A-Za-z_$][\w$]*)\s*=/g;
  let match;
  while ((match = pattern.exec(mask))) {
    const equalIndex = mask.indexOf('=', match.index);
    rows.push([match[1], statementExpression(source, equalIndex + 1)]);
  }
  return rows;
}

function parseQuoted(expression) {
  const quote = expression[0];
  if (expression.length < 2 || expression.at(-1) !== quote) return undefined;
  if (quote === '`' && expression.includes('${')) return undefined;
  if (quote === DOUBLE_QUOTE) {
    try { return JSON.parse(expression); } catch (_) { return undefined; }
  }
  let value = '';
  for (let index = 1; index < expression.length - 1; index += 1) {
    const char = expression[index];
    if (char !== '\\') { value += char; continue; }
    index += 1;
    const escaped = expression[index];
    if (escaped === 'n') value += '\n';
    else if (escaped === 'r') value += '\r';
    else if (escaped === 't') value += '\t';
    else value += escaped;
  }
  return value;
}

function stripOuterParens(expression) {
  let value = expression.trim();
  while (value.startsWith('(') && value.endsWith(')')) {
    const balanced = readBalanced(value, 0);
    if (!balanced || balanced.end !== value.length - 1) break;
    value = balanced.expression.trim();
  }
  return value;
}

function evaluateExpression(raw, environment, context) {
  const expression = stripOuterParens(raw);
  const quoted = parseQuoted(expression);
  if (quoted !== undefined) return quoted;
  if (Object.prototype.hasOwnProperty.call(environment, expression)) return environment[expression];
  if (expression === '__dirname') return context.dirname;
  if (/^process\.cwd\(\)$/.test(expression)) return context.runtimeRoot;

  const plus = splitTopLevel(expression, '+');
  if (plus.length > 1) {
    const values = plus.map((part) => evaluateExpression(part, environment, context));
    return values.every((value) => typeof value === 'string') ? values.join('') : undefined;
  }

  const pathCall = expression.match(/^path\.(join|resolve)\s*\(/);
  if (pathCall) {
    const openIndex = expression.indexOf('(');
    const balanced = readBalanced(expression, openIndex);
    if (!balanced || balanced.end !== expression.length - 1) return undefined;
    const values = splitTopLevel(balanced.expression, ',')
      .map((part) => evaluateExpression(part, environment, context));
    if (!values.length || values.some((value) => typeof value !== 'string')) return undefined;
    return path[pathCall[1]](...values);
  }
  return undefined;
}

function symbolicEnvironment(source, context) {
  const environment = {
    projectRoot: context.runtimeRoot,
    repoRoot: context.runtimeRoot,
    root: context.runtimeRoot,
  };
  const pending = constantExpressions(source);
  for (let pass = 0; pass <= pending.length; pass += 1) {
    let changed = false;
    for (const [name, expression] of pending) {
      if (Object.prototype.hasOwnProperty.call(environment, name)) continue;
      const value = evaluateExpression(expression, environment, context);
      if (typeof value === 'string') {
        environment[name] = value;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return environment;
}

function resolveNodeFile(requestPath) {
  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = requestPath + extension;
    try {
      if (fs.statSync(candidate).isFile()) return { file: candidate, support: [] };
    } catch (_) { /* Try the next Node resolution form. */ }
  }
  try {
    if (fs.statSync(requestPath).isDirectory()) {
      const packagePath = path.join(requestPath, 'package.json');
      if (fs.existsSync(packagePath)) {
        const packageRow = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        if (typeof packageRow.main === 'string') {
          const main = resolveNodeFile(path.resolve(requestPath, packageRow.main));
          if (main) return { file: main.file, support: [packagePath, ...main.support] };
        }
      }
      for (const extension of ['.js', '.cjs', '.json']) {
        const indexPath = path.join(requestPath, `index${extension}`);
        if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
          return { file: indexPath, support: [] };
        }
      }
    }
  } catch (_) { /* Report unresolved below. */ }
  return null;
}

function packageName(request) {
  const normalized = posix(request);
  const marker = '/node_modules/';
  const markerIndex = normalized.lastIndexOf(marker);
  const bare = markerIndex >= 0 ? normalized.slice(markerIndex + marker.length) : normalized;
  const parts = bare.split('/');
  return bare.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function loadManifest(options, sgsdRoot) {
  if (options.manifest) return JSON.parse(JSON.stringify(options.manifest));
  const manifestPath = path.resolve(options.manifestPath
    || path.join(sgsdRoot, 'config', 'hook-manifest.json'));
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

function computeHookDependencyGraph(options = {}) {
  const sgsdRoot = path.resolve(options.sgsdRoot || DEFAULT_ROOT);
  const runtimeRoot = path.resolve(options.projectDir || path.dirname(sgsdRoot));
  const runtimeSgsdRoot = path.join(runtimeRoot, 'super-gsd');
  const manifest = loadManifest(options, sgsdRoot);
  const selected = manifest.entries.filter((entry) => Array.isArray(entry.distribution_targets)
    && entry.distribution_targets.some((target) => PROJECT_TARGETS.has(target)));
  const packages = new Map();
  const packageLocations = new Map();
  const entries = [];
  const union = new Map();

  for (const manifestEntry of selected) {
    const rootRelative = posix(manifestEntry.source_path);
    const rootSource = path.resolve(sgsdRoot, rootRelative);
    if (!inside(sgsdRoot, rootSource) || !fs.existsSync(rootSource)) {
      throw dependencyError('MODULE_NOT_FOUND', rootRelative, rootRelative, rootRelative,
        path.join(runtimeSgsdRoot, rootRelative),
        inside(sgsdRoot, rootSource) ? 'source module is missing' : 'source escapes root');
    }
    const closure = new Set();
    const visited = new Set();
    const entryPackages = new Set();

    function addFile(absolutePath) {
      const resolved = path.resolve(absolutePath);
      if (!inside(sgsdRoot, resolved)) {
        throw dependencyError('MODULE_NOT_FOUND', rootRelative, resolved, null, resolved,
          'resolved dependency escapes root');
      }
      closure.add(posix(path.relative(sgsdRoot, resolved)));
    }

    function walk(sourcePath) {
      const canonical = path.resolve(sourcePath);
      if (visited.has(canonical)) return;
      visited.add(canonical);
      if (path.extname(canonical) === '.json') return;
      const source = fs.readFileSync(canonical, 'utf8');
      const context = { dirname: path.dirname(canonical), runtimeRoot };
      const environment = symbolicEnvironment(source, context);
      for (const expression of scanRequires(source)) {
        const request = evaluateExpression(expression, environment, context);
        if (typeof request !== 'string') {
          throw dependencyError('MODULE_NOT_FOUND', posix(path.relative(sgsdRoot, canonical)),
            expression, null, null, 'unresolved dynamic local require');
        }
        if (BUILTINS.has(request)) continue;
        if (!request.startsWith('.') && !path.isAbsolute(request)) {
          const name = packageName(request);
          if (!packages.has(name)) packages.set(name, new Set());
          packages.get(name).add(rootRelative);
          entryPackages.add(name);
          if (!packageLocations.has(name)) {
            let location = null;
            try { location = require.resolve(request, { paths: [path.dirname(canonical)] }); } catch (_) { /* Classified absent package. */ }
            packageLocations.set(name, location);
          }
          continue;
        }
        if (posix(request).includes('/node_modules/')) {
          const name = packageName(request);
          if (!packages.has(name)) packages.set(name, new Set());
          packages.get(name).add(rootRelative);
          entryPackages.add(name);
          if (!packageLocations.has(name)) packageLocations.set(name, request);
          continue;
        }
        let requestedPath;
        if (path.isAbsolute(request)) {
          if (inside(runtimeSgsdRoot, request)) {
            requestedPath = path.join(sgsdRoot, path.relative(runtimeSgsdRoot, request));
          } else if (inside(sgsdRoot, request)) {
            requestedPath = request;
          } else {
            throw dependencyError('MODULE_NOT_FOUND', posix(path.relative(sgsdRoot, canonical)),
              expression, request, request, 'resolved dependency escapes root');
          }
        } else {
          requestedPath = path.resolve(path.dirname(canonical), request);
        }
        if (!inside(sgsdRoot, requestedPath)) {
          throw dependencyError('MODULE_NOT_FOUND', posix(path.relative(sgsdRoot, canonical)),
            expression, request, requestedPath, 'resolved dependency escapes root');
        }
        const resolution = resolveNodeFile(requestedPath);
        if (!resolution) {
          const targetMissingPath = inside(sgsdRoot, requestedPath)
            ? path.join(runtimeSgsdRoot, path.relative(sgsdRoot, requestedPath))
            : requestedPath;
          throw dependencyError('MODULE_NOT_FOUND', posix(path.relative(sgsdRoot, canonical)),
            expression, request, targetMissingPath, 'source module is missing');
        }
        for (const supportPath of resolution.support) addFile(supportPath);
        addFile(resolution.file);
        walk(resolution.file);
      }
    }

    walk(rootSource);
    closure.delete(rootRelative);
    const dependencies = [...closure].sort();
    const entryRow = {
      source_path: rootRelative,
      source_absolute_path: rootSource,
      target_path: path.join(runtimeSgsdRoot, rootRelative),
      sha256: digest(fs.readFileSync(rootSource)),
      dependencies,
      required_files: [rootRelative, ...dependencies].sort(),
      packages: [...entryPackages].sort(),
    };
    entries.push(entryRow);
    for (const relative of entryRow.required_files) {
      if (!union.has(relative)) union.set(relative, new Set());
      union.get(relative).add(rootRelative);
    }
  }

  const files = [...union.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([relative, requiredBy]) => {
      const sourcePath = path.join(sgsdRoot, relative);
      return {
        relative_path: relative,
        source_path: sourcePath,
        target_path: path.join(runtimeSgsdRoot, relative),
        sha256: digest(fs.readFileSync(sourcePath)),
        required_by: [...requiredBy].sort(),
      };
    });
  return {
    sgsd_root: sgsdRoot,
    project_dir: runtimeRoot,
    manifest,
    entries: entries.sort((left, right) => left.source_path.localeCompare(right.source_path)),
    files,
    union: files.map((row) => row.relative_path),
    packages: [...packages.entries()].sort(([left], [right]) => left.localeCompare(right))
      .map(([name, requiredBy]) => ({
        package: name,
        required_by: [...requiredBy].sort(),
        source_path: packageLocations.get(name) || null,
        present: Boolean(packageLocations.get(name) && fs.existsSync(packageLocations.get(name))),
      })),
    source_errors: [],
  };
}

function renderManifestDependencies(manifestOrGraph, maybeGraph) {
  const graph = maybeGraph || manifestOrGraph;
  const manifest = maybeGraph ? manifestOrGraph : graph.manifest;
  const dependencies = new Map(graph.entries.map((entry) => [entry.source_path, entry.dependencies]));
  const rendered = JSON.parse(JSON.stringify(manifest));
  for (const entry of rendered.entries) {
    entry.dependencies = dependencies.get(posix(entry.source_path)) || [];
  }
  return rendered;
}

function findProjectRoot(start) {
  let current = path.resolve(start || process.cwd());
  for (;;) {
    if (fs.existsSync(path.join(current, '.planning'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start || process.cwd());
    current = parent;
  }
}

function manifestDependencyDrift(manifest, rendered) {
  const stale = [];
  for (let index = 0; index < rendered.entries.length; index += 1) {
    const expected = rendered.entries[index].dependencies || [];
    const actual = manifest.entries[index].dependencies || [];
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      stale.push({
        source_path: rendered.entries[index].source_path,
        expected,
        actual,
      });
    }
  }
  return stale;
}

function inspectProjectInstall(options = {}) {
  const projectDir = options.projectDir === undefined
    ? findProjectRoot(options.cwd)
    : path.resolve(options.projectDir);
  const graph = computeHookDependencyGraph({ ...options, projectDir });
  const rendered = renderManifestDependencies(graph.manifest, graph);
  const manifest_drift = manifestDependencyDrift(graph.manifest, rendered);
  if (options.checkManifest !== false && manifest_drift.length) {
    const error = new Error('hook manifest dependencies are stale: '
      + manifest_drift.map((row) => row.source_path).join(', '));
    error.code = 'HOOK_MANIFEST_STALE';
    error.stale_paths = manifest_drift.map((row) => row.source_path);
    throw error;
  }
  const rootByDependency = new Map();
  const rootSources = new Set(graph.entries.map((entry) => entry.source_path));
  for (const entry of graph.entries) {
    for (const relative of entry.required_files) {
      if (!rootByDependency.has(relative)) rootByDependency.set(relative, []);
      rootByDependency.get(relative).push(entry.source_path);
    }
  }
  const requiredFiles = graph.files.map((row) => {
    let actual = null;
    try { actual = digest(fs.readFileSync(row.target_path)); } catch (_) { /* Missing target. */ }
    return {
      ...row,
      kind: rootSources.has(row.relative_path) ? 'hook' : 'module',
      root_source_path: rootByDependency.get(row.relative_path).sort()[0],
      expected_sha256: row.sha256,
      actual_sha256: actual,
      status: actual === null ? 'missing' : actual === row.sha256 ? 'current' : 'stale',
    };
  });
  const entryStatus = graph.entries.map((entry) => {
    const rows = requiredFiles.filter((row) => row.required_by.includes(entry.source_path));
    return {
      source_path: entry.source_path,
      dependencies: entry.dependencies,
      requiredFiles: rows,
      missing: rows.filter((row) => row.status === 'missing'),
      stale: rows.filter((row) => row.status === 'stale'),
      current: rows.filter((row) => row.status === 'current'),
      status: rows.every((row) => row.status === 'current') ? 'current' : 'missing_or_stale',
    };
  });
  return {
    ok: requiredFiles.every((row) => row.status === 'current'),
    project_dir: projectDir,
    sgsd_root: graph.sgsd_root,
    canonical_source_revision: options.canonicalSourceRevision || null,
    graph,
    manifest_drift,
    entries: entryStatus,
    requiredFiles,
    missing: requiredFiles.filter((row) => row.status === 'missing'),
    stale: requiredFiles.filter((row) => row.status === 'stale'),
    current: requiredFiles.filter((row) => row.status === 'current'),
  };
}

function formatProjectInstallStatus(report) {
  if (!report || !Array.isArray(report.requiredFiles)) {
    throw new TypeError('formatProjectInstallStatus requires an inspectProjectInstall report');
  }
  const rows = report.requiredFiles.map((row) => {
    if (row.kind !== 'hook' && row.kind !== 'module') {
      throw new TypeError('project install status row has no hook/module kind');
    }
    return { ...row, relative_path: posix(row.relative_path) };
  });
  const lines = [
    'Project install status: ' + (report.ok ? 'current' : 'drift'),
    'Project directory: ' + posix(path.resolve(report.project_dir)),
    'Canonical source revision: '
      + boundedMessage(report.canonical_source_revision || 'unavailable'),
  ];
  for (const [status, heading] of [
    ['missing', 'Missing'],
    ['stale', 'Stale'],
  ]) {
    for (const [kind, label] of [['hook', 'hooks'], ['module', 'modules']]) {
      const selected = rows.filter((row) => row.status === status && row.kind === kind);
      lines.push(heading + ' ' + label + ': ' + selected.length);
      for (const row of selected) {
        lines.push('  ' + kind + ' path=' + row.relative_path
          + ' expected_sha256=' + row.expected_sha256
          + ' actual_sha256=' + (row.actual_sha256 || '<missing>'));
      }
    }
  }
  const currentHooks = rows.filter(
    (row) => row.status === 'current' && row.kind === 'hook',
  ).length;
  const currentModules = rows.filter(
    (row) => row.status === 'current' && row.kind === 'module',
  ).length;
  lines.push('Current rows: hooks=' + currentHooks + ' modules=' + currentModules
    + ' total=' + (currentHooks + currentModules) + '/' + rows.length);
  return lines.join('\n') + '\n';
}

function copyCandidateRows(report, candidateRoot) {
  fs.mkdirSync(path.join(candidateRoot, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(candidateRoot, '.planning', 'config.json'), '{}\n');
  const rows = [];
  for (const required of report.requiredFiles) {
    const candidatePath = path.join(candidateRoot, 'super-gsd', required.relative_path);
    const bytes = fs.readFileSync(required.source_path);
    fs.mkdirSync(path.dirname(candidatePath), { recursive: true });
    fs.writeFileSync(candidatePath, bytes);
    fs.chmodSync(candidatePath, fs.statSync(required.source_path).mode);
    rows.push({
      ...required,
      candidate_path: candidatePath,
      candidate_sha256: digest(bytes),
      publication_path: required.target_path,
    });
  }
  for (const [sourceRelative, targetRelative] of [
    ['config/repo-settings-overlay.json', '.claude/settings.json'],
    ['config/codex-hooks.json', '.codex/hooks.json'],
  ]) {
    const sourcePath = path.join(report.sgsd_root, sourceRelative);
    if (!fs.existsSync(sourcePath)) continue;
    const targetPath = path.join(candidateRoot, targetRelative);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
  return rows;
}

function manifestSmokeDescriptors(manifest, candidateRoot) {
  const descriptors = [];
  const seen = new Set();
  for (const entry of manifest.entries) {
    if (!entry.distribution_targets.some((target) => PROJECT_TARGETS.has(target))) continue;
    for (const disposition of entry.dispositions || []) {
      const event = disposition.kind === 'registered'
        ? disposition.event
        : disposition.smoke_event;
      if (!event) continue;
      const command = typeof disposition.command === 'string'
        ? disposition.command.trim().split(/\s+/)
        : [];
      const argv = command.length >= 2 ? command.slice(2) : [];
      const scriptPath = path.join(candidateRoot, 'super-gsd', entry.source_path);
      const identity = JSON.stringify([entry.source_path, event, argv]);
      if (seen.has(identity)) continue;
      seen.add(identity);
      descriptors.push({
        event,
        hookId: disposition.hook_id || `${event}-${path.basename(entry.source_path)}`,
        interpreter: entry.interpreter,
        scriptPath,
        argv,
        matcher: disposition.matcher || null,
        timeout: disposition.timeout_seconds || disposition.smoke_timeout_seconds || null,
      });
    }
  }
  return descriptors;
}

function isolatedCandidateEnv(candidateRoot) {
  const home = path.join(candidateRoot, '.home');
  const rows = {
    HOME: home,
    USERPROFILE: home,
    APPDATA: path.join(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_DATA_HOME: path.join(home, '.local', 'share'),
    XDG_STATE_HOME: path.join(home, '.local', 'state'),
    XDG_CACHE_HOME: path.join(home, '.cache'),
    TMPDIR: path.join(candidateRoot, '.tmp'),
    TEMP: path.join(candidateRoot, '.tmp'),
    TMP: path.join(candidateRoot, '.tmp'),
  };
  for (const directory of new Set(Object.values(rows))) fs.mkdirSync(directory, { recursive: true });
  for (const name of ['PATH', 'SystemRoot', 'ComSpec', 'PATHEXT', 'WINDIR', 'LANG', 'LC_ALL']) {
    if (process.env[name]) rows[name] = process.env[name];
  }
  return rows;
}

async function smokeCandidateProject(report, candidateRoot, options = {}) {
  const preflight = require('./hook-registration-preflight.cjs');
  const descriptors = manifestSmokeDescriptors(report.graph.manifest, candidateRoot);
  if (!descriptors.length) throw new Error('candidate hook descriptor set is empty');
  const environment = isolatedCandidateEnv(candidateRoot);
  try {
    await preflight.smokeHookRegistrations(descriptors, {
      bashPath: options.bashPath || process.env.SGSD_BASH_PATH || 'bash',
      candidateRoot,
      cwd: candidateRoot,
      env: environment,
      home: environment.HOME,
      targetRoot: report.project_dir,
    });
  } catch (error) {
    if (error && error.code === 'hook_smoke_failed') throw error;
    throw error;
  }
  return descriptors;
}

function validateSealedRows(rows) {
  for (const row of rows) {
    const sourceDigest = digest(fs.readFileSync(row.source_path));
    const candidateDigest = digest(fs.readFileSync(row.candidate_path));
    if (sourceDigest !== row.expected_sha256 || candidateDigest !== row.expected_sha256) {
      const error = new Error(`candidate digest changed before publication: ${row.relative_path}`);
      error.code = 'HOOK_CANDIDATE_DIGEST_CHANGED';
      throw error;
    }
  }
}

function publishSealedRows(rows) {
  const snapshots = [];
  const actions = [];
  try {
    for (const row of rows.filter((candidate) => candidate.status !== 'current')) {
      let previous = null;
      let mode = null;
      if (fs.existsSync(row.publication_path)) {
        previous = fs.readFileSync(row.publication_path);
        mode = fs.statSync(row.publication_path).mode;
      }
      snapshots.push({ path: row.publication_path, previous, mode });
      fs.mkdirSync(path.dirname(row.publication_path), { recursive: true });
      fs.writeFileSync(row.publication_path, fs.readFileSync(row.candidate_path));
      if (mode !== null) fs.chmodSync(row.publication_path, mode);
      actions.push({
        action: 'publish_project_hook_dependency',
        relative_path: row.relative_path,
        target_path: row.publication_path,
        sha256: row.expected_sha256,
        required_by: row.required_by,
      });
    }
    return actions;
  } catch (error) {
    for (const snapshot of snapshots.reverse()) {
      try {
        if (snapshot.previous === null) fs.rmSync(snapshot.path, { force: true });
        else {
          fs.mkdirSync(path.dirname(snapshot.path), { recursive: true });
          fs.writeFileSync(snapshot.path, snapshot.previous);
          if (snapshot.mode !== null) fs.chmodSync(snapshot.path, snapshot.mode);
        }
      } catch (_) { /* Preserve the mechanical publication failure. */ }
    }
    throw error;
  }
}

async function applyProjectInstall(reportOrOptions = {}, options = {}) {
  const report = Array.isArray(reportOrOptions.requiredFiles)
    ? reportOrOptions
    : inspectProjectInstall(reportOrOptions);
  const candidateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-install-candidate-'));
  try {
    const candidateRows = copyCandidateRows(report, candidateRoot);
    validateSealedRows(candidateRows);
    if (options.smoke !== false) await smokeCandidateProject(report, candidateRoot, options);
    validateSealedRows(candidateRows);
    const actions = publishSealedRows(candidateRows);
    return { ok: true, candidate_root: candidateRoot, rows: candidateRows, actions };
  } finally {
    try { fs.rmSync(candidateRoot, { recursive: true, force: true }); } catch (_) { /* Best effort. */ }
  }
}

async function prepareProjectInstall(options = {}) {
  const report = inspectProjectInstall(options);
  const missingPackage = report.graph.packages.find((row) => !row.present);
  if (missingPackage) {
    throw dependencyError('MODULE_NOT_FOUND', missingPackage.required_by[0],
      missingPackage.package, missingPackage.package, null, 'required package is missing');
  }
  const candidateRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-install-candidate-'));
  try {
    const rows = copyCandidateRows(report, candidateRoot);
    validateSealedRows(rows);
    await smokeCandidateProject(report, candidateRoot, options);
    validateSealedRows(rows);
    const descriptorPath = path.join(candidateRoot, '.sgsd-install-candidate.json');
    fs.writeFileSync(descriptorPath, JSON.stringify({
      schema_version: 1,
      candidate_root: candidateRoot,
      project_dir: report.project_dir,
      rows,
    }, null, 2) + '\n');
    return { candidateRoot, descriptorPath, report, rows };
  } catch (error) {
    try { fs.rmSync(candidateRoot, { recursive: true, force: true }); } catch (_) { /* Best effort. */ }
    throw error;
  }
}

function applyPreparedProjectInstall(descriptorPath) {
  const resolved = path.resolve(descriptorPath);
  const descriptor = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!descriptor || descriptor.schema_version !== 1
      || path.resolve(descriptor.candidate_root) !== path.dirname(resolved)
      || !Array.isArray(descriptor.rows)) {
    throw new Error('invalid sealed install candidate descriptor');
  }
  try {
    validateSealedRows(descriptor.rows);
    const actions = publishSealedRows(descriptor.rows);
    return { ok: true, actions, rows: descriptor.rows };
  } finally {
    try { fs.rmSync(descriptor.candidate_root, { recursive: true, force: true }); } catch (_) { /* Best effort. */ }
  }
}

function boundedUnderlyingError(error) {
  const raw = error && (error.underlyingError || error.underlying_error);
  if (raw) return raw;
  if (!error || error.code !== 'MODULE_NOT_FOUND') return null;
  return {
    code: 'MODULE_NOT_FOUND',
    request: error.request || null,
    path: error.resolved_path || null,
    message: boundedMessage(error.message),
  };
}

function argValue(argv, name) {
  const index = argv.indexOf(name);
  if (index >= 0) return argv[index + 1];
  const prefixed = argv.find((row) => row.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : null;
}

async function cli(argv) {
  const sgsdRoot = path.resolve(argValue(argv, '--sgsd-root') || DEFAULT_ROOT);
  const manifestPath = path.resolve(argValue(argv, '--manifest')
    || path.join(sgsdRoot, 'config', 'hook-manifest.json'));
  const projectDir = argValue(argv, '--project-dir');
  if (argv.includes('--prepare-candidate')) {
    if (!projectDir) throw new Error('--project-dir is required for candidate preparation');
    const prepared = await prepareProjectInstall({
      sgsdRoot,
      manifestPath,
      projectDir: path.resolve(projectDir),
    });
    process.stdout.write(prepared.descriptorPath + '\n');
    return 0;
  }
  if (argv.includes('--apply-candidate')) {
    const descriptorPath = argValue(argv, '--apply-candidate');
    if (!descriptorPath) throw new Error('--apply-candidate requires a descriptor path');
    const applied = applyPreparedProjectInstall(descriptorPath);
    process.stdout.write(JSON.stringify({ ok: true, actions: applied.actions }) + '\n');
    return 0;
  }
  if (argv.includes('--discard-candidate')) {
    const descriptorPath = argValue(argv, '--discard-candidate');
    if (!descriptorPath) return 0;
    const resolved = path.resolve(descriptorPath);
    const candidateRoot = path.dirname(resolved);
    const expectedPrefix = path.resolve(os.tmpdir(), 'sgsd-install-candidate-');
    if (candidateRoot.startsWith(expectedPrefix) && fs.existsSync(resolved)) {
      fs.rmSync(candidateRoot, { recursive: true, force: true });
    }
    return 0;
  }
  if (argv.includes('--format-project-status')) {
    const report = inspectProjectInstall({
      sgsdRoot,
      manifestPath,
      projectDir,
      canonicalSourceRevision: argValue(argv, '--canonical-source-revision') || 'unavailable',
    });
    process.stdout.write(formatProjectInstallStatus(report));
    return report.ok ? 0 : 10;
  }
  if (argv.includes('--inspect-project')) {
    const report = inspectProjectInstall({ sgsdRoot, manifestPath, projectDir });
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    return report.ok ? 0 : 2;
  }
  if (argv.includes('--write-manifest') || argv.includes('--check-manifest')) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const graph = computeHookDependencyGraph({ sgsdRoot, manifest });
    const rendered = renderManifestDependencies(manifest, graph);
    const drift = manifestDependencyDrift(manifest, rendered);
    if (argv.includes('--write-manifest')) {
      fs.writeFileSync(manifestPath, JSON.stringify(rendered, null, 2) + '\n');
      process.stdout.write(`hook manifest dependencies written: ${manifestPath}\n`);
      return 0;
    }
    if (drift.length) {
      process.stderr.write('hook manifest dependencies stale: '
        + drift.map((row) => row.source_path).join(', ') + '\n');
      return 2;
    }
    process.stdout.write('hook manifest dependencies current\n');
    return 0;
  }
  process.stderr.write('Usage: hook-install-contract.cjs --check-manifest|--write-manifest'
    + '|--prepare-candidate --project-dir DIR|--apply-candidate FILE'
    + '|--inspect-project|--format-project-status\n');
  return 64;
}

if (require.main === module) {
  cli(process.argv.slice(2)).then((status) => {
    process.exitCode = status;
  }, (error) => {
    const underlying = boundedUnderlyingError(error);
    const closedReason = error && error.code === 'hook_smoke_failed'
      ? 'hook_smoke_failed'
      : error && error.code === 'MODULE_NOT_FOUND'
        ? 'hook_smoke_failed'
        : 'hook_install_contract_failed';
    process.stderr.write(JSON.stringify({
      ok: false,
      reason: closedReason,
      underlying_error: underlying,
    }) + '\n');
    process.exitCode = 2;
  });
}

module.exports = {
  applyProjectInstall,
  applyPreparedProjectInstall,
  computeHookDependencyGraph,
  formatProjectInstallStatus,
  inspectProjectInstall,
  prepareProjectInstall,
  renderManifestDependencies,
};

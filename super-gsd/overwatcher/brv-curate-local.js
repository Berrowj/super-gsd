#!/usr/bin/env node
/**
 * BRV Curate Local — Write context entries to context tree
 *
 * Writes a .md file with YAML frontmatter to .brv/context-tree/{domain}/
 * Uses atomic write pattern (.tmp + renameSync) to prevent partial writes.
 * No external dependencies — fs + path only.
 *
 * Usage:
 *   node brv-curate-local.js "body content" --domain scripts/nodejs --title "My Script" \
 *     --importance 70 --maturity validated --tags "node,cli" --keywords "script,utility"
 *
 * Defaults:
 *   --domain    patterns/general
 *   --importance 60
 *   --maturity  draft
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── Args ───
const args = process.argv.slice(2);

function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

// Positional: first non-flag arg is the body
const body = args.find(a => !a.startsWith('--')) || '';
const title = getArg('--title') || '';
const domain = getArg('--domain') || 'patterns/general';
const importance = parseInt(getArg('--importance') || '60', 10);
const maturity = getArg('--maturity') || 'draft';
const tagsRaw = getArg('--tags') || '';
const keywordsRaw = getArg('--keywords') || '';

if (!body) {
  process.stderr.write('Error: body content is required as first positional argument\n');
  process.exit(1);
}

if (!title) {
  process.stderr.write('Error: --title is required\n');
  process.exit(1);
}

// ─── Validate domain (T-02-03: prevent path traversal) ───
if (!/^[a-z0-9/_-]+$/.test(domain)) {
  process.stderr.write('Error: --domain must match /^[a-z0-9/_-]+$/ (no spaces, no dots, no ..)\n');
  process.exit(1);
}

// ─── Slug generation ───
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Parse comma-separated list ───
function parseList(raw) {
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

// ─── YAML block sequence serialization ───
function yamlList(items) {
  if (!items || items.length === 0) return '[]\n';
  return '\n' + items.map(i => `  - ${i}`).join('\n') + '\n';
}

// ─── Find context tree (mirror brv-query-local.js verbatim) ───
function findContextTree() {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    const ct = path.join(dir, '.brv', 'context-tree');
    if (fs.existsSync(ct)) return ct;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ─── Main ───
const ctRoot = findContextTree();
if (!ctRoot) {
  process.stderr.write('Error: No .brv/context-tree/ found (walked up 10 levels from cwd)\n');
  process.exit(1);
}

const tags = parseList(tagsRaw);
const keywords = parseList(keywordsRaw);
const slug = slugify(title);
const domainDir = path.join(ctRoot, domain);

// Create intermediate directories
fs.mkdirSync(domainDir, { recursive: true });

// Build YAML frontmatter
const frontmatter = [
  '---',
  `title: "${title.replace(/"/g, '\\"')}"`,
  `importance: ${importance}`,
  `maturity: ${maturity}`,
  `tags:${yamlList(tags)}`,
  `keywords:${yamlList(keywords)}`,
  '---',
].join('\n');

const fileContent = frontmatter + '\n\n' + body + '\n';

// Atomic write: .tmp then renameSync (T-02-01)
const destPath = path.join(domainDir, slug + '.md');
const tmpPath = destPath + '.tmp';

try {
  fs.writeFileSync(tmpPath, fileContent, 'utf8');
  fs.renameSync(tmpPath, destPath);
} catch (err) {
  process.stderr.write(`Error writing file: ${err.message}\n`);
  // Clean up tmp if it exists
  try { fs.unlinkSync(tmpPath); } catch (_) {}
  process.exit(1);
}

// Relative path for output (relative to cwd)
const relPath = path.relative(process.cwd(), destPath);
console.log(`CURATED: ${relPath}`);
process.exit(0);

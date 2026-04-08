#!/usr/bin/env node
/**
 * BRV Query Local — API-free context tree search
 *
 * Searches .brv/context-tree/ using BM25-style term matching
 * against frontmatter (title, tags, keywords) and body content.
 * No external LLM needed — runs entirely on local file reads.
 *
 * Usage:
 *   node brv-query-local.js "dispatch rules autonomous loop"
 *   node brv-query-local.js "commit discipline atomic" --max 3
 *   node brv-query-local.js "scripts utility reuse" --domain scripts
 *
 * Output: JSON array of matches with path, score, title, snippet
 */

const fs = require('fs');
const path = require('path');

// ─── Args ───
const args = process.argv.slice(2);
const queryIdx = args.findIndex(a => !a.startsWith('--'));
const query = queryIdx >= 0 ? args[queryIdx] : '';
const maxIdx = args.indexOf('--max');
const maxResults = maxIdx >= 0 ? parseInt(args[maxIdx + 1]) : 5;
const domainIdx = args.indexOf('--domain');
const domainFilter = domainIdx >= 0 ? args[domainIdx + 1] : null;
const formatIdx = args.indexOf('--format');
const format = formatIdx >= 0 ? args[formatIdx + 1] : 'text';

if (!query) {
  console.error('Usage: brv-query-local "search terms" [--max N] [--domain NAME] [--format text|json]');
  process.exit(1);
}

// ─── Find context tree ───
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

// ─── Parse frontmatter ───
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { fm: {}, body: content };

  const fm = {};
  const lines = match[1].split('\n');
  let currentKey = null;

  for (const line of lines) {
    const kv = line.match(/^(\w[\w_-]*)\s*:\s*(.*)$/);
    if (kv) {
      currentKey = kv[1];
      const val = kv[2].trim();
      if (val.startsWith('[')) {
        try { fm[currentKey] = JSON.parse(val); } catch { fm[currentKey] = val; }
      } else {
        fm[currentKey] = val.replace(/^["']|["']$/g, '');
      }
    } else if (line.match(/^\s+-\s+/) && currentKey) {
      if (!Array.isArray(fm[currentKey])) fm[currentKey] = [];
      fm[currentKey].push(line.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''));
    }
  }

  return { fm, body: content.slice(match[0].length).trim() };
}

// ─── Tokenize ───
function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-_]/g, ' ').split(/\s+/).filter(t => t.length > 2);
}

// ─── Score a document against query terms ───
function scoreDocument(doc, queryTerms) {
  const titleTokens = tokenize(doc.title || '');
  const tagTokens = (doc.tags || []).flatMap(t => tokenize(t));
  const keywordTokens = (doc.keywords || []).flatMap(k => tokenize(k));
  const bodyTokens = tokenize(doc.body || '');

  let score = 0;

  for (const qt of queryTerms) {
    // Title match (highest weight)
    if (titleTokens.some(t => t.includes(qt) || qt.includes(t))) score += 10;

    // Tag match (high weight)
    if (tagTokens.some(t => t === qt)) score += 8;

    // Keyword match (high weight)
    if (keywordTokens.some(k => k === qt || k.includes(qt))) score += 7;

    // Body match (lower weight, with frequency)
    const bodyHits = bodyTokens.filter(t => t.includes(qt) || qt.includes(t)).length;
    score += Math.min(bodyHits, 5) * 1.5; // Cap at 5 hits to prevent long docs dominating
  }

  // Importance boost
  const importance = parseInt(doc.importance) || 50;
  score *= (1 + (importance - 50) / 200); // +/-25% based on importance

  // Maturity boost
  if (doc.maturity === 'core') score *= 1.15;
  else if (doc.maturity === 'validated') score *= 1.08;

  return Math.round(score * 100) / 100;
}

// ─── Extract snippet ───
function extractSnippet(body, queryTerms, maxLen = 200) {
  const lines = body.split('\n').filter(l => l.trim());

  // Find first line containing a query term
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (queryTerms.some(qt => lower.includes(qt))) {
      return line.trim().substring(0, maxLen);
    }
  }

  // Fallback: first non-header line
  const firstContent = lines.find(l => !l.startsWith('#') && !l.startsWith('---'));
  return (firstContent || lines[0] || '').trim().substring(0, maxLen);
}

// ─── Main ───
const ctRoot = findContextTree();
if (!ctRoot) {
  console.error('No .brv/context-tree/ found');
  process.exit(1);
}

// Collect all .md files
function walkDir(dir) {
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== '_archived') {
        results.push(...walkDir(full));
      } else if (entry.isFile() && entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
        results.push(full);
      }
    }
  } catch (e) {}
  return results;
}

const files = walkDir(ctRoot);
const queryTerms = tokenize(query);
const results = [];

for (const filePath of files) {
  const relPath = path.relative(ctRoot, filePath);

  // Domain filter
  if (domainFilter && !relPath.startsWith(domainFilter)) continue;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { fm, body } = parseFrontmatter(content);

    const doc = {
      path: relPath,
      title: fm.title || path.basename(filePath, '.md'),
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      keywords: Array.isArray(fm.keywords) ? fm.keywords : [],
      importance: fm.importance,
      maturity: fm.maturity,
      body: body
    };

    const score = scoreDocument(doc, queryTerms);
    if (score > 0) {
      results.push({
        path: relPath,
        title: doc.title,
        score,
        importance: doc.importance || 50,
        maturity: doc.maturity || 'draft',
        snippet: extractSnippet(body, queryTerms)
      });
    }
  } catch (e) {}
}

// Sort by score descending
results.sort((a, b) => b.score - a.score);
const topResults = results.slice(0, maxResults);

if (format === 'json') {
  console.log(JSON.stringify(topResults, null, 2));
} else {
  if (topResults.length === 0) {
    console.log(`No results for: "${query}"`);
  } else {
    for (const r of topResults) {
      console.log(`[${r.score}] ${r.title} (${r.maturity}, imp:${r.importance})`);
      console.log(`  ${r.path}`);
      console.log(`  ${r.snippet}`);
      console.log('');
    }
  }
}

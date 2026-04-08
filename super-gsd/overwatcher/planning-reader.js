#!/usr/bin/env node
/**
 * Planning Reader — .planning/ Directory → GraphModel
 *
 * Replaces gsd-reader.js (SQLite) for Super GSD.
 * Reads markdown files from .planning/ and produces the same GraphModel
 * that the analysis and renderer modules expect.
 *
 * Usage:
 *   const { readPlanningDirectory } = require('./planning-reader');
 *   const graph = readPlanningDirectory({ projectRoot: process.cwd() });
 */

const fs = require('fs');
const path = require('path');

// ─── YAML Frontmatter Parser (lightweight, no dependencies) ───

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const fmLines = match[1].split('\n');
  const fm = {};
  let currentKey = null;
  let currentArray = null;

  for (const line of fmLines) {
    const kvMatch = line.match(/^(\w[\w_-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      const val = kvMatch[2].trim();
      if (val === '' || val === '|' || val === '>') {
        fm[currentKey] = '';
        currentArray = null;
      } else if (val.startsWith('[')) {
        try { fm[currentKey] = JSON.parse(val); } catch { fm[currentKey] = val; }
        currentArray = null;
      } else {
        fm[currentKey] = val.replace(/^["']|["']$/g, '');
        currentArray = null;
      }
    } else if (line.match(/^\s+-\s+/)) {
      if (!Array.isArray(fm[currentKey])) fm[currentKey] = [];
      fm[currentKey].push(line.replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''));
    }
  }

  return { frontmatter: fm, body: content.slice(match[0].length).trim() };
}

// ─── Checkbox Parser ───

function parseCheckboxes(content) {
  const items = [];
  const regex = /^[-*]\s+\[([ xX])\]\s+(.+)$/gm;
  let m;
  while ((m = regex.exec(content)) !== null) {
    items.push({
      checked: m[1].toLowerCase() === 'x',
      text: m[2].trim()
    });
  }
  return items;
}

// ─── Main Reader ───

function readPlanningDirectory(options) {
  const projectRoot = options.projectRoot || process.cwd();
  const planningDir = path.join(projectRoot, '.planning');

  if (!fs.existsSync(planningDir)) {
    throw new Error(`No .planning/ directory found at ${projectRoot}`);
  }

  const nodes = {};
  const edges = [];
  const nodeSet = new Set();
  const edgeSet = new Set();

  function addNode(node) {
    if (!nodeSet.has(node.id)) {
      nodeSet.add(node.id);
      nodes[node.id] = node;
    }
  }

  function addEdge(edge) {
    if (!edgeSet.has(edge.id)) {
      edgeSet.add(edge.id);
      edges.push(edge);
    }
  }

  // ── 1. Parse ROADMAP.md for milestone + phases ──

  const roadmapPath = path.join(planningDir, 'ROADMAP.md');
  let milestoneId = 'v1.0';
  let phases = [];

  if (fs.existsSync(roadmapPath)) {
    const roadmap = fs.readFileSync(roadmapPath, 'utf8');
    const { frontmatter } = parseFrontmatter(roadmap);

    // Extract milestone from STATE.md if available
    const statePath = path.join(planningDir, 'STATE.md');
    if (fs.existsSync(statePath)) {
      const state = fs.readFileSync(statePath, 'utf8');
      const { frontmatter: stateFm } = parseFrontmatter(state);
      if (stateFm.milestone) milestoneId = stateFm.milestone;
    }

    // Add milestone node
    addNode({
      id: milestoneId,
      type: 'milestone',
      label: `Milestone ${milestoneId}`,
      status: 'active',
      metadata: { source: 'ROADMAP.md' }
    });

    // Parse phase checkboxes from ROADMAP.md
    const checkboxes = parseCheckboxes(roadmap);
    for (const cb of checkboxes) {
      // Extract phase number from text like "Phase 27: Description" or "27 - Description"
      const phaseMatch = cb.text.match(/(?:Phase\s+)?(\d+)[\s:.-]+(.+)/i);
      if (phaseMatch) {
        const phaseNum = parseInt(phaseMatch[1]);
        const phaseLabel = phaseMatch[2].trim();
        const phaseId = `phase-${phaseNum}`;

        addNode({
          id: phaseId,
          type: 'phase',
          label: `Phase ${phaseNum}: ${phaseLabel}`,
          status: cb.checked ? 'complete' : 'pending',
          metadata: { number: phaseNum, name: phaseLabel }
        });

        addEdge({
          id: `${milestoneId}->${phaseId}`,
          source: milestoneId,
          target: phaseId,
          type: 'hierarchy'
        });

        phases.push({ id: phaseId, number: phaseNum, name: phaseLabel, complete: cb.checked });
      }
    }
  }

  // ── 2. Scan phase directories for plans/tasks ──

  const phasesDir = path.join(planningDir, 'phases');
  if (fs.existsSync(phasesDir)) {
    const phaseDirs = fs.readdirSync(phasesDir).filter(d => {
      return fs.statSync(path.join(phasesDir, d)).isDirectory();
    });

    for (const phaseDir of phaseDirs) {
      const phaseNumMatch = phaseDir.match(/^(\d+)-/);
      if (!phaseNumMatch) continue;
      const phaseNum = parseInt(phaseNumMatch[1]);
      const phaseId = `phase-${phaseNum}`;
      const fullPhaseDir = path.join(phasesDir, phaseDir);

      // Find PLAN.md files
      const planFiles = fs.readdirSync(fullPhaseDir).filter(f => f.match(/\d+-\d+-PLAN\.md$/));

      for (const planFile of planFiles) {
        const planMatch = planFile.match(/(\d+)-(\d+)-PLAN\.md$/);
        if (!planMatch) continue;
        const planNum = parseInt(planMatch[2]);
        const planId = `plan-${phaseNum}-${planNum}`;

        const planContent = fs.readFileSync(path.join(fullPhaseDir, planFile), 'utf8');
        const { frontmatter: planFm } = parseFrontmatter(planContent);

        // Check if SUMMARY exists (= complete)
        const summaryFile = planFile.replace('PLAN', 'SUMMARY');
        const hasSummary = fs.existsSync(path.join(fullPhaseDir, summaryFile));

        addNode({
          id: planId,
          type: 'plan',
          label: `Plan ${phaseNum}-${String(planNum).padStart(2, '0')}`,
          status: hasSummary ? 'complete' : 'pending',
          metadata: {
            phase: phaseNum,
            plan: planNum,
            wave: planFm.wave || 1,
            depends_on: planFm.depends_on || [],
            files_modified: planFm.files_modified || [],
            requirements: planFm.requirements || []
          }
        });

        addEdge({
          id: `${phaseId}->${planId}`,
          source: phaseId,
          target: planId,
          type: 'hierarchy'
        });

        // Add dependency edges
        if (planFm.depends_on && Array.isArray(planFm.depends_on)) {
          for (const dep of planFm.depends_on) {
            const depMatch = dep.match(/(\d+)-(\d+)/);
            if (depMatch) {
              const depId = `plan-${depMatch[1]}-${parseInt(depMatch[2])}`;
              addEdge({
                id: `${depId}->${planId}`,
                source: depId,
                target: planId,
                type: 'dependency'
              });
            }
          }
        }

        // Add file nodes from files_modified
        if (planFm.files_modified && Array.isArray(planFm.files_modified)) {
          for (const filePath of planFm.files_modified) {
            const fileId = `file:${filePath}`;
            addNode({
              id: fileId,
              type: 'file',
              label: filePath,
              status: 'active',
              metadata: { path: filePath }
            });
            addEdge({
              id: `${planId}->writes:${fileId}`,
              source: planId,
              target: fileId,
              type: 'writes_to'
            });
          }
        }

        // Add requirement edges
        if (planFm.requirements && Array.isArray(planFm.requirements)) {
          for (const reqId of planFm.requirements) {
            const reqNodeId = `req:${reqId}`;
            addNode({
              id: reqNodeId,
              type: 'requirement',
              label: reqId,
              status: hasSummary ? 'complete' : 'pending',
              metadata: { id: reqId }
            });
            addEdge({
              id: `${planId}->implements:${reqNodeId}`,
              source: planId,
              target: reqNodeId,
              type: 'implements'
            });
          }
        }

        // If SUMMARY exists, extract key_files for additional file nodes
        if (hasSummary) {
          try {
            const summaryContent = fs.readFileSync(path.join(fullPhaseDir, summaryFile), 'utf8');
            const { frontmatter: sumFm } = parseFrontmatter(summaryContent);
            const keyFiles = sumFm['key-files'] || sumFm.key_files || [];
            if (Array.isArray(keyFiles)) {
              for (const kf of keyFiles) {
                const fp = typeof kf === 'string' ? kf : (kf.path || kf);
                if (fp) {
                  const fid = `file:${fp}`;
                  addNode({ id: fid, type: 'file', label: fp, status: 'active', metadata: { path: fp } });
                  addEdge({ id: `${planId}->writes:${fid}`, source: planId, target: fid, type: 'writes_to' });
                }
              }
            }
          } catch (e) { /* skip malformed summaries */ }
        }
      }

      // Check for VERIFICATION.md
      const verifFiles = fs.readdirSync(fullPhaseDir).filter(f => f.match(/VERIFICATION\.md$/));
      for (const vf of verifFiles) {
        try {
          const verifContent = fs.readFileSync(path.join(fullPhaseDir, vf), 'utf8');
          const { frontmatter: vfm } = parseFrontmatter(verifContent);

          // Update phase status based on verification
          if (nodes[phaseId]) {
            if (vfm.status === 'passed') nodes[phaseId].status = 'complete';
            else if (vfm.status === 'gaps_found') nodes[phaseId].metadata.verification = 'gaps';
          }
        } catch (e) { /* skip */ }
      }
    }
  }

  // ── 3. Parse decisions ──

  const decisionsDir = path.join(planningDir, 'decisions');
  if (fs.existsSync(decisionsDir)) {
    const decFiles = fs.readdirSync(decisionsDir).filter(f => f.endsWith('.md'));
    for (const df of decFiles) {
      try {
        const decContent = fs.readFileSync(path.join(decisionsDir, df), 'utf8');
        const { frontmatter: decFm } = parseFrontmatter(decContent);
        const decId = `dec:${df.replace('.md', '')}`;
        addNode({
          id: decId,
          type: 'decision',
          label: decFm.decision || df.replace('.md', ''),
          status: 'complete',
          metadata: { date: decFm.date, vote: decFm.vote, rounds: decFm.rounds }
        });
      } catch (e) { /* skip */ }
    }
  }

  // ── 4. Compute summary ──

  const nodeTypes = {};
  const statusCounts = {};
  for (const node of Object.values(nodes)) {
    nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    statusCounts[node.status] = (statusCounts[node.status] || 0) + 1;
  }

  const summary = {
    totalNodes: Object.keys(nodes).length,
    totalEdges: edges.length,
    nodeTypes,
    statusCounts,
    generatedAt: new Date().toISOString()
  };

  return { nodes, edges, summary };
}

module.exports = { readPlanningDirectory, parseFrontmatter, parseCheckboxes };

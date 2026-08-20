#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const YAML_LIB_PATH = path.resolve(
  __dirname, '..', 'plan-schema', 'node_modules', 'js-yaml',
);
const EXIT_CLEAN = 0;
const EXIT_FINDINGS = 1;
const EXIT_ERROR = 2;

class SkillDescriptionLintError extends Error {
  constructor(reasonCode) {
    super(reasonCode);
    this.name = 'SkillDescriptionLintError';
    this.reasonCode = reasonCode;
  }
}

function fail(reasonCode) {
  throw new SkillDescriptionLintError(reasonCode);
}

function parseArguments(argv) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  let skillsDir = null;
  let json = false;
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--json' && !json) {
      json = true;
      continue;
    }
    if (value === '--skills-dir' && skillsDir === null) {
      const candidate = args[index + 1];
      if (!candidate || candidate.startsWith('--')) fail('invalid_arguments');
      skillsDir = candidate;
      index += 1;
      continue;
    }
    fail('invalid_arguments');
  }
  if (typeof skillsDir !== 'string' || skillsDir.trim() === '') {
    fail('invalid_arguments');
  }
  return { skillsDir, json };
}

function yamlLibrary() {
  try {
    return require(YAML_LIB_PATH);
  } catch (error) {
    fail('yaml_dependency_unavailable');
  }
}

function assertSkillsDirectory(skillsDir) {
  const absolute = path.resolve(skillsDir);
  try {
    const stat = fs.statSync(absolute);
    if (!stat.isDirectory()) fail('skills_dir_not_directory');
  } catch (error) {
    if (error instanceof SkillDescriptionLintError) throw error;
    if (error && error.code === 'ENOENT') fail('skills_dir_missing');
    fail('skills_dir_read_failed');
  }
  return absolute;
}

function collectSkillFiles(root, current = root) {
  let entries;
  try {
    entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, 'en'));
  } catch (error) {
    fail('skills_dir_read_failed');
  }
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSkillFiles(root, entryPath));
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      files.push(entryPath);
    }
  }
  return files;
}

function readSkillFile(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail('skill_file_read_failed');
  }
}

function parseFrontmatter(source) {
  const match = String(source || '').replace(/^\uFEFF/, '')
    .match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) return null;
  try {
    const yaml = yamlLibrary();
    const parsed = yaml.load(match[1], { schema: yaml.JSON_SCHEMA });
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch (error) {
    if (error instanceof SkillDescriptionLintError) throw error;
    if (error && error.name === 'YAMLException') return null;
    fail('frontmatter_parser_failed');
  }
}

function lexicalTokens(description) {
  if (typeof description !== 'string') return [];
  return description.normalize('NFKC').toLowerCase()
    .match(/[\p{L}\p{N}]+(?:['’‐‑‒–—-][\p{L}\p{N}]+)*/gu) || [];
}

function descriptionReason(description) {
  if (typeof description !== 'string' || description.trim() === '') {
    return 'description_missing';
  }
  const tokens = lexicalTokens(description);
  if (tokens.length === 0) return 'description_missing';
  if (tokens.length === 1) return 'description_one_noun';
  return null;
}

function relativeFile(root, file) {
  return path.relative(root, file).split(path.sep).join('/');
}

function lintSkillsDirectory(skillsDir) {
  const root = assertSkillsDirectory(skillsDir);
  const findings = [];
  for (const file of collectSkillFiles(root)) {
    const relative = relativeFile(root, file);
    const frontmatter = parseFrontmatter(readSkillFile(file));
    if (!frontmatter) {
      findings.push({ file: relative, reason_code: 'frontmatter_malformed' });
      continue;
    }
    const reasonCode = descriptionReason(frontmatter.description);
    if (reasonCode) findings.push({ file: relative, reason_code: reasonCode });
  }
  return { findings };
}

function writeReport(report, json, stdout) {
  if (json) {
    stdout.write(JSON.stringify({
      ok: report.findings.length === 0,
      findings: report.findings,
    }, null, 2) + '\n');
    return;
  }
  if (report.findings.length === 0) {
    stdout.write('skill-description-lint: clean\n');
    return;
  }
  for (const finding of report.findings) {
    stdout.write(finding.file + ': ' + finding.reason_code + '\n');
  }
}

function writeError(reasonCode, json, stdout, stderr) {
  if (json) {
    stdout.write(JSON.stringify({
      ok: false,
      findings: [],
      error: { reason_code: reasonCode },
    }, null, 2) + '\n');
    return;
  }
  stderr.write('skill-description-lint: ' + reasonCode + '\n');
}

function run(argv, io = {}) {
  const stdout = io.stdout || process.stdout;
  const stderr = io.stderr || process.stderr;
  const jsonRequested = Array.isArray(argv) && argv.includes('--json');
  try {
    const options = parseArguments(argv);
    const report = lintSkillsDirectory(options.skillsDir);
    writeReport(report, options.json, stdout);
    return report.findings.length === 0 ? EXIT_CLEAN : EXIT_FINDINGS;
  } catch (error) {
    const reasonCode = error instanceof SkillDescriptionLintError
      ? error.reasonCode
      : 'internal_failure';
    writeError(reasonCode, jsonRequested, stdout, stderr);
    return EXIT_ERROR;
  }
}

module.exports = {
  EXIT_CLEAN,
  EXIT_FINDINGS,
  EXIT_ERROR,
  lexicalTokens,
  descriptionReason,
  lintSkillsDirectory,
  run,
};

if (require.main === module) {
  process.exitCode = run(process.argv.slice(2));
}

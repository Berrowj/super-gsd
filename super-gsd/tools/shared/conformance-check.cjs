"use strict";

const fs = require("fs");
const path = require("path");

const VALID_SURFACES = new Set(["chronicle", "cockpit"]);
const RULES_PATH = path.join(__dirname, "design-rules.json");

function loadRegistry() {
  return JSON.parse(fs.readFileSync(RULES_PATH, "utf8"));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripComments(value) {
  return String(value).replace(/<!--[\s\S]*?-->/g, " ");
}

function stripScriptsAndStyles(value) {
  return stripComments(value).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ");
}

function textOnly(value) {
  return stripScriptsAndStyles(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function openingTag(fragment) {
  const match = String(fragment).match(/^<[^>]+>/);
  return match ? match[0] : "";
}

function countMatches(value, pattern) {
  const matches = String(value).match(pattern);
  return matches ? matches.length : 0;
}

function getSections(html) {
  const sections = [];
  const pattern = /<section\b[^>]*>[\s\S]*?<\/section>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    sections.push(match[0]);
  }
  return sections;
}

function getElementsByClass(html, className) {
  const elements = [];
  const safe = escapeRegExp(className);
  const pattern = new RegExp(
    `<([a-z][\\w:-]*)\\b(?=[^>]*\\bclass\\s*=\\s*["'][^"']*\\b${safe}\\b)[^>]*>[\\s\\S]*?<\\/\\1>`,
    "gi"
  );
  let match;
  while ((match = pattern.exec(html)) !== null) {
    elements.push(match[0]);
  }
  return elements;
}

function getElementsByDataRole(html, role) {
  const elements = [];
  const safe = escapeRegExp(role);
  const pattern = new RegExp(
    `<([a-z][\\w:-]*)\\b(?=[^>]*\\bdata-role\\s*=\\s*["']${safe}["'])[^>]*>[\\s\\S]*?<\\/\\1>`,
    "gi"
  );
  let match;
  while ((match = pattern.exec(html)) !== null) {
    elements.push(match[0]);
  }
  return elements;
}

function uniqueFragments(fragments) {
  return Array.from(new Set(fragments));
}

function hasOperatorDecisionMarker(fragment) {
  const tag = openingTag(fragment);
  const text = textOnly(fragment);
  return (
    /\brole\s*=\s*["']operator-decision["']/i.test(tag) ||
    /\bdata-role\s*=\s*["']operator-decision["']/i.test(tag) ||
    /\bid\s*=\s*["']decision["']/i.test(tag) ||
    /\bclass\s*=\s*["'][^"']*\b(operator-decision|decision|north-star)\b/i.test(fragment) ||
    /\b(operator decision|north star|do this next)\b/i.test(text)
  );
}

function checkR01(html) {
  const firstSection = getSections(html)[0];
  if (!firstSection) {
    return { pass: false, detail: "No <section> found; first section cannot carry the operator decision." };
  }
  if (hasOperatorDecisionMarker(firstSection)) {
    return { pass: true, detail: "First section is marked as the operator decision / North Star." };
  }
  return { pass: false, detail: "First <section> is not marked role=operator-decision or North-Star." };
}

function checkR03(html) {
  const sections = getSections(html);
  const candidates = sections.filter((section) => {
    const tag = openingTag(section);
    const text = textOnly(section);
    return (
      /\b(id|class|data-role)\s*=\s*["'][^"']*(why|scqa)[^"']*["']/i.test(tag) ||
      /\bSituation\b/i.test(text) ||
      /\bComplication\b/i.test(text) ||
      /\bQuestion\b/i.test(text)
    );
  });
  const pool = candidates.length ? candidates : [html];
  const hasScqa = pool.some((fragment) => {
    const text = textOnly(fragment);
    return (
      /\bSituation\b/i.test(text) &&
      /\bComplication\b/i.test(text) &&
      /\bQuestion\b/i.test(text)
    );
  });
  if (hasScqa || /\bclass\s*=\s*["'][^"']*\bscqa\b/i.test(html)) {
    return { pass: true, detail: "A why / SCQA block includes Situation, Complication, and Question." };
  }
  return { pass: false, detail: "No why-section with Situation, Complication, and Question was found." };
}

function recommendedActionCount(html) {
  const classOrRoleCount = countMatches(
    html,
    /<(?:[^>]+)\b(?:class|data-role)\s*=\s*["'][^"']*\b(?:recommended-action|north-star-action|next-action)\b[^"']*["'][^>]*>/gi
  );
  const text = textOnly(html);
  const phraseCount = countMatches(text, /\brecommended next action\b/gi);
  if (classOrRoleCount > 0 || phraseCount > 0) {
    return Math.max(classOrRoleCount, phraseCount);
  }
  const firstSection = getSections(html)[0] || "";
  if (hasOperatorDecisionMarker(firstSection) && /\b(recommend(?:ed|ation)?|next action|decision)\b/i.test(textOnly(firstSection))) {
    return 1;
  }
  return 0;
}

function checkR04(html) {
  const count = recommendedActionCount(html);
  const withoutDetails = stripScriptsAndStyles(html).replace(/<details\b[\s\S]*?<\/details>/gi, " ");
  const hasCollapsedDetails = /<details\b(?![^>]*\bopen\b)[^>]*>/i.test(html);
  const unfoldedAlternatives = /\balternatives?\b/i.test(textOnly(withoutDetails)) && !hasCollapsedDetails;
  if (count === 1 && !unfoldedAlternatives) {
    return { pass: true, detail: "Exactly one recommended next action is visible and alternatives are folded." };
  }
  if (count !== 1) {
    return { pass: false, detail: `Expected exactly one recommended next action; found ${count}.` };
  }
  return { pass: false, detail: "Alternatives are visible outside a collapsed <details> block." };
}

function checkR05(html) {
  const claims = uniqueFragments([
    ...getElementsByClass(html, "claim"),
    ...getElementsByDataRole(html, "claim")
  ]);
  if (claims.length === 0) {
    return { pass: true, detail: "No claim blocks found; credential check is vacuously satisfied." };
  }
  const missing = claims.filter((claim) => {
    const tag = openingTag(claim);
    const readableText = textOnly(claim);
    return !(
      /<a\b[^>]*\bhref\s*=/i.test(claim) ||
      /\bdata-evidence(?:-path)?\s*=/i.test(tag) ||
      /\bevidence_path\s*=/i.test(tag) ||
      /\bclass\s*=\s*["'][^"']*\b(credential|evidence)\b/i.test(claim) ||
      /\b(evidence path|evidence_path|credential|SAC-P\d+|gate-value-log|review-ledger|\.planning\/)\b/i.test(readableText)
    );
  });
  if (missing.length === 0) {
    return { pass: true, detail: `${claims.length} claim block(s) carry one-click evidence credentials.` };
  }
  return { pass: false, detail: `${missing.length} claim block(s) lack a link or evidence credential.` };
}

function checkR06(html) {
  const metrics = uniqueFragments([
    ...getElementsByClass(html, "metric"),
    ...getElementsByDataRole(html, "metric")
  ]);
  if (metrics.length === 0) {
    return { pass: true, detail: "No metric blocks found; telling-instance check is vacuously satisfied." };
  }
  const missing = metrics.filter((metric) => {
    const tag = openingTag(metric);
    const readableText = textOnly(metric);
    return !(
      /\bdata-instance\s*=/i.test(tag) ||
      /\bclass\s*=\s*["'][^"']*\b(telling-instance|instance)\b/i.test(metric) ||
      /\bTelling instance\b/i.test(readableText) ||
      /\b(instance|example|evidence|sample|case)\b/i.test(readableText)
    );
  });
  if (missing.length === 0) {
    return { pass: true, detail: `${metrics.length} metric block(s) include a telling instance.` };
  }
  return { pass: false, detail: `${missing.length} metric block(s) lack a telling instance.` };
}

function checkR07(html) {
  const collapsedDetails = countMatches(html, /<details\b(?![^>]*\bopen\b)[^>]*>/gi);
  if (collapsedDetails > 0) {
    return { pass: true, detail: `${collapsedDetails} default-collapsed <details> block(s) found.` };
  }
  return { pass: false, detail: "No default-collapsed <details> block found." };
}

function checkR08(html) {
  const figures = [];
  const pattern = /<figure\b[^>]*>[\s\S]*?<\/figure>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    figures.push(match[0]);
  }
  const missing = figures.filter((figure) => !/<figcaption\b/i.test(figure));
  if (missing.length === 0) {
    return { pass: true, detail: `${figures.length} figure(s) have figcaptions.` };
  }
  return { pass: false, detail: `${missing.length} figure(s) lack figcaptions.` };
}

function checkR10(html) {
  const headings = [];
  const pattern = /<h([1-6])\b[^>]*>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    headings.push(Number(match[1]));
  }
  if (headings.length === 0) {
    return { pass: true, detail: "No headings found; monotone heading check is vacuously satisfied." };
  }
  if (headings[0] > 2) {
    return { pass: false, detail: `First heading is h${headings[0]}, which skips the document lead.` };
  }
  for (let index = 1; index < headings.length; index += 1) {
    if (headings[index] - headings[index - 1] > 1) {
      return {
        pass: false,
        detail: `Heading level jumps from h${headings[index - 1]} to h${headings[index]}.`
      };
    }
  }
  return { pass: true, detail: `${headings.length} heading level(s) progress monotonically.` };
}

function lintScopes(html) {
  const scopes = uniqueFragments([
    ...getElementsByClass(html, "eli5"),
    ...getElementsByClass(html, "synthesis"),
    ...getElementsByDataRole(html, "eli5"),
    ...getElementsByDataRole(html, "synthesis")
  ]);
  return scopes.length ? scopes.map(textOnly) : [];
}

function termIsExpanded(term, text) {
  const patterns = {
    CMB: /\b(Capability Maturity Board\s*\(CMB\)|CMB\s*\(Capability Maturity Board\))/i,
    SAC: /\b(Success Acceptance Criteria\s*\(SAC\)|SAC\s*\(Success Acceptance Criteria\))/i,
    ATC: /\b(Acceptance Test Checkpoint\s*\(ATC\)|ATC\s*\(Acceptance Test Checkpoint\))/i,
    MUDA: /\b(lean waste\s*\(MUDA\)|waste\s*\(MUDA\)|MUDA\s*\(waste\))/i,
    signifier_role: /\bsignifier role\b/i,
    REPORT_: /\breport prefix\b/i
  };
  return patterns[term] ? patterns[term].test(text) : false;
}

function checkR11(html) {
  const scopes = lintScopes(html);
  if (scopes.length === 0) {
    return { pass: true, detail: "No ELI5 or synthesis scopes found; jargon lint is vacuously satisfied." };
  }
  const denied = ["CMB", "SAC", "ATC", "MUDA", "signifier_role", "REPORT_"];
  const hits = [];
  for (const scope of scopes) {
    for (const term of denied) {
      const pattern = term.endsWith("_")
        ? new RegExp(`\\b${escapeRegExp(term)}`, "i")
        : new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
      if (pattern.test(scope) && !termIsExpanded(term, scope)) {
        hits.push(term);
      }
    }
  }
  if (hits.length === 0) {
    return { pass: true, detail: `${scopes.length} ELI5/synthesis scope(s) have no unexpanded internal jargon.` };
  }
  return { pass: false, detail: `Unexpanded internal term(s): ${Array.from(new Set(hits)).join(", ")}.` };
}

const CHECKS = {
  R01: checkR01,
  R03: checkR03,
  R04: checkR04,
  R05: checkR05,
  R06: checkR06,
  R07: checkR07,
  R08: checkR08,
  R10: checkR10,
  R11: checkR11
};

const ADVISORY_PROMPTS = {
  R02: "Reviewer prompt: confirm every section heading states a testable governing takeaway.",
  R09: "Reviewer prompt: confirm every diagram type matches the question type it answers.",
  R12: "Reviewer prompt: confirm diagrams are tuned to operator execution, thresholds, and next action."
};

function checkRule(rule, html) {
  if (rule.check_type === "advisory") {
    return { status: "ADVISORY", detail: ADVISORY_PROMPTS[rule.id] || "Reviewer judgement required." };
  }
  const check = CHECKS[rule.id];
  if (!check) {
    return { status: "ADVISORY", detail: "No deterministic checker registered; reviewer judgement required." };
  }
  const verdict = check(html);
  return {
    status: verdict.pass ? "PASS" : "FAIL",
    detail: verdict.detail
  };
}

function summarize(results) {
  return results.reduce(
    (summary, result) => {
      if (result.status === "ADVISORY") {
        summary.advisory += 1;
      } else if (result.severity === "binding" && result.status === "PASS") {
        summary.binding_pass += 1;
      } else if (result.severity === "binding" && result.status === "FAIL") {
        summary.binding_fail += 1;
      }
      return summary;
    },
    { binding_pass: 0, binding_fail: 0, advisory: 0 }
  );
}

function cockpitGroupResults(registry, surface) {
  if (surface !== "cockpit") return [];
  const principles = registry.groups && registry.groups.cockpit && Array.isArray(registry.groups.cockpit.principles)
    ? registry.groups.cockpit.principles
    : [];
  return principles.map((principle) => ({
    id: principle.id,
    name: principle.name,
    severity: "advisory",
    status: "ADVISORY",
    detail: `Cockpit principle: ${principle.rule} (${principle.citation}).`
  }));
}

function checkConformance(htmlString, surface) {
  if (!VALID_SURFACES.has(surface)) {
    throw new Error(`Invalid surface "${surface}". Expected chronicle or cockpit.`);
  }
  const registry = loadRegistry();
  const html = String(htmlString);
  const ruleResults = registry.rules
    .filter((rule) => rule.applies_to.includes(surface))
    .map((rule) => {
      const verdict = checkRule(rule, html);
      return {
        id: rule.id,
        name: rule.name,
        severity: rule.severity,
        status: verdict.status,
        detail: verdict.detail
      };
    });
  const results = ruleResults.concat(cockpitGroupResults(registry, surface));
  return {
    surface,
    results,
    summary: summarize(results)
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let surface = "chronicle";
  let file = null;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--surface") {
      surface = args[index + 1];
      index += 1;
    } else if (!file) {
      file = args[index];
    }
  }
  const html = file ? fs.readFileSync(file, "utf8") : fs.readFileSync(0, "utf8");
  const verdict = checkConformance(html, surface);
  process.stdout.write(`${JSON.stringify(verdict, null, 2)}\n`);
  process.exitCode = verdict.summary.binding_fail > 0 ? 1 : 0;
}

module.exports = { checkConformance };

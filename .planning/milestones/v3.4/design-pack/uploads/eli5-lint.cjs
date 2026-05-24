const fs = require('fs');
const path = require('path');

let COMMON_WORDS = new Set();

try {
  const commonWordsPath = path.join(__dirname, 'eli5-common-words.txt');
  const rawWords = fs.readFileSync(commonWordsPath, 'utf8');
  COMMON_WORDS = new Set(
    rawWords
      .split(/\r?\n/)
      .map((word) => word.trim().toLowerCase())
      .filter(Boolean)
  );
} catch (_error) {
  COMMON_WORDS = new Set();
}

function lintEli5(text, opts) {
  const options = opts || {};
  const maxViolations = options.maxViolations ?? 5;
  const lines = String(text || '').split('\n');
  const violations = [];
  let totalWords = 0;
  let outOfListCount = 0;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const lineNumber = lineIndex + 1;
    const wordPattern = /([a-zA-Z][a-zA-Z\-']*)/g;
    let match;

    while ((match = wordPattern.exec(line)) !== null) {
      const originalWord = match[1];
      if (!originalWord) {
        continue;
      }

      totalWords += 1;
      const lower = originalWord.toLowerCase();

      if (COMMON_WORDS.has(lower)) {
        continue;
      }

      const wordEnd = match.index + originalWord.length;
      const nextText = line.slice(wordEnd, wordEnd + 20);
      const glossed =
        nextText.includes('(') ||
        nextText.includes('—') ||
        nextText.includes(' - ');

      if (!glossed) {
        outOfListCount += 1;
      }

      if (violations.length < 100) {
        violations.push({
          word: lower,
          line_number: lineNumber,
          glossed,
        });
      }
    }
  }

  return {
    ok: outOfListCount <= maxViolations,
    violations,
    total_words: totalWords,
    out_of_list_count: outOfListCount,
  };
}

module.exports = {
  lintEli5,
};

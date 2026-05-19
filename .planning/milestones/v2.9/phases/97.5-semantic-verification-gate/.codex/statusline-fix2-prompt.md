# SDD Implementer — sgsd-statusline.js limit-slice fix

You are a fresh SDD implementer. No inherited context.

## The bug

`super-gsd/hooks/sgsd-statusline.js` `readFrontmatter()` slices the file to the first 40 lines before searching for `---...---` delimiters. SGSD's `.planning/STATE.md` has a 290-line frontmatter (accumulated milestone history), so the closing `---` is never in the slice and the regex match fails, returning `{}`. Result: `state.milestone` is `undefined`, statusline shows `v?`.

## The patch

In `super-gsd/hooks/sgsd-statusline.js`, function `readFrontmatter`, current shape:

```js
function readFrontmatter(filePath, limit = 40) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const head = content.split(/\r?\n/).slice(0, limit).join('\n');
    const match = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    ...
```

Change to:

```js
function readFrontmatter(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    ...
```

Two edits:
1. Drop the `limit = 40` parameter from the function signature.
2. Drop the `const head = content.split(...).slice(0, limit).join('\n');` intermediate variable; match the regex against `content` directly.

The regex's non-greedy `[\s\S]*?` already terminates at the FIRST closing `---`, so no slice is needed. Reading the whole file is fine (STATE.md is ~10KB).

## Verification

Run mentally: with the patch, on a STATE.md whose frontmatter spans lines 1-290, the regex matches the full block. `data.milestone` populates correctly.

## Files in read-pack

- `super-gsd/hooks/sgsd-statusline.js` — current state of the file

## Report

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  super-gsd/hooks/sgsd-statusline.js (modified)
VERIFICATION: readFrontmatter no longer slices; matches full content; ~290-line frontmatters parse correctly.
DEVIATIONS: <none or list>
BLOCKERS: <none>
ONE_LINER: Drop 40-line slice in readFrontmatter so frontmatters longer than 40 lines parse.
REPORT_END
```

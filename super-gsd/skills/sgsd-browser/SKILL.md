---
name: sgsd-browser
description: "Browser automation for frontend debugging, UI verification, visual testing, and form testing. Wraps gsd-browser CLI (Rust/CDP). Use during execute-phase for frontend work, verify-work for UI validation, and debug for visual issues."
argument-hint: "[open URL | screenshot | verify | test-form | debug | install]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Agent
---

<objective>
Browser automation skill for Super GSD. Provides frontend debugging, UI verification,
visual regression testing, form testing, and accessibility auditing.

Built on gsd-browser (https://github.com/gsd-build/gsd-browser) — a Rust CDP daemon
that gives agents deterministic browser control.

Commands:
- `open URL` — Navigate to a URL, take snapshot, report interactive elements
- `screenshot [URL]` — Take screenshot and save to .planning/overwatcher/screenshots/
- `verify URL` — Full UI verification: load page, snapshot, accessibility tree, visual checks
- `test-form URL` — Find forms, analyze fields, test submission flow
- `debug URL` — Open page, capture console errors, network failures, layout issues
- `diff URL` — Visual regression: compare current screenshot against saved baseline
- `install` — Install gsd-browser if not present
</objective>

<install_check>
Before any command except `install`, check gsd-browser is available:

```bash
which gsd-browser 2>/dev/null && gsd-browser --version || echo "NOT_INSTALLED"
```

If NOT_INSTALLED:
```bash
curl -fsSL https://raw.githubusercontent.com/gsd-build/gsd-browser/main/install.sh | bash
```

The daemon auto-starts on first use. No manual setup needed.
</install_check>

<cmd_open>
## open URL — Navigate + Snapshot

```bash
# Navigate to the URL
gsd-browser navigate "$URL"

# Wait for page to be interactive
gsd-browser wait-for --state networkidle

# Take a snapshot — captures all interactive elements with versioned refs
SNAP=$(gsd-browser snapshot --json)

# Report what's on the page
echo "$SNAP" | node -e "
  const s = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log('Elements:', s.elements?.length || 0);
  console.log('Forms:', (s.elements?.filter(e => e.tag === 'form') || []).length);
  console.log('Links:', (s.elements?.filter(e => e.tag === 'a') || []).length);
  console.log('Buttons:', (s.elements?.filter(e => e.tag === 'button') || []).length);
"
```

Report: page loaded, element count, interactive element summary.
</cmd_open>

<cmd_screenshot>
## screenshot [URL] — Capture Page

```bash
mkdir -p .planning/overwatcher/screenshots

# Navigate if URL provided
if [ -n "$URL" ]; then
  gsd-browser navigate "$URL"
  gsd-browser wait-for --state networkidle
fi

# Take screenshot
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
gsd-browser screenshot --output ".planning/overwatcher/screenshots/$TIMESTAMP.png"

echo "Screenshot saved: .planning/overwatcher/screenshots/$TIMESTAMP.png"
```
</cmd_screenshot>

<cmd_verify>
## verify URL — Full UI Verification

Use this during `/gsd-verify-work` for frontend phases. Checks:
1. Page loads without console errors
2. All interactive elements are reachable
3. Accessibility tree is valid
4. Key elements exist (from phase success criteria)

```bash
# 1. Navigate
gsd-browser navigate "$URL"
gsd-browser wait-for --state networkidle

# 2. Check console for errors
CONSOLE=$(gsd-browser console --json)
ERRORS=$(echo "$CONSOLE" | node -e "
  const c = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  const errs = (c.entries || []).filter(e => e.level === 'error');
  console.log(JSON.stringify(errs));
")
echo "Console errors: $(echo "$ERRORS" | node -e "console.log(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).length)")"

# 3. Take snapshot for element inventory
gsd-browser snapshot --json > /tmp/gsd-verify-snap.json

# 4. Accessibility tree
A11Y=$(gsd-browser accessibility-tree --json)
echo "Accessibility nodes: $(echo "$A11Y" | node -e "
  const t = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log(t.nodes?.length || 0);
")"

# 5. Screenshot for visual record
mkdir -p .planning/overwatcher/screenshots
gsd-browser screenshot --output ".planning/overwatcher/screenshots/verify-$(date +%Y%m%d-%H%M%S).png"

# 6. Check for specific elements (if success criteria mention them)
# Use find-best for semantic element search:
# gsd-browser find-best "login button"
# gsd-browser find-best "navigation menu"
# gsd-browser find-best "data table"
```

Report as VERIFICATION section:
```
UI VERIFICATION: {URL}
- Page load: OK | FAIL (status code)
- Console errors: {N} ({list if any})
- Interactive elements: {N}
- Accessibility nodes: {N}
- Screenshot: {path}
- Specific checks: {pass/fail per criterion}
```
</cmd_verify>

<cmd_test_form>
## test-form URL — Form Analysis + Test

```bash
# Navigate
gsd-browser navigate "$URL"
gsd-browser wait-for --state networkidle

# Analyze all forms on the page
FORMS=$(gsd-browser analyze-form --json)
echo "Forms found: $(echo "$FORMS" | node -e "
  const f = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
  console.log(f.forms?.length || 0);
  (f.forms || []).forEach((form, i) => {
    console.log('Form', i, ':', form.fields?.length || 0, 'fields');
    (form.fields || []).forEach(f => console.log('  -', f.name || f.id, ':', f.type));
  });
")"

# Fill form with test data (if safe — no real submissions in production)
# gsd-browser fill-form --json '{"fields": [{"selector": "#email", "value": "test@example.com"}]}'

# For full form test:
# gsd-browser fill-ref @v1:e3 "test value"
# gsd-browser click-ref @v1:e5  (submit button)
```
</cmd_test_form>

<cmd_debug>
## debug URL — Diagnostic Bundle

```bash
# Navigate
gsd-browser navigate "$URL"
gsd-browser wait-for --state networkidle

# Capture everything
gsd-browser console --json > /tmp/gsd-debug-console.json
gsd-browser network --json > /tmp/gsd-debug-network.json
gsd-browser screenshot --output "/tmp/gsd-debug-screenshot.png"

# Check for issues
echo "=== Console Errors ==="
node -e "
  const c = JSON.parse(require('fs').readFileSync('/tmp/gsd-debug-console.json','utf8'));
  (c.entries || []).filter(e => e.level === 'error').forEach(e => console.log(e.text));
"

echo "=== Failed Network Requests ==="
node -e "
  const n = JSON.parse(require('fs').readFileSync('/tmp/gsd-debug-network.json','utf8'));
  (n.entries || []).filter(e => e.status >= 400).forEach(e => console.log(e.status, e.url));
"

echo "=== Page Source Size ==="
gsd-browser page-source | wc -c

# Create debug bundle
mkdir -p .planning/overwatcher/debug
gsd-browser debug-bundle --output ".planning/overwatcher/debug/debug-$(date +%Y%m%d-%H%M%S)"
echo "Debug bundle saved"
```
</cmd_debug>

<cmd_diff>
## diff URL — Visual Regression

```bash
mkdir -p .planning/overwatcher/screenshots/baseline

# Check for existing baseline
BASELINE=".planning/overwatcher/screenshots/baseline/$(echo "$URL" | sed 's/[^a-zA-Z0-9]/-/g').png"

if [ ! -f "$BASELINE" ]; then
  echo "No baseline exists. Taking baseline screenshot..."
  gsd-browser navigate "$URL"
  gsd-browser wait-for --state networkidle
  gsd-browser screenshot --output "$BASELINE"
  echo "Baseline saved: $BASELINE"
  echo "Run /gsd-browser diff $URL again after changes to compare."
else
  # Take current screenshot
  CURRENT="/tmp/gsd-diff-current.png"
  gsd-browser navigate "$URL"
  gsd-browser wait-for --state networkidle
  gsd-browser screenshot --output "$CURRENT"

  # Visual diff
  DIFF_RESULT=$(gsd-browser visual-diff --baseline "$BASELINE" --current "$CURRENT" --json)
  echo "$DIFF_RESULT" | node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    console.log('Pixel diff:', d.diffPercent || 0, '%');
    console.log('Status:', (d.diffPercent || 0) < 1 ? 'PASS (< 1% change)' : 'CHANGED');
  "
fi
```
</cmd_diff>

<integration>
## Integration with Super GSD

### During Execute Phase (frontend work)
The executor can use gsd-browser to verify its work visually:
```bash
# After building a component
gsd-browser navigate "http://localhost:3000/new-page"
gsd-browser screenshot --output ".planning/overwatcher/screenshots/phase-{N}-result.png"
gsd-browser assert --selector ".my-component" --state visible
```

### During Verify Work (UI phases)
The verifier uses gsd-browser for behavioral spot-checks:
```bash
# Check if the page renders correctly
gsd-browser navigate "http://localhost:3000"
gsd-browser find-best "login form"
gsd-browser accessibility-tree --json
```

### During Debug
```bash
/gsd-browser debug http://localhost:3000/broken-page
```
Captures console errors, network failures, screenshot, and a debug bundle.

### ATC Gate (frontend phases)
For FULL/GATE tier changes on frontend files, the ATC gate can invoke:
```bash
gsd-browser navigate "http://localhost:3000"
gsd-browser assert --selector "body" --state visible
```
to verify the page still loads after changes.
</integration>

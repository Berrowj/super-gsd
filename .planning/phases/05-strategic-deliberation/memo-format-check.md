# Decision Memo Format Check

Template: `super-gsd/templates/decision-memo.md`

## Frontmatter Fields

| Field | Write Step | Source |
|-------|-----------|--------|
| `type: deliberation-memo` | Step 5 (SKILL.md) | Static value |
| `date` | Step 5 (SKILL.md) | Runtime date |
| `brief` | Step 5 (SKILL.md) | Path to brief file |
| `board` | Step 5 (SKILL.md) | Static: [architect, pragmatist, contrarian, moonshot] |
| `rounds` | Step 5 (SKILL.md) | CEO tracks rounds completed |
| `vote` | CEO synthesis (gsd-ceo.md `<output>`) | CEO computes from board positions |
| `decision` | CEO synthesis (gsd-ceo.md `<output>`) | CEO one-liner |
| `estimated_tokens` | Step 6 (SKILL.md) | Token log entry |

**Gaps: None.** All 8 frontmatter fields have a write step.

---

## Body Sections

| Section Header | Write Step | Source |
|---------------|-----------|--------|
| `# Decision Memo: {Title}` | Step 5 (SKILL.md) | Derived from brief title |
| `## Recommendation` | CEO synthesis — `<output>` block (2-3 sentences) | CEO |
| `## Board Stances` (table) | CEO synthesis — `<synthesis_rules>` | Compiled from board positions |
| `## Unresolved Tensions` | CEO synthesis — `<synthesis_rules>` ("Unresolved tensions get documented, not hidden") | CEO |
| `## Trade-offs Accepted` | CEO synthesis — `<synthesis_rules>` ("Trade-offs get named explicitly") | CEO |
| `## Risks Acknowledged` | CEO synthesis — from board positions | CEO |
| `## Next Actions` (checkboxes) | CEO synthesis — `<output>` block (NEXT ACTIONS list) | CEO |
| `## Deliberation Metadata` | Step 5 (SKILL.md) — metadata block | SKILL.md step 5 |

**Gaps: None.** All 8 body sections have a write step.

---

## Debate Log Files

Written to `.planning/deliberations/{date}-{slug}/`:

| File | Write Step | Condition |
|------|-----------|-----------|
| `round-1-positions.md` | Step 5 (SKILL.md) | Always |
| `round-2-rebuttals.md` | Step 5 (SKILL.md) | If Round 2 occurred |
| `deliberation-log.md` | Step 5 (SKILL.md) | Always |

---

## Directory Existence Check

- `.planning/decisions/` — exists (confirmed by ls)
- `.planning/deliberations/` — exists (confirmed by ls)
- `.planning/briefs/` — exists (confirmed by ls)

No directory creation needed at runtime for these base paths. CEO/SKILL must still create the `{date}-{slug}/` subdirectory inside `deliberations/`.

SKILL.md step 5 note: "Create directories if they don't exist." — covered.

---

## Summary

- Frontmatter fields: 8/8 traced
- Body sections: 8/8 traced
- Debate log files: 3/3 traced
- Total gaps: **0**
- Directories: all present

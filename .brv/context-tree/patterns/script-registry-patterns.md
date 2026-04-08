---
title: Script Registry - Reuse Before Rewrite
tags: [scripts, reuse, registry, utilities, efficiency]
keywords: [script, utility, hook, helper, reuse, registry, existing]
related:
  - "patterns/token-efficiency-expertise"
importance: 80
maturity: validated
---

## Raw Concept

Every script/utility/hook created by any agent gets registered in ByteRover.
Before creating a new one, query the registry. 70%+ match = reuse. <70% = write new.

## Narrative

### Registry Structure
Scripts registered under: scripts/{category}/
Categories: hooks, utilities, test-helpers, build, migrations

### Knowledge File per Script
Each registered script has:
- title: purpose
- language: typescript/javascript/bash
- location: actual file path
- interface: function signature
- hash: content hash for staleness detection

### Query Before Create
Before any agent writes a new utility:
1. Orchestrator queries: brv-query "{purpose} utility {language}"
2. If hit with 70%+ relevance: inject "EXISTING: {path} — import and use"
3. If no hit or <70%: agent writes new, orchestrator curates it

### Staleness Detection
- hash tracks file content
- On query hit: verify file still exists and hash matches
- If moved/deleted/changed: update or archive registry entry

### Rules
- Always query before creating — duplicates waste tokens
- Must be exact fit — don't force-fit a utility that almost works
- If existing needs >30% modification: write new, curate it
- 0 uses in 30 days: importance decays, eventually archived to stub

## Facts

- category: convention
  statement: Query ByteRover scripts/ before creating any new utility
- category: convention
  statement: 70%+ match means reuse, under 70% means write new
- category: convention
  statement: Every new script created by an agent gets curated with path + interface + hash

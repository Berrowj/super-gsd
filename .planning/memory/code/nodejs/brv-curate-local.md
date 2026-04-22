---
title: "brv-curate-local"
importance: 85
maturity: core
tags:
  - curate
  - context-tree
  - write
  - frontmatter
  - brv

keywords:
  - curate
  - write
  - save
  - store
  - persist
  - context
  - frontmatter
  - domain
  - brv
  - atomic

---

Writes atomic YAML frontmatter .md files to context-tree. node brv-curate-local.js body --domain D --title T --importance N --maturity M --tags csv --keywords csv. Atomic tmp+renameSync, domain validation, no external deps.

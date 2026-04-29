---
title: Frontmatter Warp Plan -- Cache Layer
created: 2026-04-29
author: operator
---

Body intro paragraph.

## Phase 1: Cache Spike

- Compare Redis vs in-process LRU
- Measure hit ratio under typical load
- Pick winner

## Phase 2: Cache Land

- Implement adapter interface
- Wire into hot path
- Add eviction metric to dashboard

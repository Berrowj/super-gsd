---
title: Token Efficiency Expertise
tags: [tokens, efficiency, cost, optimization]
keywords: [token, budget, model, routing, compression, context]
importance: 95
maturity: core
---

## Raw Concept

12 strategies for reducing token usage without sacrificing output quality.
Right-sizing models can cut costs 5-20x with zero quality trade-off.

## Narrative

### Model Routing (Strategy 11)
- Haiku for classification, tagging, extraction (~0.05x cost)
- Sonnet for planning, execution, review (~0.2x cost)
- Opus for orchestration, synthesis, strategic decisions (1x cost)
- Never use Opus for work Sonnet can handle
- Never use Sonnet for work Haiku can handle

### Prompt Compression (Strategies 1, 2, 7)
- Cut filler phrases: "Help me..." beats "Please kindly assist me with..."
- Limit response length: "Reply in 3 bullets" or "Under 150 words"
- Skip preamble: "No intro, no recap" cuts fluff every response

### Structured Output (Strategy 3)
- JSON/XML over prose: more info, fewer tokens
- Compressed XML plan format: ~800 tokens vs ~2,000 in prose
- Sub-agent reports: structured sections, not paragraphs

### Context Management (Strategies 4, 5, 6)
- Trim context: only send what agent needs, summarize don't paste full files
- Cache repeated context: write once, reuse via brv-query
- Compress chat history: checkpoint files replace full conversation replay
- ByteRover query (~200 tokens) replaces loading full file (~2,000 tokens)

### Input Efficiency (Strategies 8, 9, 10, 12)
- Few-shot examples: 1-2 short examples beat long explanation
- Never ask Claude to repeat input: doubles tokens for free
- Batch related questions: single prompt shares system prompt tokens
- Preprocess inputs: strip HTML, whitespace, boilerplate before sending

## Facts

- category: convention
  statement: Orchestrator budget is ~1,350 tokens per loop iteration
- category: convention
  statement: Sub-agent context injection target is under 1,000 tokens
- category: convention
  statement: All token usage is logged to token-log.jsonl for auditing
- category: preference
  statement: Token efficiency is the load-bearing architectural constraint

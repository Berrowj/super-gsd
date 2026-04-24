---
name: VTP search-tool routing by content layer
description: Use vtp_search_substrate for book/paper/transcript content; wiki_search is scoped to people/projects/ideas/analyses only
type: feedback
originSessionId: 4150e89d-3dec-4475-9366-23832bf65e75
---
For VTP-enriched dispatch, route search queries by the layer of content you want:

- **`vtp_search_substrate`** — full text of books (`wiki/books/*`), research papers, meeting transcripts, wiki pages. Hybrid lexical + dense. Supports `source_types`, `project_ids`, `speaker_ids`, `topics`, `entity_types` filters. This is the correct tool for "find me the source material on X" queries. Returns stable `chunk_id` + `doc_id` for citable results.
- **`wiki_search`** — scoped to people, projects, ideas, and analyses *only* (per the tool's own description). BM25 over wiki meta-pages, NOT over book content. Use for "who discussed X" or "which ideas touch X" queries.

**Why:** On 2026-04-24 I flagged "BM25 is broken for books" when `wiki_search("Ousterhout software design complexity")` returned only research papers. The user patched BM25, then I re-tested with the same tool and still got zero book hits — and concluded the fix had regressed. It hadn't. `wiki_search` was never designed to index `wiki/books/`. Running the same query via `vtp_search_substrate` with `source_types: ["wiki_page"]` surfaced APoSD chapter content with score 1.02 immediately. I was using the wrong tool for the layer the entire time.

**How to apply:** Before reporting a VTP search tool as broken, check whether the content type you're querying is in the tool's declared scope. If the user mentions books, research papers, meeting transcripts, or any full-document content, default to `vtp_search_substrate` with appropriate `source_types` filter. Only use `wiki_search` for meta-level queries about people/projects/ideas/analyses.

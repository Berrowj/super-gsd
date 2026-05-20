# SGSD Context Authority

DLB-10.1 Context Authority turns per-milestone context capsules into typed
`context_anchor` CMBs in mesh memory. The capsule files capture why a milestone
exists, entry and exit criteria, which personas matter, the domain ontology,
overloaded terms, source of truth mappings, and explicit non-goals.

## Author Capsules

Start from the six templates in `super-gsd/templates/`:

- `MILESTONE-CONTEXT.template.yaml`
- `PERSONA-MATRIX.template.yaml`
- `DOMAIN-ONTOLOGY.template.yaml`
- `LEXICON.template.yaml`
- `SOURCE-OF-TRUTH.template.yaml`
- `NON-GOALS.template.yaml`

Copy them into `.planning/milestones/<milestone>/context/` without the
`.template` segment and replace placeholders with milestone-specific content.
Capsules are hand-authored; they are not synthesized by an LLM.

## Project Anchors

Run the composer for a milestone:

```bash
node super-gsd/tools/context-authority/context-composer.cjs --milestone vX.Y
```

The composer reads the six YAML capsules and asks the anchor writer to emit one
`context_anchor` CMB per file into `.planning/mesh/memory/cmbs.jsonl`.

## Staleness

Each anchor stores the canonical source path and the SHA-256 hash of the source
file content at projection time. Staleness checks reload the anchor from the
mesh ledger, re-hash the source file, and print `fresh` when the hash still
matches or `stale` when the capsule has changed.

# ByteRover Context Tree Seed

These files bootstrap the ByteRover context tree for a Super GSD project.

## Usage (API-Free — No External LLM Needed)

The install script handles all of this automatically. Manual steps below for reference.

```bash
# Install ByteRover CLI
npm install -g byterover-cli

# Initialize version control (creates .brv/ directory)
brv vc init
rm -rf .brv/context-tree/.git  # remove nested git repo

# Install Claude Code MCP connector
brv connectors install "Claude Code" --type mcp

# Seed the context tree by COPYING files directly (no API key needed)
mkdir -p .brv/context-tree/{patterns,anti-patterns,expertise,decisions,error-rules,scripts,domain}
cp brv-seed/domains/anti-*.md .brv/context-tree/anti-patterns/
cp brv-seed/domains/*expertise*.md .brv/context-tree/expertise/
cp brv-seed/domains/*deliberation*.md .brv/context-tree/expertise/
cp brv-seed/domains/*.md .brv/context-tree/patterns/  # remaining files

# Query using the local engine (no API key, ~0ms)
node ~/.claude/hooks/brv-query-local.js "dispatch rules autonomous loop"
```

**Why no `brv curate`?** ByteRover's curation pipeline requires an external LLM
provider (API key). On Claude Code Max plan, all LLM calls go through OAuth —
no API keys. So we write files directly to the context tree and query them with
our local BM25 search engine (`brv-query-local.js`). Same file format, same
directory structure, zero external cost.

## Domain Structure

```
.brv/context-tree/
├── decisions/         # Architectural and project decisions
├── patterns/          # Proven implementation patterns
├── anti-patterns/     # Failures learned the hard way
├── error-rules/       # ERR-NNNN prevention rules
├── scripts/           # Utility/hook/helper registry
│   ├── hooks/
│   ├── utilities/
│   ├── test-helpers/
│   └── build/
├── domain/            # Business domain knowledge
├── expertise/         # Board member expertise files
└── project-state/     # Current project intel
```

## Scoring Defaults

- New curations start at importance: 50
- Search hits: +3 importance
- Curation updates: +5 importance
- Recency halves every 21 days
- Archive threshold: importance <35 for draft maturity
- Core promotion: importance >=85

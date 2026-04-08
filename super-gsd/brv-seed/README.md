# ByteRover Context Tree Seed

These files bootstrap the ByteRover context tree for a Super GSD project.

## Usage

```bash
# Install ByteRover
npm install -g byterover-cli

# Initialize in project directory
brv

# Install Claude Code connector (MCP mode for tool access)
brv connectors install "Claude Code" --type mcp

# Seed the context tree
for f in brv-seed/domains/*.md; do
  brv curate --file "$f"
done
```

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

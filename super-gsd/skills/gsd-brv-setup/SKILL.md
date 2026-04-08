---
name: gsd-brv-setup
description: "Initialize ByteRover context tree for Super GSD. Seeds domain knowledge, configures MCP connector, verifies integration."
argument-hint: "[--seed-only | --verify]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
---

<objective>
One-time setup of ByteRover as the memory layer for Super GSD.
Installs connector, seeds context tree domains, verifies integration.

Modes:
- (default): Full setup — install, seed, verify
- `--seed-only`: Skip install, just seed domain files
- `--verify`: Check integration is working
</objective>

<step_1_install>
## Step 1: Check ByteRover Installation

```bash
which brv 2>/dev/null && brv --version || echo "NOT INSTALLED"
```

If not installed:
```bash
npm install -g byterover-cli
```

Initialize in project directory:
```bash
brv init 2>/dev/null || echo "Already initialized"
```
</step_1_install>

<step_2_connector>
## Step 2: Install Claude Code Connector (MCP)

```bash
brv connectors install "Claude Code" --type mcp
```

Verify .mcp.json created:
```bash
cat .mcp.json 2>/dev/null | head -20
```

The MCP connector exposes two tools to Claude Code:
- `brv-query` — retrieve context from the tree
- `brv-curate` — add/update knowledge in the tree
</step_2_connector>

<step_3_seed>
## Step 3: Seed Context Tree Domains

Read all seed files from the super-gsd brv-seed directory and curate them:

```bash
# Find all seed domain files
ls ~/.claude/get-shit-done/templates/super-gsd/brv-seed/domains/*.md 2>/dev/null
```

For each seed file:
1. Read the file
2. Curate into ByteRover:
   ```bash
   brv curate --file "{seed_file_path}"
   ```

Expected domains after seeding:
- gsd-workflow-expertise
- token-efficiency-expertise
- orchestrator-patterns
- cold-start-runbook
- commit-discipline
- script-registry-patterns
- deliberation-expertise
- model-routing-rules
- anti-patterns-premature-stopping

Report: "Seeded {N} domain knowledge files into ByteRover"
</step_3_seed>

<step_4_structure>
## Step 4: Create Domain Directories

Ensure the context tree has the expected domain structure:

```bash
# These directories will be auto-created by ByteRover on first curate
# but we verify they exist
ls .brv/context-tree/ 2>/dev/null
```

Expected structure:
```
.brv/context-tree/
├── decisions/        # Architectural and project decisions
├── patterns/         # Proven implementation patterns
├── anti-patterns/    # Failures learned the hard way
├── error-rules/      # ERR-NNNN prevention rules
├── scripts/          # Utility/hook/helper registry
├── domain/           # Business domain knowledge
├── expertise/        # Board member expertise files
└── project-state/    # Current project intel
```
</step_4_structure>

<step_5_verify>
## Step 5: Verify Integration

Test query:
```bash
brv query "orchestrator dispatch rules autonomous loop"
```

Expected: returns content from orchestrator-patterns domain.

Test curate:
```bash
brv curate "Test entry: Super GSD integration verified" --tags test,verification
```

Then verify:
```bash
brv query "Super GSD integration verified"
```

Clean up test entry if needed.

Report results:
```
ByteRover Integration Status:
- Installation: OK
- MCP Connector: OK
- Context Tree: {N} domains seeded
- Query Test: {PASS/FAIL}
- Curate Test: {PASS/FAIL}
```
</step_5_verify>

<step_6_migrate_memory>
## Step 6: Migrate Existing Memory (Optional)

If ~/.claude/projects/*/memory/ contains files:

1. List existing memory files
2. For each file with frontmatter:
   - Read content
   - Classify domain (feedback → patterns/anti-patterns, reference → patterns, project → domain)
   - Curate into ByteRover with appropriate domain/importance
3. Report: "Migrated {N} memory files to ByteRover"

Do NOT delete the original memory files — keep as fallback until ByteRover is proven.
</step_6_migrate_memory>

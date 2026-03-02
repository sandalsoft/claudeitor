Built three core data layer modules:

1. **Git Scanner** (`src/lib/server/git/scanner.ts`): Discovers git repos from configured dirs (max depth 3), gathers commit history, branch, uncommitted/unpushed counts. Implements split caching: commit log cached by HEAD hash, working-tree status always refreshed.

2. **Config Reader** (`src/lib/server/config.ts`): Reads `claudeitor.config.json` with tilde expansion for paths. Returns sensible defaults when config file is missing.

3. **Cost Calculator** (`src/lib/server/claude/cost-calculator.ts`): Computes per-model and aggregate costs from CostCache + PricingData using model-mapping from task 2. Handles unknown models with $0 cost and warning. Provides daily cost breakdown for trend charts.

All acceptance criteria met. 29 new tests, all 58 tests passing. TypeScript strict mode clean.

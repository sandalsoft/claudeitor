# fn-1-claudeitor-coding-activity-dashboard.3 Build data layer: git repo scanning, config reader, and cost calculator

## Description
Build the git repo scanning module, config file reader, and cost calculation engine. The git scanner discovers repos from configured directories, reads commit history/status, and uses a split caching strategy. The config reader handles claudeitor.config.json with tilde expansion. The cost calculator combines token usage data with pricing to compute per-model and aggregate costs.

**Size:** M
**Files:** src/lib/data/git/scanner.ts, src/lib/data/git/types.ts, src/lib/data/config.ts, src/lib/data/claude/cost-calculator.ts

## Approach
- Git scanner: use child_process.exec for git commands (git log, git status, git rev-parse)
- Discover repos: recursively scan configured repoDirs for .git directories (max depth 3)
- **Split caching strategy** (from code review):
  - Expensive data like commit log and branch info: cache keyed by repo path + HEAD hash, skip if HEAD unchanged
  - Cheap working-tree data like uncommitted files and unpushed commits: ALWAYS refresh using `git status --porcelain` and `git rev-list @{u}..HEAD` (fast, sub-second)
  - This ensures hygiene indicators stay current even when HEAD has not changed
- Config reader: read claudeitor.config.json from project root, expand ~ to os.homedir()
- Cost calculator: iterate CostCache days, map model IDs to pricing using model-mapping from task 2, compute daily/model/total costs
- Handle missing git binary, non-git directories, permission errors

## Key context
- Split caching is critical: users care about hygiene which changes without HEAD changing
- Tilde in paths must be expanded manually in Node.js via os.homedir()
- Cost calculation must handle models not present in pricing file (log warning, show as unknown with $0)
- Git commands may timeout on very large repos - use timeout option in exec (10s default)
## Approach
- Git scanner: use child_process.exec for git commands (git log, git status, git rev-parse)
- Discover repos: recursively scan configured repoDirs for .git directories (max depth 3)
- Cache scan results keyed by repo path + HEAD commit hash (skip unchanged repos)
- Per-repo data: recent commits (last 30 days), uncommitted file count, unpushed commit count, branch info
- Config reader: read claudeitor.config.json from project root, expand ~ to os.homedir()
- Cost calculator: iterate CostCache days, map model IDs to pricing, compute daily/model/total costs
- Handle missing git binary, non-git directories, permission errors

## Key context
- Repo scanning must be incremental: use git rev-parse HEAD to detect changes
- Tilde (~) in paths must be expanded manually in Node.js (os.homedir())
- Cost calculation must handle models not present in pricing file (log warning, skip)
- Git commands may timeout on very large repos - use timeout option in exec
## Acceptance
- [ ] scanRepos() discovers git repositories from configured directories
- [ ] Per-repo: getRepoInfo() returns recent commits, uncommitted files, unpushed commits, branch
- [ ] Split caching: commit log cached by HEAD hash; working-tree status always refreshed
- [ ] Working-tree refresh uses git status --porcelain (sub-second, no caching)
- [ ] getCommitsToday() returns commit count across all repos for current day
- [ ] readConfig() reads claudeitor.config.json with tilde expansion
- [ ] readConfig() returns sensible defaults when config file is missing
- [ ] calculateCosts() computes per-model costs from CostCache + PricingData
- [ ] calculateCosts() handles missing models in pricing (warns, shows $0)
- [ ] calculateDailyCosts() returns cost-per-day array for trend charts
- [ ] Git timeout handling: repos that take more than 10s are skipped with warning
- [ ] Missing git binary detected gracefully (not a crash)
## Done summary
Built three core data layer modules:

1. **Git Scanner** (`src/lib/server/git/scanner.ts`): Discovers git repos from configured dirs (max depth 3), gathers commit history, branch, uncommitted/unpushed counts. Implements split caching: commit log cached by HEAD hash, working-tree status always refreshed.

2. **Config Reader** (`src/lib/server/config.ts`): Reads `claudeitor.config.json` with tilde expansion for paths. Returns sensible defaults when config file is missing.

3. **Cost Calculator** (`src/lib/server/claude/cost-calculator.ts`): Computes per-model and aggregate costs from CostCache + PricingData using model-mapping from task 2. Handles unknown models with $0 cost and warning. Provides daily cost breakdown for trend charts.

All acceptance criteria met. 29 new tests, all 58 tests passing. TypeScript strict mode clean.
## Evidence
- Commits: 8331020
- Tests: npx vitest run (58 passed, 0 failed)
- PRs:
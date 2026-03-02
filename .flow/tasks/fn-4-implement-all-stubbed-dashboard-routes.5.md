# fn-4-implement-all-stubbed-dashboard-routes.5 Repository Visualization routes (/work-graph, /repo-pulse)

## Description
Implement the /work-graph and /repo-pulse routes.

**Size:** M
**Files:**
- `src/routes/work-graph/+page.server.ts` (NEW)
- `src/routes/work-graph/+page.svelte` (REWRITE)
- `src/lib/components/charts/BranchGraph.svelte` (NEW)
- `src/routes/repo-pulse/+page.server.ts` (NEW)
- `src/routes/repo-pulse/+page.svelte` (REWRITE)
- `src/lib/data/types.ts` (MODIFY — add BranchNode, BranchEdge, RepoPulseInfo types)

## Approach

**`/work-graph`** — Branch visualization:
- scanRepos() for repo discovery. Per repo:
  - Branches: `execFile('git', ['branch', '-a', '--format=%(refname:short) %(objectname:short) %(committerdate:iso8601)'], { cwd: repo.path })`. **Filter out `*/HEAD` symbolic refs** from output (e.g. `origin/HEAD` lines).
  - Default branch: `execFile('git', ['symbolic-ref', 'refs/remotes/origin/HEAD'], { cwd: repo.path })` → fallback to checking `main` then `master`. Handle no-remote repos.
  - Merge-base: `execFile('git', ['merge-base', branch, defaultBranch], { cwd: repo.path })` per non-default branch.
- 100 branches total across all repos, global sort by committerdate.
- Node IDs: `${repoName}:${branchName}`.
- D3 force-directed graph in BranchGraph.svelte. Stop simulation on unmount.

**`/repo-pulse`** — Repository activity:
- scanRepos() ONLY. All metrics from `RepoInfo` fields:
  - Commit frequency: count `RepoInfo.commits` (which are `RepoCommit[]`) in 7d/30d windows
  - Contributors: unique `commit.authorName` values (real field name from `RepoCommit` type, NOT `author`)
  - Last commit age: most recent `RepoCommit.date`
  - Uncommitted: `RepoInfo.uncommittedFileCount`
  - Unpushed: `RepoInfo.unpushedCommitCount`
- **No branch count v1.** No readStatsCache().
- Activity score: 7d commits × 3 + 30d commits. Sort most active first.
- Sparkline: inline SVG polyline.

## Key context

- `RepoCommit` type (in `src/lib/server/git/types.ts`) has `authorName`/`authorEmail`, NOT `author`
- Filter `origin/HEAD` and any `*/HEAD` symbolic refs from branch enumeration
- `--format=` in execFile array: `['show', '--numstat', '--format=', hash]` (no shell quotes needed)
- All new types in `src/lib/data/types.ts`

## Acceptance
- [ ] /work-graph filters out */HEAD symbolic refs from branch list
- [ ] /work-graph uses namespaced IDs and hub-and-spoke
- [ ] /work-graph uses execFile with array args for all git commands
- [ ] /repo-pulse uses `authorName` field (not `author`) from RepoCommit type
- [ ] /repo-pulse derives ALL metrics from RepoInfo (no extra git calls, no readStatsCache)
- [ ] All new types in `src/lib/data/types.ts`
- [ ] Both routes use `withSpan()` instrumentation
- [ ] `pnpm check` passes
## Done summary
Implemented /work-graph and /repo-pulse routes replacing ComingSoon stubs. /work-graph enumerates branches across repos using execFile, filters */HEAD symbolic refs, builds hub-and-spoke graph with namespaced IDs, and renders a D3 force-directed visualization. /repo-pulse derives all metrics (commit frequency, contributors, sparkline, activity score) from RepoInfo fields only using authorName, with no extra git calls.
## Evidence
- Commits: 63871af22a23a9ec1bddad4cb9f3924c1d68148d
- Tests: pnpm check
- PRs:
# fn-4-implement-all-stubbed-dashboard-routes.3 Git Health routes (/hygiene, /worktrees)

## Description
Implement the /hygiene and /worktrees routes.

**Size:** M
**Files:**
- `src/routes/hygiene/+page.server.ts` (NEW)
- `src/routes/hygiene/+page.svelte` (REWRITE)
- `src/lib/server/git/worktrees.ts` (NEW)
- `src/routes/worktrees/+page.server.ts` (NEW)
- `src/routes/worktrees/+page.svelte` (REWRITE)
- `src/lib/data/types.ts` (MODIFY — add HygieneIssue, WorktreeInfo types)

## Approach

**`/hygiene`** — Code hygiene audit:
- Issues from RepoInfo (no extra git calls): uncommitted changes, unpushed commits.
- Issues requiring one git command per repo:
  - **Stale branches**: `execFile('git', ['for-each-ref', '--sort=-committerdate', '--format=%(refname:short) %(committerdate:unix)', 'refs/heads/'], { cwd: repo.path })`. **Stale = no commits in 60 days.** Exclude the current branch (it's expected to be recent). Show count of stale branches + list of oldest 10 stale branch names per repo.
  - **Current branch behind upstream**: `execFile('git', ['rev-list', '--count', 'HEAD..@{u}'], { cwd: repo.path })`. Shows how many commits the current checked-out branch is behind its upstream. Try/catch — no upstream = info-level "no upstream configured".
- All git commands via execFile with cwd + array args. safeExecFile wrapper for non-zero exit handling.

**`/worktrees`** — same as v4 (no new issues).

## Key context

- Stale threshold: 60 days with no commits on branch, excluding current branch
- Show count + oldest 10 stale branches per repo in UI
- All new types in `src/lib/data/types.ts`

## Acceptance
- [ ] /hygiene stale branches defined as >60 days, excludes current branch, shows oldest 10
- [ ] /hygiene current-branch-behind-upstream clearly labeled (not "default branch")
- [ ] /hygiene uses execFile with cwd + array args
- [ ] All new types in `src/lib/data/types.ts`
- [ ] Both routes use `withSpan()` instrumentation
- [ ] `pnpm check` passes
## Done summary
Implemented /hygiene and /worktrees routes replacing ComingSoon stubs. /hygiene audits repos for uncommitted changes, unpushed commits, stale branches (>60 days, excludes current branch, shows oldest 10), and current-branch-behind-upstream using execFile with array args. /worktrees reads git worktree list --porcelain output. Both routes use withSpan() instrumentation, StatCards, EmptyState, and filtering. All new types (HygieneIssue, StaleBranch, WorktreeInfo) added to src/lib/data/types.ts.
## Evidence
- Commits: d7ec08c3c1670297aef1fb278d81314667f18d80
- Tests: pnpm check, pnpm test
- PRs:
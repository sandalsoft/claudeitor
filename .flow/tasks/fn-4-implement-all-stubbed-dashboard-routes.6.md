# fn-4-implement-all-stubbed-dashboard-routes.6 Session Analysis routes (/diffs, /snapshots)

## Description
Implement the /diffs and /snapshots routes.

**Size:** M
**Files:**
- `src/routes/diffs/+page.server.ts` (NEW)
- `src/routes/diffs/+page.svelte` (REWRITE)
- `src/routes/snapshots/+page.server.ts` (NEW)
- `src/routes/snapshots/+page.svelte` (REWRITE)
- `src/lib/data/types.ts` (MODIFY — add SessionDiff, FileMutation, SnapshotEntry types)

## Approach

**`/diffs`** — Session file diff viewer:
- `readSessionHistory(config.claudeDir)` → sort by `timestamp` desc → take 50. Note: `SessionEntry` has field `display` (NOT `displayText`).
- Line-level JSONL parser: `parseMutationFromLine(line: string): FileMutation | null`. Production uses readline streaming.
- Display: expand/collapse per session.

**`/snapshots`** — Project state timeline:
- scanRepos() → `RepoInfo.commits` (30-day window). Flatten chronologically. Document limitation in UI.
- File change counts: `execFile('git', ['show', '--numstat', '--format=', hash], { cwd: repo.path })` — exact argv array, no shell quoting needed. Count output lines = files changed. Only for current page (max 20).
- Uses `RepoCommit.authorName` (real field name, not `author`).
- Paginate 20 per page.

## Key context

- `SessionEntry.display` not `displayText`
- `RepoCommit.authorName` not `author`
- execFile array: `['show', '--numstat', '--format=', hash]` — `--format=` with empty value, no quotes
- All new types in `src/lib/data/types.ts`

## Acceptance
- [ ] /diffs uses correct field name `display` (not `displayText`)
- [ ] /diffs sorts by timestamp desc before taking 50
- [ ] /snapshots uses `['show', '--numstat', '--format=', hash]` exact argv
- [ ] /snapshots uses `authorName` (not `author`)
- [ ] /snapshots documents 30-day window in UI
- [ ] All new types in `src/lib/data/types.ts`
- [ ] Both routes use `withSpan()` instrumentation
- [ ] `pnpm check` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

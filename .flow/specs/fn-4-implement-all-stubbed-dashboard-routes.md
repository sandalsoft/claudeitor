# Implement All Stubbed Dashboard Routes

## Overview

Replace all 12 `ComingSoon` placeholder pages with functional dashboard routes. Each route reads from local data sources (`~/.claude/`, git repos, system commands) and follows the established pattern: `withSpan` server load → StatCards + content components with Svelte 5 runes.

**Why**: The sidebar shows 12 grayed-out stubs. Shipping real content for each transforms Claudeitor from a partial dashboard into a comprehensive developer command center. Every route uses only local data — no external APIs required.

**Network caveat**: `/deps` uses `npm audit` and `npm outdated` which call the npm registry. These are treated as best-effort: timeouts and offline states are handled gracefully with a clear "unavailable" fallback. All other routes are fully offline-capable.

**Who's affected**:
- **End users**: 12 new functional pages replacing placeholders
- **Developers**: New server-side readers for ports, env, worktrees, deps, lint
- **Operations**: New shell commands spawned (lsof, npm audit, git worktree list, eslint)

## Critical: repoDirs vs discovered repos

`config.repoDirs` are **scan roots**, NOT repo roots. Routes MUST use `scanRepos(config.repoDirs)` to discover actual repos, then operate on each `repo.path`.

## Critical: Command execution safety (NEW code only)

All **NEW** shell commands introduced in this epic MUST use `execFile` (or `exec` with `cwd`) with arguments as arrays. Never interpolate paths/branch names into command strings. The existing `src/lib/server/git/scanner.ts` uses `execAsync` with template strings — that is out of scope for this epic and will NOT be refactored here. The safety requirement applies only to new commands added by tasks 2–6.

## Critical: Server→client serialization safety

Never return raw settings objects to the client. `SettingsData.env` contains secrets. `SettingsData.hooks` contains shell commands. Server loads MUST return explicitly safe shapes: counts, derived metadata, booleans — never raw config/settings.

## Critical: Non-zero exit code handling

`npm audit`, `npm outdated`, `eslint`, `tsc` all exit non-zero when they successfully find issues. All exec wrappers MUST capture `{ stdout, stderr, exitCode, timedOut }` on BOTH success and failure. Node's `execFile` throws on non-zero exit but includes `stdout`/`stderr` on the error object — wrappers must extract these from the error. Never discard output on non-zero exit.

## Scope

### In scope
- 12 route implementations replacing `ComingSoon` stubs
- New server readers: port scanner, env parser, worktree reader, dep auditor, lint aggregator
- D3.js branch graph visualization for /work-graph
- All new types in `src/lib/data/types.ts` (single source of truth for NEW serialized types)
- Empty states for missing data
- Remove `stub: true` flags from navigation
- Update README.md route listing

### Out of scope
- Refactoring existing scanner.ts to use execFile (separate follow-up)
- GitHub API integration
- Real-time polling for new routes
- Plugin installation/removal from /extensions UI
- Cross-platform lsof alternatives
- Package manager detection beyond npm

### Scope decisions
- **/env**: NAMES only. Scan discovered repo roots. Broad key pattern with optional spaces around `=`.
- **/work-graph**: Hub-and-spoke, 100 branches total, namespaced IDs. Filter out `*/HEAD` symbolic refs.
- **/snapshots**: Git commits from scanRepos (30-day window, documented in UI). `--numstat` for file counts.
- **/extensions**: Merge installed_plugins.json with enabledPlugins (`Record<string, boolean>`). Never return settings.env or hooks commands. Only return counts for hooks.
- **/deps**: npm only. Best-effort. Exec returns `{ stdout, stderr, exitCode, timedOut }` always. Use `execFile('npm', ['audit', '--json'])`.
- **/lint**: Local executables only. Same exec wrapper pattern. Concatenate stdout+stderr for tsc.
- **/ports**: macOS lsof. `(LISTEN)` parsing from NAME field. IPv4/IPv6 dedup. 30s cache with `?refresh=1` bypass.
- **/setup**: All checks driven from `config.claudeDir` (not hardcoded `~/.claude/`). Config file: stat + JSON.parse for 3-state check.
- **/hygiene**: "Behind upstream" = current branch vs @{u}. Stale branches = no commits in 60 days, excluding current branch. Show count + oldest 10.
- **/repo-pulse**: All metrics from RepoInfo fields only. No branch count v1. Use `authorName`/`authorEmail` (real field names from `RepoCommit` type, not `author`).

### Task parallelism and types.ts

All tasks add types to `src/lib/data/types.ts`. This means tasks are NOT fully parallel-safe (merge conflicts possible). In practice: work tasks sequentially (in order) or accept merge conflict resolution. Task 7 runs last by dependency.

### Type placement rule
All NEW serialized types go in `src/lib/data/types.ts`. Existing routes grandfathered.

### Testing strategy
New readers MUST separate exec from parse. Unit tests exercise parsing with fixture strings. Tests MUST NOT require network or binaries. Exec wrappers always return `{ stdout, stderr, exitCode, timedOut }` regardless of exit code.

## Approach

**Pattern to follow** (from `/repos`):
- Server: `+page.server.ts` with `withSpan()`, `readConfig()`, `scanRepos()`, safe return shapes
- Client: `+page.svelte` with `$props()`, `$derived`, StatCards, EmptyState, Icon
- Types: All new shared types in `src/lib/data/types.ts`

**Exec wrapper pattern** (for all new readers):
```typescript
// Signature — always returns full result, never throws on non-zero exit
async function safeExecFile(cmd, args, opts): Promise<{ stdout: string, stderr: string, exitCode: number, timedOut: boolean }>
```
This wrapper catches errors from `execFile`, extracts `stdout`/`stderr` from the error object, and returns a uniform shape.

## Quick commands

```bash
pnpm dev
pnpm check
pnpm test
```

## Acceptance

- [ ] All 12 stubs replaced (no ComingSoon components)
- [ ] Each route has +page.server.ts with `withSpan()`
- [ ] Each route handles empty state gracefully
- [ ] Routes use scanRepos() discovered paths
- [ ] All NEW commands use execFile with array args (existing scanner.ts not in scope)
- [ ] Exec wrappers always return { stdout, stderr, exitCode, timedOut } — never discard on non-zero exit
- [ ] No raw settings/config objects returned to client
- [ ] /env never exposes secret values
- [ ] /ports handles unsupported platforms; 30s cache with ?refresh=1 bypass
- [ ] /deps and /lint use on-demand execution
- [ ] /deps handles offline/timeout
- [ ] /lint uses local executables only
- [ ] /work-graph hub-and-spoke with namespaced IDs, filters HEAD refs
- [ ] `stub: true` removed from navSections
- [ ] README.md updated
- [ ] All new types in `src/lib/data/types.ts`
- [ ] `pnpm check` passes (0 errors)
- [ ] `pnpm test` passes

## References

- Stub route pattern: `src/routes/setup/+page.svelte`
- Implemented route pattern: `src/routes/repos/+page.server.ts`
- Component library: `src/lib/components/`
- Git scanner: `src/lib/server/git/scanner.ts` (uses execAsync with template strings — NOT refactored in this epic)
- Git types: `src/lib/server/git/types.ts` — `RepoCommit` has `authorName`/`authorEmail` (not `author`)
- Navigation: `src/lib/stores/navigation.svelte.ts`
- D3 chart pattern: `src/lib/components/charts/ActivityChart.svelte`
- Telemetry: `src/lib/server/telemetry/span-helpers.ts`

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| types.ts merge conflicts between tasks | Work tasks sequentially; accept conflict resolution |
| Existing scanner uses string interpolation | Out of scope; only new commands use execFile |
| Non-zero exit discards output | safeExecFile wrapper always captures stdout/stderr |
| Settings secrets leaked | Explicit safe shapes; counts only for hooks |
| npm audit slow/offline | On-demand + timeout + stderr heuristics |
| lsof not available | Graceful fallback empty state |
| Branch name collisions | Namespaced IDs repoName:branchName |
| origin/HEAD in branch list | Filter out */HEAD refs |
| Config claudeDir varies | All checks use config.claudeDir, not hardcoded paths |
| 30s cache not bypassable | ?refresh=1 query param skips cache |

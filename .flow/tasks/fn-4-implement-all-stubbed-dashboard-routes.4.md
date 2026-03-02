# fn-4-implement-all-stubbed-dashboard-routes.4 Dependency & Lint routes (/deps, /lint)

## Description
Implement the /deps and /lint routes.

**Size:** M
**Files:**
- `src/lib/server/deps/audit.ts` (NEW)
- `src/routes/deps/+page.server.ts` (NEW)
- `src/routes/deps/+page.svelte` (REWRITE)
- `src/lib/server/lint/runner.ts` (NEW)
- `src/routes/lint/+page.server.ts` (NEW)
- `src/routes/lint/+page.svelte` (REWRITE)
- `src/lib/data/types.ts` (MODIFY — add DepAuditResult, OutdatedPackage, LintIssue types)

## Approach

**Shared exec wrapper** (used by both readers):
```typescript
// safeExecFile — ALWAYS returns full result, NEVER throws on non-zero exit
// Node's execFile throws on non-zero exit but includes stdout/stderr on error object
async function safeExecFile(cmd: string, args: string[], opts: ExecFileOptions): Promise<ExecResult> {
  // catch error, extract e.stdout, e.stderr, e.code → return uniform { stdout, stderr, exitCode, timedOut }
}
```

**`/deps`** — Dependency audit:
- Use scanRepos() for repo discovery. Run in each `repo.path`.
- `execFile('npm', ['audit', '--json'], { cwd: repoPath, timeout: 10000 })` via safeExecFile.
- `execFile('npm', ['outdated', '--json'], { cwd: repoPath, timeout: 10000 })` via safeExecFile. Note: `npm outdated` also exits non-zero when outdated packages exist — same handling pattern.
- Status derivation from exec result: timedOut → timeout status. stderr heuristics (ENOTFOUND, etc) → offline. Parse stdout JSON regardless of exitCode → audit data. JSON parse fails → unavailable.
- On-demand form action. Cached by repo + lockfile mtime.

**`/lint`** — Aggregated lint:
- Use scanRepos(). Run in each `repo.path`.
- `execFile('./node_modules/.bin/eslint', ['--format', 'json', '.'], { cwd: repoPath, timeout: 15000 })` via safeExecFile. eslint exits non-zero when issues found — use safeExecFile to capture output.
- `execFile('./node_modules/.bin/tsc', ['--noEmit', '--pretty', 'false'], { cwd: repoPath })` via safeExecFile. tsc exits non-zero when errors found. Concatenate `stdout + '\n' + stderr` for parsing (output channel varies).
- On-demand "Run Lint" button. Cached results on page load.

## Key context

- npm audit, npm outdated, eslint, tsc ALL exit non-zero on "found issues" (success with results)
- safeExecFile catches the error and extracts stdout/stderr from error object
- All commands use execFile with array args
- All new types in `src/lib/data/types.ts`

## Acceptance
- [ ] safeExecFile wrapper captures { stdout, stderr, exitCode, timedOut } on all exit codes
- [ ] /deps uses execFile('npm', ['audit', '--json']) — array args
- [ ] /deps uses execFile('npm', ['outdated', '--json']) — handles non-zero exit
- [ ] /deps status derivation: timedOut → offline → parse JSON → unavailable
- [ ] /lint uses execFile for eslint and tsc — never npx
- [ ] /lint captures output from non-zero exit eslint/tsc via safeExecFile
- [ ] /lint concatenates tsc stdout+stderr for parsing
- [ ] All parsers are pure functions with fixture-based tests
- [ ] All new types in `src/lib/data/types.ts`
- [ ] Both routes use `withSpan()` instrumentation
- [ ] `pnpm check` passes
## Done summary
Implemented /deps and /lint routes replacing ComingSoon stubs. /deps runs npm audit/outdated with on-demand form action, caches by lockfile mtime, and handles timeout/offline/unavailable states. /lint runs local eslint and tsc binaries, concatenating tsc stdout+stderr for parsing. Extracted safeExecFile to shared exec.ts module. Added 32 fixture-based tests for all pure parsers (parseAuditJson, parseOutdatedJson, parseEslintJson, parseTscOutput). Both routes use withSpan() instrumentation and execFile with array args.
## Evidence
- Commits: f631d3798b5d493df2f694e2485fd4bb06c28caa
- Tests: pnpm check, pnpm test
- PRs:
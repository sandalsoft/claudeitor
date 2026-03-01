## Description

Add git workflow automation, rate limiting, terminal stream UI, and audit logging to the svelte-sentinel daemon. This task wires together the detection (task 4) and orchestration (task 5) layers with production-grade safety controls and developer-facing output.

**Size:** M
**Files (svelte-sentinel repo):**
- `src/git.ts` — Git operations via simple-git: create fix branch, commit, merge, revert, conflict detection
- `src/rate-limiter.ts` — Token bucket with sliding window: max 5 fixes per 10 minutes, circuit breaker on 3 consecutive verification gate failures
- `src/ui.ts` — Terminal formatted stream: colorized status, fix progress, audit events
- `src/audit.ts` — JSONL audit log writer: fix attempts, outcomes, timing, revert events
- `src/pipeline.ts` — Main pipeline wiring: tailer → detector → rate limiter → orchestrator → git → audit → UI
- `tests/git.test.ts` — Git operations with temp repo fixtures
- `tests/rate-limiter.test.ts` — Rate limiter edge cases
- `tests/audit.test.ts` — Audit log format validation

## Approach

- **Git workflow** (via simple-git):
  - Before fix: check working tree is clean (`git status --porcelain`), bail if dirty
  - Create branch: `sentinel/<category>-<short-desc>` (e.g., `sentinel/error-parse-config`)
  - If branch name exists: append timestamp suffix (e.g., `sentinel/error-parse-config-1709312400`)
  - After successful verification: fast-forward merge to current branch
  - On merge conflict: revert fix branch, log to audit, mark as needs_human
  - Cleanup: delete fix branch after merge (keep for failed merges)

- **Rate limiter**:
  - Sliding window: track fix timestamps in circular buffer
  - Check: count fixes in last 10 minutes, reject if >= 5
  - **Retries count as fix attempts** against the token bucket
  - Circuit breaker: if 3 consecutive **verification gate failures**, pause for 5 minutes
  - Expose `canFix()` and `recordFix(success: boolean)` API

- **Terminal UI**:
  - Colorized stdout: green=success, yellow=warning, red=error, cyan=info
  - Show: daemon status, current fix progress, recent audit entries
  - Format: `[12:34:56] [sentinel] Detected error in config.ts → spawning fix...`
  - Stream mode: continuous output (not TUI/blessed — just formatted console)

- **Audit log**:
  - JSONL file at `.svelte-sentinel/audit.jsonl`
  - Each record: `{ timestamp, issueId, category, file, action, outcome, duration, model, attempt }`
  - Actions: `detected`, `fix_started`, `fix_completed`, `verification_passed`, `verification_failed`, `merged`, `reverted`, `needs_human`, `rate_limited`

- **Pipeline wiring**:
  - Connect tailer events → detector → rate limiter gate → orchestrator → git → audit
  - Handle graceful shutdown (SIGTERM/SIGINT): finish current fix, write audit, close tailer

## Key context

- simple-git: use `simpleGit(projectDir)` with the `--project` path from CLI
- Git operations must be atomic: if merge fails, ensure branch is reverted and working tree is clean
- Rate limiter state is in-memory only (resets on daemon restart — acceptable for V1)
- Terminal UI is NOT a TUI (no blessed/ink) — just formatted console.log with ANSI colors
- Audit log rotation is out of scope for V1 (file grows unbounded)
- Pipeline must handle daemon crash gracefully: orphaned fix branches are logged on next startup

## Acceptance

- [ ] Git operations via simple-git: create fix branch, commit, fast-forward merge, revert
- [ ] Fix branch naming: sentinel/<category>-<short-desc> with timestamp suffix on collision
- [ ] Working tree check before fix: bail if dirty (uncommitted changes)
- [ ] Merge conflict detection: revert and mark as needs_human
- [ ] Fix branch deleted after successful merge
- [ ] Rate limiter: sliding window, max 5 fixes per 10 minutes
- [ ] Retries count as fix attempts against the rate limiter bucket
- [ ] Circuit breaker: pause 5 minutes after 3 consecutive verification gate failures
- [ ] Terminal UI: colorized formatted output with timestamps and status
- [ ] Audit log: JSONL at .svelte-sentinel/audit.jsonl with action, outcome, timing
- [ ] Audit records for all lifecycle events: detected, fix_started, fix_completed, merged, reverted, needs_human, rate_limited
- [ ] Pipeline wiring: tailer → detector → rate limiter → orchestrator → git → audit → UI
- [ ] Graceful shutdown: SIGTERM/SIGINT finish current fix before exit
- [ ] Unit tests for git (temp repo), rate limiter (window edge cases, circuit breaker), audit (format)
- [ ] bun test passes with 0 failures

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

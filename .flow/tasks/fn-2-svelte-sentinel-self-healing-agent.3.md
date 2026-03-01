## Description

Replace all 25+ console.warn/log/error calls across Claudeitor server code with the structured logger from task 1. Every log call becomes a structured OTel-inspired log record in the JSONL telemetry file while preserving human-readable output via `process.stdout.write`/`process.stderr.write`.

**Size:** M
**Files:**
- `src/routes/api/sse/+server.ts` — 1 console.warn (SSE serialization error)
- `src/routes/sessions/[id]/+page.server.ts` — 1 console.warn (AI summary failed)
- `src/routes/api/settings/+server.ts` — 1 console.error (config write failed)
- `src/lib/server/claude/sessions.ts` — 2 console.warn (malformed lines, read failure)
- `src/lib/server/claude/agents.ts` — 2 console.warn (file read, dir read)
- `src/lib/server/claude/skills.ts` — 1 console.warn (dir read failure)
- `src/lib/server/claude/settings.ts` — 1 console.warn (parse failure)
- `src/lib/server/claude/cost-calculator.ts` — 1 console.warn (no pricing for model)
- `src/lib/server/claude/model-mapping.ts` — 2 console.warn (no pricing data, unknown model)
- `src/lib/server/claude/costs.ts` — 2 console.warn (parse cost cache, parse pricing)
- `src/lib/server/claude/stats.ts` — 1 console.warn (parse stats cache)
- `src/lib/server/config.ts` — 1 console.warn (parse config)
- `src/lib/server/git/scanner.ts` — 1 console.warn (git timeout)
- `src/lib/server/watcher.ts` — 7 console.warn/log (listener error, file read, dir missing, chokidar error, created, cleanup, singleton warning, destroyed, close error)

## Approach

- Import logger functions from `$lib/server/telemetry/logger`: `import { info, warn, error } from '$lib/server/telemetry/logger'`
- Logger function signature: `warn(module: string, message: string, attributes?: Record<string, unknown>)` — module is the first parameter, not an attribute
- Map each console call to appropriate severity: `console.warn('[foo] msg')` → `warn('foo', 'msg')`, `console.error` → `error()`, `console.log` → `info()`
- Module prefix becomes the first argument (e.g., `console.warn('[watcher] error')` → `warn('watcher', 'error')`)
- Include error.type and error.stack attributes for error/warn calls that catch exceptions
- Since the logger uses `process.stdout.write`/`process.stderr.write` (not `console.*`), the grep-based acceptance criteria will pass cleanly
- Under NODE_ENV=test, logger skips JSONL file writes but still writes to stdout/stderr — tests can spy on `process.stderr.write` or mock the logger module to verify warning behavior
- Update test spies: tests that spy on `console.warn` must now verify via `process.stderr.write` spy or logger mock, since logger doesn't call `console.warn`

## Key context

- Some tests in `readers.test.ts` spy on `console.warn` to verify warnings fire — these must be updated to spy on `process.stderr.write` or mock the logger
- The watcher.ts has the most calls (7) and is the most sensitive module (singleton, HMR-aware)
- Pattern: keep the human-readable string as `body`, put structured metadata in `attributes`
- The logger's console output path (`process.stdout.write`/`process.stderr.write`) does not use `console.*`, so grep for `console\.\(warn\|error\|log\)` across server code will correctly return 0 matches
- Under NODE_ENV=test, no `.claudeitor/telemetry.jsonl` is created (file writing disabled)
- grep acceptance checks must exclude test files (`--glob '!**/*.test.ts'`) since test fixtures may contain `console.log` strings

## Acceptance

- [ ] Zero console.warn/log/error calls remain in server-side code (excluding test files)
- [ ] All replaced with structured logger (info/warn/error)
- [ ] Each log record includes module attribute matching original prefix
- [ ] Error/exception log records include error.type and error.stack attributes
- [ ] Human-readable output preserved via process.stdout.write/process.stderr.write (dual output)
- [ ] Tests updated to verify structured logging (spy on logger or process.stderr.write, not console.warn)
- [ ] Watcher module logs include lifecycle events (created, cleanup, destroyed)
- [ ] `rg 'console\.(warn|error|log)' src/lib/server/ --glob '!*.test.ts'` returns 0 matches
- [ ] `rg 'console\.(warn|error|log)' src/routes/ --glob '!*.test.ts' -g '*.server.ts'` returns 0 matches
- [ ] pnpm check passes with 0 errors
- [ ] Existing tests updated and passing (97+ tests)

<!-- Updated by plan-sync: fn-2-svelte-sentinel-self-healing-agent.1 implemented logger with signature warn(module, message, attrs?) not logger.warn(message, {module}) -->

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

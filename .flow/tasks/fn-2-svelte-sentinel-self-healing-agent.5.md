## Description

Build the `claude -p` fix orchestration layer: receives `DetectedIssue` events from the detector (task 4), constructs appropriate prompts using SKILL.md templates, spawns headless Claude sessions via `Bun.spawn()`, captures output, and runs the verification gate. Includes retry logic with enriched context on failure.

**Size:** M
**Files (svelte-sentinel repo):**
- `src/orchestrator.ts` — Fix orchestrator: receives issues, constructs prompts, manages fix lifecycle
- `src/spawner.ts` — `claude -p` process spawner via `Bun.spawn()`: timeout, stdout/stderr capture, exit code handling
- `src/verifier.ts` — Verification gate: runs configurable verification commands with timeout
- `src/templates.ts` — Prompt template loader: reads SKILL.md files, interpolates issue context
- `src/templates/error-fix.md` — SKILL.md template for error fixes
- `src/templates/warning-fix.md` — SKILL.md template for warning fixes
- `tests/orchestrator.test.ts` — Unit tests with mock spawner
- `tests/verifier.test.ts` — Unit tests for verification gate

## Approach

- Orchestrator receives `DetectedIssue` (with extracted exception context from span events), determines fix strategy:
  - Single file (1 `code.filepath`) → configurable model (default: Sonnet 4.6), scoped tool access
  - Multi-file (2+ files or no filepath) → configurable model (default: Opus 4.6), broader tool access
- Construct prompt: load template, interpolate `{error_message}`, `{file_path}`, `{span_name}`, `{stack_trace}` from DetectedIssue context
- Spawn via `Bun.spawn()` with claude CLI:
  - CLI flags read from daemon config (model, max-turns, allowedTools, output-format)
  - Validate `claude --help` contains required flags on daemon startup (CLI compatibility check)
  - Capture stdout as streaming JSON
  - Kill after configurable timeout (default 300s per session)
  - Parse exit code: 0=success, non-zero=failure
- On success: run verification gate
  - Sequential execution of configurable commands (default: `pnpm check` → `pnpm test` → `pnpm build`)
  - Fail-fast: stop at first failure
  - Configurable timeout per command (default 120s)
- On verification failure: retry up to 3 times with enriched context
  - Add stderr from failed command to next prompt
  - Add the diff that caused failure
  - Increment attempt counter
- After 3 failures: mark issue as `needs_human` in audit log

## Key context

- `claude` CLI must be available on PATH (validate on daemon startup)
- Model selection and CLI flags are configurable (not hardcoded) — stored in daemon config
- Verification commands are configurable (not hardcoded) — accept via daemon config for projects using npm, yarn, or custom scripts
- Spawner must handle network errors (API timeout, auth failure) differently from logic errors (bad fix)
- Each fix session is isolated — no shared state between attempts

## Acceptance

- [ ] Orchestrator receives DetectedIssue events and determines fix strategy (single-file vs multi-file)
- [ ] Model selection configurable via daemon config (defaults: Sonnet 4.6 single-file, Opus 4.6 multi-file)
- [ ] Prompt templates loaded from SKILL.md files with context interpolation (error_message, file_path, stack_trace)
- [ ] claude -p spawned via Bun.spawn() with configurable CLI flags from daemon config
- [ ] CLI compatibility check on daemon startup (validates required flags exist)
- [ ] Process timeout: configurable hard kill per session (default 300s)
- [ ] Spawner distinguishes network errors (timeout, auth) from logic errors (bad fix)
- [ ] Verification gate runs configurable commands sequentially (fail-fast)
- [ ] Verification commands configurable via daemon config (default: pnpm check, pnpm test, pnpm build)
- [ ] Verification timeout: configurable per command (default 120s)
- [ ] Retry: up to 3 attempts with enriched context (stderr + diff from previous attempt)
- [ ] After 3 failures: issue marked as needs_human in audit log
- [ ] SKILL.md templates created for error-fix and warning-fix scenarios
- [ ] Unit tests cover orchestrator (mock spawner), verifier (mock shell), templates (interpolation)
- [ ] bun test passes with 0 failures

## Done summary
Built the claude -p fix orchestration layer: orchestrator receives DetectedIssue events, determines single/multi-file strategy with configurable model selection, constructs prompts from SKILL.md templates with context interpolation, spawns headless Claude sessions via Bun.spawn() with timeout and error classification, runs a fail-fast verification gate with configurable commands, and retries up to 3 times with enriched context (stderr + diff) before marking issues as needs_human. Added 60 new tests (126 total) covering orchestrator with mock spawner, verifier with real shell commands, and template interpolation.
## Evidence
- Commits: e74808eea9e5ab0a05cec2de37e347f0565b2bfc
- Tests: bun test (126 pass, 0 fail), bun run check (tsc --noEmit, 0 errors)
- PRs:
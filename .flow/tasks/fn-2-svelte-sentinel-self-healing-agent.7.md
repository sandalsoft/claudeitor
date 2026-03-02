## Description

Integration task: wire Claudeitor's telemetry output to svelte-sentinel's input, update Claudeitor config, create SKILL.md prompt templates for the daemon, and run end-to-end verification across both repos.

**Size:** M
**Files (Claudeitor repo):**
- `claudeitor.config.example.json` — Add telemetry config fields (path, rotation size, enabled)
- `src/lib/server/config.ts` — Read telemetry config fields

**Files (svelte-sentinel repo):**
- `README.md` — Setup instructions, prerequisites (Bun, claude CLI), CLI usage, config options
- `.sentinelignore.example` — Example ignore patterns (JavaScript RegExp syntax) for known noisy warnings
- `src/templates/error-fix.md` — Refined SKILL.md template for error fixes with codebase context
- `src/templates/warning-fix.md` — Refined SKILL.md template for warning fixes
- End-to-end test script

## Approach

- **Claudeitor config**: Add optional telemetry fields to config reader:
  - `telemetry.enabled` (boolean, default true)
  - `telemetry.path` (string, default `.claudeitor/telemetry.jsonl`)
  - `telemetry.rotationSizeMB` (number, default 50)
- **SKILL.md templates**: Create prompt templates that give Claude fix context:
  - Error template: include error message, file path, stack trace, surrounding code context, project conventions
  - Warning template: include warning text, file path, suggested fix pattern
  - Both templates instruct Claude to: read the file, understand the context, make minimal fix, run verification
- **.sentinelignore**: Document regex patterns (JavaScript RegExp syntax) for common false positives:
  - Deprecation warnings from node_modules
  - Known transient HMR warnings
  - Intentional test failures
- **End-to-end test**: Script that:
  1. Starts Claudeitor dev server
  2. Writes a synthetic error span to telemetry JSONL
  3. Starts svelte-sentinel in dry-run mode
  4. Verifies daemon detects the error and would spawn a fix
  5. Cleans up

## Key context

- This task depends on tasks 2, 3, and 6 — all instrumentation and daemon features must be complete
- The SKILL.md templates are critical for fix quality — they tell Claude HOW to fix issues
- Templates should reference Claudeitor's CLAUDE.md for project conventions
- .sentinelignore uses JavaScript RegExp syntax (not PCRE)
- End-to-end test uses dry-run mode to avoid actually spawning claude -p sessions
- Config changes to Claudeitor must preserve backward compatibility (all fields optional)
- .gitignore already updated in task 1 with .claudeitor/ entry

## Acceptance

- [ ] claudeitor.config.example.json includes telemetry config fields (enabled, path, rotationSizeMB)
- [ ] Config reader handles telemetry fields with sensible defaults
- [ ] SKILL.md error-fix template includes error context, file path, stack trace, and project conventions
- [ ] SKILL.md warning-fix template includes warning text, file path, and fix patterns
- [ ] Templates instruct Claude to make minimal targeted fixes and run verification
- [ ] .sentinelignore.example created with documented JavaScript RegExp patterns
- [ ] svelte-sentinel README.md with prerequisites, installation, CLI usage, and config
- [ ] End-to-end test script: start app, inject synthetic error, verify daemon detection in dry-run
- [ ] pnpm check passes with 0 errors in Claudeitor
- [ ] bun test passes with 0 failures in svelte-sentinel
- [ ] Both repos build successfully

## Done summary
Added telemetry config fields (enabled, path, rotationSizeMB) to Claudeitor config reader with backward-compatible defaults. In svelte-sentinel: refined SKILL.md error-fix and warning-fix templates with codebase context, CLAUDE.md references, and verification instructions; created .sentinelignore.example with documented RegExp patterns for known noisy warnings; added comprehensive README.md with prerequisites, CLI usage, all config options, and safety mechanisms; added 3 end-to-end integration tests verifying the full pipeline in dry-run mode (error detection, multi-issue detection, healthy record filtering). Both repos pass all checks: Claudeitor 0 errors / 97 tests, svelte-sentinel 0 errors / 183 tests.
## Evidence
- Commits: d659311e31f7aa6c66845ab5c2f8b6c936f45e77, 2fdd137135f10c989a1772e3d12eb9ca23169d1b
- Tests: pnpm check (0 errors), pnpm test (97 passed), bun run check (0 errors), bun test (183 passed, including 3 new e2e tests)
- PRs:
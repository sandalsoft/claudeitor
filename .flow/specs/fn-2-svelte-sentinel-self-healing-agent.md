# svelte-sentinel: Self-Healing Agent Daemon with OTel Instrumentation

## Overview

Two-part system: (1) OpenTelemetry instrumentation layer in Claudeitor replacing all ad-hoc console logging with structured OTel-inspired JSONL output, and (2) a standalone svelte-sentinel daemon (separate TypeScript/Bun repo) that tails the JSONL telemetry file, detects errors/warnings/performance anomalies, and autonomously fixes them by spawning `claude -p` headless sessions.

## Scope

### V1 (this epic):
- Structured logger replacing all console.warn/log/error in Claudeitor
- OTel TracerProvider with custom JSONL file exporter
- Manual spans on all page/layout load functions and the 14 library-level server operations (NOT API route handlers, NOT form actions — those are V2)
- svelte-sentinel daemon: JSONL tailer, error detection, `claude -p` orchestration
- Verification gate (pnpm check && pnpm test && pnpm build)
- Git fix branches with auto-merge
- Terminal formatted stream UI
- SKILL.md prompt templates
- Rate limiting

### V2+ (deferred):
- API route handler spans (SSE endpoint, settings API, etc.)
- SvelteKit form action spans
- Client-side Performance Observer + beacon endpoint
- LLM request/response tracing, SSE cycle tracing
- Web /agent page with status, fix history, effectiveness metrics
- Smart batching with stack trace analysis
- Percentile-based performance baselines
- Exportable web components from svelte-sentinel

## Architecture

Two repos:
- **Claudeitor** (this repo): `src/lib/server/telemetry/` for OTel code
- **svelte-sentinel** (new repo): Standalone Bun CLI daemon

Data flow: App emits OTel JSONL → `.claudeitor/telemetry.jsonl` → daemon tails → detects issues → spawns `claude -p` → verification gate → git merge

### JSONL record schema

Each line is a standalone JSON object with a `recordType` discriminator:

**Span record:**
```json
{"recordType":"span","traceId":"abc123","spanId":"def456","parentSpanId":"","name":"load:readout","startTime":1709312400000,"endTime":1709312400150,"status":{"code":0},"attributes":{"code.filepath":"src/routes/+page.server.ts","http.route":"/"},"events":[{"name":"exception","attributes":{"exception.type":"Error","exception.message":"parse failed","exception.stacktrace":"Error: parse failed\n    at ..."}}],"resource":{"service.name":"claudeitor","service.version":"0.2.0"}}
```

**Log record:**
```json
{"recordType":"log","timestamp":1709312400000,"severityNumber":13,"severityText":"WARN","body":"[model-mapping] No pricing data for model opus-5","attributes":{"module":"model-mapping"},"traceId":"abc123","spanId":"def456","resource":{"service.name":"claudeitor","service.version":"0.2.0"}}
```

This is "OTel-inspired" — flat per-line records (not OTLP JSON envelopes) for simplicity and efficient tailing. Span records include an `events` array to carry exception details (type, message, stacktrace) for daemon fix prompts. Both record types include `resource` for daemon correlation.

### Tracer initialization

Tracer is initialized in `src/lib/server/telemetry/init.ts` and imported at the top of `src/hooks.server.ts` (created if missing). This ensures deterministic initialization before any server load functions run. Uses `@opentelemetry/sdk-trace-node` with `AsyncLocalStorageContextManager` from `@opentelemetry/context-async-hooks` for proper context propagation across `await` boundaries.

### File write coordination

Both the span exporter and structured logger write to the same JSONL file. A centralized `FileWriter` module (`src/lib/server/telemetry/writer.ts`) serializes all appends behind an in-process queue and handles rotation checks on every write. This prevents interleaving and rotation races. File writing is disabled when `TELEMETRY_ENABLED=false` or `NODE_ENV=test` (logger still outputs to console in tests, just skips JSONL writes).

### ESM/CJS compatibility

Claudeitor is `"type": "module"` with adapter-node. OTel packages may have ESM/CJS issues when externalized by Vite SSR. If OTel named imports break, add OTel packages to `ssr.noExternal` in `vite.config.ts`. Acceptance requires `pnpm build && node build` smoke test (not just `pnpm check`).

## Quick commands

```bash
# Verify Claudeitor instrumentation
pnpm check && pnpm test && pnpm build

# Smoke test production build
pnpm build && node build

# Run svelte-sentinel (from svelte-sentinel repo)
bun run src/index.ts --project ../claudeitor --telemetry ../claudeitor/.claudeitor/telemetry.jsonl

# Verify both repos
cd claudeitor && pnpm check && pnpm test
```

## Key decisions

1. OTel-inspired flat JSONL format with `recordType` discriminator (not OTLP envelopes, not OTel Collector)
2. `@opentelemetry/sdk-trace-node` + `@opentelemetry/context-async-hooks` for AsyncLocalStorage context propagation
3. Manual spans via `tracer.startActiveSpan()` (no auto-instrumentation)
4. Custom JSONL SpanExporter with BatchSpanProcessor (maxExportBatchSize=512, scheduledDelayMillis=5000)
5. Span records include `events` array for exception details (type, message, stacktrace)
6. Bun runtime for daemon (fast startup, native TS)
7. One `claude -p` session per issue (isolated fixes)
8. Fix branches: `sentinel/<category>-<short-desc>`, fast-forward auto-merge
9. Verification gate: `pnpm check && pnpm test && pnpm build` (max 120s timeout)
10. Rate limiting: token bucket, max 5 fixes per 10 minutes. Retries count against bucket. Circuit breaker on 3 consecutive verification gate failures.
11. Tiered model selection: Sonnet 4.6 for single-file, Opus 4.6 for multi-file
12. Source location: spans include `code.filepath` (required); `code.lineno` best-effort. Logs include `code.filepath` only when explicitly provided.
13. Logger console output via `process.stdout.write`/`process.stderr.write` (not `console.*`). Stable format: `[SEVERITY] [module] message`
14. Centralized FileWriter with in-memory size tracking (not stat per write), serialized append + rotation
15. `service.version` read synchronously via `process.env.npm_package_version` with `readFileSync` fallback
16. `withSpan<T>` preserves sync/async return types (sync callers keep sync signatures)
17. OTel attribute keys hardcoded as strings (no `@opentelemetry/semantic-conventions` dependency)
18. OTel packages proactively added to `ssr.noExternal` in vite.config.ts
19. Log records include `resource` field for daemon correlation without span context
16. Tracer initialized in `src/hooks.server.ts` import for deterministic startup
17. File logging disabled under `NODE_ENV=test` (prevents test artifacts in `.claudeitor/`)
18. `.gitignore` updated with `.claudeitor/` in task 1 (not deferred to task 7)
19. V1 scope: load functions + 14 library operations only. API handlers and form actions are V2.

## Acceptance

- [ ] All console.warn/log/error in Claudeitor replaced with structured logger
- [ ] OTel spans on all 13 server load functions (12 pages + 1 layout) and 14 library-level operations
- [ ] JSONL telemetry file written with flat OTel-inspired schema (recordType discriminator)
- [ ] Span records include events array with exception details (type, message, stacktrace)
- [ ] svelte-sentinel daemon tails JSONL and detects errors
- [ ] Daemon spawns `claude -p` with error context extracted from span events/log attributes
- [ ] Verification gate passes before merge
- [ ] Fix branches created, auto-merged on success, reverted on failure
- [ ] Retry with context (up to 3 attempts) on verification failure; retries count against rate limiter
- [ ] Terminal formatted stream shows daemon activity
- [ ] SKILL.md with prompt templates for error and performance fixes
- [ ] Rate limiting prevents runaway fix loops; circuit breaker on 3 consecutive verification failures
- [ ] Nested spans maintain parent-child hierarchy across await boundaries (AsyncLocalStorage)
- [ ] File logging disabled under NODE_ENV=test; no .claudeitor/ test artifacts
- [ ] pnpm check && pnpm build && node build passes with 0 errors
- [ ] Existing Claudeitor tests (97) continue passing

## References

- [OTel JS Instrumentation](https://opentelemetry.io/docs/languages/js/instrumentation/)
- [OTel File Exporter Spec](https://opentelemetry.io/docs/specs/otel/protocol/file-exporter/)
- [SvelteKit Hooks](https://svelte.dev/docs/kit/hooks)
- [Bun Spawn](https://bun.com/docs/runtime/child-process)
- [Claude Code Headless](https://code.claude.com/docs/en/headless)
- [simple-git npm](https://www.npmjs.com/package/simple-git)

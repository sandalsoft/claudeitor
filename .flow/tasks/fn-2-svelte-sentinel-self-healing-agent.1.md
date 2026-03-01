## Description

Create the OTel telemetry foundation for Claudeitor: a TracerProvider with a custom JSONL file exporter, a structured logger with dual output, and a centralized file writer with rotation. This is the base layer that tasks 2 and 3 depend on.

**Size:** M
**Files:**
- `src/lib/server/telemetry/init.ts` — TracerProvider setup with `@opentelemetry/sdk-trace-node`, `AsyncLocalStorageContextManager` (must call `.enable()`), resource with `service.name='claudeitor'` and `service.version` from package.json. Guarded by `globalThis.__claudeitorTelemetry` to prevent duplicate init under HMR.
- `src/lib/server/telemetry/exporter.ts` — Custom `JSONLSpanExporter` implementing OTel `SpanExporter` interface (from `@opentelemetry/sdk-trace-base`), writes flat span records (including `events` array for exceptions) to JSONL via FileWriter
- `src/lib/server/telemetry/logger.ts` — Structured logger: `info()`, `warn()`, `error()`, `debug()` functions writing log records (including `resource` field) to JSONL via FileWriter + human-readable output via `process.stdout.write`/`process.stderr.write`. Stable console format: `[SEVERITY] [module] message`
- `src/lib/server/telemetry/writer.ts` — Centralized `FileWriter`: serialized append queue, tracks current file size in-memory (updated by `Buffer.byteLength` per append, `stat()` only on startup/rotation). Disabled when `NODE_ENV=test` or `process.env.VITEST` or `TELEMETRY_ENABLED=false`. Rotation ignores ENOENT during file shifts.
- `src/lib/server/telemetry/span-helpers.ts` — `withSpan<T>(name, attrs, fn: (span) => T): T` helper that preserves sync/async return types. Detects Promise returns internally, ends span in `.finally()` for async, synchronously for sync. On error: sets span status to ERROR(2), calls `span.recordException(err)`.
- `src/hooks.server.ts` — Import telemetry init at top for deterministic startup (create if missing, or add to existing with `sequence()`)
- `.gitignore` — Add `.claudeitor/` entry
- `vite.config.ts` — Proactively add OTel packages to `ssr.noExternal` to prevent ESM/CJS resolution failures

## Approach

- Use `@opentelemetry/sdk-trace-node` for Node.js context propagation
- Register `AsyncLocalStorageContextManager` from `@opentelemetry/context-async-hooks` — **must call `.enable()`** before passing to provider: `const cm = new AsyncLocalStorageContextManager().enable(); provider.register({ contextManager: cm })`
- Construct resource via `new Resource({ 'service.name': 'claudeitor', 'service.version': version })` — the stable API
- Read `service.version` synchronously: `process.env.npm_package_version ?? (() => { try { return JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).version } catch { return 'unknown' } })()`
- Add OTel packages to `dependencies` (NOT `devDependencies`) with exact pinned versions (no `^`): `@opentelemetry/api`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/context-async-hooks`, `@opentelemetry/resources`
- Hardcode attribute keys as strings (e.g., `'code.filepath'`) rather than importing from `@opentelemetry/semantic-conventions` — avoids export drift across versions
- Proactively add OTel packages to `ssr.noExternal` in vite.config.ts (high-likelihood failure without this)
- Guard init with `globalThis.__claudeitorTelemetry` flag to prevent duplicate TracerProvider under SvelteKit dev HMR
- BatchSpanProcessor (from `@opentelemetry/sdk-trace-base`) with `maxQueueSize=2048`, `maxExportBatchSize=512`, `scheduledDelayMillis=5000`
- JSONL schema: flat per-line records with `recordType` discriminator (`"span"` or `"log"`)
- Span records: `{ recordType, traceId, spanId, parentSpanId, name, startTime, endTime, status, attributes, events, resource }`
- Log records: `{ recordType, timestamp, severityNumber, severityText, body, attributes, traceId, spanId, resource }` — include `resource` for daemon correlation
- Span status semantics: UNSET(0) for normal, ERROR(2) for failures. OK(1) not used.
- `events` always present on spans (empty array if no exceptions)
- Logger severity mapping: info=9, warn=13, error=17, debug=5
- FileWriter: module-level singleton, tracks file size in-memory (`Buffer.byteLength` per append), only `stat()` on startup or after rotation. Writes newline-terminated JSON records.
- Rotation: rename current → `.1`, shift `.1`→`.2` etc, ignore ENOENT, keep max 3 old files (50MB threshold)
- Logger console output uses `process.stdout.write()` / `process.stderr.write()` — stable format: `[SEVERITY] [module] message`
- File logging disabled when `NODE_ENV=test` OR `process.env.VITEST` — logger still writes to stdout/stderr
- `withSpan<T>(name, attrs, fn): T` preserves return type: if fn returns Promise, end span in `.finally()`; if sync, end span synchronously. This lets sync functions like `mapModelId` keep their sync signature.

## Key context

- OTel packages needed (all `dependencies`, exact versions): `@opentelemetry/api`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/context-async-hooks`, `@opentelemetry/resources`
- Do NOT add `@opentelemetry/semantic-conventions` — hardcode attribute strings instead
- Claudeitor is `"type": "module"` with adapter-node — OTel packages must be in `ssr.noExternal`
- Smoke test: `timeout 10s node build` (adapter-node starts a server that doesn't exit; use timeout)
- `src/hooks.server.ts` may not exist yet — create if missing, compose via `sequence()` if present
- The centralized FileWriter prevents interleaving/rotation races between exporter and logger

## Acceptance

- [ ] TracerProvider initialized with `@opentelemetry/sdk-trace-node` and `service.name='claudeitor'` resource
- [ ] `AsyncLocalStorageContextManager` registered with `.enable()` called
- [ ] `service.version` from `process.env.npm_package_version` with `readFileSync` fallback (synchronous, not hardcoded)
- [ ] Resource constructed via `new Resource()` (stable API)
- [ ] OTel packages in `dependencies` with exact pinned versions: api, sdk-trace-node, sdk-trace-base, context-async-hooks, resources
- [ ] OTel packages added to `ssr.noExternal` in vite.config.ts
- [ ] Init guarded by `globalThis.__claudeitorTelemetry` for HMR idempotency
- [ ] Custom JSONL SpanExporter writes flat span records (recordType="span") including `events` array (always present)
- [ ] Span status: UNSET(0) for normal, ERROR(2) for failures
- [ ] BatchSpanProcessor configured with maxQueueSize=2048, maxExportBatchSize=512, scheduledDelayMillis=5000
- [ ] Structured logger exports info(), warn(), error(), debug() functions
- [ ] Logger writes dual output: `process.stdout.write`/`process.stderr.write` + JSONL log records
- [ ] Log records include `resource` field (service.name, service.version)
- [ ] Logger does NOT use `console.*` — stable format: `[SEVERITY] [module] message`
- [ ] Logger includes trace context (traceId, spanId) when inside active span
- [ ] `withSpan<T>` preserves sync/async return types (sync callers get sync return)
- [ ] Centralized FileWriter tracks size in-memory (not stat per write)
- [ ] File logging disabled under NODE_ENV=test or VITEST
- [ ] File rotation at 50MB threshold, keeps 3 old files, ignores ENOENT
- [ ] Tracer initialized via import in `src/hooks.server.ts`
- [ ] Nested spans maintain parent-child hierarchy across `await`
- [ ] `.claudeitor/` in .gitignore
- [ ] Attribute keys hardcoded as strings (no semantic-conventions import)
- [ ] pnpm check passes with 0 errors
- [ ] `pnpm build && timeout 10s node build` smoke test passes (or exits cleanly)
- [ ] Existing 97 tests continue passing (no JSONL file writes during tests)

## Done summary
Implemented OTel telemetry foundation: TracerProvider with NodeTracerProvider and AsyncLocalStorageContextManager, custom JSONLSpanExporter with flat span records, structured logger with dual output (stdout/stderr + JSONL), centralized FileWriter with serialized queue and 50MB rotation, and withSpan helper preserving sync/async return types. All OTel packages pinned exact in dependencies and added to ssr.noExternal.
## Evidence
- Commits: 1dd212651a023829015bc55ad471ce89444e87a9
- Tests: pnpm check, pnpm test, pnpm build && timeout 10 node build
- PRs:
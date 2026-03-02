## Description

Scaffold the svelte-sentinel standalone daemon as a new Bun/TypeScript project. This is the core detection layer: a JSONL file tailer that reads OTel-inspired telemetry records, parses them using the `recordType` discriminator, classifies issues by severity, and emits structured events for the fix orchestrator (task 5).

**Size:** M
**Files (new repo):**
- `package.json` — Bun project with `simple-git`, `commander` CLI deps
- `tsconfig.json` — Strict mode, Bun types, ESM
- `src/index.ts` — CLI entrypoint with commander: `--project`, `--telemetry`, `--dry-run` flags
- `src/tailer.ts` — JSONL file tailer: `Bun.file()` + polling, handles partial lines, rotation detection
- `src/parser.ts` — Record parser: validates `recordType` discriminator, extracts span/log fields from flat schema
- `src/detector.ts` — Issue classifier: error spans (status.code=2), warn logs (severityNumber>=13), categorizes by type. Extracts error context from span `events` array (exception.type/message/stacktrace).
- `src/types.ts` — Shared types: `SpanRecord`, `LogRecord`, `TelemetryRecord`, `DetectedIssue`, `IssueCategory`, `DaemonConfig`
- `src/config.ts` — Config loader: CLI flags → defaults merge, `.sentinelrc.json` support. Claude CLI flags configurable (model, max-turns, allowedTools).
- `tests/` — Unit tests for parser, detector, tailer (with fixture JSONL files matching the flat schema)

## Approach

- Use `commander` for CLI argument parsing (standard, well-known)
- JSONL tailer reads from end of file, tracks byte offset, polls every 1s
- On file rotation (file size decreases), re-open from beginning
- Partial line buffer: accumulate bytes until `\n`, then parse
- Parser validates each line as JSON, checks `recordType` field:
  - `"span"`: validate traceId, spanId, name, status fields. Extract exception details from `events` array if present.
  - `"log"`: validate timestamp, severityNumber, body fields
  - Unknown recordType: skip with warning
- Detector classifies: `error` (span status.code=2 or severityNumber>=17), `warning` (severityNumber>=13)
- Detector extracts actionable context: `exception.message`, `exception.stacktrace`, `code.filepath` from span attributes/events
- Deduplication: same error signature within 10s window → single issue (signature = spanName + error.type + code.filepath)
- Emit `DetectedIssue` events via EventEmitter pattern for downstream consumption
- `--dry-run` mode: detect and log but don't emit for fixing
- Config includes claude CLI settings (model IDs, max-turns, allowedTools) as configurable fields with defaults

## Key context

- This is a SEPARATE repo from Claudeitor — scaffold from scratch
- Bun runtime: use `Bun.file()` for fast file I/O, `Bun.sleep()` for poll interval
- JSONL schema uses flat per-line records with `recordType` discriminator (NOT OTLP JSON envelopes)
- Span records include `events` array — detector must parse exception events for fix prompt context
- Span status: UNSET(0) = normal, ERROR(2) = failure. OK(1) not used.
- The tailer must handle the case where telemetry file doesn't exist yet (wait and retry)
- Error deduplication prevents the same parse error from spawning 100 fix attempts
- Claude CLI flags should be configurable via daemon config, not hardcoded (CLI compatibility varies)

## Acceptance

- [ ] New Bun/TypeScript project scaffolded with package.json and tsconfig.json (strict mode)
- [ ] CLI entrypoint accepts --project, --telemetry, --dry-run flags via commander
- [ ] JSONL tailer reads from file end, tracks byte offset, polls at configurable interval
- [ ] Tailer handles partial lines (buffered until newline)
- [ ] Tailer detects file rotation (size decrease) and re-opens
- [ ] Tailer waits gracefully when telemetry file doesn't exist yet
- [ ] Parser validates recordType discriminator ("span" vs "log")
- [ ] Parser validates required fields per record type (span: traceId, spanId, name, status; log: timestamp, severityNumber, body)
- [ ] Parser extracts exception details from span events array
- [ ] Parser skips malformed lines and unknown recordTypes with warning log (doesn't crash)
- [ ] Detector classifies issues: error (status.code=2 or severity>=17), warning (severity>=13)
- [ ] Detector extracts actionable context (exception.message, stacktrace, code.filepath) for fix prompts
- [ ] Deduplication: same error signature within 10s window emits single issue
- [ ] --dry-run mode logs detections without emitting for fix orchestration
- [ ] Claude CLI flags configurable via config (not hardcoded)
- [ ] Unit tests cover parser (valid/invalid JSONL, both record types, exception events), detector (classification), tailer (rotation)
- [ ] bun test passes with 0 failures
- [ ] bun check (tsc --noEmit) passes with 0 errors

## Done summary
Scaffolded svelte-sentinel as a standalone Bun/TypeScript project with CLI entrypoint (commander), JSONL file tailer (polling, partial-line buffering, rotation detection), record parser (recordType discriminator validation, exception extraction from span events), issue detector (error/warning classification, dedup within 10s window), and config loader (.sentinelrc.json + CLI flags merge). All 66 unit tests pass, TypeScript strict mode check clean.
## Evidence
- Commits: 8a42b22a98836a92279adcd68dbcc39ef0992db0
- Tests: bun test (66 pass, 0 fail), bun run check (tsc --noEmit, 0 errors)
- PRs:
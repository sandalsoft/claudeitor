# fn-3-live-session-flight-deck.1 Incremental JSONL tailer with token and tool call extraction

## Description
Build a server-side incremental JSONL tailer that reads active session files efficiently by tracking byte offsets. On each invocation, read only new bytes appended since last call. Maintain **cumulative** state per session: total token counts, recent tool calls (correlated via tool_use_id), and recent file mutations. The tailer is a **module-scoped singleton** created via factory function — it must persist across HTTP requests within a server process.

**Size:** M
**Files:**
- `src/lib/server/claude/session-tailer.ts` (NEW)
- `src/lib/data/types.ts` (add new interfaces)
- `src/lib/server/claude/session-tailer.test.ts` (NEW)

## Approach

- Follow the streaming JSONL parser pattern at `src/lib/server/claude/session-detail.ts` but adapt for incremental reads using `fs.open()` with byte offset positioning via `read(buffer, 0, length, position)`
- Use `findSessionFile(sessionId, claudeDir)` from `src/lib/server/claude/session-detail.ts` to locate JSONL files — do NOT invent path derivation. Session files live at `~/.claude/projects/<encoded-path>/<sessionId>.jsonl` (the `encodeProjectPath()` function handles encoding)
- The factory `createSessionTailer()` returns a tailer object. A **module-level singleton** is exported (created via the factory) — this is the correct pattern here because the tailer MUST persist state across poll requests. Document this clearly in a comment
- Per-session state in an internal `Map<sessionId, SessionTailState>` where `SessionTailState` holds: `byteOffset`, `lastPolledAt`, cumulative `tokens` (input/output/cacheRead/cacheWrite), last N `toolCalls`, last N `filesMutated`, `model`, `messageCount`, and a `pendingToolCalls` map for correlation
- **Token counts are cumulative**: each `tail()` call reads new lines, extracts token deltas from `usage` objects, and adds them to the running totals in state
- **Tool call correlation**: Track `tool_use` blocks by their `id` in `pendingToolCalls`. When a matching `tool_result` arrives (same `tool_use_id`), resolve the status (success if `is_error` is falsy, error otherwise). Unresolved calls show status `"pending"`
- **File mutation extraction**: Look for tool_use blocks with names matching known file-touching tools. Match **case-insensitively** and handle variants: `Edit`, `MultiEdit`, `Write`, `Read`, `NotebookEdit`. Extract file paths from input keys: `file_path`, `path`, `filePath`, `notebook_path`. For `Bash` tool, do NOT attempt file extraction (too unreliable). Default operation to `"other"` for unknown tool types
- **Cap collections**: Keep last 50 tool calls and last 30 file mutations in state to prevent memory growth
- **Eviction**: Sessions not polled for 5 minutes are evicted from state (checked on each `tail()` call)
- Handle edge cases: file truncated/rotated (byteOffset > file size → reset to 0 and clear cumulative state), partial line at end of file (buffer trailing incomplete line for next read), empty reads (no new data)
- Use `warn()` from `src/lib/server/telemetry/logger.ts` for malformed JSON lines (skip without throwing)

## Key context

- Session JSONL files live at `~/.claude/projects/<encoded-path>/<sessionId>.jsonl` — use `findSessionFile()` to locate them
- Token fields in JSONL: `usage.input_tokens`, `usage.output_tokens`, `usage.cache_read_input_tokens`, `usage.cache_creation_input_tokens` in assistant response blocks
- Tool calls appear as `content` array items with `type: "tool_use"` (invocation, has `id` and `name`) and `type: "tool_result"` (result, has `tool_use_id` and optional `is_error`)
- The `session-detail.ts` parser already handles these structures — study its `extractToolCalls()` and token extraction patterns
## Approach

- Follow the streaming JSONL parser pattern at `src/lib/server/claude/session-detail.ts:112-307` but adapt for incremental reads using `fs.open()` with byte offset positioning via `read(buffer, 0, length, position)`
- Store per-session state in a `Map<sessionId, { byteOffset: number, lastModified: number }>` — use a factory function (NOT module-level mutable default per MEMORY.md pitfalls)
- Each JSONL line contains a JSON object with `type` field — look for `assistant` messages with `content` arrays containing `tool_use`/`tool_result` blocks, and `usage` objects with token counts
- Reuse `SessionMessage` shape from `src/lib/server/claude/session-detail.ts` for message parsing; derive new `LiveSessionTelemetry` interface for the aggregated output
- Handle edge cases: file truncated/rotated (byteOffset > file size → reset to 0), partial line at end of file (buffer trailing incomplete line for next read), empty reads (no new data)
- Export `createSessionTailer()` factory that returns `{ tail(sessionId, filePath): Promise<LiveSessionTelemetry>, reset(sessionId): void, resetAll(): void }`

## Key context

- Session JSONL files live at `~/.claude/projects/<project-hash>/sessions/<session-id>.jsonl`
- The `detectActiveSessions()` function in `active-sessions.ts` returns `sessionId` and `project` fields that can be used to locate the JSONL file
- Token fields in JSONL: look for `usage.input_tokens`, `usage.output_tokens`, `usage.cache_read_input_tokens`, `usage.cache_creation_input_tokens` in assistant message blocks
- Tool calls appear as `content` array items with `type: "tool_use"` (invocation) and `type: "tool_result"` (result with `is_error` boolean)
- File mutations: extract from tool_use blocks where `name` is "Read", "Edit", "Write", or "Bash" — the `input` object contains file paths
## Acceptance
- [ ] `createSessionTailer()` factory returns tailer instance with `tail()`, `reset()`, `resetAll()` methods
- [ ] A module-level singleton tailer is exported for use by the `/live` server load function
- [ ] `tail()` reads only bytes after stored offset (verified by test with mock JSONL file that grows between calls)
- [ ] Returns `LiveSessionTelemetry` with **cumulative** tokens: `{ input, output, cacheRead, cacheWrite }`, plus `recentToolCalls` (last 50), `recentFiles` (last 30), `messageCount`, `model`
- [ ] Tool calls correlated via `id`/`tool_use_id` — status is `"success"`, `"error"`, or `"pending"` (unresolved)
- [ ] File mutations extracted case-insensitively from Edit, MultiEdit, Write, Read, NotebookEdit tool_use blocks; Bash excluded
- [ ] Handles file truncation gracefully (offset > fileSize → reset offset and cumulative state)
- [ ] Handles partial lines at file end (no crash, buffers for next read)
- [ ] Sessions not polled for 5 minutes are evicted from state
- [ ] New types exported from `src/lib/data/types.ts`: `LiveSessionTelemetry`, `LiveToolCall`, `LiveFileMutation`
- [ ] Malformed JSON lines logged via `warn()` from telemetry logger, skipped without throwing
- [ ] Unit tests cover: first read (full parse), incremental read (only new data), cumulative token accounting, file truncation reset, empty read (no new data), malformed JSON lines, tool call correlation, session eviction
- [ ] `pnpm check` passes
- [ ] `pnpm test` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

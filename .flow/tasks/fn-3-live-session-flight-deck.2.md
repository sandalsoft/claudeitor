# fn-3-live-session-flight-deck.2 Flight deck server load with enriched session data

## Description
Rewrite the `/live` route server load function to return enriched session data suitable for the flight deck. For each active session detected, use the singleton tailer to get cumulative token counts, tool calls, and file activity, then compute rolling cost estimates using the per-million token pricing formula from existing cost infrastructure.

**Size:** M
**Files:**
- `src/routes/live/+page.server.ts` (MODIFY)
- `src/lib/server/claude/active-sessions.ts` (minor: ensure sessionId field is populated)

## Approach

- Enhance the existing `load` function at `src/routes/live/+page.server.ts` — keep the parallel loading pattern but replace/extend the data returned
- Import the **singleton tailer** from `src/lib/server/claude/session-tailer.ts` — call `tailer.tail(sessionId, claudeDir)` for each active session
- Use `findSessionFile(sessionId, claudeDir)` from `session-detail.ts` to locate each session's JSONL file
- **Cost calculation**: There is no standalone `calculateTokenCost()` function. Implement the cost formula inline or as a small local helper: `(tokens / 1_000_000) * ratePerMillion` for each token type (input, output, cacheRead, cacheWrite). Read pricing rates from `readPricing()` → `pricing.models[modelKey]`
- Map model IDs to display names using `mapModelId()` from `src/lib/server/claude/model-mapping.ts`
- Return `EnrichedActiveSession` objects that extend `ActiveSession` with telemetry data, cost, and mapped model name
- **Route-specific polling interval**: Return `liveRefreshInterval: 10_000` as a separate field from the global `config.refreshInterval`. The client should use `data.liveRefreshInterval` for its polling loop. This avoids changing the global 30s default
- Wrap with `withSpan()` for telemetry (follow pattern at `src/routes/sessions/[id]/+page.server.ts:15-39`)
- Handle sessions where JSONL file cannot be located: return the session with `telemetry: null` and `cost: 0`

## Key context

- The `detectActiveSessions()` function parses `ps` output and returns `ActiveSession` objects with `pid`, `cpuPercent`, `memPercent`, `command`, `project`, `sessionId`
- Use `findSessionFile()` to locate JSONL — it handles `encodeProjectPath()` internally
- Pricing data: `readPricing()` from `src/lib/server/claude/costs.ts` reads `~/.claude/readout-pricing.json`
- The existing load function at `src/routes/live/+page.server.ts` uses TTL caching for activity events — preserve or adapt this pattern
- Pricing rates are per-million tokens: `pricing.models[key].inputPerMillion`, `outputPerMillion`, `cacheReadPerMillion`, `cacheWritePerMillion`
## Approach

- Enhance the existing `load` function at `src/routes/live/+page.server.ts` — keep the parallel loading pattern but replace/extend the data returned
- For each active session from `detectActiveSessions()`, call `tailer.tail(sessionId, filePath)` to get `LiveSessionTelemetry`
- Compute cost using `calculateTokenCost()` from `src/lib/server/claude/cost-calculator.ts:34-53` with pricing from `readPricing()`
- Map model IDs to display names using `mapModelId()` from `src/lib/server/claude/model-mapping.ts`
- Return `EnrichedActiveSession` objects that extend `ActiveSession` with telemetry data, cost, and mapped model name
- Reduce default refresh interval to 10_000 (10s) — keep it configurable via `config.refreshInterval`
- Wrap with `withSpan()` for telemetry (follow pattern at `src/routes/sessions/[id]/+page.server.ts:15-39`)
- Session JSONL path construction: `path.join(claudeDir, 'projects', projectHash, 'sessions', sessionId + '.jsonl')` — need to discover the project hash from the session's working directory

## Key context

- The `detectActiveSessions()` function parses `ps` output and returns `ActiveSession` objects with `pid`, `cpuPercent`, `memPercent`, `command`, `project`, `sessionId`
- The `project` field is the working directory path; the project hash used in `~/.claude/projects/` is derived from this path
- Pricing data: `readPricing()` from `src/lib/server/claude/costs.ts` reads `~/.claude/readout-pricing.json`
- The existing load function at `src/routes/live/+page.server.ts` uses TTL caching for activity events — preserve or adapt this pattern
## Acceptance
- [ ] Load function returns `EnrichedActiveSession[]` with telemetry, cost, and display model name for each active session
- [ ] Each enriched session includes: all `ActiveSession` fields + `telemetry: LiveSessionTelemetry | null` + `cost: number` + `displayModel: string` + `durationMs: number`
- [ ] Cost calculated using per-million token pricing formula with rates from `readPricing()`
- [ ] Model names mapped via `mapModelId()` for human-readable display
- [ ] Route returns `liveRefreshInterval: 10_000` separate from global `refreshInterval` (global default unchanged)
- [ ] Uses singleton tailer from `session-tailer.ts` (not creating new instances per request)
- [ ] Uses `findSessionFile()` from `session-detail.ts` to locate JSONL files
- [ ] Handles zero active sessions gracefully (returns empty array)
- [ ] Handles sessions where JSONL file cannot be located (returns session with null telemetry)
- [ ] Instrumented with `withSpan()` telemetry
- [ ] `pnpm check` passes
## Done summary
Rewrote the /live server load function to enrich each active session with telemetry from the singleton sessionTailer, compute rolling cost via per-million token pricing from readPricing(), map model IDs to display names, and return a route-specific 10s polling interval. Added EnrichedActiveSession type to shared types.
## Evidence
- Commits: 737a686158582021526780556736bcc6da5d2d66
- Tests: pnpm check, pnpm test
- PRs:
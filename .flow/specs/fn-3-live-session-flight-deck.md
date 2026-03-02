# Live Session Flight Deck

## Overview

Transform the existing `/live` route from a basic active-sessions list into a real-time flight deck that shows active Claude Code sessions as they happen: live token counters, file activity tracking, tool call feeds, rolling cost estimates, and token burn rate charts. Think airport flight tracker for your AI coding copilot.

**Why**: Claudeitor is currently a rearview mirror — you see what happened *after* sessions end. The flight deck makes it a windshield. Users watching token counts climb in real-time naturally write tighter prompts, catch runaway sessions, and feel in control of spend.

**Who's affected**:
- **End users**: New real-time UI on `/live` replacing the basic active session cards
- **Developers**: New server-side JSONL tailing infrastructure, expanded types
- **Operations**: Faster polling interval (10s default for `/live` route only), incremental file reads

## Scope

### In scope
- Enhanced `/live` route with real-time session telemetry
- Per-session flight cards: model, duration timer, live token counter (input/output/cache), rolling cost estimate
- Live file activity feed: files being Read/Edited/Written with recency indicators
- Tool call feed: streaming list of tool invocations with success/error status (correlated via tool_use_id)
- Token burn rate chart (D3.js): tokens/minute over session lifetime
- Multi-session support with prioritized display (highest activity first)
- Incremental JSONL tailing with byte offset tracking for performance
- Graceful handling: no active sessions, session starts/ends during view, corrupted JSONL

### Out of scope
- SSE-based real-time updates (evaluate in future iteration — current architecture uses polling for `/live`)
- Kill switch / session termination controls
- Session budget caps / alerts
- Projected final cost (requires historical session length data)
- Changing the global default `refreshInterval` (only `/live` route overrides to 10s)

## Approach

Enhance the existing `/live` route infrastructure (`src/routes/live/+page.svelte`, `src/routes/live/+page.server.ts`). Reuse:
- `detectActiveSessions()` from `src/lib/server/claude/active-sessions.ts` for session discovery
- `findSessionFile()` from `src/lib/server/claude/session-detail.ts` for locating session JSONL files (uses `encodeProjectPath()` — do NOT invent a path derivation scheme)
- Cost calculation via per-token pricing math from `src/lib/server/claude/cost-calculator.ts` (note: there is no standalone `calculateTokenCost()` — the token-to-cost formula is `tokens / 1_000_000 * ratePerMillion`)
- Model mapping from `src/lib/server/claude/model-mapping.ts`
- D3 chart patterns from `src/lib/components/charts/ActivityChart.svelte` (uses `import * as d3`)
- Chart helpers from `src/lib/utils/chart-helpers.ts`
- Polling pattern already in `/live` route (recursive setTimeout + invalidateAll)
- Badge, Icon components from existing UI library
- `warn()` logger from `src/lib/server/telemetry/logger.ts` for malformed data warnings

**Polling strategy**: The `/live` server load function returns a route-specific `liveRefreshInterval: 10_000` separate from the global `config.refreshInterval`. The client uses this for its polling loop. This avoids changing the global default (30s) which affects other pages.

**JSONL tailing**: New server-side utility that tracks byte offsets and cumulative token totals per session. The tailer is a **module-scoped singleton** created via `createSessionTailer()` factory — persists across requests within a server process. On each poll, reads only new bytes appended since last read. Maintains cumulative state (token totals, recent tool calls, recent file mutations). Inactive sessions are evicted after 5 minutes of no polls.

**Session file location**: Use `findSessionFile(sessionId, claudeDir)` from `session-detail.ts` — this handles the `encodeProjectPath()` encoding. Session JSONL files live directly under `~/.claude/projects/<encoded-path>/` (NOT in a `sessions/` subdirectory).

**Tool call correlation**: Tool calls are correlated by matching `tool_result` blocks to their originating `tool_use` via the shared `id` field. In-progress calls (tool_use seen but no matching tool_result yet) show a "pending" status.

**Data flow**: Poll → detectActiveSessions → for each active session, locate JSONL via findSessionFile → tail new bytes → update cumulative state → calculate rolling cost → return enriched session objects → render flight cards + charts.

## Quick commands

```bash
# Dev server
pnpm dev

# Type check
pnpm check

# Run tests
pnpm test

# Smoke test: verify /live loads with active session data
curl -s http://127.0.0.1:5173/live | grep -o 'flight-deck\|session-card\|token-counter'
```

## Acceptance

- [ ] `/live` route shows enriched flight cards for each active Claude Code session
- [ ] Each flight card displays: model name, session duration timer, cumulative token counts (input/output/cache read/write), rolling cost estimate
- [ ] File activity feed shows files touched during session with recency indicators
- [ ] Tool call feed shows recent tool invocations with correlated success/error/pending status
- [ ] D3.js burn rate chart shows tokens/minute over session lifetime
- [ ] `/live` route polls at 10s intervals (route-specific, global default unchanged)
- [ ] Incremental JSONL tailing avoids re-parsing entire files on each poll
- [ ] Tailer is a module-scoped singleton that persists across requests
- [ ] Graceful empty state when no sessions are active
- [ ] Handles session start/end during active viewing without errors
- [ ] All new code type-checks with `pnpm check`
- [ ] Tests pass: `pnpm test`

## Architecture

```mermaid
graph TD
    A[/live +page.svelte] -->|poll every 10s| B[/live +page.server.ts]
    B --> C[detectActiveSessions]
    B --> D[sessionTailer singleton]
    D --> E[byte offset tracker]
    D --> F[cumulative token state]
    D --> G[tool call correlator]
    D --> H[file mutation tracker]
    B --> I[token cost calculation]
    I --> J[pricing data]
    I --> K[model mapping]
    B -->|enriched sessions| A
    A --> L[FlightCard component]
    A --> M[BurnRateChart D3]
    A --> N[ToolCallFeed]
    A --> O[FileActivityFeed]
```

## References

- Feature spec: `FEATURES.md` lines 19-37
- Existing /live route: `src/routes/live/+page.svelte`, `src/routes/live/+page.server.ts`
- Active session detection: `src/lib/server/claude/active-sessions.ts`
- Session file locator: `src/lib/server/claude/session-detail.ts` → `findSessionFile()`, `encodeProjectPath()`
- Session JSONL parser: `src/lib/server/claude/session-detail.ts` → `readSessionDetail()`
- Cost calculator: `src/lib/server/claude/cost-calculator.ts` → `tokenCost()` (internal), pricing per-million formula
- Model mapping: `src/lib/server/claude/model-mapping.ts`
- D3 chart pattern: `src/lib/components/charts/ActivityChart.svelte` (uses `import * as d3`)
- Chart helpers: `src/lib/utils/chart-helpers.ts`
- Chokidar watcher: `src/lib/server/watcher.ts`
- Structured logger: `src/lib/server/telemetry/logger.ts` → `warn()`

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large JSONL files (50MB+) cause slow tailing | Byte offset tracking; cap extracted data per poll |
| Rapid session churn missed by 10s polling | Detect sessions by process table, not file appearance |
| Multiple active sessions overwhelm UI | Sort by activity, show top 5 with "N more" collapse |
| D3 chart memory leak on long sessions | Fixed-size rolling window (last 30 data points) |
| Session JSONL format changes | Graceful fallback: show what we can parse, warn on unknown |
| Tailer memory growth from abandoned sessions | Evict sessions not polled for 5 minutes |
| Tool call status inaccuracy | Correlate via tool_use_id; show "pending" for uncorrelated calls |

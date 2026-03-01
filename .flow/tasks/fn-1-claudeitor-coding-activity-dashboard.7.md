# fn-1-claudeitor-coding-activity-dashboard.7 Build SSE endpoint with chokidar file watching

## Description
Build the Server-Sent Events endpoint that pushes real-time data updates to the Readout page. A chokidar file watcher (singleton) monitors ~/.claude/ for changes and emits SSE events when cache files are updated. The endpoint streams typed events that the client subscribes to.

**Size:** M
**Files:** src/routes/api/sse/+server.ts, src/lib/data/watcher.ts, src/lib/stores/realtime.svelte.ts

## Approach
- Use sveltekit-sse library for SSE endpoint (handles connection lifecycle)
- **Singleton watcher pattern** (from code review):
  - Module-level singleton guarded on globalThis to prevent duplicate watchers during HMR/multi-tab
  - Reference-count SSE connections: increment on connect, decrement on disconnect
  - Only create watcher when first connection arrives, destroy when last disconnects (or keep alive with idle timeout)
  - Pattern: `globalThis.__claudeitorWatcher ??= createWatcher()`
- Chokidar watches ~/.claude/: stats-cache.json, readout-cost-cache.json, history.jsonl
- Use awaitWriteFinish option to prevent reading partial writes
- On file change: re-read the changed file using data readers from task 2, emit typed SSE event
- Client store (realtime.svelte.ts): connect to SSE endpoint, update $state on received events
- SSE event types: stats-update, cost-update, session-update
- Handle SSE reconnection with exponential backoff
- Clean up watcher on server shutdown

## Key context
- sveltekit-sse provides produce() function for SvelteKit SSE endpoints
- Chokidar awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
- CRITICAL: Use globalThis singleton to avoid duplicate watchers on HMR reload or multi-tab
- Opening 3 browser tabs must NOT create 3 separate watchers
- Client store should use Svelte 5 runes ($state) for reactive updates
## Approach
- Use sveltekit-sse library for SSE endpoint (handles connection lifecycle)
- Chokidar file watcher on ~/.claude/ watching: stats-cache.json, readout-cost-cache.json, history.jsonl
- Use awaitWriteFinish option to prevent reading partial writes
- On file change: re-read the changed file using data readers from task 2, emit typed SSE event
- Client store (realtime.svelte.ts): connect to SSE endpoint, update $state on received events
- SSE event types: stats-update (dailyActivity, modelUsage), cost-update (cost totals), session-update (new sessions)
- Handle SSE reconnection with exponential backoff
- Clean up watcher on server shutdown

## Key context
- sveltekit-sse provides produce() function for SvelteKit SSE endpoints
- Chokidar awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
- Multiple browser tabs: each gets its own SSE connection (shared watcher server-side)
- Client store should use Svelte 5 runes ($state) for reactive updates
## Acceptance
- [ ] SSE endpoint at /api/sse streams events to connected clients
- [ ] Chokidar watches ~/.claude/stats-cache.json, readout-cost-cache.json, history.jsonl
- [ ] File changes trigger re-read and SSE event emission
- [ ] awaitWriteFinish prevents partial JSON reads
- [ ] Watcher is a globalThis singleton (no duplicates on HMR)
- [ ] Opening 3 tabs does NOT create 3 watchers (singleton verified)
- [ ] Client store connects to SSE and updates reactive state
- [ ] SSE reconnects with exponential backoff on disconnect
- [ ] Typed events: stats-update, cost-update, session-update
- [ ] Watcher cleans up on server shutdown (no orphaned watchers)
## Done summary
Built complete SSE real-time data streaming infrastructure: singleton chokidar file watcher (globalThis pattern, per-file generation counter for stale-read protection, idle timeout lifecycle), SSE endpoint using sveltekit-sse produce() with GET/POST support, and Svelte 5 reactive client store with exponential backoff reconnection and monotonic sequence ordering guards.
## Evidence
- Commits: c02e82ad642094ae648518d568c5ce1b2867dfde
- Tests: npx tsc --noEmit, npx vitest run
- PRs:
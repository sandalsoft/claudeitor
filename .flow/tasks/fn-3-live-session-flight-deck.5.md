# fn-3-live-session-flight-deck.5 Assemble flight deck page with polling and empty states

## Description
Assemble all flight deck components into the `/live` route page. Replace the existing basic session list with the full flight deck layout. Wire up the polling loop using the route-specific `liveRefreshInterval` (10s), handle empty states, manage token history accumulation for burn rate charts, and ensure smooth transitions when sessions start/end.

**Size:** M
**Files:**
- `src/routes/live/+page.svelte` (REWRITE)
- `src/routes/live/+page.server.ts` (minor polish if needed)

## Approach

- Rewrite the existing `/live` page component at `src/routes/live/+page.svelte` to use the new flight deck components
- Keep the existing polling pattern (recursive `setTimeout` + `invalidateAll()`) but use `data.liveRefreshInterval` (10s, route-specific) instead of `data.refreshInterval` (global 30s). Fallback to `10_000` if undefined
- Layout: Header with "Live Flight Deck" title + session count badge → Grid of `FlightCard` components (1-col on mobile, 2-col on desktop) → Expanded view for selected session showing `BurnRateChart`, `ToolCallFeed`, `FileActivityFeed`
- Maintain per-session token history in a `$state` Map for burn rate chart data: on each poll, calculate tokens-per-minute delta from cumulative token totals and append to the session's history array (capped at 30 points)
- Empty state: When no active sessions, show a centered illustration with "No active Claude sessions" message and a hint to start one (follow empty state pattern at `src/routes/sessions/[id]/+page.svelte:113-120`)
- Session lifecycle: When a session disappears between polls (ended), fade it out with a "Session ended" badge. When a new session appears, fade it in
- Selected session: Click a `FlightCard` to expand and show the detail feeds (burn rate, tool calls, files). Use a `$state` selectedSessionId. Default to first session if only one active
- Sort sessions by total token count descending (most active first)

## Key context

- The existing polling pattern at `src/routes/live/+page.svelte` uses `$effect()` with `invalidateAll()` — this triggers the server `load` function to re-run, which SvelteKit merges into `data`
- Svelte 5 transition directives: use `transition:fade` or `in:fly` for session appear/disappear animations
- Use `data.liveRefreshInterval` (route-specific 10s) NOT `data.refreshInterval` (global 30s) for the polling interval
## Approach

- Rewrite the existing `/live` page component at `src/routes/live/+page.svelte` to use the new flight deck components
- Keep the existing polling pattern (recursive `setTimeout` + `invalidateAll()`) but with 10s default interval from server data
- Layout: Header with "Live Flight Deck" title + session count badge → Grid of `FlightCard` components (1-col on mobile, 2-col on desktop) → Expanded view for selected session showing `BurnRateChart`, `ToolCallFeed`, `FileActivityFeed`
- Maintain per-session token history in a `$state` Map for burn rate chart data: on each poll, calculate tokens-per-minute delta and append to the session's history array (capped at 30 points)
- Empty state: When no active sessions, show a centered illustration with "No active Claude sessions" message and a hint to start one (follow empty state pattern at `src/routes/sessions/[id]/+page.svelte:113-120`)
- Session lifecycle: When a session disappears between polls (ended), fade it out with a "Session ended" badge. When a new session appears, fade it in
- Selected session: Click a `FlightCard` to expand and show the detail feeds (burn rate, tool calls, files). Use a `$state` selectedSessionId. Default to first session if only one active
- Sort sessions by total token count descending (most active first)

## Key context

- The existing polling pattern at `src/routes/live/+page.svelte` uses `$effect()` with `invalidateAll()` — this triggers the server `load` function to re-run, which SvelteKit merges into `data`
- Svelte 5 transition directives: use `transition:fade` or `in:fly` for session appear/disappear animations
- The `data.refreshInterval` from server controls poll speed (now 10_000ms default)
## Acceptance
- [ ] `/live` route renders flight deck with `FlightCard` for each active session
- [ ] Polling runs at 10-second intervals using `data.liveRefreshInterval` (route-specific, global default unchanged)
- [ ] Empty state shown when no sessions active (icon + message + hint)
- [ ] Per-session token history maintained in client state for burn rate chart (30-point rolling window)
- [ ] Clicking a FlightCard expands it to show BurnRateChart, ToolCallFeed, FileActivityFeed
- [ ] Sessions sorted by activity (total tokens descending)
- [ ] Session end handled gracefully (fade out with "ended" indicator)
- [ ] New session appearance handled (fade in)
- [ ] Responsive layout: 1-col mobile, 2-col desktop for flight cards
- [ ] All Svelte 5 runes, Tailwind v4 tokens, no legacy patterns
- [ ] `pnpm check` passes
- [ ] `pnpm test` passes
- [ ] Manual smoke test: with an active Claude session, `/live` shows real-time data updating every 10s
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

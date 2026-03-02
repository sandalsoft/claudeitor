# fn-3-live-session-flight-deck.4 D3 burn rate chart and activity feed components

## Description
Build the D3.js token burn rate chart and the tool call / file activity feed components. The burn rate chart shows tokens-per-minute over the session lifetime as a line chart with a rolling 30-point window. The feeds show recent tool invocations (with correlated status) and file mutations.

**Size:** M
**Files:**
- `src/lib/components/live/BurnRateChart.svelte` (NEW)
- `src/lib/components/live/ToolCallFeed.svelte` (NEW)
- `src/lib/components/live/FileActivityFeed.svelte` (NEW)

## Approach

- **BurnRateChart**: Follow the D3 pattern at `src/lib/components/charts/ActivityChart.svelte` — use `bind:this` for container, `$effect()` for D3 rendering, responsive sizing via `computeDimensions()` from `src/lib/utils/chart-helpers.ts`. Use `import * as d3` consistent with existing chart patterns in this repo
- Chart data: Accept `tokenHistory: Array<{ timestamp: number, tokensPerMinute: number }>` — render as a line chart with time on x-axis, tokens/min on y-axis
- Use a fixed 30-point rolling window to prevent memory growth on long sessions
- D3 scales: `d3.scaleTime()` for x, `d3.scaleLinear()` for y. Use `CHART_COLORS` from chart-helpers for line color
- On each data update, transition the line path smoothly (D3 `transition().duration(300)`)
- **ToolCallFeed**: Simple scrollable list of recent tool calls (last 20 displayed). Each item shows: icon (based on tool name), tool name, status badge — `"success"` (check icon), `"error"` (x icon), `"pending"` (spinner icon) — relative timestamp. Status comes from correlated tool_use/tool_result pairs
- **FileActivityFeed**: List of recently touched files with operation type indicator (Read/Edit/Write/Other). Show recency via relative time ("3s ago"). Cap at 15 items with newest first
- Both feeds: Use `Icon.svelte` for decorative icons. Follow the list styling pattern from session detail's files list at `src/routes/sessions/[id]/+page.svelte:136-141`

## Key context

- D3 v7 is installed (`d3@7.9`). Existing charts use `import * as d3` — follow this pattern for consistency
- `computeDimensions()` returns `{ width, height, margin }` for responsive chart sizing
- Tool call statuses: `"success"`, `"error"`, `"pending"` — these come from the `LiveToolCall` type (correlated via tool_use_id in the tailer)
## Approach

- **BurnRateChart**: Follow the D3 pattern at `src/lib/components/charts/ActivityChart.svelte` — use `bind:this` for container, `$effect()` for D3 rendering, responsive sizing via `computeDimensions()` from `src/lib/utils/chart-helpers.ts`
- Chart data: Accept `tokenHistory: Array<{ timestamp: number, tokensPerMinute: number }>` — render as a line chart with time on x-axis, tokens/min on y-axis
- Use a fixed 30-point rolling window to prevent memory growth on long sessions
- D3 scales: `scaleTime()` for x, `scaleLinear()` for y. Use `CHART_COLORS` from chart-helpers for line color
- On each data update, transition the line path smoothly (D3 `transition().duration(300)`)
- **ToolCallFeed**: Simple scrollable list of recent tool calls (last 20). Each item shows: icon (based on tool name), tool name, status badge (success/error), relative timestamp
- **FileActivityFeed**: List of recently touched files with operation type indicator (Read/Edit/Write). Show recency via relative time ("3s ago"). Cap at 15 items with newest first
- Both feeds: Use `Icon.svelte` for decorative icons. Follow the list styling pattern from session detail's files list at `src/routes/sessions/[id]/+page.svelte:136-141`

## Key context

- D3 v7 is installed (`d3@7.9`). Import only needed modules: `select`, `scaleTime`, `scaleLinear`, `line`, `axisBottom`, `axisLeft`, `transition`
- `computeDimensions()` returns `{ width, height, margin }` for responsive chart sizing
- The tool call feed should distinguish between in-progress calls (spinner icon) and completed ones (check/x icon)
## Acceptance
- [ ] `BurnRateChart.svelte` renders a D3 line chart of tokens/minute over time
- [ ] Chart uses rolling 30-point window (no unbounded growth)
- [ ] Chart is responsive (uses `computeDimensions()` pattern)
- [ ] D3 imported as `import * as d3` consistent with existing charts
- [ ] Line path transitions smoothly on data updates (D3 transition)
- [ ] `ToolCallFeed.svelte` shows last 20 tool calls with name, correlated status icon (success/error/pending), and relative timestamp
- [ ] `FileActivityFeed.svelte` shows last 15 file mutations with path, operation type, and recency indicator
- [ ] Both feeds scroll and show newest items first
- [ ] All components use Svelte 5 runes and Tailwind v4 semantic tokens
- [ ] `pnpm check` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

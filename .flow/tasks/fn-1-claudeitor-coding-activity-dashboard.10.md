# fn-1-claudeitor-coding-activity-dashboard.10 Build Costs page with model breakdown and trend charts

## Description
Build the Costs page with detailed cost breakdown by model, by day, and by repo. Includes D3.js trend charts showing cost over time and per-model distribution. Uses the cost calculator from task 3 and chart components from task 6.

**Size:** M
**Files:** src/routes/costs/+page.svelte, src/routes/costs/+page.server.ts, src/lib/components/charts/CostTrendChart.svelte, src/lib/components/charts/CostBreakdownChart.svelte

## Approach
- Load cost data: readCostCache() + readPricing() + calculateCosts()
- Views: daily cost trend (line/area chart), per-model breakdown (pie/donut or horizontal bars), cost table with sortable columns
- Date range selector: last 7/14/30/90 days
- CostTrendChart: D3 line/area chart showing daily cost over selected range
- CostBreakdownChart: D3 donut chart or horizontal bar chart showing per-model cost
- Summary stats at top: total cost (all time), cost today, cost this week, cost this month
- Table: date | model | input tokens | output tokens | cache tokens | cost
- Sort table by any column
- Reuse D3 patterns from task 6 (scales, axes, tooltips)

## Key context
- Cost data comes from readout-cost-cache.json via cost calculator
- Model ID mapping required (full ID -> short name -> display name)
- All costs in USD
- Charts should be consistent with Readout page charts (same tooltip style, colors)
## Acceptance
- [ ] Costs page loads and displays cost data from cache files
- [ ] Daily cost trend chart renders with D3.js
- [ ] Per-model cost breakdown chart renders
- [ ] Date range selector filters data (7/14/30/90 days)
- [ ] Summary stats: total cost, cost today, cost this week, cost this month
- [ ] Cost table shows per-day per-model token usage and cost
- [ ] Table columns are sortable
- [ ] Model names displayed as human-readable names (not raw IDs)
- [ ] Empty state when no cost data available
- [ ] Charts consistent with Readout page chart styling
## Done summary
Built the Costs page with full cost analytics:
- Server load aggregates cost data with calendar-date filtering (DST-safe)
- Summary stat cards: total cost, today, this week, this month
- D3.js area chart for daily cost trend with interactive tooltips showing per-model breakdown
- D3.js donut chart for per-model cost distribution with legend
- Sortable cost details table with date, model, token counts, and cost
- Date range selector (7/14/30/90 days) with URL-based state
- Empty state when no cost data available
- Addressed all code review findings: calendar-based filtering, DST-safe date math, render guards
## Evidence
- Commits:
- Tests: svelte-check: 0 errors, vitest: 74 tests passed, vite build: success
- PRs:
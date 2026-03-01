# fn-1-claudeitor-coding-activity-dashboard.6 Build D3.js chart components (Activity, HourlyDistribution, CostByModel)

## Description
Build three D3.js chart components for the dashboard: ActivityChart (30-day bar chart), HourlyDistributionChart (24-hour activity pattern), and CostByModelChart (horizontal bar chart). All charts are fully interactive with tooltips, click-to-filter, and linked interactions. Charts render in SVG using D3 scales and axes.

**Size:** M
**Files:** src/lib/components/charts/ActivityChart.svelte, src/lib/components/charts/HourlyDistributionChart.svelte, src/lib/components/charts/CostByModelChart.svelte, src/lib/components/charts/ChartTooltip.svelte, src/lib/utils/chart-helpers.ts

## Approach
- D3 + Svelte 5 integration pattern: use bind:this for SVG container refs, $derived for scales, $effect for axis rendering
- ActivityChart: vertical bars, one per day (30 days), x=date, y=messageCount (from stats-cache dailyActivity)
  - Tooltip on hover showing date + counts
  - Click bar to drill into that day
  - Brush selection for date range filtering
- HourlyDistributionChart: 24 vertical bars (hours 0-23), y=combined activity count
  - Data from stats-cache hourCounts + git commit timestamps
- CostByModelChart: horizontal bars, one per model
  - Data from aggregated cost-cache by model
  - Click to navigate to /costs
- ChartTooltip: shared tooltip component positioned near mouse
- chart-helpers: formatCurrency, formatNumber, responsive width calculation
- Use bind:clientWidth on container for responsive chart sizing

## Key context
- D3 v7+: use d3.scaleBand for bar charts, d3.scaleLinear for values
- Svelte 5: use $effect for D3 axis rendering (select + call axis), clean up in return
- bind:clientWidth in Svelte 5 uses ResizeObserver natively (no polyfill needed)
- Charts must support both light and dark themes (adjust axis/text colors)
## Acceptance
- [ ] ActivityChart renders 30-day bar chart from dailyActivity data
- [ ] ActivityChart: hover tooltips show date + messageCount + sessionCount
- [ ] ActivityChart: click bar drills down (dispatches event with date)
- [ ] HourlyDistributionChart renders 24-hour bar chart from hourCounts
- [ ] CostByModelChart renders horizontal bars per model with cost values
- [ ] CostByModelChart: click navigates to /costs
- [ ] All charts responsive: resize with container width
- [ ] All charts support light and dark themes
- [ ] ChartTooltip positions near mouse cursor
- [ ] Charts render correctly with empty data (no crashes, shows empty state)
- [ ] D3 scales and axes render cleanly with proper labels and formatting
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

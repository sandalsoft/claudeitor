# fn-5-cost-visualizations-timeframe-fix-rich.4 Cost Heatmap Calendar

## Description

Create `src/lib/components/charts/CostHeatmapChart.svelte` — a GitHub-style contribution heatmap showing daily spending intensity.

### Data Input
- Props: `data: DailyCost[]` — same daily cost data used by trend chart
- Props: `allDaily: DailyCost[]` — full unfiltered daily data for "All Time" view
- Map dates to grid positions: X = week number, Y = day of week (0=Mon through 6=Sun)

### Chart Architecture
- Calculate grid: determine date range from data, fill in missing days with $0
- Each cell is a rounded `<rect>` positioned by week column and day-of-week row
- Color scale: `d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxDailyCost])`
- Day-of-week labels on Y-axis (Mon, Wed, Fri abbreviated)
- Month labels across top when week starts a new month

### Layout
- Cell size: adaptive based on container width and number of weeks
- Gap between cells: 2px
- Month labels: positioned at the first week of each month

### Interactivity
- Tooltip on hover: date (formatted), cost, and day of week
- Hover effect: cell border highlight

### Visual Flair
- Smooth color gradient from pale yellow to deep red
- Today's cell has a pulsing border animation (CSS `@keyframes` or Svelte `animate`)
- Rounded cell corners (`rx="3"`)
- Empty days (no data) show a very subtle neutral background

### Key References
- Pattern: GitHub contribution graph / cal-heatmap
- D3 API: `d3.scaleSequential()`, `d3.interpolateYlOrRd`, `d3.timeWeek`, `d3.timeDay`
- Helpers: `formatCurrency`, `formatDateShort` from chart-helpers

## Acceptance
- [ ] Calendar grid renders with correct date positioning
- [ ] Color intensity maps to daily cost (light=cheap, dark=expensive)
- [ ] Month labels appear at month boundaries
- [ ] Day-of-week labels on Y-axis
- [ ] Tooltip shows date and cost on hover
- [ ] Today's cell has a visual highlight/pulse
- [ ] Missing days rendered with neutral background
- [ ] Responsive to container width
- [ ] No TypeScript errors

## Done summary
Created CostHeatmapChart.svelte - a GitHub-style contribution heatmap showing daily spending intensity with D3 sequential color scale, adaptive cell sizing, month/day-of-week labels, hover tooltips, and a pulsing animation on today's cell.
## Evidence
- Commits: 54f69545e1e3dbf7289c0b446804f6e5ab8fc731
- Tests: npx tsc --noEmit, npm run build
- PRs:
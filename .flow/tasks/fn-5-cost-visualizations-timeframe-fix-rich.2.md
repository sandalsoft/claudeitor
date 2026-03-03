# fn-5-cost-visualizations-timeframe-fix-rich.2 Stacked Area Chart: Cost Over Time by Model

## Description

Create `src/lib/components/charts/CostStackedAreaChart.svelte` — a stacked area chart showing daily cost broken down by model over time.

### Data Input
- Props: `data: DailyCost[]` (same shape as `CostTrendChart`) — each entry has `date`, `totalCostUSD`, `byModel: Record<string, number>`
- Extract unique model keys from all entries, use `d3.stack().keys(modelKeys)` to build stacked series

### Chart Architecture
- Use `d3.stack()` + `d3.area()` with `d3.curveMonotoneX` for smooth curves
- X-axis: dates (point scale), Y-axis: stacked cost (linear scale)
- Follow `CostTrendChart` pattern: `$derived` for paths/scales, `$effect` for D3 axis rendering
- Use `chartColor()` for per-model colors, consistent with donut chart

### Interactivity
- Hover crosshair: vertical line snapping to nearest date
- Tooltip: shows date, total cost, and per-model breakdown sorted by cost descending
- Highlight: on hover, dim non-hovered layers to 30% opacity

### Visual Flair
- SVG `<linearGradient>` for each model's area fill — fade from solid at top to transparent at baseline
- Smooth animated transitions when timeframe changes (Svelte `transition:fade` on the SVG group)
- Subtle grid lines matching existing chart style

### Key References
- Pattern: `src/lib/components/charts/CostTrendChart.svelte` (area + line + axis rendering)
- Helpers: `src/lib/utils/chart-helpers.ts` (chartColor, computeDimensions, formatCurrency, formatDateShort)
- D3 API: `d3.stack()`, `d3.area()`, `d3.scalePoint`, `d3.scaleLinear`

## Acceptance
- [ ] Chart renders stacked areas per model, colored consistently
- [ ] Hover tooltip shows date + per-model cost breakdown
- [ ] Gradient fill: each layer fades from solid to transparent
- [ ] Axes render correctly with formatted labels
- [ ] Responsive: adapts to container width via `bind:clientWidth`
- [ ] Empty state handled gracefully
- [ ] No TypeScript errors

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

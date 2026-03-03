# fn-5-cost-visualizations-timeframe-fix-rich: Cost Visualizations — Timeframe Fix + Rich Charts

## Overview

The cost page needs three fixes: (1) update timeframe selector (add 1d, remove 14d, rename 90d to All Time), (2) fix the Cost by Model donut chart which doesn't respond to timeframe changes, and (3) add 4 new visually distinctive charts that tell the story of how money is spent on models.

## Scope

### Bug Fixes
- Timeframe selector: `1d / 7d / 30d / All Time` (was `7d / 14d / 30d / 90d`)
- Cost by Model donut: filter `byModel` data by selected date range (currently sends all-time aggregate regardless of range)

### New Visualizations (4)
1. **Stacked Area Chart** — cost over time broken down by model
2. **Token Efficiency Treemap** — hierarchical cost distribution (model → token type)
3. **Cost Heatmap Calendar** — GitHub-style daily spending intensity grid
4. **Model Radar Chart** — multi-dimensional model comparison (cost/efficiency/usage)

### Visual Flair Requirements
- Gradient fills, smooth transitions, animated entrances
- Each chart has a unique visual personality
- Dark-theme-first design using existing HSL palette

## Approach

### Data Flow Fix
The root cause of the donut bug is in `+page.server.ts:127` — `byModel: costSummary.byModel` returns the all-time aggregate. Fix: compute `byModel` from `filteredDaily` so it respects the date range.

### Server Changes
- Accept range `0` as valid (meaning "all time")
- When range is 0, skip date filtering
- Compute range-filtered `byModel` from `filteredDaily` data
- Pass additional data for new charts: daily-by-model breakdown (already in `filteredDaily.byModel`)

### Chart Architecture
- All charts in `src/lib/components/charts/`
- Follow existing pattern: `$derived` for scales/paths, `$effect` for D3 axes
- Use `chartColor()` from `chart-helpers.ts`
- Each chart is a standalone Svelte component accepting typed props

## Quick commands
- `cd /Users/eric/Development/code/Claude/claudeitor && npx tsc --noEmit`
- `cd /Users/eric/Development/code/Claude/claudeitor && npm run build`
- `cd /Users/eric/Development/code/Claude/claudeitor && npm run dev`

## Acceptance
- [ ] Timeframe selector shows 1d / 7d / 30d / All Time
- [ ] All charts respond correctly to timeframe selection
- [ ] 4 new chart types render with real data and interactive tooltips
- [ ] Visual flair: gradients, animations, unique chart personalities
- [ ] Responsive layout (2-col desktop, 1-col mobile)
- [ ] No TypeScript errors, no console warnings
- [ ] Existing cost table continues to work

## References
- `src/routes/costs/+page.server.ts` — server load, date filtering, byModel bug
- `src/routes/costs/+page.svelte` — page layout, range selector
- `src/lib/components/charts/CostBreakdownChart.svelte` — donut chart
- `src/lib/components/charts/CostTrendChart.svelte` — area chart pattern
- `src/lib/components/charts/CostByModelChart.svelte` — horizontal bar chart
- `src/lib/server/claude/cost-calculator.ts` — CostSummary, ModelCost, DailyCost types
- `src/lib/utils/chart-helpers.ts` — formatCurrency, chartColor, computeDimensions

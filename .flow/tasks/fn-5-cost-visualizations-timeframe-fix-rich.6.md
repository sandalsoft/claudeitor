# fn-5-cost-visualizations-timeframe-fix-rich.6 Wire up new charts, layout polish, and stat card updates

## Description

Integrate all new charts into the cost page, update the layout, and add new stat cards.

### Page Layout (`src/routes/costs/+page.svelte`)
Current layout: stat cards → 2-col chart grid → table.
New layout:
1. **Stat cards row** (4 cards, updated)
2. **Full-width**: Stacked Area Chart (daily cost by model over time)
3. **2-col grid**: Cost by Model donut (existing) + Token Efficiency Treemap
4. **Full-width**: Cost Heatmap Calendar
5. **Full-width**: Model Radar Chart
6. **Cost table** (existing, unchanged)

### Updated Stat Cards
Keep existing: Total Cost, Today, This Week, This Month
Update "Total Cost" label to "Range Total" when not on "All" to clarify scope.
Add visual: show model name badge on "Today" card if there's a dominant model.

### Server Data (`src/routes/costs/+page.server.ts`)
Ensure all required data is passed to the page:
- `daily` (filtered) — already exists, used by stacked area + heatmap
- `allDaily` — add: full unfiltered daily data for heatmap "All Time" context
- `byModel` (filtered) — fixed in task 1, used by donut + treemap + radar
- `tableRows` — already exists
- `range` — already exists

### Wiring
- Import all new chart components
- Pass correct data props to each chart
- All charts receive timeframe-filtered data (donut, treemap, radar use filtered `byModel`; stacked area and heatmap use filtered `daily`)

### Responsive
- Charts in 2-col grid collapse to single column on mobile (`lg:grid-cols-2`)
- Full-width charts have max-height constraints on very wide screens

### Files to Modify
- `src/routes/costs/+page.svelte` — layout, imports, wiring
- `src/routes/costs/+page.server.ts` — add `allDaily` to returned data

## Acceptance
- [ ] All 6 charts visible on cost page (2 existing + 4 new)
- [ ] Layout: stacked area full-width, donut+treemap side-by-side, heatmap full-width, radar full-width
- [ ] All charts receive correctly filtered data
- [ ] Stat cards show range-appropriate labels
- [ ] Responsive layout works on mobile and desktop
- [ ] Page loads without errors
- [ ] TypeScript clean (`npx tsc --noEmit`)
- [ ] Build succeeds (`npm run build`)

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

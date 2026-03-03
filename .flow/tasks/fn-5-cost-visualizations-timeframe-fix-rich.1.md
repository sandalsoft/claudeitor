# fn-5-cost-visualizations-timeframe-fix-rich.1 Fix timeframe selector and Cost by Model filtering bug

## Description

Two bugs to fix in the cost route:

### 1. Timeframe Selector Options
In `src/routes/costs/+page.svelte:15-20`, change the `ranges` array:
- Remove 14d option
- Add 1d option (value: `1`)
- Change 90d to "All" (value: `0`)
- Final order: `1d / 7d / 30d / All`

### 2. Cost by Model Doesn't Respond to Timeframe
**Root cause**: `src/routes/costs/+page.server.ts:127` returns `byModel: costSummary.byModel` — the all-time aggregate from `calculateCosts()`. This never changes regardless of selected range.

**Fix**: Compute `byModel` from `filteredDaily` instead:
- Iterate `filteredDaily`, aggregate each day's `byModel` entries into a range-scoped model cost map
- Return the same `ModelCost[]` shape but scoped to the selected date range
- Map each aggregated model back to include `modelId`, `pricingKey`, `totalCostUSD` etc.

### 3. Server: Accept range=0 for All Time
In `src/routes/costs/+page.server.ts:26-29`:
- Add `0` to `validRanges`
- When range is `0`, skip date filtering — return all daily data
- Update `totalCost` stat card to show range-scoped total (not all-time) to stay consistent

### Files to modify
- `src/routes/costs/+page.svelte` — ranges array, handle "All" label
- `src/routes/costs/+page.server.ts` — validRanges, range=0 logic, compute filtered byModel

## Acceptance
- [ ] Timeframe selector shows exactly: 1d / 7d / 30d / All
- [ ] Selecting "1d" shows only today's data in all charts and table
- [ ] Selecting "All" shows all available data
- [ ] Cost by Model donut chart updates when switching timeframes
- [ ] Total Cost stat card reflects the selected range
- [ ] Cost table continues to filter correctly
- [ ] No TypeScript errors (`npx tsc --noEmit`)

## Done summary
Fixed timeframe selector (1d/7d/30d/All), made Cost by Model donut chart respond to timeframe changes by computing byModel from filteredDaily, and scoped Total Cost stat card to the selected range. Added range=0 support for all-time view.
## Evidence
- Commits: 00bd59d1fe226a44914fae08e2b9d0d72fe2d6da
- Tests: npx tsc --noEmit, npm run build
- PRs:
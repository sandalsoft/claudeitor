# fn-5-cost-visualizations-timeframe-fix-rich.5 Model Cost Efficiency Radar Chart

## Description

Create `src/lib/components/charts/CostRadarChart.svelte` — a radar/spider chart comparing models across multiple cost and efficiency dimensions.

### Data Input
- Props: `data: ModelCost[]` — per-model cost breakdown with token counts
- Props: `daily: DailyCost[]` — for calculating usage frequency (days active per model)
- Show top N models (max 5-6) to keep chart readable; collapse others if needed

### Dimensions (5 axes)
1. **Total Spend** — `totalCostUSD` normalized to [0,1] against max model
2. **Input Cost Rate** — `inputCostUSD / totalTokens` normalized
3. **Output Cost Rate** — `outputCostUSD / totalTokens` normalized
4. **Cache Efficiency** — `(cacheReadCostUSD + cacheWriteCostUSD) / totalCostUSD` inverted (higher cache = more efficient)
5. **Usage Frequency** — count of days model appears in `daily[].byModel` keys, normalized

### Chart Architecture
- Pure SVG, no D3 layout needed — calculate polygon vertices with trigonometry
- Center point + 5 axes radiating at 72° intervals
- Concentric grid circles at 25%, 50%, 75%, 100%
- Each model = one polygon with vertices at `(centerX + radius * value * cos(angle), centerY + radius * value * sin(angle))`
- Axis labels at the tips of each axis

### Interactivity
- Hover on a model's polygon: bring to front, increase opacity, show tooltip with all 5 raw values
- Hover on axis label: highlight that dimension across all models
- Legend below chart: click to toggle model visibility

### Visual Flair
- Gradient polygon fills: each model gets a gradient from center (transparent) to edge (30% opacity of model color)
- Glowing data points at vertices: small circles with a subtle CSS `box-shadow` glow effect (via SVG filter `<feGaussianBlur>`)
- Animated draw-in on mount: polygon vertices animate from center to final positions using Svelte `tweened` or `spring`
- Grid lines: subtle dashed circles

### Key References
- Similar pattern: D3 radar chart examples (no built-in D3 layout, custom math)
- Colors: `chartColor()` from chart-helpers
- Svelte animation: `import { tweened } from 'svelte/motion'`

## Acceptance
- [ ] Radar chart renders with 5 axes and labeled dimensions
- [ ] Up to 5-6 models displayed as overlapping polygons
- [ ] Gradient fills with distinct colors per model
- [ ] Glowing data points at polygon vertices
- [ ] Hover highlights individual model polygon
- [ ] Animated entrance on mount
- [ ] Legend with toggleable model visibility
- [ ] Responsive to container width
- [ ] No TypeScript errors

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

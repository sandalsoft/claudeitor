# fn-5-cost-visualizations-timeframe-fix-rich.3 Token Efficiency Treemap

## Description

Create `src/lib/components/charts/CostTreemapChart.svelte` — a treemap visualization showing hierarchical cost distribution.

### Data Input
- Props: `data: ModelCost[]` from cost-calculator (includes `pricingKey`, `totalCostUSD`, `inputCostUSD`, `outputCostUSD`, `cacheReadCostUSD`, `cacheWriteCostUSD`, `totalTokens`)
- Build hierarchy: root → model nodes → token-type leaf nodes (input/output/cache read/cache write)
- Only include token types with non-zero cost

### Chart Architecture
- Use `d3.hierarchy()` to build tree from data, `.sum(d => d.cost)` for area sizing
- Use `d3.treemap().size([width, height]).paddingInner(2).paddingOuter(4).tile(d3.treemapSquarify)`
- Render rectangles with Svelte `{#each root.leaves()}` for declarative SVG
- Color: model-level color from `chartColor()`, token-type leaves use lighter/darker variants

### Labels
- Inside each rectangle: model name (if rect is large enough, > 60px width)
- Percentage of total cost
- Token type label for leaf nodes
- Use CSS `text-overflow: ellipsis` via SVG `<foreignObject>` for clean text clipping

### Interactivity
- Tooltip on hover: model name, token type, cost, percentage of total, token count
- Hover effect: elevate hovered rectangle with subtle scale transform and border highlight

### Visual Flair
- Rounded corners on rectangles (`rx="4"`)
- Subtle inner shadow effect via a darker stroke on top/left edges
- Color intensity varies by cost-per-token efficiency: `d3.scaleSequential(d3.interpolateBlues)` mapped to `cost / tokens`
- Smooth transition when data changes

### Key References
- D3 API: `d3.hierarchy()`, `d3.treemap()`, `d3.treemapSquarify`
- Pattern: follow existing chart component structure (container div, bind:clientWidth, ChartTooltip)
- Types: `ModelCost` from `src/lib/server/claude/cost-calculator.ts`

## Acceptance
- [ ] Treemap renders correctly with rectangles sized by cost
- [ ] Hierarchy: model → token type (input/output/cache)
- [ ] Labels visible in sufficiently large rectangles
- [ ] Tooltip shows model, token type, cost, percentage, token count
- [ ] Rounded corners and color intensity based on efficiency
- [ ] Responsive to container width
- [ ] Empty state handled
- [ ] No TypeScript errors

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

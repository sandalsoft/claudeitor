# Cost Route & Visualization Patterns

## Overview
The `/costs` route displays comprehensive token usage and cost data with:
- Time-range filtering (7d, 14d, 30d, 90d)
- Daily trend chart (area + line)
- Model breakdown donut chart
- Detailed table with sortable columns
- Summary stat cards

## Data Flow

### 1. Load Function (+page.server.ts)
- Reads `CostCache` and `PricingData` from ~/.claude/
- Calls `calculateCosts()` to compute daily + model aggregates
- Filters data by date range (DST-safe arithmetic)
- Computes aggregates: total, today, thisWeek, thisMonth
- Builds detailed table rows by mapping raw model IDs → pricing keys
- Returns: `{ totalCost, costToday, costThisWeek, costThisMonth, byModel, daily, tableRows, range }`

### 2. Cost Calculation (cost-calculator.ts)
- `calculateCosts(costCache, pricing)` → CostSummary
- Per-model aggregation: maps rawModelId → pricingKey via mapModelId()
- Token cost formula: `(tokens / 1_000_000) * ratePerMillion`
- Tracks: inputCostUSD, outputCostUSD, cacheReadCostUSD, cacheWriteCostUSD
- Logs warnings for unknown models (shows $0)

### 3. Data Types (types.ts)
```typescript
// CostCache from ~/.claude/readout-cost-cache.json
interface CostCache {
  version: number
  lastFullScan: string
  days: Record<string, Record<string, TokenUsage>>
}

// PricingData from ~/.claude/readout-pricing.json
interface PricingData {
  updated: string
  source: string
  models: Record<string, ModelPricing>
}

// Daily aggregates for charts
interface DailyCost {
  date: string               // YYYY-MM-DD
  totalCostUSD: number
  byModel: Record<string, number>  // pricingKey → cost
}

// Per-model aggregates
interface ModelCost {
  modelId: string
  pricingKey: string
  totalCostUSD: number
  inputCostUSD: number
  outputCostUSD: number
  cacheReadCostUSD: number
  cacheWriteCostUSD: number
  totalTokens: number
}
```

## Chart Components

### CostTrendChart.svelte
- **Type**: Area + line chart with D3
- **Data**: DailyCost[] (sorted by date)
- **Dimensions**: ASPECT_RATIO = 2.5, responsive width
- **Scales**: scalePoint (x, dates), scaleLinear (y, USD)
- **Features**:
  - Monotone curve interpolation
  - Smart x-axis label frequency (every 1-3 dates based on density)
  - Hover tooltip: date + total cost + top 5 models (donut breakdown)
  - Empty state: "No cost data available"

### CostBreakdownChart.svelte
- **Type**: Donut chart (donut, not pie)
- **Data**: ModelCost[] (filtered by totalCostUSD > 0, sorted descending)
- **Dimensions**: 120px–240px (clamped to container width)
- **Features**:
  - D3 pie layout with 0.02 pad angle
  - Inner radius = 55% of outer (donut effect)
  - Center label: total cost
  - Legend: top 8 models with cost + percentage
  - Hover tooltip: model + cost + % of total
  - Empty state: dashed border box

### CostByModelChart.svelte
- **Type**: Horizontal bar chart
- **Data**: ModelCost[] (sorted descending by cost)
- **Dimensions**: Dynamic height (28px per bar + margins, min 120px)
- **Features**:
  - Left-aligned labels (truncated to 16 chars + ellipsis)
  - Value labels right of bar
  - Bar color cycling via chartColor(index)
  - Click navigation to `/costs` (navigateOnClick prop)
  - Empty state: dashed border box

## Chart Utilities (chart-helpers.ts)

### Formatting
- `formatCurrency(value)`: $1.2K, $0.34, $100, $10.5, $0.12
- `formatNumber(value)`: 1.2M, 3.4K, 1,234
- `formatDateShort(dateStr)`: "Jan 15" from "2025-01-15"
- `formatHour(hour)`: "12 AM", "3 PM" from 0–23

### Dimensions
- `computeDimensions(containerWidth, aspectRatio, margin)` → ChartDimensions
- Returns: width, height, innerWidth, innerHeight, margin

### Colors
- `CHART_COLORS`: 8-color palette (HSL tuples)
- `chartColor(index)`: cycles through palette, always returns HSL string
- **Why HSL strings**: D3 attr() doesn't resolve CSS variables; callers need actual colors

## Key Patterns

### 1. Responsive Charts
- All charts read `containerWidth` via `bind:clientWidth`
- Dimensions computed in `$derived` blocks
- SVG re-renders on width changes

### 2. Time Range Filtering
- Query param `?range=7|14|30|90` (defaults to 30)
- Passed via `goto(url.pathname + url.search, { replaceState: true })`
- Data filtered by YYYY-MM-DD string comparison (not timestamps)

### 3. DST-Safe Date Arithmetic
- Uses `new Date(year, month, date)` constructor
- Applies `.setDate(d - n)` for offsets (not millisecond math)
- Local date string via `getFullYear()`, `getMonth() + 1`, `getDate()`

### 4. Model ID Mapping
- Raw model ID from cache → normalized pricingKey (via mapModelId())
- Maps onto pricing.models object
- Logs warning if pricingKey not found

### 5. Table Sorting
- Client-side sort state: sortKey, sortAsc
- Applies direction toggle logic (switch sort key → asc; same key → toggle)
- Sorts via switch statement on key (prevents bugs vs. dynamic field access)

## Common Pitfalls

### 1. Chart Dimensions
- Don't compute height from fixed aspect ratio on first render (width = 0)
- Use `$derived` to ensure dimensions update when container resizes
- Clamp containerWidth to minimum (e.g., 200px)

### 2. Color Resolution
- CSS variables in D3 won't work; use HSL strings
- chartColor() returns raw color, not CSS var reference

### 3. Date Filtering
- Compare YYYY-MM-DD strings, not timestamps
- DST transitions can break millisecond-based arithmetic

### 4. Tooltip Positioning
- Get rect from containerEl, not window
- Account for MARGIN offsets when snapping to nearest data point

### 5. Empty States
- Charts must render empty state div with consistent height
- Use dashed border + muted colors for visual distinction

## Testing Notes
- Cost cache + pricing files go in ~/.claude/ (readout-cost-cache.json, readout-pricing.json)
- Tests use temp fixture directories
- Model mapping cache invalidates when pricing changes
- Always validate unknown models produce $0 cost with warnings

## Integration Points
- Dashboard home page uses CostByModelChart (read-only, no nav)
- Settings page references cost data (if applicable)
- All routes respect claudeDir param for testability
- Telemetry spans wrap load(), calculate functions for observability

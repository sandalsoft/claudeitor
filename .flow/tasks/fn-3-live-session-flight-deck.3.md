# fn-3-live-session-flight-deck.3 FlightCard component with live token counters and cost display

## Description
Create the `FlightCard` Svelte 5 component that displays a single active session's real-time telemetry: model badge, duration timer, live token counters (input/output/cache), rolling cost estimate, and a compact file activity indicator.

**Size:** M
**Files:**
- `src/lib/components/live/FlightCard.svelte` (NEW)
- `src/lib/components/live/TokenCounter.svelte` (NEW)
- `src/lib/components/live/DurationTimer.svelte` (NEW)

## Approach

- Use Svelte 5 runes: `$props()` for data input, `$derived()` for computed values, `$effect()` for the duration timer interval
- Follow component patterns from `src/lib/components/cards/SessionCard.svelte` for card layout and styling
- Use semantic Tailwind v4 color tokens (`text-foreground`, `bg-card`, `border-border` etc.) matching existing design system
- `DurationTimer`: Accept `startTime` prop, use `$effect()` with `setInterval(1000)` to tick a reactive `$state` elapsed counter — format as HH:MM:SS
- `TokenCounter`: Accept token counts object, render with `formatNumber()` from `src/lib/utils/chart-helpers.ts` — animate count changes with CSS transitions
- `FlightCard` layout: header (model badge + duration), body (token grid + cost), footer (file count + tool call count)
- Model badge: Use `Badge.svelte` from `src/lib/components/ui/Badge.svelte` with variant based on model family (opus=default, sonnet=secondary, haiku=outline)
- Cost display: Use `formatCurrency()` from `src/lib/utils/chart-helpers.ts`
- Reuse `Icon.svelte` for decorative icons (clock, coins, file-text, terminal)

## Key context

- Svelte 5 timer pattern: `$effect(() => { const id = setInterval(...); return () => clearInterval(id); })`
- Badge variants available: default, secondary, success, warning, destructive, outline
- Token types to display: Input, Output, Cache Read, Cache Write — use a 2x2 grid
## Acceptance
- [ ] `FlightCard.svelte` renders an enriched active session as a card with model badge, duration, tokens, cost, and activity summary
- [ ] `DurationTimer.svelte` ticks every second showing elapsed HH:MM:SS since session start
- [ ] `TokenCounter.svelte` displays token counts with `formatNumber()` formatting
- [ ] Model badge uses appropriate variant based on model family
- [ ] Cost displayed with `formatCurrency()` from chart helpers
- [ ] File count and tool call count shown in card footer
- [ ] All components use Svelte 5 runes ($props, $derived, $effect) — no legacy stores or reactive declarations
- [ ] Styling uses semantic Tailwind v4 tokens matching existing design system
- [ ] Timer cleanup: `$effect` returns cleanup function that clears interval
- [ ] `pnpm check` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

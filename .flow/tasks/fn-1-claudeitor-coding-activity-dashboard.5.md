# fn-1-claudeitor-coding-activity-dashboard.5 Build UI primitives and stat card components

## Description
Build reusable UI primitive components and the stat card system used across the dashboard. Stat cards show a metric value with label, trend indicator (colored dot showing up/down vs previous period), and optional link. Also build alert card, session card, and repo chip components used on the Readout page.

**Size:** M
**Files:** src/lib/components/ui/Badge.svelte, src/lib/components/ui/Skeleton.svelte, src/lib/components/ui/Tooltip.svelte, src/lib/components/cards/StatCard.svelte, src/lib/components/cards/AlertCard.svelte, src/lib/components/cards/SessionCard.svelte, src/lib/components/cards/RepoChip.svelte, src/lib/components/cards/InfoCard.svelte

## Approach
- StatCard: title, value, trend (up/down/neutral), trend color (green/red/gray), subtitle, link
- Trend indicator: small colored dot (green=up, red=down, gray=neutral) computed from current vs previous period
- AlertCard: icon, message, severity, snooze button with configurable duration (1hr, 1day, 1week)
- Snooze state stored in localStorage
- SessionCard: session description, repo link, time ago (relative), click navigates to /sessions/:id
- RepoChip: repo name badge with activity score indicator
- InfoCard: generic card for Skills/Agents/Memory/Repos bottom row
- All components use Svelte 5 $props() rune, NOT export let
- Follow clean-web-design skill for spacing, typography, colors

## Key context
- Svelte 5: use let { prop1, prop2 } = $props() pattern
- Trend calculation: compare current period value to same-length previous period
- Alert snooze: store { alertId: snoozeUntilTimestamp } in localStorage
## Acceptance
- [ ] StatCard renders title, value, and trend indicator (colored dot)
- [ ] StatCard trend: green dot for up, red for down, gray for neutral
- [ ] AlertCard shows message with snooze button
- [ ] Alert snooze persists across page reloads (localStorage)
- [ ] SessionCard shows description, repo, and relative time
- [ ] RepoChip renders as a clickable badge with activity indicator
- [ ] InfoCard renders title, count/content, and link
- [ ] Skeleton component for loading states
- [ ] All components use Svelte 5 $props() (no export let)
- [ ] Components follow clean-web-design patterns (spacing, colors, typography)
- [ ] Components support both light and dark themes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

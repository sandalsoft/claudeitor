# fn-1-claudeitor-coding-activity-dashboard.8 Build Readout page (main dashboard) with all sections

## Description
Build the Readout page (main dashboard) — the primary view that brings together all components. This is the most complex page, assembling stat cards, charts, recent sessions, alerts, recently active repos, and bottom info cards into a responsive grid layout that matches the reference screenshot.

**Size:** M
**Files:** src/routes/+page.svelte, src/routes/+page.server.ts

## Approach
- +page.server.ts load function: call all data readers (stats, costs, sessions, repos, skills, agents, settings) in parallel
- Responsive grid layout: follow reference screenshot — 4 stat cards top row, charts in middle, session list + alerts, bottom 4 info cards
- Wire SSE realtime store for live updates to stat cards and charts
- Top stat cards: Repos count, Commits Today, Sessions (total), Est. Cost (total)
  - Each with trend indicator comparing current period vs previous
- Activity Chart: pass dailyActivity from stats-cache
- When You Work Chart: pass hourCounts from stats-cache
- Cost by Model Chart: pass aggregated costs from cost calculator
- Recent Sessions: last 5 sessions from history.jsonl with descriptions and repo links
- Alerts: compute from repo scanning (uncommitted files > 0, unpushed commits > 0)
- Recently Active: repo chips with combined activity scores (commits + sessions + file changes)
- Bottom cards: Skills (count + link), Agents (count + link), Memory (CLAUDE.md line counts + link), Repos (list + link)
- Header: time-aware greeting + AI summary placeholder (show skeleton if no API key)

## Key context
- Readout is the only page with real-time SSE updates
- All data loading happens server-side in +page.server.ts
- SSE updates overlay on top of initial server-loaded data
- AI summary: defer to settings — if no API key, show "Configure API key for AI insights"
- Grid must be responsive but desktop-primary
## Acceptance
- [ ] Readout page renders complete dashboard layout matching reference screenshot
- [ ] 4 stat cards top row: Repos, Commits Today, Sessions, Est. Cost
- [ ] Stat cards show real data from ~/.claude/ cache files
- [ ] Stat cards have trend indicators (colored dots)
- [ ] Activity Chart renders with real 30-day data
- [ ] When You Work Chart renders with real hourly data
- [ ] Cost by Model Chart renders with real cost data
- [ ] Recent Sessions shows last 5 sessions with descriptions
- [ ] Alerts section shows hygiene issues from repo scanning
- [ ] Recently Active shows repo chips with activity scores
- [ ] Bottom cards show Skills, Agents, Memory, Repos with real data
- [ ] SSE updates refresh stat cards and charts in real-time
- [ ] Header shows time-aware greeting
- [ ] Layout is responsive (works on different screen widths)
- [ ] Page loads in under 2 seconds using cache-first strategy
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

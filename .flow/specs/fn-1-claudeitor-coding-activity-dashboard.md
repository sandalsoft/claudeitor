# Claudeitor: Coding Activity Dashboard

## Problem

There is no unified, visual way to monitor coding and Claude Code agent activities across all projects. Data is scattered across ~/.claude/ config files, git repos, session logs, and cache files. The user needs a real-time web dashboard that aggregates and visualizes this data in one place — replicating and extending the design of an existing reference tool (screenshot provided).

## Vision

A localhost-only SvelteKit + Svelte 5 web dashboard that reads from the local filesystem (~/.claude/, git repos) and presents a rich, interactive overview of coding activity, session history, costs, repo health, and Claude Code configuration. The dashboard follows the clean-web-design skill for UI and leverages svelte-runes and sveltekit-data-flow skills for implementation.

## Stack & Technology Decisions

- **Framework**: SvelteKit + Svelte 5 (runes, $state, $derived, $effect)
- **Styling**: Tailwind CSS v4 with CSS-first config, @theme directive, HSL custom properties
- **Theme**: System preference (light/dark) auto-detection
- **Charts**: D3.js — fully interactive (tooltips, click-to-filter, zoom, brush, linked interactions)
- **TypeScript**: Strict mode, full type safety
- **Adapter**: Node adapter (persistent server needed for SSE, file watching, background scanning)
- **Port**: 5173 (Vite default)
- **Testing**: Vitest unit tests for data layer

## Architecture

### Clean Separation

```
src/
├── lib/
│   ├── data/           # Filesystem scanning, data parsing, cache readers
│   │   ├── claude/     # ~/.claude/ data readers (sessions, costs, skills, etc.)
│   │   ├── git/        # Git repo scanning (commits, status, branches)
│   │   ├── config.ts   # Dashboard config reader
│   │   └── types.ts    # Shared data types
│   ├── components/     # Reusable UI components
│   │   ├── charts/     # D3.js chart components (Activity, HourlyDistribution, CostByModel)
│   │   ├── cards/      # Dashboard cards (StatCard, AlertCard, SessionCard, etc.)
│   │   ├── layout/     # Sidebar, CommandPalette, Header
│   │   └── ui/         # Base UI primitives
│   ├── stores/         # Svelte stores for shared state
│   └── utils/          # Formatting, date helpers, etc.
├── routes/
│   ├── +layout.svelte  # Main layout with sidebar
│   ├── +page.svelte    # Readout (main dashboard)
│   ├── live/           # Active sessions + activity feed
│   ├── sessions/       # Session history + detail/replay
│   ├── costs/          # Cost breakdown and analysis
│   ├── repos/          # Repository details
│   ├── timeline/       # Activity timeline
│   ├── skills/         # Skills inventory
│   ├── agents/         # Agents inventory
│   ├── memory/         # Memory/CLAUDE.md viewer (read-only)
│   ├── hooks/          # Hooks configuration viewer
│   ├── extensions/     # Pi-agent extensions (deferred — stub page)
│   ├── settings/       # Dashboard settings
│   └── [stubs]/        # Work Graph, Repo Pulse, Diffs, Snapshots, Hygiene, Deps, Worktrees, Env, Lint
└── api/
    └── sse/            # Server-Sent Events endpoint for real-time updates
```

### Data Strategy

1. **Cache-first with fallback**: Read from ~/.claude/stats-cache.json, readout-cost-cache.json, readout-pricing.json when available
2. **Raw data fallback**: Parse ~/.claude/history.jsonl and per-project session data when caches are missing
3. **Incremental repo scanning**: Scan a few repos at a time, cache results, skip unchanged repos
4. **File watching**: Use chokidar or fs.watch to detect changes in ~/.claude/ and trigger SSE updates

### Existing Data Sources (discovered in ~/.claude/)

- `stats-cache.json` — Daily activity data (messageCount, sessionCount, toolCallCount per day)
- `readout-cost-cache.json` — Per-day, per-model token usage (cacheRead, cacheWrite, input, output)
- `readout-pricing.json` — Model pricing (input/output/cacheRead/cacheWrite per MTok)
- `history.jsonl` — Session history (235KB, all sessions)
- `projects/` — Per-project data directories (72+ projects)
- `skills/` — Skill directories (50+ skills)
- `agents/` — Agent markdown files
- `plugins/` — Plugin config and installed plugins
- `settings.json` — User settings, hooks, enabled plugins
- `session-env/` — Per-session environment data
- `debug/` — Debug logs

### Real-time Updates (SSE)

- **Readout page**: Real-time updates via SSE (alerts, commit counts, active sessions)
- **Detail pages**: Data fetched on page navigation, not real-time
- File watcher on ~/.claude/ triggers SSE events for changed data

### Config File

`claudeitor.config.json` in project root:
```json
{
  "repoDirs": ["~/Development/"],
  "claudeDir": "~/.claude/",
  "llm": {
    "provider": "anthropic",
    "model": "claude-haiku-4-5-20251001",
    "apiKey": ""
  },
  "alerts": {
    "costThreshold": 100
  },
  "refreshInterval": 30
}
```

## Readout Page (Main Dashboard) — Detailed Spec

### Header
- Time-aware greeting: "Morning session, Eric" / "Night session, Eric"
- AI-generated smart summary of current state (repos, skills, commits today) via Claude API
- Cached locally to avoid repeated API calls

### Top Stat Cards (4-card row)
- **Repos** — count from config/scanning
- **Commits Today** — from git log across all repos
- **Sessions** — from stats-cache or history.jsonl
- **Est. Cost** — computed from readout-cost-cache.json + pricing
- Each card has a **trend indicator** (colored dot) showing up/down vs previous period

### Activity Chart (30d)
- D3.js bar chart showing daily activity over last 30 days
- Data from stats-cache.json dailyActivity
- Interactive: hover for tooltips, click to drill into that day, brush to select date range

### When You Work Chart
- D3.js hourly distribution (24-hour bar chart)
- Data from git commit timestamps + Claude session timestamps combined
- Shows when the user is most active

### Cost by Model
- D3.js horizontal bar chart
- Data from readout-cost-cache.json aggregated by model
- Shows per-model cost and total
- Click to navigate to /costs

### Recent Sessions
- List of last 3-5 sessions with description, repo link, time ago
- Click to navigate to /sessions/:id

### Alert Notifications
- Hygiene issues (computed from repo scanning)
- Uncommitted files count per repo
- Unpushed commits per repo
- **Snooze-able** — can snooze for 1hr, 1 day, etc.

### Recently Active
- Chips/badges showing recently active repos with combined activity score
- Activity score = commits + sessions + file changes

### Bottom Cards (4-card row)
- **Skills** — list with count, links to /skills
- **Agents** — list or "no agents found", links to /agents
- **Memory** — CLAUDE.md entries with line counts, links to /memory (read-only)
- **Repos** — repo list with skill counts, links to /repos

### Footer
- Plugin and hook counts

## Session Detail & Replay

When clicking a session from Recent Sessions or the Sessions page:

### Session Summary
- **Metadata**: Duration, model used, tokens consumed, cost, files touched
- **AI-generated narrative summary**: Sent via Claude API (configurable model), cached locally in project data dir

### Session Replay
- **Scrubable timeline** at the bottom of the page
- Full transcript with timestamps
- Scrub to any point to see conversation state at that moment
- See file diffs at each step of the conversation

## Navigation

### Sidebar Sections
- **Overview**: Readout
- **Monitor**: Live, Sessions, Costs, Setup, Ports (Setup/Ports = stubs)
- **Workspace**: Repos, Work Graph*, Repo Pulse*, Timeline, Diffs*, Snapshots*
- **Config**: Skills, Agents, Memory, Hooks
- **Health**: Hygiene*, Deps*, Worktrees*, Env*, Lint*
- **Settings** (bottom)

*Stub pages showing "Coming Soon" placeholder

### Command Palette (Cmd+K)
- Quick navigation to any page, repo, session, or skill
- Fuzzy search across all dashboard entities

## Pages to Build (V1)

### Full Implementation
1. **Readout** — Main dashboard (screenshot spec above)
2. **Live** — Active Claude sessions panel + real-time activity feed
3. **Sessions** — Session history list with search/filter + session detail with summary + replay
4. **Costs** — Cost breakdown by model, by day, by repo; trend charts
5. **Repos** — Repository list with health status, git stats, skill count
6. **Timeline** — Chronological activity view across all repos
7. **Skills** — Skills inventory with descriptions
8. **Agents** — Agents inventory
9. **Memory** — CLAUDE.md file viewer (read-only)
10. **Hooks** — Hook configuration viewer
11. **Settings** — API key, repo dirs, theme, model selection, cost thresholds, chart prefs, notification settings

### Stub Pages
- Work Graph, Repo Pulse, Diffs, Snapshots, Hygiene, Deps, Worktrees, Env, Lint, Setup, Ports, Extensions (pi-agent — deferred)

## Key Decisions

1. **Local filesystem reads** — No backend API or database, reads directly from ~/.claude/ and git repos
2. **Localhost only** — No auth, no deployment concerns, single-user
3. **SSE for real-time** — Server-Sent Events (simpler than WebSockets, one-way push)
4. **D3.js for charts** — Maximum flexibility, SVG-based, fully interactive
5. **Cache-first data strategy** — Use existing cache files, fall back to raw data parsing
6. **Incremental repo scanning** — Scan progressively, cache results, don't re-scan unchanged
7. **Anthropic-only LLM** — For smart summaries and session summaries, configurable model
8. **Node adapter** — Required for persistent server (SSE, file watching)
9. **Tailwind v4** — CSS-first config with @theme directive, system light/dark preference
10. **Responsive grid** — Adapts to screen sizes, same general structure as screenshot
11. **All separate routes** — Each sidebar item = its own route
12. **Trend indicators** — Stat card dots show up/down vs previous period
13. **Snooze-able alerts** — Alerts can be snoozed for configurable periods
14. **Sub-2-second load** — Use caches and progressive loading to keep initial load fast
15. **Pi-agent extensions** — Deferred to a separate epic
16. **Project name** — TBD (using "claudeitor" as working name)

## Edge Cases

- Empty state: New install with no sessions/repos — show guidance messages
- Missing cache files: Fall back to raw data parsing gracefully
- Large repos: Timeout and skip repos that are slow to scan
- Stale cache: Detect when cache is outdated vs raw data
- Session data format changes: Handle version differences in history.jsonl
- No API key configured: Disable AI summary features, show setup prompt
- Very long sessions: Session replay with thousands of messages — virtualize the list
- Concurrent Claude sessions: Multiple active sessions updating data simultaneously
- Repo path changes: Config lists a directory that no longer exists
- Permission errors: ~/.claude/ files might not be readable

## Open Questions

- Exact session replay data format — need to explore ~/.claude/session data structure more deeply
- "Live" page implementation — how to detect currently running Claude processes
- How does the reference tool compute "hygiene issues"?
- Exact format of session transcripts in history.jsonl for replay
- Pi-agent extension system details (deferred)
- Final project name

## Acceptance

- [ ] SvelteKit + Svelte 5 project scaffolded with Tailwind v4, D3.js, TypeScript strict
- [ ] Readout page matches the screenshot layout with responsive grid
- [ ] Top stat cards show real data from ~/.claude/ with trend indicators
- [ ] Activity (30d) chart renders interactive D3.js bar chart from stats-cache.json
- [ ] When You Work chart shows hourly distribution from git + session data
- [ ] Cost by Model chart shows per-model costs from cost cache + pricing
- [ ] Recent Sessions card shows real sessions with repo links
- [ ] Alert notifications computed from repo scanning (uncommitted files, unpushed commits)
- [ ] Alerts are snooze-able
- [ ] Recently Active shows repos with combined activity scores
- [ ] Bottom cards (Skills, Agents, Memory, Repos) show real data from ~/.claude/
- [ ] SSE endpoint pushes real-time updates to Readout page
- [ ] All 11 full pages implemented with real data
- [ ] All stub pages show "Coming Soon" placeholder
- [ ] Sidebar navigation with all sections and items
- [ ] Command palette (Cmd+K) with fuzzy search
- [ ] Session detail page with metadata + AI summary (cached)
- [ ] Session replay with scrubable timeline
- [ ] Settings page with API key, repo dirs, theme, model, cost thresholds
- [ ] System light/dark theme support
- [ ] Config file (claudeitor.config.json) for repo dirs and settings
- [ ] Vitest unit tests for data layer
- [ ] Empty states with guidance for missing data
- [ ] Sub-2-second initial page load using caches

# fn-1-claudeitor-coding-activity-dashboard.11 Build Live, Repos, and Timeline pages

## Description
Build three related pages: Live (active sessions + activity feed), Repos (repository list with health status and git stats), and Timeline (chronological activity view across all repos). These pages share data from git scanning and session data.

**Size:** M
**Files:** src/routes/live/+page.svelte, src/routes/live/+page.server.ts, src/routes/repos/+page.svelte, src/routes/repos/+page.server.ts, src/routes/timeline/+page.svelte, src/routes/timeline/+page.server.ts, src/lib/data/claude/active-sessions.ts

## Approach
- **Live page**:
  - Active sessions panel: detect running Claude processes (ps aux grep claude) + match to session files by PID/timestamp
  - Activity feed: polling-based for V1 (NOT SSE) - periodic refresh every 30s showing recent events (commits, sessions)
  - SSE is only used on Readout page; Live page uses polling to avoid scope creep
  - If no active sessions: show "No active Claude sessions" with guidance
- **Repos page**:
  - List all discovered repos with: name, branch, last commit, uncommitted files, unpushed commits, skill count
  - Health indicators: green (clean), yellow (uncommitted), red (unpushed + uncommitted)
  - Click repo to expand details or navigate to repo detail
  - Sort by name, last activity, health status
- **Timeline page**:
  - Chronological list of events across all repos
  - Event types: commits, Claude sessions, file changes
  - Filterable by repo, event type, date range
  - Combine git log data + session history into unified timeline
  - Paginated for performance

## Key context
- Live page uses POLLING not SSE (from code review: avoid expanding SSE scope beyond Readout)
- Active session detection is heuristic: combine process detection + recent session file timestamps
- Repo list from scanRepos() (task 3) with split caching strategy
- Timeline merges git commits + session starts into one sorted list
## Approach
- **Live page**: 
  - Active sessions panel: detect running Claude processes (ps aux | grep claude) + match to session files by PID/timestamp
  - Real-time activity feed: stream of recent events (commits, session starts/ends, file changes) via SSE
  - If no active sessions: show "No active Claude sessions" with guidance
- **Repos page**:
  - List all discovered repos with: name, branch, last commit, uncommitted files, unpushed commits, skill count
  - Health indicators: green (clean), yellow (uncommitted), red (unpushed + uncommitted)
  - Click repo to expand details or navigate to repo detail
  - Sort by name, last activity, health status
- **Timeline page**:
  - Chronological list of events across all repos
  - Event types: commits, Claude sessions, file changes
  - Filterable by repo, event type, date range
  - Combine git log data + session history into unified timeline

## Key context
- Active session detection is heuristic: combine process detection + recent session file timestamps
- Repo list from scanRepos() (task 3) — incremental scanning
- Timeline merges git commits + session starts into one sorted list
- Timeline may have many entries — use virtual scrolling or pagination
## Acceptance
- [ ] Live page shows currently active Claude sessions (if any)
- [ ] Live page shows recent activity feed (polling-based, 30s refresh)
- [ ] Live page shows empty state when no active sessions
- [ ] Repos page lists all discovered repositories
- [ ] Repos show: name, branch, last commit, uncommitted/unpushed counts
- [ ] Repos have health indicators (green/yellow/red)
- [ ] Repos list is sortable by name, activity, health
- [ ] Timeline shows chronological events across all repos
- [ ] Timeline events: commits, sessions, filterable by repo and type
- [ ] Timeline supports date range filtering
- [ ] Timeline is paginated for performance
- [ ] All three pages handle empty data gracefully
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

# fn-1-claudeitor-coding-activity-dashboard.9 Build Sessions page with list view, session detail, and replay

## Description
Build the Sessions page with three views: session list (searchable/filterable), session detail (metadata + AI summary), and session replay (scrubable timeline with conversation). This is one of the most feature-rich pages in the dashboard.

**Size:** M
**Files:** src/routes/sessions/+page.svelte, src/routes/sessions/+page.server.ts, src/routes/sessions/[id]/+page.svelte, src/routes/sessions/[id]/+page.server.ts, src/lib/components/sessions/SessionList.svelte, src/lib/components/sessions/SessionDetail.svelte, src/lib/components/sessions/SessionReplay.svelte, src/lib/components/sessions/ReplayTimeline.svelte, src/lib/data/claude/session-detail.ts

## Approach
- Session list: paginated list from history.jsonl with search (filter by display text) and sort (by date)
- Session detail: metadata (duration, model, tokens, cost, files touched) computed from session data
- AI summary: call Anthropic API with session transcript, cache result in project data dir
  - If no API key: show "Configure API key in Settings for AI summaries"
  - Cache path: ~/.claude/projects/encoded-path/claudeitor-cache/summary-sessionId.json
  - API key NEVER exposed to client (server-only via form action or API route)
- **Session replay (MVP for V1)** (from code review):
  - Messages + timestamps rendered chronologically (core feature)
  - Scrubable timeline slider at bottom controls visible conversation range
  - File diffs are BEST-EFFORT: attempt reconstruction from Read/Write/Edit tool results in transcript
  - If diff reconstruction fails for a step, show "File change detected" placeholder
  - Define minimum viable: messages + timestamps first, diffs as enhancement
- Use pagination or virtual scrolling for long sessions

## Key context
- Session JSONL files are at ~/.claude/projects/encoded-path/sessionId.jsonl
- Path encoding replaces / with - and prepends -
- Session files can be 4MB+ - need streaming/chunked reads for large files
- AI summary uses configurable model from claudeitor.config.json llm section
- API key must be server-only: use SvelteKit form actions or server API route, NEVER expose in load() data
- File diff reconstruction is best-effort - do not block replay on failed diff parsing
## Approach
- Session list: paginated list from history.jsonl with search (filter by display text) and sort (by date)
- Session detail: metadata (duration, model, tokens, cost, files touched) computed from session data
- AI summary: call Anthropic API with session transcript, cache result in project data dir
  - If no API key: show "Configure API key in Settings for AI summaries"
  - Cache path: ~/.claude/projects/<project>/claudeitor-cache/summary-<sessionId>.json
- Session replay: parse session JSONL file for full transcript
  - Scrubable timeline at bottom: slider from start to end of session
  - Show conversation messages up to the scrubbed point
  - Show file diffs at each step (reconstruct from Read/Write/Edit tool results)
- Use virtualized list for long sessions (if feasible with Svelte 5)

## Key context
- Session JSONL files are at ~/.claude/projects/<encoded-path>/<sessionId>.jsonl
- Path encoding replaces / with - and prepends -
- Session files can be 4MB+ — need streaming/chunked reads
- AI summary uses configurable model from claudeitor.config.json llm section
- File diffs must be reconstructed from tool call results in the session transcript
## Acceptance
- [ ] Sessions list page shows all sessions from history.jsonl
- [ ] Session list supports text search filtering
- [ ] Session list sorted by date (newest first) with pagination
- [ ] Clicking a session navigates to /sessions/[id] detail page
- [ ] Session detail shows metadata: duration, model, tokens, cost
- [ ] AI summary generated via Anthropic API (server-side only, key never exposed to client)
- [ ] AI summary cached locally in project data dir
- [ ] AI summary shows placeholder when no API key configured
- [ ] Session replay renders conversation messages with timestamps
- [ ] Scrubable timeline slider controls visible conversation range
- [ ] File diffs best-effort: shown when reconstructable, placeholder when not
- [ ] Large sessions (4MB+) load without crashing (streaming/chunked)
- [ ] Empty state shown when no sessions exist
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

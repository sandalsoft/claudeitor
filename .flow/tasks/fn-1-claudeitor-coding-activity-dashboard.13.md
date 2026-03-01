# fn-1-claudeitor-coding-activity-dashboard.13 Build Settings page and Cmd+K command palette

## Description
Build the Settings page (API key, repo dirs, theme, model selection, cost thresholds) and the Cmd+K command palette for quick navigation. Settings persist to claudeitor.config.json. Command palette provides fuzzy search across all dashboard entities.

**Size:** M
**Files:** src/routes/settings/+page.svelte, src/routes/settings/+page.server.ts, src/routes/api/settings/+server.ts, src/lib/components/layout/CommandPalette.svelte, src/lib/utils/fuzzy-search.ts

## Approach
- **Settings page**:
  - Sections: General (repo dirs, Claude dir), API (API key, model selection), Alerts (cost threshold, snooze defaults), Display (theme override), About
  - API key: password input, validated against Anthropic API on save
  - API key is server-only: POST endpoint reads/writes config, response returns hasApiKey boolean NEVER the key itself
  - Repo dirs: editable list with add/remove, tilde expansion preview
  - Model selection: dropdown of available models from pricing data
  - Cost threshold: numeric input for alert trigger
  - Save settings: POST to /api/settings which writes claudeitor.config.json atomically (write temp file, rename)
- **Command palette**:
  - Trigger: Cmd+K (Meta+K) keyboard shortcut
  - Fuzzy search across: pages (routes), repos, sessions, skills, agents
  - Use Bits UI Command component (replaces deprecated cmdk-sv)
  - Items: icon + label + category, keyboard navigable
  - Select item -> navigate to that route

## Key context
- Bits UI Command component: install bits-ui, use Command.Root, Command.Input, Command.List, Command.Item
- API key NEVER exposed via client-side code: server returns { hasApiKey: boolean } not the actual key
- Settings POST endpoint validates and writes config atomically (write temp file, rename)
- Command palette should register Cmd+K listener in +layout.svelte
- Fuzzy search: simple substring/score match, no external library needed
## Approach
- **Settings page**:
  - Sections: General (repo dirs, Claude dir), API (API key, model selection), Alerts (cost threshold, snooze defaults), Display (theme override, chart preferences), About
  - API key: password input, validated against Anthropic API on save
  - Repo dirs: editable list with add/remove, tilde expansion preview
  - Model selection: dropdown of available models from pricing data
  - Cost threshold: numeric input for alert trigger
  - Save settings: POST to /api/settings which writes claudeitor.config.json
- **Command palette**:
  - Trigger: Cmd+K (Meta+K) keyboard shortcut
  - Fuzzy search across: pages (routes), repos, sessions, skills, agents
  - Use Bits UI Command component (replaces deprecated cmdk-sv)
  - Items: icon + label + category, keyboard navigable
  - Select item → navigate to that route

## Key context
- Bits UI Command component: install bits-ui, use Command.Root, Command.Input, Command.List, Command.Item
- API key stored in config file — DO NOT expose via client-side code (server-only)
- Settings POST endpoint validates and writes config atomically (write temp file, rename)
- Command palette should register Cmd+K listener in +layout.svelte
- Fuzzy search: simple substring/score match, no external library needed
## Acceptance
- [ ] Settings page renders all configuration sections
- [ ] API key input with save and validation (server-side validation)
- [ ] API key NEVER returned to client: server only returns hasApiKey boolean
- [ ] Repo dirs editable list (add, remove, reorder)
- [ ] Model selection dropdown from available models
- [ ] Cost threshold configurable
- [ ] Theme override option (system/light/dark)
- [ ] Save persists to claudeitor.config.json via API endpoint
- [ ] Config write is atomic (temp file + rename)
- [ ] Cmd+K opens command palette from any page
- [ ] Command palette fuzzy searches pages, repos, sessions, skills
- [ ] Command palette keyboard navigable (arrow keys, enter to select)
- [ ] Selected item navigates to correct route
## Done summary
Built Settings page with all configuration sections (General, API, Alerts, Display, About) and Cmd+K command palette using Bits UI Command + Dialog components. Settings persist atomically to claudeitor.config.json via POST /api/settings; API key is server-only (never returned to client). Command palette provides fuzzy search across all navigation pages with keyboard navigation.
## Evidence
- Commits: d4a110717875470ddebc704b7c232520be9331bc
- Tests: pnpm check, pnpm test, pnpm build
- PRs:
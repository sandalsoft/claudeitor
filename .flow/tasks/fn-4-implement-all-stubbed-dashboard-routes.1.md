# fn-4-implement-all-stubbed-dashboard-routes.1 Config & Extensions routes (/setup, /extensions)

## Description
Implement the /setup and /extensions routes.

**Size:** M
**Files:**
- `src/routes/setup/+page.server.ts` (NEW)
- `src/routes/setup/+page.svelte` (REWRITE)
- `src/routes/extensions/+page.server.ts` (NEW)
- `src/routes/extensions/+page.svelte` (REWRITE)
- `src/lib/data/types.ts` (MODIFY — add SetupCheck, ExtensionItem types)

## Approach

**`/setup`** — Project configuration health check:
- All path checks MUST use `config.claudeDir` (not hardcoded `~/.claude/`).
- Checklist items:
  - `claude` CLI: `execFile('which', ['claude'])` with 2s timeout, try/catch
  - Claude dir: `stat(config.claudeDir)`
  - Config file: THREE-state: (1) `stat(configFilePath)`, (2) if exists, `readFile` + `JSON.parse`. Report: "missing" / "present but malformed" / "valid"
  - repoDirs: from readConfig(), check `repoDirs.length > 0`
  - API key: `hasApiKey` boolean
  - CLAUDE.md: `stat(join(config.claudeDir, 'CLAUDE.md'))` and `stat(join(cwd, 'CLAUDE.md'))`
  - Skills: `readSkills(config.claudeDir)` → count > 0
  - Hooks: `readSettings(config.claudeDir)` → derive count. `SettingsData.hooks` is `Record<string, HookMatcher[]>`. Aggregate: `Object.values(hooks).reduce((sum, arr) => sum + arr.length, 0)`. Return count only, never hook commands.
- Display: checklist with green/yellow/red indicators.

**`/extensions`** — Aggregated view:
- **NEVER return raw settings to client.** Return only: skillCount, agentCount, pluginList (safe metadata), mcpServerCount, hookCount.
- Plugins: merge `installed_plugins.json` with `enabledPlugins` (`Record<string, boolean>`):
  ```
  enabledIds = Object.entries(enabledPlugins).filter(([,v])=>v).map(([k])=>k)
  ```
  Preserve explicit `false` as "installed but disabled".
- MCP servers: read raw settings.json, extract `Object.keys(mcpServers || {}).length`. Return count + names only.
- Hooks: return count only (aggregated from `Record<string, HookMatcher[]>`). Never return hook commands.
- Display: sectioned view with counts.

## Key context

- `config.claudeDir` may differ from `~/.claude/` — use config value everywhere
- `SettingsData.hooks` is `Record<string, HookMatcher[]>` not a simple array — aggregate to count
- `SettingsData.enabledPlugins` is `Record<string, boolean>` not a list
- `SettingsData.env` is `Record<string, string>` — SECRET, never return

## Acceptance
- [ ] /setup uses config.claudeDir for all path checks (no hardcoded ~/.claude/)
- [ ] /setup distinguishes missing vs malformed vs valid config file
- [ ] /setup returns only safe data (counts, booleans, status strings)
- [ ] /extensions correctly handles hooks as Record<string, HookMatcher[]> (returns count only)
- [ ] /extensions correctly handles enabledPlugins as Record<string, boolean>
- [ ] /extensions NEVER returns settings.env, hooks commands, or raw config
- [ ] All new types in `src/lib/data/types.ts`
- [ ] Both routes use `withSpan()` instrumentation
- [ ] `pnpm check` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

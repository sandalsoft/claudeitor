# fn-1-claudeitor-coding-activity-dashboard.2 Build data layer: types, Claude data readers, and model ID mapping

## Description
Build the core data layer that reads and parses all Claude Code data from ~/.claude/. This includes TypeScript type definitions for all data sources, reader functions for each cache/config file, and a robust model ID mapping layer that converts between full model IDs and pricing short names.

**Size:** M
**Files:** src/lib/data/types.ts, src/lib/server/claude/stats.ts, src/lib/server/claude/costs.ts, src/lib/server/claude/sessions.ts, src/lib/server/claude/skills.ts, src/lib/server/claude/agents.ts, src/lib/server/claude/settings.ts, src/lib/server/claude/model-mapping.ts

## Approach
- Define TypeScript interfaces matching discovered schemas:
  - StatsCache: { version, lastComputedDate, dailyActivity[], dailyModelTokens, modelUsage, totalSessions, totalMessages, longestSession, firstSessionDate, hourCounts, totalSpeculationTimeSavedMs }
  - CostCache: { days: Record<string, Record<string, TokenUsage>>, version, lastFullScan }
  - PricingData: { updated, source, models: Record<string, ModelPricing> }
  - SessionEntry: { display, pastedContents, timestamp, project, sessionId? }
- **Robust model ID mapping** (multi-strategy):
  1. Exact match against PricingData.models keys
  2. Regex extraction: strip "claude-" prefix, drop date suffix (-YYYYMMDD), compare
  3. Normalization: tokenize remaining parts, match against available pricing keys by token overlap
  4. Fallback: use raw ID as-is (log warning, cost will be unknown)
  - Handle edge cases: "claude-3-5-sonnet-20241022" → "sonnet-3-5", "claude-opus-4-5-20251101" → "opus-4-5"
- Use fs.readFile with JSON.parse wrapped in try/catch for all readers
- Parse history.jsonl line-by-line (split on newline, JSON.parse each, skip empty/malformed lines)
- Read skills/ and agents/ directories with fs.readdir
- Read settings.json for hooks, plugins, model preference

## Key context
- Model ID mapping is critical for correct cost calculations — must handle ALL known Anthropic model ID formats
- Model IDs vary: "claude-3-5-sonnet-20241022", "claude-opus-4-5-20251101", "claude-haiku-4-5-20251001" etc.
- Pricing keys vary: "sonnet-3-5", "opus-4-5", "haiku-4-5" etc.
- history.jsonl is JSONL format (one JSON object per line), ~235KB
- skills/ contains 50+ directories, some are symlinks
- All readers must handle missing files gracefully (return empty/default data)
## Approach
- Define TypeScript interfaces matching discovered schemas:
  - StatsCache: { version, lastComputedDate, dailyActivity[], dailyModelTokens, modelUsage, totalSessions, totalMessages, longestSession, firstSessionDate, hourCounts, totalSpeculationTimeSavedMs }
  - CostCache: { days: Record<string, Record<string, TokenUsage>>, version, lastFullScan }
  - PricingData: { updated, source, models: Record<string, ModelPricing> }
  - SessionEntry: { display, pastedContents, timestamp, project, sessionId? }
- Build model ID mapping: regex pattern to extract short name from full ID (e.g., "claude-opus-4-5-20251101" -> "opus-4-5")
- Use fs.readFile with JSON.parse wrapped in try/catch for all readers
- Parse history.jsonl line-by-line (split on newline, JSON.parse each)
- Read skills/ and agents/ directories with fs.readdir
- Read settings.json for hooks, plugins, model preference

## Key context
- Model IDs in stats-cache use full format: "claude-opus-4-5-20251101"
- Model IDs in readout-pricing use short format: "opus-4-5"
- history.jsonl is JSONL format (one JSON object per line), ~235KB
- skills/ contains 50+ directories, some are symlinks
- agents/ contains markdown files
- All readers must handle missing files gracefully (return empty/default data)
## Acceptance
- [x] TypeScript interfaces defined for all data sources (StatsCache, CostCache, PricingData, SessionEntry, SkillInfo, AgentInfo, SettingsData)
- [x] readStatsCache() reads and parses ~/.claude/stats-cache.json
- [x] readCostCache() reads and parses ~/.claude/readout-cost-cache.json
- [x] readPricing() reads and parses ~/.claude/readout-pricing.json
- [x] readSessionHistory() parses ~/.claude/history.jsonl into SessionEntry[]
- [x] readSkills() lists skill directories from ~/.claude/skills/
- [x] readAgents() lists and reads agent files from ~/.claude/agents/
- [x] readSettings() reads ~/.claude/settings.json
- [x] mapModelId() uses multi-strategy mapping: exact match → regex extraction → normalization → fallback
- [x] mapModelId() correctly handles known edge cases (claude-3-5-sonnet, claude-opus-4-5, etc.)
- [x] mapModelId() logs warning and returns raw ID for unknown models
- [x] All readers return typed defaults when files are missing (no throws)
- [x] All readers handle malformed JSON gracefully (try/catch, log warning)
## Done summary
Built complete TypeScript data layer for reading ~/.claude/ data sources. Types in src/lib/data/types.ts (shared), 7 server-only reader modules in src/lib/server/claude/ (SvelteKit server boundary enforced). Multi-strategy model ID mapper with strict family+version matching prevents cross-version mismatches. All readers accept claudeDir parameter for testability. 29 fixture-based vitest tests pass (13 model-mapping + 16 reader tests using temp directories).
## Evidence
- Commits: cd77583, 7dcdcfa
- Tests: 29 passing (13 model-mapping + 16 reader fixture tests)
- PRs:
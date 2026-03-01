## Description

Add OTel spans to all 13 server load functions (12 pages + 1 layout) and 14 library-level server operations in Claudeitor, using the tracer and `withSpan` helper from task 1. V1 scope covers load functions and library operations only — API route handlers, form actions, SSE endpoint, and watcher are V2.

**Size:** M
**Files:**
- `src/routes/+layout.server.ts` — Wrap load() with span
- `src/routes/+page.server.ts` — Wrap load() with span (readout page, calls 9 readers)
- `src/routes/sessions/+page.server.ts` — Wrap load()
- `src/routes/sessions/[id]/+page.server.ts` — Wrap load() ONLY (do NOT wrap `actions.summarize`)
- `src/routes/costs/+page.server.ts` — Wrap load()
- `src/routes/repos/+page.server.ts` — Wrap load()
- `src/routes/timeline/+page.server.ts` — Wrap load()
- `src/routes/live/+page.server.ts` — Wrap load()
- `src/routes/skills/+page.server.ts` — Wrap load()
- `src/routes/agents/+page.server.ts` — Wrap load()
- `src/routes/memory/+page.server.ts` — Wrap load()
- `src/routes/hooks/+page.server.ts` — Wrap load()
- `src/routes/settings/+page.server.ts` — Wrap load()
- `src/lib/server/claude/stats.ts` — Wrap readStatsCache()
- `src/lib/server/claude/costs.ts` — Wrap readCostCache(), readPricing()
- `src/lib/server/claude/sessions.ts` — Wrap readSessionHistory()
- `src/lib/server/claude/settings.ts` — Wrap readSettings()
- `src/lib/server/claude/skills.ts` — Wrap readSkills()
- `src/lib/server/claude/agents.ts` — Wrap readAgents()
- `src/lib/server/claude/memory.ts` — Wrap readMemoryFiles()
- `src/lib/server/claude/model-mapping.ts` — Wrap mapModelId()
- `src/lib/server/claude/cost-calculator.ts` — Wrap calculateCosts()
- `src/lib/server/claude/active-sessions.ts` — Wrap detectActiveSessions()
- `src/lib/server/claude/session-detail.ts` — Wrap readSessionDetail()
- `src/lib/server/config.ts` — Wrap readConfig()
- `src/lib/server/git/scanner.ts` — Wrap scanRepos()

## Approach

- Use the `withSpan(name, attrs, fn)` helper from task 1 that calls `tracer.startActiveSpan()`
- Load functions get span name pattern: `load:<route>` (e.g., `load:readout`, `load:sessions`)
- Library operations get span name pattern: `op:<function>` (e.g., `op:readStatsCache`, `op:mapModelId`)
- All spans include `code.filepath` (required). `code.lineno` only on load functions where practical; non-acceptance-critical.
- Load function spans include `http.route` attribute
- I/O operations (file readers, git scanner) include `data.source` attribute (e.g., `data.source: 'stats-cache.json'`)
- Compute operations (mapModelId, calculateCosts) include `op.type: 'compute'` instead of `data.source`
- Load function spans wrap the entire function body (parent spans)
- Library operation spans become child spans when called from within load functions (via AsyncLocalStorage context propagation)
- On error: `withSpan` sets span status to ERROR(2), calls `span.recordException(err)` which populates `events` array with exception details
- Operation spans preserve the optional `claudeDir` parameter signature
- Wrap ONLY `export const load` — do NOT wrap form actions or API handlers in files that have both

## Key context

- All data readers accept optional `claudeDir` param — span instrumentation must preserve this signature
- Data readers use factory functions for defaults — wrap the function, don't modify the factory pattern
- `tracer.startActiveSpan()` uses callback style — nested calls automatically become child spans via AsyncLocalStorage context propagation
- V1 scope: load functions + 14 library operations ONLY. Do NOT instrument: SSE endpoint, settings API handler, form actions (summarize), watcher
- There are exactly 12 page load functions + 1 layout load = 13 total
- The 14 library operations: readStatsCache, readCostCache, readPricing, readSessionHistory, readSettings, readSkills, readAgents, readMemoryFiles, mapModelId, calculateCosts, detectActiveSessions, readSessionDetail, readConfig, scanRepos

## Acceptance

- [ ] All 13 server load functions wrapped with OTel spans (12 pages + 1 layout, `load:<route>` naming)
- [ ] All 14 library-level server operations wrapped with OTel spans (`op:<function>` naming)
- [ ] Spans include `code.filepath` attribute (required on all spans)
- [ ] Load function spans include `http.route` attribute
- [ ] I/O operation spans include `data.source` attribute
- [ ] Compute operation spans include `op.type: 'compute'` attribute
- [ ] Error cases: span status set to ERROR(2), `span.recordException(err)` called, exception details in events array
- [ ] Nested calls (load → operation) produce proper parent-child span hierarchy across `await`
- [ ] Library operation function signatures unchanged (claudeDir param preserved)
- [ ] Form actions and API handlers NOT instrumented (V2 scope)
- [ ] JSONL file shows trace hierarchy when app is running
- [ ] pnpm check passes with 0 errors
- [ ] Existing 97 tests continue passing

## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

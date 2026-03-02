# Dependency Analysis: 12 Dashboard Stub Routes

## Quick Answer

**Q: What dependencies does the new 12-route plan have?**

A: **Only fn-1.** Hard dependency on data readers, UI components, and TypeScript types from the Claudeitor epic.

---

## Dependencies

| Epic | Dependency Type | Status | Blocking? | Notes |
|------|-----------------|--------|-----------|-------|
| **fn-1-claudeitor-coding-activity-dashboard** | HARD | Open | No | Core data readers, UI components, types. Required for real data. |
| **fn-2-svelte-sentinel-self-healing-agent** | SOFT | Open | No | Structured logging. Fallback to console acceptable. |
| **fn-3-live-session-flight-deck** | NONE | Open | No | Independent feature. Only touches `/live` route. |

---

## What fn-1 Provides (Required)

**Data Readers** (12 server-only modules in src/lib/server/claude/):
```
active-sessions.ts      → detectActiveSessions()
agents.ts               → readAgents()
cost-calculator.ts      → calculateSessionCost()
costs.ts                → readCosts()
memory.ts               → readMemory()
model-mapping.ts        → mapModelId(), getModelPricing()
readers.ts              → readStats(), readSessionHistory()
session-detail.ts       → findSessionFile(), readSessionDetail()
session-tailer.ts       → createSessionTailer()
settings.ts             → readSettings()
skills.ts               → readSkills()
stats.ts                → readStats()
```

**UI Components** (src/lib/components/):
- `ui/ComingSoon.svelte` (already used by stubs)
- `cards/*` (ActivityCard, CostCard, etc.)
- `charts/*` (D3 utilities)
- `layout/Header.svelte`, `Sidebar.svelte`
- `ui/*` (Badge, Icon, Button)

**TypeScript Types** (src/lib/data/types.ts):
- `Session`, `Model`, `Cost`, `Settings`, `Agent`, `Skill`, `Memory`, `Hook`, `Environment`, `Config`

**Patterns**:
- Server load functions + client components
- Cache-first data loading
- Graceful error handling with fallback UI
- Chokidar singleton watcher

---

## File Overlaps

| Scope | fn-1 | fn-2 | fn-3 | fn-4 (new) | Conflict? |
|-------|------|------|------|-----------|-----------|
| Routes | 11 full pages | None | `/live` | 12 stub pages | No |
| Data readers | All 12 | None | Uses existing | Calls existing | No |
| Components | shared lib | None | `/live` components | Reuses shared | No |
| Telemetry | None | logger, OTel | None | Uses logger if available | No |

**Merge risk: LOW.** Each epic touches different files. Only coordination point: logger import order if fn-2 merges simultaneously.

---

## What Routes Need to Do

1. Replace `ComingSoon` component with real load function + UI
2. Call data readers from `src/lib/server/claude/`
3. Return data from load function to component
4. Render with fallback empty states
5. Reuse existing UI components (cards, charts, layout)
6. Use Svelte 5 runes ($state, $derived, $effect)
7. Graceful error handling with `warn()` logger

**Time estimate**: 30-60 min per route (6-12 hours total for all 12)

---

## Routes Breakdown

**Group 1: Config & Environment** (3 routes)
- `/setup` - Project scaffolding, CLAUDE.md initialization
- `/ports` - Network binding, localhost verification
- `/env` - Environment variables, PATH inspection

**Group 2: Project Analysis** (4 routes)
- `/work-graph` - Dependency graph, code structure visualization
- `/repo-pulse` - Git repo health, commit frequency
- `/diffs` - File changes, working tree diffs
- `/snapshots` - Project state snapshots over time

**Group 3: Quality & Extensions** (5 routes)
- `/hygiene` - Code quality metrics, warnings
- `/deps` - Dependency audits, version checks
- `/worktrees` - Git worktrees, branch tracking
- `/lint` - Linter reports, ESLint/Prettier integration
- `/extensions` - VS Code extensions, Claude Code plugins

---

## Recommended Epic Structure (fn-4)

```json
{
  "id": "fn-4-stub-routes-implementation",
  "title": "Implement 12 Dashboard Stub Routes",
  "depends_on_epics": ["fn-1-claudeitor-coding-activity-dashboard"],
  "status": "open"
}
```

**Why this structure?**
- Hard dep on fn-1: Readers + types must exist
- No dep on fn-2, fn-3: Can run in parallel
- Critical path: fn-1 readers working → fn-4 can begin

---

## Task Structure Options

**Option A: 12 tasks (1 per route)**
```
fn-4.1 - /setup
fn-4.2 - /ports
fn-4.3 - /env
... (9 more)
```
- Pros: Fine granularity, easier to parallelize
- Cons: More overhead to manage

**Option B: 3 grouped tasks**
```
fn-4.1 - Config & Environment (setup, ports, env)
fn-4.2 - Project Analysis (work-graph, repo-pulse, diffs, snapshots)
fn-4.3 - Quality & Extensions (hygiene, deps, worktrees, lint, extensions)
```
- Pros: Fewer tasks, logical grouping
- Cons: Less granular progress tracking

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Model ID mapping breaks | Reuse `mapModelId()` + `getModelPricing()` from fn-1 |
| Data reader performance | Readers already cache-first; new routes inherit pattern |
| Missing data in dev | Readers gracefully return empty, log warnings |
| Component naming conflicts | All in `src/lib/components/`, no collisions |
| Type definition changes | Centralized in fn-1 `types.ts`; coordinate before changes |
| Stale stub descriptions | Update `ComingSoon.svelte` text during implementation |
| Logger not available (fn-2 incomplete) | Graceful fallback to console.warn/error |

---

## Critical Path

1. **fn-1 readers stable** (stats.ts, costs.ts, model-mapping.ts, etc.)
2. **fn-1 types finalized** (Session, Cost, Settings, etc. in src/lib/data/types.ts)
3. **fn-4 can begin** (call readers, render data, iterate)

fn-4 can start in parallel with fn-2 and fn-3 (no blocking relationships).

---

## No Blocking Issues

- All infrastructure exists (routes created, components available)
- No file conflicts with other epics
- No reverse dependencies (no epic needs stub routes output)
- Can coordinate logger imports with fn-2 if needed
- Low merge risk

---

## Reference Documents

See `.flow/` directory:

1. **epic-dependencies-stub-routes.md**
   - Detailed dependency analysis
   - All data readers, components, types listed
   - Task-level overlap check
   - Recommended dependency chain

2. **stub-routes-implementation-patterns.md**
   - Load function template
   - Component template
   - Error handling examples
   - Testing patterns
   - Tailwind v4 patterns
   - Implementation checklist

---

## Next Steps

1. Review this summary with team
2. Confirm dependency structure (fn-1 only)
3. Create fn-4 epic with dependency set
4. Group routes into tasks (12 vs 3 groups)
5. Start with Group 1 or simplest route (`/env`)
6. Test with `pnpm dev` on localhost:5173
7. Verify `pnpm check && pnpm test` pass
8. Iterate for remaining routes

---

## Summary

**Single hard dependency: fn-1-claudeitor-coding-activity-dashboard**

No blocking issues. All infrastructure exists. Low merge risk. Can begin as soon as fn-1 readers are stable. Recommend fn-4 epic with 12 tasks (1 per route) running in parallel with fn-2 and fn-3.

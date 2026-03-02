# Epic Dependencies: Dashboard Stub Routes (12 Routes)

## Request
Implement real functionality for 12 stubbed dashboard routes: `/setup`, `/ports`, `/work-graph`, `/repo-pulse`, `/diffs`, `/snapshots`, `/hygiene`, `/deps`, `/worktrees`, `/env`, `/lint`, `/extensions`

## Dependencies

### CRITICAL: fn-1-claudeitor-coding-activity-dashboard (OPEN)
**Type**: Hard dependency - new plan is Phase 2

**What fn-1 provides that routes need**:

1. **Data readers** (src/lib/server/claude/):
   - `active-sessions.ts` → `detectActiveSessions()`
   - `model-mapping.ts` → `mapModelId()`, `getModelPricing()`
   - `cost-calculator.ts` → Cost calculations
   - `readers.ts` → Generic JSONL/cache parsing
   - `session-detail.ts` → Session file location, parsing
   - `agents.ts`, `skills.ts`, `memory.ts` → Config readers
   - `settings.ts` → Settings reader

2. **Shared UI Components** (src/lib/components/):
   - `ui/ComingSoon.svelte` (already used by all 12 stubs)
   - `cards/*` → Reusable card patterns
   - `charts/*` → D3 utilities
   - `layout/Header.svelte`, `Sidebar.svelte` → Page structure

3. **Shared types** (src/lib/data/types.ts):
   - `Session`, `Model`, `Cost`, `Settings`, `Agent`, `Skill`, `Memory`, `Hook`, `Environment`, `Config`

4. **Key patterns**:
   - Server-side load functions; client-side rendering
   - Model mapping with multi-strategy fallback
   - Cache-first: `stats-cache.json` before full JSONL parse
   - Graceful degradation on missing data

**Blocking?** No. Routes can be stubbed while fn-1 readers stabilize, then integrated.

---

### MEDIUM: fn-2-svelte-sentinel-self-healing-agent (OPEN, depends on fn-1)
**Type**: Soft dependency - structured logging

**What fn-2 adds**:
- `src/lib/server/telemetry/logger.ts` with `warn()`, `log()`, `error()`
- OTel JSONL span export to `.claudeitor/telemetry.jsonl`

**Usage in new routes**: Import and use logger for validation warnings (malformed data, missing config). Fallback to `console.*` if unavailable.

**Blocking?** No. Routes functional without fn-2; better observability with it.

---

### NONE: fn-3-live-session-flight-deck (OPEN)
**Type**: No dependency

fn-3 only enhances `/live` route. No interaction with the 12 stub routes.

---

## Overlaps & Conflicts

### File overlaps: NONE
- 12 new routes under `src/routes/*/+page.svelte` (unique)
- fn-1 owns `/readout`, `/live`, `/costs`, `/repos`, `/timeline`, `/sessions`, `/skills`, `/agents`, `/memory`, `/hooks`, `/settings`
- fn-2 touches `src/lib/server/telemetry/` only
- fn-3 touches `/live` only

### Component reuse: YES (intentional)
All routes will reuse `ComingSoon`, layout components, UI library. No conflict.

### Data reader calls: YES (intentional)
All routes will call shared readers. These are stateless, thread-safe functions. No conflict.

### Merge risk: LOW
Coordinate with fn-2 on telemetry import order if merging simultaneously. Otherwise isolated.

---

## Key Files & APIs Routes Will Depend On

**Data Sources** (src/lib/server/claude/):
```
active-sessions.ts      detectActiveSessions()
agents.ts               readAgents()
cost-calculator.ts      calculateSessionCost()
memory.ts               readMemory()
model-mapping.ts        mapModelId(), getModelPricing()
readers.ts              readStats(), readSessionHistory()
session-detail.ts       findSessionFile(), readSessionDetail()
settings.ts             readSettings()
skills.ts               readSkills()
```

**UI Components** (src/lib/components/):
```
ui/ComingSoon.svelte
ui/* (Badge, Icon, Button, etc.)
cards/*
charts/*
layout/*
```

**Shared Types** (src/lib/data/types.ts):
```
Session, Model, Cost, Settings, Agent, Skill, Memory, Hook, Environment, Config
```

---

## Recommended Dependency Chain for New Epic (fn-4)

**Proposed: fn-4-stub-routes-implementation**

```json
{
  "id": "fn-4-stub-routes-implementation",
  "title": "Implement 12 Dashboard Stub Routes",
  "depends_on_epics": ["fn-1-claudeitor-coding-activity-dashboard"],
  "status": "open"
}
```

### Why this structure?
- **Hard dependency on fn-1**: Core readers, types, components must be stable
- **Soft dependency on fn-2**: Use logger if available, fallback acceptable
- **No dependency on fn-3**: Independent feature

### Critical path:
1. fn-1 readers working and types stable → fn-4 can begin
2. fn-4 can proceed in parallel with fn-2 and fn-3 (no blocking)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Model ID mapping breaks | Reuse `mapModelId()` + `getModelPricing()` from fn-1 |
| Data reader performance | Readers already use cache-first; new routes inherit pattern |
| Missing data in dev | Readers gracefully return empty, log warnings |
| Component naming conflicts | All in shared `src/lib/components/`, no collisions |
| Type definition changes | Centralized in fn-1; coordinate before type changes |
| Stale stub descriptions | Update `ComingSoon.svelte` text during impl |

---

## Conclusion

**Clear dependency: fn-1 only**

No blocking issues. New plan can begin once fn-1 readers stabilize. All infrastructure (routes, components, patterns) exists. No file conflicts with other epics.

Recommended task grouping for fn-4:
- Group 1: Config & setup (/setup, /ports, /env) → 3 tasks
- Group 2: Project analysis (/work-graph, /repo-pulse, /diffs, /snapshots) → 4 tasks
- Group 3: Quality & extensions (/hygiene, /deps, /worktrees, /lint, /extensions) → 5 tasks

Or 12 tasks (1 per route) for finer granularity.

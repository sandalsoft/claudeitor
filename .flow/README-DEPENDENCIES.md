# Dashboard Stub Routes: Epic Dependencies Analysis

This directory contains three related documents analyzing dependencies for implementing 12 stubbed dashboard routes.

## Quick Start

**Start here**: Read `DEPENDENCIES-SUMMARY.md` (5 min)
- Dependency matrix
- What fn-1 provides
- Risk mitigation
- Next steps

## Full Analysis

**Comprehensive analysis**: `epic-dependencies-stub-routes.md` (10 min)
- Detailed dependency information for each epic
- File overlaps and conflict check
- Complete API list of data readers
- Task-level overlap with existing epics
- Recommended epic structure (fn-4)

## Implementation Guide

**Code patterns**: `stub-routes-implementation-patterns.md` (15 min reference)
- Load function template
- Component template with Svelte 5 runes
- Error handling patterns
- Testing patterns (Vitest)
- Tailwind v4 patterns
- Per-route implementation checklist

---

## Key Finding

**Single hard dependency: fn-1-claudeitor-coding-activity-dashboard**

Routes require:
- Data readers: 12 modules in `src/lib/server/claude/`
- UI components: ComingSoon, cards, charts, layout from `src/lib/components/`
- TypeScript types: Session, Model, Cost, Settings, etc. from `src/lib/data/types.ts`

No blocking issues. Can begin as soon as fn-1 readers stabilize.

---

## Dependency Structure

```
fn-1 (Claudeitor Dashboard) ──────┐
                                   ├─→ fn-4 (Stub Routes) [NEW]
fn-2 (svelte-sentinel) ──(soft)──┘

fn-3 (Live Flight Deck) ──(independent)
```

- fn-1: Hard dependency (core infrastructure)
- fn-2: Soft dependency (structured logging, fallback to console)
- fn-3: No dependency (independent feature)

---

## Recommended Approach

1. **Create fn-4 epic** with depends_on_epics: ["fn-1"]
2. **Task structure**: 12 tasks (1 per route) or 3 groups
   - Group 1: /setup, /ports, /env (config)
   - Group 2: /work-graph, /repo-pulse, /diffs, /snapshots (analysis)
   - Group 3: /hygiene, /deps, /worktrees, /lint, /extensions (quality)
3. **Timeline**: 30-60 min per route (6-12 hours total)
4. **Parallel**: Can run alongside fn-2 and fn-3 (no conflicts)

---

## Critical Path

1. fn-1 readers stable ✓
2. fn-1 types finalized ✓
3. fn-4 can begin ←

---

## Files Referenced

All routes use readers from:
- `src/lib/server/claude/active-sessions.ts`
- `src/lib/server/claude/model-mapping.ts`
- `src/lib/server/claude/cost-calculator.ts`
- `src/lib/server/claude/readers.ts`
- `src/lib/server/claude/session-detail.ts`
- `src/lib/server/claude/agents.ts`
- `src/lib/server/claude/skills.ts`
- `src/lib/server/claude/memory.ts`
- `src/lib/server/claude/settings.ts`
- (and 3 more)

All routes use components from:
- `src/lib/components/ui/`
- `src/lib/components/cards/`
- `src/lib/components/charts/`
- `src/lib/components/layout/`

All routes use types from:
- `src/lib/data/types.ts`

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Model ID mapping breaks | Reuse existing functions from fn-1 |
| Data reader performance | Already cache-first; routes inherit pattern |
| Missing data in dev | Readers gracefully return empty |
| Component conflicts | All in `src/lib/components/`; no collisions |
| Type changes in fn-1 | Centralized; coordinate before changes |

---

## Conclusion

No blocking issues. All infrastructure exists. Routes can be implemented in parallel with fn-2 and fn-3. Recommend creating fn-4 epic with hard dependency on fn-1 only.

---

## Document Locations

- `.flow/DEPENDENCIES-SUMMARY.md` - Quick reference (5 min)
- `.flow/epic-dependencies-stub-routes.md` - Detailed analysis (10 min)
- `.flow/stub-routes-implementation-patterns.md` - Code patterns (15 min reference)
- `.flow/README-DEPENDENCIES.md` - This file

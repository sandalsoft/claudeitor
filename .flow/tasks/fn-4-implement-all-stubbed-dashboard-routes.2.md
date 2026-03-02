# fn-4-implement-all-stubbed-dashboard-routes.2 Environment & Ports routes (/env, /ports)

## Description
Implement the /env and /ports routes.

**Size:** M
**Files:**
- `src/lib/server/env/reader.ts` (NEW)
- `src/routes/env/+page.server.ts` (NEW)
- `src/routes/env/+page.svelte` (REWRITE)
- `src/lib/server/system/ports.ts` (NEW)
- `src/routes/ports/+page.server.ts` (NEW)
- `src/routes/ports/+page.svelte` (REWRITE)
- `src/lib/data/types.ts` (MODIFY — add EnvVariable, PortInfo types)

## Approach

**`/env`** — same as v4 (no changes needed for round 4 issues).

**`/ports`** — Active network port monitor:
- New reader:
  - `execLsof(): Promise<string>` — `execFile('lsof', ['-i', '-P', '-n'])`
  - `parseLsofOutput(stdout: string): PortInfo[]` — parse `(LISTEN)` from NAME field. Dedup by PID+port (IPv4/IPv6).
- **Cache with bypass**: 30s server-side cache. Refresh button navigates to `?refresh=1` which forces cache skip. Server load checks `url.searchParams.get('refresh')` to bypass cache.
- Platform check: `process.platform === 'darwin'`.

## Key context

- lsof `(LISTEN)` appears at end of NAME field, not as column
- Dedup IPv4+IPv6 entries before conflict detection
- `?refresh=1` query param bypasses 30s cache
- All new types in `src/lib/data/types.ts`

## Acceptance
- [ ] /env uses scanRepos(), matches broad key patterns, never sends values
- [ ] /ports uses execFile with array args
- [ ] /ports correctly parses `(LISTEN)` from NAME field
- [ ] /ports deduplicates IPv4+IPv6 by PID+port
- [ ] /ports 30s cache bypassed via `?refresh=1` query param
- [ ] Both readers separate exec from parse; unit tests use fixtures
- [ ] All new types in `src/lib/data/types.ts`
- [ ] Both routes use `withSpan()` instrumentation
- [ ] `pnpm check` passes
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

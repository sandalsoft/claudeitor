# fn-4-implement-all-stubbed-dashboard-routes.7 Cleanup: remove stub flags, update README, final tests

## Description
Remove all `stub: true` flags from navigation, update README.md with new route descriptions, and run final quality checks across the entire epic.

**Size:** S
**Files:**
- `src/lib/stores/navigation.svelte.ts` (MODIFY)
- `README.md` (MODIFY)

## Approach

- Remove `stub: true` from all 12 entries in `navSections` array in `src/lib/stores/navigation.svelte.ts`
- Update README.md "What You Get" section to include descriptions for all 12 new routes
- Update README.md architecture/routes section if it lists route directories
- Run `pnpm check` and `pnpm test` to verify everything passes end-to-end
- Verify no `ComingSoon` imports remain in any route page files

## Key context

- Navigation is at `src/lib/stores/navigation.svelte.ts` — the `stub: true` property controls whether the sidebar grays out items
- README.md sections: "What You Get" (feature descriptions), "Architecture" (route listing)
- Quick verification: `grep -r 'ComingSoon' src/routes/` should return 0 results after all tasks complete
## Acceptance
- [ ] All `stub: true` flags removed from navigation.svelte.ts
- [ ] No `ComingSoon` component imports remain in any route under src/routes/
- [ ] README.md updated with descriptions for all 12 new routes
- [ ] `pnpm check` passes (0 errors)
- [ ] `pnpm test` passes (all tests green)
- [ ] All 12 routes load without errors in dev server
## Done summary
Removed all 10 stub: true flags from navigation.svelte.ts and updated README.md with descriptions for all 12 new routes plus expanded architecture tree listing new route directories and server modules.
## Evidence
- Commits: 454dc859c3f8965aaeaa74bcee70f8f6cafc81b2
- Tests: pnpm check, pnpm test
- PRs:
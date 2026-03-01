# fn-1-claudeitor-coding-activity-dashboard.4 Build layout shell with sidebar navigation, header, and theme system

## Description
Build the main application layout with collapsible sidebar navigation, header with time-aware greeting, and the Tailwind v4 theme system with system light/dark preference. The sidebar follows the section structure from the epic spec. The layout provides the shell that all pages render within.

**Size:** M
**Files:** src/routes/+layout.svelte, src/routes/+layout.server.ts, src/lib/components/layout/Sidebar.svelte, src/lib/components/layout/Header.svelte, src/lib/stores/theme.ts, src/lib/stores/navigation.ts

## Approach
- Layout: two-column with collapsible sidebar (left) and content area (right)
- Sidebar sections: Overview (Readout), Monitor (Live, Sessions, Costs, Setup*, Ports*), Workspace (Repos, Work Graph*, Repo Pulse*, Timeline, Diffs*, Snapshots*), Config (Skills, Agents, Memory, Hooks), Health (Hygiene*, Deps*, Worktrees*, Env*, Lint*), Settings (bottom) — items marked * are stubs
- Active route highlighting using $page.url from $app/stores
- Header: time-aware greeting ("Morning session, Eric" / "Night session, Eric")
- Theme: use Tailwind v4 dark: variant with prefers-color-scheme media query
- Follow clean-web-design skill for visual patterns
- Reference existing layout pattern in ThreadErrorAnalyzer project but use Svelte 5 runes

## Key context
- Svelte 5: use $state for sidebar collapsed state, NOT writable stores
- Tailwind v4 dark mode: use class strategy with system preference detection via matchMedia
- Sidebar should be collapsible on smaller screens (responsive)
- Use $page from $app/stores (this is the one legitimate use of Svelte stores, not component state)
## Acceptance
- [ ] +layout.svelte renders sidebar + content area
- [ ] Sidebar shows all sections with correct hierarchy from epic spec
- [ ] Active route is visually highlighted in sidebar
- [ ] Sidebar items marked as stubs show a subtle indicator
- [ ] Header shows time-aware greeting based on current hour
- [ ] System light/dark theme works via prefers-color-scheme
- [ ] Sidebar is collapsible (toggle button)
- [ ] Layout is responsive: sidebar collapses on narrow screens
- [ ] Navigation between all pages works (links render correct hrefs)
- [ ] Footer shows plugin and hook counts placeholder
## Done summary
Built the application layout shell with collapsible sidebar navigation (all sections from epic spec with stub indicators), time-aware header greeting, and class-based dark mode theme system with system preference detection via matchMedia and three-state toggle (system/light/dark).
## Evidence
- Commits: 9d130a5e1564411f7de8b61faeaa6f5f4c44fb7a
- Tests: pnpm test, pnpm check, pnpm build
- PRs:
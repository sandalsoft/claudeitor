# fn-1-claudeitor-coding-activity-dashboard.14 Build stub pages and empty state components

## Description
Build all stub pages (Coming Soon placeholders) and the shared empty state component used across the dashboard. Stub pages cover deferred features that have sidebar navigation entries but no implementation yet. Empty states provide guidance when data is missing.

**Size:** S
**Files:** src/routes/extensions/+page.svelte, src/lib/components/ui/ComingSoon.svelte, src/lib/components/ui/EmptyState.svelte, plus stub route files for: work-graph, repo-pulse, diffs, snapshots, hygiene, deps, worktrees, env, lint, setup, ports

## Approach
- ComingSoon component: icon, title, description ("This feature is coming soon"), optional link to related page
- Each stub page: minimal route file that renders ComingSoon with feature-specific title/description
- Stub pages: Work Graph, Repo Pulse, Diffs, Snapshots, Hygiene, Deps, Worktrees, Env, Lint, Setup, Ports, Extensions (pi-agent)
- EmptyState component: icon, title, description, optional CTA button
  - Used when data sources are empty (no sessions, no repos, no skills, etc.)
  - Each page provides contextual empty state text
- Follow clean-web-design skill for visual treatment

## Key context
- Stub pages should feel intentional, not broken — show what the feature WILL do
- Extensions page should mention pi-agent framework briefly
- Empty states should guide users: "Add repo directories in Settings" etc.
## Acceptance
- [ ] ComingSoon component renders with title and description
- [ ] All 12 stub pages render ComingSoon with feature-specific text
- [ ] All stub pages are navigable from sidebar
- [ ] EmptyState component renders with icon, title, description, CTA
- [ ] EmptyState used in all data pages when data is missing
- [ ] Empty states provide actionable guidance (e.g., "Configure repo dirs in Settings")
- [ ] Extensions page mentions pi-agent
- [ ] Stub pages look intentional and polished, not broken
## Done summary
Built ComingSoon and EmptyState reusable components, created all 12 stub route pages with feature-specific descriptions, added Extensions to sidebar navigation, and refactored all existing data pages to use the shared EmptyState component with actionable guidance.
## Evidence
- Commits: b884e7caef55e8ce50a6561b3452cfc376c1210b
- Tests: pnpm check
- PRs:
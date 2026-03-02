# fn-1-claudeitor-coding-activity-dashboard.12 Build Config pages: Skills, Agents, Memory, and Hooks

## Description
Build four Config section pages: Skills (inventory with descriptions), Agents (inventory), Memory (CLAUDE.md file viewer, read-only), and Hooks (hook configuration viewer). All are read-only viewers of Claude Code configuration data.

**Size:** M
**Files:** src/routes/skills/+page.svelte, src/routes/skills/+page.server.ts, src/routes/agents/+page.svelte, src/routes/agents/+page.server.ts, src/routes/memory/+page.svelte, src/routes/memory/+page.server.ts, src/routes/hooks/+page.svelte, src/routes/hooks/+page.server.ts

## Approach
- **Skills page**: 
  - List all skills from ~/.claude/skills/ directories
  - Show: name, description (from SKILL.md frontmatter), file count, whether user-invocable
  - Click to expand and show SKILL.md content (rendered markdown)
- **Agents page**:
  - List agents from ~/.claude/agents/ markdown files
  - Show: name, description (from frontmatter), model, tools available
  - Click to expand and show full agent definition
- **Memory page**:
  - Read-only viewer of CLAUDE.md files
  - Show: global (~/.claude/CLAUDE.md), project-level (./CLAUDE.md), any child CLAUDE.md files
  - Render markdown content with syntax highlighting for code blocks
  - Show line count per file
- **Hooks page**:
  - Read hooks configuration from settings.json
  - Display hook triggers, commands, and whether they are active
  - Organized by hook type (pre-commit, post-edit, etc.)

## Key context
- Skills and agents use markdown frontmatter (--- delimited YAML)
- Parse frontmatter for metadata, render body as markdown
- Memory is READ-ONLY — no editing from the dashboard
- Hooks are defined in ~/.claude/settings.json under "hooks" key
- Some skills are symlinked — resolve symlinks for display
## Acceptance
- [ ] Skills page lists all skills with name and description
- [ ] Skills expandable to show full SKILL.md content
- [ ] Agents page lists all agents with name, description, model
- [ ] Agents expandable to show full agent definition
- [ ] Memory page shows CLAUDE.md files (global + project-level)
- [ ] Memory renders markdown with syntax-highlighted code blocks
- [ ] Memory shows line counts per file
- [ ] Memory is read-only (no edit controls)
- [ ] Hooks page displays hook configuration from settings.json
- [ ] Hooks organized by trigger type
- [ ] All pages handle empty data (no skills, no agents, no memory, no hooks)
## Done summary
Built four Config section pages (Skills, Agents, Memory, Hooks) with enhanced data readers that parse YAML frontmatter for metadata, plus a new memory.ts reader for CLAUDE.md file discovery across global/project/child scopes. All pages feature expandable content viewers, summary stat cards, and empty state handling.
## Evidence
- Commits: ed5d7825135c072fad4b224b0782c54f0336c5fb
- Tests: pnpm check, pnpm build
- PRs:
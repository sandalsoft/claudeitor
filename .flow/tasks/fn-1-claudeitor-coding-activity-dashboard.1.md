# fn-1-claudeitor-coding-activity-dashboard.1 Scaffold SvelteKit project with Tailwind v4, D3.js, and TypeScript strict

## Description
Scaffold a new SvelteKit project with Svelte 5, Tailwind CSS v4 (CSS-first config with @theme directive), D3.js, and TypeScript in strict mode. Configure the Node adapter for persistent server support. Set up the project structure with the clean separation defined in the epic spec.

**Size:** M
**Files:** package.json, svelte.config.js, tsconfig.json, vite.config.ts, src/app.css, src/app.html, src/lib/, claudeitor.config.json, claudeitor.config.example.json, .gitignore

## Approach
- Use `pnpm create svelte@latest` with TypeScript strict
- Install: @tailwindcss/vite (Vite plugin for Tailwind v4), d3, @sveltejs/adapter-node, sveltekit-sse, bits-ui, chokidar, @anthropic-ai/sdk
- Configure Tailwind v4 via Vite plugin in vite.config.ts: import tailwindcss from "@tailwindcss/vite" and add to plugins array
- src/app.css: add `@import "tailwindcss";`, `@source "../"` for Svelte file scanning, `@theme` block with HSL custom properties
- Set up system light/dark preference detection via prefers-color-scheme in Tailwind dark: variant
- Create directory structure: src/lib/data/, src/lib/components/, src/lib/stores/, src/lib/utils/
- Create claudeitor.config.example.json with placeholder settings (committed to git)
- Add claudeitor.config.json to .gitignore (contains API key)
- **CRITICAL**: Bind server to 127.0.0.1 only — configure in svelte.config.js and/or vite.config.ts (server.host: "127.0.0.1") to prevent LAN exposure
- Reference clean-web-design and tailwind-v4-shadcn skills for theme setup

## Key context
- Tailwind v4 uses @tailwindcss/vite plugin (NOT PostCSS), with CSS directives: @import "tailwindcss", @source, @theme
- Node adapter required for SSE and file watching (not auto/static)
- Svelte 5 uses runes ($state, $derived, $effect), NOT legacy stores for component state
- Server MUST be bound to 127.0.0.1 — never 0.0.0.0 — to enforce localhost-only access
## Approach
- Use `pnpm create svelte@latest` with TypeScript strict
- Install: tailwindcss@4, d3, @sveltejs/adapter-node, sveltekit-sse, bits-ui, chokidar, @anthropic-ai/sdk
- Configure Tailwind v4 with CSS-first config using @theme directive and HSL custom properties
- Set up system light/dark preference detection via prefers-color-scheme
- Create directory structure: src/lib/data/, src/lib/components/, src/lib/stores/, src/lib/utils/
- Create claudeitor.config.json with default settings
- Reference clean-web-design and tailwind-v4-shadcn skills for theme setup

## Key context
- Tailwind v4 uses CSS-first config with @theme directive, NOT tailwind.config.js
- Node adapter required for SSE and file watching (not auto/static)
- Svelte 5 uses runes ($state, $derived, $effect), NOT legacy stores for component state
## Acceptance
- [ ] SvelteKit project initializes and dev server starts on port 5173
- [ ] TypeScript in strict mode (strict: true in tsconfig)
- [ ] Tailwind v4 via @tailwindcss/vite plugin in vite.config.ts
- [ ] src/app.css has @import "tailwindcss", @source, and @theme directives
- [ ] System prefers-color-scheme detection works (light/dark)
- [ ] Node adapter configured in svelte.config.js
- [ ] Server bound to 127.0.0.1 (not 0.0.0.0) in both dev and production
- [ ] All dependencies installed: d3, sveltekit-sse, bits-ui, chokidar, @anthropic-ai/sdk, @tailwindcss/vite
- [ ] Directory structure matches epic spec
- [ ] claudeitor.config.example.json committed with placeholder settings
- [ ] claudeitor.config.json in .gitignore (contains API key)
- [ ] pnpm dev, pnpm check, pnpm build all pass
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:

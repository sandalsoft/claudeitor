# Stub Routes Implementation Patterns

## Current State

All 12 routes exist as simple stubs using the `ComingSoon` component:

```svelte
<!-- src/routes/setup/+page.svelte (example) -->
<script lang="ts">
	import ComingSoon from '$lib/components/ui/ComingSoon.svelte';
</script>

<ComingSoon
	title="Setup"
	description="Guided setup wizard for new projects..."
	icon="wrench"
	linkHref="/settings"
	linkLabel="View settings"
/>
```

---

## Pattern for Implementing a Route

### 1. Server Load Function

**Location**: `src/routes/[route]/+page.server.ts`

**Pattern** (examples from fn-1):

```typescript
import { readSettings, readAgents } from '$lib/server/claude/index.js';
import { warn } from '$lib/server/telemetry/logger.js';

export async function load({ locals }) {
	const claudeDir = process.env.CLAUDE_HOME || `${process.env.HOME}/.claude`;

	try {
		const settings = await readSettings(claudeDir);
		const agents = await readAgents(claudeDir);

		return {
			settings,
			agents,
		};
	} catch (error) {
		warn(`[route-name] Failed to load data: ${error.message}`);
		return {
			settings: null,
			agents: [],
		};
	}
}
```

**Key patterns**:
- Use `$lib/server/claude/index.js` exports (server-only)
- Always have fallback return values (empty arrays, null, etc.)
- Wrap in try/catch; use `warn()` logger
- Return object passed to component as `data` prop

---

### 2. Svelte Component (Server Mode)

**Location**: `src/routes/[route]/+page.svelte`

**Pattern**:

```svelte
<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let expanded = $state<Record<string, boolean>>({});

	function toggleExpand(key: string) {
		expanded[key] = !expanded[key];
	}
</script>

<div class="space-y-4">
	{#if data.agents && data.agents.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			{#each data.agents as agent (agent.id)}
				<!-- render agent -->
			{/each}
		</div>
	{:else}
		<p class="text-muted-foreground">No data available</p>
	{/if}
</div>

<style>
	/* Tailwind v4: use CSS @layer, @apply directives */
</style>
```

**Key patterns**:
- TypeScript: import `PageData` type from `./$types` (auto-generated)
- Use Svelte 5 runes: `$state`, `$derived`, `$effect` (NOT legacy stores)
- Destructure `data` from props
- Always check `data.field && data.field.length > 0` before rendering
- Show fallback UI (empty state) when data unavailable
- Use Tailwind v4 utility classes (no `class:active` syntax for styles)

---

### 3. Empty State UI

**Pattern** (when no data):

```svelte
{#if !data || !data.items || data.items.length === 0}
	<div class="grid place-items-center min-h-96 rounded-lg border border-dashed">
		<div class="text-center space-y-2">
			<p class="text-lg font-semibold">No data available</p>
			<p class="text-sm text-muted-foreground">
				Check ~/.claude/ or configure your settings
			</p>
		</div>
	</div>
{:else}
	<!-- real content -->
{/if}
```

---

### 4. Shared Component Patterns

**Reuse existing cards**:

```svelte
<script lang="ts">
	import ActivityCard from '$lib/components/cards/ActivityCard.svelte';
</script>

<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
	{#each data.metrics as metric (metric.id)}
		<ActivityCard
			title={metric.title}
			value={metric.value}
			trend={metric.trend}
		/>
	{/each}
</div>
```

**Reuse chart utilities**:

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import * as d3 from 'd3';
	import { formatBytes, formatDuration } from '$lib/utils/chart-helpers';

	let svgElement: SVGSVGElement;

	onMount(() => {
		const svg = d3.select(svgElement);
		// Use existing chart pattern from ActivityChart.svelte
	});
</script>

<svg bind:this={svgElement} class="w-full h-96"></svg>
```

---

## Data Reader Imports

**Safe to use** (exist in fn-1):

```typescript
// src/lib/server/claude/index.ts exports:
export { readStats } from './stats.js';
export { readCosts } from './costs.js';
export { readSettings } from './settings.js';
export { readAgents } from './agents.js';
export { readSkills } from './skills.js';
export { readMemory } from './memory.js';
export { detectActiveSessions } from './active-sessions.js';
export { readSessionDetail, findSessionFile } from './session-detail.js';
export { createSessionTailer } from './session-tailer.js';
export { mapModelId, getModelPricing } from './model-mapping.js';
export { calculateSessionCost } from './cost-calculator.js';

// For logging (fn-2, fallback available):
export { warn, log, error } from '$lib/server/telemetry/logger.js';
```

---

## Type Safety

**Import types from centralized location**:

```typescript
import type {
	Session,
	Model,
	Cost,
	Settings,
	Agent,
	Skill,
	Memory,
	Hook,
	Environment,
	Config,
} from '$lib/data/types';
```

**Create route-specific types in +page.server.ts**:

```typescript
export interface PageData {
	settings: Settings | null;
	agents: Agent[];
	isLoading: boolean;
}
```

---

## Tailwind v4 Patterns

**Use CSS-first utilities** (NOT class binding):

```svelte
<!-- GOOD: Tailwind utilities -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 rounded-lg border">
	Content
</div>

<!-- BAD: Not supported in Tailwind v4 @tailwindcss/vite -->
<div class:grid={true} class:md:grid-cols-2={true}>
	Content
</div>
```

**Use @layer for custom styles**:

```css
<style>
	:global {
		@layer components {
			.card-hover {
				@apply transition-shadow hover:shadow-lg;
			}
		}
	}
</style>
```

---

## Testing Patterns

**Vitest unit test** (parallel to +page.server.ts):

```typescript
// src/routes/[route]/+page.server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { load } from './+page.server';
import * as fs from 'fs';
import * as path from 'path';

describe('[route] load', () => {
	let tempDir: string;

	beforeEach(() => {
		// Create temp fixture with mock ~/.claude/
		tempDir = fs.mkdtempSync('claudeitor-test-');
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true });
	});

	it('returns empty state when no data available', async () => {
		const result = await load({
			locals: { claudeDir: tempDir },
		});
		expect(result.agents).toEqual([]);
	});
});
```

---

## Error Handling Patterns

**Always graceful fallback**:

```typescript
export async function load({ locals }) {
	const claudeDir = process.env.CLAUDE_HOME || `${process.env.HOME}/.claude`;

	try {
		const data = await readAgents(claudeDir);
		return { data, error: null };
	} catch (err) {
		warn(`[agents route] Failed to read agents: ${err.message}`);
		return {
			data: [],
			error: `Could not load agents from ${claudeDir}`,
		};
	}
}
```

**Component handles error state**:

```svelte
<script lang="ts">
	let { data } = $props();
</script>

{#if data.error}
	<div class="rounded-lg border border-destructive bg-destructive/10 p-4">
		<p class="text-sm text-destructive">{data.error}</p>
	</div>
{:else if data.data.length === 0}
	<p class="text-muted-foreground">No data available</p>
{:else}
	<!-- render data.data -->
{/if}
```

---

## Route Implementation Checklist

- [ ] `src/routes/[route]/+page.server.ts` created with load function
- [ ] Data readers imported from `$lib/server/claude/`
- [ ] Try/catch with warn() logging
- [ ] Return object with fallback values
- [ ] `src/routes/[route]/+page.svelte` created
- [ ] Import PageData type from `./$types`
- [ ] Use Svelte 5 runes ($state, $derived, $effect)
- [ ] Check for empty/null data before rendering
- [ ] Empty state UI when no data
- [ ] TypeScript: no `any` types
- [ ] Use Tailwind v4 utility classes
- [ ] Reuse existing components (cards, charts, layout)
- [ ] Responsive grid (1 col mobile, 2-3 cols desktop)
- [ ] Tests: Vitest file parallel to load function
- [ ] Lint check: `pnpm check`
- [ ] All tests pass: `pnpm test`

---

## Routes Quick Reference

**Group 1: Configuration & Environment**
- `/setup` → Project scaffolding, CLAUDE.md initialization
- `/ports` → Network binding, localhost verification
- `/env` → Environment variables, PATH inspection

**Group 2: Project Analysis**
- `/work-graph` → Dependency graph, code structure visualization
- `/repo-pulse` → Git repo health, commit frequency
- `/diffs` → File changes, working tree diffs
- `/snapshots` → Project state snapshots over time

**Group 3: Quality & Extensions**
- `/hygiene` → Code quality metrics, warnings
- `/deps` → Dependency audits, version checks
- `/worktrees` → Git worktrees, branch tracking
- `/lint` → Linter reports, ESLint/Prettier integration
- `/extensions` → VS Code extensions, Claude Code plugins

---

## Next Steps

1. Pick a route to implement first (e.g., `/env` is simplest)
2. Replace `ComingSoon` component with real load function + UI
3. Test with `pnpm dev` on localhost:5173
4. Run `pnpm check && pnpm test` to verify
5. Repeat for remaining 11 routes
6. Track completion in fn-4 epic tasks

**Time estimate per route**: 30-60 min (depending on data complexity)
**Total for all 12**: 6-12 hours

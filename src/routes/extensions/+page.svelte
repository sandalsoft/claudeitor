<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	const s = $derived(data.summary);
	const totalExtensions = $derived(
		s.skillCount + s.agentCount + s.plugins.length + s.mcpServerCount + s.hookCount
	);
	const enabledPlugins = $derived(s.plugins.filter((p) => p.enabled));

	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Extensions</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Skills, agents, plugins, MCP servers, and hooks installed in your Claude Code environment.
		</p>
	</div>

	{#if totalExtensions === 0}
		<EmptyState
			icon="puzzle"
			title="No extensions found"
			description="Install skills, agents, or plugins to extend Claude Code. Check the Claude Code documentation for available extensions."
			ctaLabel="View Settings"
			ctaHref="/settings"
		/>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
			<StatCard title="Skills" value={s.skillCount} trend="neutral" />
			<StatCard title="Agents" value={s.agentCount} trend="neutral" />
			<StatCard
				title="Plugins"
				value={s.plugins.length}
				trend="neutral"
				subtitle="{enabledPlugins.length} enabled"
			/>
			<StatCard title="MCP Servers" value={s.mcpServerCount} trend="neutral" />
			<StatCard title="Hooks" value={s.hookCount} trend="neutral" />
		</div>

		<!-- Plugins section -->
		{#if s.plugins.length > 0}
			<div class="space-y-2">
				<h2 class="text-sm font-semibold text-foreground">Plugins</h2>
				{#each s.plugins as plugin (plugin.id)}
					<div
						class="rounded-xl border border-border bg-card transition-colors hover:border-border/80"
					>
						<div class="flex items-center gap-4 px-4 py-3">
							<!-- Status dot -->
							<div class="shrink-0">
								<span
									class="block h-2.5 w-2.5 rounded-full {plugin.enabled
										? 'bg-emerald-500'
										: 'bg-muted-foreground/40'}"
								></span>
							</div>

							<!-- Plugin info -->
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="text-sm font-medium text-foreground">{plugin.id}</span>
									<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
										v{plugin.version}
									</span>
									<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
										{plugin.scope}
									</span>
								</div>
								{#if plugin.installedAt}
									<p class="mt-0.5 text-xs text-muted-foreground">
										Installed {formatDate(plugin.installedAt)}
									</p>
								{/if}
							</div>

							<!-- Enabled label -->
							<span
								class="shrink-0 text-xs {plugin.enabled
									? 'text-emerald-600 dark:text-emerald-400'
									: 'text-muted-foreground'}"
							>
								{plugin.enabled ? 'Enabled' : 'Disabled'}
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- MCP Servers section -->
		{#if s.mcpServerCount > 0}
			<div class="space-y-2">
				<h2 class="text-sm font-semibold text-foreground">MCP Servers</h2>
				{#each s.mcpServerNames as name (name)}
					<div
						class="rounded-xl border border-border bg-card transition-colors hover:border-border/80"
					>
						<div class="flex items-center gap-4 px-4 py-3">
							<div class="shrink-0">
								<Icon name="network" size={14} class="text-muted-foreground" />
							</div>
							<span class="text-sm font-medium text-foreground">{name}</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Skills & Agents counts (already shown as stat cards, but note the section) -->
		{#if s.skillCount > 0 || s.agentCount > 0}
			<div class="space-y-2">
				<h2 class="text-sm font-semibold text-foreground">Skills & Agents</h2>
				<div class="rounded-xl border border-border bg-card px-4 py-3">
					<div class="flex items-center gap-6">
						{#if s.skillCount > 0}
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<Icon name="sparkles" size={14} />
								<span>
									{s.skillCount} skill{s.skillCount === 1 ? '' : 's'} installed
								</span>
							</div>
						{/if}
						{#if s.agentCount > 0}
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<Icon name="bot" size={14} />
								<span>
									{s.agentCount} agent{s.agentCount === 1 ? '' : 's'} defined
								</span>
							</div>
						{/if}
					</div>
				</div>
				<p class="text-xs text-muted-foreground">
					View details on the <a href="/skills" class="underline hover:text-foreground">Skills</a>
					page.
				</p>
			</div>
		{/if}

		<!-- Hooks section -->
		{#if s.hookCount > 0}
			<div class="space-y-2">
				<h2 class="text-sm font-semibold text-foreground">Hooks</h2>
				<div class="rounded-xl border border-border bg-card px-4 py-3">
					<div class="flex items-center gap-2 text-sm text-muted-foreground">
						<Icon name="webhook" size={14} />
						<span>
							{s.hookCount} hook{s.hookCount === 1 ? '' : 's'} configured
						</span>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

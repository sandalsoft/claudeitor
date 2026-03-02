<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// Track which agents are expanded
	let expanded = $state<Set<string>>(new Set());

	function toggleExpand(name: string) {
		const next = new Set(expanded);
		if (next.has(name)) {
			next.delete(name);
		} else {
			next.add(name);
		}
		expanded = next;
	}

	const withModel = $derived(data.agents.filter((a) => a.model).length);
	const withTools = $derived(data.agents.filter((a) => a.tools && a.tools.length > 0).length);
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Agents</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Custom subagent definitions from ~/.claude/agents/ for specialized tasks.
		</p>
	</div>

	{#if data.agents.length === 0}
		<EmptyState
			icon="bot"
			title="No agents defined."
			description="Create markdown files in ~/.claude/agents/ to define custom subagents with specialized capabilities."
		/>
	{:else}
		<!-- Summary stats -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
			<StatCard title="Total Agents" value={data.agents.length} trend="neutral" />
			<StatCard
				title="With Model"
				value={withModel}
				trend="neutral"
				subtitle="Specify a model preference"
			/>
			<StatCard
				title="With Tools"
				value={withTools}
				trend="neutral"
				subtitle="Have tool restrictions"
			/>
		</div>

		<!-- Agents list -->
		<div class="space-y-2">
			{#each data.agents as agent (agent.name)}
				<div class="rounded-xl border border-border bg-card transition-colors hover:border-border/80">
					<!-- Agent header -->
					<button
						onclick={() => toggleExpand(agent.name)}
						class="flex w-full items-center gap-4 px-4 py-3 text-left"
					>
						<div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<Icon name="bot" size={14} class="text-primary" />
						</div>

						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">{agent.name}</span>
								{#if agent.model}
									<span
										class="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-600 dark:text-purple-400"
									>
										{agent.model}
									</span>
								{/if}
							</div>
							{#if agent.description}
								<p class="mt-0.5 truncate text-xs text-muted-foreground">
									{agent.description}
								</p>
							{/if}
						</div>

						<!-- Tools count -->
						{#if agent.tools && agent.tools.length > 0}
							<div class="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex">
								<Icon name="wrench" size={12} />
								{agent.tools.length} tool{agent.tools.length === 1 ? '' : 's'}
							</div>
						{/if}

						<!-- Expand chevron -->
						<Icon
							name={expanded.has(agent.name) ? 'chevron-up' : 'chevron-down'}
							size={14}
							class="shrink-0 text-muted-foreground"
						/>
					</button>

					<!-- Expanded content -->
					{#if expanded.has(agent.name)}
						<div class="border-t border-border px-4 py-3">
							<!-- Tools list -->
							{#if agent.tools && agent.tools.length > 0}
								<div class="mb-3 flex flex-wrap gap-1.5">
									{#each agent.tools as tool (tool)}
										<span
											class="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
										>
											{tool}
										</span>
									{/each}
								</div>
							{/if}

							<pre
								class="max-h-96 overflow-auto rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-foreground">{agent.content}</pre>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

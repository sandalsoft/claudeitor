<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let filter = $state('');

	const filtered = $derived(
		filter
			? data.variables.filter((v) => v.name.toLowerCase().includes(filter.toLowerCase()))
			: data.variables
	);
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Environment</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Environment variable names discovered across your repositories. Values are never exposed.
		</p>
	</div>

	{#if data.variables.length === 0}
		<EmptyState
			icon="variable"
			title="No environment variables found."
			description="Add repository directories in Settings to discover .env files across your projects."
			ctaLabel="Configure Repos"
			ctaHref="/settings"
		/>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-3 gap-3">
			<StatCard title="Variables" value={data.totalVariables} trend="neutral" />
			<StatCard title="Repos with .env" value={data.reposWithEnvFiles} trend="neutral" />
			<StatCard title="Total Repos" value={data.totalRepos} trend="neutral" />
		</div>

		<!-- Filter -->
		<div class="relative">
			<Icon name="search" size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
			<input
				type="text"
				bind:value={filter}
				placeholder="Filter variables..."
				class="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
			/>
		</div>

		<!-- Variable list -->
		<div class="space-y-2">
			{#each filtered as variable (variable.name)}
				<div class="rounded-xl border border-border bg-card transition-colors hover:border-border/80">
					<div class="flex items-center gap-4 px-4 py-3">
						<!-- Key icon -->
						<div class="shrink-0 text-muted-foreground">
							<Icon name="key" size={14} />
						</div>

						<!-- Variable info -->
						<div class="min-w-0 flex-1">
							<span class="font-mono text-sm font-medium text-foreground">{variable.name}</span>
							<p class="mt-0.5 text-xs text-muted-foreground">
								{variable.repos.join(', ')}
							</p>
						</div>

						<!-- Repo count badge -->
						<span
							class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
							title="{variable.repos.length} repo{variable.repos.length === 1 ? '' : 's'}"
						>
							{variable.repos.length} repo{variable.repos.length === 1 ? '' : 's'}
						</span>
					</div>
				</div>
			{/each}

			{#if filtered.length === 0 && filter}
				<p class="py-8 text-center text-sm text-muted-foreground">
					No variables matching "{filter}"
				</p>
			{/if}
		</div>
	{/if}
</div>

<script lang="ts">
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import BranchGraph from '$lib/components/charts/BranchGraph.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	const defaultBranchCount = $derived(data.nodes.filter((n) => n.isDefault).length);
	const featureBranchCount = $derived(data.nodes.length - defaultBranchCount);
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Work Graph</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Branch topology across your repositories. Default branches are larger nodes with outlines.
		</p>
	</div>

	{#if data.nodes.length === 0 && data.repoCount === 0}
		<EmptyState
			icon="git-merge"
			title="No repositories discovered."
			description="Configure repository directories in Settings to visualize branch topology."
			ctaLabel="Configure Repos"
			ctaHref="/settings"
		/>
	{:else if data.nodes.length === 0}
		<EmptyState
			icon="git-merge"
			title="No branches found."
			description="No branches were enumerated across {data.repoCount} repositories."
		/>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<StatCard title="Repos" value={data.repoCount} trend="neutral" />
			<StatCard
				title="Branches"
				value={data.nodes.length}
				subtitle={data.totalBranches > data.nodes.length
					? `${data.totalBranches} total, showing top ${data.nodes.length}`
					: undefined}
				trend="neutral"
			/>
			<StatCard title="Default" value={defaultBranchCount} trend="neutral" />
			<StatCard title="Feature" value={featureBranchCount} trend="neutral" />
		</div>

		<!-- Error notices -->
		{#if data.errors.length > 0}
			<div
				class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950"
			>
				{#each data.errors as error}
					<p class="text-xs text-amber-700 dark:text-amber-300">{error}</p>
				{/each}
			</div>
		{/if}

		<!-- Branch graph -->
		<BranchGraph nodes={data.nodes} edges={data.edges} />
	{/if}
</div>

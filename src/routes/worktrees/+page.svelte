<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let filter = $state('');

	const filtered = $derived(
		filter
			? data.worktrees.filter(
					(w) =>
						w.repo.toLowerCase().includes(filter.toLowerCase()) ||
						w.branch.toLowerCase().includes(filter.toLowerCase()) ||
						w.path.toLowerCase().includes(filter.toLowerCase())
				)
			: data.worktrees
	);

	function branchBadgeClass(branch: string): string {
		if (branch === 'detached') return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
		if (branch === 'bare') return 'bg-muted text-muted-foreground';
		return 'bg-muted text-muted-foreground';
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Worktrees</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Git worktrees across your repositories. Work on multiple branches simultaneously without stashing.
		</p>
	</div>

	{#if data.worktrees.length === 0 && data.totalRepos === 0}
		<EmptyState
			icon="folder-tree"
			title="No repositories discovered."
			description="Configure repository directories in Settings to discover worktrees."
			ctaLabel="Configure Repos"
			ctaHref="/settings"
		/>
	{:else if data.worktrees.length === 0}
		<EmptyState
			icon="folder-tree"
			title="No worktrees found."
			description="No git worktrees detected across {data.totalRepos} repositories."
		/>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<StatCard title="Total Worktrees" value={data.totalWorktrees} trend="neutral" />
			<StatCard title="Extra Worktrees" value={data.extraWorktreeCount} trend="neutral" />
			<StatCard
				title="Repos with Worktrees"
				value={data.reposWithExtraWorktrees}
				subtitle="of {data.totalRepos} total"
				trend="neutral"
			/>
			<StatCard title="Repos Scanned" value={data.totalRepos} trend="neutral" />
		</div>

		<!-- Error notices -->
		{#if data.errors.length > 0}
			<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
				{#each data.errors as error}
					<p class="text-xs text-amber-700 dark:text-amber-300">{error}</p>
				{/each}
			</div>
		{/if}

		<!-- Filter -->
		<div class="relative">
			<Icon
				name="search"
				size={14}
				class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
			/>
			<input
				type="text"
				bind:value={filter}
				placeholder="Filter by repo, branch, or path..."
				class="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
			/>
		</div>

		<!-- Worktree list -->
		<div class="space-y-2">
			{#each filtered as wt (wt.path)}
				<div class="rounded-xl border border-border bg-card transition-colors hover:border-border/80">
					<div class="flex items-center gap-4 px-4 py-3">
						<!-- Icon -->
						<div class="shrink-0 text-muted-foreground">
							<Icon name={wt.isMain ? 'folder' : 'folder-tree'} size={16} />
						</div>

						<!-- Worktree info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">{wt.repo}</span>
								<span class="rounded px-1.5 py-0.5 text-xs {branchBadgeClass(wt.branch)}">
									{wt.branch}
								</span>
								{#if wt.isMain}
									<span class="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
										main
									</span>
								{/if}
							</div>
							<p class="mt-0.5 truncate font-mono text-xs text-muted-foreground" title={wt.path}>
								{wt.path}
							</p>
						</div>

						<!-- HEAD hash -->
						{#if wt.head}
							<span
								class="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline"
								title={wt.head}
							>
								{wt.head.substring(0, 7)}
							</span>
						{/if}
					</div>
				</div>
			{/each}

			{#if filtered.length === 0 && filter}
				<p class="py-8 text-center text-sm text-muted-foreground">
					No worktrees matching "{filter}"
				</p>
			{/if}
		</div>
	{/if}
</div>

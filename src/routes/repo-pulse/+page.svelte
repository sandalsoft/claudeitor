<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let filter = $state('');

	const filtered = $derived(
		filter
			? data.pulses.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
			: data.pulses
	);

	function formatDate(dateStr: string): string {
		if (!dateStr) return 'Never';
		const date = new Date(dateStr);
		const now = Date.now();
		const diff = now - date.getTime();

		if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	/**
	 * Generate SVG polyline points for a sparkline.
	 * Data is an array of values; we produce points normalized to fit width x height.
	 */
	function sparklinePoints(values: number[], w: number, h: number): string {
		if (values.length === 0) return '';
		const max = Math.max(...values, 1); // avoid division by zero
		const step = w / Math.max(values.length - 1, 1);
		return values
			.map((v, i) => {
				const x = i * step;
				const y = h - (v / max) * h;
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}

	function activityLevel(score: number): { label: string; color: string } {
		if (score >= 50) return { label: 'Very active', color: 'text-emerald-600 dark:text-emerald-400' };
		if (score >= 20) return { label: 'Active', color: 'text-blue-600 dark:text-blue-400' };
		if (score >= 5) return { label: 'Moderate', color: 'text-amber-600 dark:text-amber-400' };
		return { label: 'Quiet', color: 'text-muted-foreground' };
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Repo Pulse</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Activity patterns across your repositories: commit frequency, contributors, and working state.
		</p>
	</div>

	{#if data.pulses.length === 0 && data.repoCount === 0}
		<EmptyState
			icon="heart-pulse"
			title="No repositories discovered."
			description="Configure repository directories in Settings to see repository pulse data."
			ctaLabel="Configure Repos"
			ctaHref="/settings"
		/>
	{:else if data.pulses.length === 0}
		<EmptyState
			icon="heart-pulse"
			title="No activity detected."
			description="No commit activity found across {data.repoCount} repositories."
		/>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<StatCard title="Repos" value={data.repoCount} trend="neutral" />
			<StatCard title="Commits (7d)" value={data.totalCommits7d} trend="neutral" />
			<StatCard title="Commits (30d)" value={data.totalCommits30d} trend="neutral" />
			<StatCard title="Contributors" value={data.uniqueContributors} trend="neutral" />
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
				placeholder="Filter by repo name..."
				class="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
			/>
		</div>

		<!-- Pulse list -->
		<div class="space-y-2">
			{#each filtered as pulse (pulse.path)}
				{@const level = activityLevel(pulse.activityScore)}
				<div class="rounded-xl border border-border bg-card transition-colors hover:border-border/80">
					<div class="flex items-center gap-4 px-4 py-3">
						<!-- Repo info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">{pulse.name}</span>
								<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
									{pulse.branch}
								</span>
								<span class="text-xs {level.color}">{level.label}</span>
							</div>
							<div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
								<span title="Commits (7d)">{pulse.commits7d} commits / 7d</span>
								<span title="Commits (30d)">{pulse.commits30d} / 30d</span>
								<span title="Contributors">
									{pulse.contributors.length} contributor{pulse.contributors.length === 1 ? '' : 's'}
								</span>
							</div>
						</div>

						<!-- Sparkline -->
						<div class="hidden shrink-0 sm:block" title="30-day commit activity">
							<svg width="80" height="24" class="overflow-visible">
								<polyline
									points={sparklinePoints(pulse.sparkline, 80, 22)}
									fill="none"
									stroke="var(--color-primary)"
									stroke-width="1.5"
									stroke-linejoin="round"
									stroke-linecap="round"
								/>
							</svg>
						</div>

						<!-- Status badges -->
						<div class="hidden shrink-0 items-center gap-3 md:flex">
							{#if pulse.uncommittedFileCount > 0}
								<span
									class="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
									title="Uncommitted files"
								>
									<Icon name="file-text" size={12} />
									{pulse.uncommittedFileCount}
								</span>
							{/if}
							{#if pulse.unpushedCommitCount > 0}
								<span
									class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400"
									title="Unpushed commits"
								>
									<Icon name="arrow-up-right" size={12} />
									{pulse.unpushedCommitCount}
								</span>
							{/if}
						</div>

						<!-- Last activity -->
						<span class="shrink-0 text-xs text-muted-foreground">
							{formatDate(pulse.lastCommitDate)}
						</span>
					</div>
				</div>
			{/each}

			{#if filtered.length === 0 && filter}
				<p class="py-8 text-center text-sm text-muted-foreground">
					No repos matching "{filter}"
				</p>
			{/if}
		</div>
	{/if}
</div>

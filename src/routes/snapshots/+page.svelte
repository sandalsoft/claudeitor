<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	function formatDate(dateStr: string): string {
		if (!dateStr) return 'Unknown';
		const date = new Date(dateStr);
		const now = Date.now();
		const diff = now - date.getTime();

		if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}m ago`;
		if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
		if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
	}

	function shortHash(hash: string): string {
		return hash.slice(0, 7);
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Project Snapshots</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Timeline of commits across all discovered repositories (30-day window from git log).
		</p>
	</div>

	{#if data.entries.length === 0 && data.repoCount === 0}
		<EmptyState
			icon="camera"
			title="No repositories discovered."
			description="Configure repository directories in Settings to see project snapshots."
			ctaLabel="Configure Repos"
			ctaHref="/settings"
		/>
	{:else if data.entries.length === 0}
		<EmptyState
			icon="camera"
			title="No commits found."
			description="No commit activity in the last 30 days across {data.repoCount} repositories."
		/>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<StatCard title="Total Commits" value={data.totalEntries} trend="neutral" />
			<StatCard title="Repos" value={data.repoCount} trend="neutral" />
			<StatCard title="Authors" value={data.authorCount} trend="neutral" />
			<StatCard
				title="Page"
				value="{data.page} / {data.totalPages}"
				trend="neutral"
			/>
		</div>

		<!-- 30-day window notice -->
		<div class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
			<p class="text-xs text-blue-700 dark:text-blue-300">
				Showing commits from the last 30 days. Older commits are not included in the scan window.
			</p>
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

		<!-- Commit timeline -->
		<div class="space-y-1">
			{#each data.entries as entry (entry.hash + entry.repoPath)}
				<div class="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/30">
					<!-- Timeline dot -->
					<div class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/60"></div>

					<!-- Commit info -->
					<div class="min-w-0 flex-1">
						<div class="flex items-start gap-2">
							<span class="flex-1 text-sm font-medium text-foreground">
								{entry.subject}
							</span>
							<span
								class="shrink-0 font-mono text-xs text-muted-foreground"
								title={entry.hash}
							>
								{shortHash(entry.hash)}
							</span>
						</div>
						<div class="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
							<span class="rounded bg-muted px-1.5 py-0.5">{entry.repo}</span>
							<span title="{entry.authorName} <{entry.authorEmail}>">
								{entry.authorName}
							</span>
							<span>{formatDate(entry.date)}</span>
							{#if entry.filesChanged > 0}
								<span class="flex items-center gap-1">
									<Icon name="file-text" size={10} />
									{entry.filesChanged} file{entry.filesChanged === 1 ? '' : 's'}
								</span>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#if data.totalPages > 1}
			<div class="flex items-center justify-center gap-2 pt-2">
				{#if data.page > 1}
					<a
						href="/snapshots?page={data.page - 1}"
						class="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
					>
						<Icon name="chevron-left" size={12} />
						Previous
					</a>
				{/if}
				<span class="text-xs text-muted-foreground">
					Page {data.page} of {data.totalPages}
				</span>
				{#if data.page < data.totalPages}
					<a
						href="/snapshots?page={data.page + 1}"
						class="inline-flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
					>
						Next
						<Icon name="chevron-right" size={12} />
					</a>
				{/if}
			</div>
		{/if}
	{/if}
</div>

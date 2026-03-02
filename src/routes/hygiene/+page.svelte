<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let filter = $state('');

	const filtered = $derived(
		filter
			? data.issues.filter(
					(i) =>
						i.repo.toLowerCase().includes(filter.toLowerCase()) ||
						i.label.toLowerCase().includes(filter.toLowerCase())
				)
			: data.issues
	);

	function severityIcon(severity: string): string {
		switch (severity) {
			case 'error':
				return 'alert-circle';
			case 'warn':
				return 'alert-triangle';
			default:
				return 'info';
		}
	}

	function severityColor(severity: string): string {
		switch (severity) {
			case 'error':
				return 'text-red-600 dark:text-red-400';
			case 'warn':
				return 'text-amber-600 dark:text-amber-400';
			default:
				return 'text-blue-600 dark:text-blue-400';
		}
	}

	function formatDate(unixSeconds: number): string {
		const date = new Date(unixSeconds * 1000);
		const now = Date.now();
		const diffDays = Math.floor((now - date.getTime()) / 86_400_000);

		if (diffDays < 1) return 'today';
		if (diffDays === 1) return '1 day ago';
		if (diffDays < 30) return `${diffDays} days ago`;
		if (diffDays < 365) {
			const months = Math.floor(diffDays / 30);
			return `${months} month${months === 1 ? '' : 's'} ago`;
		}
		const years = Math.floor(diffDays / 365);
		return `${years} year${years === 1 ? '' : 's'} ago`;
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Hygiene</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Code hygiene audit across your repositories: stale branches, uncommitted changes, upstream drift.
		</p>
	</div>

	{#if data.issues.length === 0 && data.totalRepos === 0}
		<EmptyState
			icon="shield-check"
			title="No repositories discovered."
			description="Configure repository directories in Settings to run hygiene checks."
			ctaLabel="Configure Repos"
			ctaHref="/settings"
		/>
	{:else if data.issues.length === 0}
		<EmptyState
			icon="check-circle"
			title="All clean."
			description="No hygiene issues found across {data.totalRepos} repositories."
		/>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<StatCard title="Total Issues" value={data.issues.length} trend="neutral" />
			<StatCard
				title="Warnings"
				value={data.warnCount}
				trend={data.warnCount > 0 ? 'down' : 'neutral'}
			/>
			<StatCard title="Info" value={data.infoCount} trend="neutral" />
			<StatCard
				title="Repos Affected"
				value={data.reposWithIssues}
				subtitle="of {data.totalRepos} total"
				trend="neutral"
			/>
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
				placeholder="Filter by repo or issue..."
				class="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
			/>
		</div>

		<!-- Issue list -->
		<div class="space-y-2">
			{#each filtered as issue (`${issue.repoPath}:${issue.label}`)}
				<div class="rounded-xl border border-border bg-card transition-colors hover:border-border/80">
					<div class="flex items-start gap-4 px-4 py-3">
						<!-- Severity icon -->
						<div class="mt-0.5 shrink-0 {severityColor(issue.severity)}">
							<Icon name={severityIcon(issue.severity)} size={16} />
						</div>

						<!-- Issue info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">{issue.label}</span>
								<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
									{issue.repo}
								</span>
							</div>
							<p class="mt-0.5 text-xs text-muted-foreground">{issue.detail}</p>

							<!-- Stale branches expandable list -->
							{#if issue.staleBranches && issue.staleBranches.length > 0}
								<div class="mt-2 space-y-1 rounded-lg bg-muted/30 px-3 py-2">
									<p class="text-xs font-medium text-muted-foreground">
										Oldest {issue.staleBranches.length} of {issue.staleBranchCount} stale branches:
									</p>
									{#each issue.staleBranches as branch (branch.name)}
										<div class="flex items-center justify-between gap-2">
											<span class="truncate font-mono text-xs text-foreground">{branch.name}</span>
											<span class="shrink-0 text-xs text-muted-foreground">
												{formatDate(branch.lastCommitUnix)}
											</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Severity badge -->
						<span
							class="shrink-0 rounded px-1.5 py-0.5 text-xs {issue.severity === 'warn'
								? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
								: issue.severity === 'error'
									? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
									: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'}"
						>
							{issue.severity}
						</span>
					</div>
				</div>
			{/each}

			{#if filtered.length === 0 && filter}
				<p class="py-8 text-center text-sm text-muted-foreground">
					No issues matching "{filter}"
				</p>
			{/if}
		</div>
	{/if}
</div>

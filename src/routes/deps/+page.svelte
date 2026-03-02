<script lang="ts">
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData, ActionData } from './$types';

	const { data, form }: { data: PageData; form: ActionData } = $props();

	let running = $state(false);
	let filter = $state('');

	// Use action results when available, otherwise page data
	const audited = $derived(form?.audited ?? data.audited);
	const results = $derived(form?.results ?? data.results);
	const totalRepos = $derived(form?.totalRepos ?? data.totalRepos);
	const totalVulnerabilities = $derived((form as Record<string, unknown>)?.totalVulnerabilities as number ?? 0);
	const totalOutdated = $derived((form as Record<string, unknown>)?.totalOutdated as number ?? 0);
	const reposWithIssues = $derived((form as Record<string, unknown>)?.reposWithIssues as number ?? 0);

	const filtered = $derived(
		filter
			? results.filter((r: { repo: string; statusMessage: string }) =>
					r.repo.toLowerCase().includes(filter.toLowerCase()) ||
					r.statusMessage.toLowerCase().includes(filter.toLowerCase())
				)
			: results
	);

	function statusColor(status: string): string {
		switch (status) {
			case 'error':
				return 'text-red-600 dark:text-red-400';
			case 'warn':
				return 'text-amber-600 dark:text-amber-400';
			case 'ok':
				return 'text-green-600 dark:text-green-400';
			case 'timeout':
			case 'offline':
			case 'unavailable':
				return 'text-muted-foreground';
			default:
				return 'text-muted-foreground';
		}
	}

	function statusIcon(status: string): string {
		switch (status) {
			case 'error':
				return 'alert-circle';
			case 'warn':
				return 'alert-triangle';
			case 'ok':
				return 'check-circle';
			case 'timeout':
				return 'clock';
			case 'offline':
				return 'wifi-off';
			case 'unavailable':
				return 'minus-circle';
			default:
				return 'info';
		}
	}

	function statusBadgeClasses(status: string): string {
		switch (status) {
			case 'error':
				return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
			case 'warn':
				return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
			case 'ok':
				return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300';
			default:
				return 'bg-muted text-muted-foreground';
		}
	}

	function severityBadge(severity: string): string {
		switch (severity) {
			case 'critical':
				return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
			case 'high':
				return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300';
			case 'moderate':
				return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
			case 'low':
				return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
			default:
				return 'bg-muted text-muted-foreground';
		}
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Dependencies</h1>
			<p class="mt-0.5 text-sm text-muted-foreground">
				Audit npm dependencies for vulnerabilities and outdated packages.
			</p>
		</div>
		<form
			method="POST"
			action="?/audit"
			use:enhance={() => {
				running = true;
				return async ({ update }) => {
					await update();
					running = false;
				};
			}}
		>
			<button
				type="submit"
				disabled={running}
				class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/50 disabled:opacity-50"
			>
				{#if running}
					<Icon name="loader" size={12} class="animate-spin" />
					Running...
				{:else}
					<Icon name="shield" size={12} />
					Run Audit
				{/if}
			</button>
		</form>
	</div>

	{#if data.totalRepos === 0}
		<EmptyState
			icon="package"
			title="No repositories discovered."
			description="Configure repository directories in Settings to audit dependencies."
			ctaLabel="Configure Repos"
			ctaHref="/settings"
		/>
	{:else if !audited}
		<EmptyState
			icon="shield"
			title="Ready to audit."
			description="Click 'Run Audit' to scan {data.totalRepos} repositor{data.totalRepos === 1 ? 'y' : 'ies'} for vulnerabilities and outdated packages."
		/>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<StatCard title="Repos Scanned" value={totalRepos} trend="neutral" />
			<StatCard
				title="Vulnerabilities"
				value={totalVulnerabilities}
				trend={totalVulnerabilities > 0 ? 'down' : 'neutral'}
			/>
			<StatCard
				title="Outdated"
				value={totalOutdated}
				trend={totalOutdated > 0 ? 'down' : 'neutral'}
			/>
			<StatCard
				title="Repos with Issues"
				value={reposWithIssues}
				subtitle="of {totalRepos} total"
				trend={reposWithIssues > 0 ? 'down' : 'neutral'}
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
		{#if results.length > 0}
			<div class="relative">
				<Icon
					name="search"
					size={14}
					class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
				/>
				<input
					type="text"
					bind:value={filter}
					placeholder="Filter by repo or status..."
					class="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
				/>
			</div>
		{/if}

		<!-- Results list -->
		<div class="space-y-2">
			{#each filtered as result (result.repoPath)}
				<div class="rounded-xl border border-border bg-card transition-colors hover:border-border/80">
					<div class="flex items-start gap-4 px-4 py-3">
						<!-- Status icon -->
						<div class="mt-0.5 shrink-0 {statusColor(result.status)}">
							<Icon name={statusIcon(result.status)} size={16} />
						</div>

						<!-- Repo info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">{result.repo}</span>
								<span class="rounded {statusBadgeClasses(result.status)} px-1.5 py-0.5 text-xs">
									{result.status}
								</span>
							</div>
							<p class="mt-0.5 text-xs text-muted-foreground">{result.statusMessage}</p>

							<!-- Vulnerability breakdown -->
							{#if result.vulnerabilities.length > 0}
								<div class="mt-2 flex flex-wrap gap-1.5">
									{#each result.vulnerabilities as vuln}
										<span class="rounded px-1.5 py-0.5 text-xs {severityBadge(vuln.severity)}">
											{vuln.count} {vuln.severity}
										</span>
									{/each}
								</div>
							{/if}

							<!-- Outdated packages -->
							{#if result.outdated.length > 0}
								<div class="mt-2 space-y-1 rounded-lg bg-muted/30 px-3 py-2">
									<p class="text-xs font-medium text-muted-foreground">
										{result.outdated.length} outdated package{result.outdated.length === 1 ? '' : 's'}:
									</p>
									{#each result.outdated.slice(0, 10) as pkg (pkg.name)}
										<div class="flex items-center justify-between gap-2">
											<span class="truncate font-mono text-xs text-foreground">{pkg.name}</span>
											<span class="shrink-0 text-xs text-muted-foreground">
												{pkg.current} &rarr; {pkg.latest}
											</span>
										</div>
									{/each}
									{#if result.outdated.length > 10}
										<p class="text-xs text-muted-foreground/60">
											...and {result.outdated.length - 10} more
										</p>
									{/if}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/each}

			{#if filtered.length === 0 && filter}
				<p class="py-8 text-center text-sm text-muted-foreground">
					No results matching "{filter}"
				</p>
			{/if}
		</div>
	{/if}
</div>

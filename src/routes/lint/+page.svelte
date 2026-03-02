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
	const linted = $derived(form?.linted ?? data.linted);
	const results = $derived(form?.results ?? data.results);
	const totalRepos = $derived(form?.totalRepos ?? data.totalRepos);
	const totalErrors = $derived((form as Record<string, unknown>)?.totalErrors as number ?? 0);
	const totalWarnings = $derived((form as Record<string, unknown>)?.totalWarnings as number ?? 0);
	const reposWithIssues = $derived((form as Record<string, unknown>)?.reposWithIssues as number ?? 0);

	const filtered = $derived(
		filter
			? results.filter((r: { repo: string }) =>
					r.repo.toLowerCase().includes(filter.toLowerCase())
				)
			: results
	);

	function severityColor(severity: string): string {
		switch (severity) {
			case 'error':
				return 'text-red-600 dark:text-red-400';
			case 'warning':
				return 'text-amber-600 dark:text-amber-400';
			default:
				return 'text-muted-foreground';
		}
	}

	function severityIcon(severity: string): string {
		switch (severity) {
			case 'error':
				return 'alert-circle';
			case 'warning':
				return 'alert-triangle';
			default:
				return 'info';
		}
	}
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Lint</h1>
			<p class="mt-0.5 text-sm text-muted-foreground">
				Aggregated ESLint and TypeScript errors across your repositories.
			</p>
		</div>
		<form
			method="POST"
			action="?/lint"
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
					<Icon name="check-circle" size={12} />
					Run Lint
				{/if}
			</button>
		</form>
	</div>

	{#if data.totalRepos === 0}
		<EmptyState
			icon="check-circle"
			title="No repositories discovered."
			description="Configure repository directories in Settings to run lint checks."
			ctaLabel="Configure Repos"
			ctaHref="/settings"
		/>
	{:else if !linted}
		<EmptyState
			icon="check-circle"
			title="Ready to lint."
			description="Click 'Run Lint' to check {data.totalRepos} repositor{data.totalRepos === 1 ? 'y' : 'ies'} for ESLint and TypeScript issues."
		/>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<StatCard title="Repos Scanned" value={totalRepos} trend="neutral" />
			<StatCard
				title="Errors"
				value={totalErrors}
				trend={totalErrors > 0 ? 'down' : 'neutral'}
			/>
			<StatCard
				title="Warnings"
				value={totalWarnings}
				trend={totalWarnings > 0 ? 'down' : 'neutral'}
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
					placeholder="Filter by repo..."
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
						<div class="mt-0.5 shrink-0 {result.errorCount > 0 ? 'text-red-600 dark:text-red-400' : result.warningCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}">
							<Icon
								name={result.errorCount > 0 ? 'alert-circle' : result.warningCount > 0 ? 'alert-triangle' : 'check-circle'}
								size={16}
							/>
						</div>

						<!-- Repo info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">{result.repo}</span>
								{#if result.errorCount > 0}
									<span class="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
										{result.errorCount} error{result.errorCount === 1 ? '' : 's'}
									</span>
								{/if}
								{#if result.warningCount > 0}
									<span class="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
										{result.warningCount} warning{result.warningCount === 1 ? '' : 's'}
									</span>
								{/if}
								{#if result.errorCount === 0 && result.warningCount === 0}
									<span class="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
										clean
									</span>
								{/if}
							</div>
							<p class="mt-0.5 text-xs text-muted-foreground">
								{#if result.eslintAvailable && result.tscAvailable}
									ESLint + TypeScript
								{:else if result.eslintAvailable}
									ESLint only
								{:else if result.tscAvailable}
									TypeScript only
								{:else}
									No lint tools found
								{/if}
							</p>

							<!-- Issue details (show first 15) -->
							{#if result.eslintIssues.length > 0 || result.tscIssues.length > 0}
								{@const allIssues = [...result.eslintIssues, ...result.tscIssues]}
								<div class="mt-2 space-y-1 rounded-lg bg-muted/30 px-3 py-2">
									{#each allIssues.slice(0, 15) as issue (`${issue.filePath}:${issue.line}:${issue.column}:${issue.ruleId}`)}
										<div class="flex items-start gap-2">
											<span class="mt-0.5 shrink-0 {severityColor(issue.severity)}">
												<Icon name={severityIcon(issue.severity)} size={10} />
											</span>
											<div class="min-w-0 flex-1">
												<span class="font-mono text-xs text-foreground">
													{issue.filePath}:{issue.line}:{issue.column}
												</span>
												<p class="text-xs text-muted-foreground">
													{issue.message}
													<span class="text-muted-foreground/60">({issue.ruleId})</span>
												</p>
											</div>
										</div>
									{/each}
									{#if allIssues.length > 15}
										<p class="text-xs text-muted-foreground/60">
											...and {allIssues.length - 15} more issues
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

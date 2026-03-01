<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	const sortOptions = [
		{ value: 'activity', label: 'Recent Activity' },
		{ value: 'name', label: 'Name' },
		{ value: 'health', label: 'Health' }
	] as const;

	function selectSort(key: string) {
		const url = new URL($page.url);
		const currentKey = url.searchParams.get('sort') ?? 'activity';
		const currentDir = url.searchParams.get('dir') ?? 'desc';

		if (currentKey === key) {
			// Toggle direction
			url.searchParams.set('dir', currentDir === 'desc' ? 'asc' : 'desc');
		} else {
			url.searchParams.set('sort', key);
			url.searchParams.set('dir', key === 'name' ? 'asc' : 'desc');
		}
		goto(url.pathname + url.search, { replaceState: true, noScroll: true });
	}

	function healthColor(health: string): string {
		switch (health) {
			case 'green':
				return 'bg-emerald-500';
			case 'yellow':
				return 'bg-amber-500';
			case 'red':
				return 'bg-red-500';
			default:
				return 'bg-muted-foreground/40';
		}
	}

	function healthLabel(health: string): string {
		switch (health) {
			case 'green':
				return 'Clean';
			case 'yellow':
				return 'Uncommitted';
			case 'red':
				return 'Needs attention';
			default:
				return 'Unknown';
		}
	}

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

	// Summary stats
	const greenCount = $derived(data.repos.filter((r) => r.health === 'green').length);
	const yellowCount = $derived(data.repos.filter((r) => r.health === 'yellow').length);
	const redCount = $derived(data.repos.filter((r) => r.health === 'red').length);
	const totalCommits = $derived(data.repos.reduce((sum, r) => sum + r.commitCount, 0));
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Repos</h1>
			<p class="mt-0.5 text-sm text-muted-foreground">
				Repository health and git status across your workspace.
			</p>
		</div>

		<!-- Sort controls -->
		<div class="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
			{#each sortOptions as opt (opt.value)}
				<button
					onclick={() => selectSort(opt.value)}
					class="rounded-md px-3 py-1 text-xs font-medium transition-colors
						{data.sortKey === opt.value
						? 'bg-card text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					{opt.label}
					{#if data.sortKey === opt.value}
						<span class="ml-0.5 text-[10px]">{data.sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>
					{/if}
				</button>
			{/each}
		</div>
	</div>

	{#if data.repos.length === 0}
		<!-- Empty state -->
		<div class="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 py-16">
			<Icon name="git-branch" size={32} class="text-muted-foreground/40" />
			<p class="text-sm text-muted-foreground">No repositories discovered.</p>
			<p class="text-xs text-muted-foreground">
				Configure repository directories in claudeitor.config.json to scan for repos.
			</p>
		</div>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<StatCard title="Total Repos" value={data.repos.length} trend="neutral" />
			<StatCard title="Commits (30d)" value={totalCommits} trend="neutral" />
			<StatCard
				title="Clean"
				value={greenCount}
				trend="neutral"
				subtitle="{yellowCount} uncommitted, {redCount} need attention"
			/>
			<StatCard title="Skills" value={data.skillCount} trend="neutral" />
		</div>

		<!-- Error notices -->
		{#if data.errors.length > 0}
			<div class="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
				{#each data.errors as error}
					<p class="text-xs text-amber-700 dark:text-amber-300">{error}</p>
				{/each}
			</div>
		{/if}

		<!-- Repo list -->
		<div class="space-y-2">
			{#each data.repos as repo (repo.path)}
				<div class="rounded-xl border border-border bg-card transition-colors hover:border-border/80">
					<div class="flex items-center gap-4 px-4 py-3">
						<!-- Health indicator -->
						<div class="shrink-0" title={healthLabel(repo.health)}>
							<span class="block h-2.5 w-2.5 rounded-full {healthColor(repo.health)}"></span>
						</div>

						<!-- Repo info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">{repo.name}</span>
								<span class="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
									{repo.branch}
								</span>
							</div>
							<p class="mt-0.5 truncate text-xs text-muted-foreground">
								{repo.lastCommitSubject}
							</p>
						</div>

						<!-- Stats -->
						<div class="hidden shrink-0 items-center gap-4 sm:flex">
							{#if repo.uncommittedFileCount > 0}
								<span class="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" title="Uncommitted files">
									<Icon name="file-text" size={12} />
									{repo.uncommittedFileCount}
								</span>
							{/if}
							{#if repo.unpushedCommitCount > 0}
								<span class="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400" title="Unpushed commits">
									<Icon name="arrow-up-right" size={12} />
									{repo.unpushedCommitCount}
								</span>
							{/if}
							<span class="flex items-center gap-1 text-xs text-muted-foreground" title="Commits (30d)">
								<Icon name="git-branch" size={12} />
								{repo.commitCount}
							</span>
						</div>

						<!-- Last activity -->
						<span class="shrink-0 text-xs text-muted-foreground">
							{formatDate(repo.lastCommitDate)}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

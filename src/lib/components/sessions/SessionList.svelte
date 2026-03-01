<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { SessionEntry } from '$lib/data/types';

	interface Props {
		sessions: SessionEntry[];
		totalCount: number;
		totalPages: number;
		currentPage: number;
		query: string;
		sortDir: string;
	}

	const { sessions, totalCount, totalPages, currentPage, query, sortDir }: Props = $props();

	// Intentionally copies query prop as local mutable state for the input field
	let searchValue = $state('');
	$effect(() => {
		searchValue = query;
	});

	function extractRepoName(projectPath: string): string {
		const parts = projectPath.replace(/\/$/, '').split('/');
		return parts[parts.length - 1] || projectPath;
	}

	function formatDate(ts: number): string {
		const d = new Date(ts);
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function buildUrl(params: Record<string, string>): string {
		const sp = new URLSearchParams();
		if (params.q) sp.set('q', params.q);
		if (params.sort) sp.set('sort', params.sort);
		if (params.page && params.page !== '1') sp.set('page', params.page);
		const qs = sp.toString();
		return qs ? `/sessions?${qs}` : '/sessions';
	}
</script>

<!-- Search and controls -->
<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
	<form method="get" action="/sessions" class="relative flex-1 sm:max-w-sm">
		<Icon
			name="search"
			size={16}
			class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
		/>
		<input
			type="text"
			name="q"
			bind:value={searchValue}
			placeholder="Search sessions..."
			class="w-full rounded-lg border border-input bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
		/>
		{#if sortDir !== 'desc'}
			<input type="hidden" name="sort" value={sortDir} />
		{/if}
	</form>

	<div class="flex items-center gap-2 text-sm text-muted-foreground">
		<span>{totalCount} session{totalCount === 1 ? '' : 's'}</span>
		<a
			href={buildUrl({
				q: query,
				sort: sortDir === 'desc' ? 'asc' : 'desc',
				page: '1'
			})}
			class="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
			title="Toggle sort direction"
		>
			<Icon name={sortDir === 'desc' ? 'chevron-down' : 'chevron-up'} size={14} />
			{sortDir === 'desc' ? 'Newest' : 'Oldest'}
		</a>
	</div>
</div>

<!-- Session list -->
{#if sessions.length === 0}
	{#if query}
		<EmptyState
			icon="messages-square"
			title={'No sessions matching "' + query + '"'}
			description="Try a different search term or clear the search to see all sessions."
		/>
	{:else}
		<EmptyState
			icon="messages-square"
			title="No sessions yet."
			description="Sessions will appear here as you use Claude Code. Start a session in your terminal to begin."
		/>
	{/if}
{:else}
	<div class="space-y-1">
		{#each sessions as session (session.sessionId ?? session.timestamp)}
			<a
				href="/sessions/{session.sessionId ?? String(session.timestamp)}"
				class="group flex items-center gap-4 rounded-lg border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-accent/50"
			>
				<div class="min-w-0 flex-1">
					<p class="line-clamp-1 text-sm font-medium text-foreground group-hover:text-foreground">
						{session.display}
					</p>
					<div class="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
						{#if session.project}
							<span class="flex items-center gap-1 truncate">
								<Icon name="folder" size={12} class="shrink-0" />
								<span class="truncate">{extractRepoName(session.project)}</span>
							</span>
						{/if}
						<span class="flex items-center gap-1 shrink-0">
							<Icon name="clock" size={12} class="shrink-0" />
							<span>{formatTime(session.timestamp)}</span>
						</span>
					</div>
				</div>

				<div class="shrink-0 text-right">
					<p class="text-xs text-muted-foreground">{formatDate(session.timestamp)}</p>
				</div>

				<Icon
					name="chevron-right"
					size={16}
					class="shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground"
				/>
			</a>
		{/each}
	</div>
{/if}

<!-- Pagination -->
{#if totalPages > 1}
	<nav class="mt-6 flex items-center justify-center gap-2" aria-label="Session list pagination">
		{#if currentPage > 1}
			<a
				href={buildUrl({ q: query, sort: sortDir, page: String(currentPage - 1) })}
				class="rounded-md border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
			>
				Previous
			</a>
		{/if}

		<span class="px-2 text-sm text-muted-foreground">
			Page {currentPage} of {totalPages}
		</span>

		{#if currentPage < totalPages}
			<a
				href={buildUrl({ q: query, sort: sortDir, page: String(currentPage + 1) })}
				class="rounded-md border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
			>
				Next
			</a>
		{/if}
	</nav>
{/if}

<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Icon from '$lib/components/layout/Icon.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// Filter state synced from server data via $effect.
	// Initialized empty; synced on each navigation so the inputs match URL params.
	let repoFilter = $state('');
	let typeFilter = $state('');
	let dateFrom = $state('');
	let dateTo = $state('');

	$effect(() => {
		repoFilter = data.repoFilter;
		typeFilter = data.typeFilter;
		dateFrom = data.dateFrom;
		dateTo = data.dateTo;
	});

	function applyFilters() {
		const url = new URL($page.url);
		url.searchParams.delete('page'); // reset to page 1

		if (repoFilter) url.searchParams.set('repo', repoFilter);
		else url.searchParams.delete('repo');

		if (typeFilter) url.searchParams.set('type', typeFilter);
		else url.searchParams.delete('type');

		if (dateFrom) url.searchParams.set('from', dateFrom);
		else url.searchParams.delete('from');

		if (dateTo) url.searchParams.set('to', dateTo);
		else url.searchParams.delete('to');

		goto(url.pathname + url.search, { replaceState: true, noScroll: true });
	}

	function clearFilters() {
		repoFilter = '';
		typeFilter = '';
		dateFrom = '';
		dateTo = '';
		goto('/timeline', { replaceState: true, noScroll: true });
	}

	function goToPage(pg: number) {
		const url = new URL($page.url);
		url.searchParams.set('page', String(pg));
		goto(url.pathname + url.search, { replaceState: true, noScroll: true });
	}

	const hasFilters = $derived(
		data.repoFilter !== '' ||
			data.typeFilter !== '' ||
			data.dateFrom !== '' ||
			data.dateTo !== ''
	);

	function formatTimestamp(ts: number): string {
		const date = new Date(ts);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	function formatDay(ts: number): string {
		const date = new Date(ts);
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function eventIcon(type: string): string {
		return type === 'commit' ? 'git-branch' : 'messages-square';
	}

	function eventColor(type: string): string {
		return type === 'commit'
			? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
			: 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
	}

	function dotColor(type: string): string {
		return type === 'commit' ? 'bg-emerald-500' : 'bg-blue-500';
	}

	// Group events by day for visual separation
	interface DayGroup {
		label: string;
		events: typeof data.events;
	}

	const groupedByDay = $derived.by(() => {
		const groups: DayGroup[] = [];
		let currentLabel = '';
		let currentEvents: typeof data.events = [];

		for (const event of data.events) {
			const dayLabel = formatDay(event.timestamp);
			if (dayLabel !== currentLabel) {
				if (currentEvents.length > 0) {
					groups.push({ label: currentLabel, events: currentEvents });
				}
				currentLabel = dayLabel;
				currentEvents = [event];
			} else {
				currentEvents.push(event);
			}
		}

		if (currentEvents.length > 0) {
			groups.push({ label: currentLabel, events: currentEvents });
		}

		return groups;
	});
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Timeline</h1>
		<p class="mt-0.5 text-sm text-muted-foreground">
			Chronological view of commits and sessions across all repositories.
		</p>
	</div>

	<!-- Filters -->
	<div class="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card px-4 py-3">
		<div class="flex flex-col gap-1">
			<label for="repo-filter" class="text-xs font-medium text-muted-foreground">Repository</label>
			<select
				id="repo-filter"
				bind:value={repoFilter}
				onchange={applyFilters}
				class="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
			>
				<option value="">All repos</option>
				{#each data.repoNames as name (name)}
					<option value={name}>{name}</option>
				{/each}
			</select>
		</div>

		<div class="flex flex-col gap-1">
			<label for="type-filter" class="text-xs font-medium text-muted-foreground">Type</label>
			<select
				id="type-filter"
				bind:value={typeFilter}
				onchange={applyFilters}
				class="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
			>
				<option value="">All types</option>
				<option value="commit">Commits</option>
				<option value="session">Sessions</option>
			</select>
		</div>

		<div class="flex flex-col gap-1">
			<label for="date-from" class="text-xs font-medium text-muted-foreground">From</label>
			<input
				id="date-from"
				type="date"
				bind:value={dateFrom}
				onchange={applyFilters}
				class="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
			/>
		</div>

		<div class="flex flex-col gap-1">
			<label for="date-to" class="text-xs font-medium text-muted-foreground">To</label>
			<input
				id="date-to"
				type="date"
				bind:value={dateTo}
				onchange={applyFilters}
				class="rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground"
			/>
		</div>

		{#if hasFilters}
			<button
				onclick={clearFilters}
				class="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				Clear filters
			</button>
		{/if}

		<span class="ml-auto text-xs text-muted-foreground">
			{data.totalCount} event{data.totalCount === 1 ? '' : 's'}
		</span>
	</div>

	{#if data.events.length === 0}
		{#if hasFilters}
			<EmptyState
				icon="calendar"
				title="No events match your filters."
				description="Try adjusting your filter criteria or clear all filters to see all events."
			/>
		{:else}
			<EmptyState
				icon="calendar"
				title="No timeline events yet."
				description="Configure repository directories in Settings to populate the timeline."
				ctaLabel="Configure Repos"
				ctaHref="/settings"
			/>
		{/if}
	{:else}
		<!-- Timeline -->
		<div class="space-y-6">
			{#each groupedByDay as group (group.label)}
				<!-- Day header -->
				<div>
					<h3 class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						{group.label}
					</h3>

					<div class="relative ml-3 border-l-2 border-border pl-6">
						{#each group.events as event (event.id)}
							<div class="relative mb-4 last:mb-0">
								<!-- Timeline dot -->
								<div class="absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full {dotColor(event.type)} ring-2 ring-background"></div>

								<div class="rounded-lg border border-border/50 bg-card p-3 transition-colors hover:border-border">
									<div class="flex items-start gap-3">
										<div class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded {eventColor(event.type)}">
											<Icon name={eventIcon(event.type)} size={12} />
										</div>

										<div class="min-w-0 flex-1">
											<p class="text-sm text-foreground">{event.title}</p>
											<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
												<span>{event.detail}</span>
												{#if event.repo}
													<span class="rounded bg-muted px-1.5 py-0.5">{event.repo}</span>
												{/if}
												{#if event.meta?.hash}
													<code class="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
														{event.meta.hash}
													</code>
												{/if}
											</div>
										</div>

										<span class="shrink-0 text-xs text-muted-foreground">
											{formatTimestamp(event.timestamp)}
										</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<!-- Pagination -->
		{#if data.totalPages > 1}
			<div class="flex items-center justify-center gap-2">
				<button
					onclick={() => goToPage(data.currentPage - 1)}
					disabled={data.currentPage <= 1}
					class="rounded-md border border-border px-3 py-1.5 text-xs transition-colors
						{data.currentPage <= 1
						? 'cursor-not-allowed text-muted-foreground/40'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					Previous
				</button>

				<span class="text-xs text-muted-foreground">
					Page {data.currentPage} of {data.totalPages}
				</span>

				<button
					onclick={() => goToPage(data.currentPage + 1)}
					disabled={data.currentPage >= data.totalPages}
					class="rounded-md border border-border px-3 py-1.5 text-xs transition-colors
						{data.currentPage >= data.totalPages
						? 'cursor-not-allowed text-muted-foreground/40'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					Next
				</button>
			</div>
		{/if}
	{/if}
</div>

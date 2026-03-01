<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import CostTrendChart from '$lib/components/charts/CostTrendChart.svelte';
	import CostBreakdownChart from '$lib/components/charts/CostBreakdownChart.svelte';
	import Icon from '$lib/components/layout/Icon.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import { formatCurrency, formatNumber } from '$lib/utils/chart-helpers';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// Date range tabs
	const ranges = [
		{ value: 7, label: '7d' },
		{ value: 14, label: '14d' },
		{ value: 30, label: '30d' },
		{ value: 90, label: '90d' }
	] as const;

	function selectRange(range: number) {
		const url = new URL($page.url);
		url.searchParams.set('range', String(range));
		goto(url.pathname + url.search, { replaceState: true, noScroll: true });
	}

	// Table sorting
	type SortKey = 'date' | 'model' | 'inputTokens' | 'outputTokens' | 'cacheTokens' | 'cost';
	let sortKey: SortKey = $state('date');
	let sortAsc = $state(false);

	function toggleSort(key: SortKey) {
		if (sortKey === key) {
			sortAsc = !sortAsc;
		} else {
			sortKey = key;
			sortAsc = key === 'model' || key === 'date';
		}
	}

	const sortedRows = $derived.by(() => {
		const rows = [...data.tableRows];
		const dir = sortAsc ? 1 : -1;

		rows.sort((a, b) => {
			switch (sortKey) {
				case 'date':
					return dir * a.date.localeCompare(b.date);
				case 'model':
					return dir * a.model.localeCompare(b.model);
				case 'inputTokens':
					return dir * (a.inputTokens - b.inputTokens);
				case 'outputTokens':
					return dir * (a.outputTokens - b.outputTokens);
				case 'cacheTokens':
					return dir * (a.cacheTokens - b.cacheTokens);
				case 'cost':
					return dir * (a.cost - b.cost);
				default:
					return 0;
			}
		});

		return rows;
	});

	function sortIcon(key: SortKey): string {
		if (sortKey !== key) return '';
		return sortAsc ? '\u25B2' : '\u25BC';
	}

	const hasData = $derived(data.daily.length > 0 || data.byModel.length > 0);
</script>

<div class="space-y-6">
	<!-- Page header with date range selector -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Costs</h1>
			<p class="mt-0.5 text-sm text-muted-foreground">
				Token usage and estimated costs by model.
			</p>
		</div>

		<!-- Date range selector -->
		<div class="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
			{#each ranges as r (r.value)}
				<button
					onclick={() => selectRange(r.value)}
					class="rounded-md px-3 py-1 text-xs font-medium transition-colors
						{data.range === r.value
						? 'bg-card text-foreground shadow-sm'
						: 'text-muted-foreground hover:text-foreground'}"
				>
					{r.label}
				</button>
			{/each}
		</div>
	</div>

	{#if !hasData}
		<EmptyState
			icon="dollar-sign"
			title="No cost data available yet."
			description="Cost data is collected automatically from your Claude Code usage. Start a session to begin tracking costs."
		/>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			<StatCard title="Total Cost" value={formatCurrency(data.totalCost)} trend="neutral" />
			<StatCard title="Today" value={formatCurrency(data.costToday)} trend="neutral" />
			<StatCard title="This Week" value={formatCurrency(data.costThisWeek)} trend="neutral" />
			<StatCard title="This Month" value={formatCurrency(data.costThisMonth)} trend="neutral" />
		</div>

		<!-- Charts row -->
		<div class="grid gap-4 lg:grid-cols-2">
			<div class="rounded-xl border border-border bg-card p-4">
				<h2 class="mb-3 text-sm font-medium text-foreground">Daily Cost Trend</h2>
				<CostTrendChart data={data.daily} />
			</div>
			<div class="rounded-xl border border-border bg-card p-4">
				<h2 class="mb-3 text-sm font-medium text-foreground">Cost by Model</h2>
				<CostBreakdownChart data={data.byModel} />
			</div>
		</div>

		<!-- Cost table -->
		<div class="rounded-xl border border-border bg-card">
			<div class="border-b border-border px-4 py-3">
				<h2 class="text-sm font-medium text-foreground">Cost Details</h2>
			</div>

			{#if sortedRows.length === 0}
				<div class="px-4 py-8 text-center text-sm text-muted-foreground">
					No detailed cost data for the selected range.
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-border text-left">
								{#each [
									{ key: 'date', label: 'Date' },
									{ key: 'model', label: 'Model' },
									{ key: 'inputTokens', label: 'Input' },
									{ key: 'outputTokens', label: 'Output' },
									{ key: 'cacheTokens', label: 'Cache' },
									{ key: 'cost', label: 'Cost' }
								] as col (col.key)}
									<th class="px-4 py-2">
										<button
											onclick={() => toggleSort(col.key as SortKey)}
											class="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
										>
											{col.label}
											<span class="text-[10px]">{sortIcon(col.key as SortKey)}</span>
										</button>
									</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each sortedRows as row (row.date + row.model)}
								<tr class="border-b border-border/50 transition-colors hover:bg-muted/30">
									<td class="px-4 py-2 text-muted-foreground">{row.date}</td>
									<td class="px-4 py-2 font-medium text-foreground">{row.model}</td>
									<td class="px-4 py-2 tabular-nums text-muted-foreground">
										{formatNumber(row.inputTokens)}
									</td>
									<td class="px-4 py-2 tabular-nums text-muted-foreground">
										{formatNumber(row.outputTokens)}
									</td>
									<td class="px-4 py-2 tabular-nums text-muted-foreground">
										{formatNumber(row.cacheTokens)}
									</td>
									<td class="px-4 py-2 tabular-nums font-medium text-foreground">
										{formatCurrency(row.cost)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>

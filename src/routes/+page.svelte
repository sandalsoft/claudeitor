<script lang="ts">
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import InfoCard from '$lib/components/cards/InfoCard.svelte';
	import SessionCard from '$lib/components/cards/SessionCard.svelte';
	import AlertCard from '$lib/components/cards/AlertCard.svelte';
	import RepoChip from '$lib/components/cards/RepoChip.svelte';
	import ActivityChart from '$lib/components/charts/ActivityChart.svelte';
	import HourlyDistributionChart from '$lib/components/charts/HourlyDistributionChart.svelte';
	import CostByModelChart from '$lib/components/charts/CostByModelChart.svelte';
	import Icon from '$lib/components/layout/Icon.svelte';
	import { realtime } from '$lib/stores/realtime.svelte';
	import { formatCurrency } from '$lib/utils/chart-helpers';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	// Connect SSE on mount, disconnect on destroy
	$effect(() => {
		realtime.connect();
		return () => realtime.disconnect();
	});

	// Merge server data with SSE live updates
	const stats = $derived(realtime.stats ?? data.stats);
	const costSummary = $derived(data.costSummary);

	// Stat card values
	const repoCount = $derived(data.repoCount);
	const commitsToday = $derived(data.commitsToday);
	const totalSessions = $derived(stats.totalSessions);
	const totalCost = $derived(costSummary.totalCostUSD);

	// Chart data
	const dailyActivity = $derived(stats.dailyActivity);
	const hourCounts = $derived(stats.hourCounts);
	const costByModel = $derived(
		costSummary.byModel.map((m) => ({ model: m.pricingKey, cost: m.totalCostUSD }))
	);

	// Activity level for repo chips
	function getActivityLevel(activity: number): 'high' | 'medium' | 'low' | 'none' {
		if (activity >= 20) return 'high';
		if (activity >= 5) return 'medium';
		if (activity > 0) return 'low';
		return 'none';
	}

	// Connection status indicator
	const statusColor = $derived.by(() => {
		switch (realtime.status) {
			case 'connected':
				return 'bg-success';
			case 'connecting':
				return 'bg-warning';
			case 'error':
				return 'bg-destructive';
			default:
				return 'bg-muted-foreground/40';
		}
	});
</script>

<div class="space-y-6">
	<!-- Page header with SSE status -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Readout</h1>
			<p class="mt-0.5 text-sm text-muted-foreground">
				Your coding activity at a glance.
			</p>
		</div>
		<div class="flex items-center gap-2 text-xs text-muted-foreground" title="Live connection: {realtime.status}">
			<span class="h-2 w-2 rounded-full {statusColor}"></span>
			<span class="hidden sm:inline">{realtime.status === 'connected' ? 'Live' : realtime.status}</span>
		</div>
	</div>

	<!-- AI Summary placeholder -->
	{#if data.hasApiKey}
		<div class="rounded-xl border border-border bg-card p-4">
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<Icon name="sparkles" size={16} />
				<span>AI insights will appear here</span>
			</div>
		</div>
	{:else}
		<div class="rounded-xl border border-dashed border-border bg-muted/30 p-4">
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<Icon name="sparkles" size={16} />
				<span>Configure API key in <a href="/settings" class="underline underline-offset-2 hover:text-foreground">Settings</a> for AI insights</span>
			</div>
		</div>
	{/if}

	<!-- Top stat cards: 4 columns -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<StatCard
			title="Repos"
			value={repoCount}
			subtitle="{data.repos.length} tracked"
			href="/repos"
			trend="neutral"
		/>
		<StatCard
			title="Commits Today"
			value={commitsToday}
			trend={commitsToday > 0 ? 'up' : 'neutral'}
		/>
		<StatCard
			title="Sessions"
			value={totalSessions.toLocaleString()}
			subtitle="all time"
			href="/sessions"
			trend="neutral"
		/>
		<StatCard
			title="Est. Cost"
			value={formatCurrency(totalCost)}
			subtitle="all time"
			href="/costs"
			trend="neutral"
		/>
	</div>

	<!-- Charts row: Activity + When You Work -->
	<div class="grid gap-4 lg:grid-cols-2">
		<div class="rounded-xl border border-border bg-card p-4">
			<h2 class="mb-3 text-sm font-medium text-foreground">Activity (30 days)</h2>
			<ActivityChart data={dailyActivity} />
		</div>
		<div class="rounded-xl border border-border bg-card p-4">
			<h2 class="mb-3 text-sm font-medium text-foreground">When You Work</h2>
			<HourlyDistributionChart data={hourCounts} />
		</div>
	</div>

	<!-- Middle row: Cost by Model + Recent Sessions -->
	<div class="grid gap-4 lg:grid-cols-2">
		<div class="rounded-xl border border-border bg-card p-4">
			<h2 class="mb-3 text-sm font-medium text-foreground">Cost by Model</h2>
			<CostByModelChart data={costByModel} />
		</div>

		<div class="rounded-xl border border-border bg-card p-4">
			<h2 class="mb-3 text-sm font-medium text-foreground">Recent Sessions</h2>
			{#if data.recentSessions.length === 0}
				<p class="py-4 text-center text-sm text-muted-foreground">No sessions yet</p>
			{:else}
				<div class="space-y-2">
					{#each data.recentSessions as session (session.sessionId ?? session.timestamp)}
						<SessionCard
							sessionId={session.sessionId ?? String(session.timestamp)}
							description={session.display}
							project={session.project}
							timestamp={session.timestamp}
						/>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Alerts section -->
	{#if data.alerts.length > 0}
		<div>
			<h2 class="mb-3 text-sm font-medium text-foreground">Alerts</h2>
			<div class="space-y-2">
				{#each data.alerts as alert (alert.id)}
					<AlertCard
						id={alert.id}
						message={alert.message}
						severity={alert.severity}
					/>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Recently Active repos -->
	{#if data.activeRepos.length > 0}
		<div>
			<h2 class="mb-3 text-sm font-medium text-foreground">Recently Active</h2>
			<div class="flex flex-wrap gap-2">
				{#each data.activeRepos as repo (repo.name)}
					<RepoChip
						name={repo.name}
						href="/repos"
						activity={getActivityLevel(repo.activity)}
					/>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Bottom info cards: 4 columns -->
	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		<InfoCard title="Skills" icon="sparkles" count={data.skills} href="/skills" />
		<InfoCard title="Agents" icon="bot" count={data.agents} href="/agents" />
		<InfoCard title="Memory" icon="brain" count="{data.memoryLines} lines" href="/memory" />
		<InfoCard title="Repos" icon="git-branch" count={data.repoCount} href="/repos">
			{#if data.repos.length > 0}
				<p class="truncate text-xs text-muted-foreground">
					{data.repos.slice(0, 3).join(', ')}{data.repos.length > 3 ? '...' : ''}
				</p>
			{/if}
		</InfoCard>
	</div>
</div>

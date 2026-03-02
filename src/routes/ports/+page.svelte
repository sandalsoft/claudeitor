<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Icon from '$lib/components/layout/Icon.svelte';
	import StatCard from '$lib/components/cards/StatCard.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	function refresh() {
		const url = new URL($page.url);
		url.searchParams.set('refresh', '1');
		goto(url.pathname + url.search, { replaceState: true, noScroll: true });
	}

	const hasConflict = $derived(data.conflictCount > 0);
</script>

<div class="space-y-6">
	<!-- Page header -->
	<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold text-foreground">Ports</h1>
			<p class="mt-0.5 text-sm text-muted-foreground">
				Active network ports listening on this machine.
				{#if data.cached}
					<span class="text-xs text-muted-foreground/60">(cached)</span>
				{/if}
			</p>
		</div>
		<button
			onclick={refresh}
			class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent/50"
		>
			<Icon name="refresh-cw" size={12} />
			Refresh
		</button>
	</div>

	{#if !data.supported}
		<EmptyState
			icon="alert-circle"
			title="Platform not supported."
			description="Port scanning is currently only available on macOS."
		/>
	{:else if data.error}
		<div class="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
			<p class="text-xs text-red-700 dark:text-red-300">{data.error}</p>
		</div>
	{:else if data.ports.length === 0}
		<EmptyState
			icon="network"
			title="No listening ports detected."
			description="No processes are currently listening on any ports."
		/>
	{:else}
		<!-- Summary stat cards -->
		<div class="grid grid-cols-3 gap-3">
			<StatCard title="Listening Ports" value={data.totalPorts} trend="neutral" />
			<StatCard title="Processes" value={data.processCount} trend="neutral" />
			<StatCard
				title="Conflicts"
				value={data.conflictCount}
				trend={hasConflict ? 'down' : 'neutral'}
				subtitle={hasConflict ? 'Multiple processes on same port' : 'No conflicts'}
			/>
		</div>

		<!-- Port list -->
		<div class="space-y-2">
			{#each data.ports as port (`${port.pid}:${port.port}`)}
				<div class="rounded-xl border border-border bg-card transition-colors hover:border-border/80">
					<div class="flex items-center gap-4 px-4 py-3">
						<!-- Port number -->
						<div class="shrink-0">
							<span class="rounded bg-muted px-2 py-0.5 font-mono text-sm font-semibold text-foreground">
								{port.port}
							</span>
						</div>

						<!-- Process info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-sm font-medium text-foreground">{port.command}</span>
								<span class="text-xs text-muted-foreground">PID {port.pid}</span>
							</div>
							<p class="mt-0.5 text-xs text-muted-foreground">
								{port.address} &middot; {port.protocol} &middot; {port.user}
							</p>
						</div>

						<!-- Protocol badge -->
						<span class="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
							{port.protocol}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

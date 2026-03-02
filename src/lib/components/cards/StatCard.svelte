<script lang="ts">
	import Icon from '$lib/components/layout/Icon.svelte';

	type Trend = 'up' | 'down' | 'neutral';

	interface Props {
		title: string;
		value: string | number;
		/** Explicit trend override. If omitted, derived from current/previous. */
		trend?: Trend;
		/** Current period numeric value (used to compute trend when trend prop is omitted). */
		current?: number;
		/** Previous period numeric value (used to compute trend when trend prop is omitted). */
		previous?: number;
		subtitle?: string;
		href?: string;
		class?: string;
	}

	const {
		title,
		value,
		trend,
		current,
		previous,
		subtitle,
		href,
		class: className = ''
	}: Props = $props();

	function computeTrend(cur?: number, prev?: number): Trend {
		if (cur === undefined || prev === undefined) return 'neutral';
		if (cur > prev) return 'up';
		if (cur < prev) return 'down';
		return 'neutral';
	}

	const resolvedTrend = $derived(trend ?? computeTrend(current, previous));

	const trendColors: Record<Trend, string> = {
		up: 'bg-success',
		down: 'bg-destructive',
		neutral: 'bg-muted-foreground/40'
	};

	const trendLabels: Record<Trend, string> = {
		up: 'Trending up',
		down: 'Trending down',
		neutral: 'No change'
	};
</script>

{#snippet cardContent()}
	<div class="flex items-start justify-between">
		<div class="min-w-0 flex-1">
			<p class="truncate text-xs font-medium text-muted-foreground">{title}</p>
			<div class="mt-1.5 flex items-center gap-2">
				<span class="text-2xl font-semibold tracking-tight text-foreground">{value}</span>
				<span
					class="h-2 w-2 shrink-0 rounded-full {trendColors[resolvedTrend]}"
					title={trendLabels[resolvedTrend]}
					aria-label={trendLabels[resolvedTrend]}
				></span>
			</div>
			{#if subtitle}
				<p class="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
			{/if}
		</div>
		{#if href}
			<Icon name="arrow-up-right" size={14} class="shrink-0 text-muted-foreground/60" />
		{/if}
	</div>
{/snippet}

{#if href}
	<a
		{href}
		class="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80 hover:bg-accent/50 {className}"
	>
		{@render cardContent()}
	</a>
{:else}
	<div class="rounded-xl border border-border bg-card p-4 {className}">
		{@render cardContent()}
	</div>
{/if}

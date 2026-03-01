<script lang="ts">
	import * as d3 from 'd3';
	import { formatCurrency, chartColor } from '$lib/utils/chart-helpers';
	import ChartTooltip from './ChartTooltip.svelte';

	interface ModelCost {
		modelId: string;
		pricingKey: string;
		totalCostUSD: number;
	}

	interface Props {
		data: ModelCost[];
		class?: string;
	}

	const { data, class: className = '' }: Props = $props();

	let containerWidth = $state(0);
	let containerEl: HTMLDivElement | undefined = $state();

	const sortedData = $derived(
		[...data].filter((d) => d.totalCostUSD > 0).sort((a, b) => b.totalCostUSD - a.totalCostUSD)
	);
	const isEmpty = $derived(sortedData.length === 0);
	const totalCost = $derived(sortedData.reduce((sum, d) => sum + d.totalCostUSD, 0));

	// Donut dimensions
	const size = $derived(Math.min(containerWidth, 240));
	const radius = $derived(size / 2);
	const innerRadius = $derived(radius * 0.55);

	// D3 pie layout
	const pie = d3
		.pie<ModelCost>()
		.value((d) => d.totalCostUSD)
		.sort(null)
		.padAngle(0.02);

	const arcs = $derived(pie(sortedData));

	const arcGenerator = $derived(
		d3.arc<d3.PieArcDatum<ModelCost>>().innerRadius(innerRadius).outerRadius(radius - 2)
	);

	// Tooltip
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipEntry: ModelCost | null = $state(null);

	function handleArcEnter(event: MouseEvent, entry: ModelCost) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
		tooltipEntry = entry;
		tooltipVisible = true;
	}

	function handleArcMove(event: MouseEvent) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
	}

	function handleArcLeave() {
		tooltipVisible = false;
		tooltipEntry = null;
	}
</script>

<div class="relative {className}" bind:this={containerEl} bind:clientWidth={containerWidth}>
	{#if isEmpty}
		<div
			class="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
			style="height: 200px;"
		>
			No cost data available
		</div>
	{:else}
		<div class="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
			<!-- Donut chart -->
			<svg width={size} height={size} class="shrink-0">
				<g transform="translate({radius},{radius})">
					{#each arcs as arc, i (arc.data.pricingKey)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<path
							d={arcGenerator(arc) ?? ''}
							fill={chartColor(i)}
							fill-opacity="0.8"
							class="transition-opacity hover:fill-opacity-100"
							onmouseenter={(e) => handleArcEnter(e, arc.data)}
							onmousemove={handleArcMove}
							onmouseleave={handleArcLeave}
						/>
					{/each}
					<!-- Center label -->
					<text
						text-anchor="middle"
						dominant-baseline="central"
						fill="var(--color-foreground)"
						font-size="16"
						font-weight="600"
					>
						{formatCurrency(totalCost)}
					</text>
				</g>
			</svg>

			<!-- Legend -->
			<div class="flex flex-col gap-1.5">
				{#each sortedData.slice(0, 8) as entry, i (entry.pricingKey)}
					{@const pct = totalCost > 0 ? ((entry.totalCostUSD / totalCost) * 100).toFixed(1) : '0'}
					<div class="flex items-center gap-2 text-xs">
						<span
							class="h-2.5 w-2.5 shrink-0 rounded-full"
							style="background: {chartColor(i)}"
						></span>
						<span class="text-foreground">{entry.pricingKey}</span>
						<span class="text-muted-foreground">{formatCurrency(entry.totalCostUSD)} ({pct}%)</span>
					</div>
				{/each}
			</div>
		</div>

		<ChartTooltip visible={tooltipVisible} x={tooltipX} y={tooltipY}>
			{#if tooltipEntry}
				<p class="font-medium text-foreground">{tooltipEntry.pricingKey}</p>
				<p class="mt-0.5 text-muted-foreground">{formatCurrency(tooltipEntry.totalCostUSD)}</p>
				{#if totalCost > 0}
					<p class="text-muted-foreground">
						{((tooltipEntry.totalCostUSD / totalCost) * 100).toFixed(1)}% of total
					</p>
				{/if}
			{/if}
		</ChartTooltip>
	{/if}
</div>

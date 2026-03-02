<script lang="ts">
	import * as d3 from 'd3';
	import type { DailyActivity } from '$lib/data/types';
	import {
		formatNumber,
		formatDateShort,
		computeDimensions,
		type ChartDimensions
	} from '$lib/utils/chart-helpers';
	import ChartTooltip from './ChartTooltip.svelte';

	interface Props {
		/** Daily activity data (up to 30 days). */
		data: DailyActivity[];
		/** Fired when a bar is clicked. Payload is the date string. */
		onDateSelect?: (date: string) => void;
		class?: string;
	}

	const { data, onDateSelect, class: className = '' }: Props = $props();

	// ── Responsive container ──────────────────────────────────────
	let containerWidth = $state(0);
	let svgEl: SVGSVGElement | undefined = $state();
	let containerEl: HTMLDivElement | undefined = $state();

	const MARGIN = { top: 12, right: 8, bottom: 32, left: 44 };
	const ASPECT_RATIO = 2.5; // width:height

	const dims: ChartDimensions = $derived(computeDimensions(containerWidth, ASPECT_RATIO, MARGIN));

	// ── Scales ────────────────────────────────────────────────────
	const sortedData = $derived([...data].sort((a, b) => a.date.localeCompare(b.date)));

	const xScale = $derived(
		d3
			.scaleBand<string>()
			.domain(sortedData.map((d) => d.date))
			.range([0, dims.innerWidth])
			.padding(0.2)
	);

	const yMax = $derived(d3.max(sortedData, (d) => d.messageCount) ?? 0);

	const yScale = $derived(
		d3
			.scaleLinear()
			.domain([0, yMax * 1.1 || 10])
			.nice()
			.range([dims.innerHeight, 0])
	);

	// ── D3 axis rendering ────────────────────────────────────────
	$effect(() => {
		if (!svgEl) return;

		const svg = d3.select(svgEl);

		// X axis: show every Nth label to avoid crowding
		const labelEvery = sortedData.length > 15 ? 3 : sortedData.length > 7 ? 2 : 1;
		const xAxis = d3
			.axisBottom(xScale)
			.tickFormat((d, i) => (i % labelEvery === 0 ? formatDateShort(d) : ''))
			.tickSizeOuter(0);

		svg
			.select<SVGGElement>('.x-axis')
			.attr('transform', `translate(${MARGIN.left},${MARGIN.top + dims.innerHeight})`)
			.call(xAxis)
			.call((g) => g.select('.domain').attr('stroke', 'var(--color-border)'))
			.call((g) =>
				g
					.selectAll('.tick line')
					.attr('stroke', 'var(--color-border)')
					.attr('stroke-opacity', 0.5)
			)
			.call((g) =>
				g.selectAll('.tick text').attr('fill', 'var(--color-muted-foreground)').attr('font-size', 10)
			);

		// Y axis
		const yAxis = d3
			.axisLeft(yScale)
			.ticks(5)
			.tickFormat((d) => formatNumber(d.valueOf()))
			.tickSizeOuter(0);

		svg
			.select<SVGGElement>('.y-axis')
			.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
			.call(yAxis)
			.call((g) => g.select('.domain').remove())
			.call((g) =>
				g
					.selectAll('.tick line')
					.attr('stroke', 'var(--color-border)')
					.attr('stroke-opacity', 0.3)
					.attr('x2', dims.innerWidth)
			)
			.call((g) =>
				g.selectAll('.tick text').attr('fill', 'var(--color-muted-foreground)').attr('font-size', 10)
			);
	});

	// ── Tooltip state ────────────────────────────────────────────
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipData: DailyActivity | null = $state(null);

	function handleBarEnter(event: MouseEvent, d: DailyActivity) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
		tooltipData = d;
		tooltipVisible = true;
	}

	function handleBarMove(event: MouseEvent) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
	}

	function handleBarLeave() {
		tooltipVisible = false;
		tooltipData = null;
	}

	function handleBarClick(d: DailyActivity) {
		onDateSelect?.(d.date);
	}

	// ── Empty state ──────────────────────────────────────────────
	const isEmpty = $derived(sortedData.length === 0);
</script>

<div class="relative {className}" bind:this={containerEl} bind:clientWidth={containerWidth}>
	{#if isEmpty}
		<div
			class="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
			style="height: {dims.height}px;"
		>
			No activity data available
		</div>
	{:else}
		<svg bind:this={svgEl} width={dims.width} height={dims.height} class="overflow-visible">
			<g class="x-axis"></g>
			<g class="y-axis"></g>
			<g transform="translate({MARGIN.left},{MARGIN.top})">
				{#each sortedData as d (d.date)}
					{@const barX = xScale(d.date) ?? 0}
					{@const barHeight = dims.innerHeight - yScale(d.messageCount)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<rect
						x={barX}
						y={yScale(d.messageCount)}
						width={xScale.bandwidth()}
						height={Math.max(barHeight, 0)}
						rx="2"
						class="fill-primary/70 transition-colors hover:fill-primary"
						style={onDateSelect ? 'cursor: pointer;' : ''}
						onmouseenter={(e) => handleBarEnter(e, d)}
						onmousemove={handleBarMove}
						onmouseleave={handleBarLeave}
						onclick={() => handleBarClick(d)}
					/>
				{/each}
			</g>
		</svg>

		<ChartTooltip visible={tooltipVisible} x={tooltipX} y={tooltipY}>
			{#if tooltipData}
				<p class="font-medium text-foreground">{formatDateShort(tooltipData.date)}</p>
				<div class="mt-1 space-y-0.5 text-muted-foreground">
					<p>{formatNumber(tooltipData.messageCount)} messages</p>
					<p>{formatNumber(tooltipData.sessionCount)} sessions</p>
				</div>
			{/if}
		</ChartTooltip>
	{/if}
</div>

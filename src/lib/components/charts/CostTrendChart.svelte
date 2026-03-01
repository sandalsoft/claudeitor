<script lang="ts">
	import * as d3 from 'd3';
	import {
		formatCurrency,
		formatDateShort,
		computeDimensions,
		chartColor,
		type ChartDimensions
	} from '$lib/utils/chart-helpers';
	import ChartTooltip from './ChartTooltip.svelte';

	interface DailyCost {
		date: string;
		totalCostUSD: number;
		byModel: Record<string, number>;
	}

	interface Props {
		data: DailyCost[];
		class?: string;
	}

	const { data, class: className = '' }: Props = $props();

	let containerWidth = $state(0);
	let svgEl: SVGSVGElement | undefined = $state();
	let containerEl: HTMLDivElement | undefined = $state();

	const MARGIN = { top: 12, right: 8, bottom: 32, left: 52 };
	const ASPECT_RATIO = 2.5;

	const dims: ChartDimensions = $derived(computeDimensions(containerWidth, ASPECT_RATIO, MARGIN));

	const sortedData = $derived([...data].sort((a, b) => a.date.localeCompare(b.date)));
	const isEmpty = $derived(sortedData.length === 0 || sortedData.every((d) => d.totalCostUSD === 0));

	// Collect all model keys across all days for stacked area
	const modelKeys = $derived.by(() => {
		const keys = new Set<string>();
		for (const d of sortedData) {
			for (const k of Object.keys(d.byModel)) keys.add(k);
		}
		return [...keys].sort();
	});

	const xScale = $derived(
		d3
			.scalePoint<string>()
			.domain(sortedData.map((d) => d.date))
			.range([0, dims.innerWidth])
			.padding(0.5)
	);

	const yMax = $derived(d3.max(sortedData, (d) => d.totalCostUSD) ?? 0);

	const yScale = $derived(
		d3
			.scaleLinear()
			.domain([0, yMax * 1.15 || 1])
			.nice()
			.range([dims.innerHeight, 0])
	);

	// Generate area path for total cost
	const areaPath = $derived.by(() => {
		if (sortedData.length === 0) return '';
		const area = d3
			.area<DailyCost>()
			.x((d) => xScale(d.date) ?? 0)
			.y0(dims.innerHeight)
			.y1((d) => yScale(d.totalCostUSD))
			.curve(d3.curveMonotoneX);
		return area(sortedData) ?? '';
	});

	const linePath = $derived.by(() => {
		if (sortedData.length === 0) return '';
		const line = d3
			.line<DailyCost>()
			.x((d) => xScale(d.date) ?? 0)
			.y((d) => yScale(d.totalCostUSD))
			.curve(d3.curveMonotoneX);
		return line(sortedData) ?? '';
	});

	// D3 axes
	$effect(() => {
		if (!svgEl) return;

		const svg = d3.select(svgEl);

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

		const yAxis = d3
			.axisLeft(yScale)
			.ticks(5)
			.tickFormat((d) => formatCurrency(d.valueOf()))
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

	// Tooltip
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipData: DailyCost | null = $state(null);

	function handleMouseMove(event: MouseEvent) {
		if (!containerEl || sortedData.length === 0) return;
		const rect = containerEl.getBoundingClientRect();
		const mouseX = event.clientX - rect.left - MARGIN.left;

		// Find closest data point
		let closest = sortedData[0];
		let closestDist = Infinity;
		for (const d of sortedData) {
			const dx = Math.abs((xScale(d.date) ?? 0) - mouseX);
			if (dx < closestDist) {
				closestDist = dx;
				closest = d;
			}
		}

		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
		tooltipData = closest;
		tooltipVisible = true;
	}

	function handleMouseLeave() {
		tooltipVisible = false;
		tooltipData = null;
	}
</script>

<div class="relative {className}" bind:this={containerEl} bind:clientWidth={containerWidth}>
	{#if isEmpty}
		<div
			class="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
			style="height: {dims.height}px;"
		>
			No cost data available
		</div>
	{:else}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<svg
			bind:this={svgEl}
			width={dims.width}
			height={dims.height}
			class="overflow-visible"
			onmousemove={handleMouseMove}
			onmouseleave={handleMouseLeave}
		>
			<g class="x-axis"></g>
			<g class="y-axis"></g>
			<g transform="translate({MARGIN.left},{MARGIN.top})">
				<!-- Area fill -->
				<path d={areaPath} fill={chartColor(0)} fill-opacity="0.15" />
				<!-- Line -->
				<path d={linePath} fill="none" stroke={chartColor(0)} stroke-width="2" />
				<!-- Data points -->
				{#each sortedData as d (d.date)}
					<circle
						cx={xScale(d.date) ?? 0}
						cy={yScale(d.totalCostUSD)}
						r={tooltipData?.date === d.date ? 4 : 2.5}
						fill={chartColor(0)}
						class="transition-all"
					/>
				{/each}
			</g>
		</svg>

		<ChartTooltip visible={tooltipVisible} x={tooltipX} y={tooltipY}>
			{#if tooltipData}
				<p class="font-medium text-foreground">{formatDateShort(tooltipData.date)}</p>
				<p class="mt-0.5 text-muted-foreground">{formatCurrency(tooltipData.totalCostUSD)}</p>
				{#if Object.keys(tooltipData.byModel).length > 0}
					<div class="mt-1 space-y-0.5 border-t border-border pt-1">
						{#each Object.entries(tooltipData.byModel)
							.sort(([, a], [, b]) => b - a)
							.slice(0, 5) as [model, cost], i}
							<div class="flex items-center gap-1.5">
								<span
									class="h-2 w-2 rounded-full"
									style="background: {chartColor(i)}"
								></span>
								<span class="text-muted-foreground">{model}: {formatCurrency(cost)}</span>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</ChartTooltip>
	{/if}
</div>

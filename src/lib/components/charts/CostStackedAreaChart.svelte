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
	const ASPECT_RATIO = 2.2;

	const dims: ChartDimensions = $derived(computeDimensions(containerWidth, ASPECT_RATIO, MARGIN));

	const sortedData = $derived([...data].sort((a, b) => a.date.localeCompare(b.date)));
	const isEmpty = $derived(
		sortedData.length === 0 || sortedData.every((d) => d.totalCostUSD === 0)
	);

	// Extract all unique model keys, sorted by total cost descending for consistent stacking
	const modelKeys = $derived.by(() => {
		const totals = new Map<string, number>();
		for (const d of sortedData) {
			for (const [model, cost] of Object.entries(d.byModel)) {
				totals.set(model, (totals.get(model) ?? 0) + cost);
			}
		}
		return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
	});

	// Build tabular data for d3.stack: each row has date + one key per model
	const stackData = $derived.by(() => {
		return sortedData.map((d) => {
			const row: Record<string, number | string> = { date: d.date };
			for (const key of modelKeys) {
				row[key] = d.byModel[key] ?? 0;
			}
			return row;
		});
	});

	// d3.stack series
	const stackedSeries = $derived.by(() => {
		if (modelKeys.length === 0 || stackData.length === 0) return [];
		const stack = d3
			.stack<Record<string, number | string>>()
			.keys(modelKeys)
			.value((d, key) => (d[key] as number) ?? 0)
			.order(d3.stackOrderNone)
			.offset(d3.stackOffsetNone);
		return stack(stackData);
	});

	const xScale = $derived(
		d3
			.scalePoint<string>()
			.domain(sortedData.map((d) => d.date))
			.range([0, dims.innerWidth])
			.padding(0.5)
	);

	const yMax = $derived.by(() => {
		if (stackedSeries.length === 0) return 1;
		let max = 0;
		for (const series of stackedSeries) {
			for (const point of series) {
				if (point[1] > max) max = point[1];
			}
		}
		return max || 1;
	});

	const yScale = $derived(
		d3
			.scaleLinear()
			.domain([0, yMax * 1.1])
			.nice()
			.range([dims.innerHeight, 0])
	);

	// Generate area paths for each stacked series
	const areaPaths = $derived.by(() => {
		if (stackedSeries.length === 0) return [];
		const areaGen = d3
			.area<d3.SeriesPoint<Record<string, number | string>>>()
			.x((d) => xScale(d.data.date as string) ?? 0)
			.y0((d) => yScale(d[0]))
			.y1((d) => yScale(d[1]))
			.curve(d3.curveMonotoneX);

		return stackedSeries.map((series, i) => ({
			key: series.key,
			path: areaGen(series) ?? '',
			color: chartColor(i),
			index: i
		}));
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

	// Tooltip & hover state
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let hoveredDate: string | null = $state(null);
	let hoveredLayerKey: string | null = $state(null);
	let tooltipData: DailyCost | null = $state(null);

	// Crosshair X position (in inner coordinate space)
	const crosshairX = $derived(hoveredDate ? (xScale(hoveredDate) ?? null) : null);

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
		hoveredDate = closest.date;
		tooltipVisible = true;
	}

	function handleLayerEnter(key: string) {
		hoveredLayerKey = key;
	}

	function handleLayerLeave() {
		hoveredLayerKey = null;
	}

	function handleMouseLeave() {
		tooltipVisible = false;
		tooltipData = null;
		hoveredDate = null;
		hoveredLayerKey = null;
	}

	// Stable unique gradient ID prefix to avoid collisions between instances
	const gradientId = `stacked-grad-${Math.random().toString(36).slice(2, 8)}`;
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
			<!-- Gradient definitions: each model gets a vertical gradient fading to transparent -->
			<defs>
				{#each areaPaths as { key, color, index } (key)}
					<linearGradient id="{gradientId}-{index}" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stop-color={color} stop-opacity="0.6" />
						<stop offset="100%" stop-color={color} stop-opacity="0.05" />
					</linearGradient>
				{/each}
			</defs>

			<g class="x-axis"></g>
			<g class="y-axis"></g>

			<g transform="translate({MARGIN.left},{MARGIN.top})">
				<!-- Stacked area layers (render bottom-to-top, so last series is on top) -->
				{#each areaPaths as { key, path, color, index } (key)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<g
						onmouseenter={() => handleLayerEnter(key)}
						onmouseleave={handleLayerLeave}
					>
						<!-- Gradient fill -->
						<path
							d={path}
							fill="url(#{gradientId}-{index})"
							class="transition-opacity duration-200"
							opacity={hoveredLayerKey === null || hoveredLayerKey === key ? 1 : 0.3}
						/>
						<!-- Stroke line at the top of each area -->
						<path
							d={path}
							fill="none"
							stroke={color}
							stroke-width="1.5"
							class="transition-opacity duration-200"
							opacity={hoveredLayerKey === null || hoveredLayerKey === key ? 0.9 : 0.25}
						/>
					</g>
				{/each}

				<!-- Crosshair vertical line -->
				{#if crosshairX !== null}
					<line
						x1={crosshairX}
						y1={0}
						x2={crosshairX}
						y2={dims.innerHeight}
						stroke="var(--color-muted-foreground)"
						stroke-width="1"
						stroke-dasharray="3,3"
						opacity="0.5"
					/>
				{/if}
			</g>
		</svg>

		<!-- Legend -->
		<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1">
			{#each modelKeys.slice(0, 8) as key, i (key)}
				<div class="flex items-center gap-1.5 text-xs">
					<span
						class="h-2 w-2 shrink-0 rounded-full"
						style="background: {chartColor(i)}"
					></span>
					<span class="text-muted-foreground">{key}</span>
				</div>
			{/each}
		</div>

		<ChartTooltip visible={tooltipVisible} x={tooltipX} y={tooltipY}>
			{#if tooltipData}
				<p class="font-medium text-foreground">{formatDateShort(tooltipData.date)}</p>
				<p class="mt-0.5 font-medium text-foreground">{formatCurrency(tooltipData.totalCostUSD)}</p>
				{#if Object.keys(tooltipData.byModel).length > 0}
					<div class="mt-1.5 space-y-1 border-t border-border pt-1.5">
						{#each Object.entries(tooltipData.byModel)
							.sort(([, a], [, b]) => b - a)
							.slice(0, 8) as [model, cost]}
							{@const colorIdx = modelKeys.indexOf(model)}
							<div class="flex items-center gap-1.5">
								<span
									class="h-2 w-2 shrink-0 rounded-full"
									style="background: {chartColor(colorIdx >= 0 ? colorIdx : 0)}"
								></span>
								<span class="text-muted-foreground">{model}</span>
								<span class="ml-auto pl-2 tabular-nums text-foreground"
									>{formatCurrency(cost)}</span
								>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</ChartTooltip>
	{/if}
</div>

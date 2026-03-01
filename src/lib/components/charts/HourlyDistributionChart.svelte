<script lang="ts">
	import * as d3 from 'd3';
	import {
		formatNumber,
		formatHour,
		computeDimensions,
		type ChartDimensions
	} from '$lib/utils/chart-helpers';
	import ChartTooltip from './ChartTooltip.svelte';

	interface Props {
		/**
		 * Hour counts: keys are hour strings "0"-"23", values are activity counts.
		 * Matches StatsCache.hourCounts shape.
		 */
		data: Record<string, number>;
		class?: string;
	}

	const { data, class: className = '' }: Props = $props();

	// ── Responsive container ──────────────────────────────────────
	let containerWidth = $state(0);
	let svgEl: SVGSVGElement | undefined = $state();
	let containerEl: HTMLDivElement | undefined = $state();

	const MARGIN = { top: 12, right: 8, bottom: 32, left: 44 };
	const ASPECT_RATIO = 2.5;

	const dims: ChartDimensions = $derived(computeDimensions(containerWidth, ASPECT_RATIO, MARGIN));

	// ── Transform to array of 24 entries ──────────────────────────
	interface HourEntry {
		hour: number;
		label: string;
		count: number;
	}

	const hourData: HourEntry[] = $derived(
		Array.from({ length: 24 }, (_, i) => ({
			hour: i,
			label: String(i),
			count: data[String(i)] ?? 0
		}))
	);

	const isEmpty = $derived(hourData.every((h) => h.count === 0));

	// ── Scales ────────────────────────────────────────────────────
	const xScale = $derived(
		d3
			.scaleBand<string>()
			.domain(hourData.map((d) => d.label))
			.range([0, dims.innerWidth])
			.padding(0.15)
	);

	const yMax = $derived(d3.max(hourData, (d) => d.count) ?? 0);

	const yScale = $derived(
		d3
			.scaleLinear()
			.domain([0, yMax * 1.1 || 10])
			.nice()
			.range([dims.innerHeight, 0])
	);

	// ── D3 axes ──────────────────────────────────────────────────
	$effect(() => {
		if (!svgEl) return;

		const svg = d3.select(svgEl);

		// X axis: show every 3rd hour
		const xAxis = d3
			.axisBottom(xScale)
			.tickFormat((d) => {
				const hour = Number(d);
				return hour % 3 === 0 ? formatHour(hour) : '';
			})
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

	// ── Tooltip ──────────────────────────────────────────────────
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipEntry: HourEntry | null = $state(null);

	function handleBarEnter(event: MouseEvent, entry: HourEntry) {
		if (!containerEl) return;
		const rect = containerEl.getBoundingClientRect();
		tooltipX = event.clientX - rect.left;
		tooltipY = event.clientY - rect.top;
		tooltipEntry = entry;
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
		tooltipEntry = null;
	}

	// ── Color intensity based on count ────────────────────────────
	const opacityScale = $derived(
		d3.scaleLinear().domain([0, yMax || 1]).range([0.3, 1]).clamp(true)
	);
</script>

<div class="relative {className}" bind:this={containerEl} bind:clientWidth={containerWidth}>
	{#if isEmpty}
		<div
			class="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
			style="height: {dims.height}px;"
		>
			No hourly data available
		</div>
	{:else}
		<svg bind:this={svgEl} width={dims.width} height={dims.height} class="overflow-visible">
			<g class="x-axis"></g>
			<g class="y-axis"></g>
			<g transform="translate({MARGIN.left},{MARGIN.top})">
				{#each hourData as entry (entry.hour)}
					{@const barX = xScale(entry.label) ?? 0}
					{@const barHeight = dims.innerHeight - yScale(entry.count)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<rect
						x={barX}
						y={yScale(entry.count)}
						width={xScale.bandwidth()}
						height={Math.max(barHeight, 0)}
						rx="2"
						fill="var(--color-success)"
						fill-opacity={opacityScale(entry.count)}
						class="transition-opacity hover:!fill-opacity-100"
						onmouseenter={(e) => handleBarEnter(e, entry)}
						onmousemove={handleBarMove}
						onmouseleave={handleBarLeave}
					/>
				{/each}
			</g>
		</svg>

		<ChartTooltip visible={tooltipVisible} x={tooltipX} y={tooltipY}>
			{#if tooltipEntry}
				<p class="font-medium text-foreground">{formatHour(tooltipEntry.hour)}</p>
				<p class="mt-0.5 text-muted-foreground">{formatNumber(tooltipEntry.count)} activities</p>
			{/if}
		</ChartTooltip>
	{/if}
</div>

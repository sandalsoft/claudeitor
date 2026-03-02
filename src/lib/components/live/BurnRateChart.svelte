<script lang="ts">
	import * as d3 from 'd3';
	import {
		formatNumber,
		computeDimensions,
		CHART_COLORS,
		type ChartDimensions
	} from '$lib/utils/chart-helpers';

	interface TokenHistoryPoint {
		timestamp: number;
		tokensPerMinute: number;
	}

	interface Props {
		/** Token burn rate history (timestamps + tokens/min). */
		tokenHistory: TokenHistoryPoint[];
		/** Maximum rolling window size. Older points are discarded. */
		windowSize?: number;
		class?: string;
	}

	const { tokenHistory, windowSize = 30, class: className = '' }: Props = $props();

	// ── Responsive container ──────────────────────────────────────
	let containerWidth = $state(0);
	let svgEl: SVGSVGElement | undefined = $state();

	const MARGIN = { top: 12, right: 12, bottom: 28, left: 48 };
	const ASPECT_RATIO = 3; // wider than tall for a sparkline-like feel

	const dims: ChartDimensions = $derived(computeDimensions(containerWidth, ASPECT_RATIO, MARGIN));

	// ── Windowed data ─────────────────────────────────────────────
	const windowedData = $derived(tokenHistory.slice(-windowSize));

	// ── Scales ────────────────────────────────────────────────────
	const xScale = $derived(
		d3
			.scaleTime()
			.domain(
				windowedData.length > 0
					? [
							new Date(windowedData[0].timestamp),
							new Date(windowedData[windowedData.length - 1].timestamp)
						]
					: [new Date(), new Date()]
			)
			.range([0, dims.innerWidth])
	);

	const yMax = $derived(d3.max(windowedData, (d) => d.tokensPerMinute) ?? 10);

	const yScale = $derived(
		d3
			.scaleLinear()
			.domain([0, yMax * 1.1 || 10])
			.nice()
			.range([dims.innerHeight, 0])
	);

	// ── Line generator ────────────────────────────────────────────
	const lineGenerator = $derived(
		d3
			.line<TokenHistoryPoint>()
			.x((d) => xScale(new Date(d.timestamp)))
			.y((d) => yScale(d.tokensPerMinute))
			.curve(d3.curveMonotoneX)
	);

	// ── Area generator (for gradient fill under the line) ─────────
	const areaGenerator = $derived(
		d3
			.area<TokenHistoryPoint>()
			.x((d) => xScale(new Date(d.timestamp)))
			.y0(dims.innerHeight)
			.y1((d) => yScale(d.tokensPerMinute))
			.curve(d3.curveMonotoneX)
	);

	// ── D3 axis rendering ────────────────────────────────────────
	$effect(() => {
		if (!svgEl || windowedData.length < 2) return;

		const svg = d3.select(svgEl);

		// X axis: time labels
		const xAxis = d3
			.axisBottom(xScale)
			.ticks(Math.min(windowedData.length, 5))
			.tickFormat((d) => {
				const date = d as Date;
				return `${date.getMinutes()}:${String(date.getSeconds()).padStart(2, '0')}`;
			})
			.tickSizeOuter(0);

		svg
			.select<SVGGElement>('.x-axis')
			.attr('transform', `translate(${MARGIN.left},${MARGIN.top + dims.innerHeight})`)
			.transition()
			.duration(300)
			.call(xAxis)
			.call((g) => g.select('.domain').attr('stroke', 'var(--color-border)'))
			.call((g) =>
				g
					.selectAll('.tick line')
					.attr('stroke', 'var(--color-border)')
					.attr('stroke-opacity', 0.5)
			)
			.call((g) =>
				g.selectAll('.tick text').attr('fill', 'var(--color-muted-foreground)').attr('font-size', 9)
			);

		// Y axis
		const yAxis = d3
			.axisLeft(yScale)
			.ticks(4)
			.tickFormat((d) => formatNumber(d.valueOf()))
			.tickSizeOuter(0);

		svg
			.select<SVGGElement>('.y-axis')
			.attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)
			.transition()
			.duration(300)
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
				g.selectAll('.tick text').attr('fill', 'var(--color-muted-foreground)').attr('font-size', 9)
			);

		// Line path with smooth transition
		const lineGroup = svg.select<SVGGElement>('.line-group');

		// Area fill
		const areaPath = areaGenerator(windowedData) ?? '';
		lineGroup
			.select<SVGPathElement>('.area-path')
			.datum(windowedData)
			.transition()
			.duration(300)
			.attr('d', areaPath);

		// Line
		const linePath = lineGenerator(windowedData) ?? '';
		lineGroup
			.select<SVGPathElement>('.line-path')
			.datum(windowedData)
			.transition()
			.duration(300)
			.attr('d', linePath);
	});

	// ── Empty state ──────────────────────────────────────────────
	const isEmpty = $derived(windowedData.length < 2);

	const LINE_COLOR = CHART_COLORS[5]; // sky blue
</script>

<div class="relative {className}" bind:clientWidth={containerWidth}>
	{#if isEmpty}
		<div
			class="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground"
			style="height: {dims.height}px;"
		>
			Waiting for burn rate data...
		</div>
	{:else}
		<svg bind:this={svgEl} width={dims.width} height={dims.height} class="overflow-visible">
			<defs>
				<linearGradient id="burn-rate-gradient" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color={LINE_COLOR} stop-opacity="0.3" />
					<stop offset="100%" stop-color={LINE_COLOR} stop-opacity="0.02" />
				</linearGradient>
			</defs>
			<g class="x-axis"></g>
			<g class="y-axis"></g>
			<g class="line-group" transform="translate({MARGIN.left},{MARGIN.top})">
				<path class="area-path" fill="url(#burn-rate-gradient)" />
				<path
					class="line-path"
					fill="none"
					stroke={LINE_COLOR}
					stroke-width="2"
					stroke-linejoin="round"
					stroke-linecap="round"
				/>
			</g>
		</svg>
	{/if}
</div>

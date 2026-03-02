<script lang="ts">
	import * as d3 from 'd3';
	import {
		formatCurrency,
		computeDimensions,
		chartColor,
		type ChartDimensions
	} from '$lib/utils/chart-helpers';
	import ChartTooltip from './ChartTooltip.svelte';

	interface ModelCost {
		model: string;
		cost: number;
	}

	interface Props {
		/** Array of { model, cost } entries, pre-sorted or unsorted. */
		data: ModelCost[];
		/** Navigate to /costs on bar click. Default true. */
		navigateOnClick?: boolean;
		class?: string;
	}

	const { data, navigateOnClick = true, class: className = '' }: Props = $props();

	// ── Responsive container ──────────────────────────────────────
	let containerWidth = $state(0);
	let svgEl: SVGSVGElement | undefined = $state();
	let containerEl: HTMLDivElement | undefined = $state();

	// Dynamic height: 28px per bar + margins, minimum 120px
	const MARGIN = { top: 8, right: 48, bottom: 8, left: 0 };
	const BAR_HEIGHT = 28;

	const sortedData = $derived([...data].sort((a, b) => b.cost - a.cost));
	const isEmpty = $derived(sortedData.length === 0 || sortedData.every((d) => d.cost === 0));

	// For horizontal bars, we compute height from data length instead of aspect ratio
	const dynamicHeight = $derived(
		Math.max(sortedData.length * BAR_HEIGHT + MARGIN.top + MARGIN.bottom, 120)
	);

	const dims: ChartDimensions = $derived({
		width: Math.max(containerWidth, 200),
		height: dynamicHeight,
		innerWidth: Math.max(containerWidth, 200) - MARGIN.left - MARGIN.right,
		innerHeight: dynamicHeight - MARGIN.top - MARGIN.bottom,
		margin: MARGIN
	});

	// ── Label width: calculate from longest model name ──────────
	const labelWidth = $derived(Math.min(dims.innerWidth * 0.35, 120));
	const barAreaWidth = $derived(dims.innerWidth - labelWidth);

	// ── Scales ────────────────────────────────────────────────────
	const yScale = $derived(
		d3
			.scaleBand<string>()
			.domain(sortedData.map((d) => d.model))
			.range([0, dims.innerHeight])
			.padding(0.25)
	);

	const xMax = $derived(d3.max(sortedData, (d) => d.cost) ?? 0);

	const xScale = $derived(
		d3
			.scaleLinear()
			.domain([0, xMax * 1.1 || 10])
			.range([0, barAreaWidth])
	);

	// ── Tooltip ──────────────────────────────────────────────────
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipEntry: ModelCost | null = $state(null);

	function handleBarEnter(event: MouseEvent, entry: ModelCost) {
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

	function handleBarClick() {
		if (navigateOnClick && typeof window !== 'undefined') {
			window.location.href = '/costs';
		}
	}

	/** Truncate long model names for the label. */
	function truncateLabel(name: string, maxLen: number = 16): string {
		if (name.length <= maxLen) return name;
		return name.slice(0, maxLen - 1) + '\u2026';
	}
</script>

<div class="relative {className}" bind:this={containerEl} bind:clientWidth={containerWidth}>
	{#if isEmpty}
		<div
			class="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground"
			style="height: 120px;"
		>
			No cost data available
		</div>
	{:else}
		<svg bind:this={svgEl} width={dims.width} height={dims.height}>
			<g transform="translate({MARGIN.left},{MARGIN.top})">
				{#each sortedData as entry, i (entry.model)}
					{@const barY = yScale(entry.model) ?? 0}
					{@const barW = xScale(entry.cost)}
					{@const color = chartColor(i)}
					<g transform="translate(0,{barY})">
						<!-- Model label -->
						<text
							x={labelWidth - 8}
							y={yScale.bandwidth() / 2}
							text-anchor="end"
							dominant-baseline="central"
							fill="var(--color-muted-foreground)"
							font-size="11"
						>
							{truncateLabel(entry.model)}
						</text>

						<!-- Bar -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<rect
							x={labelWidth}
							y={0}
							width={Math.max(barW, 2)}
							height={yScale.bandwidth()}
							rx="3"
							fill={color}
							fill-opacity="0.8"
							class="transition-opacity hover:fill-opacity-100"
							style={navigateOnClick ? 'cursor: pointer;' : ''}
							onmouseenter={(e) => handleBarEnter(e, entry)}
							onmousemove={handleBarMove}
							onmouseleave={handleBarLeave}
							onclick={handleBarClick}
						/>

						<!-- Value label -->
						<text
							x={labelWidth + Math.max(barW, 2) + 6}
							y={yScale.bandwidth() / 2}
							dominant-baseline="central"
							fill="var(--color-muted-foreground)"
							font-size="10"
						>
							{formatCurrency(entry.cost)}
						</text>
					</g>
				{/each}
			</g>
		</svg>

		<ChartTooltip visible={tooltipVisible} x={tooltipX} y={tooltipY}>
			{#if tooltipEntry}
				<p class="font-medium text-foreground">{tooltipEntry.model}</p>
				<p class="mt-0.5 text-muted-foreground">{formatCurrency(tooltipEntry.cost)}</p>
			{/if}
		</ChartTooltip>
	{/if}
</div>
